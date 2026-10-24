# ADR-0004: Deploy the demo on Vercel; keep one Docker image as the reference runtime

**Status:** accepted

## Context

The brief asks for Docker and a deployment on Vercel or Heroku. Heroku has no free tier and its
cheapest dynos sleep after 30 minutes. Vercel's Hobby plan is free, serves static assets from a
global CDN and runs Python functions.

## Decision

- **Vercel** hosts the live demo. The React build is served from the CDN (region `lhr1`), and
  FastAPI runs as one function from `api/index.py`, which imports the same `create_app()`.
- **Docker** is the reference runtime. A multi-stage build produces one non-root image that
  serves both the API and the SPA, honours `$PORT` and has a health check. CI builds it and runs
  the browser smoke tests against it. `heroku.yml` makes it deployable to Heroku unchanged.

## Consequences

- No hosting cost, and fast static delivery. API responses are CDN-cached because the data is
  immutable.
- Two runtimes share one codebase and one dependency list: `requirements.txt` is exported from
  `uv.lock`, and CI checks for drift.
- Function cold start is about 3 s. CDN caching hides it for repeat requests.
- Dependencies are about 120 MB, within Vercel's function limit.

## Alternatives considered

- **Heroku container dynos:** true parity with Docker, but paid and prone to sleeping.
- **Separate frontend and API projects:** needs CORS and two deploys, for no benefit here.
