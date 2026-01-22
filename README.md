# Fraud-Extension

A browser extension that detects fraudulent and malicious content on web pages, with backend processing and storage.

## How It Works

1. **Extension** - Scans pages for fraud signals and calculates trust score
2. **Backend API** - Receives scan data and queues it via QStash
3. **Worker** - Processes queued jobs and saves JSON to `backend/data/` folder

## Extension Usage

1. **Load extension:**
   - Open `chrome://extensions/` or `edge://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked" → Select `extension` folder

2. **Use it:**
   - Navigate to any website
   - Click extension icon → "Analyze Page"
   - View trust score and results in popup
   - Data automatically sent to backend and saved

## Backend Setup

1. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Set environment variables:**
   Create `.env` file:
   ```
   QSTASH_TOKEN=your_qstash_token
   RENDER_EXTERNAL_URL=https://fraud-api-993p.onrender.com
   ```

3. **Run backend:**
   ```bash
   uvicorn main:app --reload
   ```

4. **Data storage:**
   - Scanned data saved to `backend/data/` folder
   - Files named: `domain_timestamp.json`
   - Contains: URL, trust score, timestamp, full signals data

## Architecture

**Extension Flow:**
- User clicks "Analyze Page"
- Scraper extracts fraud signals
- Calculates trust score (0-100)
- Sends JSON to backend API

**Backend Flow:**
- `/scan` endpoint receives data
- Queues job via QStash
- `/process` worker processes job
- Saves JSON to `data/` folder

## What It Detects

- **Forms & Credentials** - Password fields, credit card inputs, suspicious forms
- **Brand Impersonation** - Fake brand logos, domain spoofing
- **Scam Language** - Urgency/threat/reward keywords, grammar anomalies
- **Technical Issues** - Hidden iframes, redirects, external scripts
- **Obfuscation** - Disabled right-click, base64 encoding
- **Layout Deception** - Full-screen overlays, fake browser UI

## Project Structure

```
extension/
  ├── manifest.json       # Extension configuration
  ├── popup.html          # Extension popup UI
  ├── popup.js            # Popup logic & API calls
  └── scraper-bundle.js   # Fraud detection scraper

backend/
  ├── main.py             # FastAPI server with QStash queue
  ├── requirements.txt    # Python dependencies
  └── data/               # Saved scan JSON files
```
