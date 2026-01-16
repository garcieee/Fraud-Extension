document.addEventListener('DOMContentLoaded', function() {
  const scanButton = document.getElementById('scanBtn');
  
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

  scanButton.addEventListener('click', function() {
    if (isScanned) {
      resetUI();
      return;
    }

    scanButton.disabled = true;
    scanButton.textContent = "Analyzing...";
    heroIcon.style.animation = "pulse 1s infinite";
    
    setTimeout(() => {
      heroIcon.style.animation = "none";
      
      const score = 95;
      animateScore(score); 
      
      let scoreClass = 'text-danger';
      if(score > 80) scoreClass = 'text-safe';
      else if(score > 50) scoreClass = 'text-warning';

      revealDetails(scoreClass);
      
      verdict.textContent = "No threats detected on this page.";
      verdict.classList.add('show');
      
      scanButton.disabled = false;
      scanButton.textContent = "RESET";
      scanButton.className = 'btn-reset';
      
      isScanned = true;
    }, 1500);
  });
});