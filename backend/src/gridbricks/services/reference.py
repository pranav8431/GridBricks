"""Reference views: data quality and app metadata."""

from __future__ import annotations

from gridbricks import __version__
from gridbricks.config import Settings
from gridbricks.domain.calibration import METHOD, QUANTILES
from gridbricks.domain.frames import START_TIME
from gridbricks.domain.market import (
    DEFAULT_PRESET_ID,
    PRESETS,
    UK_TZ,
    delivery_window,
    resolve_gate,
)
from gridbricks.domain.quality import half_hourly_coverage
from gridbricks.schemas import (
    CalibrationSettings,
    DatasetInfo,
    MetaResponse,
    QualityIssue,
    QualityResponse,
    SnapshotInfo,
)
from gridbricks.services.common import gate_info
from gridbricks.services.dataset import DeskData


def build_quality(data: DeskData, settings: Settings) -> QualityResponse:
    checked_from, _ = delivery_window(settings.warmup_start_date)
    _, checked_to = delivery_window(settings.last_delivery_date)
    coverage = half_hourly_coverage(data.actuals[START_TIME], checked_from, checked_to)
    schedule = data.schedule

    issues: list[QualityIssue] = []
    if coverage.missing:
        issues.append(
            QualityIssue(
                severity="warning",
                message=f"{len(coverage.missing)} half-hourly actuals are missing; "
                "days with gaps are excluded from energy totals.",
            )
        )
    else:
        issues.append(
            QualityIssue(
                severity="info",
                message=f"All {coverage.expected:,} half-hourly actuals are present.",
            )
        )
    for run in schedule.off_schedule:
        local = run.astimezone(UK_TZ)
        issues.append(
            QualityIssue(
                severity="warning",
                message=f"Off-schedule forecast run published {local:%H:%M} on {local:%d %b %Y} "
                "(UK). Selection uses actual publish times, so it is handled correctly.",
            )
        )
    for slot in schedule.missing:
        local = slot.astimezone(UK_TZ)
        issues.append(
            QualityIssue(
                severity="warning",
                message=f"No forecast run at the usual {local:%H:%M} slot on "
                f"{local:%d %b %Y} (UK); decisions fall back to the latest earlier run.",
            )
        )
    issues.append(
        QualityIssue(
            severity="info",
            message=f"{data.stale_points_removed:,} stale forecast points removed: values for "
            "hours that had already started when the run was published.",
        )
    )
    if data.duplicate_actuals_removed:
        issues.append(
            QualityIssue(
                severity="info",
                message=f"{data.duplicate_actuals_removed} revised actuals superseded by later "
                "publications.",
            )
        )
    return QualityResponse(
        checked_from=checked_from,
        checked_to=checked_to,
        actual_periods_expected=coverage.expected,
        actual_periods_present=coverage.present,
        missing_actual_periods=coverage.missing,
        forecast_runs=schedule.runs,
        forecast_points=len(data.forecasts),
        stale_points_removed=data.stale_points_removed,
        run_schedule_utc=schedule.schedule_utc,
        off_schedule_runs=schedule.off_schedule,
        missing_scheduled_runs=schedule.missing,
        issues=issues,
    )


def build_meta(data: DeskData, settings: Settings) -> MetaResponse:
    manifest = data.manifest
    calibration = settings.calibration
    return MetaResponse(
        app_version=__version__,
        snapshot=SnapshotInfo(
            version=manifest.version,
            generated_at=manifest.generated_at,
            source=manifest.source,
            datasets=[
                DatasetInfo(
                    dataset=d.dataset,
                    endpoint=d.endpoint,
                    params=d.params,
                    rows=d.rows,
                    sha256=d.sha256,
                )
                for d in manifest.datasets.values()
            ],
        ),
        first_decision_date=settings.first_decision_date,
        last_decision_date=settings.last_decision_date,
        first_delivery_date=settings.first_delivery_date,
        last_delivery_date=settings.last_delivery_date,
        calibration_from=settings.warmup_start_date,
        gates=[gate_info(resolve_gate(preset_id)) for preset_id in PRESETS],
        default_gate=DEFAULT_PRESET_ID,
        run_schedule_utc=data.schedule.schedule_utc,
        calibration=CalibrationSettings(
            method=METHOD,
            window_days=calibration.window_days,
            min_samples=calibration.min_samples,
            quantiles=list(QUANTILES),
        ),
        delivery_window_rule="Hourly products from 23:00 on D-1 to 23:00 on D, UK time",
        timezone="Europe/London",
    )
