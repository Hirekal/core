from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path

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
from app.services.callback_service import CallbackService
from app.services.downloader_service import DownloaderService
from app.services.ffmpeg_service import FFmpegService
from app.services.pronunciation_service import PronunciationService
from app.services.speechbrain_service import SpeechBrainService
from app.services.whisper_service import WhisperService
from app.utils.temp_directory import cleanup_stale_temp_dirs, ensure_temp_base_dir

logger = get_logger(__name__)


async def run_stale_temp_cleanup(settings: Settings) -> None:
    deleted = await asyncio.to_thread(
        cleanup_stale_temp_dirs,
        Path(settings.temp_base_dir),
        max_age_seconds=settings.stale_temp_max_age_hours * 3600,
    )
    if deleted == 0:
        logger.info("Stale temp cleanup finished | deleted=0")


async def periodic_stale_temp_cleanup(
    settings: Settings,
    stop_event: asyncio.Event,
) -> None:
    interval_seconds = settings.temp_cleanup_interval_hours * 3600
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            await run_stale_temp_cleanup(settings)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    setup_logging(settings)

    ensure_temp_base_dir(Path(settings.temp_base_dir))
    await run_stale_temp_cleanup(settings)

    whisper_service = WhisperService(settings.whisper_model)
    whisper_service.load_model()

    speechbrain_service = SpeechBrainService()
    try:
        speechbrain_service.load_models()
    except Exception:
        logger.exception("SpeechBrain unavailable; transcription will continue without speech metrics")

    pronunciation_service = PronunciationService(model_name=settings.pronunciation_model)
    if settings.pronunciation_enabled:
        try:
            pronunciation_service.load_model()
        except Exception:
            logger.exception(
                "Pronunciation assessment unavailable; transcription will continue without assessment"
            )

    app.state.downloader_service = DownloaderService(settings)
    app.state.ffmpeg_service = FFmpegService(settings)
    app.state.whisper_service = whisper_service
    app.state.speechbrain_service = speechbrain_service
    app.state.pronunciation_service = pronunciation_service
    app.state.callback_service = CallbackService(settings)

    stop_event = asyncio.Event()
    cleanup_task = asyncio.create_task(periodic_stale_temp_cleanup(settings, stop_event))

    logger.info(
        "Media worker started | model=%s speechbrain=%s pronunciation=%s callback_enabled=%s",
        settings.whisper_model,
        speechbrain_service.is_loaded,
        pronunciation_service.is_loaded,
        bool(settings.transcript_callback_url),
    )
    yield

    stop_event.set()
    cleanup_task.cancel()
    with suppress(asyncio.CancelledError):
        await cleanup_task
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
