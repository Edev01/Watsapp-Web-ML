import _bootstrap  # noqa: F401
from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

r = db.execute(text('SELECT COUNT(*) FROM whatsapp_messages')).fetchone()
print(f'Total raw messages: {r[0]}')

r = db.execute(text('SELECT COUNT(*) FROM normalized_messages')).fetchone()
print(f'Total normalized: {r[0]}')

r = db.execute(text("SELECT COUNT(*) FROM normalized_messages WHERE city IS NOT NULL AND city != ''")).fetchone()
print(f'With city: {r[0]}')

r = db.execute(text("SELECT COUNT(*) FROM normalized_messages WHERE property_type IS NOT NULL AND property_type != ''")).fetchone()
print(f'With property_type: {r[0]}')

r = db.execute(text(
    "SELECT id, city, property_type, LEFT(COALESCE(summary, ''), 50) "
    "FROM normalized_messages WHERE city ILIKE '%karachi%' LIMIT 3"
)).fetchall()
print('\nSample Karachi properties:')
for row in r:
    print(f'  ID {row[0]}: {row[1]} | {row[2]} | {row[3]}...')

db.close()
