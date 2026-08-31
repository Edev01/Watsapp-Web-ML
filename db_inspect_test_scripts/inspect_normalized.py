import _bootstrap  # noqa: F401
from app.database import SessionLocal
from app.models_db import NormalizedMessage, WhatsAppMessage
from sqlalchemy import text

db = SessionLocal()

print("=== Sample Property Messages ===")
records = db.query(NormalizedMessage).filter(
    NormalizedMessage.is_property == True
).filter(
    NormalizedMessage.model_used == 'qwen2.5:7b'
).limit(10).all()

for r in records:
    raw = db.query(WhatsAppMessage).filter(WhatsAppMessage.id == r.whatsapp_message_id).first()
    print(f"\nMessage ID: {r.whatsapp_message_id} | Normalized ID: {r.id}")
    print(f"Raw Message: {raw.message[:150]}..." if raw and len(raw.message) > 150 else raw.message)
    print(f"City: {r.city}")
    print(f"Area: {r.area}")
    print(f"Vicinity: {r.vicinity}")
    print(f"Property Type: {r.property_type}")
    print(f"Purpose: {r.purpose}")
    print(f"Size: {r.size}")
    print(f"Price: {r.price}")
    print(f"Summary: {r.summary}")
    print("=" * 80)

print("\n=== Sample NON-Property Messages (should be filtered out) ===")
non_prop_records = db.query(NormalizedMessage).filter(
    NormalizedMessage.is_property == False
).filter(
    NormalizedMessage.model_used == 'qwen2.5:7b'
).limit(5).all()

for r in non_prop_records:
    raw = db.query(WhatsAppMessage).filter(WhatsAppMessage.id == r.whatsapp_message_id).first()
    print(f"\nMessage ID: {r.whatsapp_message_id}")
    print(f"Raw Message: {raw.message[:100]}..." if raw and len(raw.message) > 100 else raw.message)
    print(f"Category: {r.category} | Intent: {r.intent}")
    print(f"Summary: {r.summary}")
    print("=" * 80)

db.close()
