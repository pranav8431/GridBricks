"""Response contracts shared by the services and the HTTP layer.

These Pydantic models are the single source of truth for the API: FastAPI publishes them as
OpenAPI, and the frontend's TypeScript types are generated from that document.
All timestamps are UTC (ISO 8601); power is in MW, energy in GWh.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    model_config = ConfigDict(frozen=True)


# --- Shared ------------------------------------------------------------------


class GateInfo(APIModel):
    id: str = Field(description="Preset id, or 'custom' when a custom cutoff is in use.")
    label: str
    venue: str
    gate_closure_uk: str = Field(description="Gate closure on D-1, UK local time (HH:MM).")
    is_custom: bool
    description: str | None = None


class SeriesPoint(APIModel):
    start_time: datetime
    generation_mw: float


class RunInfo(APIModel):
    publish_time: datetime
    available_at_decision: bool = Field(description="Published strictly before the cutoff.")
    minutes_from_cutoff: float = Field(description="Negative when published before the cutoff.")
    off_schedule: bool


# --- Brief -------------------------------------------------------------------


class BriefHour(APIModel):
    start_time: datetime = Field(description="Start of the hourly product (UTC).")
    forecast_mw: float | None
    p10_mw: float | None
    p50_mw: float | None = Field(description="Error-adjusted central estimate.")
    p90_mw: float | None
    previous_forecast_mw: float | None = Field(description="Value in the run before the one used.")
    publish_time: datetime | None = Field(description="Publish time of the run used.")
    horizon_h: float | None
    actual_mw: float | None = Field(description="Outturn for the half-hour starting at start_time.")
    error_mw: float | None = Field(description="forecast - actual; positive = over-forecast.")


class EnergySummary(APIModel):
    forecast_gwh: float
    p10_gwh: float | None
    p50_gwh: float | None
    p90_gwh: float | None
    previous_forecast_gwh: float | None
    revision_gwh: float | None = Field(description="Decision run minus the run before it.")
    actual_gwh: float | None
    error_gwh: float | None = Field(description="forecast - actual energy over the delivery day.")
    adjusted_error_gwh: float | None


class CalibrationInfo(APIModel):
    method: str
    sufficient: bool
    samples: int
    window_start: date | None
    window_end: date | None
    ratio_p10: float | None
    ratio_p50: float | None
    ratio_p90: float | None


class DayMetrics(APIModel):
    mae_mw: float
    bias_mw: float
    max_abs_error_mw: float
    adjusted_mae_mw: float | None
    band_coverage: float | None


class BriefResponse(APIModel):
    decision_date: date
    delivery_date: date
    gate: GateInfo
    cutoff: datetime
    delivery_start: datetime
    delivery_end: datetime
    decision_run: datetime | None
    decision_run_age_minutes: float | None
    previous_run: datetime | None
    next_run: RunInfo | None = Field(description="First run published at or after the cutoff.")
    runs_on_decision_day: list[RunInfo]
    hours: list[BriefHour]
    actuals: list[SeriesPoint] = Field(description="Half-hourly outturn over the delivery window.")
    energy: EnergySummary
    peak: SeriesPoint | None
    trough: SeriesPoint | None
    calibration: CalibrationInfo
    day_metrics: DayMetrics | None


# --- Evolution ---------------------------------------------------------------


class EvolutionRun(APIModel):
    publish_time: datetime
    available_at_decision: bool
    is_decision_run: bool
    off_schedule: bool
    lead_hours: float = Field(description="Hours from publish time to the start of delivery.")
    points: list[SeriesPoint]


class EvolutionResponse(APIModel):
    decision_date: date
    delivery_date: date
    gate: GateInfo
    cutoff: datetime
    delivery_start: datetime
    delivery_end: datetime
    runs: list[EvolutionRun]
    actuals: list[SeriesPoint]


# --- Accuracy ----------------------------------------------------------------


class MetricSet(APIModel):
    n: int
    mae_mw: float
    rmse_mw: float
    bias_mw: float
    error_p10_mw: float
    error_p50_mw: float
    error_p90_mw: float
    abs_error_p90_mw: float
    max_abs_error_mw: float
    nmae_pct: float
    wape_pct: float


class DailyAccuracy(APIModel):
    decision_date: date
    delivery_date: date
    forecast_gwh: float
    adjusted_gwh: float | None
    actual_gwh: float | None
    energy_error_gwh: float | None
    adjusted_energy_error_gwh: float | None
    mae_mw: float | None
    bias_mw: float | None
    band_coverage: float | None


class LevelBucket(APIModel):
    label: str
    lower_mw: float
    upper_mw: float | None
    n: int
    bias_mw: float | None
    mae_mw: float | None
    adjusted_bias_mw: float | None
    adjusted_mae_mw: float | None


class HistogramBin(APIModel):
    lower_mw: float
    upper_mw: float
    count: int


class GateComparison(APIModel):
    gate: GateInfo
    typical_run_uk: str | None = Field(description="Most common run used, UK time (HH:MM).")
    horizon_min_h: float | None
    horizon_max_h: float | None
    mae_mw: float
    rmse_mw: float
    bias_mw: float
    adjusted_mae_mw: float | None
    band_coverage: float | None


class SeriesRow(APIModel):
    start_time: datetime
    forecast_mw: float | None
    p10_mw: float | None
    p50_mw: float | None
    p90_mw: float | None
    actual_mw: float | None


class AccuracyResponse(APIModel):
    gate: GateInfo
    decision_from: date
    decision_to: date
    delivery_from: date
    delivery_to: date
    published: MetricSet
    adjusted: MetricSet | None
    band_coverage: float | None
    band_target: float
    mean_band_width_mw: float | None
    pinball_loss_mw: float | None = Field(description="Mean pinball loss of the P10/P50/P90 band.")
    daily: list[DailyAccuracy]
    by_level: list[LevelBucket]
    histogram: list[HistogramBin]
    worst_days: list[DailyAccuracy]
    gate_comparison: list[GateComparison]
    series: list[SeriesRow]


class HorizonBucket(APIModel):
    lower_h: float
    upper_h: float
    n: int
    mae_mw: float
    bias_mw: float
    error_p10_mw: float
    error_p90_mw: float


class HorizonResponse(APIModel):
    gate: GateInfo
    delivery_from: date
    delivery_to: date
    bucket_hours: int
    buckets: list[HorizonBucket]
    decision_horizon_min_h: float | None
    decision_horizon_max_h: float | None


# --- Quality, meta, health ---------------------------------------------------


class QualityIssue(APIModel):
    severity: Literal["info", "warning", "error"]
    message: str


class QualityResponse(APIModel):
    checked_from: datetime
    checked_to: datetime
    actual_periods_expected: int
    actual_periods_present: int
    missing_actual_periods: list[datetime]
    forecast_runs: int
    forecast_points: int
    stale_points_removed: int
    run_schedule_utc: list[str]
    off_schedule_runs: list[datetime]
    missing_scheduled_runs: list[datetime]
    issues: list[QualityIssue]


class DatasetInfo(APIModel):
    dataset: str
    endpoint: str
    params: dict[str, str]
    rows: int
    sha256: str


class SnapshotInfo(APIModel):
    version: str
    generated_at: datetime
    source: str
    datasets: list[DatasetInfo]


class CalibrationSettings(APIModel):
    method: str
    window_days: int
    gap_days: int
    min_samples: int
    quantiles: list[float]


class MetaResponse(APIModel):
    app_version: str
    snapshot: SnapshotInfo
    first_decision_date: date
    last_decision_date: date
    first_delivery_date: date
    last_delivery_date: date
    calibration_from: date = Field(description="First (warm-up) delivery day used for calibration.")
    gates: list[GateInfo]
    default_gate: str
    run_schedule_utc: list[str]
    calibration: CalibrationSettings
    delivery_window_rule: str
    timezone: str


class HealthResponse(APIModel):
    status: Literal["ok", "degraded"]
    version: str
    snapshot_version: str | None
    detail: str | None = None
