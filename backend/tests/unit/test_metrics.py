from __future__ import annotations

import math

import pytest

from gridbricks.domain.metrics import band_coverage, energy_gwh, error_stats, pinball_loss


def test_error_stats_by_hand() -> None:
    # errors: +100, -100, +300, +100 (forecast - actual)
    stats = error_stats([1100, 900, 1300, 1100], [1000, 1000, 1000, 1000])
    assert stats.n == 4
    assert stats.mae == pytest.approx(150.0)
    assert stats.bias == pytest.approx(100.0)
    assert stats.rmse == pytest.approx(math.sqrt((100**2 * 3 + 300**2) / 4))
    assert stats.max_abs_error == pytest.approx(300.0)
    assert stats.nmae == pytest.approx(0.15)
    assert stats.wape == pytest.approx(600 / 4000)
    assert stats.error_p50 == pytest.approx(100.0)


def test_missing_pairs_are_ignored() -> None:
    stats = error_stats([1.0, float("nan"), 3.0], [1.0, 2.0, float("nan")])
    assert stats.n == 1
    assert stats.mae == 0.0


def test_no_pairs_raises() -> None:
    with pytest.raises(ValueError, match="No paired"):
        error_stats([float("nan")], [1.0])


def test_shape_mismatch_raises() -> None:
    with pytest.raises(ValueError, match="Shape mismatch"):
        error_stats([1.0, 2.0], [1.0])


def test_band_coverage_counts_inclusive_bounds() -> None:
    assert band_coverage([5, 10, 15, 20], [5, 5, 5, 5], [15, 15, 15, 15]) == pytest.approx(0.75)


def test_band_coverage_without_comparable_rows_is_nan() -> None:
    assert math.isnan(band_coverage([float("nan")], [0.0], [1.0]))


def test_pinball_loss_penalises_the_right_side() -> None:
    # Under-predicting by 10 costs q * 10; over-predicting costs (1 - q) * 10.
    assert pinball_loss([110.0], [100.0], 0.9) == pytest.approx(9.0)
    assert pinball_loss([90.0], [100.0], 0.9) == pytest.approx(1.0)
    with pytest.raises(ValueError, match="between 0 and 1"):
        pinball_loss([1.0], [1.0], 1.0)


def test_energy_gwh_respects_period_length() -> None:
    assert energy_gwh([1000.0] * 24, 1.0) == pytest.approx(24.0)
    assert energy_gwh([1000.0] * 48, 0.5) == pytest.approx(24.0)
