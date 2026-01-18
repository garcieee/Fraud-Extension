# Fraud-Extension

A browser extension that detects fraudulent and malicious content on web pages.

## How to Use

1. **Navigate to any website** you want to analyze
2. **Click the extension icon** in your browser toolbar
3. **Click "Analyze Page"** button
4. **View results:**
   - Trust score (0-100) with color coding
   - Verdict message
   - Domain and SSL information

The extension analyzes the current page you're viewing - no separate website needed!

## Testing

1. Load the extension (see Installation above)
2. Visit any website (e.g., `https://example.com`)
3. Click the extension icon
4. Click "Analyze Page"
5. Results appear in the popup

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
  ├── popup.js            # Popup logic
  └── scraper-bundle.js   # Fraud detection scraper
```
