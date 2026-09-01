"""
Advanced Property Search with Dashboard Filters

Supports all optional filters from the dashboard:
- purpose: Buy/Rent
- city: Karachi/Lahore/etc
- location: Area/Vicinity (Scheme 33, DHA Phase 6, etc.)
- sortBy: Newest First, Price Low->High, Price High->Low, Area Small->Large, Area Large->Small
- priceMin/priceMax: Price range
- propertyType: House/Flat/Plot/Commercial
- propertySubType: Single Storey/Double Storey/Studio/etc
- areaUnit: Marla/Kanal/Sq. Ft./Sq. Yd.
- areaMin/areaMax: Size range

All filters are OPTIONAL - search works with any combination.
"""
import logging
import os
from typing import List, Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.embeddings import generate_embedding
from app.search import preprocess_search_query
from app.normalize_config import embeddings_enabled

logger = logging.getLogger("whatsapp_ai.advanced_search")

DEFAULT_LLM_MODEL = os.getenv("DEFAULT_MODEL", "openai/gpt-oss-20b")
DEFAULT_EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

PROPERTY_STATUSES = frozenset(
    {"AVAILABLE", "SOLD", "RENTED", "RESERVED", "WITHDRAWN", "ON_HOLD"}
)


def _normalize_property_status(raw: Optional[str]) -> Optional[str]:
    if raw is None or not str(raw).strip():
        return None
    key = str(raw).strip().upper().replace(" ", "_").replace("-", "_")
    aliases = {
        "ACTIVE": "AVAILABLE",
        "OPEN": "AVAILABLE",
        "PENDING": "ON_HOLD",
        "HOLD": "ON_HOLD",
        "REMOVED": "WITHDRAWN",
        "INACTIVE": "WITHDRAWN",
        "LEASED": "RENTED",
    }
    if key in PROPERTY_STATUSES:
        return key
    return aliases.get(key)


def _parse_status_filter(raw: Optional[str]) -> List[str]:
    if not raw or not str(raw).strip():
        return []
    out = []
    for part in str(raw).split(","):
        normalized = _normalize_property_status(part)
        if normalized and normalized not in out:
            out.append(normalized)
    return out


def _try_query_embedding(query: str, embedding_model: str) -> Optional[List[float]]:
    if not embeddings_enabled():
        return None
    try:
        return generate_embedding(query, model_name=embedding_model)
    except Exception as exc:
        logger.warning("Embedding unavailable, using text search only: %s", exc)
        return None


def _text_search_score_sql() -> str:
    return """(
        (CASE
            WHEN to_tsvector('english', m.message || ' ' || COALESCE(n.summary, '') || ' ' || COALESCE(n.area, '') || ' ' || COALESCE(n.vicinity, '') || ' ' || COALESCE(n.city, ''))
                 @@ websearch_to_tsquery('english', :query_text)
            THEN 1.0
            ELSE 0.0
         END) +
        (CASE WHEN m.message ILIKE :query_like OR n.summary ILIKE :query_like THEN 0.4 ELSE 0.0 END) +
        (CASE WHEN :location IS NOT NULL AND (n.area ILIKE :location OR n.vicinity ILIKE :location) THEN 0.35 ELSE 0.0 END) +
        (CASE WHEN :vicinity IS NOT NULL AND (n.area ILIKE :vicinity OR n.vicinity ILIKE :vicinity) THEN 0.45 ELSE 0.0 END) +
        (CASE WHEN :city IS NOT NULL AND n.city ILIKE :city THEN 0.25 ELSE 0.0 END)
    ) AS similarity_score"""


