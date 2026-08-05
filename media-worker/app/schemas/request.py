from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, Field, HttpUrl


class VideoSource(BaseModel):
    url: HttpUrl = Field(..., description="HTTPS URL to the video file")


class TranscribeRequest(BaseModel):
    job_id: str = Field(..., min_length=1, max_length=255)
    video: VideoSource
    language: Union[Literal["auto"], str] = Field(
        default="auto",
        description='Language code (e.g. "en") or "auto" for detection',
    )
    reference_text: str | None = Field(
        default=None,
        description=(
            "Expected spoken script for pronunciation scoring. "
            "When omitted, the Whisper transcript is used (English only)."
        ),
    )
