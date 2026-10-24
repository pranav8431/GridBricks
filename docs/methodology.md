# Methodology

How the app turns two public datasets into decision support for a GB day-ahead desk. Every
figure here comes from the committed January 2026 snapshot and is pinned by the golden tests.

## 1. The decision being modelled

A supplier must buy, the day before delivery, the power its customers need beyond what
renewables will provide. Wind is the swing factor, so the desk relies on the national wind
forecast available at its decision time.

- **Delivery day D.** The 24 hourly day-ahead products run from 23:00 on D-1 to 23:00 on D, UK
  time. That gives 23 hours on the spring clock change and 25 in autumn.
- **Decision time.** The gate closure of the auction the desk uses, on D-1. GB day-ahead gates
  are:

  | Preset | Auction | Gate closure (UK) |
  |---|---|---|
  | `epex_hourly` (default) | EPEX SPOT GB 60-minute day-ahead | 09:20 |
  | `n2ex` | Nord Pool N2EX GB day-ahead | 09:50 |
  | `epex_halfhourly` | EPEX SPOT GB 30-minute day-ahead | 15:30 |

  A custom decision time on D-1 can also be set.
- **Scope.** Decisions on 1–31 January 2026, for delivery from 2 January to 1 February 2026.

## 2. Data

| Dataset | Use | Notes from exploration |
|---|---|---|
| **WINDFOR** (`/datasets/WINDFOR/stream`) | Wind generation forecast. Each run has a `publishTime` and 73 hourly `startTime` values. | Eight runs a day at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30 and 22:30 UTC. Each covers 21:00 UTC the day before publication to 21:00 UTC two days after. One run was off schedule: 12:25 on 15 January, replacing the 11:30 run. |
| **FUELHH** (`/datasets/FUELHH/stream`, `fuelType=WIND`) | Half-hourly wind outturn (average MW per settlement period). | All 2,208 half-hours present for the analysis window, with no duplicates. Each period is published 30 minutes after it starts. |

Both datasets cover wind farms with operational metering visible to the system operator.
Embedded, distribution-connected wind is not included in either.

**Stale points.** Each WINDFOR run repeats values for hours that had already started when it was
published. They are copies of earlier runs, not forecasts. 5,881 such points are removed before
any analysis.

## 3. Which forecast was available

For every hourly product t of delivery day D, with decision time c on D-1:

> forecast(t) = the value for t from the run with the **latest publish time strictly before c**.

- *Strictly*, because a run stamped at the gate-closure minute cannot be acted on.
- The rule is applied per hour, so a missing or late run falls back naturally to the previous
  one.
- At 09:20 the newest run is the 07:30 one, published 1 h 50 min before the gate. The 09:30 run
  lands 10 minutes too late, so the N2EX gate at 09:50 does see it.
- Lead times at 09:20 run from 15.5 to 38.5 hours.

## 4. Measuring error

- **Error = forecast − actual** in MW. A positive error means less wind arrived than forecast, so
  a desk that bought against the forecast is short.
- **Alignment.** WINDFOR is hourly and FUELHH half-hourly. Each hourly forecast is compared with
  the outturn of the half-hour starting at the same time, as the datasets' shared `startTime`
  suggests. Daily energy totals use every half-hour.
- **Metrics.**
  - Mean absolute error (MAE), RMSE and bias (mean error).
  - Error percentiles and the 90th percentile of absolute error.
  - MAE divided by mean output.
  - Share of hours inside the likely range.
  - Pinball loss of the range.

  Hourly percentage error is avoided because it explodes at low output.

## 5. The error-adjusted estimate and likely range

For each delivery day D:

1. Take the decision-time forecasts and actuals of the 14 delivery days **D−15 to D−2**. D−2 is
   the newest day fully settled before a morning gate on D-1.
2. For every hour with a forecast of at least 250 MW, compute r = actual ÷ forecast.
3. The P10, P50 and P90 of r, multiplied by D's forecast, give the likely range and the
   error-adjusted central estimate (P50).

**Why multiplicative.** GB wind errors grow with output, as the table below shows. An additive
band, a fixed number of MW, was also backtested. It gave a central-estimate MAE of 1.55 GW,
against 1.41 GW for the ratio method, so the ratio method was kept.

**Warm-up.** Early-January decisions need history from late December 2025. That history is used
only for calibration, because a trader would already have known it, and never shown as results.

**No look-ahead.** `test_no_information_after_the_cutoff_leaks_into_the_decision` scrambles every
forecast and actual published after D's cutoff. It asserts that D's forecast and range are
unchanged, across three decision times.

**Daily energy range.** The daily P10 and P90 sum the hourly bounds. That assumes errors move
together through the day. They are strongly autocorrelated, so the daily range errs slightly
wide.

## 6. Findings (January 2026, gate 09:20)

| Measure | Published forecast | Error-adjusted (P50) |
|---|---|---|
| Mean absolute error | 2.02 GW | 1.41 GW (−30%) |
| RMSE | 2.49 GW | — |
| Bias | +1.75 GW | +0.62 GW |
| Actual hours inside P10–P90 | — | 82.5% (target 80%), average width 5.4 GW |

**Bias grows with wind level.**

| Forecast level | Hours | Bias |
|---|---|---|
| 0–4 GW | 7 | +1.22 GW (too few hours to read) |
| 4–8 GW | 134 | +0.27 GW |
| 8–12 GW | 200 | +1.48 GW |
| 12–16 GW | 131 | +1.47 GW |
| ≥ 16 GW | 272 | +2.82 GW |

The pattern fits curtailment. Wind farms in export-constrained areas are turned down in windy
periods, and outturn is measured after those actions. Confirming it needs balancing-mechanism
data, which is out of this pilot's scope.

**Waiting helps far less than correcting.**

| Decision time | Run used | MAE | MAE after adjustment |
|---|---|---|---|
| 09:20 EPEX hourly | 07:30 | 2.02 GW | 1.41 GW |
| 09:50 N2EX | 09:30 | 1.99 GW | 1.40 GW |
| 15:30 EPEX half-hourly | 11:30 | 1.88 GW | 1.31 GW |

Moving from the 09:20 auction to the 15:30 auction cuts error by 7%. Correcting the forecast cuts
it by 30%.

**Accuracy by lead time** across all runs ranges from an MAE of 1.67 GW at 0–3 hours ahead to
2.37 GW at 69–72 hours. Even same-day forecasts carry most of the bias, which again points to a
structural cause rather than weather uncertainty.

**Largest misses** in forecast energy minus actual energy:

| Delivery day | Error |
|---|---|
| 28 January | +128 GWh |
| 12 January | +121 GWh |
| 11 January | +112 GWh |
| 21 January | +88 GWh |
| 27 January | +80 GWh |

On 28 January the error-adjusted range missed every hour, a reminder that the range reflects
recent conditions, not storms.

## 7. Limitations

- National level only, not the client's own portfolio or demand.
- Volumes only: no prices, so no cost of being short or long yet.
- The calibration assumes the last two weeks' behaviour persists into tomorrow, so regime changes
  can break it. Coverage is monitored for this reason.
- Market timings are presets taken from EPEX SPOT and Nord Pool publications. Each client should
  confirm the auction it uses.

## 8. Roadmap

1. Live mode: ingest after every run, with alerts when a run revises tomorrow by more than a
   threshold.
2. Client portfolio and demand, to show the residual volume to buy with its range.
3. A price layer: the expected cost of imbalance, using system prices and intraday prices.
4. Regime-aware calibration by wind level and season, and comparison of forecast providers.
5. Single sign-on, an audit trail and a managed database (the `DataRepository` adapter).
