from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.bootstrap import bootstrap
from app.config import get_settings
from app.db import get_sessionmaker
from app.observability import configure_logging, request_context_middleware
from app.routes import health, logout, oidc, userinfo


def create_app(run_bootstrap: bool = True) -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if run_bootstrap:
            configure_logging()
            with get_sessionmaker()() as db:
                bootstrap(db, settings)
        yield

    is_prod = settings.environment == "production"
    app = FastAPI(
        title="Identity Service",
        lifespan=lifespan,
        docs_url=None if is_prod else "/docs",
        redoc_url=None,
        openapi_url=None if is_prod else "/openapi.json",
    )
    app.middleware("http")(request_context_middleware(hsts=settings.secure_cookies))
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="identity_flow",
        max_age=600,
        same_site="lax",
        https_only=settings.secure_cookies,
    )
    app.include_router(health.router)
    app.include_router(oidc.router)
    app.include_router(userinfo.router)
    app.include_router(logout.router)
    return app
