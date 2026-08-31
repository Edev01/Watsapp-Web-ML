"""Compare DHA Phase 6 search variants (correct vs typos)."""
import _bootstrap  # noqa: F401
from app.database import SessionLocal
from app.search import preprocess_search_query
from app.advanced_search import advanced_property_search


def main():
    queries = ["DHA phase 6", "phase 6", "phse 6", "precinct 35", "precint 35"]
    db = SessionLocal()
    try:
        for q in queries:
            print("=" * 70)
            print("QUERY:", repr(q))
            print("PREPROCESS:", preprocess_search_query(q))
            rows = advanced_property_search(db=db, query_text=q, limit=5)
            print(f"RESULTS: {len(rows)}")
            for i, r in enumerate(rows, 1):
                summary = (r.get("summary") or "")[:120]
                print(
                    f"  {i}. score={r.get('similarity_score')} "
                    f"city={r.get('city')} area={r.get('area')} "
                    f"vicinity={r.get('vicinity')} type={r.get('property_type')}"
                )
                print(f"     {summary}")
            print()
    finally:
        db.close()


if __name__ == "__main__":
    main()
