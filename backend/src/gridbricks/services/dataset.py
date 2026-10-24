"""Loading and cleaning the raw data once per process."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

import pandas as pd

from gridbricks.domain.frames import GENERATION_MW, PUBLISH_TIME, START_TIME
from gridbricks.domain.market import UK_TZ, delivery_window
from gridbricks.domain.quality import RunScheduleReport, run_schedule_report
from gridbricks.domain.selection import drop_stale_points
from gridbricks.repository import DataRepository, SnapshotManifest

DELIVERY_DATE = "delivery_date"


@dataclass(frozen=True, slots=True)
class DeskData:
    """Clean, immutable inputs shared by every request."""

    forecasts: pd.DataFrame
    """WINDFOR points with stale values removed, sorted by publish time then target time."""
    actuals: pd.DataFrame
    """Half-hourly wind outturn, one row per period, with its delivery day."""
    actual_by_start: pd.Series
    run_times: list[datetime]
    """Every publish time in the data, sorted, including off-schedule runs."""
    schedule: RunScheduleReport
    manifest: SnapshotManifest
    raw_forecast_points: int
    stale_points_removed: int
    duplicate_actuals_removed: int

    def actuals_between(self, start: datetime, end: datetime) -> pd.DataFrame:
        times = self.actuals[START_TIME]
        return self.actuals.loc[(times >= start) & (times < end)]


def delivery_date_of(start_times: pd.Series) -> pd.Series:
    """Delivery day of each period: products run 23:00 D-1 to 23:00 D, UK time."""
    local = start_times.dt.tz_convert(UK_TZ) + pd.Timedelta(hours=1)
    return pd.Series([ts.date() for ts in local], index=start_times.index, dtype="object")


def load_desk_data(repository: DataRepository) -> DeskData:
    manifest = repository.manifest()
    raw = repository.load_forecasts().drop_duplicates([PUBLISH_TIME, START_TIME], keep="last")
    clean = drop_stale_points(raw).sort_values([PUBLISH_TIME, START_TIME], kind="stable")

    raw_actuals = repository.load_actuals()
    actuals = (
        raw_actuals.sort_values([START_TIME, PUBLISH_TIME], kind="stable")
        .drop_duplicates(START_TIME, keep="last")
        .reset_index(drop=True)
    )
    actuals[DELIVERY_DATE] = delivery_date_of(actuals[START_TIME])

    run_times = [ts.to_pydatetime() for ts in sorted(raw[PUBLISH_TIME].unique())]
    return DeskData(
        forecasts=clean.reset_index(drop=True),
        actuals=actuals,
        actual_by_start=actuals.set_index(START_TIME)[GENERATION_MW],
        run_times=run_times,
        schedule=run_schedule_report(raw[PUBLISH_TIME]),
        manifest=manifest,
        raw_forecast_points=len(raw),
        stale_points_removed=len(raw) - len(clean),
        duplicate_actuals_removed=len(raw_actuals) - len(actuals),
    )


def daily_actual_energy(data: DeskData, days: list[date]) -> dict[date, float | None]:
    """Actual wind energy (GWh) per delivery day; ``None`` unless every half-hour is present."""
    grouped = data.actuals.groupby(DELIVERY_DATE)[GENERATION_MW]
    sums = {day: float(total) for day, total in grouped.sum().items()}
    counts = {day: int(n) for day, n in grouped.count().items()}
    result: dict[date, float | None] = {}
    for day in days:
        start, end = delivery_window(day)
        expected = int((end - start).total_seconds() // 1800)
        if counts.get(day) == expected:
            result[day] = sums[day] * 0.5 / 1000.0
        else:
            result[day] = None
    return result
