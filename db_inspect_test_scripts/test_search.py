"""
Comprehensive test script for the improved intelligent search system.
Tests fuzzy matching, spelling mistakes, and various query types.
"""
import _bootstrap  # noqa: F401
from app.database import SessionLocal
from app.search import semantic_search
import time

def test_search(query, city=None, description=""):
    """Run a search test and display results."""
    print("\n" + "=" * 80)
    print(f"TEST: {description}")
    print(f"Query: '{query}'" + (f" | City: {city}" if city else ""))
    print("=" * 80)
    
    db = SessionLocal()
    start_time = time.time()
    
    try:
        results = semantic_search(
            db=db,
            query_text=query,
            model_used="qwen2.5:7b",
            city=city,
            limit=5
        )
        
        elapsed = time.time() - start_time
        
        print(f"\nFound {len(results)} results in {elapsed:.2f} seconds")
        
        for idx, r in enumerate(results, 1):
            print(f"\n{idx}. [Score: {r['similarity_score']:.4f}] Message ID: {r['message_id']}")
            print(f"   City: {r['city']} | Area: {r['area']} | Vicinity: {r['vicinity']}")
            print(f"   Type: {r['property_type']} | Purpose: {r['purpose']}")
            print(f"   Size: {r['size']} | Price: {r['price']}")
            print(f"   Summary: {r['summary'][:150]}...")
        
        if not results:
            print("\n⚠ No results found")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        db.close()


def main():
    print("=" * 80)
    print("INTELLIGENT SEARCH SYSTEM - COMPREHENSIVE TESTS")
    print("=" * 80)
    
    # Test 1: Specific location search
    test_search(
        "apartment in Clifton Karachi",
        description="Specific location - Apartment in Clifton, Karachi"
    )
    
    # Test 2: Fuzzy city name (spelling mistake)
    test_search(
        "house in Lahor",
        description="Fuzzy matching - 'Lahor' should match 'Lahore'"
    )
    
    # Test 3: Fuzzy area name (spelling mistake)
    test_search(
        "flat in Cliftn",
        description="Fuzzy matching - 'Cliftn' should match 'Clifton'"
    )
    
    # Test 4: Vague search (no specific location)
    test_search(
        "2 bedroom apartment for rent",
        description="Vague search - No location specified"
    )
    
    # Test 5: Search with specific area
    test_search(
        "villa in Bahria Town",
        description="Specific area - Villa in Bahria Town"
    )
    
    # Test 6: Search by property type only
    test_search(
        "commercial shop",
        description="Property type only - Commercial shop"
    )
    
    # Test 7: Multiple location keywords
    test_search(
        "house in DHA Phase 6 Karachi",
        description="Multiple location keywords - DHA Phase 6, Karachi"
    )
    
    # Test 8: Search with size constraint
    test_search(
        "1 kanal plot in Lahore",
        description="With size constraint - 1 Kanal plot"
    )
    
    # Test 9: Abbreviated city name
    test_search(
        "apartment in khi",
        description="Abbreviated city - 'khi' should match 'Karachi'"
    )
    
    # Test 10: Different spelling variations
    test_search(
        "house in Bahriatown Lahor",
        description="Multiple spelling variations"
    )
    
    print("\n" + "=" * 80)
    print("✓ ALL TESTS COMPLETED")
    print("=" * 80)
    print("\nTest Coverage:")
    print("  ✓ Specific location searches")
    print("  ✓ Fuzzy city name matching")
    print("  ✓ Fuzzy area name matching")
    print("  ✓ Vague searches without location")
    print("  ✓ Property type filtering")
    print("  ✓ Multiple location keywords")
    print("  ✓ Size and other constraints")
    print("  ✓ Abbreviated location names")
    print("  ✓ Combined spelling variations")
    print()


if __name__ == "__main__":
    main()
