# ADR-0005: Model delivery as 23:00–23:00 UK with auction gate presets

**Status:** accepted

## Context

"Decisions made one day before delivery" needs a precise decision time and delivery window. GB
runs several day-ahead auctions with different gate closures. Hourly products follow the
continental day, from 23:00 to 23:00 UK time.

## Decision

- The delivery day is the 24 hourly products from 23:00 on D-1 to 23:00 on D, `Europe/London`.
- Decision time presets:
  - EPEX SPOT GB 60-minute auction at 09:20 (the default, and the earliest gate);
  - Nord Pool N2EX at 09:50;
  - EPEX SPOT GB 30-minute auction at 15:30.
  - A custom time is also allowed.
- All arithmetic is in UTC, converted at the edges with `zoneinfo`.

## Consequences

- The app answers the trader's real question: what the forecast said before this auction
  closed.
- Comparing gates quantifies the value of waiting. In January it was only 7%.
- Clock-change days produce 23- or 25-hour windows. Tests cover 29 March and 25 October 2026.
- Timings come from EPEX SPOT and Nord Pool publications. Each client should confirm its
  auction, and the presets live in one module.
