// Utility functions for the Fraud Signal Scraper.

export function safeGet(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

export function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
}

export function findKeywords(text, keywords) {
    if (!text) return [];
    const lowerText = text.toLowerCase();
    return keywords.filter(keyword => lowerText.includes(keyword.toLowerCase()));
}

export function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

export function calculateGrammarAnomaly(text) {
    if (!text || text.length < 10) return 0;

    const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
    const uppercaseRatio = uppercaseCount / text.length;

    const punctuationBursts = (text.match(/[!?.]{3,}/g) || []).length;

    let score = 0;
    if (uppercaseRatio > 0.3) score += 0.5;
    if (punctuationBursts > 0) score += 0.5;

    return Math.min(score, 1.0);
}
