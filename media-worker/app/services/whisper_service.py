from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path

from faster_whisper import WhisperModel

from app.core.exceptions import WhisperError
from app.core.logging import get_logger
from app.schemas.response import TranscriptSegment

logger = get_logger(__name__)


@dataclass(frozen=True)
class TranscriptionResult:
    language: str
    duration: float
    text: str
    segments: list[TranscriptSegment]


class WhisperService:
    """Wraps Faster Whisper for speech-to-text transcription."""

    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model: WhisperModel | None = None

    def load_model(self) -> None:
        if self._model is not None:
            return

        logger.info("Loading Faster Whisper model | model=%s", self._model_name)
        self._model = WhisperModel(self._model_name, device="cpu", compute_type="int8")
        logger.info("Faster Whisper model loaded | model=%s", self._model_name)

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    async def transcribe(self, audio_path: Path, language: str | None) -> TranscriptionResult:
        if self._model is None:
            raise WhisperError("Whisper model is not loaded")

        logger.info("Transcription started | audio=%s language=%s", audio_path, language or "auto")

        try:
            result = await asyncio.to_thread(self._transcribe_sync, audio_path, language)
        except Exception as exc:
            logger.exception("Transcription failed | audio=%s", audio_path)
            raise WhisperError(f"Whisper transcription failed: {exc}") from exc

        logger.info(
            "Transcription completed | language=%s duration=%.2f segments=%d",
            result.language,
            result.duration,
            len(result.segments),
        )
        return result

    def _transcribe_sync(self, audio_path: Path, language: str | None) -> TranscriptionResult:
        assert self._model is not None

        segments_iter, info = self._model.transcribe(
            str(audio_path),
            language=language,
            beam_size=5,
            vad_filter=True,
        )

        segments: list[TranscriptSegment] = []
        transcript_parts: list[str] = []

        for segment in segments_iter:
            text = segment.text.strip()
            if not text:
                continue

            segments.append(
                TranscriptSegment(
                    start=round(segment.start, 2),
                    end=round(segment.end, 2),
                    text=text,
                )
            )
            transcript_parts.append(text)

        duration = round(info.duration or 0.0, 2)
        if duration == 0.0 and segments:
            duration = round(segments[-1].end, 2)

        return TranscriptionResult(
            language=info.language or language or "unknown",
            duration=duration,
            text=" ".join(transcript_parts).strip(),
            segments=segments,
        )
