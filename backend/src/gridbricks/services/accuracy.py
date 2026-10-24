"""Backtest accuracy of the decision-time forecast over the scope, and accuracy by lead time."""

from __future__ import annotations

import itertools
import math
from collections.abc import Sequence
from datetime import date, timedelta

import numpy as np
import pandas as pd

from gridbricks.domain.frames import PUBLISH_TIME, START_TIME
from gridbricks.domain.market import UK_TZ, Gate, delivery_window
from gridbricks.domain.metrics import band_coverage, energy_gwh, error_stats, pinball_loss
from gridbricks.domain.selection import FORECAST_MW
from gridbricks.schemas import (
    AccuracyResponse,
    DailyAccuracy,
    GateComparison,
    HistogramBin,
    HorizonBucket,
    HorizonResponse,
    LevelBucket,
    SeriesRow,
)
from gridbricks.services.common import gate_info, metric_set, opt_float
from gridbricks.services.dataset import DELIVERY_DATE, DeskData, daily_actual_energy
from gridbricks.services.decision_table import (
    ACTUAL_MW,
    ERROR_MW,
    HORIZON_H,
    P10_MW,
    P50_MW,
    P90_MW,
    DecisionTable,
)

BAND_TARGET = 0.8
LEVEL_EDGES_MW = (0.0, 4000.0, 8000.0, 12000.0, 16000.0, math.inf)
HISTOGRAM_BIN_MW = 500.0
WORST_DAYS = 5
HORIZON_BUCKET_HOURS = 3
HORIZON_MAX_HOURS = 72


def delivery_days(decision_from: date, decision_to: date) -> list[date]:
    count = (decision_to - decision_from).days + 1
    return [decision_from + timedelta(days=1 + i) for i in range(count)]


def _observed(rows: pd.DataFrame) -> pd.DataFrame:
    return rows.dropna(subset=[FORECAST_MW, ACTUAL_MW])


def _daily(rows: pd.DataFrame, actual_energy: dict[date, float | None]) -> list[DailyAccuracy]:
    result = []
    for day, group in rows.groupby(DELIVERY_DATE, sort=True):
        delivery: date = day  # type: ignore[assignment]
        actual = actual_energy.get(delivery)
        forecast = energy_gwh(group[FORECAST_MW], 1.0)
        adjusted = energy_gwh(group[P50_MW], 1.0) if group[P50_MW].notna().all() else None
        observed = _observed(group)
        result.append(
            DailyAccuracy(
                decision_date=delivery - timedelta(days=1),
                delivery_date=delivery,
                forecast_gwh=forecast,
                adjusted_gwh=adjusted,
                actual_gwh=actual,
                energy_error_gwh=forecast - actual if actual is not None else None,
                adjusted_energy_error_gwh=(
                    adjusted - actual if adjusted is not None and actual is not None else None
                ),
                mae_mw=float(observed[ERROR_MW].abs().mean()) if not observed.empty else None,
                bias_mw=float(observed[ERROR_MW].mean()) if not observed.empty else None,
                band_coverage=opt_float(
                    band_coverage(group[ACTUAL_MW], group[P10_MW], group[P90_MW])
                ),
            )
        )
    return result


def _by_level(observed: pd.DataFrame) -> list[LevelBucket]:
    buckets = []
    for lower, upper in itertools.pairwise(LEVEL_EDGES_MW):
        part = observed.loc[(observed[FORECAST_MW] >= lower) & (observed[FORECAST_MW] < upper)]
        adjusted = part.dropna(subset=[P50_MW])
        adjusted_error = adjusted[P50_MW] - adjusted[ACTUAL_MW]
        label = (
            f"{lower / 1000:g}–{upper / 1000:g} GW"
            if math.isfinite(upper)
            else f"≥ {lower / 1000:g} GW"
        )
        buckets.append(
            LevelBucket(
                label=label,
                lower_mw=lower,
                upper_mw=upper if math.isfinite(upper) else None,
                n=len(part),
                bias_mw=opt_float(part[ERROR_MW].mean()) if len(part) else None,
                mae_mw=opt_float(part[ERROR_MW].abs().mean()) if len(part) else None,
                adjusted_bias_mw=opt_float(adjusted_error.mean()) if len(adjusted) else None,
                adjusted_mae_mw=opt_float(adjusted_error.abs().mean()) if len(adjusted) else None,
            )
        )
    return buckets


def _histogram(errors: pd.Series) -> list[HistogramBin]:
    if errors.empty:
        return []
    low = math.floor(errors.min() / HISTOGRAM_BIN_MW) * HISTOGRAM_BIN_MW
    high = math.ceil(errors.max() / HISTOGRAM_BIN_MW) * HISTOGRAM_BIN_MW
    if high == low:
        high = low + HISTOGRAM_BIN_MW
    edges = np.arange(low, high + HISTOGRAM_BIN_MW, HISTOGRAM_BIN_MW)
    counts, _ = np.histogram(errors.to_numpy(dtype=np.float64), bins=edges)
    return [
        HistogramBin(lower_mw=float(lo), upper_mw=float(hi), count=int(n))
        for lo, hi, n in zip(edges[:-1], edges[1:], counts, strict=True)
    ]


def _typical_run_uk(rows: pd.DataFrame) -> str | None:
    published = rows[PUBLISH_TIME].dropna()
    if published.empty:
        return None
    labels = published.dt.tz_convert(UK_TZ).dt.strftime("%H:%M")
    return str(labels.mode().iloc[0])


