"""Synthetic data shaped like the real feeds, for fast and fully controlled tests."""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable
from datetime import UTC, date, datetime, time, timedelta

import numpy as np
import pandas as pd

from gridbricks.domain.frames import (
    GENERATION_MW,
    PUBLISH_TIME,
    SETTLEMENT_DATE,
    SETTLEMENT_PERIOD,
    START_TIME,
    to_utc,
)
from gridbricks.domain.market import UK_TZ
from gridbricks.repository import DatasetManifest, InMemoryRepository, SnapshotManifest

SCHEDULE = (time(2, 30), time(4, 30), time(7, 30), time(9, 30), time(11, 30), time(15, 30),
            time(18, 30), time(22, 30))  # fmt: skip


def utc(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


def base_profile(t: datetime) -> float:
    """A smooth diurnal shape between roughly 6 and 14 GW."""
    hours = t.timestamp() / 3600.0
    return 10_000.0 + 4_000.0 * math.sin(2 * math.pi * hours / 24.0)


def run_times(
    first: date,
    last: date,
    skip: Iterable[datetime] = (),
    extra: Iterable[datetime] = (),
) -> list[datetime]:
    skipped = set(skip)
    times = [
        datetime.combine(first + timedelta(days=d), slot, tzinfo=UTC)
        for d in range((last - first).days + 1)
        for slot in SCHEDULE
    ]
    return sorted([t for t in times if t not in skipped] + list(extra))


def forecasts_frame(
    publish_times: Iterable[datetime],
    value: Callable[[datetime, datetime], float] | None = None,
) -> pd.DataFrame:
    """Each run covers 73 hours from 21:00 UTC the day before publication, like WINDFOR."""
    value = value or (lambda publish, start: base_profile(start) + publish.hour * 10.0)
    rows = []
    for publish in publish_times:
        window_start = datetime.combine(publish.date() - timedelta(days=1), time(21), tzinfo=UTC)
        for h in range(73):
            start = window_start + timedelta(hours=h)
            rows.append((publish, start, value(publish, start)))
    frame = pd.DataFrame(rows, columns=[PUBLISH_TIME, START_TIME, GENERATION_MW])
    frame[PUBLISH_TIME] = to_utc(frame[PUBLISH_TIME])
    frame[START_TIME] = to_utc(frame[START_TIME])
    return frame


def actuals_frame(
    first: datetime, last: datetime, value: Callable[[datetime], float] | None = None
) -> pd.DataFrame:
    """Half-hourly outturn in ``[first, last)``, published 30 minutes after each period starts."""
    value = value or (lambda start: base_profile(start) * 0.85)
    starts = list(pd.date_range(first, last, freq="30min", inclusive="left"))
    local = [s.tz_convert(UK_TZ) for s in starts]
    frame = pd.DataFrame(
        {
            START_TIME: to_utc(starts),
            PUBLISH_TIME: to_utc([s + pd.Timedelta(minutes=30) for s in starts]),
            SETTLEMENT_DATE: [ts.date() for ts in local],
            SETTLEMENT_PERIOD: [ts.hour * 2 + ts.minute // 30 + 1 for ts in local],
            GENERATION_MW: [value(s.to_pydatetime()) for s in starts],
        }
    )
    frame[SETTLEMENT_PERIOD] = frame[SETTLEMENT_PERIOD].astype("int64")
    return frame


def noisy(frame: pd.DataFrame, seed: int, scale: float = 0.15) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    out = frame.copy()
    out[GENERATION_MW] = out[GENERATION_MW] * rng.uniform(1 - scale, 1 + scale, len(out))
    return out


def manifest(label: str = "synthetic") -> SnapshotManifest:
    return SnapshotManifest(
        generated_at=utc(2026, 2, 2),
        source=label,
        datasets={
            "WINDFOR": DatasetManifest("WINDFOR", "/datasets/WINDFOR/stream", {}, "f", 1, "a" * 64),
            "FUELHH": DatasetManifest("FUELHH", "/datasets/FUELHH/stream", {}, "a", 1, "b" * 64),
        },
    )


def repository(forecasts: pd.DataFrame, actuals: pd.DataFrame) -> InMemoryRepository:
    return InMemoryRepository(forecasts, actuals, manifest())
