"""Day-ahead brief: what the desk knew at the cutoff for one delivery day, and what happened."""

from __future__ import annotations

import csv
import io
from datetime import date, timedelta

import numpy as np
import pandas as pd

from gridbricks.domain.calibration import METHOD
from gridbricks.domain.frames import GENERATION_MW, PUBLISH_TIME, START_TIME
from gridbricks.domain.market import (
    UK_TZ,
    Gate,
    decision_cutoff,
    delivery_date_for,
    delivery_window,
    uk_date,
)
from gridbricks.domain.metrics import band_coverage, energy_gwh, error_stats
from gridbricks.domain.selection import FORECAST_MW
from gridbricks.schemas import (
    BriefHour,
    BriefResponse,
    CalibrationInfo,
    DayMetrics,
    EnergySummary,
    EvolutionResponse,
    EvolutionRun,
    SeriesPoint,
)
from gridbricks.services.common import (
    all_present,
    as_datetime,
    gate_info,
    mode_time,
    opt_float,
    opt_time,
    run_info,
    series_points,
)
from gridbricks.services.dataset import DeskData
from gridbricks.services.decision_table import (
    ACTUAL_MW,
    ERROR_MW,
    HORIZON_H,
    P10_MW,
    P50_MW,
    P90_MW,
    PREVIOUS_FORECAST_MW,
    PREVIOUS_PUBLISH_TIME,
    DecisionTable,
)

#: How far before delivery the evolution chart looks for runs.
EVOLUTION_LOOKBACK = timedelta(days=3)


def _calibration_info(table: DecisionTable, delivery: date) -> CalibrationInfo:
    band = table.bands.get(delivery)
    if band is None:
        return CalibrationInfo(
            method=METHOD,
            sufficient=False,
            samples=0,
            window_start=None,
            window_end=None,
            intercept_mw=None,
            slope=None,
            residual_p10_mw=None,
            residual_p90_mw=None,
        )
    return CalibrationInfo(
        method=METHOD,
        sufficient=True,
        samples=band.samples,
        window_start=band.window_start,
        window_end=band.window_end,
        intercept_mw=band.intercept,
        slope=band.slope,
        residual_p10_mw=band.residual_p10,
        residual_p90_mw=band.residual_p90,
    )


def _energy(rows: pd.DataFrame, actual_gwh: float | None) -> EnergySummary:
    forecast = energy_gwh(rows[FORECAST_MW], 1.0)
    has_band = all_present(rows[P50_MW])
    p50 = energy_gwh(rows[P50_MW], 1.0) if has_band else None
    previous = (
        energy_gwh(rows[PREVIOUS_FORECAST_MW], 1.0)
        if all_present(rows[PREVIOUS_FORECAST_MW])
        else None
    )
    return EnergySummary(
        forecast_gwh=forecast,
        # Summing hourly quantiles assumes errors move together through the day. Wind errors are
        # strongly correlated hour to hour, so this errs slightly on the wide side.
        p10_gwh=energy_gwh(rows[P10_MW], 1.0) if has_band else None,
        p50_gwh=p50,
        p90_gwh=energy_gwh(rows[P90_MW], 1.0) if has_band else None,
        previous_forecast_gwh=previous,
        revision_gwh=forecast - previous if previous is not None else None,
        actual_gwh=actual_gwh,
        error_gwh=forecast - actual_gwh if actual_gwh is not None else None,
        adjusted_error_gwh=p50 - actual_gwh if p50 is not None and actual_gwh is not None else None,
    )


def _day_metrics(rows: pd.DataFrame) -> DayMetrics | None:
    observed = rows.dropna(subset=[FORECAST_MW, ACTUAL_MW])
    if observed.empty:
        return None
    stats = error_stats(observed[FORECAST_MW], observed[ACTUAL_MW])
    banded = observed.dropna(subset=[P50_MW])
    adjusted = error_stats(banded[P50_MW], banded[ACTUAL_MW]) if not banded.empty else None
    coverage = band_coverage(banded[ACTUAL_MW], banded[P10_MW], banded[P90_MW])
    return DayMetrics(
        mae_mw=stats.mae,
        bias_mw=stats.bias,
        max_abs_error_mw=stats.max_abs_error,
        adjusted_mae_mw=adjusted.mae if adjusted else None,
        band_coverage=opt_float(coverage),
    )


