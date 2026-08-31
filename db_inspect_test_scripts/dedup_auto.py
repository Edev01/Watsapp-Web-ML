"""
Automated deduplication script (no user confirmation required).
Safe to run in automated pipelines.
Only removes duplicates, doesn't clear normalized data.
"""
import _bootstrap  # noqa: F401
from app.database import SessionLocal
from sqlalchemy import text
import sys

def main():
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("AUTOMATED DEDUPLICATION")
        print("=" * 60)
        
        # Count duplicates before
        r = db.execute(text("""
            SELECT COUNT(*) - COUNT(DISTINCT message) as duplicate_count
            FROM whatsapp_messages
        """)).fetchone()
        duplicate_count = r[0]
        
        if duplicate_count == 0:
            print("✓ No duplicates found - database is clean!")
            return
        
        print(f"Found {duplicate_count} duplicate messages to remove...")
        
        # Remove duplicates (keep first occurrence only)
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
        print(f"✓ Removed {deleted_count} duplicate messages")
        
        # Verify
        r = db.execute(text("""
            SELECT COUNT(*) - COUNT(DISTINCT message) as duplicate_count
            FROM whatsapp_messages
        """)).fetchone()
        remaining = r[0]
        
        if remaining == 0:
            print("✓ Deduplication completed successfully!")
        else:
            print(f"⚠ Warning: {remaining} duplicates still remain")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
