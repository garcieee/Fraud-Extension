import { getDomain, isVisible } from '../utils.js';

export function extractTech() {
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
