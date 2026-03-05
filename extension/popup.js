document.addEventListener('DOMContentLoaded', function() {
  const scanButton = document.getElementById('scanBtn');
  
  if (!scanButton) {
    console.error('[Popup] ERROR: scanBtn button not found!');
    return;
  }
  
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
    domainVal.className = `detail-value ${scoreClass}`;
    sslVal.className = `detail-value ${scoreClass}`;
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
    if (isScanned) {
      resetUI();
      return;
    }

    scanButton.disabled = true;
    scanButton.textContent = "Analyzing...";
    heroIcon.style.animation = "pulse 1s infinite";
    
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we can inject (some pages like chrome:// can't be injected)
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot analyze browser system pages');
      }
      
      // Inject scraper script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scraper-bundle.js']
      });
      
      // Small delay to ensure script executes
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get results from injected script
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (!window.__fraudScraperResult) {
            return { success: false, error: 'Scraper did not run' };
          }
          return window.__fraudScraperResult;
        }
      });
      
      const response = result.result;
      
      if (!response) {
        throw new Error('No response from scraper');
      }
      
      if (response.success) {
        const { trustScore, signals } = response;
        const API_BASE = "https://fraud-api-993p.onrender.com";
        
        fetch(API_BASE + "/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: tab.url,
            trust_score: trustScore,
            signals: signals
          })
        })
        .then(res => res.json())
        .then(serverData => {
          const jobId = serverData.job_id;
          if (jobId) {
            pollStatus(API_BASE, jobId, trustScore, signals, tab);
            return;
          }
          showResult(trustScore, signals, tab, true);
        })
        .catch(() => {
          showResult(trustScore, signals, tab, true);
        });
        
        function pollStatus(base, jobId, fallbackScore, fallbackSignals, tab) {
          const interval = setInterval(async () => {
            try {
              const r = await fetch(base + "/status/" + jobId);
              if (!r.ok) return;
              const data = await r.json();
              if (data.status === "completed" && data.result) {
                clearInterval(interval);
                heroIcon.style.animation = "none";
                showResultFromServer(data.result, fallbackSignals, tab);
              }
            } catch (e) {}
          }, 2000);
          setTimeout(() => clearInterval(interval), 60000);
        }
        
        function showResultFromServer(result, signals, tab) {
          const riskScore = Number(result.final_score);
          const trustDisplay = Math.round(100 - riskScore);
          animateScore(trustDisplay);
          if (riskScore >= 75) scoreCircle.style.stroke = "#ef4444";
          else if (riskScore >= 40) scoreCircle.style.stroke = "#f59e0b";
          else scoreCircle.style.stroke = "#10b981";
          let scoreClass = "text-safe";
          let verdictText = "Safe.";
          if (riskScore >= 75) {
            scoreClass = "text-danger";
            verdictText = "High Risk: Phishing Detected.";
          } else if (riskScore >= 40) {
            scoreClass = "text-warning";
            verdictText = "Warning: Suspicious content.";
          } else {
            verdictText = "Safe.";
          }
          revealDetails(scoreClass);
          verdict.textContent = verdictText;
          verdict.classList.add("show");
          domainVal.textContent = (signals && signals.page_identity && signals.page_identity.domain) ? signals.page_identity.domain : "Unknown";
          sslVal.textContent = tab.url.startsWith("https://") ? "Encrypted (Secure)" : "Not Encrypted";
          scanButton.disabled = false;
          scanButton.textContent = "RESET";
          scanButton.className = "btn-reset";
          isScanned = true;
        }
        
        function showResult(trustScore, signals, tab, done) {
          if (!done) return;
          heroIcon.style.animation = "none";
          animateScore(trustScore);
          let scoreClass = "text-danger";
          if (trustScore > 80) scoreClass = "text-safe";
          else if (trustScore > 50) scoreClass = "text-warning";
          revealDetails(scoreClass);
          let verdictText = "High risk of fraudulent content.";
          if (trustScore > 80) verdictText = "No threats detected on this page.";
          else if (trustScore > 50) verdictText = "Some suspicious elements detected.";
          verdict.textContent = verdictText + " (Saved to Cloud)";
          verdict.classList.add("show");
          domainVal.textContent = signals.page_identity && signals.page_identity.domain ? signals.page_identity.domain : "Unknown";
          sslVal.textContent = tab.url.startsWith("https://") ? "Encrypted (Secure)" : "Not Encrypted";
          scanButton.disabled = false;
          scanButton.textContent = "RESET";
          scanButton.className = "btn-reset";
          isScanned = true;
        }
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