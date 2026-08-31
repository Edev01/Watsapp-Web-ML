"""External (non-DB) logging for normalization failures."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Set

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
FAILURE_LOG_PATH = LOG_DIR / "normalize_failures.log"
SKIPPED_IDS_PATH = LOG_DIR / "normalize_skipped_ids.txt"


def _ensure_log_dir() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def load_skipped_ids(model_name: Optional[str] = None) -> Set[int]:
    """IDs that already failed for the given model (or any model if model_name is None)."""
    _ensure_log_dir()
    if not SKIPPED_IDS_PATH.exists():
        return set()
    ids: Set[int] = set()
    for line in SKIPPED_IDS_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(",", 2)
        try:
            msg_id = int(parts[0].strip())
        except ValueError:
            continue
        if model_name is not None:
            failed_model = parts[1].strip() if len(parts) > 1 else ""
            if failed_model and failed_model != model_name:
                continue
        ids.add(msg_id)
    return ids


def log_normalization_failure(
    message_id: int,
    model_name: str,
    reason: str,
    raw_snippet: Optional[str] = None,
    message_preview: Optional[str] = None,
) -> None:
    """
    Append failure details to a local log file (not the database).
    Also records the message ID so the normalizer can skip it later.
    """
    _ensure_log_dir()
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "message_id": message_id,
        "model": model_name,
        "reason": reason,
        "message_preview": (message_preview or "")[:300],
        "llm_snippet": (raw_snippet or "")[:500],
    }
    with FAILURE_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    with SKIPPED_IDS_PATH.open("a", encoding="utf-8") as f:
        f.write(f"{message_id},{model_name},{reason[:120].replace(chr(10), ' ')}\n")
