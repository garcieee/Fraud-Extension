// Bundled scraper for injection into pages
(function() {
  // Utils
  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return null;
    }
  }

  function findKeywords(text, keywords) {
    if (!text) return [];
    const lowerText = text.toLowerCase();
    return keywords.filter(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function calculateGrammarAnomaly(text) {
    if (!text || text.length < 10) return 0;
    const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
    const uppercaseRatio = uppercaseCount / text.length;
    const punctuationBursts = (text.match(/[!?.]{3,}/g) || []).length;
    let score = 0;
    if (uppercaseRatio > 0.3) score += 0.5;
    if (punctuationBursts > 0) score += 0.5;
    return Math.min(score, 1.0);
  }

  // Extractors
  function extractIdentity() {
    const metaDesc = document.querySelector('meta[name="description"]');
    return {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      language: document.documentElement.lang || navigator.language,
      meta_description: metaDesc ? metaDesc.content : ""
    };
  }

  function extractForms() {
    const forms = Array.from(document.forms);
    const inputs = Array.from(document.querySelectorAll('input'));
    const suspiciousNames = ["passwd", "wallet", "seed", "privatekey", "ssn", "socialsecurity"];
    return {
      total_forms: forms.length,
      has_password_field: inputs.some(i => i.type === 'password'),
      has_email_field: inputs.some(i => i.type === 'email' || i.name.toLowerCase().includes('email')),
      has_credit_card_field: inputs.some(i =>
        i.name.toLowerCase().includes('card') ||
        i.name.toLowerCase().includes('cc') ||
        i.placeholder.toLowerCase().includes('card')
      ),
      form_action_domains: forms.map(f => {
        const action = f.getAttribute('action');
        return action ? getDomain(action) : 'self';
      }).filter(d => d),
      suspicious_input_names: inputs
        .map(i => i.name)
        .filter(name => findKeywords(name, suspiciousNames).length > 0)
    };
  }

  function extractBrand() {
    const topBrands = ["paypal", "apple", "microsoft", "google", "facebook", "netflix", "amazon", "bankofamerica", "chase", "wellsfargo"];
    const bodyText = document.body.innerText;
    const images = Array.from(document.images);
    return {
      visible_brand_keywords: findKeywords(bodyText, topBrands),
      logo_image_sources: images
        .map(img => img.src)
        .filter(src => findKeywords(src, topBrands).length > 0)
        .slice(0, 5),
      domain_looks_like_brand: topBrands.some(brand =>
        window.location.hostname.includes(brand) && window.location.hostname !== `${brand}.com`
      )
    };
  }

  function extractContent() {
    const urgencyKeywords = ["urgent", "immediate", "suspend", "lock", "verify", "24 hours", "limited time"];
    const threatKeywords = ["terminate", "suspend", "legal", "police", "arrest", "warrant"];
    const rewardKeywords = ["winner", "lottery", "prize", "claim", "reward", "million"];
    const bodyText = document.body.innerText || document.body.textContent || "";
    return {
      urgency_keywords_found: findKeywords(bodyText, urgencyKeywords),
      threat_keywords_found: findKeywords(bodyText, threatKeywords),
      reward_keywords_found: findKeywords(bodyText, rewardKeywords),
      grammar_anomaly_score: calculateGrammarAnomaly(bodyText.substring(0, 1000))
    };
  }

  function extractTech() {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
    return {
      iframe_count: document.querySelectorAll('iframe').length,
      hidden_iframe_count: Array.from(document.querySelectorAll('iframe'))
        .filter(iframe => !isVisible(iframe)).length,
      external_script_domains: [...new Set(scripts
        .map(s => getDomain(s.src))
        .filter(d => d && d !== window.location.hostname)
      )],
      number_of_external_links: Array.from(document.querySelectorAll('a[href]'))
        .filter(a => getDomain(a.href) && getDomain(a.href) !== window.location.hostname).length,
      redirect_detected: !!metaRefresh,
      popup_detected: document.querySelectorAll('.modal, .popup, .overlay').length > 0
    };
  }

  function extractObfuscation() {
    const allElements = document.querySelectorAll('*');
    let inlineHandlerCount = 0;
    allElements.forEach(el => {
      if (el.getAttribute('onclick') || el.getAttribute('onmouseover')) inlineHandlerCount++;
    });
    const base64Regex = /[A-Za-z0-9+/]{50,}={0,2}/g;
    return {
      right_click_disabled: !!document.body.getAttribute('oncontextmenu'),
      copy_disabled: !!document.body.getAttribute('oncopy'),
      excessive_event_listeners: inlineHandlerCount > 50,
      base64_strings_detected: base64Regex.test(document.documentElement.innerHTML)
    };
  }

  function extractLayout() {
    const overlays = Array.from(document.querySelectorAll('div, section')).filter(el => {
      const style = window.getComputedStyle(el);
      return (style.position === 'fixed' || style.position === 'absolute') &&
        parseInt(style.width) >= window.innerWidth &&
        parseInt(style.height) >= window.innerHeight &&
        parseInt(style.zIndex) > 100;
    });
    const fakeUIKeywords = ["address-bar", "chrome-header", "safari-header", "browser-ui"];
    const allElements = document.querySelectorAll('*');
    const highZIndexCount = Array.from(allElements).filter(el => {
      const z = parseInt(window.getComputedStyle(el).zIndex);
      return z > 9000;
    }).length;
    return {
      full_screen_overlays: overlays.length > 0,
      fake_browser_ui_elements: Array.from(allElements)
        .some(el => {
          const id = el.id.toLowerCase();
          const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
          return fakeUIKeywords.some(kw => id.includes(kw) || className.includes(kw));
        }),
      z_index_abuse_count: highZIndexCount
    };
  }

  // Main scraper function
  function extractPageSignals() {
    return {
      page_identity: extractIdentity(),
      forms_and_credentials: extractForms(),
      brand_impersonation: extractBrand(),
      textual_scam_language: extractContent(),
      technical_structural: extractTech(),
      obfuscation_evasion: extractObfuscation(),
      layout_deception: extractLayout()
    };
  }

  // Calculate trust score from signals
  function calculateTrustScore(signals) {
    let score = 100;
    
    // Forms & credentials (high risk)
    if (signals.forms_and_credentials.has_password_field && 
        signals.forms_and_credentials.has_credit_card_field) score -= 30;
    else if (signals.forms_and_credentials.has_password_field) score -= 15;
    if (signals.forms_and_credentials.suspicious_input_names.length > 0) score -= 10;
    
    // Brand impersonation
    if (signals.brand_impersonation.domain_looks_like_brand) score -= 25;
    if (signals.brand_impersonation.visible_brand_keywords.length > 3) score -= 15;
    
    // Scam language
    if (signals.textual_scam_language.urgency_keywords_found.length > 0) score -= 10;
    if (signals.textual_scam_language.threat_keywords_found.length > 0) score -= 15;
    if (signals.textual_scam_language.reward_keywords_found.length > 0) score -= 10;
    if (signals.textual_scam_language.grammar_anomaly_score > 0.5) score -= 5;
    
    // Technical issues
    if (signals.technical_structural.hidden_iframe_count > 0) score -= 10;
    if (signals.technical_structural.redirect_detected) score -= 15;
    
    // Obfuscation
    if (signals.obfuscation_evasion.right_click_disabled) score -= 5;
    if (signals.obfuscation_evasion.base64_strings_detected) score -= 10;
    
    // Layout deception
    if (signals.layout_deception.full_screen_overlays) score -= 15;
    if (signals.layout_deception.fake_browser_ui_elements) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }

  // Expose functions for injection
  window.__fraudScraper = { extractPageSignals, calculateTrustScore };
  
  // Auto-run if injected via executeScript
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      const signals = extractPageSignals();
      const trustScore = calculateTrustScore(signals);
      window.__fraudScraperResult = { success: true, signals, trustScore };
    } catch (error) {
      window.__fraudScraperResult = { success: false, error: error.message };
    }
  }
})();
