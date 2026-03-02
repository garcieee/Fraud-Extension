from __future__ import annotations

"""
AI scoring (AI_Score) placeholder.

This module will call the Hugging Face Inference API
(facebook/bart-large-mnli) once credentials are provided.

Until then, calling analyze_intent will raise a NotImplementedError.
"""

from typing import Any


def analyze_intent(text: str) -> float:
    """
    Analyze intent of the given text and return AI_Score in [0, 100].

    Placeholder implementation: raises until Hugging Face integration
    is configured.
    """
    raise NotImplementedError("AI intent analysis not configured (HF_API_TOKEN not set)")

