from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from factories import actuals_frame, forecasts_frame, noisy, repository, run_times, utc
from gridbricks.config import DEFAULT_DATA_DIR, Settings
from gridbricks.main import create_app
from gridbricks.repository import InMemoryRepository, SnapshotRepository
from gridbricks.services.desk import DeskService

#: A late run like the real one on 15 Jan 2026: no 11:30 run, a run at 12:25 instead.
LATE_RUN = utc(2026, 1, 21, 12, 25)
SKIPPED_RUN = utc(2026, 1, 21, 11, 30)


def synthetic_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "first_decision_date": date(2026, 1, 20),
        "last_decision_date": date(2026, 1, 22),
        "calibration_window_days": 3,
        "calibration_min_samples": 24,
        "data_dir": Path("/nonexistent"),
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


@pytest.fixture(scope="session")
def synthetic_repo() -> InMemoryRepository:
    runs = run_times(date(2026, 1, 13), date(2026, 1, 23), skip=[SKIPPED_RUN], extra=[LATE_RUN])
    forecasts = noisy(forecasts_frame(runs), seed=1, scale=0.05)
    actuals = noisy(actuals_frame(utc(2026, 1, 15, 23), utc(2026, 1, 23, 23)), seed=2)
    return repository(forecasts, actuals)


@pytest.fixture
def settings() -> Settings:
    return synthetic_settings()


@pytest.fixture
def desk(synthetic_repo: InMemoryRepository, settings: Settings) -> DeskService:
    return DeskService(synthetic_repo, settings)


@pytest.fixture
def client(synthetic_repo: InMemoryRepository, settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings, synthetic_repo)) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def snapshot_desk() -> DeskService:
    """The real, committed January 2026 snapshot."""
    settings = Settings(environment="test", data_dir=DEFAULT_DATA_DIR)
    return DeskService(SnapshotRepository(DEFAULT_DATA_DIR), settings)
