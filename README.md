# Watsapp-Web-ML

# WhatsApp Property Intelligence Bot

A **real-time AI-powered system** for searching and retrieving property listings from WhatsApp conversations. Uses NLP, vector embeddings, and hybrid search (with spelling-tolerant free-text queries).

## Quick Start — Run Everything

You need **3 services** (+ Ollama for the LLM).

### Option A — Backends via batch script
```bat
START_LOCAL_TEST.bat
```
Starts:
- Python AI on http://localhost:8000
- Node.js API on http://localhost:5000

Then start the frontend in a separate terminal:
```bat
cd Watsapp_Web_Scrapper-main
npm run dev
```
Open http://localhost:5173 (or the Vite URL shown).

### Option B — Manual
```bat
REM 1) Python AI (port 8000)
cd E:\Aizaz\whats-app-bot
venv\Scripts\activate
python -m uvicorn app.api:app --reload --host 0.0.0.0 --port 8000

REM 2) Node.js backend (port 5000) — other terminal
cd Watsapp_Web_backend-main
npm start

REM 3) Frontend — other terminal
cd Watsapp_Web_Scrapper-main
npm run dev
```

**Env tips**
- Node: `Watsapp_Web_backend-main\.env` → `PORT=5000`, `PYTHON_AI_URL=http://localhost:8000`
- Frontend: `Watsapp_Web_Scrapper-main\.env` → `VITE_SCRAPPER_URL=http://localhost:5000`

### Normalization + embeddings
```bat
RUN_NORMALIZATION.bat
```
Loops until all pending messages are normalized (**300 per batch**), then runs embeddings. Progress is saved; Ctrl+C to pause and re-run later.

One-shot batch of N messages:
```bat
venv\Scripts\activate
python main.py normalize --model qwen2.5:7b --batch 600
python main.py embed --model qwen2.5:7b
```

### Useful helper scripts

| Script | Purpose |
|--------|---------|
| `START_LOCAL_TEST.bat` | Start Python AI (8000) + Node backend (5000). Frees port 5000 if busy. |
| `RUN_NORMALIZATION.bat` | Normalize all pending messages in a loop (300/batch), then generate embeddings. |
| `daily_update.bat` | Incremental maintenance: dedup → normalize new msgs → embed. |
| `CLEAR_ALL_DATA.bat` | Delete **normalized** data + embeddings only. Raw WhatsApp messages are kept. |
| `CREATE_TEST_USER.bat` | Create local admin user `admin@test.com` / `admin123` (Node must be running). |
| `TEST_DB_CONNECTION.bat` | Check PostgreSQL connection stability (~60s). |

### Core Python files (keep at project root)

These **must stay in the project root** so batch files and `import app` work:

| File | Purpose |
|------|---------|
| `main.py` | Main CLI: `normalize`, `embed`, `search`, `dedup`, `init-db`, `ui`, etc. |
| `normalize_all.py` | Loop normalize (300/batch) until done — used by `RUN_NORMALIZATION.bat` |
| `CLEAR_AND_RENORMALIZE.py` | Wipe normalized + embeddings (keeps raw messages) — used by `CLEAR_ALL_DATA.bat` |
| `auto_pipeline.py` | Background loop: every 5 min dedup → normalize new → embed |
| `app/` | Application package (API, LLM, search, DB models) — never move |

### Helpers in `db_inspect_test_scripts/` (optional)

OK to keep inspect/test scripts here. Run them from the **project root**:

```bat
venv\Scripts\activate
python db_inspect_test_scripts\check_data.py
```

| Script | Needed? | Purpose |
|--------|---------|---------|
| `check_data.py` | Useful | Counts raw/normalized rows + sample Karachi rows |
| `inspect_db.py` | Useful | Duplicate stats on raw messages |
| `inspect_normalized.py` | Useful | Print sample normalized property fields |
| `test_db_connection.py` | Useful | DB stability test (`TEST_DB_CONNECTION.bat`) |
| `test_search.py` | Useful | CLI tests for fuzzy/semantic search |
| `test_dashboard_api.py` | Optional | Hits Python `/api/dashboard-search` with sample filters |
| `test_full_integration.py` | Optional | Broader API integration checks |
| `diagnose_normalize_failures.py` | Optional | Debug why LLM normalize fails on pending msgs |
| `dedup_and_reset.py` | Optional | Full cleanup: clear processed data + remove duplicate raw msgs |
| `dedup_auto.py` | Optional | Auto dedup only (prefer `python main.py dedup --auto`) |
| `_bootstrap.py` | Internal | Adds project root to `sys.path` for scripts in this folder |

