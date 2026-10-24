"""Error responses in RFC 9457 / 7807 ``application/problem+json`` format."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from gridbricks.domain.market import MarketRuleError
from gridbricks.errors import ScopeError
from gridbricks.logging_config import get_logger
from gridbricks.repository import SnapshotUnavailableError

PROBLEM_JSON = "application/problem+json"
log = get_logger(__name__)


def problem(request: Request, status: int, title: str, detail: str, **extra: Any) -> JSONResponse:
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": title,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        **extra,
    }
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        body["request_id"] = request_id
    headers = {"Cache-Control": "no-store"}
    return JSONResponse(
        jsonable_encoder(body), status_code=status, media_type=PROBLEM_JSON, headers=headers
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ScopeError)
    async def _scope(request: Request, exc: ScopeError) -> JSONResponse:
        return problem(request, 422, "Outside pilot scope", str(exc))

    @app.exception_handler(MarketRuleError)
    async def _market(request: Request, exc: MarketRuleError) -> JSONResponse:
        return problem(request, 422, "Invalid market parameter", str(exc))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "loc": list(err.get("loc", ())),
                "msg": err.get("msg", ""),
                "type": err.get("type", ""),
            }
            for err in exc.errors()
        ]
        return problem(
            request, 422, "Invalid request", "One or more parameters are invalid.", errors=errors
        )

    @app.exception_handler(SnapshotUnavailableError)
    async def _snapshot(request: Request, exc: SnapshotUnavailableError) -> JSONResponse:
        log.error("snapshot.unavailable", error=str(exc))
        return problem(request, 503, "Data unavailable", str(exc))

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        title = "Not found" if exc.status_code == 404 else "Request failed"
        return problem(request, exc.status_code, title, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("request.unhandled_error", path=request.url.path)
        return problem(request, 500, "Internal error", "An unexpected error occurred.")
