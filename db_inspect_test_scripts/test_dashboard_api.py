"""
Quick test script for the dashboard API endpoint
Run after: python main.py ui --port 8000
"""
import requests
import json

# Test endpoint
API_URL = "http://localhost:8000/api/dashboard-search"

def test_search(test_name, payload):
    """Test a search request"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")
    print(f"Request: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(API_URL, json=payload)
        data = response.json()
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Success: {data.get('success')}")
        print(f"Count: {data.get('count')}")
        
        if data.get('success') and data.get('results'):
            print(f"\nFirst result:")
            result = data['results'][0]
            print(f"  City: {result.get('city')}")
            print(f"  Area: {result.get('area')}")
            print(f"  Property Type: {result.get('property_type')}")
            print(f"  Sub-type: {result.get('property_sub_type')}")
            print(f"  Purpose: {result.get('purpose')}")
            print(f"  Price: {result.get('price')}")
            print(f"  Size: {result.get('size_value')} {result.get('size_unit')}")
        else:
            print(f"\nNo results or error: {data.get('error', 'No error message')}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to API!")
        print("Make sure the API is running: python main.py ui --port 8000")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║            Dashboard API Endpoint Test                       ║
╚══════════════════════════════════════════════════════════════╝

Make sure the API is running first:
    python main.py ui --port 8000

""")
    
    # Test 1: Filter by city only
    test_search("Filter by City Only", {
        "city": "Karachi",
        "limit": 5
    })
    
    # Test 2: Filter by city and property type
    test_search("City + Property Type", {
        "city": "Karachi",
        "propertyType": "Flat",
        "limit": 5
    })
    
    # Test 3: Price range filter
    test_search("Price Range Filter", {
        "city": "Karachi",
        "priceMin": 50000,
        "priceMax": 200000,
        "sortBy": "Price: Low -> High",
        "limit": 5
    })
    
    # Test 4: Full dashboard filters (matching your Postman example)
    test_search("Full Dashboard Filters", {
        "purpose": "Buy",
        "city": "Karachi",
        "location": "Scheme 33",
        "sortBy": "Newest First",
        "priceMax": 15000000,
        "propertyType": "House",
        "propertySubType": "Double Storey",
        "areaUnit": "Marla",
        "areaMin": 5,
        "areaMax": 10,
        "limit": 5
    })
    
    # Test 5: Text query + filters
    test_search("Text Query + Filters", {
        "query": "modern apartment",
        "city": "Karachi",
        "propertyType": "Flat",
        "limit": 5
    })
    
    print(f"\n{'='*80}")
    print("✓ ALL TESTS COMPLETED")
    print(f"{'='*80}\n")
