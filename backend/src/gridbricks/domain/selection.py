"""Choosing the forecast that was actually available at a decision cutoff."""

from __future__ import annotations

import numpy as np
import pandas as pd

from gridbricks.domain.frames import GENERATION_MW, PUBLISH_TIME, START_TIME, TIME_DTYPE

CUTOFF = "cutoff"
FORECAST_MW = "forecast_mw"
_ROW = "_row"


def drop_stale_points(forecasts: pd.DataFrame) -> pd.DataFrame:
    """Remove points whose target hour started before the run was published.

    Each WINDFOR run repeats values for hours that have already passed. Those values are copies
    of earlier runs, not forecasts, so they never count at any horizon.
    """
    fresh = forecasts[START_TIME] >= forecasts[PUBLISH_TIME]
    return forecasts.loc[fresh].reset_index(drop=True)


def latest_before(
    forecasts: pd.DataFrame,
    targets: pd.DataFrame,
    *,
    cutoff_column: str = CUTOFF,
    publish_column: str = PUBLISH_TIME,
    value_column: str = FORECAST_MW,
) -> pd.DataFrame:
    """Attach to each target the latest forecast published strictly before its cutoff.

    ``targets`` needs a ``start_time`` column and a cutoff column. A run published exactly at
    the cutoff is excluded, because a forecast that lands at gate closure cannot be acted on.
    Targets without a qualifying run get ``NaT``/``NaN``. Row order is preserved.
    """
    left = targets.assign(**{_ROW: np.arange(len(targets))})
    right = (
        forecasts[[START_TIME, PUBLISH_TIME, GENERATION_MW]]
        .rename(columns={PUBLISH_TIME: publish_column, GENERATION_MW: value_column})
        .sort_values(publish_column, kind="stable")
    )
    has_cutoff = left[cutoff_column].notna()
    matched = pd.merge_asof(
        left.loc[has_cutoff].sort_values(cutoff_column, kind="stable"),
        right,
        left_on=cutoff_column,
        right_on=publish_column,
        by=START_TIME,
        direction="backward",
        allow_exact_matches=False,
    )
    parts = [matched]
    if not has_cutoff.all():
        unmatched = left.loc[~has_cutoff].copy()
        unmatched[publish_column] = pd.Series(pd.NaT, index=unmatched.index, dtype=TIME_DTYPE)
        unmatched[value_column] = np.nan
        parts.append(unmatched)
    combined = pd.concat(parts) if len(parts) > 1 else matched
    return combined.sort_values(_ROW).drop(columns=_ROW).reset_index(drop=True)
