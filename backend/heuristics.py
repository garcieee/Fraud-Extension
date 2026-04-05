from __future__ import annotations

"""
Heuristic scoring (Rule_Score) for URLs.

Implements Section 4.1 of the design doc:
Rule_Score = min(100, sum(weight * feature_flag))

Features:
- IP Address Usage (Weight = 100)
- URL Length > 75 (Weight = 20)
- Protocol not HTTPS (Weight = 30)
- Suspicious symbols in host (Weight = 20)
"""

from typing import Optional
from urllib.parse import urlparse
import ipaddress


def _extract_host(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url)
        return parsed.hostname or ""
    except Exception:
        return ""


def _uses_ip_address(host: str) -> bool:
    if not host:
        return False
    try:
        # Direct IP (e.g. 192.168.0.1 or 2001:db8::1)
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def get_url_flags(url: str) -> dict:
    """Return a dict of individual heuristic flags for the given URL."""
    url = url or ""
    host = _extract_host(url) or ""
    return {
        "ip_address": _uses_ip_address(host),
        "long_url": len(url) > 75,
        "no_https": not url.lower().startswith("https://"),
        "suspicious_chars": "@" in url or host.count("-") >= 3,
    }


def calculate_rule_score(url: str) -> float:
    """
    Compute Rule_Score in the range [0, 100].

    This is intentionally simple and deterministic so it can run on every request.
    """
    flags = get_url_flags(url)

    score = 0
    if flags["ip_address"]:
        score += 100
    if flags["long_url"]:
        score += 20
    if flags["no_https"]:
        score += 30
    if flags["suspicious_chars"]:
        score += 20

    return float(min(100, score))

