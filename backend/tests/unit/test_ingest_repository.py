from __future__ import annotations

import gzip
from datetime import date
from pathlib import Path

import httpx
import pytest
import respx
from tenacity import wait_none

from factories import utc
from gridbricks.config import Settings
from gridbricks.elexon.client import ElexonClient
from gridbricks.ingest import IngestWindows, default_windows, run_ingest
from gridbricks.repository import FORECASTS_FILE, SnapshotRepository, SnapshotUnavailableError

BASE = "https://elexon.test/api/v1"
WINDOWS = IngestWindows(utc(2026, 1, 14), utc(2026, 1, 15), date(2026, 1, 14), date(2026, 1, 14))


def mock_elexon() -> None:
    respx.get(f"{BASE}/datasets/WINDFOR/stream").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "dataset": "WINDFOR",
                    "publishTime": "2026-01-14T07:30:00Z",
                    "startTime": f"2026-01-15T{h:02d}:00:00Z",
                    "generation": 10_000 + h,
                }
                for h in range(3)
            ],
        )
    )
    respx.get(f"{BASE}/datasets/FUELHH/stream").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "dataset": "FUELHH",
                    "publishTime": "2026-01-15T00:30:00Z",
                    "startTime": "2026-01-15T00:00:00Z",
                    "settlementDate": "2026-01-15",
                    "settlementPeriod": 1,
                    "fuelType": "WIND",
                    "generation": 9_500,
                }
            ],
        )
    )


@respx.mock
def test_ingest_writes_a_verifiable_deterministic_snapshot(tmp_path: Path) -> None:
    mock_elexon()
    with ElexonClient(BASE, retry_wait=wait_none()) as client:
        manifest = run_ingest(client, WINDOWS, tmp_path)
        first_bytes = (tmp_path / FORECASTS_FILE).read_bytes()
        run_ingest(client, WINDOWS, tmp_path)
    assert (tmp_path / FORECASTS_FILE).read_bytes() == first_bytes  # idempotent

    repo = SnapshotRepository(tmp_path)
    assert repo.manifest().version == manifest.version
    forecasts = repo.load_forecasts()
    assert len(forecasts) == 3
    assert str(forecasts["publish_time"].dtype) == "datetime64[us, UTC]"
    assert repo.load_actuals()["generation_mw"].tolist() == [9_500.0]


@respx.mock
def test_tampered_snapshot_fails_its_checksum(tmp_path: Path) -> None:
    mock_elexon()
    with ElexonClient(BASE, retry_wait=wait_none()) as client:
        run_ingest(client, WINDOWS, tmp_path)
    (tmp_path / FORECASTS_FILE).write_bytes(gzip.compress(b"[]"))
    with pytest.raises(SnapshotUnavailableError, match="Checksum"):
        SnapshotRepository(tmp_path).load_forecasts()


def test_missing_snapshot_is_reported(tmp_path: Path) -> None:
    with pytest.raises(SnapshotUnavailableError, match="ingest"):
        SnapshotRepository(tmp_path).manifest()


def test_default_windows_include_the_calibration_warm_up() -> None:
    windows = default_windows(Settings(environment="test"))
    assert windows.settlement_from == date(2025, 12, 17)  # window of 18 Dec starts 17 Dec 23:00
    assert windows.settlement_to == date(2026, 2, 1)
    assert windows.publish_from == utc(2025, 12, 15)
    assert windows.publish_to == utc(2026, 2, 1, 23)
