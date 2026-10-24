"""Pure-ASGI middleware: request context and access logs, security headers, HTTP caching."""

from __future__ import annotations

import re
import time
import uuid
from collections.abc import Callable

import structlog
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from gridbricks.logging_config import get_logger

log = get_logger("gridbricks.access")

_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

#: The SPA needs no third-party origins; inline styles come from the component library.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}
#: Swagger UI loads its assets from a CDN, so it is exempt from the strict policy.
_CSP_EXEMPT_PREFIXES = ("/api/docs",)


class RequestContextMiddleware:
    """Assigns a request id, adds security headers, and writes one access-log line per request."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = Headers(scope=scope).get("x-request-id", "")
        request_id = incoming if _REQUEST_ID.match(incoming) else uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        path: str = scope["path"]
        status = 500
        started = time.perf_counter()

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
                for name, value in SECURITY_HEADERS.items():
                    headers.setdefault(name, value)
                if not path.startswith(_CSP_EXEMPT_PREFIXES):
                    headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
            await send(message)

        structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            log.info(
                "request",
                method=scope["method"],
                path=path,
                query=scope.get("query_string", b"").decode("latin-1"),
                status=status,
                duration_ms=round((time.perf_counter() - started) * 1000, 1),
            )
            structlog.contextvars.unbind_contextvars("request_id")


class CacheControlMiddleware:
    """Makes immutable API responses cacheable by browsers and the CDN, with ETag revalidation.

    Within one deployment the data never changes, so the ETag only depends on the app version
    and the snapshot version. A matching ``If-None-Match`` is answered with 304 straight away.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        etag: Callable[[], str | None],
        browser_seconds: int,
        cdn_seconds: int,
        enabled: bool = True,
        prefix: str = "/api/v1/",
    ) -> None:
        self.app = app
        self._etag = etag
        self._prefix = prefix
        self._enabled = enabled
        self._cache_control = (
            f"public, max-age={browser_seconds}, s-maxage={cdn_seconds}, "
            f"stale-while-revalidate={cdn_seconds}"
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in ("GET", "HEAD"):
            await self.app(scope, receive, send)
            return
        path: str = scope["path"]
        if not path.startswith(self._prefix):
            await self.app(scope, receive, send)
            return
        if not self._enabled:
            await self.app(scope, receive, self._with_headers(send, {"Cache-Control": "no-store"}))
            return

        etag = self._etag()
        if etag is None:
            await self.app(scope, receive, send)
            return
        if etag in _parse_if_none_match(Headers(scope=scope).get("if-none-match", "")):
            await send(
                {
                    "type": "http.response.start",
                    "status": 304,
                    "headers": [
                        (b"etag", etag.encode()),
                        (b"cache-control", self._cache_control.encode()),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": b""})
            return
        headers = {"Cache-Control": self._cache_control, "ETag": etag}
        await self.app(scope, receive, self._with_headers(send, headers, only_status=200))

    @staticmethod
    def _with_headers(send: Send, extra: dict[str, str], only_status: int | None = None) -> Send:
        async def wrapper(message: Message) -> None:
            if message["type"] == "http.response.start" and (
                only_status is None or message["status"] == only_status
            ):
                headers = MutableHeaders(scope=message)
                for name, value in extra.items():
                    headers[name] = value
            await send(message)

        return wrapper


def _parse_if_none_match(value: str) -> set[str]:
    return {part.strip() for part in value.split(",") if part.strip()}
