export function extractLayout() {
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
