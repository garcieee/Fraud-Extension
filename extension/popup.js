document.addEventListener('DOMContentLoaded', function() {
  console.log('[Popup] DOM loaded, initializing...');
  const scanButton = document.getElementById('scanBtn');
  
  if (!scanButton) {
    console.error('[Popup] ERROR: scanBtn button not found!');
    return;
  }
  
  console.log('[Popup] Button found, setting up listener...');
  
  const heroIcon = document.getElementById('hero-icon');
  const scoreWrap = document.getElementById('score-wrap');
  const scoreDisplay = document.getElementById('score-display');
  const scoreCircle = document.getElementById('score-circle');
  const verdict = document.getElementById('verdict'); 
  
  const domainVal = document.getElementById('domain-val');
  const sslVal = document.getElementById('ssl-val');

  const circumference = 364;
  scoreCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  scoreCircle.style.strokeDashoffset = circumference; 

  let isScanned = false; // Track state

  function animateScore(targetScore) {
    heroIcon.style.display = 'none';
    scoreWrap.style.display = 'block';

    const offset = circumference - (targetScore / 100) * circumference;
    scoreCircle.style.strokeDashoffset = offset;
    
    // Color Logic
    let color = "#ef4444"; // Default Red
    if(targetScore > 80) color = "#10b981"; // Green
    else if(targetScore > 50) color = "#f59e0b"; // Orange

    scoreCircle.style.stroke = color;

    let currentScore = 0;
    const timer = setInterval(() => {
      if (currentScore >= targetScore) clearInterval(timer);
      else {
        currentScore++;
        scoreDisplay.textContent = currentScore;
      }
    }, 10);
  }

  function revealDetails(scoreClass) {
    domainVal.className = 'detail-value';
    sslVal.className = 'detail-value';

    domainVal.classList.add(scoreClass);
    sslVal.classList.add(scoreClass);

    domainVal.textContent = "Long-term (Safe)";
    sslVal.textContent = "Encrypted (Secure)";
  }

  function resetUI() {
    isScanned = false;
    
    scoreCircle.style.strokeDashoffset = circumference;
    
    scoreWrap.style.display = 'none';
    heroIcon.style.display = 'block';
    heroIcon.style.animation = 'none';
    
    verdict.classList.remove('show');
    verdict.textContent = '';
    
    domainVal.className = 'detail-value blur-text';
    domainVal.textContent = 'Unknown';
    sslVal.className = 'detail-value blur-text';
    sslVal.textContent = 'Unknown';
    
    scanButton.textContent = 'Analyze Page';
    scanButton.className = 'btn-primary';
    scanButton.disabled = false;
  }

  scanButton.addEventListener('click', async function() {
    console.log('[Popup] Button clicked');
    
    if (isScanned) {
      resetUI();
      return;
    }

    scanButton.disabled = true;
    scanButton.textContent = "Analyzing...";
    heroIcon.style.animation = "pulse 1s infinite";
    
    try {
      console.log('[Popup] Getting active tab...');
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[Popup] Active tab:', tab.url);
      
      // Check if we can inject (some pages like chrome:// can't be injected)
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot analyze browser system pages');
      }
      
      console.log('[Popup] Injecting scraper...');
      // Inject scraper script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scraper-bundle.js']
      });
      console.log('[Popup] Scraper injected');
      
      // Small delay to ensure script executes
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('[Popup] Getting results...');
      // Get results from injected script
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          console.log('[Popup] Checking for results, window.__fraudScraperResult:', window.__fraudScraperResult);
          if (!window.__fraudScraperResult) {
            return { success: false, error: 'Scraper did not run' };
          }
          return window.__fraudScraperResult;
        }
      });
      
      console.log('[Popup] Result received:', result);
      const response = result.result;
      
      if (!response) {
        throw new Error('No response from scraper');
      }
      
      console.log('[Popup] Response:', response);
      
      if (response.success) {
        const { trustScore, signals } = response;
        
        // Save JSON file
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
        console.log('[Popup] Saved JSON file:', filename);
        
        heroIcon.style.animation = "none";
        animateScore(trustScore);
        
        let scoreClass = 'text-danger';
        if(trustScore > 80) scoreClass = 'text-safe';
        else if(trustScore > 50) scoreClass = 'text-warning';

        revealDetails(scoreClass);
        
        // Set verdict based on score
        if(trustScore > 80) {
          verdict.textContent = "No threats detected on this page.";
        } else if(trustScore > 50) {
          verdict.textContent = "Some suspicious elements detected.";
        } else {
          verdict.textContent = "High risk of fraudulent content.";
        }
        verdict.classList.add('show');
        
        // Update domain display
        domainVal.textContent = signals.page_identity.domain || "Unknown";
        
        // Check SSL
        const isSecure = tab.url.startsWith('https://');
        sslVal.textContent = isSecure ? "Encrypted (Secure)" : "Not Encrypted";
        
        scanButton.disabled = false;
        scanButton.textContent = "RESET";
        scanButton.className = 'btn-reset';
        
        isScanned = true;
      } else {
        throw new Error(response.error || 'Scan failed');
      }
    } catch (error) {
      console.error('Scan error:', error);
      heroIcon.style.animation = "none";
      verdict.textContent = "Error: " + error.message;
      verdict.classList.add('show');
      scanButton.disabled = false;
      scanButton.textContent = "Try Again";
    }
  });
});