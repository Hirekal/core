import httpx

from app.core.config import Settings
from app.core.logging import get_logger
from app.schemas.response import TranscribeResponse

logger = get_logger(__name__)


class CallbackService:
    """POSTs completed transcript payloads to an external URL."""

    def __init__(self, settings: Settings) -> None:
        self._url = settings.transcript_callback_url
        self._timeout = settings.transcript_callback_timeout_seconds

    @property
    def is_enabled(self) -> bool:
        return bool(self._url)

    async def deliver(self, payload: TranscribeResponse) -> None:
        if not self._url:
            return

        logger.info("Callback started | job_id=%s url=%s", payload.job_id, self._url)

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(self._timeout)) as client:
                response = await client.post(
                    self._url,
                    json=payload.model_dump(exclude_none=True),
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error(
                "Callback failed | job_id=%s url=%s error=%s",
                payload.job_id,
                self._url,
                exc,
            )
            return

        logger.info(
            "Callback completed | job_id=%s url=%s status=%d",
            payload.job_id,
            self._url,
            response.status_code,
        )
