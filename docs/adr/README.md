# Architecture decision records

Short records of the decisions that shaped the pilot: the context, the choice and its
consequences. Each one is a starting point for review, not a final word.

| ADR | Decision |
|---|---|
| [0001](0001-committed-snapshot-over-database.md) | Serve from a committed, checksummed data snapshot instead of a database or live API calls |
| [0002](0002-strict-as-of-forecast-selection.md) | Select the forecast per hour with a strict as-of join on publish time |
| [0003](0003-walk-forward-ratio-calibration.md) | Quantify forecast error with walk-forward ratio quantiles (superseded) |
| [0004](0004-vercel-deployment-with-docker-image.md) | Deploy the demo on Vercel; keep one Docker image as the reference runtime |
| [0005](0005-delivery-window-and-gate-presets.md) | Model delivery as 23:00–23:00 UK with auction gate presets |
| [0006](0006-linear-walk-forward-correction.md) | Correct the forecast with a walk-forward line fitted on settled hours (supersedes 0003) |
