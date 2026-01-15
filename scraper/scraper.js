import { getDomain, findKeywords, isVisible, calculateGrammarAnomaly } from './utils.js';

export function extractPageSignals() {
    const signals = {
        page_identity: {},
        forms_and_credentials: {},
        brand_impersonation: {},
        textual_scam_language: {},
        technical_structural: {},
        obfuscation_evasion: {},
        layout_deception: {}
    };

    // Page Identity
    signals.page_identity.url = window.location.href;
    signals.page_identity.domain = window.location.hostname;
    signals.page_identity.title = document.title;
    signals.page_identity.language = document.documentElement.lang || navigator.language;
    const metaDesc = document.querySelector('meta[name="description"]');
    signals.page_identity.meta_description = metaDesc ? metaDesc.content : "";

    // Forms & Credential Harvesting
    const forms = Array.from(document.forms);
    signals.forms_and_credentials.total_forms = forms.length;

    const inputs = Array.from(document.querySelectorAll('input'));
    signals.forms_and_credentials.has_password_field = inputs.some(i => i.type === 'password');
    signals.forms_and_credentials.has_email_field = inputs.some(i => i.type === 'email' || i.name.toLowerCase().includes('email'));
    signals.forms_and_credentials.has_credit_card_field = inputs.some(i =>
        i.name.toLowerCase().includes('card') ||
        i.name.toLowerCase().includes('cc') ||
        i.placeholder.toLowerCase().includes('card')
    );

    signals.forms_and_credentials.form_action_domains = forms.map(f => {
        const action = f.getAttribute('action');
        return action ? getDomain(action) : 'self';
    }).filter(d => d);

    const suspiciousNames = ["passwd", "wallet", "seed", "privatekey", "ssn", "socialsecurity"];
    signals.forms_and_credentials.suspicious_input_names = inputs
        .map(i => i.name)
        .filter(name => findKeywords(name, suspiciousNames).length > 0);

    // Brand Impersonation
    const topBrands = ["paypal", "apple", "microsoft", "google", "facebook", "netflix", "amazon", "bankofamerica", "chase", "wellsfargo"];
    const bodyText = document.body.innerText;
    signals.brand_impersonation.visible_brand_keywords = findKeywords(bodyText, topBrands);

    const images = Array.from(document.images);
    signals.brand_impersonation.logo_image_sources = images
        .map(img => img.src)
        .filter(src => findKeywords(src, topBrands).length > 0)
        .slice(0, 5);

    signals.brand_impersonation.domain_looks_like_brand = topBrands.some(brand =>
        window.location.hostname.includes(brand) && window.location.hostname !== `${brand}.com`
    );

    // Textual Scam Language
    const urgencyKeywords = ["urgent", "immediate", "suspend", "lock", "verify", "24 hours", "limited time"];
    const threatKeywords = ["terminate", "suspend", "legal", "police", "arrest", "warrant"];
    const rewardKeywords = ["winner", "lottery", "prize", "claim", "reward", "million"];

    signals.textual_scam_language.urgency_keywords_found = findKeywords(bodyText, urgencyKeywords);
    signals.textual_scam_language.threat_keywords_found = findKeywords(bodyText, threatKeywords);
    signals.textual_scam_language.reward_keywords_found = findKeywords(bodyText, rewardKeywords);
    signals.textual_scam_language.grammar_anomaly_score = calculateGrammarAnomaly(bodyText.substring(0, 1000));

    // Technical & Structural
    signals.technical_structural.iframe_count = document.querySelectorAll('iframe').length;
    signals.technical_structural.hidden_iframe_count = Array.from(document.querySelectorAll('iframe'))
        .filter(iframe => !isVisible(iframe)).length;

    const scripts = Array.from(document.querySelectorAll('script[src]'));
    signals.technical_structural.external_script_domains = [...new Set(scripts
        .map(s => getDomain(s.src))
        .filter(d => d && d !== window.location.hostname)
    )];

    signals.technical_structural.number_of_external_links = Array.from(document.querySelectorAll('a[href]'))
        .filter(a => getDomain(a.href) && getDomain(a.href) !== window.location.hostname).length;

    const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
    signals.technical_structural.redirect_detected = !!metaRefresh;

    signals.technical_structural.popup_detected = document.querySelectorAll('.modal, .popup, .overlay').length > 0;

    // Obfuscation & Evasion
    signals.obfuscation_evasion.right_click_disabled = !!document.body.getAttribute('oncontextmenu');
    signals.obfuscation_evasion.copy_disabled = !!document.body.getAttribute('oncopy');

    const allElements = document.querySelectorAll('*');
    let inlineHandlerCount = 0;
    allElements.forEach(el => {
        if (el.getAttribute('onclick') || el.getAttribute('onmouseover')) inlineHandlerCount++;
    });
    signals.obfuscation_evasion.excessive_event_listeners = inlineHandlerCount > 50;

    const base64Regex = /[A-Za-z0-9+/]{50,}={0,2}/g;
    signals.obfuscation_evasion.base64_strings_detected = base64Regex.test(document.documentElement.innerHTML);

    // Layout Deception
    const overlays = Array.from(document.querySelectorAll('div, section')).filter(el => {
        const style = window.getComputedStyle(el);
        return (style.position === 'fixed' || style.position === 'absolute') &&
            parseInt(style.width) >= window.innerWidth &&
            parseInt(style.height) >= window.innerHeight &&
            parseInt(style.zIndex) > 100;
    });
    signals.layout_deception.full_screen_overlays = overlays.length > 0;

    const fakeUIKeywords = ["address-bar", "chrome-header", "safari-header", "browser-ui"];
    signals.layout_deception.fake_browser_ui_elements = Array.from(document.querySelectorAll('*'))
        .some(el => {
            const id = el.id.toLowerCase();
            const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
            return fakeUIKeywords.some(kw => id.includes(kw) || className.includes(kw));
        });

    const highZIndexCount = Array.from(allElements).filter(el => {
        const z = parseInt(window.getComputedStyle(el).zIndex);
        return z > 9000;
    }).length;
    signals.layout_deception.z_index_abuse_count = highZIndexCount;

    return signals;
}
