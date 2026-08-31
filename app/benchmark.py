import logging
import time
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models_db import WhatsAppMessage, NormalizationBenchmark
from app.llm import LLMClient

logger = logging.getLogger("whatsapp_ai.benchmark")


def run_model_benchmark(
    db: Session,
    llm_client: LLMClient,
    models_to_test: List[str],
    sample_size: int = 10,
) -> List[Dict[str, Any]]:
    """
    Benchmark multiple open-source models on a sample of WhatsApp messages.

    Args:
        db: DB Session
        llm_client: Configured LLMClient instance
        models_to_test: List of model identifiers (e.g. ['qwen2.5:7b', 'llama3.1:8b'])
        sample_size: Number of messages to evaluate

    Returns:
        List of benchmark summary dictionaries per model
    """
    raw_sample: List[WhatsAppMessage] = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.message.isnot(None))
        .order_by(WhatsAppMessage.id.asc())
        .limit(sample_size)
        .all()
    )

    if not raw_sample:
        logger.error("No WhatsApp messages found in database for benchmarking.")
        return []

    print(f"\n=============================================================")
    print(f"       STARTING MODEL BENCHMARK HARNESS ({len(raw_sample)} MESSAGES)")
    print(f"=============================================================\n")

    results: List[Dict[str, Any]] = []

    for model_name in models_to_test:
        print(f"--> Benchmarking Model: {model_name}...")
        total_latency = 0.0
        total_tokens_per_sec = 0.0
        valid_json_count = 0
        successful_evals = 0

        for idx, msg in enumerate(raw_sample, 1):
            if not msg.message:
                continue

            parsed_schema, latency, tok_sec, is_valid, _err, _raw = llm_client.normalize_message(
                raw_text=msg.message,
                sender=msg.sender,
                model_name=model_name,
            )

            total_latency += latency
            total_tokens_per_sec += tok_sec
            successful_evals += 1

            if is_valid and parsed_schema:
                valid_json_count += 1

        avg_latency = (total_latency / successful_evals) if successful_evals > 0 else 0.0
        avg_tok_sec = (total_tokens_per_sec / successful_evals) if successful_evals > 0 else 0.0
        json_validity_rate = (valid_json_count / successful_evals * 100.0) if successful_evals > 0 else 0.0

        model_summary = {
            "model_name": model_name,
            "sample_size": len(raw_sample),
            "avg_latency_sec": round(avg_latency, 3),
            "tokens_per_sec": round(avg_tok_sec, 2),
            "json_validity_rate": round(json_validity_rate, 1),
        }
        results.append(model_summary)

        # Record benchmark run into database
        benchmark_entry = NormalizationBenchmark(
            model_name=model_name,
            sample_size=len(raw_sample),
            avg_latency_sec=avg_latency,
            tokens_per_sec=avg_tok_sec,
            json_validity_rate=json_validity_rate,
            notes=f"Evaluated on {len(raw_sample)} raw DB messages",
        )
        db.add(benchmark_entry)
        db.commit()

    print("\n=============================================================")
    print("                BENCHMARK RESULTS SUMMARY                    ")
    print("=============================================================")
    print(f"{'Model Name':<20} | {'Avg Latency':<12} | {'Tokens/Sec':<12} | {'JSON Valid %':<12}")
    print("-" * 65)
    for res in results:
        print(
            f"{res['model_name']:<20} | "
            f"{res['avg_latency_sec']:<10}s | "
            f"{res['tokens_per_sec']:<12} | "
            f"{res['json_validity_rate']:<11}%"
        )
    print("=============================================================\n")

    return results
