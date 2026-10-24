# ADR-0003: Quantify forecast error with walk-forward ratio quantiles

**Status:** accepted

## Context

The client wants to make decisions "considering the quantified error". Showing past error
statistics is not enough: the desk needs a range for tomorrow. Any range must be built only from
information available before the decision, or the backtest overstates its skill.

## Decision

For delivery day D, take decision-time forecasts and actuals from delivery days D−15 to D−2. The
P10, P50 and P90 of `actual / forecast` (forecasts of at least 250 MW) scale D's forecast into a
likely range and an error-adjusted estimate. Late December 2025 serves as warm-up.

## Evidence (January 2026, 09:20 gate)

| Method | Central-estimate MAE | P10–P90 coverage | Mean width |
|---|---|---|---|
| Published forecast | 2.02 GW | — | — |
| Additive quantiles (fixed MW) | 1.55 GW | 82% | 5.0 GW |
| **Ratio quantiles (chosen)** | **1.41 GW** | **82.5%** | 5.4 GW |

## Consequences

- Errors grow with wind level, and a multiplicative range follows that shape.
- Simple and explainable. It is checked by coverage (target 80%) and pinball loss, both shown in
  the app.
- It assumes recent behaviour persists, so storms or regime changes can break it, as on
  28 January. Monitoring coverage is part of the design.
- `test_no_information_after_the_cutoff_leaks_into_the_decision` guards the no-look-ahead
  property for any future model.

## Alternatives considered

- **In-sample bands over all of January:** look-ahead bias.
- **Gradient-boosted or NWP-driven models:** out of scope without more data; a roadmap item.
