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

  let isScanned = false;
  let scannedTabId = null;

  function animateScore(targetScore) {
    heroIcon.style.display = 'none';
    scoreWrap.style.display = 'block';

    const offset = circumference - (targetScore / 100) * circumference;
    scoreCircle.style.strokeDashoffset = offset;

    let color = "#ef4444";
    if (targetScore > 80) color = "#10b981";
    else if (targetScore > 50) color = "#f59e0b";
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

  // SSL color is always based on HTTPS — never tied to risk score
  function revealDetails(scoreClass, isHttps) {
    domainVal.className = `detail-value ${scoreClass}`;
    sslVal.className = `detail-value ${isHttps ? 'text-safe' : 'text-danger'}`;
  }

  // Build a list of flag items from signals + server URL flags
  // Thresholds are intentionally strict to avoid false positives
  function buildFlagItems(signals, urlFlags, tabUrl, serverResult) {
    const items = [];
    const isHttps = tabUrl.startsWith('https://');

    // --- URL-level checks ---
    items.push({
      label: 'HTTPS Protocol',
      cls: isHttps ? 'clear' : 'flagged',
      text: isHttps ? '✓ Encrypted' : '✗ Not Encrypted'
    });

    if (urlFlags) {
      if (urlFlags.ip_address)
        items.push({ label: 'Raw IP in URL', cls: 'flagged', text: '✗ IP Address Used' });
      if (urlFlags.long_url)
        items.push({ label: 'URL Length', cls: 'flagged', text: '✗ Unusually Long' });
      if (urlFlags.suspicious_chars)
        items.push({ label: 'Suspicious Characters', cls: 'flagged', text: '✗ @ or Excess Hyphens' });
    } else {
      // Compute locally when server flags aren't available
      try {
        const h = new URL(tabUrl).hostname;
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h))
          items.push({ label: 'Raw IP in URL', cls: 'flagged', text: '✗ IP Address Used' });
        if (tabUrl.length > 75)
          items.push({ label: 'URL Length', cls: 'flagged', text: '✗ Unusually Long' });
        if (tabUrl.includes('@') || (h.match(/-/g) || []).length >= 3)
          items.push({ label: 'Suspicious Characters', cls: 'flagged', text: '✗ @ or Excess Hyphens' });
      } catch (_) {}
    }

    // --- Page content signals ---
    if (!signals) return items;

    const forms = signals.forms_and_credentials;
    if (forms) {
      if (forms.has_password_field && forms.has_credit_card_field)
        items.push({ label: 'Payment + Password Form', cls: 'flagged', text: '✗ Both Present' });
      else if (forms.has_password_field)
        items.push({ label: 'Password Field', cls: 'warn', text: '⚠ Present' });
      if (forms.suspicious_input_names && forms.suspicious_input_names.length > 0)
        items.push({ label: 'Suspicious Inputs', cls: 'flagged', text: `✗ ${forms.suspicious_input_names.length} Found`, detail: forms.suspicious_input_names.join(', ') });
    }

    const brand = signals.brand_impersonation;
    if (brand && brand.domain_looks_like_brand)
      items.push({ label: 'Brand Impersonation', cls: 'flagged', text: '✗ Domain Mimics a Brand' });

    const scam = signals.textual_scam_language;
    if (scam) {
      // Require 3+ urgency keywords to reduce noise ("immediate", "now" appear on normal pages)
      const urgency = scam.urgency_keywords_found ? scam.urgency_keywords_found.length : 0;
      if (urgency >= 3)
        items.push({ label: 'Urgency Language', cls: 'flagged', text: `✗ ${urgency} Keywords`, detail: scam.urgency_keywords_found.join(', ') });

      // Require 2+ threat keywords — "legal" alone is too common
      const threat = scam.threat_keywords_found ? scam.threat_keywords_found.length : 0;
      if (threat >= 2)
        items.push({ label: 'Threat Language', cls: 'flagged', text: `✗ ${threat} Keywords`, detail: scam.threat_keywords_found.join(', ') });

      // Reward language is low-signal; only flag at 3+
      const reward = scam.reward_keywords_found ? scam.reward_keywords_found.length : 0;
      if (reward >= 3)
        items.push({ label: 'Reward / Prize Language', cls: 'warn', text: `⚠ ${reward} Keywords`, detail: scam.reward_keywords_found.join(', ') });
    }

    const tech = signals.technical_structural;
    if (tech) {
      if (tech.hidden_iframe_count > 0)
        items.push({ label: 'Hidden Iframes', cls: 'flagged', text: `✗ ${tech.hidden_iframe_count} Found` });
      if (tech.redirect_detected)
        items.push({ label: 'Page Redirect', cls: 'flagged', text: '✗ Detected' });
    }

    const obf = signals.obfuscation_evasion;
    if (obf) {
      // Right-click disabled is a genuine signal; skip base64 (matches Google Analytics etc.)
      if (obf.right_click_disabled)
        items.push({ label: 'Right-Click Disabled', cls: 'flagged', text: '✗ Blocked' });
    }

    const layout = signals.layout_deception;
    if (layout) {
      if (layout.full_screen_overlays)
        items.push({ label: 'Fullscreen Overlay', cls: 'flagged', text: '✗ Detected' });
      if (layout.fake_browser_ui_elements)
        items.push({ label: 'Fake Browser UI', cls: 'flagged', text: '✗ Detected' });
    }

    // AI model score — show when it's the primary reason for a warning/danger
    if (serverResult && serverResult.ai_available) {
      const aiScore = Number(serverResult.ai_score || 0);
      if (aiScore >= 60)
        items.push({ label: 'AI Content Analysis', cls: 'flagged', text: `✗ ${Math.round(aiScore)}% Risk`, detail: 'Page text matches patterns seen in scam or phishing content' });
      else if (aiScore >= 30)
        items.push({ label: 'AI Content Analysis', cls: 'warn', text: `⚠ ${Math.round(aiScore)}% Risk`, detail: 'Some content patterns flagged as potentially deceptive' });
    }

    return items;
  }

  // Render flag items into the popup's flags section
  function renderFlagItems(items) {
    const flagsList = document.getElementById('flags-list');
    const flagsSection = document.getElementById('flags-section');
    if (!flagsList || !flagsSection) return;

    flagsList.innerHTML = '';

    const issues  = items.filter(i => i.cls !== 'clear');
    const passed  = items.filter(i => i.cls === 'clear');

    if (issues.length === 0) {
      // Nothing wrong — show a clean state
      const row = document.createElement('div');
      row.className = 'flag-row';
      row.innerHTML = `<span class="flag-label">All checks passed</span><span class="flag-badge clear">✓ Clean</span>`;
      flagsList.appendChild(row);
    } else {
      // ── Issue count header ──────────────────────────────────
      const countEl = document.createElement('div');
      countEl.className = 'issues-header';
      const danger  = issues.filter(i => i.cls === 'flagged').length;
      const warn    = issues.filter(i => i.cls === 'warn').length;
      const countClass = danger > 0 ? 'danger' : 'warn';
      countEl.innerHTML = `
        <span class="issues-count ${countClass}">
          ${danger > 0 ? `✗ ${danger} problem${danger > 1 ? 's' : ''}` : ''}
          ${warn   > 0 ? `  ⚠ ${warn} warning${warn   > 1 ? 's' : ''}` : ''}
        </span>`;
      flagsList.appendChild(countEl);

      // ── Issues — prominent rows ─────────────────────────────
      issues.forEach(item => {
        const row = document.createElement('div');
        row.className = `issue-row issue-row--${item.cls}`;
        row.innerHTML = `
          <div class="issue-icon">${item.cls === 'flagged' ? '✗' : '⚠'}</div>
          <div class="issue-body">
            <span class="issue-label">${item.label}</span>
            ${item.detail ? `<span class="issue-detail">${item.detail}</span>` : ''}
          </div>
          <span class="flag-badge ${item.cls}">${item.text}</span>`;
        flagsList.appendChild(row);
      });

      // ── Passed checks — collapsible ─────────────────────────
      if (passed.length > 0) {
        const toggle = document.createElement('button');
        toggle.className = 'passed-toggle';
        toggle.textContent = `▸ ${passed.length} check${passed.length > 1 ? 's' : ''} passed`;
        flagsList.appendChild(toggle);

        const passedList = document.createElement('div');
        passedList.className = 'passed-list hidden';
        passed.forEach(item => {
          const row = document.createElement('div');
          row.className = 'flag-row';
          row.innerHTML = `<span class="flag-label">${item.label}</span><span class="flag-badge clear">${item.text}</span>`;
          passedList.appendChild(row);
        });
        flagsList.appendChild(passedList);

        toggle.addEventListener('click', () => {
          const isHidden = passedList.classList.toggle('hidden');
          toggle.textContent = isHidden
            ? `▸ ${passed.length} check${passed.length > 1 ? 's' : ''} passed`
            : `▾ ${passed.length} check${passed.length > 1 ? 's' : ''} passed`;
        });
      }
    }

    flagsSection.style.display = 'block';
  }

  // Inject a floating banner directly on the page using Shadow DOM
  function injectPageBanner(tab, trustScore, verdictText, verdictClass, items) {
    // Banner only shows issues — passing checks add noise
    const bannerItems = items.filter(i => i.cls !== 'clear');

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (data) => {
        const BANNER_ID = '__fraud-ext-banner__';
        const existing = document.getElementById(BANNER_ID);
        if (existing) existing.remove();

        const host = document.createElement('div');
        host.id = BANNER_ID;
        host.style.cssText = [
          'position:fixed',
          'bottom:20px',
          'right:20px',
          'z-index:2147483647',
          'font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif',
          'max-width:280px',
          'width:280px'
        ].join(';');

        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
          .panel {
            background: #0d1117;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 14px;
            padding: 14px 16px 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.7);
            animation: slideUp 0.3s cubic-bezier(0.4,0,0.2,1);
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            font-weight: 700;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .shield { font-size: 14px; }
          .close {
            background: none;
            border: none;
            color: #6b7280;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            padding: 0;
            transition: color 0.15s;
          }
          .close:hover { color: #f3f4f6; }
          .score-row {
            display: flex;
            align-items: baseline;
            gap: 10px;
            margin-bottom: 10px;
          }
          .score-num {
            font-size: 32px;
            font-weight: 800;
            color: #fff;
            line-height: 1;
          }
          .verdict {
            font-size: 13px;
            font-weight: 600;
            line-height: 1.3;
          }
          .verdict.safe    { color: #10b981; }
          .verdict.warning { color: #f59e0b; }
          .verdict.danger  { color: #ef4444; }
          .divider {
            border: none;
            border-top: 1px solid rgba(255,255,255,0.08);
            margin: 8px 0;
          }
          .flag-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 0;
            gap: 8px;
          }
          .flag-label {
            font-size: 11px;
            color: #9ca3af;
            flex: 1;
          }
          .issue-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 6px 8px;
            border-radius: 6px;
            margin: 3px 0;
          }
          .issue-row--flagged {
            background: rgba(239,68,68,0.10);
            border: 1px solid rgba(239,68,68,0.20);
          }
          .issue-row--warn {
            background: rgba(245,158,11,0.10);
            border: 1px solid rgba(245,158,11,0.20);
          }
          .issue-icon {
            font-size: 11px;
            font-weight: 700;
            margin-top: 1px;
            flex-shrink: 0;
          }
          .issue-row--flagged .issue-icon { color: #ef4444; }
          .issue-row--warn    .issue-icon { color: #f59e0b; }
          .issue-body {
            flex: 1;
            min-width: 0;
          }
          .issue-label {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: #e5e7eb;
          }
          .issue-detail {
            display: block;
            font-size: 10px;
            color: #9ca3af;
            font-style: italic;
            margin-top: 2px;
            word-break: break-word;
          }
          .badge {
            font-size: 10px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            white-space: nowrap;
          }
          .badge.flagged {
            background: rgba(239,68,68,0.12);
            color: #ef4444;
            border: 1px solid rgba(239,68,68,0.25);
          }
          .badge.clear {
            background: rgba(16,185,129,0.12);
            color: #10b981;
            border: 1px solid rgba(16,185,129,0.25);
          }
          .badge.warn {
            background: rgba(245,158,11,0.12);
            color: #f59e0b;
            border: 1px solid rgba(245,158,11,0.25);
          }
        `;

        const panel = document.createElement('div');
        panel.className = 'panel';

        // Header
        const header = document.createElement('div');
        header.className = 'header';
        const brand = document.createElement('div');
        brand.className = 'brand';
        brand.innerHTML = `<span class="shield">🛡️</span> Fraud Detector`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => host.remove());
        header.appendChild(brand);
        header.appendChild(closeBtn);

        // Score + verdict
        const scoreRow = document.createElement('div');
        scoreRow.className = 'score-row';
        scoreRow.innerHTML = `
          <span class="score-num">${data.trustScore}</span>
          <span class="verdict ${data.verdictClass}">${data.verdictText}</span>
        `;

        panel.appendChild(header);
        panel.appendChild(scoreRow);

        if (data.flags && data.flags.length > 0) {
          const divider = document.createElement('hr');
          divider.className = 'divider';
          panel.appendChild(divider);

          data.flags.forEach(flag => {
            const row = document.createElement('div');
            row.className = `issue-row issue-row--${flag.cls}`;
            row.innerHTML = `
              <div class="issue-icon">${flag.cls === 'flagged' ? '✗' : '⚠'}</div>
              <div class="issue-body">
                <span class="issue-label">${flag.label}</span>
                ${flag.detail ? `<span class="issue-detail">${flag.detail}</span>` : ''}
              </div>
              <span class="badge ${flag.cls}">${flag.text}</span>
            `;
            panel.appendChild(row);
          });

          if (data.flags.length === 0) {
            const row = document.createElement('div');
            row.className = 'flag-row';
            row.innerHTML = `<span class="flag-label" style="color:#6b7280">All checks passed</span><span class="badge clear">✓ Clean</span>`;
            panel.appendChild(row);
          }
        }

        shadow.appendChild(style);
        shadow.appendChild(panel);
        document.body.appendChild(host);
      },
      args: [{ trustScore, verdictText, verdictClass, flags: bannerItems }]
    }).catch(() => {}); // ignore if page blocks injection
  }

  // Remove the page banner (called on reset)
  function removePageBanner(tabId) {
    if (!tabId) return;
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const el = document.getElementById('__fraud-ext-banner__');
        if (el) el.remove();
      }
    }).catch(() => {});
  }

  function resetUI() {
    isScanned = false;
    removePageBanner(scannedTabId);
    scannedTabId = null;

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

    const flagsSection = document.getElementById('flags-section');
    const flagsList = document.getElementById('flags-list');
    if (flagsSection) flagsSection.style.display = 'none';
    if (flagsList) flagsList.innerHTML = '';

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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot analyze browser system pages');
      }

      scannedTabId = tab.id;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scraper-bundle.js']
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (!window.__fraudScraperResult) return { success: false, error: 'Scraper did not run' };
          return window.__fraudScraperResult;
        }
      });

      const response = result.result;
      if (!response) throw new Error('No response from scraper');

      if (response.success) {
        const { trustScore, signals, pageText } = response;
        const API_BASE = "https://fraud-api-993p.onrender.com";

        fetch(API_BASE + "/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: tab.url, trust_score: trustScore, signals, text: pageText || "" })
        })
        .then(res => res.json())
        .then(serverData => {
          const jobId = serverData.job_id;
          if (jobId) { pollStatus(API_BASE, jobId, trustScore, signals, tab); return; }
          showResult(trustScore, signals, tab, true);
        })
        .catch(() => showResult(trustScore, signals, tab, true));

        function pollStatus(base, jobId, fallbackScore, fallbackSignals, tab) {
          let elapsed = 0;
          const interval = setInterval(async () => {
            elapsed += 2;
            scanButton.textContent = `Analyzing... (${elapsed}s)`;
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
          setTimeout(() => {
            clearInterval(interval);
            if (!isScanned) {
              heroIcon.style.animation = "none";
              showResult(fallbackScore, fallbackSignals, tab, true);
            }
          }, 45000);
        }

        function showResultFromServer(result, signals, tab) {
          const riskScore = Number(result.final_score);
          const trustDisplay = Math.round(100 - riskScore);
          const isHttps = tab.url.startsWith("https://");

          animateScore(trustDisplay);

          let scoreClass = "text-safe";
          let verdictText = "No threats detected.";
          let verdictClass = "safe";
          if (riskScore >= 75) {
            scoreClass = "text-danger"; verdictText = "High Risk — Phishing Detected."; verdictClass = "danger";
          } else if (riskScore >= 40) {
            scoreClass = "text-warning"; verdictText = "Warning — Suspicious Content."; verdictClass = "warning";
          }

          revealDetails(scoreClass, isHttps);
          verdict.textContent = verdictText;
          verdict.classList.add("show");
          domainVal.textContent = (signals && signals.page_identity && signals.page_identity.domain) || "Unknown";
          sslVal.textContent = isHttps ? "Encrypted (Secure)" : "Not Encrypted";

          const items = buildFlagItems(signals, result.flags || null, tab.url, result);
          renderFlagItems(items);
          injectPageBanner(tab, trustDisplay, verdictText, verdictClass, items);

          scanButton.disabled = false;
          scanButton.textContent = "RESET";
          scanButton.className = "btn-reset";
          isScanned = true;
        }

        function showResult(trustScore, signals, tab, done) {
          if (!done) return;
          heroIcon.style.animation = "none";
          const isHttps = tab.url.startsWith("https://");

          animateScore(trustScore);

          let scoreClass = "text-danger";
          let verdictText = "High risk of fraudulent content.";
          let verdictClass = "danger";
          if (trustScore > 80) { scoreClass = "text-safe"; verdictText = "No threats detected."; verdictClass = "safe"; }
          else if (trustScore > 50) { scoreClass = "text-warning"; verdictText = "Some suspicious elements detected."; verdictClass = "warning"; }

          revealDetails(scoreClass, isHttps);
          verdict.textContent = verdictText;
          verdict.classList.add("show");
          domainVal.textContent = (signals.page_identity && signals.page_identity.domain) || "Unknown";
          sslVal.textContent = isHttps ? "Encrypted (Secure)" : "Not Encrypted";

          const items = buildFlagItems(signals, null, tab.url);
          renderFlagItems(items);
          injectPageBanner(tab, trustScore, verdictText, verdictClass, items);

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
