// Text cleaning helpers for the scraper.

/**
 * Normalize page text:
 * - Remove zero-width characters
 * - Collapse whitespace
 * - Trim leading/trailing spaces
 */
export function cleanText(input) {
  if (!input) return "";

  // Remove zero-width / BOM-style characters
  const withoutControl = input.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Collapse all whitespace runs to a single space
  return withoutControl.replace(/\s+/g, " ").trim();
}
