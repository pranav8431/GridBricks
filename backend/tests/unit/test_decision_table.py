"""The decision table is where look-ahead bias could creep in, so it is tested hardest."""

from __future__ import annotations

from datetime import date, time

import numpy as np
import pandas as pd
import pytest

from conftest import LATE_RUN
from factories import utc
from gridbricks.domain.calibration import CalibrationConfig
from gridbricks.domain.frames import GENERATION_MW, PUBLISH_TIME
from gridbricks.domain.market import decision_cutoff
from gridbricks.domain.selection import FORECAST_MW
from gridbricks.repository import InMemoryRepository
from gridbricks.services.dataset import DELIVERY_DATE, load_desk_data
from gridbricks.services.decision_table import (
    ACTUAL_MW,
    HORIZON_H,
    P10_MW,
    P50_MW,
    P90_MW,
    PREVIOUS_FORECAST_MW,
    PREVIOUS_PUBLISH_TIME,
    build_decision_table,
)

DAYS = [date(2026, 1, d) for d in range(17, 24)]
CONFIG = CalibrationConfig(window_days=3, min_samples=24)
DECISION_COLUMNS = [
    PUBLISH_TIME,
    FORECAST_MW,
    PREVIOUS_PUBLISH_TIME,
    PREVIOUS_FORECAST_MW,
    HORIZON_H,
    P10_MW,
    P50_MW,
    P90_MW,
]


def test_every_delivery_hour_has_the_0730_run_at_0920(synthetic_repo: InMemoryRepository) -> None:
    table = build_decision_table(load_desk_data(synthetic_repo), DAYS, time(9, 20), CONFIG)
    rows = table.rows_for([date(2026, 1, 22)])
    assert len(rows) == 24
    assert set(rows[PUBLISH_TIME]) == {utc(2026, 1, 21, 7, 30)}
    assert set(rows[PREVIOUS_PUBLISH_TIME]) == {utc(2026, 1, 21, 4, 30)}
    assert rows[HORIZON_H].min() == pytest.approx(15.5)
    assert rows[HORIZON_H].max() == pytest.approx(38.5)


def test_late_run_is_used_when_it_is_the_latest_before_cutoff(
    synthetic_repo: InMemoryRepository,
) -> None:
    table = build_decision_table(load_desk_data(synthetic_repo), DAYS, time(15, 30), CONFIG)
    assert set(table.rows_for([date(2026, 1, 22)])[PUBLISH_TIME]) == {LATE_RUN}


def test_bands_exist_once_history_is_available(synthetic_repo: InMemoryRepository) -> None:
    table = build_decision_table(load_desk_data(synthetic_repo), DAYS, time(9, 20), CONFIG)
    assert table.bands[date(2026, 1, 17)] is None  # no settled history yet
    rows = table.rows_for([date(2026, 1, 22)])
    assert (rows[P10_MW] <= rows[P50_MW]).all()
    assert (rows[P50_MW] <= rows[P90_MW]).all()


@pytest.mark.parametrize("gate", [time(9, 20), time(15, 30), time(22, 0)])
@pytest.mark.parametrize("delivery", [date(2026, 1, 21), date(2026, 1, 23)])
def test_no_information_after_the_cutoff_leaks_into_the_decision(
    synthetic_repo: InMemoryRepository, gate: time, delivery: date
) -> None:
    """Scrambling everything published after D's cutoff must not change D's forecast or band."""
    cutoff = decision_cutoff(delivery, gate)
    forecasts = synthetic_repo.load_forecasts()
    actuals = synthetic_repo.load_actuals()
    rng = np.random.default_rng(7)

    future_f = forecasts[PUBLISH_TIME] >= cutoff
    forecasts.loc[future_f, GENERATION_MW] *= rng.uniform(0.1, 3.0, int(future_f.sum()))
    future_a = actuals[PUBLISH_TIME] > cutoff
    actuals.loc[future_a, GENERATION_MW] *= rng.uniform(0.1, 3.0, int(future_a.sum()))
    scrambled = InMemoryRepository(forecasts, actuals, synthetic_repo.manifest())

    original = build_decision_table(load_desk_data(synthetic_repo), DAYS, gate, CONFIG)
    perturbed = build_decision_table(load_desk_data(scrambled), DAYS, gate, CONFIG)

    before = original.rows_for([delivery])[DECISION_COLUMNS].reset_index(drop=True)
    after = perturbed.rows_for([delivery])[DECISION_COLUMNS].reset_index(drop=True)
    pd.testing.assert_frame_equal(before, after)
    # Sanity check: the scramble did change the outcome, so the test has teeth.
    assert not original.rows_for([delivery])[ACTUAL_MW].equals(
        perturbed.rows_for([delivery])[ACTUAL_MW]
    )


def test_actuals_join_on_start_time(synthetic_repo: InMemoryRepository) -> None:
    data = load_desk_data(synthetic_repo)
    table = build_decision_table(data, DAYS, time(9, 20), CONFIG)
    row = table.frame.iloc[30]
    assert row[ACTUAL_MW] == pytest.approx(data.actual_by_start[row["start_time"]])
    assert row[DELIVERY_DATE] in DAYS
