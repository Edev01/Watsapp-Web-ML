# Always-on AI normalize worker (deploy on Render — not your PC)
#
# 1. Push this repo (or connect whats-app-bot) as a Render **Background Worker**
# 2. Start command:  python auto_pipeline.py
# 3. Env vars (required):
#      DATABASE_URL     = same Supabase URL as Node backend
#      LLM_BASE_URL     = https://api.groq.com/openai/v1
#      LLM_API_KEY      = your Groq key (https://console.groq.com/keys)
#      DEFAULT_MODEL    = llama-3.1-8b-instant
#      EMBED_ENABLED    = false
#      CHECK_INTERVAL   = 60
#
# Node backend (Render Web Service) should also have:
#      NORMALIZE_MODEL  = llama-3.1-8b-instant   # must match DEFAULT_MODEL
#
# Flow: scrape → backend auto-queues normalize_jobs → this worker processes forever.

web: uvicorn app.api:app --host 0.0.0.0 --port $PORT
worker: python auto_pipeline.py