def advanced_property_search(
    db: Session,
    user_id: Optional[int] = None,
    query_text: Optional[str] = None,
    model_used: str = DEFAULT_LLM_MODEL,
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
    # Dashboard filters (all optional)
    purpose: Optional[str] = None,  # "Buy" or "Rent"
    city: Optional[str] = None,  # "Karachi", "Lahore", etc.
    location: Optional[str] = None,  # Area or vicinity (e.g., "Scheme 33", "DHA Phase 6")
    sort_by: Optional[str] = None,  # "Newest First", "Price: Low -> High", "Price: High -> Low", "Area: Small -> Large", "Area: Large -> Small"
    price_min: Optional[float] = None,  # Minimum price in PKR
    price_max: Optional[float] = None,  # Maximum price in PKR
    property_type: Optional[str] = None,  # "House", "Flat", "Plot", "Commercial"
    property_sub_type: Optional[str] = None,  # "Single Storey", "Double Storey", "Studio", etc.
    area_unit: Optional[str] = None,  # "Marla", "Kanal", "Sq. Ft.", "Sq. Yd."
    area_min: Optional[float] = None,  # Minimum area value
    area_max: Optional[float] = None,  # Maximum area value
    status: Optional[str] = None,  # AVAILABLE | SOLD | RENTED | ...
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Advanced property search with user data isolation & dashboard filters.
    """
    
    logger.info(f"Advanced search initiated for user_id={user_id} with filters:")
    logger.info(f"  Query: {query_text}")
    logger.info(f"  Purpose: {purpose}, City: {city}, Location: {location}")
    logger.info(f"  Property Type: {property_type}, Sub-type: {property_sub_type}")
    logger.info(f"  Price: {price_min}-{price_max}, Area: {area_min}-{area_max} {area_unit}")
    logger.info(f"  Sort: {sort_by}")
    
    # Normalize empty strings to None for proper filtering
    purpose = purpose if purpose and purpose.strip() else None
    city = city if city and city.strip() else None
    location = location if location and location.strip() else None
    property_type = property_type if property_type and property_type.strip() else None
    property_sub_type = property_sub_type if property_sub_type and property_sub_type.strip() else None
    area_unit = area_unit if area_unit and area_unit.strip() else None
    sort_by = sort_by if sort_by and sort_by.strip() else "Newest First"
    query_text = query_text if query_text and query_text.strip() else None

    # Frontend often sends the search-bar text as BOTH query and location.
    # Never use a full natural-language sentence as an ILIKE location filter.
    if query_text and location and location.strip().lower() == query_text.strip().lower():
        location = None

    # Parse free-text query: spelling fix + extract purpose/city/area/type/size
    preprocessed = preprocess_search_query(query_text) if query_text else {}
    cleaned_query = preprocessed.get("cleaned_query", query_text) if query_text else None

    # Fill empty dashboard filters from the parsed search text
    if not purpose and preprocessed.get("purpose"):
        purpose = "Buy" if preprocessed["purpose"] == "SALE" else "Rent"
    if not city and preprocessed.get("city"):
        city = preprocessed["city"]
    parsed_area = preprocessed.get("area")
    parsed_vicinity = preprocessed.get("vicinity")
    if not location and parsed_area:
        location = parsed_area
    if not property_type and preprocessed.get("property_type"):
        type_to_dashboard = {
            "HOUSE": "House",
            "APARTMENT": "Flat",
            "PLOT": "Plot",
            "COMMERCIAL": "Commercial",
            "FARMHOUSE": "House",
            "BUNGALOW": "House",
            "FLAT": "Flat",
        }
        property_type = type_to_dashboard.get(
            preprocessed["property_type"], preprocessed["property_type"].title()
        )
    if area_min is None and preprocessed.get("size_value") is not None:
        # Exact-ish size from query: "50 marla" -> min/max around that value
        area_min = preprocessed["size_value"]
        area_max = preprocessed["size_value"] if area_max is None else area_max
    if not area_unit and preprocessed.get("size_unit"):
        area_unit = preprocessed["size_unit"]

    logger.info(
        "Resolved filters after query parse: user_id=%s purpose=%s city=%s location=%s vicinity=%s type=%s size=%s-%s %s",
        user_id, purpose, city, location, parsed_vicinity, property_type, area_min, area_max, area_unit,
    )

    # Build WHERE clause filters
    filters = ["n.is_property = true"]
    params = {"limit": limit}

    if user_id is not None:
        filters.append("m.user_id = :user_id")
        params["user_id"] = user_id

    if model_used:
        filters.append("n.model_used = :model_used")
        params["model_used"] = model_used

    # Purpose filter (map Buy -> SALE, Rent -> RENT)
    if purpose:
        p = purpose.lower().strip()
        if p in {"buy", "sale", "sell"}:
            purpose_normalized = "SALE"
        elif p in {"rent", "rental", "lease"}:
            purpose_normalized = "RENT"
        else:
            purpose_normalized = purpose.upper()
        filters.append("n.purpose ILIKE :purpose")
        params["purpose"] = purpose_normalized

    # City filter (supports fuzzy-corrected city from query)
    if city:
        filters.append("n.city ILIKE :city")
        params["city"] = f"%{city}%"

    # Location filter — society/area from query or dashboard
    if location and len(location.split()) <= 6:
        filters.append(
            "(n.area ILIKE :location OR n.vicinity ILIKE :location OR n.summary ILIKE :location)"
        )
        params["location"] = f"%{location}%"

    # Vicinity/sub-area filter — "phase 6", "precinct 35" even without a society name
    if parsed_vicinity:
        filters.append(
            "(n.area ILIKE :vicinity OR n.vicinity ILIKE :vicinity "
            "OR n.summary ILIKE :vicinity OR n.area ILIKE :vicinity_compact "
            "OR n.vicinity ILIKE :vicinity_compact OR n.summary ILIKE :vicinity_compact)"
        )
        params["vicinity"] = f"%{parsed_vicinity}%"
        params["vicinity_compact"] = f"%{parsed_vicinity.replace(' ', '')}%"

    # Property type filter
    if property_type:
        type_map = {
            "Flat": "APARTMENT",
            "House": "HOUSE",
            "Plot": "PLOT",
            "Commercial": "COMMERCIAL",
            "Apartment": "APARTMENT",
            "Bungalow": "HOUSE",
            "Farmhouse": "FARMHOUSE",
        }
        db_type = type_map.get(property_type, property_type.upper())
        # HOUSE also matches BUNGALOW listings
        if db_type == "HOUSE":
            filters.append("(n.property_type ILIKE :property_type OR n.property_type ILIKE :property_type_alt)")
            params["property_type"] = "%HOUSE%"
            params["property_type_alt"] = "%BUNGALOW%"
        else:
            filters.append("n.property_type ILIKE :property_type")
            params["property_type"] = f"%{db_type}%"

    # Property sub-type filter
    if property_sub_type:
        filters.append("n.property_sub_type ILIKE :property_sub_type")
        params["property_sub_type"] = f"%{property_sub_type}%"

    # Price range filters
    if price_min is not None:
        filters.append("n.price_value >= :price_min")
        params["price_min"] = price_min

    if price_max is not None:
        filters.append("n.price_value <= :price_max")
        params["price_max"] = price_max

    # Area range filters — allow small tolerance for "50 marla"
    if area_min is not None and area_max is not None and area_min == area_max:
        filters.append("n.size_value BETWEEN :area_min AND :area_max")
        params["area_min"] = max(0, area_min * 0.9)
        params["area_max"] = area_max * 1.1
    else:
        if area_min is not None:
            filters.append("n.size_value >= :area_min")
            params["area_min"] = area_min
        if area_max is not None:
            filters.append("n.size_value <= :area_max")
            params["area_max"] = area_max

    # Area unit filter
    if area_unit:
        filters.append("n.size_unit ILIKE :area_unit")
        params["area_unit"] = f"%{area_unit.split('.')[0].strip()}%"

    status_list = _parse_status_filter(status)
    if status_list:
        placeholders = []
        for i, st in enumerate(status_list):
            key = f"status_{i}"
            placeholders.append(f":{key}")
            params[key] = st
        filters.append(
            f"UPPER(COALESCE(n.property_status, 'AVAILABLE')) IN ({', '.join(placeholders)})"
        )

    where_clause = " AND ".join(filters)

    # Determine sort order
    sort_map = {
        "Newest First": "n.created_at DESC",
        "Price: Low -> High": "n.price_value ASC NULLS LAST",
        "Price: High -> Low": "n.price_value DESC NULLS LAST",
        "Area: Small -> Large": "n.size_value ASC NULLS LAST",
        "Area: Large -> Small": "n.size_value DESC NULLS LAST",
    }
    order_by = sort_map.get(sort_by, "n.created_at DESC")

    # If there's a text query, prefer vector search when embeddings exist
    if cleaned_query:
        params["query_text"] = cleaned_query
        params["query_like"] = f"%{cleaned_query}%"
        params.setdefault("location", None)
        params.setdefault("city", None)
        params.setdefault("vicinity", None)

        query_vector = _try_query_embedding(cleaned_query, embedding_model)

        if query_vector is not None:
            query_vector_str = "[" + ",".join(map(str, query_vector)) + "]"
            params["query_vector"] = query_vector_str

            sql_template = f"""
            SELECT * FROM (
                SELECT DISTINCT ON (m.id)
                    m.id AS message_id,
                    n.id AS property_id,
                    m.user_id,
                    m.message AS raw_message,
                    n.summary,
                    n.city,
                    n.area,
                    n.vicinity,
                    n.property_type,
                    n.property_sub_type,
                    n.purpose,
                    n.size,
                    n.size_value,
                    n.size_unit,
                    n.price,
                    n.price_value,
                    n.contact_number,
                    n.property_status,
                    n.category,
                    n.intent,
                    n.sentiment,
                    n.created_at,
                    (
                        COALESCE((1 - (e.embedding <=> CAST(:query_vector AS vector))), 0.0) +
                        (CASE 
                            WHEN to_tsvector('english', m.message || ' ' || COALESCE(n.summary, '') || ' ' || COALESCE(n.area, '') || ' ' || COALESCE(n.vicinity, '') || ' ' || COALESCE(n.city, '')) 
                                 @@ websearch_to_tsquery('english', :query_text) 
                            THEN 0.5 
                            ELSE 0.0 
                         END) +
                        (CASE WHEN :location IS NOT NULL AND (n.area ILIKE :location OR n.vicinity ILIKE :location) THEN 0.35 ELSE 0.0 END) +
                        (CASE WHEN :vicinity IS NOT NULL AND (n.area ILIKE :vicinity OR n.vicinity ILIKE :vicinity) THEN 0.45 ELSE 0.0 END) +
                        (CASE WHEN :city IS NOT NULL AND n.city ILIKE :city THEN 0.25 ELSE 0.0 END)
                    ) AS similarity_score
                FROM whatsapp_messages m
                JOIN normalized_messages n ON m.id = n.whatsapp_message_id
                LEFT JOIN message_embeddings e ON m.id = e.whatsapp_message_id AND e.model_used = n.model_used
                WHERE {where_clause}
                ORDER BY m.id, similarity_score DESC
            ) ranked
            ORDER BY similarity_score DESC, {order_by.replace('n.', 'ranked.')}
            LIMIT :limit;
        """
        else:
            score_sql = _text_search_score_sql()
            sql_template = f"""
            SELECT * FROM (
                SELECT DISTINCT ON (m.id)
                    m.id AS message_id,
                    n.id AS property_id,
                    m.user_id,
                    m.message AS raw_message,
                    n.summary,
                    n.city,
                    n.area,
                    n.vicinity,
                    n.property_type,
                    n.property_sub_type,
                    n.purpose,
                    n.size,
                    n.size_value,
                    n.size_unit,
                    n.price,
                    n.price_value,
                    n.contact_number,
                    n.property_status,
                    n.category,
                    n.intent,
                    n.sentiment,
                    n.created_at,
                    {score_sql}
                FROM whatsapp_messages m
                JOIN normalized_messages n ON m.id = n.whatsapp_message_id
                WHERE {where_clause}
                ORDER BY m.id, similarity_score DESC
            ) ranked
            WHERE ranked.similarity_score > 0
            ORDER BY similarity_score DESC, {order_by.replace('n.', 'ranked.')}
            LIMIT :limit;
        """
    else:
        # Filter-only search (no text query)
        sql_template = f"""
            SELECT * FROM (
                SELECT DISTINCT ON (m.id)
                    m.id AS message_id,
                    n.id AS property_id,
                    m.user_id,
                    m.message AS raw_message,
                    n.summary,
                    n.city,
                    n.area,
                    n.vicinity,
                    n.property_type,
                    n.property_sub_type,
                    n.purpose,
                    n.size,
                    n.size_value,
                    n.size_unit,
                    n.price,
                    n.price_value,
                    n.contact_number,
                    n.property_status,
                    n.category,
                    n.intent,
                    n.sentiment,
                    n.created_at,
                    1.0 AS similarity_score
                FROM whatsapp_messages m
                JOIN normalized_messages n ON m.id = n.whatsapp_message_id
                WHERE {where_clause}
                ORDER BY m.id, {order_by}
            ) ranked
            ORDER BY {order_by.replace('n.', 'ranked.')}
            LIMIT :limit;
        """
    
    # Execute query
    results = db.execute(text(sql_template), params).mappings().all()
    
    # Format results
    formatted_results = []
    for r in results:
        formatted_results.append({
            "message_id": r["message_id"],
            "property_id": r.get("property_id"),
            "id": r.get("property_id"),
            "user_id": r["user_id"],
            "raw_message": r["raw_message"],
            "summary": r["summary"],
            "city": r["city"],
            "area": r["area"],
            "vicinity": r["vicinity"],
            "property_type": r["property_type"],
            "property_sub_type": r["property_sub_type"],
            "purpose": r["purpose"],
            "size": r["size"],
            "size_value": r["size_value"],
            "size_unit": r["size_unit"],
            "price": r["price"],
            "price_value": r["price_value"],
            "contact_number": r["contact_number"],
            "property_status": (r.get("property_status") or "AVAILABLE").upper(),
            "propertyStatus": (r.get("property_status") or "AVAILABLE").upper(),
            "category": r["category"],
            "intent": r["intent"],
            "sentiment": r["sentiment"],
            "created_at": r["created_at"],
            "similarity_score": round(float(r["similarity_score"]), 4) if query_text else None,
        })
    
    logger.info(f"Found {len(formatted_results)} results for user_id={user_id}")
    return formatted_results
