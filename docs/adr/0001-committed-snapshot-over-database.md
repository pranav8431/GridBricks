# ADR-0001: Serve from a committed, checksummed data snapshot

**Status:** accepted

## Context

The pilot covers a fixed historical period: decisions in January 2026, plus 14 days of warm-up.
That is about 29,000 forecast points and 2,300 actual periods. The live Elexon API is public and
fast, but a demo or review must not depend on it being up, unchanged, or quick.

## Decision

`python -m gridbricks.ingest` fetches the data once, validates it, and writes canonical gzipped
JSON with a `manifest.json` that records request parameters, row counts and SHA-256 checksums.
The snapshot is committed. At runtime `SnapshotRepository` loads it into memory and verifies the
checksums. The app depends only on the `DataRepository` protocol.

## Consequences

- The runtime makes no network calls: it starts fast, behaves the same everywhere and is easy to
  test.
- Data provenance is auditable. Re-running the ingest on unchanged source data produces
  byte-identical files.
- Updating the data means re-running the ingest and redeploying. That is right for a backtest
  pilot, but not for live use.
- **Path to production:** implement `DataRepository` over Postgres or TimescaleDB, fed by a
  scheduled ingest. The domain and services do not change.

## Alternatives considered

- **Call Elexon on each request:** couples availability and latency to an external API.
- **SQLite or Postgres now:** more moving parts for no benefit at this data size.
