from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from conftest import synthetic_settings
from gridbricks.main import create_app
from gridbricks.repository import InMemoryRepository, SnapshotRepository

BRIEF = "/api/v1/brief?decision_date=2026-01-21"


def test_health_reports_the_snapshot(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert len(body["snapshot_version"]) == 12
    assert response.headers["cache-control"] == "no-store"


def test_meta_describes_scope_and_gates(client: TestClient) -> None:
    body = client.get("/api/v1/meta").json()
    assert body["first_decision_date"] == "2026-01-20"
    assert body["first_delivery_date"] == "2026-01-21"
    assert body["calibration_from"] == "2026-01-17"
    assert [g["id"] for g in body["gates"]] == ["epex_hourly", "n2ex", "epex_halfhourly"]
    assert body["run_schedule_utc"][2] == "07:30"


def test_brief_uses_the_run_available_at_gate_closure(client: TestClient) -> None:
    body = client.get(BRIEF).json()
    assert body["delivery_date"] == "2026-01-22"
    assert body["cutoff"] == "2026-01-21T09:20:00Z"
    assert body["decision_run"] == "2026-01-21T07:30:00Z"
    assert body["decision_run_age_minutes"] == 110
    assert body["next_run"]["publish_time"] == "2026-01-21T09:30:00Z"
    assert body["next_run"]["available_at_decision"] is False
    assert len(body["hours"]) == 24
    assert len(body["actuals"]) == 48
    assert body["calibration"]["sufficient"] is True
    assert body["energy"]["p10_gwh"] <= body["energy"]["p50_gwh"] <= body["energy"]["p90_gwh"]

    runs = {r["publish_time"][11:16]: r for r in body["runs_on_decision_day"]}
    assert "11:30" not in runs
    assert runs["12:25"]["off_schedule"] is True
    assert runs["07:30"]["available_at_decision"] is True


def test_custom_cutoff_changes_the_run(client: TestClient) -> None:
    body = client.get(f"{BRIEF}&cutoff=10:00").json()
    assert body["gate"]["is_custom"] is True
    assert body["decision_run"] == "2026-01-21T09:30:00Z"


def test_brief_csv_has_one_row_per_hourly_product(client: TestClient) -> None:
    response = client.get("/api/v1/brief.csv?decision_date=2026-01-21&gate=n2ex")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "gridbricks-brief-2026-01-21-n2ex.csv" in response.headers["content-disposition"]
    lines = response.text.strip().splitlines()
    assert lines[0].startswith("product_start_uk,product_end_uk,forecast_mw")
    assert len(lines) == 25
    assert lines[1].startswith("2026-01-21 23:00,2026-01-22 00:00")


def test_evolution_separates_runs_before_and_after_the_decision(client: TestClient) -> None:
    body = client.get("/api/v1/evolution?decision_date=2026-01-21").json()
    flags = [(r["publish_time"][:16], r["available_at_decision"]) for r in body["runs"]]
    assert ("2026-01-21T07:30", True) in flags
    assert ("2026-01-21T09:30", False) in flags
    assert sum(r["is_decision_run"] for r in body["runs"]) == 1
    assert all(len(r["points"]) <= 24 for r in body["runs"])


def test_accuracy_summarises_the_backtest(client: TestClient) -> None:
    body = client.get("/api/v1/accuracy").json()
    assert body["delivery_from"] == "2026-01-21"
    assert body["delivery_to"] == "2026-01-23"
    assert body["published"]["n"] == 72
    assert body["published"]["bias_mw"] > 0  # synthetic actuals sit 15% below the forecast
    assert body["adjusted"]["mae_mw"] < body["published"]["mae_mw"]
    assert len(body["series"]) == 72
    assert len(body["daily"]) == 3
    assert [g["gate"]["id"] for g in body["gate_comparison"]] == [
        "epex_hourly",
        "n2ex",
        "epex_halfhourly",
    ]
    assert sum(b["count"] for b in body["histogram"]) == 72


def test_accuracy_with_custom_cutoff_adds_it_to_the_comparison(client: TestClient) -> None:
    body = client.get("/api/v1/accuracy?cutoff=12:00").json()
    assert body["gate_comparison"][-1]["gate"]["id"] == "custom"


def test_horizon_buckets_cover_the_decision_range(client: TestClient) -> None:
    body = client.get("/api/v1/accuracy/horizon").json()
    assert body["bucket_hours"] == 3
    assert body["buckets"][0]["lower_h"] == 0
    assert body["decision_horizon_min_h"] == 15.5
    assert body["decision_horizon_max_h"] == 38.5


def test_quality_lists_the_late_run(client: TestClient) -> None:
    body = client.get("/api/v1/quality").json()
    assert body["off_schedule_runs"] == ["2026-01-21T12:25:00Z"]
    assert body["missing_scheduled_runs"] == ["2026-01-21T11:30:00Z"]
    assert body["actual_periods_present"] == body["actual_periods_expected"]


def test_out_of_scope_dates_are_problem_responses(client: TestClient) -> None:
    response = client.get("/api/v1/brief?decision_date=2026-02-14")
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    body = response.json()
    assert body["title"] == "Outside pilot scope"
    assert body["request_id"] == response.headers["x-request-id"]


def test_invalid_parameters_are_problem_responses(client: TestClient) -> None:
    for url in (f"{BRIEF}&cutoff=9:20", f"{BRIEF}&gate=apx", "/api/v1/brief"):
        response = client.get(url)
        assert response.status_code == 422, url
        assert response.json()["title"] == "Invalid request"
    reversed_range = client.get("/api/v1/accuracy?decision_from=2026-01-22&decision_to=2026-01-20")
    assert reversed_range.status_code == 422


def test_unknown_api_route_is_404_problem(client: TestClient) -> None:
    response = client.get("/api/v1/nope")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"


def test_security_headers_and_request_id(client: TestClient) -> None:
    response = client.get("/api/v1/meta", headers={"X-Request-ID": "trace-123"})
    assert response.headers["x-request-id"] == "trace-123"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "default-src 'self'" in response.headers["content-security-policy"]
    unsafe = client.get("/api/v1/meta", headers={"X-Request-ID": "bad id with spaces"})
    assert unsafe.headers["x-request-id"] != "bad id with spaces"


def test_api_responses_are_not_cached_outside_production(client: TestClient) -> None:
    assert client.get("/api/v1/meta").headers["cache-control"] == "no-store"


def test_production_responses_are_cacheable_and_revalidate(
    synthetic_repo: InMemoryRepository,
) -> None:
    app = create_app(synthetic_settings(environment="production"), synthetic_repo)
    with TestClient(app) as prod:
        first = prod.get("/api/v1/meta")
        assert "s-maxage=86400" in first.headers["cache-control"]
        etag = first.headers["etag"]
        second = prod.get("/api/v1/meta", headers={"If-None-Match": etag})
        assert second.status_code == 304
        assert second.content == b""
        error = prod.get("/api/v1/brief?decision_date=2025-01-01")
        assert error.headers["cache-control"] == "no-store"


def test_missing_snapshot_degrades_gracefully(tmp_path: Path) -> None:
    app = create_app(synthetic_settings(data_dir=tmp_path), SnapshotRepository(tmp_path))
    with TestClient(app) as degraded:
        health = degraded.get("/api/health")
        assert health.status_code == 503
        assert health.json()["status"] == "degraded"
        meta = degraded.get("/api/v1/meta")
        assert meta.status_code == 503
        assert meta.json()["title"] == "Data unavailable"


def test_spa_is_served_with_client_side_routing(
    tmp_path: Path, synthetic_repo: InMemoryRepository
) -> None:
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>app</html>")
    (static / "assets" / "app-abc123.js").write_text("console.log(1)")
    (static / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("secret")

    app = create_app(synthetic_settings(static_dir=static), synthetic_repo)
    with TestClient(app) as spa:
        assert spa.get("/").text == "<html>app</html>"
        assert spa.get("/accuracy").text == "<html>app</html>"
        assert spa.get("/favicon.svg").text == "<svg/>"
        asset = spa.get("/assets/app-abc123.js")
        assert "immutable" in asset.headers["cache-control"]
        assert spa.get("/..%2Fsecret.txt").text == "<html>app</html>"
        assert spa.get("/api/v1/nothing").status_code == 404
        assert spa.get("/api/v1/meta").status_code == 200
