"""Forecast error metrics. Error is always ``forecast - actual``: positive means over-forecast."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float64]


@dataclass(frozen=True, slots=True)
class ErrorStats:
    n: int
    mae: float
    rmse: float
    bias: float
    error_p10: float
    error_p50: float
    error_p90: float
    abs_error_p90: float
    max_abs_error: float
    mean_actual: float
    nmae: float
    """Mean absolute error divided by mean actual output."""
    wape: float
    """Sum of absolute errors divided by the sum of actual output."""


def as_array(values: npt.ArrayLike) -> FloatArray:
    return np.asarray(values, dtype=np.float64)


def paired(forecast: npt.ArrayLike, actual: npt.ArrayLike) -> tuple[FloatArray, FloatArray]:
    """Drop positions where either value is missing."""
    f, a = as_array(forecast), as_array(actual)
    if f.shape != a.shape:
        raise ValueError(f"Shape mismatch: forecast {f.shape} vs actual {a.shape}.")
    keep = ~(np.isnan(f) | np.isnan(a))
    return f[keep], a[keep]


def error_stats(forecast: npt.ArrayLike, actual: npt.ArrayLike) -> ErrorStats:
    f, a = paired(forecast, actual)
    if f.size == 0:
        raise ValueError("No paired forecast/actual observations.")
    error = f - a
    abs_error = np.abs(error)
    mean_actual = float(a.mean())
    total_actual = float(a.sum())
    p10, p50, p90 = np.quantile(error, [0.1, 0.5, 0.9])
    return ErrorStats(
        n=int(f.size),
        mae=float(abs_error.mean()),
        rmse=float(np.sqrt(np.mean(error**2))),
        bias=float(error.mean()),
        error_p10=float(p10),
        error_p50=float(p50),
        error_p90=float(p90),
        abs_error_p90=float(np.quantile(abs_error, 0.9)),
        max_abs_error=float(abs_error.max()),
        mean_actual=mean_actual,
        nmae=float(abs_error.mean() / mean_actual) if mean_actual else float("nan"),
        wape=float(abs_error.sum() / total_actual) if total_actual else float("nan"),
    )


def band_coverage(actual: npt.ArrayLike, lower: npt.ArrayLike, upper: npt.ArrayLike) -> float:
    """Share of actual values inside ``[lower, upper]``. NaN when nothing is comparable."""
    a, lo, hi = as_array(actual), as_array(lower), as_array(upper)
    keep = ~(np.isnan(a) | np.isnan(lo) | np.isnan(hi))
    if not keep.any():
        return float("nan")
    inside = (a[keep] >= lo[keep]) & (a[keep] <= hi[keep])
    return float(inside.mean())


def pinball_loss(actual: npt.ArrayLike, predicted: npt.ArrayLike, quantile: float) -> float:
    """Average quantile (pinball) loss. Lower is better; it rewards calibrated, sharp bands."""
    if not 0.0 < quantile < 1.0:
        raise ValueError("quantile must be between 0 and 1.")
    p, a = paired(predicted, actual)
    if p.size == 0:
        raise ValueError("No paired observations.")
    diff = a - p
    return float(np.mean(np.maximum(quantile * diff, (quantile - 1.0) * diff)))


def energy_gwh(mw: npt.ArrayLike, hours_per_value: float) -> float:
    """Energy in GWh from average-MW values that each cover ``hours_per_value`` hours."""
    values = as_array(mw)
    return float(np.nansum(values) * hours_per_value / 1000.0)
