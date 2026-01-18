(function() {
    // Load the scraper code dynamically
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
        import('${window.location.origin}/scraper/scraper.js').then(module => {
            const signals = module.extractPageSignals();
            const filename = module.saveScrapeResults(signals);
            alert('Website scraped!\\nSaved to: ' + filename);
        }).catch(err => {
            alert('Error: Make sure you are running from a local server.\\n' + err.message);
        });
    `;
    document.head.appendChild(script);
})();