def _comparison(gate: Gate, table: DecisionTable, days: Sequence[date]) -> GateComparison:
    rows = table.rows_for(days)
    observed = _observed(rows)
    stats = error_stats(observed[FORECAST_MW], observed[ACTUAL_MW])
    banded = observed.dropna(subset=[P50_MW])
    return GateComparison(
        gate=gate_info(gate),
        typical_run_uk=_typical_run_uk(rows),
        horizon_min_h=opt_float(rows[HORIZON_H].min()),
        horizon_max_h=opt_float(rows[HORIZON_H].max()),
        mae_mw=stats.mae,
        rmse_mw=stats.rmse,
        bias_mw=stats.bias,
        adjusted_mae_mw=(
            error_stats(banded[P50_MW], banded[ACTUAL_MW]).mae if not banded.empty else None
        ),
        band_coverage=opt_float(band_coverage(banded[ACTUAL_MW], banded[P10_MW], banded[P90_MW])),
    )


def _series(rows: pd.DataFrame) -> list[SeriesRow]:
    return [
        SeriesRow(
            start_time=row[START_TIME].to_pydatetime(),
            forecast_mw=opt_float(row[FORECAST_MW]),
            p10_mw=opt_float(row[P10_MW]),
            p50_mw=opt_float(row[P50_MW]),
            p90_mw=opt_float(row[P90_MW]),
            actual_mw=opt_float(row[ACTUAL_MW]),
        )
        for _, row in rows.sort_values(START_TIME).iterrows()
    ]


def build_accuracy(
    data: DeskData,
    gate: Gate,
    table: DecisionTable,
    comparisons: Sequence[tuple[Gate, DecisionTable]],
    decision_from: date,
    decision_to: date,
) -> AccuracyResponse:
    days = delivery_days(decision_from, decision_to)
    rows = table.rows_for(days)
    observed = _observed(rows)
    banded = observed.dropna(subset=[P10_MW, P50_MW, P90_MW])

    daily = _daily(rows, daily_actual_energy(data, days))
    with_error = [d for d in daily if d.energy_error_gwh is not None]
    worst = sorted(with_error, key=lambda d: abs(d.energy_error_gwh or 0.0), reverse=True)

    pinball = (
        float(
            np.mean(
                [
                    pinball_loss(banded[ACTUAL_MW], banded[column], q)
                    for column, q in ((P10_MW, 0.1), (P50_MW, 0.5), (P90_MW, 0.9))
                ]
            )
        )
        if not banded.empty
        else None
    )
    return AccuracyResponse(
        gate=gate_info(gate),
        decision_from=decision_from,
        decision_to=decision_to,
        delivery_from=days[0],
        delivery_to=days[-1],
        published=metric_set(error_stats(observed[FORECAST_MW], observed[ACTUAL_MW])),
        adjusted=(
            metric_set(error_stats(banded[P50_MW], banded[ACTUAL_MW])) if not banded.empty else None
        ),
        band_coverage=opt_float(band_coverage(banded[ACTUAL_MW], banded[P10_MW], banded[P90_MW])),
        band_target=BAND_TARGET,
        mean_band_width_mw=opt_float((banded[P90_MW] - banded[P10_MW]).mean()),
        pinball_loss_mw=pinball,
        daily=daily,
        by_level=_by_level(observed),
        histogram=_histogram(observed[ERROR_MW]),
        worst_days=worst[:WORST_DAYS],
        gate_comparison=[_comparison(g, t, days) for g, t in comparisons],
        series=_series(rows),
    )


def build_horizon(
    data: DeskData, gate: Gate, table: DecisionTable, delivery_from: date, delivery_to: date
) -> HorizonResponse:
    """Accuracy of every run by lead time, over the in-scope delivery windows."""
    start, _ = delivery_window(delivery_from)
    _, end = delivery_window(delivery_to)
    f = data.forecasts
    points = f.loc[(f[START_TIME] >= start) & (f[START_TIME] < end)].copy()
    points["actual"] = points[START_TIME].map(data.actual_by_start).astype("float64")
    points = points.dropna(subset=["actual"])
    points["error"] = points["generation_mw"] - points["actual"]
    points["horizon"] = (points[START_TIME] - points[PUBLISH_TIME]).dt.total_seconds() / 3600.0
    points = points.loc[(points["horizon"] >= 0) & (points["horizon"] < HORIZON_MAX_HOURS)]
    points["bucket"] = (points["horizon"] // HORIZON_BUCKET_HOURS) * HORIZON_BUCKET_HOURS

    buckets = []
    for lower, group in points.groupby("bucket", sort=True):
        errors = group["error"].to_numpy(dtype=np.float64)
        p10, p90 = np.quantile(errors, [0.1, 0.9])
        buckets.append(
            HorizonBucket(
                lower_h=float(lower),  # type: ignore[arg-type]
                upper_h=float(lower) + HORIZON_BUCKET_HOURS,  # type: ignore[arg-type]
                n=len(errors),
                mae_mw=float(np.abs(errors).mean()),
                bias_mw=float(errors.mean()),
                error_p10_mw=float(p10),
                error_p90_mw=float(p90),
            )
        )
    rows = table.rows_for(
        [delivery_from + timedelta(days=i) for i in range((delivery_to - delivery_from).days + 1)]
    )
    return HorizonResponse(
        gate=gate_info(gate),
        delivery_from=delivery_from,
        delivery_to=delivery_to,
        bucket_hours=HORIZON_BUCKET_HOURS,
        buckets=buckets,
        decision_horizon_min_h=opt_float(rows[HORIZON_H].min()),
        decision_horizon_max_h=opt_float(rows[HORIZON_H].max()),
    )
