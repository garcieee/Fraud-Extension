import os
import uuid
import threading
import requests
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from ai import warmup as ai_warmup
from cache import get_job_result, set_job_completed
from worker import process_job as worker_process_job

load_dotenv()

app = FastAPI()

QSTASH_TOKEN = os.getenv("QSTASH_TOKEN")
MY_API_URL = os.getenv("RENDER_EXTERNAL_URL", "https://fraud-api-993p.onrender.com")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    url: str
    trust_score: int = 0
    signals: dict = {}
    text: str = ""  # raw page text from scraper (used by BART)


def _text_from_signals(signals: dict) -> str:
    """Last-resort: build minimal text from signals when no raw text was sent."""
    if not signals:
        return ""
    parts = []
    pi = signals.get("page_identity") or {}
    parts.append(pi.get("title") or "")
    parts.append(pi.get("meta_description") or "")
    tc = signals.get("textual_scam_language") or {}
    for key in ("urgency_keywords_found", "threat_keywords_found", "reward_keywords_found"):
        for w in (tc.get(key) or []):
            parts.append(w)
    return " ".join(str(p).strip() for p in parts if p).strip()


@app.get("/")
def home():
    return {"status": "Online"}


@app.get("/health")
def health():
    """Keep-alive endpoint: keeps Render warm and pings HF to keep the model resident."""
    threading.Thread(target=ai_warmup, daemon=True).start()
    return {"status": "ok"}


@app.get("/status/{job_id}")
def status_job(job_id: str):
    out = get_job_result(job_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return out


@app.post("/scan")
def receive_scan(data: ScanRequest):
    print(f"📥 Received scan for: {data.url}")
    job_id = str(uuid.uuid4())
    payload = {**data.dict(), "job_id": job_id}

    if QSTASH_TOKEN:
        destination = f"{MY_API_URL}/process"
        qstash_url = f"https://qstash.upstash.io/v2/publish/{destination}"
        headers = {
            "Authorization": f"Bearer {QSTASH_TOKEN}",
            "Content-Type": "application/json",
        }
        try:
            r = requests.post(qstash_url, headers=headers, json=payload, timeout=10)
            print(f"✅ Offloaded to QStash: {r.status_code}")
        except Exception as e:
            print(f"❌ QStash failed: {e}")
    else:
        # No QStash — run synchronously and return the result inline (no polling needed)
        result = _run_job(payload)
        return {"status": "completed", "job_id": job_id, "result": result}

    return {"status": "queued", "message": "Analysis started", "job_id": job_id}


@app.post("/process")
async def process_scan(request: Request):
    body = await request.json()
    _run_job(body)
    return {"status": "processed"}


def _run_job(payload: dict) -> dict:
    """Core processing logic shared by sync and async paths. Returns the result dict."""
    job_id = payload.get("job_id")
    url = payload.get("url", "unknown")
    trust_score = payload.get("trust_score", 0)
    signals = payload.get("signals", {})

    # Prefer raw text from extension; fall back to signals-derived text
    text = payload.get("text") or _text_from_signals(signals)

    print(f"⚙️  Processing job for {url} (text_len={len(text)})")

    try:
        hybrid = worker_process_job({"url": url, "text": text})
        result = {
            "url": url,
            "trust_score": trust_score,
            "rule_score": hybrid.get("rule_score"),
            "ai_score": hybrid.get("ai_score"),
            "final_score": hybrid.get("final_score"),
            "ai_available": hybrid.get("ai_available", False),
            "flags": hybrid.get("flags"),
        }
    except Exception as e:
        print(f"❌ Worker error: {e}")
        result = {"url": url, "trust_score": trust_score, "final_score": trust_score}

    if job_id:
        set_job_completed(job_id, result)

    return result
