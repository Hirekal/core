import time
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.logging import get_logger
from app.schemas.request import TranscribeRequest
from app.schemas.response import TranscribeResponse
from app.services.downloader_service import DownloaderService
from app.services.ffmpeg_service import FFmpegService
from app.services.whisper_service import WhisperService
from app.utils.temp_directory import temporary_workspace

router = APIRouter(prefix="/transcribe", tags=["transcription"])
logger = get_logger(__name__)


def get_downloader_service(request: Request) -> DownloaderService:
    return request.app.state.downloader_service


def get_ffmpeg_service(request: Request) -> FFmpegService:
    return request.app.state.ffmpeg_service


def get_whisper_service(request: Request) -> WhisperService:
    return request.app.state.whisper_service


@router.post("", response_model=TranscribeResponse)
async def transcribe(
    payload: TranscribeRequest,
    downloader: Annotated[DownloaderService, Depends(get_downloader_service)],
    ffmpeg: Annotated[FFmpegService, Depends(get_ffmpeg_service)],
    whisper: Annotated[WhisperService, Depends(get_whisper_service)],
) -> TranscribeResponse:
    started_at = time.perf_counter()
    language = None if payload.language == "auto" else payload.language

    logger.info("Request started | job_id=%s language=%s", payload.job_id, payload.language)

    async with temporary_workspace() as workspace:
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

    elapsed = time.perf_counter() - started_at
    logger.info(
        "Total execution time | job_id=%s seconds=%.2f",
        payload.job_id,
        elapsed,
    )

    return response
