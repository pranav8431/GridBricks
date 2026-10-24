"""Data-quality checks on the raw inputs. The results surface on the methodology page."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

import pandas as pd


@dataclass(frozen=True, slots=True)
class RunScheduleReport:
    schedule_utc: list[str]
    """Publish times (HH:MM UTC) seen on at least half of the days: the observed schedule."""
    runs: int
    off_schedule: list[datetime]
    missing: list[datetime]
    """Scheduled slots with no run, on days the data fully covers."""


@dataclass(frozen=True, slots=True)
class CoverageReport:
    expected: int
    present: int
    missing: list[datetime]


def infer_schedule(publish_times: pd.Series) -> list[str]:
    """Derive the run schedule from the data instead of trusting documentation."""
    unique = pd.Series(publish_times.dropna().unique())
    if unique.empty:
        return []
    days = unique.dt.date.nunique()
    counts = Counter(unique.dt.strftime("%H:%M"))
    return sorted(slot for slot, n in counts.items() if n >= days / 2)


def run_schedule_report(publish_times: pd.Series) -> RunScheduleReport:
    unique = pd.Series(sorted(publish_times.dropna().unique()))
    schedule = infer_schedule(unique)
    if unique.empty:
        return RunScheduleReport(schedule, 0, [], [])
    slots = set(schedule)
    stamps = [ts.to_pydatetime() for ts in unique]
    off = [ts for ts in stamps if ts.strftime("%H:%M") not in slots]
    present = {(ts.date(), ts.strftime("%H:%M")) for ts in stamps}
    # Only full days between the first and last day with data can be judged.
    first_day: date = stamps[0].date() + timedelta(days=1)
    last_day: date = stamps[-1].date() - timedelta(days=1)
    missing: list[datetime] = []
    day = first_day
    while day <= last_day:
        for slot in schedule:
            if (day, slot) not in present:
                hh, mm = (int(part) for part in slot.split(":"))
                missing.append(datetime.combine(day, time(hh, mm), tzinfo=UTC))
        day += timedelta(days=1)
    return RunScheduleReport(schedule, len(stamps), off, missing)


def half_hourly_coverage(start_times: pd.Series, start: datetime, end: datetime) -> CoverageReport:
    """Check that every half-hour period in ``[start, end)`` has a value."""
    expected = pd.date_range(start, end, freq="30min", inclusive="left")
    present = set(start_times.dropna())
    missing = [ts.to_pydatetime() for ts in expected if ts not in present]
    return CoverageReport(len(expected), len(expected) - len(missing), missing)
