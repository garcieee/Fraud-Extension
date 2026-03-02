from __future__ import annotations

"""
AI Intent scoring (AI_Score) for visible website text.

Implements Section 4.2 of the design doc:
A probabilistic analysis using the Hugging Face Inference API (facebook/bart-large-mnli).
"""

import requests
import logging
from config import HF_API_URL, HF_API_TOKEN

logger = logging.getLogger(__name__)

API_URL = HF_API_URL or "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
HF_API_TOKEN = "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"

CANDIDATE_LABELS = [
    "urgent action",
    "financial request",
    "login verification",
    "informational"
]

HIGH_RISK_LABELS = {"urgent action", "financial request", "login verification"}

def analyze_intent(text: str) -> float:
    """
    Compute AI_Score in the range [0.0, 100.0].
    """
    if not text or not text.strip():
        return 0.0

    if not HF_API_TOKEN:
        logger.error("Missing Hugging Face API Token.")
        return 0.0

    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    truncated_text = text[:2500]

    payload = {
        "inputs": truncated_text,
        "parameters": {
            "candidate_labels": CANDIDATE_LABELS
        }
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=60.0)
        response.raise_for_status()
        result = response.json()

        if isinstance(result, dict):
            if "estimated_time" in result:
                logger.warning("Hugging Face model is asleep. Returning 0.0 default.")
                return 0.0
                
            labels = result.get("labels", [])
            scores = result.get("scores", [])
            
            max_risk_score = 0.0
            for label, score in zip(labels, scores):
                if str(label).lower() in HIGH_RISK_LABELS:
                    max_risk_score = max(max_risk_score, float(score))
            
            if max_risk_score > 0:
                return float(max_risk_score * 100.0)
                
        if isinstance(result, list):
            if len(result) > 0 and isinstance(result[0], list):
                result = result[0]
                
            max_risk_score = 0.0
            for item in result:
                if isinstance(item, dict):
                    label = item.get("label", item.get("class", "")).lower()
                    score = item.get("score", 0.0)
                    if label in HIGH_RISK_LABELS:
                        max_risk_score = max(max_risk_score, float(score))
                        
            return float(max_risk_score * 100.0)

    except requests.exceptions.RequestException as e:
        logger.error(f"Hugging Face API request failed: {e}")
        return 0.0
    except Exception as e:
        logger.error(f"Unexpected error in analyze_intent: {e}")
        return 0.0
        
    return 0.0