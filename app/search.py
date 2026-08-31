import logging
import re
from difflib import SequenceMatcher
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.embeddings import generate_embedding

logger = logging.getLogger("whatsapp_ai.search")


# Canonical city names + common misspellings / abbreviations
CITY_MAPPINGS = {
    "Karachi": ["karachi", "krachi", "khi", "krchi", "karachii", "karachi.", "karchi"],
    "Lahore": ["lahore", "lahor", "lhr", "lahur", "lahoree", "lahore.", "lahorr"],
    "Islamabad": ["islamabad", "islambad", "isb", "islamaabad", "islamabadh", "isalmabad"],
    "Rawalpindi": ["rawalpindi", "rwp", "pindi", "rawlpindi", "rawalpinde"],
    "Faisalabad": ["faisalabad", "fsd", "lyallpur", "faisalabaad"],
    "Multan": ["multan", "mlt", "multaan"],
    "Peshawar": ["peshawar", "psh", "peshwar"],
    "Quetta": ["quetta", "qta", "queta"],
    "Hyderabad": ["hyderabad", "hyd", "hyderabaad"],
}

# Canonical area/society names + common misspellings
AREA_MAPPINGS = {
    "DHA": ["dha", "d.h.a", "d.h.a.", "defence", "defense", "defence housing", "dha defence"],
    "Bahria Town": [
        "bahria town", "bahria", "bahriatown", "bahria twn",
        "bhria town", "bhria", "bahia town", "bahia", "bahira town",
        "bahriya town", "bahriya", "bariya town", "behria town", "behria",
    ],
    "Clifton": ["clifton", "cliftn", "cliffton", "cliftonn", "clfiton"],
    "Gulberg": ["gulberg", "gulbrg", "gulburg", "gul berg", "gulberge"],
    "North Nazimabad": [
        "north nazimabad", "n nazimabad", "nazimabad", "nazimbaad",
        "north nazimbaad", "north nazimabaad", "nort nazimabad", "north nazimabd",
    ],
    "Shah Faisal": ["shah faisal", "shahfaisal", "shah faysal"],
    "Malir": ["malir", "maalir", "malair"],
    "Model Town": ["model town", "model twn", "modeltown"],
    "Johar Town": ["johar town", "johartown", "johar twn", "johar"],
    "Gulshan": ["gulshan", "gulshan-e-iqbal", "gulshan iqbal", "gulshane iqbal"],
    "Scheme 33": ["scheme 33", "scheme33", "schme 33", "scheme-33"],
    "Askari": ["askari", "askri", "askarii"],
    "Cantt": ["cantt", "cantonment", "cant"],
    "Bedian Road": ["bedian road", "bedian", "bedain road"],
}


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _fuzzy_match_phrase(
    query_lower: str,
    canonical: str,
    variations: List[str],
    threshold: float = 0.78,
) -> Tuple[bool, Optional[str]]:
    """
    Match a location against query using:
    1) exact substring of known variations
    2) fuzzy token/window match for typos like 'Bhria' / 'Bahia' / 'Lahor'
    """
    # Exact substring: longest variations first so "north nazimbaad" beats "nazimbaad"
    for variation in sorted([v for v in variations if v], key=len, reverse=True):
        if variation in query_lower:
            return True, variation

    # Fuzzy: compare multi-word canonical / variations against sliding windows
    candidates = sorted(
        {canonical.lower(), *[v for v in variations if v]},
        key=len,
        reverse=True,
    )
    tokens = re.findall(r"[a-z0-9.]+", query_lower)
    if not tokens:
        return False, None

    best: Tuple[float, Optional[str]] = (0.0, None)
    for candidate in candidates:
        cand_tokens = candidate.split()
        window = max(1, len(cand_tokens))
        for w in sorted({window, max(1, window - 1), window + 1}, reverse=True):
            for i in range(0, max(1, len(tokens) - w + 1)):
                span = " ".join(tokens[i : i + w])
                score = _similarity(span, candidate)
                if score >= threshold and score > best[0]:
                    best = (score, span)

    if best[1]:
        return True, best[1]
    return False, None


