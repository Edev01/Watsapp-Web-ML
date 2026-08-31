"""Background drain loop: wake when any tenant scrapes, process all pending fairly."""

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.database import SessionLocal, init_db
from app.embeddings import generate_and_store_embeddings
from app.llm import LLMClient, get_default_model
from app.normalizer import process_unnormalized_messages
from app.normalize_config import embeddings_enabled, normalize_concurrency, recommended_check_interval

logger = logging.getLogger("whatsapp_ai.pipeline_worker")

POLL_INTERVAL = recommended_check_interval()
_wake = threading.Event()
_run_lock = threading.Lock()
_started = False
_stats: Dict[str, Any] = {
    "running": False,
    "last_run": None,
    "last_normalized": 0,
    "last_embedded": 0,
    "total_normalized": 0,
    "total_embedded": 0,
}


def wake_pipeline(user_id: Optional[int] = None) -> None:
    """Called when a tenant saves new WhatsApp messages."""
    if user_id is not None:
        logger.info(f"Pipeline wake requested by user_id={user_id}")
    _wake.set()


def get_pipeline_stats() -> Dict[str, Any]:
    return {
        **_stats,
        "model": get_default_model(),
        "concurrency": normalize_concurrency(),
        "poll_interval_sec": POLL_INTERVAL,
        "worker_started": _started,
    }


def _drain_once(llm_client: LLMClient) -> Dict[str, int]:
    model = get_default_model()
    batch_size = max(5, int(os.getenv("NORMALIZE_BATCH_SIZE", "5")))
    db = SessionLocal()
    try:
        normalized = process_unnormalized_messages(
            db=db,
            llm_client=llm_client,
            model_name=model,
            batch_size=batch_size,
            concurrency=normalize_concurrency(),
        )
        embedded = 0
        if embeddings_enabled() and normalized > 0:
            embedded = generate_and_store_embeddings(
                db=db,
                target_llm_model=model,
            )
        return {"normalized": normalized, "embedded": embedded}
    finally:
        db.close()


def _loop() -> None:
    init_db(skip_if_busy=True)
    llm_client = LLMClient()
    logger.info(
        f"Realtime pipeline worker started (model={get_default_model()}, "
        f"concurrency={normalize_concurrency()}, poll={POLL_INTERVAL}s)"
    )
    while True:
        _wake.wait(timeout=POLL_INTERVAL)
        _wake.clear()
        with _run_lock:
            _stats["running"] = True
            try:
                idle_waves = 0
                max_rounds = max(1, int(os.getenv("NORMALIZE_MAX_ROUNDS", "10")))
                for _ in range(max_rounds):
                    result = _drain_once(llm_client)
                    _stats["last_run"] = datetime.now(timezone.utc).isoformat()
                    _stats["last_normalized"] = result["normalized"]
                    _stats["last_embedded"] = result["embedded"]
                    _stats["total_normalized"] += result["normalized"]
                    _stats["total_embedded"] += result["embedded"]
                    if result["normalized"] == 0 and result["embedded"] == 0:
                        idle_waves += 1
                        if idle_waves >= 2:
                            break
                    else:
                        idle_waves = 0
                    if _wake.is_set():
                        _wake.clear()
                        idle_waves = 0
            except Exception:
                logger.exception("Pipeline worker drain failed")
                time.sleep(5)
            finally:
                _stats["running"] = False


def start_pipeline_worker() -> None:
    global _started
    if _started:
        return
    _started = True
    thread = threading.Thread(target=_loop, name="normalize-pipeline", daemon=True)
    thread.start()
    wake_pipeline()
