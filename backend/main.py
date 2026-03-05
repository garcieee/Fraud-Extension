import os
import json
import uuid
import requests
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from cache import get_job_result, set_job_completed

load_dotenv()

app = FastAPI()

QSTASH_TOKEN = os.getenv("QSTASH_TOKEN")
MY_API_URL = os.getenv("RENDER_EXTERNAL_URL", "https://fraud-api-993p.onrender.com")

# Create data folder if it doesn't exist
DATA_FOLDER = Path("data")
DATA_FOLDER.mkdir(exist_ok=True)

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

@app.get("/")
def home():
    return {"status": "Online", "mode": "QStash Async"}


@app.get("/status/{job_id}")
def status_job(job_id: str):
    """Feedback: extension polls this for result; returns status and result (final_score)."""
    out = get_job_result(job_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return out

@app.post("/scan")
def receive_scan(data: ScanRequest):
    print(f"📥 Received Scan for: {data.url}")
    job_id = str(uuid.uuid4())
    payload = {**data.dict(), "job_id": job_id}

    if QSTASH_TOKEN:
        destination = f"{MY_API_URL}/process"
        qstash_url = f"https://qstash.upstash.io/v2/publish/{destination}"
        headers = {
            "Authorization": f"Bearer {QSTASH_TOKEN}",
            "Content-Type": "application/json"
        }
        try:
            response = requests.post(qstash_url, headers=headers, json=payload)
            print(f"✅ Offloaded to QStash: {response.status_code}")
        except Exception as e:
            print(f"❌ QStash Connection Failed: {e}")

    return {"status": "queued", "message": "Analysis started in background", "job_id": job_id}

@app.post("/process")
async def process_scan(request: Request):
    body = await request.json()
    job_id = body.get("job_id")
    url = body.get('url', 'unknown')
    trust_score = body.get('trust_score', 0)
    signals = body.get('signals', {})
    
    print(f"⚙️ WORKER: Processing job for {url}")
    
    # Extract domain for filename
    try:
        domain = urlparse(url).netloc.replace('.', '-') or 'unknown'
    except Exception:
        domain = 'unknown'
    
    # Create filename with timestamp
    timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
    filename = f"{domain}_{timestamp}.json"
    filepath = DATA_FOLDER / filename
    
    # Prepare data to save
    timestamp_iso = datetime.now().isoformat()
    data_to_save = {
        "url": url,
        "trust_score": trust_score,
        "timestamp": timestamp_iso,
        "signals": signals
    }
    
    # Save to data folder
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data_to_save, f, indent=2, ensure_ascii=False)
        print(f"✅ Saved JSON to: {filepath}")
    except Exception as e:
        print(f"❌ Error saving file: {e}")
        return {"status": "error", "message": str(e)}

    # Memory layer: save job result for feedback (GET /status/{job_id})
    result = {"url": url, "trust_score": trust_score, "final_score": trust_score}
    if job_id:
        set_job_completed(job_id, result)
    
    return {"status": "processed", "file": filename}