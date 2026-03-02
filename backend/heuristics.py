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


def calculate_rule_score(url: str) -> float:
    """
    Compute Rule_Score in the range [0, 100].

    This is intentionally simple and deterministic so it can run on every request.
    """
    url = url or ""
    host = _extract_host(url) or ""

    score = 0

    # IP address usage
    if _uses_ip_address(host):
        score += 100

    # URL length > 75 chars
    if len(url) > 75:
        score += 20

    # Protocol not HTTPS
    if not url.lower().startswith("https://"):
        score += 30

    # Suspicious symbols: '@' anywhere or many hyphens in host
    if "@" in url or host.count("-") >= 3:
        score += 20

    return float(min(100, score))

