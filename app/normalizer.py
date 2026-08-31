import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError, OperationalError, DatabaseError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.failure_log import load_skipped_ids, log_normalization_failure
from app.llm import LLMClient, get_default_model
from app.models_db import ModelComparison, NormalizeClaim, NormalizedMessage, WhatsAppMessage
from app.normalize_config import claim_stale_seconds, normalize_concurrency, normalize_per_user
from app.property_prefilter import should_fast_skip_llm

logger = logging.getLogger("whatsapp_ai.normalizer")
logging.basicConfig(level=logging.INFO)


def _min_message_id_cutoff() -> Optional[int]:
    raw = (os.getenv("NORMALIZE_MIN_MESSAGE_ID") or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        logger.warning(f"Invalid NORMALIZE_MIN_MESSAGE_ID={raw!r}; ignoring")
        return None


@dataclass
class RawJob:
    id: int
    user_id: Optional[int]
    chat_jid: str
    sender: Optional[str]
    message: str


def db_operation_with_retry(db: Session, operation_func, max_retries: int = 3, retry_delay: float = 2.0):
    """Execute a database operation with retry logic for connection failures."""
    for attempt in range(max_retries):
        try:
            return operation_func()
        except (OperationalError, DatabaseError) as e:
            if attempt < max_retries - 1:
                logger.warning(f"Database operation failed (attempt {attempt + 1}/{max_retries}): {str(e)}")
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                db.rollback()
                try:
                    db.connection()
                except Exception:
                    pass
            else:
                logger.error(f"Database operation failed after {max_retries} attempts")
                raise


def _tenant_id(user_id: Optional[int]) -> int:
    return user_id if user_id is not None else 1


def _release_stale_claims(db: Session, model_name: str) -> None:
    cutoff = datetime.utcnow() - timedelta(seconds=claim_stale_seconds())
    deleted = (
        db.query(NormalizeClaim)
        .filter(NormalizeClaim.model_used == model_name)
        .filter(NormalizeClaim.claimed_at < cutoff)
        .delete(synchronize_session=False)
    )
    if deleted:
        db.commit()
        logger.info(f"Released {deleted} stale normalize claims.")


def _fair_pick(jobs: List[RawJob], batch_size: int, per_user: int) -> List[RawJob]:
    """Round-robin tenants so one large scrape cannot starve others."""
    if not jobs:
        return []

    by_user: Dict[int, List[RawJob]] = {}
    for job in jobs:
        by_user.setdefault(_tenant_id(job.user_id), []).append(job)

    user_ids = list(by_user.keys())
    if len(user_ids) == 1:
        return jobs[:batch_size]

    picked: List[RawJob] = []
    indexes = {uid: 0 for uid in user_ids}

    # First pass: each tenant gets up to per_user
    for uid in user_ids:
        take = min(per_user, len(by_user[uid]), batch_size - len(picked))
        picked.extend(by_user[uid][:take])
        indexes[uid] = take
        if len(picked) >= batch_size:
            return picked[:batch_size]

    # Fill remaining slots, still rotating users
    while len(picked) < batch_size:
        progressed = False
        for uid in user_ids:
            idx = indexes[uid]
            if idx < len(by_user[uid]):
                picked.append(by_user[uid][idx])
                indexes[uid] = idx + 1
                progressed = True
                if len(picked) >= batch_size:
                    break
        if not progressed:
            break
    return picked[:batch_size]


def _claim_jobs(db: Session, jobs: List[RawJob], model_name: str) -> List[RawJob]:
    claimed: List[RawJob] = []
    for job in jobs:
        try:
            db.add(
                NormalizeClaim(
                    whatsapp_message_id=job.id,
                    model_used=model_name,
                    user_id=_tenant_id(job.user_id),
                    claimed_at=datetime.utcnow(),
                )
            )
            db.commit()
            claimed.append(job)
        except IntegrityError:
            db.rollback()
    return claimed


def _release_claim(message_id: int, model_name: str) -> None:
    db = SessionLocal()
    try:
        db.query(NormalizeClaim).filter(
            NormalizeClaim.whatsapp_message_id == message_id,
            NormalizeClaim.model_used == model_name,
        ).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _save_stub_non_property(db: Session, job: RawJob, target_model: str) -> None:
    preview = (job.message or "")[:200]

    def save():
        db.add(
            NormalizedMessage(
                whatsapp_message_id=job.id,
                chat_jid=job.chat_jid,
                sender=job.sender,
                category="GENERAL",
                intent="",
                sentiment="NEUTRAL",
                language="",
                summary=preview,
                entities={"products": [], "dates_mentioned": [], "action_items": [], "names": []},
                is_property=False,
                confidence_score=0.1,
                model_used=target_model,
            )
        )
        db.commit()

    db_operation_with_retry(db, save)


def _save_normalized(db: Session, job: RawJob, parsed_schema, target_model: str) -> None:
    is_prop = parsed_schema.is_property_listing_or_inquiry

    def save_normalized_data():
        normalized_rec = NormalizedMessage(
            whatsapp_message_id=job.id,
            chat_jid=job.chat_jid,
            sender=job.sender,
            category=parsed_schema.category.value,
            intent=parsed_schema.intent,
            sentiment=parsed_schema.sentiment.value,
            language=parsed_schema.language,
            summary=parsed_schema.summary,
            entities=parsed_schema.entities.model_dump(),
            city=parsed_schema.city if is_prop else None,
            is_property=is_prop,
            purpose=parsed_schema.purpose if is_prop else None,
            property_type=parsed_schema.property_type if is_prop else None,
            property_sub_type=parsed_schema.property_sub_type if is_prop else None,
            area=parsed_schema.area if is_prop else None,
            vicinity=parsed_schema.vicinity if is_prop else None,
            size=parsed_schema.size if is_prop else None,
            size_value=parsed_schema.size_value if is_prop else None,
            size_unit=parsed_schema.size_unit if is_prop else None,
            price=parsed_schema.price if is_prop else None,
            price_value=parsed_schema.price_value if is_prop else None,
            contact_number=parsed_schema.contact_number if is_prop else None,
            confidence_score=parsed_schema.confidence_score,
            model_used=target_model,
        )
        db.add(normalized_rec)

        comp_rec = db.query(ModelComparison).filter(
            ModelComparison.whatsapp_message_id == job.id
        ).first()
        if not comp_rec:
            comp_rec = ModelComparison(
                whatsapp_message_id=job.id,
                raw_message=job.message,
            )
            db.add(comp_rec)

        result_dict = {
            "is_property": is_prop,
            "summary": parsed_schema.summary,
            "category": parsed_schema.category.value,
            "intent": parsed_schema.intent,
            "sentiment": parsed_schema.sentiment.value,
            "entities": parsed_schema.entities.model_dump(),
            "city": parsed_schema.city if is_prop else None,
            "purpose": parsed_schema.purpose if is_prop else None,
            "property_type": parsed_schema.property_type if is_prop else None,
            "property_sub_type": parsed_schema.property_sub_type if is_prop else None,
            "area": parsed_schema.area if is_prop else None,
            "vicinity": parsed_schema.vicinity if is_prop else None,
            "size": parsed_schema.size if is_prop else None,
            "size_value": parsed_schema.size_value if is_prop else None,
            "size_unit": parsed_schema.size_unit if is_prop else None,
            "price": parsed_schema.price if is_prop else None,
            "price_value": parsed_schema.price_value if is_prop else None,
            "contact_number": parsed_schema.contact_number if is_prop else None,
            "language": parsed_schema.language,
            "confidence_score": parsed_schema.confidence_score,
        }

        model_lower = target_model.lower()
        if "qwen" in model_lower:
            comp_rec.qwen_result = result_dict
        elif "llama" in model_lower:
            comp_rec.llama_result = result_dict
        elif "deepseek" in model_lower:
            comp_rec.deepseek_result = result_dict

        db.commit()

    db_operation_with_retry(db, save_normalized_data)


def _normalize_one(job: RawJob, llm_client: LLMClient, target_model: str) -> Tuple[int, bool]:
    """One Groq call + DB save. Runs in a worker thread with its own session."""
    db = SessionLocal()
    try:
        skip_llm, skip_reason = should_fast_skip_llm(job.message)
        if skip_llm:
            _save_stub_non_property(db, job, target_model)
            logger.info(f"Message ID {job.id} done (fast-skip:{skip_reason}, 0.00s)")
            return job.id, True

        parsed_schema, latency, _tps, is_valid, err_reason, raw_out = llm_client.normalize_message(
            raw_text=job.message,
            sender=job.sender,
            model_name=target_model,
        )
        if is_valid and parsed_schema:
            _save_normalized(db, job, parsed_schema, target_model)
            logger.info(
                f"Message ID {job.id} (user {_tenant_id(job.user_id)}) "
                f"normalized successfully ({latency:.2f}s)."
            )
            return job.id, True

        reason = err_reason or "Unknown parse/validation failure"
        # 429 / daily quota is temporary — do not add to the permanent skip list
        if reason.startswith("RATE_LIMIT") or "RateLimitError" in reason or "rate_limit" in reason.lower():
            logger.warning(f"Rate-limited on message ID {job.id}; will retry on next wave.")
            return job.id, False

        log_normalization_failure(
            message_id=job.id,
            model_name=target_model,
            reason=reason,
            raw_snippet=raw_out,
            message_preview=job.message,
        )
        logger.warning(f"Failed to normalize message ID {job.id}: {reason[:200]}")
        return job.id, False
    except Exception as e:
        db.rollback()
        reason = f"{type(e).__name__}: {e}"
        if "RateLimitError" in reason or "rate_limit" in reason.lower():
            logger.warning(f"Rate-limited on message ID {job.id}; will retry on next wave.")
            return job.id, False
        log_normalization_failure(
            message_id=job.id,
            model_name=target_model,
            reason=reason,
            message_preview=job.message,
        )
        logger.error(f"Error processing message ID {job.id}: {reason}")
        return job.id, False
    finally:
        db.close()
        _release_claim(job.id, target_model)


def _load_pending_jobs(
    db: Session,
    target_model: str,
    skipped_ids: set,
    user_id: Optional[int],
    window: int,
) -> List[RawJob]:
    processed_ids_stmt = (
        select(NormalizedMessage.whatsapp_message_id)
        .filter(NormalizedMessage.model_used == target_model)
    )
    active_claims_stmt = (
        select(NormalizeClaim.whatsapp_message_id)
        .filter(NormalizeClaim.model_used == target_model)
    )

    query = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.id.not_in(processed_ids_stmt))
        .filter(WhatsAppMessage.id.not_in(active_claims_stmt))
        .filter(WhatsAppMessage.message.isnot(None))
        .order_by(WhatsAppMessage.id.asc())
    )
    if user_id is not None:
        if user_id == 1:
            query = query.filter(or_(WhatsAppMessage.user_id == 1, WhatsAppMessage.user_id.is_(None)))
        else:
            query = query.filter(WhatsAppMessage.user_id == user_id)

    cutoff = _min_message_id_cutoff()
    if cutoff is not None:
        query = query.filter(WhatsAppMessage.id > int(cutoff))

    if skipped_ids:
        query = query.filter(WhatsAppMessage.id.notin_(list(skipped_ids)))

    rows = query.limit(window).all()
    jobs: List[RawJob] = []
    for msg in rows:
        if not msg.message or not msg.message.strip():
            continue
        jobs.append(
            RawJob(
                id=msg.id,
                user_id=msg.user_id,
                chat_jid=msg.chat_jid,
                sender=msg.sender,
                message=msg.message,
            )
        )
    return jobs


