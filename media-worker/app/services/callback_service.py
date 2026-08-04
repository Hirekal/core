import httpx

from app.core.config import Settings
from app.core.logging import get_logger
from app.schemas.response import TranscribeFailedCallback, TranscribeResponse

logger = get_logger(__name__)


class CallbackService:
    """POSTs transcript success/failure payloads to the HireKal API callback URL."""

    def __init__(self, settings: Settings) -> None:
        self._url = settings.transcript_callback_url
        self._timeout = settings.transcript_callback_timeout_seconds

    @property
    def is_enabled(self) -> bool:
        return bool(self._url)

    async def deliver(self, payload: TranscribeResponse) -> None:
        await self._post(payload.job_id, payload.model_dump())

    async def deliver_failure(self, payload: TranscribeFailedCallback) -> None:
        await self._post(payload.job_id, payload.model_dump())

    async def _post(self, job_id: str, body: dict) -> None:
        if not self._url:
            return

        logger.info("Callback started | job_id=%s url=%s", job_id, self._url)

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(self._timeout)) as client:
                response = await client.post(
                    self._url,
                    json=body,
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error(
                "Callback failed | job_id=%s url=%s error=%s",
                job_id,
                self._url,
                exc,
            )
            return

        logger.info(
            "Callback completed | job_id=%s url=%s status=%d",
            job_id,
            self._url,
            response.status_code,
        )
