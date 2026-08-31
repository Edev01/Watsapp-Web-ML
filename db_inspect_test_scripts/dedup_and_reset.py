"""
Enhanced script to deduplicate whatsapp_messages table and perform a clean reset.
Keeps only the FIRST occurrence (lowest id) for each unique message text.

This script will:
1. Show current database statistics
2. Clear all processed data (embeddings, normalized messages, comparisons)
3. Remove duplicate raw messages
4. Verify cleanup was successful
"""
import _bootstrap  # noqa: F401
from app.database import SessionLocal
from sqlalchemy import text
import sys

def main():
    db = SessionLocal()
    
    try:
        print("=" * 80)
        print("DATABASE CLEANUP & DEDUPLICATION SCRIPT")
        print("=" * 80)
        
        # Step 1: Show current statistics
        print("\n=== CURRENT DATABASE STATISTICS ===")
        
        r = db.execute(text("SELECT COUNT(*) FROM whatsapp_messages")).fetchone()
        total_raw = r[0]
        print(f"  Total raw messages: {total_raw}")
        
        r = db.execute(text("SELECT COUNT(*) FROM normalized_messages")).fetchone()
        total_normalized = r[0]
        print(f"  Total normalized records: {total_normalized}")
        
        r = db.execute(text("SELECT COUNT(*) FROM message_embeddings")).fetchone()
        total_embeddings = r[0]
        print(f"  Total embeddings: {total_embeddings}")
        
        # Count duplicates
        r = db.execute(text("""
            SELECT COUNT(*) FROM (
                SELECT message, chat_jid, COUNT(*) as cnt
                FROM whatsapp_messages
                GROUP BY message, chat_jid
                HAVING COUNT(*) > 1
            ) dupes
        """)).fetchone()
        duplicate_groups = r[0]
        print(f"  Duplicate message groups: {duplicate_groups}")
        
        if duplicate_groups > 0:
            r = db.execute(text("""
                SELECT SUM(cnt) - COUNT(*) as extra_copies FROM (
                    SELECT COUNT(*) as cnt
                    FROM whatsapp_messages
                    GROUP BY message, chat_jid
                    HAVING COUNT(*) > 1
                ) dupes
            """)).fetchone()
            print(f"  Total duplicate copies to remove: {r[0]}")
        
        # Ask for confirmation
        print("\n" + "=" * 80)
        print("WARNING: This will delete all normalized data and embeddings!")
        print("=" * 80)
        confirmation = input("\nDo you want to proceed? Type 'YES' to continue: ")
        
        if confirmation != "YES":
            print("\nOperation cancelled by user.")
            return
        
        print("\n=== STEP 1: Clearing processed data ===")
        db.execute(text("TRUNCATE message_embeddings CASCADE"))
        print("  ✓ Cleared embeddings")
        
        db.execute(text("TRUNCATE normalized_messages CASCADE"))
        print("  ✓ Cleared normalized messages")
        
        db.execute(text("TRUNCATE model_comparisons CASCADE"))
        print("  ✓ Cleared model comparisons")
        
        db.commit()
        print("  ✓ All processed data cleared successfully")
        
        print("\n=== STEP 2: Deduplicating raw messages ===")
        print("  Strategy: Keep only ONE copy of each unique property, regardless of which chat it came from")
        print("  (For property search, we don't need to track which WhatsApp group posted it)")
        
        result = db.execute(text("""
            DELETE FROM whatsapp_messages
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM whatsapp_messages
                GROUP BY message
            )
        """))
        
        db.commit()
        deleted_count = result.rowcount if hasattr(result, 'rowcount') else 0
        print(f"  ✓ Removed {deleted_count} duplicate messages (same property from different chats)")
        
        print("\n=== STEP 3: Verification ===")
        
        r = db.execute(text("SELECT COUNT(*) FROM whatsapp_messages")).fetchone()
        final_raw = r[0]
        print(f"  Final raw message count: {final_raw}")
        print(f"  Total removed: {total_raw - final_raw}")
        
        r = db.execute(text("""
            SELECT COUNT(*) FROM (
                SELECT message, chat_jid, COUNT(*) as cnt
                FROM whatsapp_messages
                GROUP BY message, chat_jid
                HAVING COUNT(*) > 1
            ) dupes
        """)).fetchone()
        remaining_dupes = r[0]
        
        if remaining_dupes == 0:
            print("  ✓ No duplicates remaining - database is clean!")
        else:
            print(f"  ⚠ Warning: {remaining_dupes} duplicate groups still exist")
        
        # Show sample of remaining messages
        print("\n=== SAMPLE: First 5 messages in database ===")
        r = db.execute(text("""
            SELECT id, LEFT(message, 60) as msg_preview
            FROM whatsapp_messages
            ORDER BY id
            LIMIT 5
        """)).fetchall()
        
        for row in r:
            print(f"  ID {row[0]}: {row[1]}...")
        
        print("\n" + "=" * 80)
        print("✓ DATABASE CLEANUP COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        print("\nNext steps:")
        print("  1. Run normalization: python main.py normalize --model qwen2.5:7b --batch 100")
        print("  2. Generate embeddings: python main.py embed --model qwen2.5:7b")
        print("  3. Test search: python main.py search \"apartment in Clifton Karachi\"")
        print()
        
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
