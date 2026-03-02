from __future__ import annotations

"""
Supabase cache placeholder with 24h TTL.

This module will be wired to Supabase once configuration is provided.
Until then, the functions below act as stubs.
"""

from typing import Any, Dict, Optional


def get_cached_result(url: str) -> Optional[Dict[str, Any]]:
    """
    Placeholder for reading from Supabase cache.
    Currently always behaves as a cache miss.
    """
    return None


def set_cached_result(url: str, result: Dict[str, Any]) -> None:
    """
    Placeholder for writing to Supabase cache.
    Raises until Supabase configuration is provided.
    """
    raise NotImplementedError("Supabase cache not configured (SUPABASE_URL not set)")

