import { findKeywords } from '../utils.js';

export function extractBrand() {
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
