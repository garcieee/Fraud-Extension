# Fraud Detector — Chrome Extension

A Chrome extension that scans any webpage for fraud, phishing, and scam content. Combines local heuristics with an AI model (BART) to give you a trust score and flag exactly what's suspicious — and where on the page it is.

---

## How It Works

Click **Analyze Page** and in a few seconds you get:

- A **Trust Score (0–100)** with a plain-English verdict
- A breakdown of every flagged signal
- An interactive banner on the page itself — click any issue to **highlight it on the page**
- A **Scrape Page Data** button to export all scan data as JSON

### Scoring

| Score | Verdict |
|-------|---------|
| 80–100 | No threats detected |
| 50–79 | Warning — suspicious elements found |
| 0–49 | High risk — likely phishing or scam |

Final score = **40% heuristics + 60% AI** (falls back to heuristics-only if AI is unavailable).

---

## What Gets Checked

| Signal | What it looks for |
|--------|--------------------|
| HTTPS | Encrypted connection |
| Raw IP in URL | Legitimate sites use domain names, not IPs |
| URL length | Unusually long URLs are a common phishing trick |
| Password + payment form | Both on the same page is a major red flag |
| Brand impersonation | Domain mimicking a known brand (e.g. `paypa1.com`) |
| Urgency / threat / reward language | Scam keywords found in page text |
| Hidden iframes | Invisible frames used to steal data |
| Right-click disabled | Often used to hide source code |
| Fullscreen overlays / Fake browser UI | Visual tricks to make fake pages look real |
| AI content analysis | BART zero-shot classification on the full page text |

---

## Architecture

```
Chrome Extension (popup.js + scraper-bundle.js)
  ↓ scrapes page signals + text
FastAPI Backend (Render.com)
  ↓ checks Supabase 24h cache
  → heuristics (URL rules)
  → HF Inference API (facebook/bart-large-mnli)
  ↓ returns inline result
Extension displays score + injects interactive banner
```

**Key design decisions:**
- Results are returned **synchronously** — no polling
- Repeat scans of the same URL are served from `chrome.storage.local` (1h TTL) instantly
- A `/health` endpoint keeps both the Render backend and the HF model warm (set up a 10-min cron ping to avoid cold starts)

---

## Installation

1. Clone this repo
2. Go to `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `extension/` folder
5. Pin the 🛡️ icon to your toolbar

### Backend (self-host or use the live API)

```bash
cd backend
pip install -r requirements.txt
# add .env (see .env.example)
uvicorn main:app --reload
```

Required env vars:

```
HF_API_TOKEN=       # huggingface.co/settings/tokens
SUPABASE_URL=       # optional, for 24h cross-device cache
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Usage

1. Open any webpage
2. Click the 🛡️ shield icon
3. Click **Analyze Page**
4. Review the Trust Score and flagged signals
5. Click any issue in the banner to **highlight it on the page**
6. Optionally click **Scrape Page Data (JSON)** to export raw scan data
7. Click **RESET** to clear and scan again
