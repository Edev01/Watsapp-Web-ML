#!/usr/bin/env python3
"""
Normalize all messages in a continuous loop until complete.
This script runs until all messages are normalized.
"""

import sys
import time
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.database import SessionLocal, init_db
from app.models_db import WhatsAppMessage, NormalizedMessage
from app.llm import LLMClient, get_default_model
from app.normalizer import process_unnormalized_messages

MODEL_NAME = get_default_model()

def get_progress():
    """Get current normalization progress."""
    db = SessionLocal()
    try:
        total = db.query(WhatsAppMessage).count()
        normalized = db.query(NormalizedMessage).filter(
            NormalizedMessage.model_used == MODEL_NAME
        ).count()
        remaining = total - normalized
        progress_pct = (normalized / total * 100) if total > 0 else 0
        return total, normalized, remaining, progress_pct
    finally:
        db.close()

def main():
    print("=" * 60)
    print("CONTINUOUS NORMALIZATION")
    print("=" * 60)
    print()
    
    # Initialize database
    init_db()
    
    # Get initial status
    total, normalized, remaining, progress_pct = get_progress()
    
    print(f"Initial status:")
    print(f"  Total messages: {total:,}")
    print(f"  Already normalized: {normalized:,}")
    print(f"  Remaining: {remaining:,}")
    print(f"  Progress: {progress_pct:.1f}%")
    print()
    
    if remaining == 0:
        print("All messages are already normalized!")
        print()
        return
    
    print("Starting continuous normalization...")
    print("Press Ctrl+C to stop (progress will be saved)")
    print()
    print("-" * 60)
    print()
    
    batch_num = 0
    total_normalized_this_run = 0
    
    try:
        while True:
            batch_num += 1
            
            # Process one batch
            db = SessionLocal()
            try:
                client = LLMClient()
                count = process_unnormalized_messages(
                    db=db,
                    llm_client=client,
                    model_name=MODEL_NAME,
                    batch_size=300
                )
                
                if count == 0:
                    # No more messages to process
                    print()
                    print("=" * 60)
                    print("ALL MESSAGES NORMALIZED!")
                    print("=" * 60)
                    break
                
                total_normalized_this_run += count
                
                # Get updated progress
                total, normalized, remaining, progress_pct = get_progress()
                
                print()
                print(f"Batch #{batch_num} complete: {count} messages normalized")
                print(f"Progress: {normalized:,}/{total:,} ({progress_pct:.1f}%)")
                print(f"Remaining: {remaining:,}")
                print(f"This run: {total_normalized_this_run:,} messages")
                
                # Estimate time remaining
                if total_normalized_this_run > 0 and batch_num > 0:
                    avg_per_batch = total_normalized_this_run / batch_num
                    batches_remaining = remaining / avg_per_batch if avg_per_batch > 0 else 0
                    # Assuming ~2 minutes per batch
                    minutes_remaining = batches_remaining * 2
                    hours_remaining = minutes_remaining / 60
                    print(f"Estimated time remaining: {hours_remaining:.1f} hours")
                
                print("-" * 60)
                print()
                
                # Small delay before next batch
                time.sleep(1)
                
            finally:
                db.close()
    
    except KeyboardInterrupt:
        print()
        print()
        print("=" * 60)
        print("NORMALIZATION PAUSED")
        print("=" * 60)
        print()
        print(f"Normalized this run: {total_normalized_this_run:,} messages")
        
        # Get final progress
        total, normalized, remaining, progress_pct = get_progress()
        print(f"Current progress: {normalized:,}/{total:,} ({progress_pct:.1f}%)")
        print(f"Remaining: {remaining:,}")
        print()
        print("Run this script again to continue!")
        print()
        return
    
    # Final summary
    print()
    total, normalized, remaining, progress_pct = get_progress()
    print(f"Final status:")
    print(f"  Total messages: {total:,}")
    print(f"  Normalized: {normalized:,}")
    print(f"  This run: {total_normalized_this_run:,}")
    print(f"  Progress: {progress_pct:.1f}%")
    print()
    
    if remaining == 0:
        print("🎉 All messages successfully normalized!")
        print()
        print("Next step: Generate embeddings")
        print("  python main.py embed")
        print()

if __name__ == "__main__":
    main()
