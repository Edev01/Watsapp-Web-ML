import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models_db import NormalizedMessage, MessageEmbedding
from app.llm import LLMClient
from app.normalize_config import embed_concurrency, embeddings_enabled

logger = logging.getLogger("whatsapp_ai.embeddings")


def get_embedding_client() -> LLMClient:
    """Always use Ollama for nomic-embed-text — not Groq (Groq has no this model)."""
    return LLMClient(
        base_url=os.getenv("EMBEDDING_BASE_URL", "http://localhost:11434/v1"),
        api_key=os.getenv("EMBEDDING_API_KEY", "ollama"),
        default_model=os.getenv("EMBEDDING_MODEL", "nomic-embed-text"),
    )


def generate_embedding(text: str, model_name: str = "nomic-embed-text") -> List[float]:
    """Generate vector embedding from text using Ollama / OpenAI-compatible endpoint."""
    client = get_embedding_client()
    try:
        response = client.client.embeddings.create(
            model=model_name,
            input=text,
        )
        return response.data[0].embedding
    except Exception as exc:
        logger.error(f"Error generating embedding via {client.base_url}: {exc}")
        raise


def build_rich_embedding_text(rec: NormalizedMessage) -> str:
    """
    Build a rich, structured searchable string from all real estate metadata.
    This ensures location-specific searches (e.g. 'DHA Phase 6') match precisely
    rather than relying only on the vague AI summary.
    """
    parts = []
    if rec.property_type:
        parts.append(rec.property_type)
    if rec.purpose:
        parts.append(f"for {rec.purpose}")
    if rec.area:
        parts.append(rec.area)
    if rec.vicinity:
        parts.append(rec.vicinity)
    if rec.city:
        parts.append(rec.city)
    if rec.size:
        parts.append(rec.size)
    if rec.price:
        parts.append(f"Price: {rec.price}")
    if rec.summary:
        parts.append(rec.summary)
    return " | ".join(parts) if parts else (rec.summary or "")


def generate_and_store_embeddings(
    db: Session,
    target_llm_model: str,
    embedding_model: str = "nomic-embed-text",
) -> int:
    """
    Fetch normalized records for target_llm_model and generate/store vector embeddings.
    Embeds a RICH structured string (property_type + area + vicinity + city + summary)
    so that location-specific queries match correctly.
    """
    from sqlalchemy import select

    # Select statement to exclude messages already embedded for this model
    existing_embeddings_stmt = (
        select(MessageEmbedding.whatsapp_message_id)
        .filter(MessageEmbedding.model_used == target_llm_model)
    )

    pending_records = (
        db.query(NormalizedMessage)
        .filter(NormalizedMessage.model_used == target_llm_model)
        .filter(NormalizedMessage.is_property == True)
        .filter(NormalizedMessage.whatsapp_message_id.not_in(existing_embeddings_stmt))
        .all()
    )

    if not pending_records:
        logger.info(f"No pending embeddings to generate for model '{target_llm_model}'.")
        return 0

    workers = embed_concurrency()
    logger.info(
        f"Generating embeddings for {len(pending_records)} messages "
        f"using model '{embedding_model}' ({workers} parallel Ollama calls)..."
    )

    jobs: List[Tuple[int, str]] = []
    for rec in pending_records:
        rich_text = build_rich_embedding_text(rec)
        if rich_text:
            jobs.append((rec.whatsapp_message_id, rich_text))

    def _embed_one(item: Tuple[int, str]) -> Optional[Tuple[int, str, List[float]]]:
        msg_id, rich_text = item
        try:
            vector = generate_embedding(rich_text, model_name=embedding_model)
            return msg_id, rich_text, vector
        except Exception:
            logger.warning(f"Skipping embedding for message ID {msg_id} due to API failure.")
            return None

    success_count = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_embed_one, job) for job in jobs]
        for fut in as_completed(futures):
            result = fut.result()
            if not result:
                continue
            msg_id, rich_text, vector = result
            db.add(
                MessageEmbedding(
                    whatsapp_message_id=msg_id,
                    model_used=target_llm_model,
                    content_chunk=rich_text,
                    embedding=vector,
                )
            )
            success_count += 1

    db.commit()
    logger.info(f"Generated and saved {success_count} embeddings successfully.")
    return success_count

