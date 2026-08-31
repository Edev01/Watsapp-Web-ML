import _bootstrap  # noqa: F401
from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print("=== Total raw messages ===")
r = db.execute(text("SELECT COUNT(*) FROM whatsapp_messages")).fetchone()
print(f"  Total: {r[0]}")

print()
print("=== Duplicate raw messages (same message text) ===")
r = db.execute(text("""
    SELECT message, COUNT(*) as cnt 
    FROM whatsapp_messages 
    GROUP BY message 
    HAVING COUNT(*) > 1 
    ORDER BY cnt DESC 
    LIMIT 10
""")).fetchall()
print(f"  Duplicate groups found: {len(r)}")
for row in r:
    print(f"  count={row[1]}  text='{str(row[0])[:80]}...'")

print()
print("=== Raw message IDs for a known duplicate ===")
r = db.execute(text("""
    SELECT id, sender, message 
    FROM whatsapp_messages 
    WHERE id IN (66,67,69,70,71,77,79,80)
    ORDER BY id
""")).fetchall()
for row in r:
    print(f"  id={row[0]}  sender={row[1]}  msg='{str(row[2])[:60]}'")

db.close()