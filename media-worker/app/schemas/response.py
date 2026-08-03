from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "healthy"


class TranscriptSegment(BaseModel):
    start: float = Field(..., ge=0)
    end: float = Field(..., ge=0)
    text: str


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


class TranscribeResponse(BaseModel):
    job_id: str
    transcript: TranscriptResult
    speech: SpeechMetrics | None = None
