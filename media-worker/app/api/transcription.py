import asyncio
import time
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.config import Settings
from app.core.logging import get_logger
from app.schemas.request import TranscribeRequest
from app.schemas.response import SpeechMetrics, TranscribeResponse, TranscriptResult
from app.services.callback_service import CallbackService
from app.services.downloader_service import DownloaderService
from app.services.ffmpeg_service import FFmpegService
from app.services.speechbrain_service import SpeechBrainService
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


def get_speechbrain_service(request: Request) -> SpeechBrainService:
    return request.app.state.speechbrain_service


def get_callback_service(request: Request) -> CallbackService:
    return request.app.state.callback_service


@router.post("", response_model=TranscribeResponse, response_model_exclude_none=True)
async def transcribe(
    payload: TranscribeRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    downloader: Annotated[DownloaderService, Depends(get_downloader_service)],
    ffmpeg: Annotated[FFmpegService, Depends(get_ffmpeg_service)],
    whisper: Annotated[WhisperService, Depends(get_whisper_service)],
    speechbrain: Annotated[SpeechBrainService, Depends(get_speechbrain_service)],
    callback: Annotated[CallbackService, Depends(get_callback_service)],
) -> TranscribeResponse:
    started_at = time.perf_counter()
    language = None if payload.language == "auto" else payload.language
    temp_base_dir = ensure_temp_base_dir(Path(settings.temp_base_dir))

    logger.info("Request started | job_id=%s language=%s", payload.job_id, payload.language)

    async with temporary_workspace(temp_base_dir) as workspace:
        video_path = workspace / "input.video"
        audio_path = workspace / "audio.wav"

        await downloader.download(str(payload.video.url), video_path)
        await ffmpeg.extract_audio(video_path, audio_path)
        result = await whisper.transcribe(audio_path, language)
        speech_result = await speechbrain.analyze(
            audio_path,
            transcript_text=result.text,
            audio_duration=result.duration,
        )

    transcript = TranscriptResult(
        language=result.language,
        duration=result.duration,
        text=result.text,
        segments=result.segments,
    )
    speech = (
        SpeechMetrics(**speech_result.to_dict())
        if speech_result is not None and speech_result.to_dict()
        else None
    )

    response = TranscribeResponse(
        job_id=payload.job_id,
        transcript=transcript,
        speech=speech,
    )

    if callback.is_enabled:
        await callback.deliver(response)

    elapsed = time.perf_counter() - started_at
    logger.info(
        "Total execution time | job_id=%s seconds=%.2f",
        payload.job_id,
        elapsed,
    )

    return response
