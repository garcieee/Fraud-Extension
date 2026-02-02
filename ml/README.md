# ML (prep)

This folder is **prep only** (no model training yet). It’s aligned to the JSON files your backend saves in `backend/data/`.

## What data looks like (input)

The backend saves one file per scan:
- Location: `backend/data/*.json`
- Shape:
  - `url` (string)
  - `trust_score` (int)
  - `timestamp` (string)
  - `signals` (object) — the scraper output (forms/brand/content/tech/obfuscation/layout/etc.)

## What we’ll build next (output)

When you’re ready to train, we’ll produce:
- Feature rows (X) derived from `signals`
- Labels (y) derived from your chosen labeling method
- Saved artifacts in `backend/ml/artifacts/` (model file, feature mapping, metrics)

## Files

- `extract_features.py`: converts a saved scan JSON into a flat numeric feature dict (ready for ML later)
- `artifacts/`: reserved for trained model + metadata (later)

