import os


def _int_env(name: str, default: int, minimum: int = 1) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


def normalize_concurrency() -> int:
    """Parallel Groq chat calls in one wave."""
    return _int_env("NORMALIZE_CONCURRENCY", 8)


def normalize_per_user() -> int:
    """Min slots each tenant gets in a mixed wave (then leftovers fill)."""
    return _int_env("NORMALIZE_PER_USER", 4)


def embed_concurrency() -> int:
    """Parallel Ollama embedding calls (keep small — local CPU)."""
    return _int_env("EMBED_CONCURRENCY", 3)


def claim_stale_seconds() -> int:
    return _int_env("NORMALIZE_CLAIM_STALE_SEC", 180)
