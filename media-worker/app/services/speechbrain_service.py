from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, fields
from pathlib import Path

import torch

from app.core.logging import get_logger

logger = get_logger(__name__)

LANG_ID_MODEL = "speechbrain/lang-id-voxlingua107-ecapa"
VAD_MODEL = "speechbrain/vad-crdnn-libriparty"
MODEL_DIR = Path("/tmp/speechbrain-models")


@dataclass(frozen=True)
class SpeechAnalysisResult:
    language: str | None = None
    language_confidence: float | None = None
    speech_duration: float | None = None
    silence_duration: float | None = None
    speech_ratio: float | None = None
    average_pause_duration: float | None = None
    longest_pause_duration: float | None = None
    speaking_rate: float | None = None

    def to_dict(self) -> dict[str, float | str]:
        return {
            field.name: getattr(self, field.name)
            for field in fields(self)
            if getattr(self, field.name) is not None
        }


class SpeechBrainService:
    """SpeechBrain inference for language identification and VAD-based metrics."""

    def __init__(self, model_dir: Path = MODEL_DIR) -> None:
        self._model_dir = model_dir
        self._language_classifier = None
        self._vad = None
        self._load_error: str | None = None

    @property
    def is_loaded(self) -> bool:
        return self._language_classifier is not None and self._vad is not None

    def load_models(self) -> None:
        if self.is_loaded:
            return

        logger.info("Loading SpeechBrain models")
        self._model_dir.mkdir(parents=True, exist_ok=True)

        try:
            from speechbrain.inference.VAD import VAD
            from speechbrain.inference.classifiers import EncoderClassifier
        except ImportError as exc:
            self._load_error = str(exc)
            logger.exception("SpeechBrain import failed")
            raise

        try:
            self._language_classifier = EncoderClassifier.from_hparams(
                source=LANG_ID_MODEL,
                savedir=str(self._model_dir / "lang-id"),
            )
            self._vad = VAD.from_hparams(
                source=VAD_MODEL,
                savedir=str(self._model_dir / "vad"),
            )
        except Exception as exc:
            self._language_classifier = None
            self._vad = None
            self._load_error = str(exc)
            logger.exception("SpeechBrain model loading failed")
            raise

        logger.info("SpeechBrain models loaded")

    async def analyze(
        self,
        audio_path: Path,
        *,
        transcript_text: str,
        audio_duration: float,
        whisper_language: str | None = None,
    ) -> SpeechAnalysisResult | None:
        if not self.is_loaded:
            logger.warning(
                "SpeechBrain analysis skipped | loaded=%s error=%s",
                self.is_loaded,
                self._load_error,
            )
            return None

        logger.info("SpeechBrain analysis started | audio=%s", audio_path)

        try:
            result = await asyncio.to_thread(
                self._analyze_sync,
                audio_path,
                transcript_text,
                audio_duration,
                whisper_language,
            )
        except Exception:
            logger.exception("SpeechBrain analysis failed | audio=%s", audio_path)
            return None

        logger.info(
            "SpeechBrain analysis completed | audio=%s metrics=%s",
            audio_path,
            list(result.to_dict().keys()),
        )
        return result

    def _analyze_sync(
        self,
        audio_path: Path,
        transcript_text: str,
        audio_duration: float,
        whisper_language: str | None = None,
    ) -> SpeechAnalysisResult:
        metrics: dict[str, float | str] = {}

        if whisper_language:
            metrics["language"] = whisper_language.strip().lower()
            metrics["language_confidence"] = None

        try:
            lang_metrics = self._language_metrics(audio_path)
            if whisper_language:
                lang_metrics.pop("language", None)
                if lang_metrics.get("language_confidence") is not None:
                    metrics["language_confidence"] = lang_metrics["language_confidence"]
            else:
                metrics.update(lang_metrics)
        except Exception:
            logger.exception("SpeechBrain language identification failed | audio=%s", audio_path)

        try:
            metrics.update(self._vad_metrics(audio_path, audio_duration))
        except Exception:
            logger.exception("SpeechBrain VAD analysis failed | audio=%s", audio_path)

        metrics.update(self._speaking_rate(transcript_text, metrics.get("speech_duration")))

        return SpeechAnalysisResult(**metrics)

    def _language_metrics(self, audio_path: Path) -> dict[str, float | str]:
        assert self._language_classifier is not None

        out_prob, _score, _index, text_lab = self._language_classifier.classify_file(
            str(audio_path),
        )
        confidence = float(torch.max(torch.softmax(out_prob, dim=-1)).item())
        language = _parse_language_label(str(text_lab))

        return {
            "language": language,
            "language_confidence": round(confidence, 4),
        }

    def _vad_metrics(self, audio_path: Path, audio_duration: float) -> dict[str, float]:
        assert self._vad is not None

        boundaries = self._vad.get_speech_segments(str(audio_path))
        if boundaries is None or len(boundaries) == 0:
            return {}

        segments = [
            (float(start), float(end))
            for start, end in boundaries.detach().cpu().tolist()
            if float(end) > float(start)
        ]
        if not segments:
            return {}

        total_duration = audio_duration if audio_duration > 0 else segments[-1][1]
        if total_duration <= 0:
            return {}

        segments.sort(key=lambda item: item[0])
        speech_duration = sum(end - start for start, end in segments)
        silence_duration = max(total_duration - speech_duration, 0.0)
        speech_ratio = (speech_duration / total_duration) * 100 if total_duration > 0 else 0.0

        pauses: list[float] = []
        if segments[0][0] > 0:
            pauses.append(segments[0][0])

        for index in range(1, len(segments)):
            gap = segments[index][0] - segments[index - 1][1]
            if gap > 0:
                pauses.append(gap)

        trailing = total_duration - segments[-1][1]
        if trailing > 0:
            pauses.append(trailing)

        metrics: dict[str, float] = {
            "speech_duration": round(speech_duration, 2),
            "silence_duration": round(silence_duration, 2),
            "speech_ratio": round(speech_ratio, 2),
        }

        if pauses:
            metrics["average_pause_duration"] = round(sum(pauses) / len(pauses), 2)
            metrics["longest_pause_duration"] = round(max(pauses), 2)

        return metrics

    @staticmethod
    def _speaking_rate(
        transcript_text: str,
        speech_duration: float | str | None,
    ) -> dict[str, float]:
        if speech_duration is None or not isinstance(speech_duration, (int, float)):
            return {}

        duration = float(speech_duration)
        if duration <= 0:
            return {}

        words = [word for word in re.split(r"\s+", transcript_text.strip()) if word]
        if not words:
            return {}

        words_per_minute = len(words) / (duration / 60)
        return {"speaking_rate": round(words_per_minute, 2)}


def _parse_language_label(text_lab: str) -> str:
    match = re.search(r"([a-z]{2,3})\s*:", text_lab, re.IGNORECASE)
    if match:
        return match.group(1).lower()

    match = re.search(r"['\"]?([a-z]{2,3})['\"]?", text_lab, re.IGNORECASE)
    if match:
        return match.group(1).lower()

    if ":" in text_lab:
        return text_lab.split(":", 1)[0].strip().strip("[]'\"").lower()

    return text_lab.strip().strip("[]'\"").lower()
