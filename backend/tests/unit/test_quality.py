from __future__ import annotations

from datetime import date

import pandas as pd

from factories import SCHEDULE, run_times, utc
from gridbricks.domain.frames import to_utc
from gridbricks.domain.quality import half_hourly_coverage, infer_schedule, run_schedule_report


def test_schedule_is_inferred_from_the_data() -> None:
    times = to_utc(run_times(date(2026, 1, 1), date(2026, 1, 10)))
    assert infer_schedule(times) == [slot.strftime("%H:%M") for slot in SCHEDULE]


def test_late_and_missing_runs_are_reported() -> None:
    times = run_times(
        date(2026, 1, 13),
        date(2026, 1, 17),
        skip=[utc(2026, 1, 15, 11, 30)],
        extra=[utc(2026, 1, 15, 12, 25)],
    )
    report = run_schedule_report(to_utc(times))
    assert report.off_schedule == [utc(2026, 1, 15, 12, 25)]
    assert report.missing == [utc(2026, 1, 15, 11, 30)]
    assert report.runs == len(times)


def test_empty_input_gives_empty_report() -> None:
    report = run_schedule_report(pd.Series([], dtype="datetime64[us, UTC]"))
    assert report.runs == 0
    assert report.schedule_utc == []


def test_half_hourly_coverage_finds_gaps() -> None:
    present = to_utc(
        pd.date_range(utc(2026, 1, 1), utc(2026, 1, 2), freq="30min", inclusive="left")
    )
    gappy = present.drop(index=[5, 6])
    report = half_hourly_coverage(gappy, utc(2026, 1, 1), utc(2026, 1, 2))
    assert report.expected == 48
    assert report.present == 46
    assert report.missing == [utc(2026, 1, 1, 2, 30), utc(2026, 1, 1, 3)]
