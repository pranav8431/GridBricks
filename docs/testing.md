# Testing

183 automated tests in nine kinds, from pure functions to the production Docker image in a real
browser. Each kind exists to catch a different class of mistake.

| Kind | What it proves | Where | Count |
|---|---|---|---|
| **Unit** | Market rules (GMT/BST, 23/25-hour days), metrics by hand, calibration maths, schedule inference, Elexon client retries and validation, deterministic ingest | `backend/tests/unit` | 65 |
| **Property-based** | For any data, the chosen run is the latest one strictly before the cutoff (Hypothesis vs a brute-force definition) | `test_selection.py` | in unit |
| **Leakage** | Scrambling everything published after a decision's cutoff leaves its forecast and range unchanged, at three gate times | `test_decision_table.py` | in unit |
| **API integration** | Contracts, problem+json errors, caching and 304s, security headers, degraded mode, SPA fallback and path-traversal guard | `tests/integration/test_api.py` | 18 |
| **API fuzzing** | Random dates, gates and cutoffs never cause a 5xx; every rejection is clean problem+json with a request id | `test_api_fuzz.py` | 120 generated cases |
| **Contract** | The frontend's committed OpenAPI document equals the spec the API serves, so generated TypeScript types cannot drift | `test_contract.py` | 2 |
| **Golden and data integrity** | January headline numbers (MAE, bias, coverage, daily energy error) and the snapshot's checksums, uniqueness and coverage | `test_snapshot_golden.py`, `test_snapshot_integrity.py` | 12 |
| **Performance** | Cold start under 10 s; warm median latency per endpoint within budget (50–600 ms) | `test_performance.py` | 7 |
| **Frontend unit and component** | Formatting, URL state, headline text, revision, agreement and procurement maths, CSV export, chart option builders (including the error heatmap), keyboard shortcuts, and every shared component and page against real API fixtures served by Mock Service Worker | `frontend/src/**/*.test.ts(x)` | 64 |
| **Accessibility** | axe WCAG 2.1 AA audit of every page in dark and light themes; serious or critical findings fail | `frontend/e2e/a11y.spec.ts` | 6 |
| **End to end** | Smoke journeys in a non-UK browser timezone, plus phone layout: menu, navigation, no sideways scroll | `frontend/e2e/smoke.spec.ts`, `mobile.spec.ts` | 8 |

## Running them

```bash
make check                      # lint, strict types, backend + frontend tests with coverage gates
make up                         # production container on :8000
make e2e                        # every Playwright suite against it
cd backend && uv run pytest -m "not perf"   # skip latency budgets on a slow machine
```

## Gates

- Backend coverage at least 90% (currently 94%). Frontend at least 80% of lines and 75% of
  branches (currently 86% and 80%).
- CI runs every kind on each push. The Docker job builds the production image, starts it, and
  runs the API checks and all Playwright suites against that exact image.
- Pre-commit hooks run ruff, ESLint and Prettier before each commit.

## Notes for maintainers

- Golden values change only with a deliberate methodology change; update them with the ADR that
  explains why.
- Frontend fixtures in `frontend/src/test/fixtures/` are real API responses. After changing the
  API, regenerate them from a running app and run `make contracts`.
- Accessibility findings are fixed, not suppressed. The first audit found nested interactive
  controls, links distinguished only by colour and low-contrast light-mode text; all were fixed.