def _actual_energy(actuals: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> float | None:
    expected = int((end - start).total_seconds() // 1800)
    if len(actuals) != expected:
        return None
    return energy_gwh(actuals[GENERATION_MW], 0.5)


def _extreme(rows: pd.DataFrame, pick: str) -> SeriesPoint | None:
    """Highest or lowest forecast hour; ties resolve to the earliest hour."""
    ordered = rows.dropna(subset=[FORECAST_MW]).sort_values(
        FORECAST_MW, ascending=pick == "min", kind="stable"
    )
    if ordered.empty:
        return None
    first = ordered.iloc[0]
    return SeriesPoint(
        start_time=as_datetime(first[START_TIME]), generation_mw=float(first[FORECAST_MW])
    )


def build_brief(
    data: DeskData, table: DecisionTable, decision_date: date, gate: Gate
) -> BriefResponse:
    delivery = delivery_date_for(decision_date)
    start, end = delivery_window(delivery)
    cutoff = decision_cutoff(delivery, gate.gate_closure)
    rows = table.rows_for([delivery]).sort_values(START_TIME)
    actuals = data.actuals_between(start, end)

    decision_run = mode_time(rows[PUBLISH_TIME])
    off_schedule = set(data.schedule.off_schedule)
    runs_today = [
        run_info(t, cutoff, off_schedule) for t in data.run_times if uk_date(t) == decision_date
    ]
    next_run = next((t for t in data.run_times if t >= cutoff), None)

    hours = [
        BriefHour(
            start_time=row[START_TIME].to_pydatetime(),
            forecast_mw=opt_float(row[FORECAST_MW]),
            p10_mw=opt_float(row[P10_MW]),
            p50_mw=opt_float(row[P50_MW]),
            p90_mw=opt_float(row[P90_MW]),
            previous_forecast_mw=opt_float(row[PREVIOUS_FORECAST_MW]),
            publish_time=opt_time(row[PUBLISH_TIME]),
            horizon_h=opt_float(row[HORIZON_H]),
            actual_mw=opt_float(row[ACTUAL_MW]),
            error_mw=opt_float(row[ERROR_MW]),
        )
        for _, row in rows.iterrows()
    ]
    return BriefResponse(
        decision_date=decision_date,
        delivery_date=delivery,
        gate=gate_info(gate),
        cutoff=cutoff,
        delivery_start=start,
        delivery_end=end,
        decision_run=decision_run,
        decision_run_age_minutes=(
            (cutoff - decision_run).total_seconds() / 60.0 if decision_run else None
        ),
        previous_run=mode_time(rows[PREVIOUS_PUBLISH_TIME]),
        next_run=run_info(next_run, cutoff, off_schedule) if next_run else None,
        runs_on_decision_day=runs_today,
        hours=hours,
        actuals=series_points(actuals, START_TIME, GENERATION_MW),
        energy=_energy(rows, _actual_energy(actuals, pd.Timestamp(start), pd.Timestamp(end))),
        peak=_extreme(rows, "max"),
        trough=_extreme(rows, "min"),
        calibration=_calibration_info(table, delivery),
        day_metrics=_day_metrics(rows),
    )


def brief_csv(brief: BriefResponse) -> str:
    """The brief's hourly products as CSV, in UK local time for spreadsheet users."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(
        [
            "product_start_uk",
            "product_end_uk",
            "forecast_mw",
            "p10_mw",
            "p50_adjusted_mw",
            "p90_mw",
            "previous_run_mw",
            "run_published_uk",
            "horizon_h",
            "actual_mw",
            "error_mw",
        ]
    )

    def uk(value: object) -> str:
        stamp = opt_time(value)
        return stamp.astimezone(UK_TZ).strftime("%Y-%m-%d %H:%M") if stamp else ""

    def num(value: float | None, digits: int = 1) -> str:
        return "" if value is None else f"{value:.{digits}f}"

    for hour in brief.hours:
        writer.writerow(
            [
                uk(hour.start_time),
                uk(hour.start_time + timedelta(hours=1)),
                num(hour.forecast_mw, 0),
                num(hour.p10_mw),
                num(hour.p50_mw),
                num(hour.p90_mw),
                num(hour.previous_forecast_mw, 0),
                uk(hour.publish_time),
                num(hour.horizon_h),
                num(hour.actual_mw, 0),
                num(hour.error_mw, 0),
            ]
        )
    return buffer.getvalue()


def build_evolution(
    data: DeskData, table: DecisionTable, decision_date: date, gate: Gate
) -> EvolutionResponse:
    delivery = delivery_date_for(decision_date)
    start, end = delivery_window(delivery)
    cutoff = decision_cutoff(delivery, gate.gate_closure)
    decision_run = mode_time(table.rows_for([delivery])[PUBLISH_TIME])
    off_schedule = set(data.schedule.off_schedule)

    f = data.forecasts
    window = f.loc[
        (f[START_TIME] >= start)
        & (f[START_TIME] < end)
        & (f[PUBLISH_TIME] >= start - EVOLUTION_LOOKBACK)
    ]
    runs = []
    for publish_time, group in window.groupby(PUBLISH_TIME, sort=True):
        published = as_datetime(publish_time)
        runs.append(
            EvolutionRun(
                publish_time=published,
                available_at_decision=published < cutoff,
                is_decision_run=published == decision_run,
                off_schedule=published in off_schedule,
                lead_hours=float(np.round((start - published).total_seconds() / 3600.0, 2)),
                points=series_points(group, START_TIME, GENERATION_MW),
            )
        )
    return EvolutionResponse(
        decision_date=decision_date,
        delivery_date=delivery,
        gate=gate_info(gate),
        cutoff=cutoff,
        delivery_start=start,
        delivery_end=end,
        runs=runs,
        actuals=series_points(data.actuals_between(start, end), START_TIME, GENERATION_MW),
    )
