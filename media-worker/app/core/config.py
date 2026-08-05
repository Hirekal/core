from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    whisper_model: str = "small"
    log_level: str = "INFO"
    host: str = "0.0.0.0"
    port: int = 8000
    download_timeout_seconds: float = 600.0
    ffmpeg_timeout_seconds: float = 600.0
    temp_base_dir: str = "/tmp/media-worker"
    stale_temp_max_age_hours: float = 6.0
    temp_cleanup_interval_hours: float = 1.0
    transcript_callback_url: Optional[str] = None
    transcript_callback_timeout_seconds: float = 30.0
    pronunciation_model: str = "facebook/wav2vec2-base-960h"
    pronunciation_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
