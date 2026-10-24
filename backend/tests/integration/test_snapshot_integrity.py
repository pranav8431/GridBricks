"""Sanity checks on the committed data snapshot itself."""

from __future__ import annotations

import pytest

from gridbricks.config import DEFAULT_DATA_DIR
from gridbricks.repository import SnapshotRepository

pytestmark = pytest.mark.snapshot

REPO = SnapshotRepository(DEFAULT_DATA_DIR)


def test_manifest_checksums_match_the_files() -> None:
    manifest = REPO.manifest()
    assert set(manifest.datasets) == {"WINDFOR", "FUELHH"}
    # Loading verifies each file's SHA-256 against the manifest.
    assert len(REPO.load_forecasts()) == manifest.datasets["WINDFOR"].rows
    assert len(REPO.load_actuals()) == manifest.datasets["FUELHH"].rows


def test_forecasts_are_plausible_and_unique() -> None:
    f = REPO.load_forecasts()
    assert not f.duplicated(["publish_time", "start_time"]).any()
    assert f["generation_mw"].between(0, 40_000).all()
    assert (f["start_time"].dt.minute == 0).all()  # WINDFOR is hourly
    per_run = f.groupby("publish_time").size()
    assert per_run.min() == per_run.max() == 73


def test_actuals_cover_every_settlement_period_once() -> None:
    a = REPO.load_actuals()
    assert not a["start_time"].duplicated().any()
    assert a["generation_mw"].between(0, 40_000).all()
    per_day = a.groupby("settlement_date").size()
    assert set(per_day.unique()) <= {46, 48, 50}
    assert a["settlement_period"].between(1, 50).all()
