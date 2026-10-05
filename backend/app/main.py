from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.logging_config import configure_logging
from app.rooms.router import router as rooms_router


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    app = FastAPI(title="우리지금만나 API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.api_route("/health", methods=["GET", "HEAD"])
    def health() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(rooms_router)

    return app


app = create_app()
