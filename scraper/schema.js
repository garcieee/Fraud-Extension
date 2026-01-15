/**
 * Fraud Signal Scraper Schema
 * 
 * This file documents the structure of the JSON object returned by extractPageSignals().
 * It serves as a reference for the data shape.
 */

export const SIGNAL_SCHEMA = {
    page_identity: {
        url: "string",
        domain: "string",
        title: "string",
        language: "string",
        meta_description: "string"
    },
    forms_and_credentials: {
        total_forms: "number",
        has_password_field: "boolean",
        has_email_field: "boolean",
        has_credit_card_field: "boolean",
        form_action_domains: "array<string>",
        suspicious_input_names: "array<string>"
    },
    brand_impersonation: {
        visible_brand_keywords: "array<string>",
        logo_image_sources: "array<string>",
        domain_looks_like_brand: "boolean"
    },
    textual_scam_language: {
        urgency_keywords_found: "array<string>",
        threat_keywords_found: "array<string>",
        reward_keywords_found: "array<string>",
        grammar_anomaly_score: "number" // 0.0 to 1.0
    },
    technical_structural: {
        iframe_count: "number",
        hidden_iframe_count: "number",
        external_script_domains: "array<string>",
        number_of_external_links: "number",
        redirect_detected: "boolean",
        popup_detected: "boolean"
    },
    obfuscation_evasion: {
        right_click_disabled: "boolean",
        copy_disabled: "boolean",
        excessive_event_listeners: "boolean",
        base64_strings_detected: "boolean"
    },
    layout_deception: {
        full_screen_overlays: "boolean",
        fake_browser_ui_elements: "boolean",
        z_index_abuse_count: "number"
    }
};
