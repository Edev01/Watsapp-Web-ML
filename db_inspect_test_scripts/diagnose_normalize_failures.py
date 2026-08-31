#!/usr/bin/env python3
"""Diagnose why normalization fails for pending messages."""

import json

import _bootstrap  # noqa: F401
from sqlalchemy import select
from app.database import SessionLocal
from app.models_db import WhatsAppMessage, NormalizedMessage
from app.llm import LLMClient, SYSTEM_PROMPT
from app.schemas import NormalizedOutputSchema
from pydantic import ValidationError


def main():
    db = SessionLocal()
    processed = (
        select(NormalizedMessage.whatsapp_message_id)
        .filter(NormalizedMessage.model_used == "qwen2.5:7b")
    )
    msgs = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.id.not_in(processed))
        .filter(WhatsAppMessage.message.isnot(None))
        .order_by(WhatsAppMessage.id.asc())
        .limit(10)
        .all()
    )
    client = LLMClient()

    for msg in msgs:
        print("=" * 70)
        print(f"ID={msg.id} len={len(msg.message or '')}")
        print(f"TEXT: {(msg.message or '')[:250]!r}")
        try:
            response = client.client.chat.completions.create(
                model="qwen2.5:7b",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Sender: {msg.sender}\nMessage: {msg.message}"},
                ],
                temperature=0.1,
                max_tokens=800,
            )
            raw = response.choices[0].message.content or ""
            cleaned = client._clean_json_response(raw)
            print(f"RAW_OUT: {raw[:400]!r}")
            try:
                data = json.loads(cleaned)
                print("JSON: OK")
                print("KEYS:", list(data.keys()))
                try:
                    NormalizedOutputSchema(**data)
                    print("SCHEMA: OK")
                except ValidationError as ve:
                    print("SCHEMA FAIL:")
                    print(ve)
            except json.JSONDecodeError as je:
                print("JSON FAIL:", je)
                print("CLEANED:", cleaned[:500])
        except Exception as e:
            print("API/OTHER FAIL:", type(e).__name__, e)
        print()

    db.close()


if __name__ == "__main__":
    main()
