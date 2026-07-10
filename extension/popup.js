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

  // ── Scrape / export ─────────────────────────────────────────
  const scrapeBtn = document.getElementById('scrapeBtn');
  let lastScanData = null;

  function showScrapeButton() {
    if (scrapeBtn && lastScanData) scrapeBtn.style.display = 'block';
  }

  if (scrapeBtn) {
    scrapeBtn.addEventListener('click', () => {
      if (!lastScanData) return;
      const blob = new Blob([JSON.stringify(lastScanData, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      let domain = 'page';
      try { domain = new URL(lastScanData.url).hostname; } catch (_) {}
      a.download = `scrape-${domain}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

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
        items.push({ label: 'Payment + Password Form', cls: 'flagged', text: '✗ Both Present',
          loc: { type: 'selector', values: [...(forms.password_field_selectors || []), ...(forms.credit_card_field_selectors || [])] } });
      else if (forms.has_password_field)
        items.push({ label: 'Password Field', cls: 'warn', text: '⚠ Present',
          loc: { type: 'selector', values: forms.password_field_selectors || [] } });
      if (forms.suspicious_input_names && forms.suspicious_input_names.length > 0)
        items.push({ label: 'Suspicious Inputs', cls: 'flagged', text: `✗ ${forms.suspicious_input_names.length} Found`, detail: forms.suspicious_input_names.join(', '),
          loc: { type: 'selector', values: forms.suspicious_input_selectors || [] } });
    }

    const brand = signals.brand_impersonation;
    if (brand && brand.domain_looks_like_brand)
      items.push({ label: 'Brand Impersonation', cls: 'flagged', text: '✗ Domain Mimics a Brand',
        loc: { type: 'selector', values: brand.brand_logo_selectors || [] } });

    const scam = signals.textual_scam_language;
    if (scam) {
      // Require 3+ urgency keywords to reduce noise ("immediate", "now" appear on normal pages)
      const urgency = scam.urgency_keywords_found ? scam.urgency_keywords_found.length : 0;
      if (urgency >= 3)
        items.push({ label: 'Urgency Language', cls: 'flagged', text: `✗ ${urgency} Keywords`, detail: scam.urgency_keywords_found.join(', '),
          loc: { type: 'text', values: scam.urgency_keywords_found } });

      // Require 2+ threat keywords — "legal" alone is too common
      const threat = scam.threat_keywords_found ? scam.threat_keywords_found.length : 0;
      if (threat >= 2)
        items.push({ label: 'Threat Language', cls: 'flagged', text: `✗ ${threat} Keywords`, detail: scam.threat_keywords_found.join(', '),
          loc: { type: 'text', values: scam.threat_keywords_found } });

      // Reward language is low-signal; only flag at 3+
      const reward = scam.reward_keywords_found ? scam.reward_keywords_found.length : 0;
      if (reward >= 3)
        items.push({ label: 'Reward / Prize Language', cls: 'warn', text: `⚠ ${reward} Keywords`, detail: scam.reward_keywords_found.join(', '),
          loc: { type: 'text', values: scam.reward_keywords_found } });
    }

    const tech = signals.technical_structural;
    if (tech) {
      if (tech.hidden_iframe_count > 0)
        items.push({ label: 'Hidden Iframes', cls: 'flagged', text: `✗ ${tech.hidden_iframe_count} Found`,
          loc: { type: 'selector', values: tech.hidden_iframe_selectors || [] } });
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
        items.push({ label: 'Fullscreen Overlay', cls: 'flagged', text: '✗ Detected',
          loc: { type: 'selector', values: layout.overlay_selectors || [] } });
      if (layout.fake_browser_ui_elements)
        items.push({ label: 'Fake Browser UI', cls: 'flagged', text: '✗ Detected',
          loc: { type: 'selector', values: layout.fake_ui_selectors || [] } });
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
      const parts = [];
      if (danger > 0) parts.push(`${danger} problem${danger > 1 ? 's' : ''}`);
      if (warn > 0) parts.push(`${warn} warning${warn > 1 ? 's' : ''}`);
      countEl.innerHTML = `<span class="issues-count ${countClass}">${parts.join(' · ')}</span>`;
      flagsList.appendChild(countEl);

      // ── Issues — clean single rows (no redundant badges) ────
      issues.forEach(item => {
        const row = document.createElement('div');
        row.className = `issue-row issue-row--${item.cls}`;
        const sub = item.detail || (item.text || '').replace(/^[✗⚠]\s*/, '');
        row.innerHTML = `
          <div class="issue-icon">${item.cls === 'flagged' ? '✗' : '⚠'}</div>
          <div class="issue-body">
            <span class="issue-label">${item.label}</span>
            ${sub && sub !== item.label ? `<span class="issue-detail">${sub}</span>` : ''}
          </div>`;
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
        const HL_ID = '__fraud-ext-hl__';
        const existing = document.getElementById(BANNER_ID);
        if (existing) existing.remove();
        const oldHl = document.getElementById(HL_ID);
        if (oldHl) oldHl.remove();

        // ── On-page highlighter ─────────────────────────────────
        function clearHighlights() {
          const c = document.getElementById(HL_ID);
          if (c) c.remove();
        }

        function hlContainer() {
          clearHighlights();
          const c = document.createElement('div');
          c.id = HL_ID;
          c.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483646;pointer-events:none;';
          document.documentElement.appendChild(c);
          if (!document.getElementById(HL_ID + '-style')) {
            const s = document.createElement('style');
            s.id = HL_ID + '-style';
            s.textContent = '@keyframes __fraudPulse{0%,100%{box-shadow:0 0 0 3px rgba(239,68,68,0.9),0 0 18px rgba(239,68,68,0.6)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0.5),0 0 28px rgba(239,68,68,0.4)}}';
            document.documentElement.appendChild(s);
          }
          return c;
        }

        function drawBox(container, rect, num, note) {
          const pad = 4;
          const w = Math.max(rect.width, 28), h = Math.max(rect.height, 24);
          const box = document.createElement('div');
          box.style.cssText = [
            'position:absolute',
            'left:' + (rect.left + window.scrollX - pad) + 'px',
            'top:' + (rect.top + window.scrollY - pad) + 'px',
            'width:' + (w + pad * 2) + 'px',
            'height:' + (h + pad * 2) + 'px',
            'border:2px solid #ef4444',
            'border-radius:6px',
            'background:rgba(239,68,68,0.12)',
            'animation:__fraudPulse 1.2s ease-in-out infinite',
            'pointer-events:none'
          ].join(';');
          const tag = document.createElement('div');
          tag.textContent = num + (note ? ' · ' + note : '');
          tag.style.cssText = 'position:absolute;top:-22px;left:-2px;background:#ef4444;color:#fff;font:700 11px/1 -apple-system,sans-serif;padding:4px 7px;border-radius:5px;white-space:nowrap;';
          box.appendChild(tag);
          container.appendChild(box);
        }

        // Highlight elements by CSS selector; returns count found
        function highlightSelectors(selectors, label) {
          const c = hlContainer();
          let n = 0, firstEl = null;
          (selectors || []).forEach(sel => {
            let el = null;
            try { el = document.querySelector(sel); } catch (_) {}
            if (!el) return;
            n++;
            const rect = el.getBoundingClientRect();
            const hidden = rect.width === 0 && rect.height === 0;
            if (hidden) {
              // display:none element — mark its parent's location instead
              const p = el.parentElement;
              const prect = p ? p.getBoundingClientRect() : { left: 8, top: 8, width: 120, height: 24 };
              drawBox(c, prect, n, label + ' (hidden here)');
              if (!firstEl && p) firstEl = p;
            } else {
              drawBox(c, rect, n, label);
              if (!firstEl) firstEl = el;
            }
          });
          if (firstEl) firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return n;
        }

        // Highlight first few occurrences of each keyword in page text
        function highlightText(words, label) {
          const c = hlContainer();
          let n = 0, firstRect = null;
          const seen = {};
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
              const pe = node.parentElement;
              if (!pe) return NodeFilter.FILTER_REJECT;
              if (pe.closest('#' + BANNER_ID) || pe.closest('#' + HL_ID)) return NodeFilter.FILTER_REJECT;
              const st = window.getComputedStyle(pe);
              if (st.display === 'none' || st.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          });
          let node;
          while ((node = walker.nextNode()) && n < 15) {
            const textLower = node.textContent.toLowerCase();
            for (const word of words) {
              const w = word.toLowerCase();
              if ((seen[w] || 0) >= 2) continue; // max 2 marks per keyword
              let idx = textLower.indexOf(w);
              if (idx === -1) continue;
              try {
                const range = document.createRange();
                range.setStart(node, idx);
                range.setEnd(node, idx + w.length);
                const rect = range.getBoundingClientRect();
                if (rect.width === 0) continue;
                n++;
                seen[w] = (seen[w] || 0) + 1;
                drawBox(c, rect, n, '"' + word + '"');
                if (!firstRect) firstRect = rect;
              } catch (_) {}
            }
          }
          if (firstRect) {
            window.scrollTo({ top: firstRect.top + window.scrollY - window.innerHeight / 3, behavior: 'smooth' });
          }
          return n;
        }

        function highlightFlag(flag, label) {
          if (!flag.loc || !flag.loc.values || flag.loc.values.length === 0) return 0;
          return flag.loc.type === 'text'
            ? highlightText(flag.loc.values, label)
            : highlightSelectors(flag.loc.values, label);
        }

        // Highlight everything at once (all locatable flags in one pass)
        function highlightAll(flags) {
          const c = hlContainer();
          let n = 0, firstEl = null, firstRect = null;
          flags.forEach(flag => {
            if (!flag.loc || !flag.loc.values || flag.loc.values.length === 0) return;
            if (flag.loc.type === 'selector') {
              flag.loc.values.forEach(sel => {
                let el = null;
                try { el = document.querySelector(sel); } catch (_) {}
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const hidden = rect.width === 0 && rect.height === 0;
                n++;
                if (hidden) {
                  const p = el.parentElement;
                  drawBox(c, p ? p.getBoundingClientRect() : { left: 8, top: 8, width: 120, height: 24 }, n, flag.label + ' (hidden)');
                } else {
                  drawBox(c, rect, n, flag.label);
                  if (!firstEl) firstEl = el;
                }
              });
            } else {
              const seen = {};
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                  const pe = node.parentElement;
                  if (!pe || pe.closest('#' + BANNER_ID) || pe.closest('#' + HL_ID)) return NodeFilter.FILTER_REJECT;
                  return NodeFilter.FILTER_ACCEPT;
                }
              });
              let node, found = 0;
              while ((node = walker.nextNode()) && found < 6) {
                const textLower = node.textContent.toLowerCase();
                for (const word of flag.loc.values) {
                  const w = word.toLowerCase();
                  if (seen[w]) continue;
                  const idx = textLower.indexOf(w);
                  if (idx === -1) continue;
                  try {
                    const range = document.createRange();
                    range.setStart(node, idx);
                    range.setEnd(node, idx + w.length);
                    const rect = range.getBoundingClientRect();
                    if (rect.width === 0) continue;
                    n++; found++; seen[w] = true;
                    drawBox(c, rect, n, '"' + word + '"');
                    if (!firstRect) firstRect = rect;
                  } catch (_) {}
                }
              }
            }
          });
          if (firstEl) firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else if (firstRect) window.scrollTo({ top: firstRect.top + window.scrollY - window.innerHeight / 3, behavior: 'smooth' });
          return n;
        }

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
          * { box-sizing: border-box; }
          .panel {
            background: #0d1117;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 12px;
            padding: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.7);
            animation: slideUp 0.3s cubic-bezier(0.4,0,0.2,1);
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .header {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .score-chip {
            font-size: 15px;
            font-weight: 800;
            padding: 5px 10px;
            border-radius: 8px;
            line-height: 1;
            flex-shrink: 0;
          }
          .score-chip.safe    { background: rgba(16,185,129,0.15); color: #10b981; }
          .score-chip.warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
          .score-chip.danger  { background: rgba(239,68,68,0.15);  color: #ef4444; }
          .verdict {
            flex: 1;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.3;
            color: #e5e7eb;
          }
          .close {
            background: none;
            border: none;
            color: #6b7280;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            padding: 2px;
            flex-shrink: 0;
            align-self: flex-start;
          }
          .close:hover { color: #f3f4f6; }
          .hint {
            font-size: 10px;
            color: #6b7280;
            margin: 10px 0 6px;
          }
          .issue {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 9px;
            border-radius: 8px;
            margin: 4px 0;
            border: 1px solid transparent;
          }
          .issue--flagged { background: rgba(239,68,68,0.08); }
          .issue--warn    { background: rgba(245,158,11,0.08); }
          .issue.locatable { cursor: pointer; transition: background 0.15s, border-color 0.15s; }
          .issue--flagged.locatable:hover { background: rgba(239,68,68,0.16); }
          .issue--warn.locatable:hover    { background: rgba(245,158,11,0.16); }
          .issue.active { border-color: rgba(239,68,68,0.5); }
          .issue-icon {
            font-size: 11px;
            font-weight: 700;
            flex-shrink: 0;
            width: 12px;
            text-align: center;
          }
          .issue--flagged .issue-icon { color: #ef4444; }
          .issue--warn    .issue-icon { color: #f59e0b; }
          .issue-body { flex: 1; min-width: 0; }
          .issue-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #e5e7eb;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .issue-sub {
            display: block;
            font-size: 10px;
            color: #9ca3af;
            margin-top: 1px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .pin {
            font-size: 12px;
            flex-shrink: 0;
            opacity: 0.6;
          }
          .issue.locatable:hover .pin { opacity: 1; }
          .show-all {
            display: block;
            width: 100%;
            background: none;
            border: 1px solid rgba(255,255,255,0.12);
            color: #9ca3af;
            font-size: 11px;
            font-weight: 600;
            padding: 7px 10px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 8px;
            transition: all 0.15s;
          }
          .show-all:hover { border-color: rgba(255,255,255,0.3); color: #e5e7eb; }
          .show-all.active {
            background: rgba(239,68,68,0.12);
            border-color: rgba(239,68,68,0.35);
            color: #ef4444;
          }
        `;

        const panel = document.createElement('div');
        panel.className = 'panel';

        // Header: score chip + verdict + close (one row)
        const header = document.createElement('div');
        header.className = 'header';
        const chip = document.createElement('span');
        chip.className = `score-chip ${data.verdictClass}`;
        chip.textContent = data.trustScore;
        const verdictEl = document.createElement('span');
        verdictEl.className = 'verdict';
        verdictEl.textContent = data.verdictText;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => { clearHighlights(); host.remove(); });
        header.appendChild(chip);
        header.appendChild(verdictEl);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        if (data.flags && data.flags.length > 0) {
          const locatable = data.flags.filter(f => f.loc && f.loc.values && f.loc.values.length > 0);
          let activeRow = null; // only one highlight set at a time

          const hint = document.createElement('div');
          hint.className = 'hint';
          hint.textContent = locatable.length > 0
            ? `${data.flags.length} issue${data.flags.length > 1 ? 's' : ''} — click one to see it on the page`
            : `${data.flags.length} issue${data.flags.length > 1 ? 's' : ''} found`;
          panel.appendChild(hint);

          function deactivate() {
            if (activeRow) activeRow.classList.remove('active');
            activeRow = null;
          }

          data.flags.forEach(flag => {
            const hasLoc = flag.loc && flag.loc.values && flag.loc.values.length > 0;
            const row = document.createElement('div');
            row.className = `issue issue--${flag.cls}${hasLoc ? ' locatable' : ''}`;

            // Single clean row: icon, label + one sub-line, pin if locatable
            const sub = flag.detail || (flag.text || '').replace(/^[✗⚠]\s*/, '');
            row.innerHTML = `
              <span class="issue-icon">${flag.cls === 'flagged' ? '✗' : '⚠'}</span>
              <span class="issue-body">
                <span class="issue-label">${flag.label}</span>
                ${sub && sub !== flag.label ? `<span class="issue-sub">${sub}</span>` : ''}
              </span>
              ${hasLoc ? '<span class="pin">📍</span>' : ''}
            `;

            if (hasLoc) {
              row.addEventListener('click', () => {
                if (row === activeRow) { clearHighlights(); deactivate(); return; }
                deactivate();
                highlightFlag(flag, flag.label);
                row.classList.add('active');
                activeRow = row;
              });
            }
            panel.appendChild(row);
          });

          // "Show all" — highlight every locatable issue at once
          if (locatable.length > 1) {
            const showAll = document.createElement('button');
            showAll.className = 'show-all';
            showAll.dataset.label = 'Show all on page';
            showAll.textContent = showAll.dataset.label;
            showAll.addEventListener('click', () => {
              if (showAll.classList.contains('active')) {
                clearHighlights();
                showAll.classList.remove('active');
                showAll.textContent = showAll.dataset.label;
                return;
              }
              deactivate();
              const n = highlightAll(locatable);
              showAll.classList.add('active');
              showAll.textContent = `Hide highlights (${n} marked)`;
            });
            // clear show-all state when an individual row is clicked
            panel.addEventListener('click', (e) => {
              if (!showAll.contains(e.target) && showAll.classList.contains('active')) {
                showAll.classList.remove('active');
                showAll.textContent = showAll.dataset.label;
              }
            }, true);
            panel.appendChild(showAll);
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
        const hl = document.getElementById('__fraud-ext-hl__');
        if (hl) hl.remove();
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

    lastScanData = null;
    if (scrapeBtn) scrapeBtn.style.display = 'none';
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

        lastScanData = {
          url: tab.url,
          scanned_at: new Date().toISOString(),
          trust_score: trustScore,
          signals,
          page_text: pageText || ""
        };
        const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
        const cacheKey = "scan:" + tab.url;

        // Local cache: instant result for recently scanned URLs (no network)
        const cached = await new Promise(resolve =>
          chrome.storage.local.get(cacheKey, items => resolve(items[cacheKey]))
        );
        if (cached && cached.result && (Date.now() - cached.ts) < CACHE_TTL_MS) {
          heroIcon.style.animation = "none";
          showResultFromServer(cached.result, signals, tab);
          return;
        }

        fetch(API_BASE + "/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: tab.url, trust_score: trustScore, signals, text: pageText || "" })
        })
        .then(res => res.json())
        .then(serverData => {
          // Synchronous backend path: result returned inline — no polling needed
          if (serverData.result) {
            chrome.storage.local.set({ [cacheKey]: { result: serverData.result, ts: Date.now() } });
            heroIcon.style.animation = "none";
            showResultFromServer(serverData.result, signals, tab);
            return;
          }
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
                chrome.storage.local.set({ ["scan:" + tab.url]: { result: data.result, ts: Date.now() } });
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

          if (lastScanData) lastScanData.server_analysis = result;
          showScrapeButton();

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

          showScrapeButton();

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
