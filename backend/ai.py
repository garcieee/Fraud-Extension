from __future__ import annotations

"""
AI Intent scoring (AI_Score) for visible website text.

Uses facebook/bart-base-mnli (faster than bart-large) via Hugging Face Inference API.
Returns a float in [0.0, 100.0] or None if the API is unavailable.
"""

import time
import requests
import logging
from config import HF_API_URL, HF_API_TOKEN

logger = logging.getLogger(__name__)

# bart-base-mnli is ~3x faster than bart-large-mnli with similar accuracy for this task
DEFAULT_MODEL_URL = "https://api-inference.huggingface.co/models/facebook/bart-base-mnli"
API_URL = HF_API_URL or DEFAULT_MODEL_URL

CANDIDATE_LABELS = [
    "urgent action",
    "financial request",
    "login verification",
    "informational"
]

HIGH_RISK_LABELS = {"urgent action", "financial request", "login verification"}


def _parse_score(result: dict) -> float | None:
    """Extract max risk score from a HF zero-shot classification response."""
    labels = result.get("labels", [])
    scores = result.get("scores", [])
    max_risk = 0.0
    for label, score in zip(labels, scores):
        if str(label).lower() in HIGH_RISK_LABELS:
            max_risk = max(max_risk, float(score))
    return float(max_risk * 100.0) if max_risk > 0 else 0.0


def analyze_intent(text: str) -> float | None:
    """
    Compute AI_Score in [0.0, 100.0], or None if the API is unavailable.

    Returning None (vs 0.0) lets the worker distinguish a real "low risk"
    signal from a failed API call so it can fall back gracefully.
    """
    if not text or not text.strip():
        return 0.0

    if not (HF_API_TOKEN or "").strip():
        logger.error("Missing Hugging Face API token — skipping AI scoring.")
        return None

    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    payload = {
        "inputs": text[:2500],
        "parameters": {"candidate_labels": CANDIDATE_LABELS},
    }

    for attempt in range(2):
        try:
            response = requests.post(API_URL, headers=headers, json=payload, timeout=60.0)
            response.raise_for_status()
            result = response.json()

            if not isinstance(result, dict):
                logger.warning("Unexpected HF response format: %s", type(result))
                return None

            # Model is warming up — wait the suggested time and retry once
            if "estimated_time" in result:
                wait = min(float(result.get("estimated_time", 20)), 30)
                logger.info("HF model warming up, waiting %.0fs before retry...", wait)
                time.sleep(wait)
                continue  # retry

            return _parse_score(result)

        except requests.exceptions.Timeout:
            logger.warning("HF API timed out (attempt %d)", attempt + 1)
        except requests.exceptions.RequestException as e:
            logger.error("HF API request failed: %s", e)
            return None
        except Exception as e:
            logger.error("Unexpected error in analyze_intent: %s", e)
            return None

    logger.warning("HF model still not ready after retry — skipping AI scoring.")
    return None
