# Fraud-Extension

## Architecture

```text
backend/
  ├── main.py       # FastAPI + QStash gateway (DO NOT TOUCH)
  ├── worker.py     # Orchestrates heuristics + AI + cache
  ├── heuristics.py # Rule_Score (URL-based heuristics)
  ├── ai.py         # AI_Score (Hugging Face placeholder)
  ├── cache.py      # Supabase cache placeholder
  └── config.py     # API key placeholders

scraper/
  ├── scraper.js    # Returns { url, text } from current page
  └── utils.js      # Text cleaning (normalize + trim)

extension/          # Chrome extension UI (DO NOT TOUCH)
```

## How It Works

- Extension scrapes the current page and sends `{ url, text }` to `backend/main.py`.
- `main.py` pushes the job to QStash.
- QStash calls `backend/worker.py`:
  - `heuristics.calculate_rule_score(url)` → Rule_Score (0–100)
  - `ai.analyze_intent(text)` → AI_Score (0–100, **not implemented yet**)
  - `Final_Score = 0.4 * Rule_Score + 0.6 * AI_Score`
  - `cache.get_cached_result` / `cache.set_cached_result` are stubs for Supabase.

## Config & API Keys

Set these **later** in `backend/config.py`:

- Hugging Face (Zero-shot intent, `facebook/bart-large-mnli`):
  - `HF_API_URL`
  - `HF_API_TOKEN`
- Supabase (24h cache):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_TABLE`
- Cache TTL:
  - `CACHE_TTL_SECONDS` (default `86400`, 24h)

Currently:
- `ai.analyze_intent` raises `NotImplementedError` (no HF calls yet).
- `cache.set_cached_result` raises `NotImplementedError`.
- `cache.get_cached_result` always returns `None` (no cache).

## How to Use (High Level)

1. **Extension**  
   - Load `extension/` as an unpacked extension in Chrome.  
   - It already knows how to call the backend.

2. **Backend**  
   - Run `backend/main.py` with your existing FastAPI/QStash setup.  
   - QStash should be configured (outside this repo) to invoke `worker.process_job`.

3. **Next Steps**  
   - Add real Hugging Face logic in `ai.py` once you have `HF_API_TOKEN`.  
   - Add real Supabase logic in `cache.py` once you have Supabase keys.  
   - Keep `main.py` and everything under `extension/` unchanged.