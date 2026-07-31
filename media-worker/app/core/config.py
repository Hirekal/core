from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    whisper_model: str = "small"
    log_level: str = "INFO"
    host: str = "0.0.0.0"
    port: int = 8000
    download_timeout_seconds: float = 600.0
    ffmpeg_timeout_seconds: float = 600.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
