# ADR-0006: Correct the forecast with a walk-forward line fitted on settled hours

**Status:** accepted. Supersedes [ADR-0003](0003-walk-forward-ratio-calibration.md).

## Context

The desk buys daily volumes, so the error that matters most is the daily energy error. The
ratio-quantile method of ADR-0003 cut it from 43.3 to 28.2 GWh in January. It had two weaknesses.
It ignored the most recent settled hours, using only whole days up to D−2. It also applied one
ratio at every wind level, although the over-forecast grows with the forecast.

## Decision

For each decision with cutoff c, fit `actual = a + b × forecast` by least squares. The training
data is every hour in the 14 days before c whose outturn had been published before c, paired
with the decision-time forecast that was used for it. Hours forecast below 250 MW are left out.
The line gives the corrected estimate (P50). The 10th and 90th percentiles of its residuals give
the likely range. Estimates are floored at zero.

## Evidence (January 2026, 09:20 gate, 31 decisions)

| Method | Daily energy error | Hourly MAE | Coverage | Width |
|---|---|---|---|---|
| Published forecast | 43.3 GWh | 2.02 GW | — | — |
| Ratio quantiles, D−15 to D−2 (ADR-0003) | 28.2 GWh | 1.41 GW | 82.5% | 5.4 GW |
| Ratio quantiles, last 14 days of settled hours | 28.4 GWh | 1.42 GW | 82.5% | 5.4 GW |
| Ratio quantiles, last 48 settled hours | 37.5 GWh | 1.76 GW | 61.2% | 4.2 GW |
| Ratio quantiles, 150 nearest forecast levels | 22.5 GWh | 1.28 GW | 80.0% | 4.2 GW |
| **Line, last 14 days (chosen)** | **22.4 GWh** | **1.24 GW** | **80.1%** | **3.7 GW** |
| Line, last 21 days | 21.8 GWh | 1.23 GW | 77.7% | 3.7 GW |
| Line, last 28 days | 21.5 GWh | 1.21 GW | 77.8% | 3.7 GW |
| Line, 14 days, plus a 48-hour bias shift | 24.8 GWh | 1.30 GW | 76.9% | 3.7 GW |
| Line, 28 days, recency-weighted | 22.4 GWh | 1.22 GW | 77.8% | 3.7 GW |

## Consequences

- The daily energy error falls by 48% against the published forecast, and by 21% against
  ADR-0003. The range is a third narrower and stays on its 80% target.
- Results hold at the other gates: 1.22 GW at 09:50 and 1.11 GW at 15:30.
- The model is still two numbers and two percentiles, which is easy to explain to a trader. The
  brief's tooltip shows the fitted line.
- Longer windows were slightly more accurate but under-covered. The 14-day window was chosen to
  keep the range honest.
- The leakage test still holds, because training rows are filtered by outturn publish time.
- It shares ADR-0003's weakness: sudden regime changes such as 28 January are missed.
