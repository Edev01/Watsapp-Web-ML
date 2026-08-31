import argparse
import logging
import sys
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")

from app.database import init_db, SessionLocal
from app.llm import LLMClient, get_default_model
from app.normalizer import process_unnormalized_messages
from app.benchmark import run_model_benchmark

_DEFAULT_MODEL = get_default_model()


def main():
    parser = argparse.ArgumentParser(description="WhatsApp Intelligence AI Service CLI")
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    # init-db command
    subparsers.add_parser("init-db", help="Initialize and create missing database tables")

    # test-llm command
    test_llm_parser = subparsers.add_parser("test-llm", help="Test connectivity with configured LLM inference server")
    test_llm_parser.add_argument("--model", type=str, default=_DEFAULT_MODEL, help="Model name to test")

    # benchmark command
    bench_parser = subparsers.add_parser("benchmark", help="Run model benchmarking comparison")
    bench_parser.add_argument("--models", nargs="+", default=["qwen2.5:7b", "llama3.1:8b", "deepseek-r1:7b"], help="List of models to benchmark")
    bench_parser.add_argument("--sample", type=int, default=10, help="Number of sample messages to test")

    # normalize command
    norm_parser = subparsers.add_parser("normalize", help="Normalize pending raw messages")
    norm_parser.add_argument("--model", type=str, default=_DEFAULT_MODEL, help="Model to use for normalization")
    norm_parser.add_argument("--batch", type=int, default=50, help="Batch size of messages to process")
    norm_parser.add_argument("--user-id", type=int, default=None, help="Only normalize this tenant's messages")
    norm_parser.add_argument("--concurrency", type=int, default=None, help="Parallel Groq calls (default: NORMALIZE_CONCURRENCY)")

    # view-normalized command
    view_parser = subparsers.add_parser("view-normalized", help="View recently normalized messages from database")
    view_parser.add_argument("--limit", type=int, default=10, help="Number of records to show")

    # embed command
    embed_parser = subparsers.add_parser("embed", help="Generate vector embeddings for normalized messages")
    embed_parser.add_argument("--model", type=str, default=_DEFAULT_MODEL, help="LLM model normalizations to embed")
    embed_parser.add_argument("--embed-model", type=str, default="nomic-embed-text", help="Embedding model name")

    # search command
    search_parser = subparsers.add_parser("search", help="Perform natural language semantic search")
    search_parser.add_argument("query", type=str, help="Search query string")
    search_parser.add_argument("--model", type=str, default=_DEFAULT_MODEL, help="LLM model normalizations to search over")
    search_parser.add_argument("--embed-model", type=str, default="nomic-embed-text", help="Embedding model name")
    search_parser.add_argument("--limit", type=int, default=5, help="Number of search results to show")

    # ui command
    ui_parser = subparsers.add_parser("ui", help="Start interactive web interface Comparison Panel")
    ui_parser.add_argument("--port", type=int, default=8000, help="Port to run web server on")

    # clear-db command
    subparsers.add_parser("clear-db", help="Clear all normalized records, comparisons, and embeddings from database")

    # dedup command
    dedup_parser = subparsers.add_parser("dedup", help="Remove duplicate messages automatically (keeps one copy per unique property)")
    dedup_parser.add_argument("--auto", action="store_true", help="Run without confirmation prompt")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "init-db":
        print("Initializing database tables...")
        init_db()
        print("Tables initialized successfully!")



    elif args.command == "test-llm":
        print(f"Testing LLM connection with model '{args.model}'...")
        client = LLMClient()
        schema, latency, tok_sec, is_valid, err_reason, _raw = client.normalize_message(
            raw_text="Hi, what are the pricing packages for your standard AI bot?",
            sender="+123456789",
            model_name=args.model,
        )
        if is_valid and schema:
            print("LLM Connection Success!")
            print(f"Latency: {latency:.2f}s | Tokens/sec: {tok_sec:.2f}")
            print("Extracted Schema:", schema.model_dump_json(indent=2))
        else:
            print("LLM Connection Failed or invalid JSON output.")
            print(f"Endpoint: {client.base_url}")
            if err_reason:
                print(f"Reason: {err_reason}")
            sys.exit(1)

    elif args.command == "benchmark":
        init_db()
        db = SessionLocal()
        try:
            client = LLMClient()
            run_model_benchmark(db=db, llm_client=client, models_to_test=args.models, sample_size=args.sample)
        finally:
            db.close()

    elif args.command == "normalize":
        print("Starting normalize (Together/Ollama from .env)...", flush=True)
        init_db(skip_if_busy=True)
        print("Database ready. Loading pending messages...", flush=True)
        db = SessionLocal()
        try:
            client = LLMClient()
            count = process_unnormalized_messages(
                db=db,
                llm_client=client,
                model_name=args.model,
                batch_size=args.batch,
                user_id=args.user_id,
                concurrency=args.concurrency,
            )
            print(f"Finished: {count} messages normalized.")
        finally:
            db.close()

    elif args.command == "view-normalized":
        from app.models_db import NormalizedMessage
        db = SessionLocal()
        try:
            records = db.query(NormalizedMessage).order_by(NormalizedMessage.id.desc()).limit(args.limit).all()
            if not records:
                print("No normalized records found in database.")
                return
            print(f"\nShowing last {len(records)} normalized messages:\n")
            for r in records:
                print(f"ID: {r.id} | Msg ID: {r.whatsapp_message_id} | Model: {r.model_used}")
                print(f"  Summary: {r.summary}")
                print(f"  Category: {r.category} | Intent: {r.intent} | Sentiment: {r.sentiment}")
                print(f"  Entities: {r.entities}")
                print("-" * 80)
        finally:
            db.close()

    elif args.command == "embed":
        init_db(skip_if_busy=True)
        from app.embeddings import generate_and_store_embeddings
        db = SessionLocal()
        try:
            count = generate_and_store_embeddings(db=db, target_llm_model=args.model, embedding_model=args.embed_model)
            print(f"Successfully generated embeddings for {count} summaries.")
        finally:
            db.close()

    elif args.command == "search":
        init_db(skip_if_busy=True)
        from app.search import semantic_search
        db = SessionLocal()
        try:
            results = semantic_search(
                db=db,
                query_text=args.query,
                model_used=args.model,
                embedding_model=args.embed_model,
                limit=args.limit
            )
            if not results:
                print("No matching records found.")
                return
            print(f"\nSemantic Search Results for: '{args.query}' (Model: {args.model})\n")
            print("=" * 90)
            for idx, r in enumerate(results, 1):
                print(f"{idx}. Msg ID: {r['message_id']} | Similarity Score: {r['similarity_score']}")
                print(f"   Summary: {r['summary']}")
                print(f"   Intent: {r['intent']} | Category: {r['category']} | Sentiment: {r['sentiment']}")
                print(f"   Raw Text: {r['raw_message']}")
                print("-" * 90)
        finally:
            db.close()

    elif args.command == "ui":
        init_db()
        import uvicorn
        print(f"Starting comparison panel UI server at http://localhost:{args.port} ...")
        uvicorn.run("app.api:app", host="0.0.0.0", port=args.port, reload=True)

    elif args.command == "clear-db":
        from sqlalchemy import text
        print("Clearing all normalized data, comparisons, and vector embeddings from database...")
        db = SessionLocal()
        try:
            with db.bind.begin() as conn:
                conn.execute(text("TRUNCATE TABLE model_comparisons, normalized_messages, message_embeddings CASCADE;"))
            print("Database cleared successfully! You can now re-run normalization from scratch.")
        except Exception as e:
            print(f"Error clearing database: {e}")
        finally:
            db.close()

    elif args.command == "dedup":
        from sqlalchemy import text
        db = SessionLocal()
        try:
            # Get current stats
            r = db.execute(text("SELECT COUNT(*) FROM whatsapp_messages")).fetchone()
            total_before = r[0]
            
            r = db.execute(text("""
                SELECT COUNT(*) FROM (
                    SELECT message, COUNT(*) as cnt
                    FROM whatsapp_messages
                    GROUP BY message
                    HAVING COUNT(*) > 1
                ) dupes
            """)).fetchone()
            duplicate_groups = r[0]
            
            if duplicate_groups == 0:
                print("✓ No duplicates found! Database is already clean.")
                return
            
            print(f"Found {duplicate_groups} properties with duplicates across different chats")
            print(f"Total messages: {total_before}")
            
            # Ask for confirmation unless --auto flag is set
            if not args.auto:
                confirmation = input("\nRemove duplicates? This will keep only ONE copy of each property. Type 'yes' to continue: ")
                if confirmation.lower() != "yes":
                    print("Operation cancelled.")
                    return
            
            # Remove duplicates (keep only message content, ignore chat_jid)
            print("\nRemoving duplicates (keeping first occurrence only)...")
            result = db.execute(text("""
                DELETE FROM whatsapp_messages
                WHERE id NOT IN (
                    SELECT MIN(id)
                    FROM whatsapp_messages
                    GROUP BY message
                )
            """))
            db.commit()
            
            # Get final stats
            r = db.execute(text("SELECT COUNT(*) FROM whatsapp_messages")).fetchone()
            total_after = r[0]
            removed = total_before - total_after
            
            print(f"✓ Removed {removed} duplicate messages")
            print(f"✓ Remaining unique messages: {total_after}")
            print("\nIMPORTANT: Run these commands to update search:")
            print("  1. python main.py clear-db")
            print("  2. python main.py normalize --batch 100")
            print("  3. python main.py embed")
            
        except Exception as e:
            print(f"Error during deduplication: {e}")
            db.rollback()
        finally:
            db.close()






if __name__ == "__main__":
    main()
