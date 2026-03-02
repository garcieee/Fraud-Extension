"""
Configuration placeholders for external services.

Do NOT add any loading logic here yet. These values are meant to be
manually filled in (or wired up later) when Supabase / Hugging Face
integration is implemented.
"""

# Hugging Face Inference API (Zero-Shot Classification)
HF_API_URL = ""
HF_API_TOKEN = ""

# Supabase configuration (used as short-term cache)
SUPABASE_URL = ""
SUPABASE_SERVICE_ROLE_KEY = ""
SUPABASE_TABLE = "fraud_scans"

# Cache TTL in seconds (default: 24 hours)
CACHE_TTL_SECONDS = 86400

