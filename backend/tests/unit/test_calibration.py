from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from gridbricks.domain.calibration import (
    MIN_FORECAST_MW,
    CalibrationConfig,
    fit_ratio_band,
    walk_forward_bands,
)


def test_window_ends_two_days_before_delivery() -> None:
    config = CalibrationConfig(window_days=14, gap_days=2)
    assert config.window_for(date(2026, 1, 2)) == (date(2025, 12, 18), date(2025, 12, 31))


def test_gap_below_two_days_is_rejected() -> None:
    with pytest.raises(ValueError, match="gap_days"):
        CalibrationConfig(gap_days=1)


def test_band_is_ordered_and_scales_the_forecast() -> None:
    rng = np.random.default_rng(0)
    forecast = rng.uniform(5_000, 15_000, 500)
    actual = forecast * rng.uniform(0.6, 1.1, 500)
    band = fit_ratio_band(forecast, actual, (date(2026, 1, 1), date(2026, 1, 14)), 48)
    assert band is not None
    assert band.p10 < band.p50 < band.p90
    assert band.p10 >= 0.6
    assert band.p90 <= 1.1


def test_too_few_samples_gives_no_band() -> None:
    forecast = np.full(10, 10_000.0)
    assert fit_ratio_band(forecast, forecast, (date(2026, 1, 1), date(2026, 1, 1)), 48) is None


def test_near_zero_forecasts_are_ignored() -> None:
    forecast = np.array([MIN_FORECAST_MW / 2] * 50 + [10_000.0] * 50)
    actual = np.array([5_000.0] * 50 + [9_000.0] * 50)
    band = fit_ratio_band(forecast, actual, (date(2026, 1, 1), date(2026, 1, 2)), 10)
    assert band is not None
    assert band.samples == 50
    assert band.p50 == pytest.approx(0.9)


def test_walk_forward_uses_only_days_inside_the_window() -> None:
    days = [date(2026, 1, 1) + timedelta(days=i) for i in range(10)]
    # Ratio on day i is 0.5 + i / 100, so the window's median identifies the days used.
    pairs = pd.DataFrame(
        {
            "delivery_date": [d for d in days for _ in range(24)],
            "forecast_mw": 10_000.0,
            "actual_mw": [10_000.0 * (0.5 + i / 100) for i in range(10) for _ in range(24)],
        }
    )
    config = CalibrationConfig(window_days=3, gap_days=2, min_samples=24)
    bands = walk_forward_bands(pairs, [date(2026, 1, 8)], config)
    band = bands[date(2026, 1, 8)]
    assert band is not None
    assert (band.window_start, band.window_end) == (date(2026, 1, 4), date(2026, 1, 6))
    assert band.p50 == pytest.approx(0.54)  # median of days 4-6: ratios 0.53, 0.54, 0.55