def extract_vicinity(query_lower: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract sub-location tokens people type on their own:
    phase 6, phse 6, precinct 35, precint 35, block H, sector C.

    Returns (canonical_vicinity, matched_span).
    """
    patterns = [
        (
            r"\b(ph+a*s+e*|phse|phas|phaze|phace|phsse)\s*-?\s*(\d{1,2})\b",
            lambda m: (f"Phase {m.group(2)}", m.group(0)),
        ),
        (
            r"\b(precincts?|precints?|precnt|prcnt|precinct|precint)\s*-?\s*(\d{1,3})\b",
            lambda m: (f"Precinct {m.group(2)}", m.group(0)),
        ),
        (
            r"\b(blocks?|blcks?|blk)\s*-?\s*([a-z0-9]{1,4})\b",
            lambda m: (f"Block {m.group(2).upper()}", m.group(0)),
        ),
        (
            r"\b(sectors?|sec)\s*-?\s*([a-z0-9]{1,4})\b",
            lambda m: (f"Sector {m.group(2).upper()}", m.group(0)),
        ),
        (
            r"\b(schemes?|schme|schm)\s*-?\s*(\d{1,3})\b",
            lambda m: (f"Scheme {m.group(2)}", m.group(0)),
        ),
    ]
    for pattern, builder in patterns:
        match = re.search(pattern, query_lower, re.IGNORECASE)
        if match:
            return builder(match)
    return None, None


def preprocess_search_query(query: str) -> Dict[str, Optional[Any]]:
    """
    Extract structured filters from a free-text query.
    Handles spelling mistakes via fuzzy matching.

    Examples:
      "House for sale in Bahria Town"
      "50 marla house in DHA Lahor"
      "flat for rent in Bhria town"
    """
    if not query or not str(query).strip():
        return {
            "city": None,
            "area": None,
            "vicinity": None,
            "property_type": None,
            "purpose": None,
            "size_value": None,
            "size_unit": None,
            "cleaned_query": "",
        }

    original = str(query).strip()
    query_lower = original.lower()

    detected_city = None
    city_span = None
    for city, variations in CITY_MAPPINGS.items():
        matched, span = _fuzzy_match_phrase(query_lower, city, variations, threshold=0.82)
        if matched:
            detected_city = city
            city_span = span
            break

    detected_area = None
    area_span = None
    # Prefer longer area names first (Bahria Town before Bahria)
    for area, variations in sorted(AREA_MAPPINGS.items(), key=lambda x: -len(x[0])):
        matched, span = _fuzzy_match_phrase(query_lower, area, variations, threshold=0.78)
        if matched:
            detected_area = area
            area_span = span
            break

    property_keywords = {
        "HOUSE": ["house", "bungalow", "villa", "home", "bangla", "banglow", "banglow"],
        "APARTMENT": ["apartment", "flat", "appt", "appartment", "apartmnt"],
        "PLOT": ["plot", "land", "plotts"],
        "COMMERCIAL": ["shop", "store", "commercial", "office", "warehouse"],
        "FARMHOUSE": ["farmhouse", "farm house", "farmhous"],
    }
    detected_property_type = None
    for prop_type, keywords in property_keywords.items():
        for keyword in keywords:
            if re.search(r"\b" + re.escape(keyword) + r"\b", query_lower):
                detected_property_type = prop_type
                break
        if detected_property_type:
            break

    detected_purpose = None
    if re.search(r"\b(for\s+)?(sale|sell|selling|buy|purchase)\b", query_lower):
        detected_purpose = "SALE"
    elif re.search(r"\b(for\s+)?(rent|rental|lease|leasing)\b", query_lower):
        detected_purpose = "RENT"

    detected_size_value = None
    detected_size_unit = None
    size_match = re.search(
        r"(\d+(?:\.\d+)?)\s*(marla|marlas|kanal|kanals|sq\.?\s*ft\.?|sq\.?\s*yd\.?|sq\.?\s*m\.?|yards?|yrds?)",
        query_lower,
    )
    if size_match:
        detected_size_value = float(size_match.group(1))
        unit_raw = re.sub(r"\s+", " ", size_match.group(2).strip().lower())
        unit_map = {
            "marla": "Marla",
            "marlas": "Marla",
            "kanal": "Kanal",
            "kanals": "Kanal",
            "sq ft": "Sq. Ft.",
            "sq. ft": "Sq. Ft.",
            "sq. ft.": "Sq. Ft.",
            "sq yd": "Sq. Yd.",
            "sq. yd": "Sq. Yd.",
            "sq. yd.": "Sq. Yd.",
            "yard": "Sq. Yd.",
            "yards": "Sq. Yd.",
            "yrd": "Sq. Yd.",
            "yrds": "Sq. Yd.",
        }
        detected_size_unit = unit_map.get(unit_raw, unit_raw.title())

    # Build cleaned query with canonical location names for better embeddings/FTS.
    cleaned_query = original

    def _replace_span_or_variations(
        text: str,
        canonical: str,
        variations: List[str],
        matched_span: Optional[str],
    ) -> str:
        if matched_span:
            pattern = re.compile(re.escape(matched_span), re.IGNORECASE)
            text, n = pattern.subn(canonical, text, count=1)
            if n:
                return text
        ordered = sorted({canonical.lower(), *[v.lower() for v in variations if v]}, key=len, reverse=True)
        for variation in ordered:
            parts = [re.escape(p) for p in variation.split()]
            pattern = r"\b" + r"\s+".join(parts) + r"\b"
            new_text, n = re.subn(pattern, canonical, text, count=1, flags=re.IGNORECASE)
            if n:
                return new_text
        return text

    if detected_city:
        cleaned_query = _replace_span_or_variations(
            cleaned_query, detected_city, CITY_MAPPINGS.get(detected_city, []), city_span
        )
    if detected_area:
        cleaned_query = _replace_span_or_variations(
            cleaned_query, detected_area, AREA_MAPPINGS.get(detected_area, []), area_span
        )

    detected_vicinity, vicinity_span = extract_vicinity(query_lower)
    if detected_vicinity and vicinity_span:
        cleaned_query = re.sub(
            re.escape(vicinity_span),
            detected_vicinity,
            cleaned_query,
            count=1,
            flags=re.IGNORECASE,
        )

    logger.info(
        "Query preprocessing: city=%s, area=%s, vicinity=%s, type=%s, purpose=%s, size=%s %s",
        detected_city,
        detected_area,
        detected_vicinity,
        detected_property_type,
        detected_purpose,
        detected_size_value,
        detected_size_unit,
    )

    return {
        "city": detected_city,
        "area": detected_area,
        "vicinity": detected_vicinity,
        "property_type": detected_property_type,
        "purpose": detected_purpose,
        "size_value": detected_size_value,
        "size_unit": detected_size_unit,
        "cleaned_query": cleaned_query.strip(),
    }


def semantic_search(
    db: Session,
    query_text: str,
    model_used: str,
    embedding_model: str = "nomic-embed-text",
    city: Optional[str] = None,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Perform intelligent hybrid search with:
    - Automatic query preprocessing and location extraction
    - Fuzzy matching for spelling mistakes
    - Vector similarity search
    - PostgreSQL full-text keyword boosting
    - Smart result deduplication
    """
    preprocessed = preprocess_search_query(query_text)

    search_city = city if city else preprocessed.get("city")
    search_area = preprocessed.get("area")
    search_vicinity = preprocessed.get("vicinity")
    cleaned_query = preprocessed.get("cleaned_query", query_text)

    logger.info(
        f"Search params: query='{cleaned_query}', city={search_city}, "
        f"area={search_area}, vicinity={search_vicinity}"
    )

    query_vector = generate_embedding(cleaned_query, model_name=embedding_model)
    query_vector_str = "[" + ",".join(map(str, query_vector)) + "]"

    query_filters = ["e.model_used = :model_used", "n.is_property = true"]

    if search_city and search_city.strip():
        query_filters.append("n.city ILIKE :city")

    if search_area and search_area.strip():
        query_filters.append("(n.area ILIKE :area OR n.vicinity ILIKE :area OR n.summary ILIKE :area)")

    if search_vicinity and search_vicinity.strip():
        query_filters.append(
            "(n.area ILIKE :vicinity OR n.vicinity ILIKE :vicinity "
            "OR n.summary ILIKE :vicinity OR n.area ILIKE :vicinity_compact "
            "OR n.vicinity ILIKE :vicinity_compact OR n.summary ILIKE :vicinity_compact)"
        )

    where_clause = " AND ".join(query_filters)

    sql_template = f"""
        SELECT * FROM (
            SELECT DISTINCT ON (e.whatsapp_message_id)
                e.whatsapp_message_id AS message_id, 
                e.content_chunk AS summary, 
                (
                    (1 - (e.embedding <=> CAST(:query_vector AS vector))) +
                    (CASE 
                        WHEN to_tsvector('english', m.message || ' ' || n.summary || ' ' || COALESCE(n.area, '') || ' ' || COALESCE(n.vicinity, '') || ' ' || COALESCE(n.city, '')) 
                             @@ websearch_to_tsquery('english', :query_text) 
                        THEN 0.5 
                        ELSE 0.0 
                     END) +
                    (CASE 
                        WHEN :area IS NOT NULL AND (n.area ILIKE :area OR n.vicinity ILIKE :area)
                        THEN 0.3
                        ELSE 0.0
                     END) +
                    (CASE 
                        WHEN :vicinity IS NOT NULL AND (n.area ILIKE :vicinity OR n.vicinity ILIKE :vicinity)
                        THEN 0.45
                        ELSE 0.0
                     END) +
                    (CASE 
                        WHEN :city IS NOT NULL AND n.city ILIKE :city
                        THEN 0.2
                        ELSE 0.0
                     END)
                ) AS similarity_score,
                n.city,
                n.area,
                n.vicinity,
                n.property_type,
                n.purpose,
                n.size,
                n.price,
                n.contact_number,
                m.message AS raw_message
            FROM message_embeddings e
            JOIN normalized_messages n ON e.whatsapp_message_id = n.whatsapp_message_id AND e.model_used = n.model_used
            JOIN whatsapp_messages m ON e.whatsapp_message_id = m.id
            WHERE {where_clause}
            ORDER BY e.whatsapp_message_id, similarity_score DESC
        ) ranked
        ORDER BY similarity_score DESC
        LIMIT :limit;
    """

    params = {
        "query_vector": query_vector_str,
        "model_used": model_used,
        "query_text": cleaned_query,
        "limit": limit,
        "city": f"%{search_city}%" if search_city else None,
        "area": f"%{search_area}%" if search_area else None,
        "vicinity": f"%{search_vicinity}%" if search_vicinity else None,
        "vicinity_compact": f"%{search_vicinity.replace(' ', '')}%" if search_vicinity else None,
    }

    rows = db.execute(text(sql_template), params).mappings().all()
    return [dict(r) for r in rows]
