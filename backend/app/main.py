from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.routers import annotate as annotate_router
from app.routers import audios as audios_router
from app.routers import auth as auth_router
from app.routers import projects as projects_router
from app.routers import reports as reports_router
from app.routers import review as review_router
from app.routers import roleplay as roleplay_router
from app.routers import users as users_router
from app.routers import wallet as wallet_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(projects_router.router, prefix="/api")
app.include_router(users_router.router, prefix="/api")
app.include_router(audios_router.router, prefix="/api")
app.include_router(annotate_router.router, prefix="/api")
app.include_router(review_router.router, prefix="/api")
app.include_router(wallet_router.router, prefix="/api")
app.include_router(reports_router.router, prefix="/api")
app.include_router(roleplay_router.router, prefix="/api")
app.include_router(roleplay_router.project_router, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "app": settings.app_name}
