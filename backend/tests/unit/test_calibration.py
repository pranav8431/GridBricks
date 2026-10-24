from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from gridbricks.domain.calibration import (
    MIN_FORECAST_MW,
    CalibrationConfig,
    fit_linear_band,
    walk_forward_bands,
)

WINDOW = (datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 15, tzinfo=UTC))


def test_invalid_config_is_rejected() -> None:
    with pytest.raises(ValueError, match="window_days"):
        CalibrationConfig(window_days=0)


def test_recovers_a_known_line_and_orders_the_range() -> None:
    rng = np.random.default_rng(0)
    forecast = rng.uniform(4_000, 18_000, 600)
    actual = 1_500 + 0.7 * forecast + rng.normal(0, 800, 600)
    band = fit_linear_band(forecast, actual, WINDOW, 48)
    assert band is not None
    assert band.slope == pytest.approx(0.7, abs=0.03)
    assert band.intercept == pytest.approx(1_500, abs=300)
    p10, p50, p90 = band.apply(np.array([10_000.0]))
    assert p10[0] < p50[0] < p90[0]
    assert p50[0] == pytest.approx(8_500, abs=200)
    # About 80% of the training residuals fall inside the range.
    lo, _, hi = band.apply(forecast)
    assert np.mean((actual >= lo) & (actual <= hi)) == pytest.approx(0.8, abs=0.02)


def test_never_predicts_negative_wind() -> None:
    band = fit_linear_band(
        np.array([1_000.0, 2_000.0, 3_000.0, 4_000.0]),
        np.array([0.0, 200.0, 400.0, 600.0]),
        WINDOW,
        3,
    )
    assert band is not None
    p10, p50, _ = band.apply(np.array([300.0]))
    assert p50[0] >= 0
    assert p10[0] >= 0


def test_too_few_samples_gives_no_band() -> None:
    forecast = np.full(10, 10_000.0)
    assert fit_linear_band(forecast, forecast, WINDOW, 48) is None


def test_near_zero_forecasts_are_ignored() -> None:
    forecast = np.array([MIN_FORECAST_MW / 2] * 50 + list(np.linspace(5_000, 15_000, 50)))
    actual = np.array([5_000.0] * 50 + list(np.linspace(5_000, 15_000, 50) * 0.9))
    band = fit_linear_band(forecast, actual, WINDOW, 10)
    assert band is not None
    assert band.samples == 50
    assert band.slope == pytest.approx(0.9)


def test_walk_forward_uses_only_outturn_published_before_the_cutoff() -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    hours = [start + timedelta(hours=h) for h in range(24 * 10)]
    forecast = np.linspace(5_000, 15_000, len(hours))
    pairs = pd.DataFrame(
        {
            "start_time": hours,
            "actual_published": [h + timedelta(minutes=30) for h in hours],
            "forecast_mw": forecast,
            # Before 6 Jan the forecast is perfect; afterwards it is 50% too high.
            "actual_mw": [
                f if h < start + timedelta(days=5) else f / 1.5
                for h, f in zip(hours, forecast, strict=True)
            ],
        }
    )
    cutoff = start + timedelta(days=5)
    bands = walk_forward_bands(pairs, {date(2026, 1, 7): cutoff}, CalibrationConfig(window_days=3))
    band = bands[date(2026, 1, 7)]
    assert band is not None
    assert band.slope == pytest.approx(1.0)  # later, worse outturn is invisible at the cutoff
    assert band.window_start == cutoff - timedelta(days=3)
    assert band.window_end == cutoff
