"""
Configuration for external services.
Load from environment when set; otherwise use placeholders.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Hugging Face Inference API (Zero-Shot Classification)
HF_API_URL = os.getenv("HF_API_URL", "")
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")

# Supabase (Memory Layer: cache + job status for feedback)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "fraud_scans")
SUPABASE_JOBS_TABLE = os.getenv("SUPABASE_JOBS_TABLE", "scan_jobs")

# Cache TTL in seconds (default: 24 hours)
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "86400"))

