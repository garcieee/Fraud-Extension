# Fraud Detector — Chrome Extension

A browser extension that scans any webpage for signs of fraud, phishing, or scam content and gives you a plain-English verdict in seconds.

---

## What It Does

When you click **Analyze Page**, the extension:
1. Scans the current page for suspicious content
2. Checks the URL and connection for red flags
3. Sends the data to a backend that runs heuristic rules + an AI model
4. Shows you a **Trust Score (0–100)** and a breakdown of anything suspicious

A floating banner also appears on the page itself so you don't have to keep the popup open.

---

## How to Read the Results

| Score | Meaning |
|-------|---------|
| **80–100** | No threats detected — looks safe |
| **50–79** | Warning — some suspicious elements found |
| **0–49** | High risk — likely phishing or scam |

The **Risk Signals** section tells you exactly what was flagged:

- **HTTPS Protocol** — whether the connection is encrypted
- **Raw IP in URL** — legitimate sites use domain names, not IPs
- **URL Length** — unusually long URLs are a common phishing trick
- **Payment + Password Form** — a page asking for both is a major red flag
- **Brand Impersonation** — domain mimicking a known brand (e.g. `paypa1.com`)
- **Urgency / Threat / Reward Language** — scam keywords detected, with the specific words shown
- **Hidden Iframes** — invisible frames that can steal data
- **Right-Click Disabled** — sites that block right-click often have something to hide
- **Fullscreen Overlay / Fake Browser UI** — tricks used to make fake pages look real

---

## Installation

1. Download or clone this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `extension/` folder
5. The shield icon will appear in your toolbar — pin it for easy access

---

## Usage

1. Navigate to any website
2. Click the 🛡️ shield icon in your toolbar
3. Click **Analyze Page**
4. Wait a few seconds for the scan to complete
5. Review the Trust Score and flagged signals
6. Click **RESET** to clear and scan again

> The floating banner on the page can be dismissed with the **×** button.
