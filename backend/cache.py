"""
Supabase Memory Layer: 24h cache (fraud_scans) + job status (scan_jobs) for feedback.
When SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, uses real Supabase; otherwise no-op / returns None.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from urllib.parse import quote_plus

import requests

# Load from env via config (avoids circular import by importing only what we need)
import os
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "fraud_scans")
SUPABASE_JOBS_TABLE = os.getenv("SUPABASE_JOBS_TABLE", "scan_jobs")
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "86400"))


def _enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def _headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation",
    }


# ---------- 24h cache (url -> result) ----------


def get_cached_result(url: str) -> Optional[Dict[str, Any]]:
    """Return cached result for url if present and fresh (< TTL). Else None."""
    if not _enabled() or not url:
        return None
    try:
        encoded = quote_plus(url)
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}",
            params={"url": f"eq.{url}", "select": "created_at,result"},
            headers=_headers(),
            timeout=3,
        )
        r.raise_for_status()
        rows = r.json()
    except Exception:
        return None
    if not isinstance(rows, list) or len(rows) == 0:
        return None
    row = rows[0]
    created_raw = row.get("created_at")
    if not created_raw:
        return None
    try:
        created = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
    except Exception:
        return None
    if (datetime.now(timezone.utc) - created).total_seconds() > CACHE_TTL_SECONDS:
        return None
    result = row.get("result")
    return result if isinstance(result, dict) else None


def set_cached_result(url: str, result: Dict[str, Any]) -> None:
    """Write result to Supabase cache (best-effort)."""
    if not _enabled() or not url:
        return
    try:
        payload = {
            "url": url,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "result": result,
        }
        requests.post(
            f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}",
            headers={**_headers(), "Prefer": "resolution=merge-duplicates"},
            json=payload,
            timeout=3,
        )
    except Exception:
        pass


# ---------- Job status (for feedback polling) ----------
# In-memory fallback when Supabase is not configured (so feedback still works)
_jobs_in_memory: Dict[str, Dict[str, Any]] = {}


def get_job_result(job_id: str) -> Optional[Dict[str, Any]]:
    """Return { status, result } for job_id if found; else None."""
    if not job_id:
        return None
    if not _enabled():
        return _jobs_in_memory.get(job_id)
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{SUPABASE_JOBS_TABLE}",
            params={"job_id": f"eq.{job_id}", "select": "status,result,created_at"},
            headers={**_headers(), "Accept": "application/json"},
            timeout=3,
        )
        r.raise_for_status()
        rows = r.json()
    except Exception:
        return None
    if not isinstance(rows, list) or len(rows) == 0:
        return None
    row = rows[0]
    return {
        "status": row.get("status", "pending"),
        "result": row.get("result"),
    }


def set_job_completed(job_id: str, result: Dict[str, Any]) -> None:
    """Store completed job for GET /status/{job_id}. Uses Supabase if configured, else in-memory."""
    if not job_id:
        return
    if not _enabled():
        _jobs_in_memory[job_id] = {"status": "completed", "result": result}
        return
    try:
        payload = {
            "job_id": job_id,
            "status": "completed",
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        requests.post(
            f"{SUPABASE_URL}/rest/v1/{SUPABASE_JOBS_TABLE}",
            headers={**_headers(), "Prefer": "resolution=merge-duplicates"},
            json=payload,
            timeout=3,
        )
    except Exception:
        pass
