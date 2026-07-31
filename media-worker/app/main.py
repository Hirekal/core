from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.transcription import router as transcription_router
from app.core.config import Settings, get_settings
from app.core.exceptions import (
    DownloadError,
    FFmpegError,
    InvalidVideoError,
    WhisperError,
)
from app.core.logging import get_logger, setup_logging
from app.services.downloader_service import DownloaderService
from app.services.ffmpeg_service import FFmpegService
from app.services.whisper_service import WhisperService

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    setup_logging(settings)

    whisper_service = WhisperService(settings.whisper_model)
    whisper_service.load_model()

    app.state.downloader_service = DownloaderService(settings)
    app.state.ffmpeg_service = FFmpegService(settings)
    app.state.whisper_service = whisper_service

    logger.info("Media worker started | model=%s", settings.whisper_model)
    yield
    logger.info("Media worker shutting down")


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    setup_logging(app_settings)

    app = FastAPI(
        title="Media Worker",
        description="Stateless video transcription worker using FFmpeg and Faster Whisper.",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.settings = app_settings

    app.include_router(health_router)
    app.include_router(transcription_router)

    register_exception_handlers(app)
    return app


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        logger.warning("Invalid request | path=%s errors=%s", request.url.path, exc.errors())
        return JSONResponse(
            status_code=400,
            content={"detail": "Invalid request", "errors": exc.errors()},
        )

    @app.exception_handler(DownloadError)
    async def download_exception_handler(
        request: Request,
        exc: DownloadError,
    ) -> JSONResponse:
        logger.error("Download error | path=%s message=%s", request.url.path, exc.message)
        status_code = exc.status_code or 404
        return JSONResponse(status_code=status_code, content={"detail": exc.message})

    @app.exception_handler(InvalidVideoError)
    async def invalid_video_exception_handler(
        request: Request,
        exc: InvalidVideoError,
    ) -> JSONResponse:
        logger.error("Invalid video | path=%s message=%s", request.url.path, exc.message)
        return JSONResponse(status_code=422, content={"detail": exc.message})

    @app.exception_handler(FFmpegError)
    async def ffmpeg_exception_handler(
        request: Request,
        exc: FFmpegError,
    ) -> JSONResponse:
        logger.error("FFmpeg error | path=%s message=%s", request.url.path, exc.message)
        return JSONResponse(status_code=500, content={"detail": exc.message})

    @app.exception_handler(WhisperError)
    async def whisper_exception_handler(
        request: Request,
        exc: WhisperError,
    ) -> JSONResponse:
        logger.error("Whisper error | path=%s message=%s", request.url.path, exc.message)
        return JSONResponse(status_code=500, content={"detail": exc.message})


app = create_app()