def process_unnormalized_messages(
    db: Session,
    llm_client: LLMClient,
    model_name: Optional[str] = None,
    batch_size: int = 50,
    user_id: Optional[int] = None,
    concurrency: Optional[int] = None,
) -> int:
    """
    Normalize pending WhatsApp messages with parallel Groq calls.

    Fair across user_id so multiple tenants scrape at the same time.
    Claims prevent two workers from taking the same row.
    """
    target_model = model_name or llm_client.default_model or get_default_model()
    workers = concurrency or normalize_concurrency()
    per_user = normalize_per_user()

    skipped_ids = load_skipped_ids(target_model)
    if skipped_ids:
        logger.info(
            f"Skipping {len(skipped_ids)} previously failed message IDs for model '{target_model}'."
        )

    cutoff = _min_message_id_cutoff()
    if cutoff is not None:
        logger.info(f"Only normalizing messages with id > {cutoff} (old backlog skipped)")

    _release_stale_claims(db, target_model)

    window = max(batch_size * 4, 80)
    candidates = _load_pending_jobs(db, target_model, skipped_ids, user_id, window)
    selected = _fair_pick(candidates, batch_size, per_user)
    claimed = _claim_jobs(db, selected, target_model)

    if not claimed:
        logger.info(f"No pending un-normalized messages found for model '{target_model}'.")
        return 0

    tenant_counts: Dict[int, int] = {}
    for job in claimed:
        tenant_counts[_tenant_id(job.user_id)] = tenant_counts.get(_tenant_id(job.user_id), 0) + 1

    logger.info(
        f"Processing {len(claimed)} messages with {workers} parallel Groq calls "
        f"(model '{target_model}', tenants={dict(tenant_counts)})..."
    )

    success_count = 0
    fail_count = 0
    started = time.perf_counter()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_normalize_one, job, llm_client, target_model) for job in claimed]
        for fut in as_completed(futures):
            try:
                _mid, ok = fut.result()
                if ok:
                    success_count += 1
                else:
                    fail_count += 1
            except Exception as exc:
                fail_count += 1
                logger.error(f"Worker crashed: {exc}")

    elapsed = time.perf_counter() - started
    logger.info(
        f"Batch complete: {success_count}/{len(claimed)} normalized, {fail_count} failed "
        f"in {elapsed:.1f}s (~{success_count / elapsed:.1f}/s) "
        f"(logged to logs/normalize_failures.log)."
    )
    return success_count
