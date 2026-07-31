from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import mkdtemp
import shutil


@asynccontextmanager
async def temporary_workspace(prefix: str = "media-worker-") -> AsyncIterator[Path]:
    """Create a temporary directory and guarantee cleanup after use."""
    directory = Path(mkdtemp(prefix=prefix))
    try:
        yield directory
    finally:
        shutil.rmtree(directory, ignore_errors=True)
