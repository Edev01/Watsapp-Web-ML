"""Run full per-user normalization (all batches) and update normalize_jobs."""
import logging
import os
import threading
from typing import Optional, Set

from app.database import SessionLocal
from app.llm import LLMClient
from app.normalizer import process_unnormalized_messages
from app.embeddings import generate_and_store_embeddings
from app import normalize_jobs as jobs

logger = logging.getLogger("whatsapp_ai.normalize_runner")

DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen2.5:7b")

_lock = threading.Lock()
_running_users: Set[int] = set()


def is_user_running(user_id: int) -> bool:
    with _lock:
        return int(user_id) in _running_users


def run_normalize_for_user(
    user_id: int,
    model: Optional[str] = None,
    batch_size: int = 50,
    embed: bool = True,
) -> dict:
    """
    Process all pending messages for one user. Safe to call from a background thread.
    Updates normalize_jobs status in the shared DB.
    """
    uid = int(user_id)
    model_name = model or DEFAULT_MODEL
    batch = max(1, min(int(batch_size or 50), 200))

    with _lock:
        if uid in _running_users:
            return {"ok": False, "skipped": True, "reason": "already_running", "user_id": uid}
        _running_users.add(uid)

    processed = 0
    db = SessionLocal()
    try:
        claimed = jobs.claim_job(db, uid)
        if not claimed:
            jobs.ensure_queued_job(db, uid, model_name, embed=embed, batch_size=batch)
            claimed = jobs.claim_job(db, uid)

        client = LLMClient()
        while True:
            batch_db = SessionLocal()
            try:
                n = process_unnormalized_messages(
                    db=batch_db,
                    llm_client=client,
                    model_name=model_name,
                    batch_size=batch,
                    user_id=uid,
                    newest_first=True,
                )
            finally:
                batch_db.close()

            if n <= 0:
                break
            processed += n
            jobs.bump_processed(db, uid, n)
            logger.info(f"user={uid} normalize batch +{n} (run total={processed})")

        if embed and processed > 0 and os.getenv("EMBED_ENABLED", "true").lower() in ("1", "true", "yes"):
            emb_db = SessionLocal()
            try:
                emb_n = generate_and_store_embeddings(
                    db=emb_db,
                    target_llm_model=model_name,
                    embedding_model="nomic-embed-text",
                    user_id=uid,
                )
                logger.info(f"user={uid} embeddings generated: {emb_n}")
            except Exception as emb_err:
                logger.warning(f"user={uid} embedding step failed: {emb_err}")
            finally:
                emb_db.close()
        elif embed and processed > 0:
            logger.info(f"user={uid} embeddings skipped (EMBED_ENABLED=false)")

        jobs.complete_job(db, uid)
        return {
            "ok": True,
            "user_id": uid,
            "processed": processed,
            "model": model_name,
        }
    except Exception as e:
        logger.exception(f"Normalize failed for user={uid}")
        try:
            jobs.fail_job(db, uid, str(e))
        except Exception:
            pass
        return {"ok": False, "user_id": uid, "error": str(e), "processed": processed}
    finally:
        try:
            db.close()
        except Exception:
            pass
        with _lock:
            _running_users.discard(uid)


def start_normalize_background(
    user_id: int,
    model: Optional[str] = None,
    batch_size: int = 50,
    embed: bool = True,
) -> dict:
    """Spawn a daemon thread; returns immediately."""
    uid = int(user_id)
    if is_user_running(uid):
        return {"started": False, "already_running": True, "user_id": uid}

    thread = threading.Thread(
        target=run_normalize_for_user,
        kwargs={
            "user_id": uid,
            "model": model,
            "batch_size": batch_size,
            "embed": embed,
        },
        name=f"normalize-user-{uid}",
        daemon=True,
    )
    thread.start()
    return {"started": True, "already_running": False, "user_id": uid}
