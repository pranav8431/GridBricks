"""Property-based API fuzzing: whatever a client sends, the API answers 200 or a clean 4xx."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from conftest import synthetic_settings
from factories import actuals_frame, forecasts_frame, noisy, repository, run_times, utc
from gridbricks.main import create_app

ENDPOINTS = ["/api/v1/brief", "/api/v1/brief.csv", "/api/v1/evolution", "/api/v1/accuracy"]

dates = st.one_of(
    st.dates(date(2025, 12, 1), date(2026, 3, 1)).map(date.isoformat),
    st.text(max_size=12),
)
gates = st.one_of(st.sampled_from(["epex_hourly", "n2ex", "epex_halfhourly"]), st.text(max_size=10))
cutoffs = st.one_of(
    st.none(),
    st.from_regex(r"\A([01]\d|2[0-3]):[0-5]\d\Z", fullmatch=True),
    st.text(max_size=8),
)


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    runs = run_times(date(2026, 1, 13), date(2026, 1, 23))
    repo = repository(
        noisy(forecasts_frame(runs), seed=3, scale=0.05),
        noisy(actuals_frame(utc(2026, 1, 15, 23), utc(2026, 1, 23, 23)), seed=4),
    )
    with TestClient(create_app(synthetic_settings(), repo)) as test_client:
        yield test_client


@settings(
    max_examples=120, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@given(endpoint=st.sampled_from(ENDPOINTS), day=dates, gate=gates, cutoff=cutoffs)
def test_never_a_server_error(
    client: TestClient, endpoint: str, day: str, gate: str, cutoff: str | None
) -> None:
    params = {"decision_date": day, "decision_from": day, "gate": gate}
    if cutoff is not None:
        params["cutoff"] = cutoff
    response = client.get(endpoint, params=params)
    assert response.status_code in (200, 422), (params, response.text)
    if response.status_code == 422:
        assert response.headers["content-type"] == "application/problem+json"
        body = response.json()
        assert body["status"] == 422
        assert body["title"]
        assert body["request_id"] == response.headers["x-request-id"]