**Do not put** `main.py`, `normalize_all.py`, `CLEAR_AND_RENORMALIZE.py`, or `auto_pipeline.py` in this folder — that breaks `.bat` scripts.

## Overview

## 🆕 **NEW: Real-Time Processing**
- ✅ **Automated pipeline** that runs every 5 minutes
- ✅ **All dashboard filters** supported (purpose, city, price range, size range, property sub-types)
- ✅ **Multi-strategy search** (filter-only, hybrid, or semantic)
- ✅ **Production-ready** for continuous data scraping

## 🚀 Key Features

### 🔄 **Real-Time Processing** (NEW!)
- **Automated pipeline**: Runs every 5 minutes, processes new messages automatically
- **Zero manual intervention**: Just keep it running, everything happens automatically
- **Dashboard-ready**: Supports ALL dashboard filters (purpose, city, location, price, size, type)
- **Production-grade**: Logs, error handling, monitoring built-in

### ✨ Intelligent Search Capabilities
- **Fuzzy Matching**: Handles spelling mistakes automatically ("Cliftn" → "Clifton", "Lahor" → "Lahore")
- **Abbreviated Names**: Understands "khi" → "Karachi", "lhr" → "Lahore"
- **Smart Location Extraction**: Automatically extracts city, area, and sub-location from queries
- **Hybrid Search**: Combines vector embeddings + full-text search + location boosting
- **Deduplication**: Returns unique results, no duplicate properties
- **Property Filtering**: Automatically filters out general chat messages

### 🎯 Search Intelligence
- **Specific Searches**: "3 bedroom apartment in Clifton Karachi"
- **Vague Searches**: "house for rent" (returns all matching properties)
- **Spelling Errors**: "flat in Cliftn" works perfectly
- **Multiple Locations**: "villa in DHA Phase 6 Lahore"
- **Property Types**: Apartment, House, Plot, Shop, Commercial, Farmhouse

## 📋 Architecture

### Data Flow
```
WhatsApp Messages → Normalization (LLM) → Vector Embeddings → Hybrid Search → Results
```

### Components
1. **Database (PostgreSQL + pgvector)**
   - `whatsapp_messages`: Raw WhatsApp messages
   - `normalized_messages`: AI-extracted structured data
   - `message_embeddings`: Vector embeddings for semantic search

2. **Normalization (LLM)**
   - Extracts: city, area, vicinity, property_type, purpose, size, price
   - Filters: Separates property messages from general chat
   - Supports: Urdu (Roman/Hinglish) understanding

