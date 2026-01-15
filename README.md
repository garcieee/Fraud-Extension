# Fraud-Extension

A browser-based fraud detection scraper that analyzes web pages for suspicious signals.

## Quick Start

1. **Start a local server** (required for ES modules):
   ```bash
   python3 -m http.server 8000
   ```
   Or with Node.js:
   ```bash
   npx serve -p 8000
   ```

2. **Open in browser**: `http://localhost:8000/test/test_harness.html`

3. **Click "Scrape Current Page"** - it will:
   - Extract fraud signals from the page
   - Display "Website scraped" message
   - Automatically download a JSON file
   - Show results on screen

## How to Use

1. Start the server (see above)
2. Open `http://localhost:8000/test/test_harness.html` in your browser
3. Click **"Scrape Current Page"** button
4. Results download automatically as JSON

**Note:** The scraper analyzes the current page you're viewing. The test harness page includes sample fraud signals for testing.

## URL Input

- The URL field is pre-filled with `https://en.wikipedia.org/wiki/Main_Page`
- Click "Navigate to URL" to go to that page
- **Important:** The scraper only works on pages that have the scraper code loaded (like the test harness page)

## Output

- **File location:** Downloads folder (browser default)
- **Filename format:** `domain_timestamp.json`
- **Example:** `localhost_2026-01-15T11-52-22-947Z.json`

The JSON contains fraud detection signals:
- `page_identity` - URL, domain, title, language
- `forms_and_credentials` - Password fields, credit card inputs, suspicious forms
- `brand_impersonation` - Brand keywords, logo detection
- `textual_scam_language` - Urgency/threat/reward keywords, grammar anomalies
- `technical_structural` - Iframes, external scripts, redirects
- `obfuscation_evasion` - Disabled right-click, base64 strings
- `layout_deception` - Full-screen overlays, fake browser UI

## Project Structure

```
scraper/
  ├── scraper.js          # Main scraper function
  ├── saveScrapeResults() # Auto-saves JSON
  ├── extractors/         # Signal extraction modules
  └── results/            # Output folder (optional)
```
