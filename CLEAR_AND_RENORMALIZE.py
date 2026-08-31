"""
Clear all normalized data and embeddings, then start fresh.

This script will:
1. Delete all records from normalized_messages table
2. Delete all records from message_embeddings table
3. Keep raw whatsapp_messages (your source data is safe!)
4. Allow you to re-normalize with corrected prompts

WHY YOU MIGHT NEED THIS:
- Fixed LLM prompts (like the purpose="SALE" fix)
- Want to apply new normalization rules
- Found issues in normalized data
"""

from app.database import SessionLocal
from sqlalchemy import text
import sys

def confirm_action():
    """Ask user to confirm before deleting data."""
    print("\n" + "="*70)
    print("⚠️  WARNING: THIS WILL DELETE ALL NORMALIZED DATA!")
    print("="*70)
    print("\nWhat will be DELETED:")
    print("  ❌ All records in 'normalized_messages' table")
    print("  ❌ All records in 'message_embeddings' table")
    print("\nWhat will be KEPT:")
    print("  ✅ All raw WhatsApp messages (your source data is safe!)")
    print("  ✅ All chats and contacts")
    print("  ✅ All QR codes and users")
    print("\nAfter running this, you must:")
    print("  1. Run: python main.py normalize")
    print("  2. Run: python main.py embed")
    print("\n" + "="*70)
    
    response = input("\nType 'YES' to proceed, anything else to cancel: ")
    return response.strip().upper() == 'YES'

def clear_normalized_data():
    """Clear normalized_messages and message_embeddings tables."""
    db = SessionLocal()
    
    try:
        print("\n[1/3] Counting current records...")
        
        # Count current records
        norm_count = db.execute(text("SELECT COUNT(*) FROM normalized_messages")).scalar()
        embed_count = db.execute(text("SELECT COUNT(*) FROM message_embeddings")).scalar()
        
        print(f"  - Normalized messages: {norm_count}")
        print(f"  - Message embeddings: {embed_count}")
        
        if norm_count == 0 and embed_count == 0:
            print("\n✅ Tables are already empty. Nothing to delete.")
            return True
        
        print("\n[2/3] Deleting message embeddings...")
        db.execute(text("DELETE FROM message_embeddings"))
        db.commit()
        print(f"  ✅ Deleted {embed_count} embeddings")
        
        print("\n[3/3] Deleting normalized messages...")
        db.execute(text("DELETE FROM normalized_messages"))
        db.commit()
        print(f"  ✅ Deleted {norm_count} normalized messages")
        
        print("\n" + "="*70)
        print("✅ SUCCESS! All normalized data has been cleared.")
        print("="*70)
        print("\nNext steps:")
        print("  1. Run: python main.py normalize")
        print("     (This will re-process all messages with new prompts)")
        print("\n  2. Run: python main.py embed")
        print("     (This will regenerate embeddings)")
        print("\n  Or use the batch file: NORMALIZE_ALL_DATA.bat")
        print("="*70)
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        db.rollback()
        return False
        
    finally:
        db.close()

def show_raw_data_status():
    """Show status of raw WhatsApp messages (not affected by this script)."""
    db = SessionLocal()
    
    try:
        print("\n" + "="*70)
        print("📊 RAW DATA STATUS (NOT AFFECTED BY THIS SCRIPT)")
        print("="*70)
        
        raw_count = db.execute(text("SELECT COUNT(*) FROM whatsapp_messages")).scalar()
        chat_count = db.execute(text("SELECT COUNT(*) FROM whatsapp_chats")).scalar()
        
        print(f"  ✅ Raw WhatsApp messages: {raw_count} (SAFE)")
        print(f"  ✅ Chats: {chat_count} (SAFE)")
        print("\nYour source data is safe! You can re-normalize anytime.")
        print("="*70)
        
    except Exception as e:
        print(f"Error checking raw data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║  CLEAR NORMALIZED DATA & EMBEDDINGS                                ║")
    print("╚" + "="*68 + "╝")
    
    # Show current status
    show_raw_data_status()
    
    # Ask for confirmation
    if not confirm_action():
        print("\n❌ Cancelled. No data was deleted.")
        sys.exit(0)
    
    # Clear the data
    success = clear_normalized_data()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
