"""
Automated Real-Time Data Processing Pipeline

This script runs continuously and processes new WhatsApp messages every 5 minutes:
1. Checks for new messages
2. Removes duplicates
3. Normalizes new messages
4. Generates embeddings

Perfect for real-time property scraping where messages arrive continuously.

Usage:
    python auto_pipeline.py

Or run in background:
    Windows: start /B python auto_pipeline.py
    Linux: nohup python auto_pipeline.py &
"""
import time
import logging
import os
from datetime import datetime
from sqlalchemy import text
from app.database import SessionLocal, init_db
from app.llm import LLMClient
from app.normalizer import process_unnormalized_messages
from app.embeddings import generate_and_store_embeddings
from app import normalize_jobs as jobs
from app.normalize_runner import run_normalize_for_user, is_user_running
from app.normalize_config import (
    normalize_concurrency,
    recommended_check_interval,
    max_batch_rounds_per_cycle,
    is_local_llm,
    llm_base_url,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('auto_pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
CHECK_INTERVAL = recommended_check_interval()
MODEL_NAME = os.getenv("DEFAULT_MODEL", "qwen2.5:7b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
BATCH_SIZE = int(os.getenv("NORMALIZE_BATCH_SIZE", "80" if not is_local_llm() else "20"))
EMBED_ENABLED = os.getenv("EMBED_ENABLED", "false").lower() in ("1", "true", "yes")
MAX_ROUNDS = max_batch_rounds_per_cycle()


def check_for_new_messages(db) -> int:
    """Check how many new unnormalized messages exist (respects NORMALIZE_MIN_MESSAGE_ID)."""
    try:
        from app.models_db import WhatsAppMessage, NormalizedMessage
        from sqlalchemy import select
        from app.normalizer import _min_message_id_cutoff

        # Count messages not yet normalized
        processed_ids_stmt = (
            select(NormalizedMessage.whatsapp_message_id)
            .filter(NormalizedMessage.model_used == MODEL_NAME)
        )

        query = (
            db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.id.not_in(processed_ids_stmt))
            .filter(WhatsAppMessage.message.isnot(None))
        )
        cutoff = _min_message_id_cutoff()
        if cutoff is not None:
            query = query.filter(WhatsAppMessage.id > int(cutoff))

        return query.count()
    except Exception as e:
        logger.error(f"Error checking for new messages: {e}")
        return 0


# Deduplication removed - now handled automatically by database constraint!
# Database prevents duplicates at insertion time with UNIQUE(user_id, message)


def process_new_messages(db, llm_client) -> dict:
    """Process new messages through the entire pipeline."""
    stats = {
        'normalized': 0,
        'embeddings_generated': 0,
        'errors': 0
    }
    
    try:
        # Step 1: Normalize new messages (duplicates prevented by DB constraint)
        logger.info("Step 1: Normalizing new messages...")
        stats['normalized'] = process_unnormalized_messages(
            db=db,
            llm_client=llm_client,
            model_name=MODEL_NAME,
            batch_size=BATCH_SIZE,
            newest_first=True,  # new scrapes (e.g. user 43) before old backlog
        )
        
        # Step 2: Generate embeddings (optional — cloud LLMs like Groq often have no embed API)
        if stats['normalized'] > 0 and EMBED_ENABLED:
            logger.info("Step 2: Generating embeddings...")
            try:
                stats['embeddings_generated'] = generate_and_store_embeddings(
                    db=db,
                    target_llm_model=MODEL_NAME,
                    embedding_model=EMBEDDING_MODEL
                )
            except Exception as emb_err:
                logger.warning(f"Embedding step skipped/failed: {emb_err}")
        elif stats['normalized'] > 0:
            logger.info("Step 2: Embeddings disabled (EMBED_ENABLED=false)")
        
        return stats
        
    except Exception as e:
        logger.error(f"Error in processing pipeline: {e}")
        stats['errors'] = 1
        return stats


def run_pipeline_loop():
    """Main loop that runs every 5 minutes."""
    logger.info("=" * 80)
    logger.info("AUTOMATED REAL-TIME PROCESSING PIPELINE STARTED")
    logger.info("=" * 80)
    logger.info(f"Configuration:")
    logger.info(f"  • Check interval: {CHECK_INTERVAL} seconds")
    logger.info(f"  • LLM: {llm_base_url()} ({'local' if is_local_llm() else 'cloud'})")
    logger.info(f"  • Model: {MODEL_NAME}")
    logger.info(f"  • Batch size: {BATCH_SIZE}")
    logger.info(f"  • Concurrency: {normalize_concurrency()}")
    logger.info(f"  • Max rounds/cycle: {MAX_ROUNDS}")
    logger.info(f"  • Embeddings: {EMBED_ENABLED}")
    logger.info("=" * 80)
    
    # Initialize database
    init_db()
    llm_client = LLMClient()
    
    iteration = 0
    
    while True:
        iteration += 1
        try:
            logger.info(f"\n{'='*80}")
            logger.info(f"PIPELINE RUN #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"{'='*80}")
            
            # Prefer portal-triggered per-user jobs (normalize_jobs.status = queued)
            db = SessionLocal()
            queued_ids = []
            try:
                queued_ids = jobs.list_queued_user_ids(db, limit=5)
            except Exception as qerr:
                logger.warning(f"Could not read normalize_jobs queue: {qerr}")
            finally:
                db.close()

            if queued_ids:
                logger.info(f"📋 Found {len(queued_ids)} queued user normalize job(s): {queued_ids}")
                for uid in queued_ids:
                    if is_user_running(uid):
                        logger.info(f"  • user {uid} already running — skip")
                        continue
                    job_row = None
                    dbj = SessionLocal()
                    try:
                        job_row = jobs.get_job(dbj, uid)
                    finally:
                        dbj.close()
                    result = run_normalize_for_user(
                        user_id=uid,
                        model=(job_row or {}).get("model_used") or MODEL_NAME,
                        batch_size=int((job_row or {}).get("batch_size") or BATCH_SIZE),
                        embed=bool((job_row or {}).get("embed", True)),
                    )
                    logger.info(f"  • user {uid} job result: {result}")

            # Check for new messages (global backlog)
            db = SessionLocal()
            new_message_count = check_for_new_messages(db)
            
            if new_message_count > 0:
                logger.info(f"📥 Found {new_message_count} new messages to process")

                total_normalized = 0
                total_embeddings = 0
                for round_num in range(1, MAX_ROUNDS + 1):
                    stats = process_new_messages(db, llm_client)
                    total_normalized += stats["normalized"]
                    total_embeddings += stats["embeddings_generated"]
                    if stats["normalized"] == 0 or stats.get("errors"):
                        break
                    remaining = check_for_new_messages(db)
                    logger.info(f"  ↻ Round {round_num}: +{stats['normalized']} normalized, {remaining} still pending")
                    if remaining == 0:
                        break

                logger.info(f"\n{'='*80}")
                logger.info(f"PIPELINE RUN #{iteration} - RESULTS")
                logger.info(f"{'='*80}")
                logger.info(f"  • Messages normalized: {total_normalized}")
                logger.info(f"  • Embeddings generated: {total_embeddings}")
                
            else:
                logger.info("✓ No new messages to process. Database is up to date.")
            
            db.close()
            
            # Wait for next interval
            logger.info(f"\n⏳ Waiting {CHECK_INTERVAL//60} minutes until next check...")
            logger.info(f"   Next run at: {datetime.fromtimestamp(time.time() + CHECK_INTERVAL).strftime('%Y-%m-%d %H:%M:%S')}")
            time.sleep(CHECK_INTERVAL)
            
        except KeyboardInterrupt:
            logger.info("\n\n🛑 Pipeline stopped by user (Ctrl+C)")
            break
        except Exception as e:
            logger.error(f"❌ Unexpected error in main loop: {e}")
            logger.info(f"⏳ Retrying in {CHECK_INTERVAL//60} minutes...")
            time.sleep(CHECK_INTERVAL)
    
    logger.info("=" * 80)
    logger.info("AUTOMATED PIPELINE SHUT DOWN")
    logger.info("=" * 80)


if __name__ == "__main__":
    import sys
    
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                   AUTOMATED REAL-TIME PROCESSING PIPELINE                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

This script will:
  1. Check for new WhatsApp messages every 5 minutes
  2. Normalize new messages with AI
  3. Generate embeddings for semantic search
  4. Keep your search database up-to-date in real-time

Note: Duplicates are now prevented automatically by the database!

Press Ctrl+C to stop the pipeline.

Logs are saved to: auto_pipeline.log

════════════════════════════════════════════════════════════════════════════════
""")
    
    try:
        run_pipeline_loop()
    except KeyboardInterrupt:
        print("\n\n✓ Pipeline stopped.")
        sys.exit(0)
