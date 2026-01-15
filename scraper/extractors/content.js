import { findKeywords, calculateGrammarAnomaly } from '../utils.js';

export function extractContent() {
    const urgencyKeywords = ["urgent", "immediate", "suspend", "lock", "verify", "24 hours", "limited time"];
    const threatKeywords = ["terminate", "suspend", "legal", "police", "arrest", "warrant"];
    const rewardKeywords = ["winner", "lottery", "prize", "claim", "reward", "million"];

    // Use innerText to get visible text, but fallback to textContent if empty
    const bodyText = document.body.innerText || document.body.textContent || "";

    return {
        urgency_keywords_found: findKeywords(bodyText, urgencyKeywords),
        threat_keywords_found: findKeywords(bodyText, threatKeywords),
        reward_keywords_found: findKeywords(bodyText, rewardKeywords),
        grammar_anomaly_score: calculateGrammarAnomaly(bodyText.substring(0, 1000))
    };
}
