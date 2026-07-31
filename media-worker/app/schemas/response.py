from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "healthy"


class TranscriptSegment(BaseModel):
    start: float = Field(..., ge=0)
    end: float = Field(..., ge=0)
    text: str


class TranscribeResponse(BaseModel):
    job_id: str
    language: str
    duration: float = Field(..., ge=0)
    text: str
    segments: list[TranscriptSegment]
