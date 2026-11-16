from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.core import audit  # noqa: F401  (transactional security audit listeners)
from app.core.http_security import HttpSecurityMiddleware
from app.routers import annotate as annotate_router
from app.routers import audios as audios_router
from app.routers import auth as auth_router
from app.routers import projects as projects_router
from app.routers import reports as reports_router
from app.routers import review as review_router
from app.routers import roleplay as roleplay_router
from app.routers import users as users_router
from app.routers import wallet as wallet_router
from app.routers import dialect as dialect_router
from app.routers import dialect_workspace as dialect_workspace_router
from app.routers import dialect_review_ops
from app.routers import dialect_game
from app.routers import pilot_operations

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from app.core.database import SessionLocal
    from app.services.game_state import bootstrap
    with SessionLocal() as db:
        bootstrap(db)
    yield


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(HttpSecurityMiddleware, settings=settings)
# Structured request logs above replace Uvicorn's raw URL/query access log.
logging.getLogger('uvicorn.access').disabled = True

app.include_router(auth_router.router, prefix="/api")
app.include_router(dialect_router.router, prefix="/api")
app.include_router(dialect_workspace_router.router, prefix="/api")
app.include_router(dialect_review_ops.router, prefix="/api")
app.include_router(dialect_game.router, prefix="/api")
app.include_router(pilot_operations.router, prefix="/api")

# Pilot excludes legacy APIs, including direct HTTP and WebSocket access.
if settings.enable_legacy:
    for router in (projects_router.router, users_router.router, audios_router.router,
                   annotate_router.router, review_router.router, wallet_router.router,
                   reports_router.router, roleplay_router.router, roleplay_router.project_router):
        app.include_router(router, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "app": settings.app_name}


if settings.frontend_dist:
    from app.frontend import FrontendFiles
    app.mount('/', FrontendFiles(directory=settings.frontend_dist, html=True), name='frontend')
