import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional, Tuple
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError
from app.schemas import NormalizedOutputSchema

load_dotenv()

logger = logging.getLogger("whatsapp_ai.llm")


def get_default_model() -> str:
    return os.getenv("DEFAULT_MODEL", "openai/gpt-oss-20b")

SYSTEM_PROMPT = """You are an expert AI Data Normalizer for WhatsApp real estate conversations in Pakistan.
Your task is to analyze the given WhatsApp message and extract structured information in strictly valid JSON format.

JSON Schema format required:
{
  "is_property_listing_or_inquiry": true or false,
  "summary": "Concise 1-2 sentence summary of the message context",
  "category": "INQUIRY | SUPPORT | SALES | COMPLAINT | GENERAL | SPAM",
  "intent": "Short summary of user's core intent or query",
  "sentiment": "POSITIVE | NEUTRAL | NEGATIVE",
  "purpose": "SALE | RENT or null",
  "property_type": "PLOT | HOUSE | BUNGALOW | APARTMENT | FLAT | SHOP | COMMERCIAL | FARMHOUSE or null",
  "property_sub_type": "Single Storey | Double Storey | Triple Storey | Studio | 1 Bed | 2 Bed | 3 Bed | Penthouse | Lower Portion | Upper Portion | Residential Plot | Commercial Plot | Agricultural Land | Industrial Land | Office | Shop | Warehouse | Factory | Building or null",
  "city": "e.g. Karachi | Lahore | Islamabad or null",
  "area": "Major housing society or scheme name, e.g. DHA, Bahria Town, Clifton, G-11, Gulberg, North Nazimabad, Bedian Road or null",
  "vicinity": "Sub-location, Street, Block, Phase, Scheme, e.g. Phase 6, Phase 5, Block H, Block 5, Sector C, 29th Street, Scheme 33 or null",
  "size": "Size, e.g. 1000 Yards, 2 Kanal, 4 Marla, 120 Sq. Yd or null",
  "size_value": 1000,
  "size_unit": "Marla | Kanal | Sq. Ft. | Sq. Yd. | Sq. M. or null",
  "price": "Price mentioned, e.g. 15 Crore, 45,000 / month, 1.8 Cr or null",
  "price_value": 15000000,
  "contact_number": "Phone number(s) mentioned in message, or null",
  "entities": {
    "products": [],
    "dates_mentioned": [],
    "action_items": [],
    "names": []
  },
  "language": "en | ur | hinglish | etc.",
  "confidence_score": 0.95
}

Rules:
1. "is_property_listing_or_inquiry" MUST be true if the message describes a property deal, listing, or real estate inquiry. It MUST be false if the message is general greeting, chat, spam, or unrelated discussion.
2. Output ONLY one valid JSON object. No markdown fences, no comments, no trailing text.
3. If text is Urdu written in English (Roman Urdu/Hinglish), analyze its true meaning correctly.
4. Ensure all quotes inside values are properly escaped.
5. CRITICAL - Purpose field rules:
   - Use "SALE" when property is advertised FOR SALE / FOR SELLING / AVAILABLE FOR PURCHASE
   - Use "RENT" when property is advertised FOR RENT / TO RENT / FOR LEASE / RENTAL
   - NEVER use "BUY" - use "SALE" instead
6. Location hierarchy:
   - "area" = Major housing society/neighborhood (DHA, Bahria Town, Clifton, North Nazimabad, etc.)
   - "vicinity" = Sub-location (Phase 6, Block H, Scheme 33, etc.)
7. Normalize city names: "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", etc.
8. Handle spelling variations: "Cliftn" -> "Clifton", "Krachi" -> "Karachi"
9. CRITICAL NUMERIC RULES (multi-listing messages):
   - size_value MUST be a single number or null. NEVER an array. NEVER "500, 568".
   - price_value MUST be a single number or null. NEVER an array.
   - If the message has multiple properties, extract the FIRST/primary listing only for size_value, price_value, property_type, area, vicinity.
   - property_type must be ONE value (e.g. "HOUSE"), never "HOUSE | PLOT".
   - intent must always be a string (use "" if none), never null.
"""


