from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# --- 1. Security: CORS ---
# Explanation: Browsers block extensions from talking to unknown servers.
# This tells the browser "It is okay to talk to me."
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # We will restrict this to your Extension ID in Phase 3
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Data Model ---
# Explanation: This defines the shape of the data we expect from Chrome.
class ScanRequest(BaseModel):
    url: str
    text_content: str = ""
    trust_score: int = 0

@app.get("/")
def home():
    return {"status": "Online", "stack": "Render + FastAPI"}

@app.post("/scan")
def receive_scan(data: ScanRequest, authorization: str = Header(None)):
    # --- AUTH STUB (Firebase) ---
    # We are just logging it for now. Later we will verify the token.
    if not authorization:
        print("⚠️ No Auth Token received")
    
    print(f"📥 Received Scan: {data.url}")
    print(f"📊 Local Score: {data.trust_score}")
    
    # --- FUTURE INTEGRATION POINTS ---
    # 1. TODO: Push 'data' to Upstash Kafka
    # 2. TODO: Send 'text_content' to Hugging Face
    
    return {
        "status": "received", 
        "verdict": "Processing (Backend Active)"
    }