# Always-on AI normalize worker (deploy on Render — not your PC)
#
# 1. Push this repo as a Render **Background Worker**
# 2. Start command:  python auto_pipeline.py
# 3. Env vars (required):
#      DATABASE_URL     = same Supabase URL as Node backend
#      LLM_BASE_URL     = https://api.together.ai/v1
#      LLM_API_KEY      = your Together key
#      DEFAULT_MODEL    = openai/gpt-oss-20b
#      EMBED_ENABLED    = false
#      CHECK_INTERVAL   = 15
#
# Node backend (Render Web Service) should also have:
#      PYTHON_AI_URL  = https://whatsapp-ai-api.onrender.com
#
# Flow: scrape → backend wakes pipeline → worker normalizes per user_id

web: uvicorn app.api:app --host 0.0.0.0 --port $PORT
worker: python auto_pipeline.py
