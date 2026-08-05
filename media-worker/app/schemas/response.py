from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "healthy"


class TranscriptSegment(BaseModel):
    start: float = Field(..., ge=0)
    end: float = Field(..., ge=0)
    text: str


class TranscribeAcceptedResponse(BaseModel):
    """Immediate ack when transcription is accepted for background processing."""

    job_id: str
    status: str = "accepted"


class TranscriptResult(BaseModel):
    language: str
    duration: float = Field(..., ge=0)
    text: str
    segments: list[TranscriptSegment]


class SpeechMetrics(BaseModel):
    language: str | None = None
    language_confidence: float | None = None
    speech_duration: float | None = None
    silence_duration: float | None = None
    speech_ratio: float | None = None
    average_pause_duration: float | None = None
    longest_pause_duration: float | None = None
    speaking_rate: float | None = None


class PhonemeFeedback(BaseModel):
    index: int = Field(..., ge=0)
    expected: str | None = None
    actual: str | None = None
    status: str
    score: float = Field(..., ge=0, le=100)


class WordFeedback(BaseModel):
    word: str
    expected_ipa: str
    actual_ipa: str | None = None
    accuracy_score: float = Field(..., ge=0, le=100)
    status: str
    phoneme_start_index: int = Field(..., ge=0)
    phonemes: list[PhonemeFeedback] = Field(default_factory=list)


class PronunciationAssessment(BaseModel):
    pronunciation_accuracy: float = Field(..., ge=0, le=100)
    prosody_score: float = Field(..., ge=0, le=100)
    fluency_score: float = Field(..., ge=0, le=100)
    completeness_score: float | None = Field(default=None, ge=0, le=100)
    reference_text: str
    asr_transcript: str
    phonemes: list[PhonemeFeedback] = Field(default_factory=list)
    words: list[WordFeedback] = Field(default_factory=list)


class TranscribeResponse(BaseModel):
    """Success payload delivered via callback after background processing."""

    job_id: str
    transcript: TranscriptResult
    speech: SpeechMetrics | None = None
    assessment: PronunciationAssessment | None = None


class TranscribeFailedCallback(BaseModel):
    job_id: str
    status: str = "failed"
    error: str
