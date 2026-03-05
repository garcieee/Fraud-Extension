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

## Connect Supabase (Memory Layer + Feedback)

1. **Create a project** at [supabase.com](https://supabase.com) and get:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **Service role key** (Settings → API → `service_role` secret)

2. **Create two tables** in the SQL Editor:

   **Cache (24h TTL):**
   ```sql
   create table if not exists fraud_scans (
     url text primary key,
     created_at timestamptz default now(),
     result jsonb
   );
   ```

   **Job status (for extension polling):**
   ```sql
   create table if not exists scan_jobs (
     job_id text primary key,
     status text not null,
     result jsonb,
     created_at timestamptz default now()
   );
   ```

3. **Set env vars** (e.g. in `.env` or Render):
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key
   - `SUPABASE_TABLE` = `fraud_scans` (default)
   - `SUPABASE_JOBS_TABLE` = `scan_jobs` (default)

After this, the backend uses Supabase for cache and for **GET /status/{job_id}**; the extension polls that and shows the **Red / Yellow / Green** shield from the server result.

## Other API Keys

- **Hugging Face:** `HF_API_URL`, `HF_API_TOKEN` (for `ai.py` when ready).
- **Cache TTL:** `CACHE_TTL_SECONDS` (default `86400`, 24h).

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