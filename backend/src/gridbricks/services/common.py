"""Small conversions shared by the view builders."""

from __future__ import annotations

import math
from collections.abc import Iterable
from datetime import datetime
from typing import Any

import pandas as pd

from gridbricks.domain.market import PRESETS, Gate
from gridbricks.domain.metrics import ErrorStats
from gridbricks.schemas import GateInfo, MetricSet, RunInfo, SeriesPoint

# pandas scalars are loosely typed; these helpers are the typed boundary into the API models.


def opt_float(value: Any) -> float | None:
    """``None`` for missing values, otherwise a plain float."""
    if value is None:
        return None
    number = float(value)
    return None if math.isnan(number) else number


def opt_time(value: Any) -> datetime | None:
    if value is None or pd.isna(value):
        return None
    return as_datetime(value)


def as_datetime(value: Any) -> datetime:
    stamp: datetime = pd.Timestamp(value).to_pydatetime()
    return stamp


def mode_time(values: pd.Series) -> datetime | None:
    """Most common timestamp (the run used for most hours of a delivery day)."""
    present = values.dropna()
    if present.empty:
        return None
    return opt_time(present.mode().iloc[0])


def gate_info(gate: Gate) -> GateInfo:
    preset = PRESETS.get(gate.id)
    return GateInfo(
        id=gate.id,
        label=gate.label,
        venue=gate.venue,
        gate_closure_uk=gate.hhmm,
        is_custom=gate.is_custom,
        description=preset.description if preset else "Custom decision time on D-1 (UK)",
    )


def run_info(publish_time: datetime, cutoff: datetime, off_schedule: set[datetime]) -> RunInfo:
    return RunInfo(
        publish_time=publish_time,
        available_at_decision=publish_time < cutoff,
        minutes_from_cutoff=(publish_time - cutoff).total_seconds() / 60.0,
        off_schedule=publish_time in off_schedule,
    )


def series_points(frame: pd.DataFrame, time_column: str, value_column: str) -> list[SeriesPoint]:
    return [
        SeriesPoint(start_time=ts.to_pydatetime(), generation_mw=float(mw))
        for ts, mw in zip(frame[time_column], frame[value_column], strict=True)
        if not pd.isna(mw)
    ]


def metric_set(stats: ErrorStats) -> MetricSet:
    return MetricSet(
        n=stats.n,
        mae_mw=stats.mae,
        rmse_mw=stats.rmse,
        bias_mw=stats.bias,
        error_p10_mw=stats.error_p10,
        error_p50_mw=stats.error_p50,
        error_p90_mw=stats.error_p90,
        abs_error_p90_mw=stats.abs_error_p90,
        max_abs_error_mw=stats.max_abs_error,
        nmae_pct=stats.nmae * 100.0,
        wape_pct=stats.wape * 100.0,
    )


def all_present(values: Iterable[object]) -> bool:
    return all(opt_float(v) is not None for v in values)
