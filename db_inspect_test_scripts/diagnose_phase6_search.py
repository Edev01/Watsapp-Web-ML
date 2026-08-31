"""Diagnose 'phase 6' search quality issues."""
import _bootstrap  # noqa: F401
from app.database import SessionLocal
from app.search import preprocess_search_query
from app.advanced_search import advanced_property_search
from sqlalchemy import text


def main():
    q = "phase 6"
    print("QUERY:", repr(q))
    print("PREPROCESS:", preprocess_search_query(q))
    print()

    db = SessionLocal()
    try:
        rows = advanced_property_search(db=db, query_text=q, limit=10)
        print(f"Top {len(rows)} results (as returned by API order):")
        for i, r in enumerate(rows, 1):
            print(
                f"  {i}. score={r.get('similarity_score')} "
                f"id={r.get('message_id')} area={r.get('area')!r} vicinity={r.get('vicinity')!r}"
            )
            print(f"     {(r.get('summary') or '')[:100]}")

        print()
        print("If we re-sort those same rows by score DESC:")
        for i, r in enumerate(sorted(rows, key=lambda x: x.get("similarity_score") or 0, reverse=True), 1):
            print(
                f"  {i}. score={r.get('similarity_score')} "
                f"area={r.get('area')!r} vicinity={r.get('vicinity')!r}"
            )

        print()
        stats = db.execute(
            text(
                """
            SELECT
              (SELECT COUNT(*) FROM normalized_messages
               WHERE is_property=true AND model_used='qwen2.5:7b') AS total_prop,
              (SELECT COUNT(*) FROM normalized_messages
               WHERE is_property=true AND model_used='qwen2.5:7b'
                 AND (area ILIKE '%phase 6%' OR vicinity ILIKE '%phase 6%'
                      OR summary ILIKE '%phase 6%')) AS phase6_any,
              (SELECT COUNT(*) FROM normalized_messages
               WHERE is_property=true AND model_used='qwen2.5:7b'
                 AND (vicinity ILIKE '%Phase 6, Block H, Scheme 33%'
                      OR area ILIKE '%Bahria Town, Clifton%')) AS prompt_junk
            """
            )
        ).mappings().one()
        print("DB stats:", dict(stats))
    finally:
        db.close()


if __name__ == "__main__":
    main()
