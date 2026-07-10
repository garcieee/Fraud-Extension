from __future__ import annotations

"""
AI Intent scoring (AI_Score) for visible website text.

Uses facebook/bart-large-mnli via the Hugging Face Inference router.
Returns a float in [0.0, 100.0] or None if the API is unavailable.

Note: the old api-inference.huggingface.co host is dead, and
facebook/bart-base-mnli never existed on the Hub — bart-large-mnli is
the canonical zero-shot model actually served by HF.
"""

import requests
import logging
from config import HF_API_URL, HF_API_TOKEN

logger = logging.getLogger(__name__)

DEFAULT_MODEL_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
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
        # wait_for_model: HF holds the connection while the model loads
        # instead of returning an "estimated_time" error — no sleep/retry needed.
        "options": {"wait_for_model": True, "use_cache": True},
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=45.0)
        response.raise_for_status()
        result = response.json()

        if not isinstance(result, dict):
            logger.warning("Unexpected HF response format: %s", type(result))
            return None

        return _parse_score(result)

    except requests.exceptions.Timeout:
        logger.warning("HF API timed out — skipping AI scoring.")
        return None
    except requests.exceptions.RequestException as e:
        logger.error("HF API request failed: %s", e)
        return None
    except Exception as e:
        logger.error("Unexpected error in analyze_intent: %s", e)
        return None


def warmup() -> bool:
    """
    Fire a tiny classification request to keep the model resident on HF's
    infrastructure. Called from the /health keep-alive endpoint.
    """
    if not (HF_API_TOKEN or "").strip():
        return False
    try:
        response = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {HF_API_TOKEN}"},
            json={
                "inputs": "hello",
                "parameters": {"candidate_labels": CANDIDATE_LABELS},
                "options": {"wait_for_model": True, "use_cache": True},
            },
            timeout=45.0,
        )
        return response.ok
    except requests.exceptions.RequestException:
        return False
