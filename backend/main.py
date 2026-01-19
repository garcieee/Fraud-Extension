import os
import requests
from fastapi import FastAPI, Header, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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
    text_content: str = ""
    trust_score: int = 0

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
    print(f"⚙️ WORKER: Processing job for {body.get('url')}")
    
    # PHASE 2 TODO: Call Hugging Face here
    # PHASE 3 TODO: Save to Neo4j here
    
    return {"status": "processed"}