"""Liveness and readiness."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from gridbricks import __version__
from gridbricks.api.deps import Desk
from gridbricks.schemas import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    responses={503: {"model": HealthResponse}},
)
def health(desk: Desk) -> JSONResponse:
    version = desk.snapshot_version()
    body = HealthResponse(
        status="ok" if version else "degraded",
        version=__version__,
        snapshot_version=version,
        detail=None if version else "Data snapshot missing; run the ingest.",
    )
    return JSONResponse(
        body.model_dump(),
        status_code=200 if version else 503,
        headers={"Cache-Control": "no-store"},
    )
