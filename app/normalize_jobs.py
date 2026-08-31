"""DB helpers for per-user normalize_jobs (shared with Node portal backend)."""
import logging
import os
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("whatsapp_ai.normalize_jobs")

DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen2.5:7b")


def claim_job(db: Session, user_id: int) -> Optional[Dict[str, Any]]:
    """Mark a queued (or re-claimable) job as running. Returns job dict or None."""
    row = db.execute(
        text(
            """
            UPDATE normalize_jobs
            SET status = 'running',
                started_at = COALESCE(started_at, NOW()),
                finished_at = NULL,
                last_error = NULL,
                updated_at = NOW()
            WHERE user_id = :uid
              AND status IN ('queued', 'running')
            RETURNING user_id, status, model_used, embed, batch_size,
                      processed_this_run, started_at, finished_at, last_error
            """
        ),
        {"uid": int(user_id)},
    ).mappings().first()
    db.commit()
    return dict(row) if row else None


def bump_processed(db: Session, user_id: int, delta: int) -> None:
    if delta <= 0:
        return
    db.execute(
        text(
            """
            UPDATE normalize_jobs
            SET processed_this_run = COALESCE(processed_this_run, 0) + :d,
                updated_at = NOW()
            WHERE user_id = :uid
            """
        ),
        {"uid": int(user_id), "d": int(delta)},
    )
    db.commit()


def complete_job(db: Session, user_id: int) -> None:
    db.execute(
        text(
            """
            UPDATE normalize_jobs
            SET status = 'completed',
                finished_at = NOW(),
                last_error = NULL,
                updated_at = NOW()
            WHERE user_id = :uid
            """
        ),
        {"uid": int(user_id)},
    )
    db.commit()


def fail_job(db: Session, user_id: int, error: str) -> None:
    db.execute(
        text(
            """
            UPDATE normalize_jobs
            SET status = 'failed',
                finished_at = NOW(),
                last_error = :err,
                updated_at = NOW()
            WHERE user_id = :uid
            """
        ),
        {"uid": int(user_id), "err": str(error or "Unknown error")[:2000]},
    )
    db.commit()


def ensure_queued_job(
    db: Session,
    user_id: int,
    model: str,
    embed: bool = True,
    batch_size: int = 50,
) -> Dict[str, Any]:
    """Insert or refresh a queued job (used when HTTP run is called directly)."""
    row = db.execute(
        text(
            """
            INSERT INTO normalize_jobs (
              user_id, status, model_used, embed, batch_size,
              processed_this_run, started_at, finished_at, last_error, updated_at
            ) VALUES (
              :uid, 'queued', :model, :embed, :batch,
              0, NOW(), NULL, NULL, NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
              status = CASE
                WHEN normalize_jobs.status IN ('queued', 'running')
                  THEN normalize_jobs.status
                ELSE 'queued'
              END,
              model_used = EXCLUDED.model_used,
              embed = EXCLUDED.embed,
              batch_size = EXCLUDED.batch_size,
              processed_this_run = CASE
                WHEN normalize_jobs.status IN ('queued', 'running')
                  THEN normalize_jobs.processed_this_run
                ELSE 0
              END,
              started_at = CASE
                WHEN normalize_jobs.status IN ('queued', 'running')
                  THEN normalize_jobs.started_at
                ELSE NOW()
              END,
              finished_at = CASE
                WHEN normalize_jobs.status IN ('queued', 'running')
                  THEN normalize_jobs.finished_at
                ELSE NULL
              END,
              last_error = CASE
                WHEN normalize_jobs.status IN ('queued', 'running')
                  THEN normalize_jobs.last_error
                ELSE NULL
              END,
              updated_at = NOW()
            RETURNING user_id, status, model_used, embed, batch_size,
                      processed_this_run, started_at, finished_at, last_error
            """
        ),
        {
            "uid": int(user_id),
            "model": model or DEFAULT_MODEL,
            "embed": bool(embed),
            "batch": int(batch_size),
        },
    ).mappings().first()
    db.commit()
    return dict(row) if row else {}


def list_queued_user_ids(db: Session, limit: int = 5) -> List[int]:
    rows = db.execute(
        text(
            """
            SELECT user_id
            FROM normalize_jobs
            WHERE status = 'queued'
            ORDER BY updated_at ASC
            LIMIT :lim
            """
        ),
        {"lim": int(limit)},
    ).fetchall()
    return [int(r[0]) for r in rows]


def get_job(db: Session, user_id: int) -> Optional[Dict[str, Any]]:
    row = db.execute(
        text(
            """
            SELECT user_id, status, model_used, embed, batch_size,
                   processed_this_run, started_at, finished_at, last_error, updated_at
            FROM normalize_jobs
            WHERE user_id = :uid
            """
        ),
        {"uid": int(user_id)},
    ).mappings().first()
    return dict(row) if row else None
