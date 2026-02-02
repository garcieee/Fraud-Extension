"""
Prep-only feature extraction (no model training here).

Input: one JSON file from backend/data/*.json
Output: a flat dict of numeric features derived from `signals`
"""

from __future__ import annotations

from typing import Any, Dict


def _count(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, list):
        return len(value)
    return 0


def _bool(value: Any) -> int:
    return 1 if bool(value) else 0


def extract_features(saved_scan: Dict[str, Any]) -> Dict[str, float]:
    """
    saved_scan is expected to match backend/main.py `data_to_save`:
    {
      "url": str,
      "trust_score": int,
      "timestamp": str,
      "signals": { ... }
    }
    """

    signals = saved_scan.get("signals") or {}

    page_identity = signals.get("page_identity") or {}
    forms = signals.get("forms_and_credentials") or {}
    brand = signals.get("brand_impersonation") or {}
    content = signals.get("textual_scam_language") or {}
    tech = signals.get("technical_structural") or {}
    obf = signals.get("obfuscation_evasion") or {}
    layout = signals.get("layout_deception") or {}

    # Keep this minimal + stable: numeric scalars only.
    features: Dict[str, float] = {
        # identity
        "has_meta_description": float(_bool(page_identity.get("meta_description"))),

        # forms
        "total_forms": float(forms.get("total_forms") or 0),
        "has_password_field": float(_bool(forms.get("has_password_field"))),
        "has_email_field": float(_bool(forms.get("has_email_field"))),
        "has_credit_card_field": float(_bool(forms.get("has_credit_card_field"))),
        "form_action_domains_count": float(_count(forms.get("form_action_domains"))),
        "suspicious_input_names_count": float(_count(forms.get("suspicious_input_names"))),

        # brand
        "visible_brand_keywords_count": float(_count(brand.get("visible_brand_keywords"))),
        "logo_image_sources_count": float(_count(brand.get("logo_image_sources"))),
        "domain_looks_like_brand": float(_bool(brand.get("domain_looks_like_brand"))),

        # content
        "urgency_keywords_count": float(_count(content.get("urgency_keywords_found"))),
        "threat_keywords_count": float(_count(content.get("threat_keywords_found"))),
        "reward_keywords_count": float(_count(content.get("reward_keywords_found"))),
        "grammar_anomaly_score": float(content.get("grammar_anomaly_score") or 0.0),

        # technical
        "iframe_count": float(tech.get("iframe_count") or 0),
        "hidden_iframe_count": float(tech.get("hidden_iframe_count") or 0),
        "external_script_domains_count": float(_count(tech.get("external_script_domains"))),
        "number_of_external_links": float(tech.get("number_of_external_links") or 0),
        "redirect_detected": float(_bool(tech.get("redirect_detected"))),
        "popup_detected": float(_bool(tech.get("popup_detected"))),

        # obfuscation
        "right_click_disabled": float(_bool(obf.get("right_click_disabled"))),
        "copy_disabled": float(_bool(obf.get("copy_disabled"))),
        "excessive_event_listeners": float(_bool(obf.get("excessive_event_listeners"))),
        "base64_strings_detected": float(_bool(obf.get("base64_strings_detected"))),

        # layout
        "full_screen_overlays": float(_bool(layout.get("full_screen_overlays"))),
        "fake_browser_ui_elements": float(_bool(layout.get("fake_browser_ui_elements"))),
        "z_index_abuse_count": float(layout.get("z_index_abuse_count") or 0),
    }

    return features

