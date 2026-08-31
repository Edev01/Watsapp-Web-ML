#!/usr/bin/env python3
"""
Test database connection stability.
This script checks if the database connection can handle multiple operations over time.
"""

import sys
import time

import _bootstrap  # noqa: F401
from app.database import SessionLocal
from app.models_db import WhatsAppMessage, NormalizedMessage
from sqlalchemy import text

def test_connection_stability():
    """Test if database connection remains stable over multiple operations."""
    print("=" * 50)
    print("DATABASE CONNECTION STABILITY TEST")
    print("=" * 50)
    print()
    
    db = SessionLocal()
    
    try:
        # Test 1: Basic connectivity
        print("Test 1: Basic connectivity...")
        result = db.execute(text("SELECT 1")).scalar()
        print(f"  [OK] Basic query works: {result}")
        print()
        
        # Test 2: Query whatsapp_messages
        print("Test 2: Query whatsapp_messages table...")
        count = db.query(WhatsAppMessage).count()
        print(f"  [OK] Total messages: {count}")
        print()
        
        # Test 3: Query normalized_messages
        print("Test 3: Query normalized_messages table...")
        norm_count = db.query(NormalizedMessage).count()
        print(f"  [OK] Normalized messages: {norm_count}")
        print()
        
        # Test 4: Connection persistence over time
        print("Test 4: Connection persistence (10 queries with delays)...")
        for i in range(10):
            time.sleep(2)  # Simulate processing delay
            count = db.execute(text("SELECT COUNT(*) FROM whatsapp_messages")).scalar()
            print(f"  Query {i+1}/10: {count} messages [OK]")
        print()
        
        # Test 5: Transaction handling
        print("Test 5: Transaction handling...")
        sample_msg = db.query(WhatsAppMessage).first()
        if sample_msg:
            print(f"  [OK] Query within transaction works")
        db.rollback()
        print(f"  [OK] Transaction rollback works")
        print()
        
        # Test 6: Connection recovery after idle
        print("Test 6: Connection recovery after 30s idle period...")
        print("  Waiting 30 seconds...")
        time.sleep(30)
        count = db.query(WhatsAppMessage).count()
        print(f"  [OK] Query after idle: {count} messages")
        print()
        
        print("=" * 50)
        print("ALL TESTS PASSED!")
        print("=" * 50)
        print()
        print("Your database connection is stable and ready for")
        print("long-running normalization operations.")
        print()
        print("You can now safely run: NORMALIZE_OVERNIGHT.bat")
        print()
        
    except Exception as e:
        print()
        print("=" * 50)
        print("TEST FAILED!")
        print("=" * 50)
        print()
        print(f"Error: {str(e)}")
        print()
        print("Possible issues:")
        print("1. Database credentials incorrect in .env")
        print("2. Database server is down")
        print("3. Network connectivity issues")
        print("4. Firewall blocking connection")
        print()
        return False
    
    finally:
        db.close()
    
    return True

if __name__ == "__main__":
    success = test_connection_stability()
    sys.exit(0 if success else 1)
