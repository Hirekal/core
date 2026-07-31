from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
import shutil
from tempfile import mkdtemp

from app.core.logging import get_logger

logger = get_logger(__name__)

TEMP_DIR_PREFIX = "job-"


def ensure_temp_base_dir(base_dir: Path) -> Path:
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


def cleanup_stale_temp_dirs(
    base_dir: Path,
    *,
    max_age_seconds: float,
    include_legacy_tmp_root: bool = True,
) -> int:
    """Remove temp workspaces older than max_age_seconds. Returns deleted count."""
    deleted = 0
    cutoff = time.time() - max_age_seconds
    candidates: list[Path] = []

    if base_dir.exists():
        candidates.extend(path for path in base_dir.iterdir() if path.is_dir())

    if include_legacy_tmp_root:
        candidates.extend(Path("/tmp").glob("media-worker-*"))

    seen: set[Path] = set()
    for path in candidates:
        resolved = path.resolve()
        if resolved in seen or not path.is_dir():
            continue
        seen.add(resolved)

        try:
            if path.stat().st_mtime >= cutoff:
                continue
            shutil.rmtree(path, ignore_errors=True)
            deleted += 1
            logger.info("Removed stale temp directory | path=%s", path)
        except OSError as exc:
            logger.warning("Failed to remove stale temp directory | path=%s error=%s", path, exc)

    if deleted:
        logger.info("Stale temp cleanup finished | deleted=%d", deleted)

    return deleted


@asynccontextmanager
async def temporary_workspace(base_dir: Path) -> AsyncIterator[Path]:
    """Create a per-request temp directory under base_dir; always deleted in finally."""
    ensure_temp_base_dir(base_dir)
    directory = Path(mkdtemp(prefix=TEMP_DIR_PREFIX, dir=str(base_dir)))
    try:
        yield directory
    finally:
        shutil.rmtree(directory, ignore_errors=True)
