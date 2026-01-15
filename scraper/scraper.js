import { extractIdentity } from './extractors/identity.js';
import { extractForms } from './extractors/forms.js';
import { extractBrand } from './extractors/brand.js';
import { extractContent } from './extractors/content.js';
import { extractTech } from './extractors/tech.js';
import { extractObfuscation } from './extractors/obfuscation.js';
import { extractLayout } from './extractors/layout.js';

export function extractPageSignals() {
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

export function saveScrapeResults(signals) {
    const domain = signals.page_identity.domain || 'unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${domain}_${timestamp}.json`;

    const jsonData = JSON.stringify(signals, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return filename;
}
