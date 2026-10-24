"""Latency budgets on the real snapshot: generous for CI, tight enough to catch regressions."""

from __future__ import annotations

import statistics
import time
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from gridbricks.config import DEFAULT_DATA_DIR, Settings
from gridbricks.main import create_app
from gridbricks.repository import SnapshotRepository

pytestmark = [pytest.mark.snapshot, pytest.mark.perf]

BUDGET_MS = {
    "/api/v1/meta": 50,
    "/api/v1/brief?decision_date=2026-01-14": 150,
    "/api/v1/evolution?decision_date=2026-01-14": 150,
    "/api/v1/accuracy": 600,
    "/api/v1/accuracy/horizon": 300,
    "/api/v1/quality": 150,
}


@pytest.fixture(scope="module")
def warm_client() -> Iterator[TestClient]:
    settings = Settings(environment="test", data_dir=DEFAULT_DATA_DIR)
    started = time.perf_counter()
    with TestClient(create_app(settings, SnapshotRepository(DEFAULT_DATA_DIR))) as client:
        startup = time.perf_counter() - started
        assert startup < 10, f"cold start took {startup:.1f}s"
        yield client


@pytest.mark.parametrize(("path", "budget_ms"), BUDGET_MS.items())
def test_warm_latency_within_budget(warm_client: TestClient, path: str, budget_ms: int) -> None:
    warm_client.get(path)
    timings = []
    for _ in range(5):
        started = time.perf_counter()
        response = warm_client.get(path)
        timings.append((time.perf_counter() - started) * 1000)
        assert response.status_code == 200
    assert statistics.median(timings) < budget_ms, (
        f"{path}: median {statistics.median(timings):.0f} ms"
    )


def test_custom_cutoff_is_computed_on_demand_quickly(warm_client: TestClient) -> None:
    started = time.perf_counter()
    response = warm_client.get("/api/v1/brief?decision_date=2026-01-14&cutoff=10:45")
    elapsed = (time.perf_counter() - started) * 1000
    assert response.status_code == 200
    assert elapsed < 2_000
