from __future__ import annotations

"""
Background worker orchestration.

Formula:
  - Both available:  Final = 0.4 * Rule + 0.6 * AI
  - AI unavailable:  Final = Rule  (heuristics-only fallback)
"""

import logging
from typing import Any, Dict

from heuristics import calculate_rule_score
from ai import analyze_intent
from cache import get_cached_result, set_cached_result

logger = logging.getLogger(__name__)


def process_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = payload or {}
    url = payload.get("url", "")
    text = payload.get("text", payload.get("text_content", ""))

    cached = get_cached_result(url)
    if cached is not None:
        logger.info("Cache hit for %s", url)
        return cached

    rule_score = calculate_rule_score(url)

    ai_score = analyze_intent(text)  # float or None
    ai_available = ai_score is not None

    if ai_available:
        final_score = (0.4 * rule_score) + (0.6 * ai_score)
    else:
        # AI unavailable — trust heuristics alone rather than artificially deflating score
        logger.warning("AI scoring unavailable for %s, using rule_score only.", url)
        final_score = rule_score
        ai_score = 0.0

    result: Dict[str, Any] = {
        "url": url,
        "rule_score": float(rule_score),
        "ai_score": float(ai_score),
        "final_score": float(final_score),
        "ai_available": ai_available,
    }

    try:
        set_cached_result(url, result)
    except Exception as e:
        logger.debug("Cache storage skipped: %s", e)

    return result
