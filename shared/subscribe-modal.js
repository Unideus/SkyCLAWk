// Zodi-Yuga Email Capture Modal — shared across all timeline pages

(function() {
  'use strict';

  const STORAGE_KEY = 'zy_subscribe_dismissed';
  const SHOW_DELAY_MS = 12000;
  const SCROLL_THRESHOLD = 0.6;
  const STORED_UNTIL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
  const GUIDE_DOWNLOAD_URL = '/downloads/your-place-in-the-saeculum.pdf';

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
    let selectedLanguage = document.documentElement.lang === 'es' || /_es(?:\.html)?$/.test(window.location.pathname)
      ? 'es'
      : 'en';
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
        <label for="zySubscribeLanguage" style="display:block;text-align:right;margin-bottom:8px;font-size:12px;opacity:.8;">
          <span id="zySubscribeLanguageLabel">Language</span>
          <select id="zySubscribeLanguage" style="margin-left:6px;padding:3px 6px;border-radius:4px;">
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
        <h3 class="zy-subscribe-title" id="zySubscribeTitle">Get Your Free Saeculum Guide</h3>
        <p class="zy-subscribe-subtitle" id="zySubscribeSubtitle">Download <em>Your Place in the Saeculum</em>, a free, non-personalized guide to the generational cycle, and receive Zodi Yuga email updates.</p>
        <form class="zy-subscribe-form" id="zySubscribeForm">
          <input type="email" class="zy-subscribe-input" id="zySubscribeEmail" placeholder="Enter your email" required autocomplete="email">
          <label class="zy-subscribe-consent" for="zySubscribeConsent">
            <input type="checkbox" id="zySubscribeConsent" name="marketingConsent" required>
            <span id="zySubscribeConsentText">I agree to receive Zodi Yuga email updates and marketing. I can unsubscribe at any time.</span>
          </label>
          <button type="submit" class="zy-subscribe-btn" id="zySubscribeBtn">Subscribe &amp; Get the Guide</button>
        </form>
        <p class="zy-subscribe-disclaimer" id="zySubscribeDisclaimer">The guide is general and is not based on your birth data. No spam. Unsubscribe anytime.</p>
        <a href="#" class="zy-subscribe-dismiss" id="zySubscribeDismiss">Not now, maybe later</a>
        <div class="zy-subscribe-success" id="zySubscribeSuccess" style="display:none;">
          <p id="zySubscribeSuccessText">✅ You’re subscribed. Your free guide is ready.</p>
          <a class="zy-subscribe-download" id="zySubscribeDownload" href="${GUIDE_DOWNLOAD_URL}" download="your-place-in-the-saeculum.pdf">Download <em>Your Place in the Saeculum</em> (PDF)</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const languageSelect = document.getElementById('zySubscribeLanguage');
    languageSelect.value = selectedLanguage;
    function setLanguage(language) {
      selectedLanguage = language === 'es' ? 'es' : 'en';
      const spanish = selectedLanguage === 'es';
      document.getElementById('zySubscribeLanguageLabel').textContent = spanish ? 'Idioma' : 'Language';
      document.getElementById('zySubscribeTitle').textContent = spanish ? 'Obtén tu guía gratuita del Saeculum' : 'Get Your Free Saeculum Guide';
      document.getElementById('zySubscribeSubtitle').textContent = spanish
        ? 'Descarga Tu lugar en el Saeculum, una guía general no personalizada sobre el ciclo generacional, y recibe novedades de Zodi Yuga por correo. La guía está en inglés.'
        : 'Download Your Place in the Saeculum, a free, non-personalized guide to the generational cycle, and receive Zodi Yuga email updates.';
      document.getElementById('zySubscribeEmail').placeholder = spanish ? 'Ingresa tu correo' : 'Enter your email';
      document.getElementById('zySubscribeConsentText').textContent = spanish
        ? 'Acepto recibir novedades y mensajes de marketing de Zodi Yuga por correo electrónico. Puedo cancelar mi suscripción en cualquier momento.'
        : 'I agree to receive Zodi Yuga email updates and marketing. I can unsubscribe at any time.';
      document.getElementById('zySubscribeBtn').textContent = spanish ? 'Suscribirme y obtener la guía' : 'Subscribe & Get the Guide';
      document.getElementById('zySubscribeDisclaimer').textContent = spanish
        ? 'La guía es general y no se basa en tus datos de nacimiento. Sin spam. Puedes cancelar tu suscripción cuando quieras.'
        : 'The guide is general and is not based on your birth data. No spam. Unsubscribe anytime.';
      document.getElementById('zySubscribeDismiss').textContent = spanish ? 'Ahora no, quizás más tarde' : 'Not now, maybe later';
      document.getElementById('zySubscribeSuccessText').textContent = spanish
        ? '✅ Ya estás suscrito. Tu guía gratuita está lista.'
        : '✅ You’re subscribed. Your free guide is ready.';
      document.getElementById('zySubscribeDownload').textContent = spanish
        ? 'Descargar Tu lugar en el Saeculum (PDF en inglés)'
        : 'Download Your Place in the Saeculum (PDF)';
    }
    languageSelect.addEventListener('change', function() { setLanguage(this.value); });
    setLanguage(selectedLanguage);

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
      const marketingConsent = document.getElementById('zySubscribeConsent').checked;
      if (!email || !marketingConsent) return;
      const btn = document.getElementById('zySubscribeBtn');
      btn.disabled = true;
      btn.textContent = selectedLanguage === 'es' ? 'Enviando…' : 'Subscribing…';
      try {
        const resp = await fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, lang: selectedLanguage, marketingConsent })
        });
        if (resp.ok) {
          markSubscribed();
          document.getElementById('zySubscribeForm').style.display = 'none';
          document.getElementById('zySubscribeDisclaimer').style.display = 'none';
          document.getElementById('zySubscribeDismiss').style.display = 'none';
          document.getElementById('zySubscribeSuccess').style.display = 'block';
        } else {
          btn.textContent = selectedLanguage === 'es' ? 'Intentar de nuevo' : 'Try Again';
          btn.disabled = false;
        }
      } catch (_) {
        btn.textContent = selectedLanguage === 'es' ? 'Intentar de nuevo' : 'Try Again';
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
