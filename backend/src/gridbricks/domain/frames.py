"""Column contracts for the DataFrames that flow between layers.

Keeping the names in one place stops typos from silently creating new columns.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from typing import Final

import pandas as pd

# Timestamps are always tz-aware UTC at one resolution, so joins never fail on dtype mismatches.
TIME_UNIT: Final = "us"
TIME_DTYPE = f"datetime64[{TIME_UNIT}, UTC]"

# Forecast frame (one row per run and target hour), from WINDFOR.
PUBLISH_TIME = "publish_time"
START_TIME = "start_time"
GENERATION_MW = "generation_mw"
FORECAST_COLUMNS = [PUBLISH_TIME, START_TIME, GENERATION_MW]

# Actual frame (one row per settlement period), from FUELHH with fuelType=WIND.
SETTLEMENT_DATE = "settlement_date"
SETTLEMENT_PERIOD = "settlement_period"
ACTUAL_COLUMNS = [START_TIME, PUBLISH_TIME, SETTLEMENT_DATE, SETTLEMENT_PERIOD, GENERATION_MW]


def to_utc(values: pd.Series | Iterable[datetime] | Iterable[str]) -> pd.Series:
    """Coerce timestamps to tz-aware UTC at the shared resolution."""
    series = values if isinstance(values, pd.Series) else pd.Series(list(values))
    return pd.to_datetime(series, utc=True).dt.as_unit(TIME_UNIT)


def empty_forecasts() -> pd.DataFrame:
    return pd.DataFrame(
        {
            PUBLISH_TIME: pd.Series(dtype=TIME_DTYPE),
            START_TIME: pd.Series(dtype=TIME_DTYPE),
            GENERATION_MW: pd.Series(dtype="float64"),
        }
    )
