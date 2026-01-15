import { getDomain, findKeywords } from '../utils.js';

export function extractForms() {
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
