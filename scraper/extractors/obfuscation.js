export function extractObfuscation() {
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
