"""HTTP boundary: no request bodies, query strings, headers or identities in logs."""
import hashlib
import json
import logging
import math
import time
import uuid
from contextlib import contextmanager
from inspect import isgenerator

from sqlalchemy import Column, Integer, MetaData, String, Table, case
from sqlalchemy.dialects.sqlite import insert
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import get_db

logger = logging.getLogger("app.http_security")
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)
logger.propagate = False
# Matches the parent-owned SecurityThrottle model; never creates tables at request time.
throttles = Table("security_throttles", MetaData(),
                  Column("key", String(64), primary_key=True),
                  Column("window", Integer, nullable=False),
                  Column("count", Integer, nullable=False))


def rate_group(method, path):
    if method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return None
    path = path.rstrip("/")
    if path in {"/api/auth/login", "/api/auth/register"}:
        return "auth"
    if path in {"/api/auth/password", "/api/auth/reset-password", "/api/auth/forgot-password"}:
        return "password"
    if (path == "/api/dialect/contributions" or path.startswith("/api/dialect/contributions/")
            or path == "/api/dialect/allocation" or path.startswith("/api/dialect/sessions/")
            or path.startswith("/api/dialect/game/")):
        return "contributions"
    if path == "/api/dialect/feedback" or path.startswith("/api/dialect/feedback/"):
        return "feedback"
    return None


@contextmanager
def request_database(scope):
    app = scope.get("app")
    factory = getattr(app, "dependency_overrides", {}).get(get_db, get_db)
    resource = factory()
    if isgenerator(resource):
        try:
            yield next(resource)
        finally:
            resource.close()
    else:
        # An override may return a caller-owned Session; do not close it.
        yield resource


def consume(scope, key, window, limit):
    with request_database(scope) as db:
        statement = insert(throttles).values(key=key, window=window, count=1)
        statement = statement.on_conflict_do_update(
            index_elements=[throttles.c.key],
            set_={"window": window, "count": case(
                (throttles.c.window == window, throttles.c.count + 1), else_=1)},
        ).returning(throttles.c.count)
        try:
            count = db.execute(statement).scalar_one()
            db.commit()
        except Exception:
            db.rollback()
            raise
        return count <= limit


class HttpSecurityMiddleware:
    def __init__(self, app, settings=None, clock=time.time):
        self.app = app
        self.settings = settings or get_settings()
        self.clock = clock

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        # Never accept caller-supplied request IDs or forwarded IP/protocol headers.
        request_id = uuid.uuid4().hex
        from app.core.audit import request_id_context
        token = request_id_context.set(request_id)
        started = time.monotonic()
        status = 500
        response_started = False
        error_class = None

        async def send_response(message):
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status = message["status"]
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() != b"x-request-id"]
                headers.append((b"x-request-id", request_id.encode("ascii")))
                if scope['path'].startswith('/api/auth/'):
                    headers.append((b'cache-control', b'no-store'))
                if self.settings.environment == "production" and scope.get("scheme") == "https":
                    headers.append((b"strict-transport-security", b"max-age=31536000"))
                message = {**message, "headers": headers}
            await send(message)

        try:
            if self.settings.environment == "production" and scope.get("scheme") != "https":
                await JSONResponse({"detail": "HTTPS required"}, status_code=400)(scope, receive, send_response)
                return
            group = rate_group(scope["method"], scope["path"])
            if group and self.settings.rate_limit_enabled:
                now = self.clock()
                duration = self.settings.rate_limit_window_seconds
                window = math.floor(now / duration)
                client = (scope.get("client") or ("unknown", 0))[0]
                key = hashlib.sha256(f"{group}\0{client}".encode()).hexdigest()
                allowed = await run_in_threadpool(consume, scope, key, window,
                                                  getattr(self.settings, "rate_limit_" + group))
                if not allowed:
                    retry = max(1, math.ceil((window + 1) * duration - now))
                    await JSONResponse({"detail": "Too many requests"}, status_code=429,
                                       headers={"Retry-After": str(retry)})(scope, receive, send_response)
                    return
            await self.app(scope, receive, send_response)
        except Exception as exc:
            error_class = type(exc).__name__
            if response_started:
                # Streaming cannot change status after headers; never log exception text.
                return
            await JSONResponse({"detail": "Internal server error"}, status_code=500)(scope, receive, send_response)
        finally:
            from app.services.runtime_metrics import record as record_metric
            record_metric(status, (time.monotonic() - started) * 1000)
            route = scope.get("route")
            record = {"event": "http_request", "request_id": request_id,
                      "method": scope["method"], "route": getattr(route, "path", "unmatched"),
                      "status": status, "duration_ms": round((time.monotonic() - started) * 1000, 2)}
            if error_class:
                record["exception_class"] = error_class
            logger.info(json.dumps(record))
            request_id_context.reset(token)
