"""Normalization throughput settings for multi-tenant scale."""
import os


def llm_base_url() -> str:
    return (os.getenv("LLM_BASE_URL") or "http://localhost:11434/v1").strip()


def is_local_llm() -> bool:
    u = llm_base_url().lower()
    return "localhost" in u or "127.0.0.1" in u


def normalize_concurrency() -> int:
    """
    Parallel LLM calls per batch.
    Local Ollama: 1 (CPU/RAM). Cloud (Groq/OpenRouter): default 12.
    """
    raw = os.getenv("NORMALIZE_CONCURRENCY", "").strip()
    if raw:
        return max(1, min(int(raw), 32))
    return 1 if is_local_llm() else 12


def per_user_batch_limit() -> int:
    """Max messages taken per portal user in one batch (fair scheduling)."""
    return max(1, int(os.getenv("NORMALIZE_PER_USER_BATCH", "8")))


def fair_scheduling_enabled() -> bool:
    if os.getenv("NORMALIZE_FAIR_SCHEDULE", "").lower() in ("0", "false", "no"):
        return False
    return os.getenv("NORMALIZE_FAIR_SCHEDULE", "true").lower() in ("1", "true", "yes")


def max_batch_rounds_per_cycle() -> int:
    """How many back-to-back batches to run when backlog exists."""
    return max(1, int(os.getenv("NORMALIZE_MAX_ROUNDS", "10")))


def recommended_check_interval() -> int:
    raw = os.getenv("CHECK_INTERVAL", "").strip()
    if raw:
        return int(raw)
    return 60 if is_local_llm() else 15


def embeddings_enabled() -> bool:
    """Embeddings require a local Ollama embed model unless explicitly enabled."""
    flag = os.getenv("EMBED_ENABLED", "").lower()
    if flag in ("1", "true", "yes"):
        return True
    if flag in ("0", "false", "no"):
        return False
    return is_local_llm()


def claim_stale_seconds() -> int:
    try:
        return max(60, int(os.getenv("NORMALIZE_CLAIM_STALE_SEC", "180")))
    except (TypeError, ValueError):
        return 180


def normalize_per_user() -> int:
    """Alias used by bot-2 normalizer fair scheduling."""
    return per_user_batch_limit()


def embed_concurrency() -> int:
    try:
        return max(1, int(os.getenv("EMBED_CONCURRENCY", "3")))
    except (TypeError, ValueError):
        return 3
