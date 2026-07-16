// Zodi-Yuga Email Capture Modal — shared across all timeline pages

(function() {
  'use strict';

  const STORAGE_KEY = 'zy_subscribe_dismissed';
  const SHOW_DELAY_MS = 12000;
  const SCROLL_THRESHOLD = 0.6;
  const STORED_UNTIL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

  let shown = false;
  // Skip email capture modal during local development
  if (window.location.search.includes('dev') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    shown = true;
    return;
  }
  let scrollFired = false;

  function isDismissed() {
    const val = localStorage.getItem(STORAGE_KEY);
    if (!val) return false;
    try {
      const stored = JSON.parse(val);
      if (stored === true) return true;
      if (typeof stored === 'object' && stored.until && Date.now() < stored.until) return true;
    } catch (_) {
      // bad JSON — treat as not dismissed
    }
    return false;
  }

  function markDismissed() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ until: Date.now() + STORED_UNTIL_MS }));
  }

  function markSubscribed() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ until: Date.now() + STORED_UNTIL_MS, subscribed: true }));
  }

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'zy-subscribe-overlay';
    overlay.id = 'zySubscribeOverlay';
    overlay.innerHTML = `
      <div class="zy-subscribe-card">
        <button class="zy-subscribe-close" id="zySubscribeClose" aria-label="Close">&times;</button>
        <div class="zy-subscribe-icon">${/* cosmic icon SVG */''}
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
            <path d="M24 4v4M24 40v4M4 24h4M40 24h4M10.3 10.3l2.8 2.8M34.9 34.9l2.8 2.8M10.3 37.7l2.8-2.8M34.9 13.1l2.8-2.8" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
            <circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.6" stroke-dasharray="4 3"/>
            <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.15"/>
          </svg>
        </div>
        <h3 class="zy-subscribe-title">See Your Place in Cosmic History</h3>
        <p class="zy-subscribe-subtitle">Enter your email for a free Yuga Era & Saeculum Report — discover what cosmic era you were born into.</p>
        <form class="zy-subscribe-form" id="zySubscribeForm">
          <input type="email" class="zy-subscribe-input" id="zySubscribeEmail" placeholder="Enter your email" required autocomplete="email">
          <button type="submit" class="zy-subscribe-btn" id="zySubscribeBtn">Get My Free Report</button>
        </form>
        <p class="zy-subscribe-disclaimer">No spam. Unsubscribe anytime.</p>
        <a href="#" class="zy-subscribe-dismiss" id="zySubscribeDismiss">Not now, maybe later</a>
        <div class="zy-subscribe-success" id="zySubscribeSuccess" style="display:none;">
          <p>✅ Check your inbox for your free report!</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Close button
    document.getElementById('zySubscribeClose').addEventListener('click', function(e) {
      e.preventDefault();
      hideModal();
    });

    // Dismiss link
    document.getElementById('zySubscribeDismiss').addEventListener('click', function(e) {
      e.preventDefault();
      markDismissed();
      hideModal();
    });

    // Form submit
    document.getElementById('zySubscribeForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('zySubscribeEmail').value.trim();
      if (!email) return;
      const btn = document.getElementById('zySubscribeBtn');
      btn.disabled = true;
      btn.textContent = 'Sending...';
      try {
        const pageLanguage = document.documentElement.lang === 'es' || /_es(?:\.html)?$/.test(window.location.pathname)
          ? 'es'
          : 'en';
        const resp = await fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, lang: pageLanguage })
        });
        if (resp.ok) {
          markSubscribed();
          document.getElementById('zySubscribeForm').style.display = 'none';
          document.getElementById('zySubscribeSuccess').style.display = 'block';
          setTimeout(hideModal, 2500);
        } else {
          btn.textContent = 'Try Again';
          btn.disabled = false;
        }
      } catch (_) {
        btn.textContent = 'Try Again';
        btn.disabled = false;
      }
    });

    // Animate in
    requestAnimationFrame(function() {
      overlay.classList.add('zy-subscribe-visible');
    });
  }

  function showModal() {
    if (shown) return;
    if (isDismissed()) return;
    shown = true;
    buildModal();
  }

  function hideModal() {
    const overlay = document.getElementById('zySubscribeOverlay');
    if (!overlay) return;
    overlay.classList.remove('zy-subscribe-visible');
    overlay.classList.add('zy-subscribe-hiding');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 400);
  }

  // Timer trigger
  setTimeout(showModal, SHOW_DELAY_MS);

  // Scroll trigger
  window.addEventListener('scroll', function onScroll() {
    if (scrollFired || shown) return;
    const scrollPct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    if (scrollPct >= SCROLL_THRESHOLD) {
      scrollFired = true;
      showModal();
    }
  }, { passive: true });

})();
