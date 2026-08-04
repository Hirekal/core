import asyncio
import time
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import Settings
from app.core.logging import get_logger
from app.schemas.request import TranscribeRequest
from app.schemas.response import (
    TranscribeAcceptedResponse,
    TranscribeFailedCallback,
    TranscribeResponse,
)
from app.services.callback_service import CallbackService
from app.services.downloader_service import DownloaderService
from app.services.ffmpeg_service import FFmpegService
from app.services.whisper_service import WhisperService
from app.utils.temp_directory import ensure_temp_base_dir, temporary_workspace

router = APIRouter(prefix="/transcribe", tags=["transcription"])
logger = get_logger(__name__)


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_downloader_service(request: Request) -> DownloaderService:
    return request.app.state.downloader_service


def get_ffmpeg_service(request: Request) -> FFmpegService:
    return request.app.state.ffmpeg_service


def get_whisper_service(request: Request) -> WhisperService:
    return request.app.state.whisper_service


def get_callback_service(request: Request) -> CallbackService:
    return request.app.state.callback_service


async def _run_transcription_job(
    *,
    payload: TranscribeRequest,
    settings: Settings,
    downloader: DownloaderService,
    ffmpeg: FFmpegService,
    whisper: WhisperService,
    callback: CallbackService,
) -> None:
    started_at = time.perf_counter()
    language = None if payload.language == "auto" else payload.language
    temp_base_dir = ensure_temp_base_dir(Path(settings.temp_base_dir))

    try:
        async with temporary_workspace(temp_base_dir) as workspace:
            video_path = workspace / "input.video"
            audio_path = workspace / "audio.wav"

            await downloader.download(str(payload.video.url), video_path)
            await ffmpeg.extract_audio(video_path, audio_path)
            result = await whisper.transcribe(audio_path, language)

        response = TranscribeResponse(
            job_id=payload.job_id,
            language=result.language,
            duration=result.duration,
            text=result.text,
            segments=result.segments,
        )
        await callback.deliver(response)
    except Exception as exc:
        logger.exception(
            "Background transcription failed | job_id=%s error=%s",
            payload.job_id,
            exc,
        )
        await callback.deliver_failure(
            TranscribeFailedCallback(
                job_id=payload.job_id,
                error=str(exc) or "Transcription failed",
            )
        )
    finally:
        elapsed = time.perf_counter() - started_at
        logger.info(
            "Total execution time | job_id=%s seconds=%.2f",
            payload.job_id,
            elapsed,
        )


@router.post(
    "",
    response_model=TranscribeAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def transcribe(
    payload: TranscribeRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    downloader: Annotated[DownloaderService, Depends(get_downloader_service)],
    ffmpeg: Annotated[FFmpegService, Depends(get_ffmpeg_service)],
    whisper: Annotated[WhisperService, Depends(get_whisper_service)],
    callback: Annotated[CallbackService, Depends(get_callback_service)],
) -> TranscribeAcceptedResponse:
    if not callback.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "TRANSCRIPT_CALLBACK_URL is required; transcription results "
                "are delivered only via callback"
            ),
        )

    logger.info(
        "Request accepted | job_id=%s language=%s",
        payload.job_id,
        payload.language,
    )

    asyncio.create_task(
        _run_transcription_job(
            payload=payload,
            settings=settings,
            downloader=downloader,
            ffmpeg=ffmpeg,
            whisper=whisper,
            callback=callback,
        )
    )

    return TranscribeAcceptedResponse(job_id=payload.job_id)
