from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pandas as pd
from hypothesis import given, settings
from hypothesis import strategies as st

from factories import utc
from gridbricks.domain.frames import GENERATION_MW, PUBLISH_TIME, START_TIME, to_utc
from gridbricks.domain.selection import CUTOFF, FORECAST_MW, drop_stale_points, latest_before


def forecasts(rows: list[tuple[datetime, datetime, float]]) -> pd.DataFrame:
    frame = pd.DataFrame(rows, columns=[PUBLISH_TIME, START_TIME, GENERATION_MW])
    frame[PUBLISH_TIME] = to_utc(frame[PUBLISH_TIME])
    frame[START_TIME] = to_utc(frame[START_TIME])
    return frame


def targets(rows: list[tuple[datetime, datetime]]) -> pd.DataFrame:
    frame = pd.DataFrame(rows, columns=[START_TIME, CUTOFF])
    frame[START_TIME] = to_utc(frame[START_TIME])
    frame[CUTOFF] = to_utc(frame[CUTOFF])
    return frame


TARGET = utc(2026, 1, 15, 12)
RUNS = forecasts(
    [
        (utc(2026, 1, 14, 4, 30), TARGET, 100.0),
        (utc(2026, 1, 14, 7, 30), TARGET, 200.0),
        (utc(2026, 1, 14, 9, 30), TARGET, 300.0),
    ]
)


def test_picks_latest_run_strictly_before_cutoff() -> None:
    result = latest_before(RUNS, targets([(TARGET, utc(2026, 1, 14, 9, 20))]))
    assert result.loc[0, PUBLISH_TIME] == utc(2026, 1, 14, 7, 30)
    assert result.loc[0, FORECAST_MW] == 200.0


def test_run_published_exactly_at_cutoff_is_not_available() -> None:
    result = latest_before(RUNS, targets([(TARGET, utc(2026, 1, 14, 9, 30))]))
    assert result.loc[0, PUBLISH_TIME] == utc(2026, 1, 14, 7, 30)


def test_missing_run_falls_back_to_the_previous_one() -> None:
    without_0730 = RUNS[RUNS[PUBLISH_TIME] != utc(2026, 1, 14, 7, 30)]
    result = latest_before(without_0730, targets([(TARGET, utc(2026, 1, 14, 9, 20))]))
    assert result.loc[0, FORECAST_MW] == 100.0


def test_target_with_no_earlier_run_gets_nothing() -> None:
    result = latest_before(RUNS, targets([(TARGET, utc(2026, 1, 14, 3))]))
    assert pd.isna(result.loc[0, PUBLISH_TIME])
    assert pd.isna(result.loc[0, FORECAST_MW])


def test_missing_cutoff_is_tolerated_and_row_order_preserved() -> None:
    rows = targets([(TARGET, utc(2026, 1, 14, 23)), (TARGET, utc(2026, 1, 14, 9, 20))])
    rows.loc[0, CUTOFF] = pd.NaT
    result = latest_before(RUNS, rows)
    assert pd.isna(result.loc[0, FORECAST_MW])
    assert result.loc[1, FORECAST_MW] == 200.0


def test_runs_only_count_for_the_hours_they_cover() -> None:
    other_hour = forecasts([(utc(2026, 1, 14, 9), TARGET + timedelta(hours=1), 999.0)])
    result = latest_before(
        pd.concat([RUNS, other_hour]), targets([(TARGET, utc(2026, 1, 14, 9, 20))])
    )
    assert result.loc[0, FORECAST_MW] == 200.0


def test_stale_points_before_publish_time_are_dropped() -> None:
    frame = forecasts(
        [
            (utc(2026, 1, 14, 9, 30), utc(2026, 1, 14, 8), 1.0),  # already started: stale
            (utc(2026, 1, 14, 9, 30), utc(2026, 1, 14, 9, 30), 2.0),  # starts now: kept
            (utc(2026, 1, 14, 9, 30), utc(2026, 1, 14, 10), 3.0),
        ]
    )
    assert drop_stale_points(frame)[GENERATION_MW].tolist() == [2.0, 3.0]


BASE = datetime(2026, 1, 10, tzinfo=UTC)


@settings(max_examples=150, deadline=None)
@given(
    points=st.lists(
        st.tuples(st.integers(0, 4 * 24 * 60), st.integers(0, 5), st.integers(0, 20_000)),
        max_size=40,
    ),
    queries=st.lists(
        st.tuples(st.integers(0, 5), st.integers(0, 4 * 24 * 60)), min_size=1, max_size=8
    ),
)
def test_matches_brute_force_definition(
    points: list[tuple[int, int, int]], queries: list[tuple[int, int]]
) -> None:
    """For any data, the chosen run is the latest one strictly before the cutoff."""
    rows = {
        (BASE + timedelta(minutes=m), BASE + timedelta(days=5, hours=h)): float(v)
        for m, h, v in points
    }
    runs = forecasts([(p, s, v) for (p, s), v in rows.items()])
    asked = [(BASE + timedelta(days=5, hours=h), BASE + timedelta(minutes=c)) for h, c in queries]
    result = latest_before(runs, targets(asked))

    for i, (start, cutoff) in enumerate(asked):
        eligible = [(p, v) for (p, s), v in rows.items() if s == start and p < cutoff]
        if not eligible:
            assert pd.isna(result.loc[i, PUBLISH_TIME])
            continue
        publish, value = max(eligible)
        assert result.loc[i, PUBLISH_TIME] == publish
        assert result.loc[i, FORECAST_MW] == value
