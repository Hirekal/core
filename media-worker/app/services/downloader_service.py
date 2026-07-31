from pathlib import Path

import httpx

from app.core.config import Settings
from app.core.exceptions import DownloadError
from app.core.logging import get_logger

logger = get_logger(__name__)


class DownloaderService:
    """Downloads remote video files over HTTPS using streaming I/O."""

    def __init__(self, settings: Settings) -> None:
        self._timeout = settings.download_timeout_seconds

    async def download(self, url: str, destination: Path) -> Path:
        logger.info("Download started | url=%s destination=%s", url, destination)

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self._timeout),
                follow_redirects=True,
            ) as client:
                async with client.stream("GET", url) as response:
                    if response.status_code == httpx.codes.NOT_FOUND:
                        raise DownloadError(
                            "Unable to download file: resource not found",
                            status_code=404,
                        )

                    if response.is_client_error:
                        raise DownloadError(
                            f"Unable to download file: HTTP {response.status_code}",
                            status_code=400,
                        )

                    if response.is_server_error:
                        raise DownloadError(
                            f"Unable to download file: upstream HTTP {response.status_code}",
                            status_code=404,
                        )

                    response.raise_for_status()

                    with destination.open("wb") as file_handle:
                        async for chunk in response.aiter_bytes(chunk_size=1024 * 1024):
                            if chunk:
                                file_handle.write(chunk)

        except httpx.RequestError as exc:
            logger.exception("Download failed | url=%s", url)
            raise DownloadError(f"Unable to download file: {exc}") from exc
        except DownloadError:
            raise
        except httpx.HTTPStatusError as exc:
            logger.exception("Download failed | url=%s", url)
            if exc.response.status_code == httpx.codes.NOT_FOUND:
                raise DownloadError(
                    "Unable to download file: resource not found",
                    status_code=404,
                ) from exc
            raise DownloadError(
                f"Unable to download file: HTTP {exc.response.status_code}",
                status_code=400,
            ) from exc

        if not destination.exists() or destination.stat().st_size == 0:
            raise DownloadError("Download completed but file is empty", status_code=422)

        logger.info(
            "Download completed | destination=%s size_bytes=%d",
            destination,
            destination.stat().st_size,
        )
        return destination
