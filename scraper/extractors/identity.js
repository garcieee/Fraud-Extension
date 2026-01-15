export function extractIdentity() {
    const metaDesc = document.querySelector('meta[name="description"]');
    return {
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
        language: document.documentElement.lang || navigator.language,
        meta_description: metaDesc ? metaDesc.content : ""
    };
}
