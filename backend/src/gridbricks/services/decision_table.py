"""The decision table: one row per delivery hour, as the desk would have seen it at the cutoff.

Every analysis view is a projection of this table, so the "what was known when" logic lives in
exactly one place.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, time

import numpy as np
import pandas as pd

from gridbricks.domain.calibration import CalibrationConfig, LinearBand, walk_forward_bands
from gridbricks.domain.frames import PUBLISH_TIME, START_TIME, to_utc
from gridbricks.domain.market import decision_cutoff, delivery_hours
from gridbricks.domain.selection import CUTOFF, FORECAST_MW, latest_before
from gridbricks.services.dataset import DELIVERY_DATE, DeskData

PREVIOUS_PUBLISH_TIME = "previous_publish_time"
PREVIOUS_FORECAST_MW = "previous_forecast_mw"
HORIZON_H = "horizon_h"
ACTUAL_MW = "actual_mw"
ACTUAL_PUBLISHED = "actual_published"
ERROR_MW = "error_mw"
P10_MW, P50_MW, P90_MW = "p10_mw", "p50_mw", "p90_mw"


@dataclass(frozen=True, slots=True)
class DecisionTable:
    gate_closure: time
    frame: pd.DataFrame
    bands: dict[date, LinearBand | None]

    def rows_for(self, delivery_dates: Sequence[date]) -> pd.DataFrame:
        wanted = set(delivery_dates)
        return self.frame.loc[self.frame[DELIVERY_DATE].isin(wanted)]


def build_decision_table(
    data: DeskData,
    delivery_dates: Sequence[date],
    gate_closure: time,
    calibration: CalibrationConfig,
) -> DecisionTable:
    targets = pd.DataFrame(
        [
            (day, hour, decision_cutoff(day, gate_closure))
            for day in delivery_dates
            for hour in delivery_hours(day)
        ],
        columns=[DELIVERY_DATE, START_TIME, CUTOFF],
    )
    targets[START_TIME] = to_utc(targets[START_TIME])
    targets[CUTOFF] = to_utc(targets[CUTOFF])

    table = latest_before(data.forecasts, targets)
    previous = latest_before(
        data.forecasts,
        table[[START_TIME, PUBLISH_TIME]],
        cutoff_column=PUBLISH_TIME,
        publish_column=PREVIOUS_PUBLISH_TIME,
        value_column=PREVIOUS_FORECAST_MW,
    )
    table[PREVIOUS_PUBLISH_TIME] = previous[PREVIOUS_PUBLISH_TIME].to_numpy()
    table[PREVIOUS_FORECAST_MW] = previous[PREVIOUS_FORECAST_MW].to_numpy()
    table[HORIZON_H] = (table[START_TIME] - table[PUBLISH_TIME]).dt.total_seconds() / 3600.0
    table[ACTUAL_MW] = table[START_TIME].map(data.actual_by_start).astype("float64")
    published = data.actuals.set_index(START_TIME)[PUBLISH_TIME]
    table[ACTUAL_PUBLISHED] = table[START_TIME].map(published)
    table[ERROR_MW] = table[FORECAST_MW] - table[ACTUAL_MW]

    cutoffs = {day: decision_cutoff(day, gate_closure) for day in delivery_dates}
    bands = walk_forward_bands(table, cutoffs, calibration)
    for column in (P10_MW, P50_MW, P90_MW):
        table[column] = np.nan
    forecast = table[FORECAST_MW].to_numpy(dtype=np.float64)
    for day, band in bands.items():
        if band is None:
            continue
        rows = (table[DELIVERY_DATE] == day).to_numpy()
        p10, p50, p90 = band.apply(forecast[rows])
        table.loc[rows, P10_MW] = p10
        table.loc[rows, P50_MW] = p50
        table.loc[rows, P90_MW] = p90
    return DecisionTable(gate_closure=gate_closure, frame=table, bands=bands)
