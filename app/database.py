import logging
import os
import time
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker, Session

load_dotenv()

logger = logging.getLogger("whatsapp_ai.database")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set in .env")

# One global lock id so only one process runs migrations at a time (CLI + uvicorn worker).
_INIT_DB_ADVISORY_LOCK_ID = 83927401

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Test connections before using them
    pool_size=20,
    max_overflow=30,
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_timeout=30,  # Timeout for getting connection from pool
    connect_args={
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
        "connect_timeout": 10,
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Yield a database session context."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(*, skip_if_busy: bool = False) -> None:
    """Create missing database tables if they do not exist."""
    for attempt in range(3):
        try:
            if _init_db_locked(skip_if_busy=skip_if_busy):
                return
            if skip_if_busy:
                logger.info("init_db skipped — another process is updating the database schema.")
                return
            wait = 0.5 * (2**attempt)
            logger.warning("init_db waiting for migration lock (attempt %s/3)...", attempt + 1)
            time.sleep(wait)
        except OperationalError as exc:
            pgcode = getattr(getattr(exc, "orig", None), "pgcode", None)
            if pgcode == "40P01" and attempt < 2:  # deadlock_detected
                wait = 0.5 * (2**attempt)
                logger.warning("init_db deadlock (attempt %s/3), retrying in %.1fs...", attempt + 1, wait)
                time.sleep(wait)
                continue
            if skip_if_busy and pgcode in ("57014", "55P03"):  # query timeout / lock_not_available
                logger.info("init_db skipped — database busy (timeout waiting for migration lock).")
                return
            raise

    if skip_if_busy:
        logger.info("init_db skipped — could not acquire migration lock in time.")
        return
    raise RuntimeError("init_db failed: could not acquire migration lock after retries.")


def _init_db_locked(*, skip_if_busy: bool = False) -> bool:
    """Run migrations under a Postgres advisory lock. Returns True if migrations ran."""
    alter_statements = [
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS city VARCHAR;",
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS is_property BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS purpose VARCHAR;",
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS property_type VARCHAR;",
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS area VARCHAR;",
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS vicinity VARCHAR;",
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS size VARCHAR;",
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS price VARCHAR;",
        "ALTER TABLE normalized_messages ADD COLUMN IF NOT EXISTS contact_number VARCHAR;",
        "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS user_id INTEGER DEFAULT 1;",
        "ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS from_me BOOLEAN DEFAULT FALSE;",
    ]

    view_sql = """
    CREATE OR REPLACE VIEW public.compare_normalizations_view AS
    SELECT 
        m.id AS raw_message_id,
        m.message AS raw_message,
        qwen.summary AS qwen_summary,
        qwen.category AS qwen_category,
        qwen.intent AS qwen_intent,
        llama.summary AS llama_summary,
        llama.category AS llama_category,
        llama.intent AS llama_intent,
        deepseek.summary AS deepseek_summary,
        deepseek.category AS deepseek_category,
        deepseek.intent AS deepseek_intent
    FROM whatsapp_messages m
    LEFT JOIN normalized_messages qwen ON m.id = qwen.whatsapp_message_id AND qwen.model_used = 'qwen2.5:7b'
    LEFT JOIN normalized_messages llama ON m.id = llama.whatsapp_message_id AND llama.model_used = 'llama3.1:8b'
    LEFT JOIN normalized_messages deepseek ON m.id = deepseek.whatsapp_message_id AND deepseek.model_used = 'deepseek-r1:7b';
    """

    with engine.connect() as conn:
        locked = conn.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)"),
            {"lock_id": _INIT_DB_ADVISORY_LOCK_ID},
        ).scalar()
        conn.commit()
        if not locked:
            return False
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()

            Base.metadata.create_all(bind=engine)

            for stmt in alter_statements:
                conn.execute(text(stmt))
            conn.commit()

            conn.execute(text(view_sql))
            conn.commit()
            return True
        finally:
            conn.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"),
                {"lock_id": _INIT_DB_ADVISORY_LOCK_ID},
            )
            conn.commit()


