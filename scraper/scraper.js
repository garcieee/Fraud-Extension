import { cleanText } from './utils.js';

/**
 * Minimal scraper used by the browser extension / worker:
 * - Captures the current page URL
 * - Captures visible page text
 * - Normalizes the text for downstream analysis
 */
export function scrapePage() {
  const url = window.location.href || "";
  const rawText = document.body ? document.body.innerText || "" : "";
  const text = cleanText(rawText);

  return { url, text };
}
