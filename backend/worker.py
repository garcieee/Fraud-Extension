from __future__ import annotations

"""
Background worker orchestration.

QStash delivers the payload from the API gateway (main.py) to this module.
This file does NOT define any FastAPI routes; it is meant to be imported by
whichever entrypoint QStash calls.

Expected payload shape (from the scraper/extension):
{
  "url": "https://example.com/path",
  "text": "Visible page text here..."
}

Pipeline:
1. Check Supabase cache for this URL.
2. If fresh result exists (< TTL), return it.
3. Otherwise:
   - Compute Rule_Score via heuristics.calculate_rule_score
   - Compute AI_Score via ai.analyze_intent
   - Final_Score = (0.4 * Rule_Score) + (0.6 * AI_Score)
   - Save to Supabase cache
   - Return full result dict
"""

from typing import Any, Dict

from .heuristics import calculate_rule_score
from .ai import analyze_intent
from .cache import get_cached_result, set_cached_result


def process_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entrypoint for the worker.
    """
    url = (payload or {}).get("url") or ""
    text = (payload or {}).get("text") or payload.get("text_content") or ""

    # 1. Cache check (stubbed, may always miss until Supabase is configured)
    cached = get_cached_result(url)
    if cached is not None:
        return cached

    # 2. Heuristic + AI scores
    rule_score = calculate_rule_score(url)
    try:
        ai_score = analyze_intent(text)
    except NotImplementedError:
        ai_score = 0.0

    final_score = (0.4 * rule_score) + (0.6 * ai_score)

    result: Dict[str, Any] = {
        "url": url,
        "rule_score": rule_score,
        "ai_score": ai_score,
        "final_score": final_score,
    }

    # 3. Persist to cache (best-effort, stubbed)
    try:
        set_cached_result(url, result)
    except NotImplementedError:
        pass

    return result

