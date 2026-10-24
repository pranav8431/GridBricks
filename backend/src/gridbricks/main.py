"""Application factory.

Run locally with ``uvicorn gridbricks.main:create_app --factory``. Vercel imports
``create_app()`` from ``api/index.py``; Docker runs the factory and also serves the built SPA.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import Response
from starlette.staticfiles import StaticFiles

from gridbricks import __version__
from gridbricks.api.errors import install_error_handlers
from gridbricks.api.middleware import CacheControlMiddleware, RequestContextMiddleware
from gridbricks.api.routes import desk as desk_routes
from gridbricks.api.routes import health
from gridbricks.config import Settings, get_settings
from gridbricks.logging_config import configure_logging, get_logger
from gridbricks.repository import DataRepository, SnapshotRepository, SnapshotUnavailableError
from gridbricks.services.desk import DeskService

log = get_logger(__name__)

DESCRIPTION = """
Shows a GB day-ahead trading desk the national wind forecast that was available at its
decision time, and quantifies how accurate that forecast has been.

* Times are UTC (ISO 8601). Power is MW, energy GWh.
* Error = forecast − actual: positive means over-forecast (the desk would be short).
* Data: Elexon BMRS WINDFOR (forecasts) and FUELHH fuelType=WIND (actuals).
"""


def create_app(
    settings: Settings | None = None, repository: DataRepository | None = None
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_json)
    desk = DeskService(repository or SnapshotRepository(settings.data_dir), settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            desk.warm_up()
            log.info("startup.ready", snapshot=desk.snapshot_version())
        except SnapshotUnavailableError as exc:
            # Stay up so /api/health can report the problem instead of crash-looping.
            log.error("startup.degraded", error=str(exc))
        yield

    app = FastAPI(
        title="GridBricks Day-Ahead Wind Desk API",
        version=__version__,
        description=DESCRIPTION,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.desk = desk
    app.state.settings = settings
    install_error_handlers(app)
    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(desk_routes.router, prefix="/api/v1", tags=["desk"])

    def etag() -> str | None:
        version = desk.snapshot_version()
        return f'W/"{__version__}-{version}"' if version else None

    # Added innermost first: request context wraps compression, which wraps caching.
    app.add_middleware(
        CacheControlMiddleware,
        etag=etag,
        browser_seconds=settings.browser_cache_seconds,
        cdn_seconds=settings.cdn_cache_seconds,
        enabled=settings.environment == "production",
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET"]
        )
    app.add_middleware(RequestContextMiddleware)

    if settings.static_dir is not None:
        mount_spa(app, settings.static_dir)
    return app


class ImmutableStaticFiles(StaticFiles):
    """Vite emits content-hashed asset names, so they can be cached for a year."""

    def file_response(self, *args: Any, **kwargs: Any) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def mount_spa(app: FastAPI, static_dir: Path) -> None:
    """Serve the built React app, falling back to index.html for client-side routes."""
    root = static_dir.resolve()
    index = root / "index.html"
    if not index.is_file():
        log.warning("spa.missing", static_dir=str(root))
        return
    assets = root / "assets"
    if assets.is_dir():
        app.mount("/assets", ImmutableStaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail=f"No API route /{path}.")
        candidate = (root / path).resolve()
        if path and candidate.is_file() and root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
