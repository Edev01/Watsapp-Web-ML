"""Cheap heuristics: skip LLM for obvious non-property chat (saves ~2 min/msg on CPU)."""
import os
import re
from typing import Tuple

# Pakistan real estate signals — message must hit at least one to call the LLM
_PROPERTY_PATTERNS = re.compile(
    r"""
    marla|kanal|kanaal|sq\.?\s*ft|sqft|square\s*(yard|feet|meter|m)|
    \byard\b|\byards\b|
    crore|crores|\bcr\b|lac|lakh|million|\blacs\b|
    \brent\b|\brental\b|\blease\b|for\s+sale|for\s+rent|
    \bdha\b|bahria|gulshan|clifton|gulberg|scheme|phase\s*\d|block\s*[a-z0-9]|
    \bplot\b|\bhouse\b|\bflat\b|\bapartment\b|\bbungalow\b|\bfarmhouse\b|
    \bcommercial\b|\bshop\b|\boffice\b|\bwarehouse\b|\bstudio\b|
    \bfurnished\b|\bunfurnished\b|\bbed\b|\bbedroom\b|\bbhk\b|
    \bproperty\b|\blisting\b|\bavailable\b|\bportion\b|
    \bkarachi\b|\blahore\b|\bislamabad\b|\brawalpindi\b|\bmultan\b|\bfaisalabad\b|
    \d+\s*(marla|kanal|yard|sq|bed|bhk)|
    (?:rs\.?|pkr|₨)\s*\d|\d+\s*(?:/|per)\s*month
    """,
    re.IGNORECASE | re.VERBOSE,
)

_PHONE_PATTERN = re.compile(r"(?:\+92|0)?3\d{9}")


def prefilter_enabled() -> bool:
    return os.getenv("NORMALIZE_PREFILTER", "true").lower() in ("1", "true", "yes")


def looks_like_property_message(text: str) -> bool:
    """True if message likely needs full LLM extraction."""
    if not text or not str(text).strip():
        return False
    t = str(text).strip()
    if _PROPERTY_PATTERNS.search(t):
        return True
    # Long messages with a PK mobile often are listings
    if len(t) >= 120 and _PHONE_PATTERN.search(t):
        return True
    return False


def should_fast_skip_llm(text: str) -> Tuple[bool, str]:
    """
    Returns (skip_llm, reason).
    skip_llm=True → store stub non-property row, no Ollama call.
    """
    if not prefilter_enabled():
        return False, ""
    if looks_like_property_message(text):
        return False, ""
    return True, "no_property_signals"
