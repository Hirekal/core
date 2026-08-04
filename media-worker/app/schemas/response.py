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


class TranscribeResponse(BaseModel):
    job_id: str
    language: str
    duration: float = Field(..., ge=0)
    text: str
    segments: list[TranscriptSegment]
    status: str = "completed"


class TranscribeFailedCallback(BaseModel):
    job_id: str
    status: str = "failed"
    error: str
