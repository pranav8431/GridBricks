# ADR-0002: Select forecasts with a strict as-of join on publish time

**Status:** accepted

## Context

The client's first question is "what did the latest forecast say when we had to decide?"
WINDFOR publishes about eight runs a day, sometimes late. Each run also repeats stale values for
hours that have already started.

## Decision

- Drop points whose target hour is before the run's publish time.
- For each hourly product, take the run with the **latest publish time strictly before the
  decision cutoff** that covers that hour. This is `pd.merge_asof(..., by="start_time",
  allow_exact_matches=False)` in `domain/selection.py`.
- The run schedule is inferred from the data, never hard-coded.

## Consequences

- A late run, such as 12:25 on 15 January 2026, or a missing run is handled without special
  cases.
- A run stamped exactly at gate closure is excluded. This is conservative and realistic.
- Verified by unit tests, a Hypothesis property test against a brute-force definition, and a
  leakage test (see ADR-0003).

## Alternatives considered

- **Pick one run per day, the latest before the cutoff:** breaks when a run is partial or late.
- **Inclusive cutoff (`<=`):** would let a forecast published at the gate minute count as usable.
