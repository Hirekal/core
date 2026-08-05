from __future__ import annotations

import asyncio
import difflib
import re
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Literal

import eng_to_ipa as ipa
import librosa
import numpy as np
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

from app.core.logging import get_logger

logger = get_logger(__name__)

MODEL_DIR = Path("/tmp/pronunciation-models")
PhonemeStatus = Literal["correct", "mispronounced", "omitted", "inserted"]
WordStatus = Literal["correct", "mispronounced", "omitted", "partial"]

_WORD_PATTERN = re.compile(r"\b[\w']+\b")


@dataclass(frozen=True)
class PhonemeFeedback:
    index: int
    expected: str | None
    actual: str | None
    status: PhonemeStatus
    score: float

    def to_dict(self) -> dict:
        return {field.name: getattr(self, field.name) for field in fields(self)}


@dataclass(frozen=True)
class WordFeedback:
    word: str
    expected_ipa: str
    actual_ipa: str | None
    accuracy_score: float
    status: WordStatus
    phoneme_start_index: int
    phonemes: list[PhonemeFeedback]

    def to_dict(self) -> dict:
        payload = {field.name: getattr(self, field.name) for field in fields(self) if field.name != "phonemes"}
        payload["phonemes"] = [item.to_dict() for item in self.phonemes]
        return payload


@dataclass(frozen=True)
class PronunciationAssessment:
    pronunciation_accuracy: float
    prosody_score: float
    fluency_score: float
    completeness_score: float | None
    reference_text: str
    asr_transcript: str
    phonemes: list[PhonemeFeedback]
    words: list[WordFeedback]

    def to_dict(self) -> dict:
        return {
            "pronunciation_accuracy": self.pronunciation_accuracy,
            "prosody_score": self.prosody_score,
            "fluency_score": self.fluency_score,
            "completeness_score": self.completeness_score,
            "reference_text": self.reference_text,
            "asr_transcript": self.asr_transcript,
            "phonemes": [item.to_dict() for item in self.phonemes],
            "words": [item.to_dict() for item in self.words],
        }


class PronunciationService:
    """English pronunciation assessment using wav2vec2 CTC + IPA alignment (CPU)."""

    def __init__(
        self,
        model_name: str = "facebook/wav2vec2-base-960h",
        model_dir: Path = MODEL_DIR,
    ) -> None:
        self._model_name = model_name
        self._model_dir = model_dir
        self._processor: Wav2Vec2Processor | None = None
        self._model: Wav2Vec2ForCTC | None = None
        self._load_error: str | None = None

    @property
    def is_loaded(self) -> bool:
        return self._processor is not None and self._model is not None

    def load_model(self) -> None:
        if self.is_loaded:
            return

        logger.info("Loading pronunciation model | model=%s", self._model_name)
        self._model_dir.mkdir(parents=True, exist_ok=True)

        try:
            self._processor = Wav2Vec2Processor.from_pretrained(
                self._model_name,
                cache_dir=str(self._model_dir),
            )
            self._model = Wav2Vec2ForCTC.from_pretrained(
                self._model_name,
                cache_dir=str(self._model_dir),
            )
            self._model.eval()
        except Exception as exc:
            self._processor = None
            self._model = None
            self._load_error = str(exc)
            logger.exception("Pronunciation model loading failed")
            raise

        logger.info("Pronunciation model loaded | model=%s", self._model_name)

    async def assess(
        self,
        audio_path: Path,
        *,
        reference_text: str,
        transcript_text: str,
        language: str,
        speech_duration: float | None = None,
        silence_duration: float | None = None,
        speech_ratio: float | None = None,
        average_pause_duration: float | None = None,
        longest_pause_duration: float | None = None,
        speaking_rate: float | None = None,
    ) -> PronunciationAssessment | None:
        if not self.is_loaded:
            logger.warning(
                "Pronunciation assessment skipped | loaded=%s error=%s",
                self.is_loaded,
                self._load_error,
            )
            return None

        if not _is_english(language):
            logger.info(
                "Pronunciation assessment skipped | language=%s (English only)",
                language,
            )
            return None

        reference_text = reference_text.strip()
        if not reference_text:
            logger.info("Pronunciation assessment skipped | empty reference text")
            return None

        logger.info("Pronunciation assessment started | audio=%s", audio_path)

        try:
            result = await asyncio.to_thread(
                self._assess_sync,
                audio_path,
                reference_text,
                transcript_text,
                speech_duration,
                silence_duration,
                speech_ratio,
                average_pause_duration,
                longest_pause_duration,
                speaking_rate,
            )
        except Exception:
            logger.exception("Pronunciation assessment failed | audio=%s", audio_path)
            return None

        logger.info(
            "Pronunciation assessment completed | audio=%s accuracy=%.2f prosody=%.2f fluency=%.2f",
            audio_path,
            result.pronunciation_accuracy,
            result.prosody_score,
            result.fluency_score,
        )
        return result

    def _assess_sync(
        self,
        audio_path: Path,
        reference_text: str,
        transcript_text: str,
        speech_duration: float | None,
        silence_duration: float | None,
        speech_ratio: float | None,
        average_pause_duration: float | None,
        longest_pause_duration: float | None,
        speaking_rate: float | None,
    ) -> PronunciationAssessment:
        waveform, sample_rate = librosa.load(str(audio_path), sr=16000, mono=True)
        asr_transcript = self._transcribe(waveform)

        expected_tokens, word_spans = _text_to_word_phoneme_tokens(reference_text)
        actual_tokens, _ = _text_to_word_phoneme_tokens(asr_transcript)

        phonemes, words = _align_phoneme_feedback(expected_tokens, actual_tokens, word_spans)
        pronunciation_accuracy = _phoneme_accuracy_score(expected_tokens, actual_tokens)
        prosody_score = _score_prosody(waveform, sample_rate)
        fluency_score = _score_fluency(
            speech_duration=speech_duration,
            silence_duration=silence_duration,
            speech_ratio=speech_ratio,
            average_pause_duration=average_pause_duration,
            longest_pause_duration=longest_pause_duration,
            speaking_rate=speaking_rate,
        )
        completeness_score = _score_completeness(reference_text, transcript_text)

        return PronunciationAssessment(
            pronunciation_accuracy=pronunciation_accuracy,
            prosody_score=prosody_score,
            fluency_score=fluency_score,
            completeness_score=completeness_score,
            reference_text=reference_text,
            asr_transcript=asr_transcript,
            phonemes=phonemes,
            words=words,
        )

    def _transcribe(self, waveform: np.ndarray) -> str:
        assert self._processor is not None
        assert self._model is not None

        inputs = self._processor(
            waveform,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True,
        )

        with torch.no_grad():
            logits = self._model(inputs.input_values).logits
            predicted_ids = torch.argmax(logits, dim=-1)

        decoded = self._processor.batch_decode(predicted_ids)[0]
        return _clean_transcript(decoded)


