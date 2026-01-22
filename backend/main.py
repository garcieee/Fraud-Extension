import os
import json
import requests
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, Header, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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

@app.post("/scan")
def receive_scan(data: ScanRequest):
    print(f"📥 Received Scan for: {data.url}")
    
    if QSTASH_TOKEN:
        destination = f"{MY_API_URL}/process"
        qstash_url = f"https://qstash.upstash.io/v2/publish/{destination}"
        
        headers = {
            "Authorization": f"Bearer {QSTASH_TOKEN}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(qstash_url, headers=headers, json=data.dict())
            print(f"✅ Offloaded to QStash: {response.status_code}")
        except Exception as e:
            print(f"❌ QStash Connection Failed: {e}")

    return {"status": "queued", "message": "Analysis started in background"}

@app.post("/process")
async def process_scan(request: Request):
    body = await request.json()
    url = body.get('url', 'unknown')
    trust_score = body.get('trust_score', 0)
    signals = body.get('signals', {})
    
    print(f"⚙️ WORKER: Processing job for {url}")
    
    # Extract domain for filename
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.replace('.', '-') or 'unknown'
    except:
        domain = 'unknown'
    
    # Create filename with timestamp
    timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
    filename = f"{domain}_{timestamp}.json"
    filepath = DATA_FOLDER / filename
    
    # Prepare data to save
    data_to_save = {
        "url": url,
        "trust_score": trust_score,
        "timestamp": datetime.now().isoformat(),
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
    
    # PHASE 2 TODO: Call Hugging Face here
    # PHASE 3 TODO: Save to Neo4j here
    
    return {"status": "processed", "file": filename}