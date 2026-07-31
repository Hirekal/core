import asyncio
from pathlib import Path

from app.core.config import Settings
from app.core.exceptions import FFmpegError, InvalidVideoError
from app.core.logging import get_logger

logger = get_logger(__name__)


class FFmpegService:
    """Extracts mono 16 kHz PCM WAV audio from video files using FFmpeg."""

    def __init__(self, settings: Settings) -> None:
        self._timeout = settings.ffmpeg_timeout_seconds

    async def extract_audio(self, video_path: Path, audio_path: Path) -> Path:
        if not video_path.exists() or video_path.stat().st_size == 0:
            raise InvalidVideoError("Video file is missing or empty")

        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ac",
            "1",
            "-ar",
            "16000",
            str(audio_path),
        ]

        logger.info("FFmpeg started | input=%s output=%s", video_path, audio_path)

        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self._timeout,
            )
        except asyncio.TimeoutError as exc:
            raise FFmpegError("FFmpeg timed out while extracting audio") from exc
        except FileNotFoundError as exc:
            raise FFmpegError("FFmpeg binary is not installed or not on PATH") from exc

        if process.returncode != 0:
            error_output = stderr.decode("utf-8", errors="replace").strip()
            logger.error("FFmpeg failed | returncode=%s stderr=%s", process.returncode, error_output)

            if "Invalid data found when processing input" in error_output:
                raise InvalidVideoError("Invalid or unsupported video file")

            raise FFmpegError(error_output or "FFmpeg failed to extract audio")

        if not audio_path.exists() or audio_path.stat().st_size == 0:
            raise InvalidVideoError("FFmpeg produced an empty audio file")

        logger.info("FFmpeg completed | output=%s", audio_path)
        return audio_path
