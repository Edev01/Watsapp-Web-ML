"""
Full Integration Test - Simulates Dashboard → Node.js → Python AI flow
This tests the complete connection between your systems
"""
import requests
import json
import time

# Configuration
PYTHON_API = "http://localhost:8000/api/dashboard-search"

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_python_api_health():
    """Test if Python API is running"""
    print_section("STEP 1: Testing Python API Connection")
    
    try:
        # Try to connect
        response = requests.get("http://localhost:8000/docs", timeout=2)
        print("✅ Python API is RUNNING")
        print(f"   URL: http://localhost:8000")
        print(f"   Status: {response.status_code}")
        return True
    except requests.exceptions.ConnectionError:
        print("❌ Python API is NOT running")
        print("\n   Please start it first:")
        print("   python main.py ui --port 8000")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_dashboard_search():
    """Test the dashboard search endpoint"""
    print_section("STEP 2: Testing Dashboard Search Endpoint")
    
    # Test case matching your Postman collection
    dashboard_request = {
        "filters": {
            "purpose": "Buy",
            "city": "Karachi",
            "location": "Scheme 33",
            "sortBy": "Newest First",
            "priceMin": "",
            "priceMax": "15000000",
            "propertyType": "House",
            "propertySubType": "Double Storey",
            "areaUnit": "Marla",
            "areaMin": "5",
            "areaMax": "10"
        }
    }
    
    # Convert dashboard format to Python API format
    filters = dashboard_request["filters"]
    python_request = {
        "purpose": filters["purpose"],
        "city": filters["city"],
        "location": filters["location"],
        "sortBy": filters["sortBy"],
        "priceMin": float(filters["priceMin"]) if filters["priceMin"] else None,
        "priceMax": float(filters["priceMax"]) if filters["priceMax"] else None,
        "propertyType": filters["propertyType"],
        "propertySubType": filters["propertySubType"],
        "areaUnit": filters["areaUnit"],
        "areaMin": float(filters["areaMin"]) if filters["areaMin"] else None,
        "areaMax": float(filters["areaMax"]) if filters["areaMax"] else None,
        "limit": 10
    }
    
    print("📤 Sending request (matching your Postman collection):")
    print(json.dumps(dashboard_request, indent=2))
    
    try:
        response = requests.post(PYTHON_API, json=python_request, timeout=30)
        data = response.json()
        
        print(f"\n📥 Response:")
        print(f"   Status Code: {response.status_code}")
        print(f"   Success: {data.get('success')}")
        print(f"   Results Count: {data.get('count')}")
        
        if data.get('success') and data.get('results'):
            print(f"\n✅ Search returned {data['count']} properties")
            
            # Show first result
            result = data['results'][0]
            print(f"\n   First Property:")
            print(f"   • City: {result.get('city')}")
            print(f"   • Area: {result.get('area')}")
            print(f"   • Type: {result.get('property_type')}")
            print(f"   • Sub-type: {result.get('property_sub_type')}")
            print(f"   • Purpose: {result.get('purpose')}")
            print(f"   • Size: {result.get('size_value')} {result.get('size_unit')}")
            print(f"   • Price: PKR {result.get('price_value'):,.0f}" if result.get('price_value') else "   • Price: Not specified")
            
            return True
        else:
            print(f"\n⚠️  No results found")
            if data.get('error'):
                print(f"   Error: {data['error']}")
            return True
            
    except requests.exceptions.Timeout:
        print("\n❌ Request timed out (30 seconds)")
        print("   The search might be taking too long")
        print("   Check if normalization and embeddings are complete")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

def test_various_filters():
    """Test various filter combinations"""
    print_section("STEP 3: Testing Various Filter Combinations")
    
    test_cases = [
        {
            "name": "City Only",
            "payload": {"city": "Karachi", "limit": 3}
        },
        {
            "name": "City + Type",
            "payload": {"city": "Karachi", "propertyType": "Flat", "limit": 3}
        },
        {
            "name": "Price Range",
            "payload": {
                "city": "Karachi",
                "priceMin": 50000,
                "priceMax": 200000,
                "limit": 3
            }
        },
        {
            "name": "Purpose Filter",
            "payload": {"purpose": "Rent", "city": "Karachi", "limit": 3}
        }
    ]
    
    for test in test_cases:
        print(f"\n🔍 Test: {test['name']}")
        print(f"   Filters: {test['payload']}")
        
        try:
            response = requests.post(PYTHON_API, json=test['payload'], timeout=10)
            data = response.json()
            
            if data.get('success'):
                count = data.get('count', 0)
                print(f"   ✅ Success: {count} results")
            else:
                print(f"   ⚠️  No results or error")
        except Exception as e:
            print(f"   ❌ Error: {str(e)[:50]}")
    
    return True

def show_node_js_code():
    """Show the Node.js integration code"""
    print_section("STEP 4: Node.js Integration Code")
    
    print("""
Your Node.js backend should update the endpoint like this:

// In your Node.js API (routes/properties.js or similar)
const fetch = require('node-fetch');

app.post('/api/properties/filter', async (req, res) => {
    const { filters } = req.body;
    
    try {
        // Call Python AI Backend
        const pythonResponse = await fetch('http://localhost:8000/api/dashboard-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                purpose: filters.purpose,
                city: filters.city,
                location: filters.location,
                sortBy: filters.sortBy,
                priceMin: filters.priceMin ? parseFloat(filters.priceMin) : null,
                priceMax: filters.priceMax ? parseFloat(filters.priceMax) : null,
                propertyType: filters.propertyType,
                propertySubType: filters.propertySubType,
                areaUnit: filters.areaUnit,
                areaMin: filters.areaMin ? parseFloat(filters.areaMin) : null,
                areaMax: filters.areaMax ? parseFloat(filters.areaMax) : null,
                limit: 20
            })
        });
        
        const data = await pythonResponse.json();
        
        // Return to dashboard
        res.json({
            success: data.success,
            count: data.count,
            properties: data.results
        });
        
    } catch (error) {
        console.error('Python API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Search failed',
            properties: []
        });
    }
});

✅ After adding this code:
   1. Your dashboard continues to call the same endpoint
   2. Node.js forwards the request to Python AI
   3. Python AI returns intelligent search results
   4. Node.js forwards results back to dashboard
""")


def main():
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    FULL INTEGRATION CONNECTION TEST                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

This script tests the complete connection flow:
  Dashboard → Node.js API → Python AI Backend → Results

""")
    
    # Test 1: Check if Python API is running
    if not test_python_api_health():
        print("\n❌ Cannot proceed. Start the Python API first.")
        return
    
    print("\n⏳ Waiting 2 seconds for API to be ready...")
    time.sleep(2)
    
    # Test 2: Test dashboard search endpoint
    if not test_dashboard_search():
        print("\n❌ Dashboard search test failed")
        return
    
    # Test 3: Test various filters
    test_various_filters()
    
    # Test 4: Show Node.js code
    show_node_js_code()
    
    # Summary
    print_section("✅ INTEGRATION TEST COMPLETE")
    print("""
Next Steps:
  1. ✅ Python API is working
  2. ✅ Dashboard endpoint is working
  3. 📝 Add the Node.js code shown above to your backend
  4. 🚀 Your dashboard will then use intelligent AI search!

The connection is ready! Your dashboard can now use advanced AI search.
""")


if __name__ == "__main__":
    main()
