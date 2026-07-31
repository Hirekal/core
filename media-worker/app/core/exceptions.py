from __future__ import annotations


class MediaWorkerError(Exception):
    """Base exception for media worker domain errors."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class DownloadError(MediaWorkerError):
    """Raised when a remote file cannot be downloaded."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class InvalidVideoError(MediaWorkerError):
    """Raised when the downloaded file is not a valid video."""


class FFmpegError(MediaWorkerError):
    """Raised when FFmpeg fails to extract audio."""


class WhisperError(MediaWorkerError):
    """Raised when transcription fails."""