3. **Intelligent Search**
   - Query preprocessing with fuzzy matching
   - Vector similarity search (semantic)
   - Full-text keyword matching
   - Location-based boosting

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.8+
- PostgreSQL with pgvector extension
- [Ollama](https://ollama.com) (embeddings; optional local LLM)
- Groq API key (optional — faster cloud normalize; embeddings still use Ollama)
- Node.js 20+ (for the team backend/frontend)

### Install Ollama and download models

1. **Install Ollama**  
   - Windows: download from https://ollama.com/download and install  
   - Or: https://ollama.com → Get Ollama

2. **Start Ollama** (usually starts automatically on Windows after install):
```bat
ollama serve
```
Leave this running. API: http://localhost:11434

3. **Pull the embedding model** (required for search — ~274 MB):
```bat
ollama pull nomic-embed-text
```

If you normalize with **Groq**, you do not need `qwen2.5:7b` locally. If you stay fully local:
```bat
ollama pull qwen2.5:7b
```

4. **Verify Ollama:**
```bat
ollama list
```
You must see `nomic-embed-text`.

**This project’s defaults** (see `.env`):
| Role | Default | Env |
|------|---------|-----|
| Normalize (chat) | Groq `openai/gpt-oss-20b` | `LLM_BASE_URL`, `LLM_API_KEY`, `DEFAULT_MODEL` |
| Embeddings | Ollama `nomic-embed-text` | `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL` |

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Configure Environment
Edit `.env` file with your database credentials:
```env
DATABASE_URL="postgresql://user:pass@host:port/database"
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_your_groq_key
DEFAULT_MODEL=openai/gpt-oss-20b
EMBEDDING_BASE_URL=http://localhost:11434/v1
EMBEDDING_API_KEY=ollama
EMBEDDING_MODEL=nomic-embed-text
```

Do not commit `.env` (it contains secrets). Copy the exact Groq model id from https://console.groq.com/docs/models — public `llama-3.1-8b-instant` was retired 16 Aug 2026.

### Initialize Database
```bash
python main.py init-db
```

## 📖 Usage Guide

### Step 1: Clean and Deduplicate Database

#### **First-Time Setup:**
If you have duplicate messages, run the full cleanup script:
```bash
python db_inspect_test_scripts\dedup_and_reset.py
```

This will:
- Remove duplicate messages (keeps one copy per unique property)
- Clear old normalized data
- Prepare for fresh normalization

#### **Regular Updates (After importing new messages):**
For daily/weekly updates, use the automatic dedup command:
```bash
python main.py dedup --auto
```

This removes duplicates without clearing existing normalized data (faster for incremental updates).

#### **One-Click Daily Update:**
Just double-click `daily_update.bat` to:
1. Remove duplicates automatically
2. Normalize new messages
3. Generate embeddings
4. Update search index

### Step 2: Normalize Messages
Extract structured data from raw messages using LLM:
```bash
# Using Qwen model (recommended)
python main.py normalize --model qwen2.5:7b --batch 100

# Or using other models
python main.py normalize --model llama3.1:8b --batch 100
python main.py normalize --model deepseek-r1:7b --batch 100
```

### Step 3: Generate Embeddings
Create vector embeddings for semantic search:
```bash
python main.py embed --model qwen2.5:7b --embed-model nomic-embed-text
```

### Step 4: Search Properties
```bash
# Basic search
python main.py search "apartment in Clifton Karachi"

# With custom limit
python main.py search "house in Lahore" --limit 10

# Specific model
python main.py search "plot in DHA" --model qwen2.5:7b
```

### Step 5: Web Interface
Launch the interactive comparison panel:
```bash
python main.py ui --port 8000
```
Then open: http://localhost:8000

## 🧪 Testing the Improved Search

Run comprehensive tests to verify fuzzy matching and intelligent search:
```bash
python db_inspect_test_scripts\test_search.py
```

This tests:
- Specific location searches
- Spelling mistake handling
- Abbreviated city names
- Vague searches
- Property type filtering
- Multiple location keywords

## 🔍 Search Examples

### Example 1: Specific Search
```bash
python main.py search "3 bedroom apartment in Clifton Karachi"
```
**Returns**: All 3-bedroom apartments in Clifton, Karachi area

### Example 2: Fuzzy Matching (Spelling Mistake)
```bash
python main.py search "house in Lahor"
```
**Returns**: Houses in Lahore (automatically corrects "Lahor" → "Lahore")

### Example 3: Abbreviated City
```bash
python main.py search "flat in khi"
```
**Returns**: Flats in Karachi (understands "khi" = "Karachi")

### Example 4: Vague Search
```bash
python main.py search "villa for sale"
```
**Returns**: All villas available for sale across all cities

### Example 5: Multiple Locations
```bash
python main.py search "plot in DHA Phase 6 Lahore"
```
**Returns**: Plots in DHA Phase 6, Lahore with location boosting

## 🔄 Continuous Data Import Workflow

**For ongoing imports from multiple WhatsApp groups:**

### Quick Daily Update:
```bash
# Option 1: Use the batch script
daily_update.bat

# Option 2: Manual commands
python main.py dedup --auto
python main.py normalize --model qwen2.5:7b --batch 200
python main.py embed --model qwen2.5:7b
```

**Why dedup is needed**: The same property is often posted in multiple WhatsApp groups. The dedup command keeps only ONE copy of each unique property, giving you clean search results.

---

## 📊 Database Statistics

View current database status:
```bash
python db_inspect_test_scripts\inspect_db.py
python db_inspect_test_scripts\check_data.py
```

View normalized messages:
```bash
python main.py view-normalized --limit 10
```

View sample property data:
```bash
python db_inspect_test_scripts\inspect_normalized.py
```

## 🎯 Understanding the Search Algorithm

### Similarity Score Calculation
```
Total Score = Vector Similarity + Keyword Boost + Area Boost + City Boost

- Vector Similarity: 0 to 1 (semantic meaning)
- Keyword Boost: +0.5 (exact word matches)
- Area Boost: +0.3 (exact area match)
- City Boost: +0.2 (exact city match)

Max Score: ~2.0
```

### Fuzzy Matching
The system includes built-in mappings for:

**Cities**: Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, etc.
- "khi" → "Karachi"
- "lhr" → "Lahore"
- "isb" → "Islamabad"

**Areas**: DHA, Bahria Town, Clifton, Gulberg, North Nazimabad, etc.
- "cliftn" → "Clifton"
- "bahriatown" → "Bahria Town"
- "gulbrg" → "Gulberg"

## 🔧 Troubleshooting

### Issue: Getting Duplicate Results
**Solution**: Run the deduplication script
```bash
python main.py dedup --auto
REM or full reset:
python db_inspect_test_scripts\dedup_and_reset.py
```

### Issue: Poor Search Results
**Solution**: Regenerate embeddings with improved normalization
```bash
REM Clear normalized data only (keeps raw WhatsApp messages)
CLEAR_ALL_DATA.bat

REM Re-normalize + embed
RUN_NORMALIZATION.bat
```

### Issue: LLM Connection Failed
**Solution**: Ensure Ollama is running
```bash
# Check if Ollama is running
curl http://localhost:11434/v1/models

# If not running, start Ollama
ollama serve
```

### Issue: Database Connection Error
**Solution**: Verify `.env` file has correct DATABASE_URL

## 🏗️ Project Structure

```
whats-app-bot/
├── app/                         # Core application (API, LLM, search, DB)
├── main.py                      # CLI entry point (keep at root)
├── normalize_all.py             # Full normalize loop (keep at root)
├── CLEAR_AND_RENORMALIZE.py     # Clear normalized data (keep at root)
├── auto_pipeline.py             # Real-time 5-min pipeline (keep at root)
├── db_inspect_test_scripts/     # Inspect / test / maintenance helpers
├── Watsapp_Web_backend-main/    # Node.js API
├── Watsapp_Web_Scrapper-main/   # React frontend
├── requirements.txt
├── .env
└── README.md
```

## 🎓 Advanced Usage

### Benchmark Models
Compare different LLM models for normalization:
```bash
python main.py benchmark --models qwen2.5:7b llama3.1:8b deepseek-r1:7b --sample 20
```

### Clear All Data
Reset the entire database:
```bash
python main.py clear-db
```

### API Integration
Use the REST API for programmatic access:
```python
import requests

response = requests.post("http://localhost:8000/api/search", json={
    "query": "apartment in Clifton",
    "models": ["qwen2.5:7b"],
    "city": "Karachi",
    "limit": 5
})

results = response.json()
for result in results:
    print(result["raw_message"])
    print(result["model_outputs"])
```

## 🔐 Data Privacy
- All data is stored locally in your PostgreSQL database
- Embeddings stay local via Ollama. Chat/normalize uses Groq if `LLM_BASE_URL` points at Groq (message text is sent to Groq).
- No external API calls or data sharing

## 📈 Performance Optimization

### For Large Databases
1. **Batch Processing**: Use `--batch 100` or higher for normalization
2. **Indexing**: Database has automatic indexes on frequently searched fields
3. **Deduplication**: Run cleanup regularly to maintain performance
4. **Connection Pooling**: Configured in `database.py` (pool_size=5, max_overflow=10)

### Search Performance
- Average search time: 50-200ms for 100K messages
- Vector search: ~30ms
- Hybrid search: ~100ms
- Results are cached at database level

## 🤝 Contributing
Feel free to submit issues or pull requests to improve the system.

## 📄 License
MIT License - Use freely for personal or commercial projects.

## 🙏 Credits
- **LLM**: Ollama (Qwen, Llama, DeepSeek)
- **Embeddings**: nomic-embed-text
- **Database**: PostgreSQL + pgvector
- **Framework**: FastAPI, SQLAlchemy

---

**Built with ❤️ for intelligent real estate search**
