from __future__ import annotations

"""
Background worker orchestration.

QStash delivers the payload from the API gateway (main.py) to this module.
This file orchestrates the Heuristic and AI engines to produce a Final_Score.

Formula (Section 4.3): Final_Score = (0.4 * Rule_Score) + (0.6 * AI_Score)
"""

import logging
from typing import Any, Dict

from heuristics import calculate_rule_score
from ai import analyze_intent
from cache import get_cached_result, set_cached_result

logger = logging.getLogger(__name__)

def process_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entrypoint for the worker. Takes the webhook payload and calculates risk.
    """
    payload = payload or {}
    
    url = payload.get("url", "")
    text = payload.get("text", payload.get("text_content", ""))


    cached = get_cached_result(url)
    if cached is not None:
        logger.info(f"Cache hit for {url}")
        return cached

 
    rule_score = calculate_rule_score(url)
    
    ai_score = analyze_intent(text)

    final_score = (0.4 * rule_score) + (0.6 * ai_score)

    result: Dict[str, Any] = {
        "url": url,
        "rule_score": float(rule_score),
        "ai_score": float(ai_score),
        "final_score": float(final_score),
    }

 
    try:
        set_cached_result(url, result)
    except (NotImplementedError, Exception) as e:
        logger.debug(f"Cache storage skipped or failed: {e}")

    return result