class LLMClient:
    """Unified client to interact with open-source LLM inference engines (Ollama, vLLM, Groq, etc.)."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
    ):
        self.base_url = base_url or os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
        self.api_key = api_key or os.getenv("LLM_API_KEY", "ollama")
        self.default_model = default_model or os.getenv("DEFAULT_MODEL", "qwen2.5:7b")

        self.client = OpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
        )

    def _clean_json_response(self, text: str) -> str:
        """Strip markdown fences and extract the outermost JSON object."""
        text = text.strip()
        fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if fence:
            text = fence.group(1).strip()

        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]

        # Fix common LLM mistake: "size_value": 500, 568  -> take first number
        text = re.sub(
            r'("(?:size_value|price_value)"\s*:\s*)(\d+(?:\.\d+)?)\s*,\s*\d+(?:\.\d+)?',
            r"\1\2",
            text,
        )
        return text

    def _extract_assistant_text(self, message: Any) -> str:
        """Read model text; Groq reasoning models may leave content empty."""
        content = getattr(message, "content", None) or ""
        if str(content).strip():
            return str(content)

        for attr in ("reasoning", "reasoning_content"):
            val = getattr(message, attr, None)
            if val and str(val).strip():
                return str(val)

        if hasattr(message, "model_dump"):
            data = message.model_dump()
            for key in ("content", "reasoning", "reasoning_content"):
                val = data.get(key)
                if val and str(val).strip():
                    return str(val)
        return ""

    def _first_number(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, list):
            for item in value:
                num = self._first_number(item)
                if num is not None:
                    return num
            return None
        if isinstance(value, str):
            cleaned = value.strip().replace(",", "")
            match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
            if match:
                try:
                    return float(match.group(0))
                except ValueError:
                    return None
        return None

    def _coerce_llm_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Repair common LLM output issues before Pydantic validation."""
        if not isinstance(data, dict):
            return data

        # Required strings cannot be null
        for key in ("summary", "intent", "language"):
            if data.get(key) is None:
                data[key] = ""

        # Purpose normalization
        purpose = data.get("purpose")
        if isinstance(purpose, str):
            p = purpose.strip().upper()
            if p in {"BUY", "SELL", "SALE", "FOR SALE", "PURCHASE"}:
                data["purpose"] = "SALE"
            elif p in {"RENT", "LEASE", "FOR RENT", "RENTAL"}:
                data["purpose"] = "RENT"
            elif p == "" or p == "NULL":
                data["purpose"] = None

        # Single property_type (take first token before | or ,)
        ptype = data.get("property_type")
        if isinstance(ptype, str) and ("|" in ptype or "," in ptype):
            data["property_type"] = re.split(r"[|,]", ptype)[0].strip() or None
        elif isinstance(ptype, list) and ptype:
            data["property_type"] = str(ptype[0]).strip()

        psubtype = data.get("property_sub_type")
        if isinstance(psubtype, str) and ("|" in psubtype or "," in psubtype):
            data["property_sub_type"] = re.split(r"[|,]", psubtype)[0].strip() or None
        elif isinstance(psubtype, list) and psubtype:
            data["property_sub_type"] = str(psubtype[0]).strip()

        # Numeric fields: lists / bad strings -> first number
        data["size_value"] = self._first_number(data.get("size_value"))
        data["price_value"] = self._first_number(data.get("price_value"))

        # size_unit: take first if list / pipe-separated
        sunit = data.get("size_unit")
        if isinstance(sunit, list) and sunit:
            data["size_unit"] = str(sunit[0])
        elif isinstance(sunit, str) and "|" in sunit:
            data["size_unit"] = sunit.split("|")[0].strip()

        # contact_number as string
        contact = data.get("contact_number")
        if isinstance(contact, list):
            data["contact_number"] = ", ".join(str(c) for c in contact if c) or None
        elif contact is not None and not isinstance(contact, str):
            data["contact_number"] = str(contact)

        # entities must be object
        entities = data.get("entities")
        if not isinstance(entities, dict):
            data["entities"] = {
                "products": [],
                "dates_mentioned": [],
                "action_items": [],
                "names": [],
            }
        else:
            for ek in ("products", "dates_mentioned", "action_items", "names"):
                if entities.get(ek) is None:
                    entities[ek] = []
                elif not isinstance(entities.get(ek), list):
                    entities[ek] = [str(entities[ek])]

        # category / sentiment case normalize
        if isinstance(data.get("category"), str):
            data["category"] = data["category"].strip().upper()
        if isinstance(data.get("sentiment"), str):
            data["sentiment"] = data["sentiment"].strip().upper()

        # confidence
        conf = data.get("confidence_score")
        if conf is None:
            data["confidence_score"] = 0.5
        else:
            try:
                data["confidence_score"] = max(0.0, min(1.0, float(conf)))
            except (TypeError, ValueError):
                data["confidence_score"] = 0.5

        return data

    def _parse_llm_output(self, raw_output: str) -> Tuple[Optional[NormalizedOutputSchema], Optional[str]]:
        cleaned = self._clean_json_response(raw_output)
        try:
            json_dict = json.loads(cleaned)
        except json.JSONDecodeError as err:
            return None, f"JSONDecodeError: {err}; cleaned={cleaned[:300]!r}"

        if not isinstance(json_dict, dict):
            return None, f"LLM output is not a JSON object: {type(json_dict).__name__}"

        coerced = self._coerce_llm_dict(json_dict)
        try:
            return NormalizedOutputSchema(**coerced), None
        except ValidationError as err:
            return None, f"ValidationError: {err}"

    def normalize_message(
        self,
        raw_text: str,
        sender: Optional[str] = None,
        model_name: Optional[str] = None,
    ) -> Tuple[Optional[NormalizedOutputSchema], float, float, bool, Optional[str], Optional[str]]:
        """
        Normalize a raw message into structured schema using selected model.

        Returns:
            (parsed_schema, latency_sec, tokens_per_sec, is_valid, error_reason, raw_llm_output)
        """
        target_model = model_name or self.default_model
        user_content = f"Sender: {sender or 'Unknown'}\nMessage: {raw_text}"
        max_tokens = int(os.getenv("LLM_MAX_TOKENS", "900"))

        start_time = time.perf_counter()
        completion_tokens = 0
        raw_output = ""

        try:
            response = self.client.chat.completions.create(
                model=target_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.1,
                max_tokens=max_tokens,
            )

            raw_output = self._extract_assistant_text(response.choices[0].message)

            if hasattr(response, "usage") and response.usage:
                completion_tokens = response.usage.completion_tokens or len(raw_output.split())

            parsed_schema, err = self._parse_llm_output(raw_output)
            latency = time.perf_counter() - start_time
            tokens_per_sec = (completion_tokens / latency) if latency > 0 else 0.0

            if parsed_schema is not None:
                return parsed_schema, latency, tokens_per_sec, True, None, raw_output

            # One repair retry for broken JSON / schema issues
            repair_messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": raw_output},
                {
                    "role": "user",
                    "content": (
                        "Your previous output was invalid. "
                        f"Error: {err}. "
                        "Reply with ONLY one valid JSON object. "
                        "size_value and price_value must be single numbers or null, never arrays. "
                        "intent must be a string."
                    ),
                },
            ]
            retry = self.client.chat.completions.create(
                model=target_model,
                messages=repair_messages,
                temperature=0.0,
                max_tokens=max_tokens,
            )
            raw_output = self._extract_assistant_text(retry.choices[0].message)
            if hasattr(retry, "usage") and retry.usage:
                completion_tokens += retry.usage.completion_tokens or 0

            parsed_schema, err2 = self._parse_llm_output(raw_output)
            latency = time.perf_counter() - start_time
            tokens_per_sec = (completion_tokens / latency) if latency > 0 else 0.0

            if parsed_schema is not None:
                return parsed_schema, latency, tokens_per_sec, True, None, raw_output

            return None, latency, tokens_per_sec, False, err2 or err, raw_output

        except Exception as exc:
            latency = time.perf_counter() - start_time
            logger.exception("LLM normalize_message failed")
            return None, latency, 0.0, False, f"{type(exc).__name__}: {exc}", raw_output