def _is_english(language: str) -> bool:
    normalized = language.strip().lower()
    return normalized in {"en", "english"} or normalized.startswith("en-")


def _clean_transcript(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z' ]+", " ", text.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _word_to_ipa(word: str) -> str:
    converted = ipa.convert(word).replace("*", "").strip()
    return converted


def _text_to_word_phoneme_tokens(text: str) -> tuple[list[str], list[tuple[str, str, int, int]]]:
    words = _WORD_PATTERN.findall(text.lower())
    tokens: list[str] = []
    spans: list[tuple[str, str, int, int]] = []

    for word in words:
        word_ipa = _word_to_ipa(word)
        word_tokens = list(word_ipa.replace(" ", ""))
        start = len(tokens)
        tokens.extend(word_tokens)
        spans.append((word, word_ipa, start, len(tokens)))

    return tokens, spans


def _align_phoneme_feedback(
    expected_tokens: list[str],
    actual_tokens: list[str],
    word_spans: list[tuple[str, str, int, int]],
) -> tuple[list[PhonemeFeedback], list[WordFeedback]]:
    matcher = difflib.SequenceMatcher(None, expected_tokens, actual_tokens, autojunk=False)
    phonemes: list[PhonemeFeedback] = []
    expected_index_to_phoneme: dict[int, PhonemeFeedback] = {}

    phoneme_index = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for expected_idx, actual_idx in zip(range(i1, i2), range(j1, j2)):
                feedback = PhonemeFeedback(
                    index=phoneme_index,
                    expected=expected_tokens[expected_idx],
                    actual=actual_tokens[actual_idx],
                    status="correct",
                    score=100.0,
                )
                phonemes.append(feedback)
                expected_index_to_phoneme[expected_idx] = feedback
                phoneme_index += 1
        elif tag == "replace":
            expected_slice = expected_tokens[i1:i2]
            actual_slice = actual_tokens[j1:j2]
            pair_count = max(len(expected_slice), len(actual_slice), 1)
            for pair_offset in range(pair_count):
                expected = expected_slice[pair_offset] if pair_offset < len(expected_slice) else None
                actual = actual_slice[pair_offset] if pair_offset < len(actual_slice) else None
                if expected is not None and actual is not None:
                    status: PhonemeStatus = "correct" if expected == actual else "mispronounced"
                    score = 100.0 if expected == actual else 0.0
                elif expected is not None:
                    status = "omitted"
                    score = 0.0
                else:
                    status = "inserted"
                    score = 0.0
                feedback = PhonemeFeedback(
                    index=phoneme_index,
                    expected=expected,
                    actual=actual,
                    status=status,
                    score=score,
                )
                phonemes.append(feedback)
                if expected is not None:
                    expected_index_to_phoneme[i1 + pair_offset] = feedback
                phoneme_index += 1
        elif tag == "delete":
            for expected_idx in range(i1, i2):
                feedback = PhonemeFeedback(
                    index=phoneme_index,
                    expected=expected_tokens[expected_idx],
                    actual=None,
                    status="omitted",
                    score=0.0,
                )
                phonemes.append(feedback)
                expected_index_to_phoneme[expected_idx] = feedback
                phoneme_index += 1
        elif tag == "insert":
            for actual_idx in range(j1, j2):
                phonemes.append(
                    PhonemeFeedback(
                        index=phoneme_index,
                        expected=None,
                        actual=actual_tokens[actual_idx],
                        status="inserted",
                        score=0.0,
                    )
                )
                phoneme_index += 1

    words: list[WordFeedback] = []
    for word, expected_ipa, start, end in word_spans:
        word_phonemes = [
            expected_index_to_phoneme[idx]
            for idx in range(start, end)
            if idx in expected_index_to_phoneme
        ]
        actual_ipa = "".join(
            item.actual for item in word_phonemes if item.actual is not None
        ) or None

        if word_phonemes:
            accuracy_score = round(sum(item.score for item in word_phonemes) / len(word_phonemes), 2)
        else:
            accuracy_score = 0.0

        if accuracy_score >= 90:
            word_status: WordStatus = "correct"
        elif accuracy_score <= 0:
            word_status = "omitted"
        elif accuracy_score < 60:
            word_status = "mispronounced"
        else:
            word_status = "partial"

        words.append(
            WordFeedback(
                word=word,
                expected_ipa=expected_ipa,
                actual_ipa=actual_ipa,
                accuracy_score=accuracy_score,
                status=word_status,
                phoneme_start_index=start,
                phonemes=word_phonemes,
            )
        )

    return phonemes, words


def _phoneme_accuracy_score(expected_tokens: list[str], actual_tokens: list[str]) -> float:
    if not expected_tokens:
        return 0.0

    matcher = difflib.SequenceMatcher(None, expected_tokens, actual_tokens, autojunk=False)
    matches = sum(block.size for block in matcher.get_matching_blocks())
    return round((matches / len(expected_tokens)) * 100, 2)


def _score_prosody(waveform: np.ndarray, sample_rate: int) -> float:
    f0 = librosa.yin(waveform, fmin=50, fmax=400, sr=sample_rate)
    voiced = f0[np.isfinite(f0) & (f0 > 0)]

    energy = librosa.feature.rms(y=waveform)[0]
    if voiced.size < 5 or energy.size == 0:
        return 50.0

    f0_std = float(np.std(voiced))
    f0_range = float(np.ptp(voiced))
    energy_std = float(np.std(energy))

    variation_score = _clamp((f0_std / 45.0) * 100, 0, 100)
    if f0_std < 8:
        variation_score *= 0.5
    if f0_std > 120:
        variation_score = max(0.0, variation_score - 25)

    range_score = _clamp((f0_range / 120.0) * 100, 0, 100)
    energy_score = _clamp((energy_std / 0.04) * 100, 0, 100)

    return round(0.45 * variation_score + 0.25 * range_score + 0.30 * energy_score, 2)


def _score_fluency(
    *,
    speech_duration: float | None,
    silence_duration: float | None,
    speech_ratio: float | None,
    average_pause_duration: float | None,
    longest_pause_duration: float | None,
    speaking_rate: float | None,
) -> float:
    scores: list[float] = []

    if speaking_rate is not None:
        ideal = 145.0
        rate_score = max(0.0, 100.0 - (abs(speaking_rate - ideal) / ideal) * 100)
        scores.append(rate_score)

    if average_pause_duration is not None:
        if average_pause_duration <= 1.0:
            pause_score = 100.0
        elif average_pause_duration <= 2.0:
            pause_score = 100.0 - ((average_pause_duration - 1.0) * 35)
        else:
            pause_score = max(0.0, 30.0 - (average_pause_duration - 2.0) * 10)
        scores.append(pause_score)

    if longest_pause_duration is not None:
        longest_score = 100.0 if longest_pause_duration <= 1.5 else max(0.0, 100.0 - (longest_pause_duration - 1.5) * 25)
        scores.append(longest_score)

    if speech_ratio is not None:
        scores.append(_clamp(speech_ratio, 0, 100))

    if speech_duration is not None and silence_duration is not None:
        total = speech_duration + silence_duration
        if total > 0:
            balance = (speech_duration / total) * 100
            scores.append(_clamp(balance, 0, 100))

    if not scores:
        return 50.0

    return round(sum(scores) / len(scores), 2)


def _score_completeness(reference_text: str, transcript_text: str) -> float | None:
    reference_words = _WORD_PATTERN.findall(reference_text.lower())
    transcript_words = _WORD_PATTERN.findall(transcript_text.lower())
    if not reference_words:
        return None

    transcript_set = set(transcript_words)
    matched = sum(1 for word in reference_words if word in transcript_set)
    return round((matched / len(reference_words)) * 100, 2)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))
