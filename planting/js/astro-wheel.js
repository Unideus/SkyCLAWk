/* astro-wheel.js — popout astro wheel (SVG, no canvas)
   =========================================================
   Replaces legacy canvas wheel + masking.
   Keeps global drawAstroWheel() for ui-controller.js.
   ========================================================= */
(function () {
  const wheelModal = document.getElementById("wheelModal");
  const wheelFab   = document.getElementById("wheelFab");
  const wheelClose = document.getElementById("wheelClose");
  const wheelImg   = document.getElementById("wheelImg");

  if (!wheelModal || !wheelFab || !wheelImg) {
    console.warn("[astro-wheel] modal DOM not found; wheel disabled.");
    window.drawAstroWheel = function () {};
    return;
  }
  
  console.log('[astro-wheel] Initializing, wheelFab:', wheelFab, 'wheelModal:', wheelModal, 'wheelImg:', wheelImg);

  // =========================================================
  // NATAL CHART (kept for existing ui-controller wiring)
  // =========================================================
  window.NatalChart = window.NatalChart || {
    enabled: false,
    dateUTC: null,
    longitudes: null,
    angles: null,  // ASC/MC for natal chart
    setDateUTC(d) {
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) return;
      this.dateUTC = d;
      if (typeof getPlanetLongitudes === "function") {
        this.longitudes = getPlanetLongitudes(d);
      }
      // Compute natal angles if location is available
      // Only compute angles when explicitly setting the date, not on location change alone
      if (window.natalLocationData && window.natalLocationData.lat != null && 
          window.natalLocationData.lon != null && typeof getHouseCusps === "function") {
        try {
          const houses = getHouseCusps(d, window.natalLocationData.lat, window.natalLocationData.lon);
          if (houses && Number.isFinite(houses.asc) && Number.isFinite(houses.mc)) {
            this.angles = { asc: houses.asc, mc: houses.mc };
          }
        } catch(e) {
          console.warn('Could not compute natal angles:', e);
        }
      }
    }
  };

  // =========================================================
  // ENABLED PLANETS STATE (for Bodies modal toggles)
  // =========================================================
  window.enabledPlanets = window.enabledPlanets || {
    sun: true, moon: true, mercury: true, venus: true, mars: true,
    jupiter: true, saturn: true, uranus: true, neptune: true, pluto: true,
    chiron: false, ceres: false, pallas: false, juno: false, vesta: false, eros: false,
    regulus: false, aldebaran: false, antares: false, fomalhaut: false,
    sirius: false, spica: false, rigel: false, algol: false, deneb: false,
    northNode: true, southNode: true
  };

  // Planetary cycle overlay state
  window.cycleMode = '';
  window.cyclePlanet = '';

  // Function to update which planets are shown
  window.setPlanetEnabled = function(planetId, enabled) {
    if (window.enabledPlanets.hasOwnProperty(planetId)) {
      window.enabledPlanets[planetId] = enabled;
      // Redraw the wheel if it's open
      if (wheelModal.getAttribute("aria-hidden") === "false") {
        drawAstroWheel();
      }
    }
  };

    const wheelCardEl = wheelModal.querySelector(".zyModalCard");
    const wheelBackdropEl = wheelModal.querySelector(".zyModalBackdrop");

    function openWheel() {
      wheelModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("zodiac-panel-open");
      // Recalculate NOW marker position after layout shifts
      requestAnimationFrame(() => {
        if (typeof window.syncTimeMarkerLayout === "function") window.syncTimeMarkerLayout();
        setTimeout(() => {
          if (typeof window.syncTimeMarkerLayout === "function") window.syncTimeMarkerLayout();
        }, 200);
      });
      // Relocate guild preview + budget tracker right of the modal
      if (typeof window.repositionPlantingFixedPanels === "function") window.repositionPlantingFixedPanels();

      // Backdrop passes through clicks, card captures them
      if (wheelBackdropEl) wheelBackdropEl.style.pointerEvents = "none";
      if (wheelCardEl) wheelCardEl.style.pointerEvents = "auto";

      drawAstroWheel();
      if (typeof syncEventShield === "function") syncEventShield();
    }

    function closeWheel() {
      wheelModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("zodiac-panel-open");
      // Relocate guild preview + budget tracker back to original position
      if (typeof window.repositionPlantingFixedPanels === "function") window.repositionPlantingFixedPanels();

      // reset (safe)
      wheelModal.style.pointerEvents = "";
      if (wheelBackdropEl) wheelBackdropEl.style.pointerEvents = "";
      if (wheelCardEl) wheelCardEl.style.pointerEvents = "";

      if (typeof syncEventShield === "function") syncEventShield();
      // Recalculate NOW marker + seasons box position after layout shifts back
      requestAnimationFrame(() => {
        if (typeof window.syncTimeMarkerLayout === "function") window.syncTimeMarkerLayout();
        setTimeout(() => {
          if (typeof window.syncTimeMarkerLayout === "function") window.syncTimeMarkerLayout();
        }, 100);
      });
    }

    function toggleWheel() {
      const isOpen = wheelModal.getAttribute("aria-hidden") === "false";
      if (isOpen) closeWheel(); else openWheel();
    }

  // ALWAYS start closed on load (also fixes hot-reload keeping it open)
  closeWheel();

  // =========================================================
// DRAGGABLE MODAL CARD
// =========================================================
const wheelCard = wheelModal.querySelector(".zyModalCard");
let dragOn = false;
let dragStartX = 0, dragStartY = 0;
let cardStartLeft = 0, cardStartTop = 0;

  function ensureCardPositioned() {
    if (!wheelCard) return;

    // Switch from centered/transform layout to explicit left/top once we drag.
    const r = wheelCard.getBoundingClientRect();
    wheelCard.style.position = "fixed";
    wheelCard.style.left = `${r.left}px`;
    wheelCard.style.top = `${r.top}px`;
    wheelCard.style.margin = "0";
    wheelCard.style.transform = "none";
  }

  if (wheelCard) {
    wheelCard.addEventListener("pointerdown", (ev) => {
      // Don't start drag from buttons/HUD interactions.
      if (ev.target.closest("button")) return;
      if (ev.target.closest("#astroHUD")) return;
      if (ev.target.closest("#housesToggle")) return;

      // Only drag when wheel is open
      if (wheelModal.getAttribute("aria-hidden") !== "false") return;

      ensureCardPositioned();

      dragOn = true;
      dragStartX = ev.clientX;
      dragStartY = ev.clientY;

      const r = wheelCard.getBoundingClientRect();
      cardStartLeft = r.left;
      cardStartTop = r.top;

      wheelCard.setPointerCapture(ev.pointerId);
    });

    wheelCard.addEventListener("pointermove", (ev) => {
      if (!dragOn) return;

      const dx = ev.clientX - dragStartX;
      const dy = ev.clientY - dragStartY;

      // Intentionally NOT clamped: lets you drag partly off-screen
      wheelCard.style.left = `${cardStartLeft + dx}px`;
      wheelCard.style.top  = `${cardStartTop + dy}px`;

      if (typeof syncEventShield === "function") syncEventShield();
    });

    wheelCard.addEventListener("pointerup", () => {
      dragOn = false;
    });

    wheelCard.addEventListener("pointercancel", () => {
      dragOn = false;
    });
  }
  wheelFab.addEventListener("click", toggleWheel);
  

  wheelModal.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t && t.getAttribute && t.getAttribute("data-close") === "wheel") closeWheel();
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && wheelModal.getAttribute("aria-hidden") === "false") closeWheel();
  });

  // =========================================================
  // RESIZE (bottom-right handle)
  // =========================================================
  const resizeHandle = document.getElementById("wheelResizeHandle");
  let resizeOn = false;
  let resizeStartX = 0, resizeStartY = 0;
  let startW = 0, startH = 0;

  const MIN_W = 320;
  const MIN_H = 320;
  const MAX_W = 1200;  // safe; can go bigger if you want
  const MAX_H = 900;

  function setWheelSize(w, h) {
    wheelCard.style.setProperty("--wheelW", `${w}px`);
    wheelCard.style.setProperty("--wheelH", `${h}px`);
  }

  if (wheelCard && resizeHandle) {
    resizeHandle.addEventListener("pointerdown", (ev) => {
      if (wheelModal.getAttribute("aria-hidden") !== "false") return;

      ev.preventDefault();
      ev.stopPropagation();

      const r = wheelCard.getBoundingClientRect();
      resizeOn = true;
      resizeStartX = ev.clientX;
      resizeStartY = ev.clientY;
      startW = r.width;
      startH = r.height;

      resizeHandle.setPointerCapture(ev.pointerId);
    });

    resizeHandle.addEventListener("pointermove", (ev) => {
      if (!resizeOn) return;

      const dx = ev.clientX - resizeStartX;
      const dy = ev.clientY - resizeStartY;

      const w = Math.max(MIN_W, Math.min(MAX_W, Math.round(startW + dx)));
      const h = Math.max(MIN_H, Math.min(MAX_H, Math.round(startH + dy)));

      setWheelSize(w, h);

      // keep wheel fresh while resizing
      if (typeof requestWheelRedraw === "function") requestWheelRedraw();
    });

    resizeHandle.addEventListener("pointerup", () => { resizeOn = false; });
    resizeHandle.addEventListener("pointercancel", () => { resizeOn = false; });
  }

  // Wheel closed by default - user must click Zodiac Wheel button to open
  // requestAnimationFrame(openWheel);

  // ---------------------------------------------------------
  // Preload constellation SVG and embed as data URL (works inside data: SVG wheel)
  // ---------------------------------------------------------
  let HEAVEN_DATA_URL = "";
  let constellationReady = false;

  fetch("/heaven_constellations.svg")
    .then(r => {
      return r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`));
    })
    .then(txt => {
      HEAVEN_DATA_URL = "data:image/svg+xml," + encodeURIComponent(txt);
      constellationReady = true;
      if (typeof requestWheelRedraw === "function") requestWheelRedraw();
    })
    .catch(err => console.warn("[wheel] heaven_constellations.svg load failed:", err));

  // =========================================================
  // SVG WHEEL RENDERER (ported from MyTimeline)
  // =========================================================

  const elementColors = {
    fire:  "#d32f2f",
    earth: "#2e7d32",
    air:   "#fbc02d",
    water: "#1976d2",
  };

  const signMeta = [
    { glyph: "♈︎", element: "fire"  },
    { glyph: "♉︎", element: "earth" },
    { glyph: "♊︎", element: "air"   },
    { glyph: "♋︎", element: "water" },
    { glyph: "♌︎", element: "fire"  },
    { glyph: "♍︎", element: "earth" },
    { glyph: "♎︎", element: "air"   },
    { glyph: "♏︎", element: "water" },
    { glyph: "♐︎", element: "fire"  },
    { glyph: "♑︎", element: "earth" },
    { glyph: "♒︎", element: "air"   },
    { glyph: "♓︎", element: "water" },
  ];

  const planetGlyph = {
    sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
    jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
    northNode: "☊", southNode: "☋",
    chiron: "⚷", ceres: "⚳", pallas: "⚴", juno: "⚵", vesta: "⚶", eros: "♡",
    regulus: "★", aldebaran: "★", antares: "★", fomalhaut: "★",
    sirius: "★", spica: "★", rigel: "★", algol: "★", deneb: "★",
  };

  // Smooth glyph angle offsets (degrees), keyed by body key (persist across frames)
  const __glyphAngOffset = new Map();

  function renderWheelSVG(bodyLons, opts = {}) {
    const W = 900, H = 900;
    const cx = W / 2, cy = H / 2;
    // ── Cache static SVG layers ──
    if (!renderWheelSVG.__zodiacCache) {
        renderWheelSVG.__zodiacCache = { key: '', wedges: '', signText: '' };
    }
    if (!renderWheelSVG.__aspectCache) {
        renderWheelSVG.__aspectCache = { key: '', aspectTicks: '', aspectLines: '' };
    }

    // ---------------------------------------------------------

    // ---------------------------------------------------------
    // JD UT (for precession) — derived from opts.dateUTC (passed from drawAstroWheel)
    // ---------------------------------------------------------
    const jdUt = (opts.dateUTC instanceof Date && Number.isFinite(opts.dateUTC.getTime()))
      ? (opts.dateUTC.getTime() / 86400000) + 2440587.5
      : NaN;

    // Precession constants (fallback defaults if not already defined elsewhere)
    const PRECESS_EPOCH_JD = (typeof window.PRECESS_EPOCH_JD === "number") ? window.PRECESS_EPOCH_JD : 2451545.0; // J2000.0
    const PRECESS_ARCSEC_PER_YEAR = (typeof window.PRECESS_ARCSEC_PER_YEAR === "number") ? window.PRECESS_ARCSEC_PER_YEAR : 50.29;
    const PRECESS_SIGN = (typeof window.PRECESS_SIGN === "number") ? window.PRECESS_SIGN : -1; // backwards (sidereal vs tropical)

    // ---------------------------------------------------------
    // RADIUS LAYOUT
    // ---------------------------------------------------------
    const ZODIAC_SCALE = 0.80; // adjust until zodiac OUTER edge matches constellation ecliptic

    // zodiac band (scaled)
    const rOuter     = 360 * ZODIAC_SCALE;
    const rSignInner = 290 * ZODIAC_SCALE;

    // your stem numbers (as requested)
    const rStemOuter2 = 290; // stem ends on the ecliptic dot
    const rStemInner2 = 335; // stem starts farther out (longer stem)

    // ecliptic reference (dot sits here)
    const rEcliptic = rStemOuter2;

    // glyph sits just outside the dot (you had +75; keep it for now)
    const rGlyph = rEcliptic + 75;

    // aspects inside (scaled with zodiac)
    // When natal is enabled, move aspects inward to avoid overlapping natal houses
    const natalActive = window.NatalChart && window.NatalChart.enabled;
    const aspectScale = natalActive ? 0.88 : 1.0;
    const rAspectTickOuter = 275 * ZODIAC_SCALE * aspectScale;
    const rAspectTickInner = 250 * ZODIAC_SCALE * aspectScale;
    const rAspectLine = rAspectTickInner - (8 * ZODIAC_SCALE * aspectScale);

    const degToRad = (d) => (d * Math.PI) / 180;

    // 0° Aries at 9 o’clock (same convention as MyTimeline)
    let baseLon = Number.isFinite(opts.baseLon) ? opts.baseLon : 0;
    const skyMode = window.astrowheelSkyMode || "tropical";
    if (baseLon === 0 && skyMode === "transit" && typeof window.getHouseCusps === "function") {
      // Transit mode: place the timeline date/location ASC at 9 o'clock.
      const loc = window.locationData || null;
      const d = opts.dateUTC instanceof Date && Number.isFinite(opts.dateUTC.getTime()) ? opts.dateUTC : null;
      if (loc && loc.lat != null && loc.lon != null && d) {
        try {
          const ha = window.getHouseCusps(d, loc.lat, loc.lon);
          const asc = Number(ha?.asc);
          if (Number.isFinite(asc)) {
            baseLon = (asc % 360 + 360) % 360;
          }
        } catch(e) {}
      }
    }
    const ang = (lonDeg) => degToRad(180 - (lonDeg - baseLon));

    const pt = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

    const __layoutKey = [W, H, ZODIAC_SCALE, rOuter, rSignInner, Math.round(baseLon)].join(':');
    let cacheHit = renderWheelSVG.__zodiacCache.key === __layoutKey;

    // ---- ring wedges + sign glyphs
    let wedges = "";
    let signText = "";

    if (cacheHit) {
        wedges = renderWheelSVG.__zodiacCache.wedges;
        signText = renderWheelSVG.__zodiacCache.signText;
    } else {
    for (let i = 0; i < 12; i++) {
      const a0 = ang(i * 30);
      const a1 = ang((i + 1) * 30);

      const [x0, y0] = pt(rOuter, a0);
      const [x1, y1] = pt(rOuter, a1);
      const [x2, y2] = pt(rSignInner, a1);
      const [x3, y3] = pt(rSignInner, a0);

      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const fill = elementColors[signMeta[i].element];

      wedges += `
        <path d="
          M ${x0} ${y0}
          A ${rOuter} ${rOuter} 0 ${large} 0 ${x1} ${y1}
          L ${x2} ${y2}
          A ${rSignInner} ${rSignInner} 0 ${large} 1 ${x3} ${y3}
          Z
        " fill="${fill}" opacity="0.35" />
      `;

      const mid = ang(i * 30 + 15);
      const [tx, ty] = pt((rOuter + rSignInner) / 2, mid);
      signText += `<text x="${tx}" y="${ty}" font-size="26" text-anchor="middle" dominant-baseline="middle"
        font-family="Segoe UI Symbol, Noto Sans Symbols2, DejaVu Sans, Arial Unicode MS, sans-serif"
        font-weight="400"
        fill="white" opacity="0.7">${signMeta[i].glyph}</text>`;
    }
        renderWheelSVG.__zodiacCache.key = __layoutKey;
        renderWheelSVG.__zodiacCache.wedges = wedges;
        renderWheelSVG.__zodiacCache.signText = signText;
    }

    // ---------------------------------------------------------
    // SHOW LIST (must exist BEFORE aspects + autoseparate)
    // ---------------------------------------------------------
    const showKeys = Array.isArray(opts.showKeys)
      ? opts.showKeys
      : Object.keys(bodyLons || {});

    // preserve the order of showKeys (no sorting here)
    const show = showKeys.filter(k => Number.isFinite(Number(bodyLons?.[k])));

    const __aspectKey = __layoutKey + '|' +
      show.map(k => k + ':' + ((bodyLons[k]||0) % 15).toFixed(2)).join(',') + '|natal:' + natalActive;
    let __aspectHit = renderWheelSVG.__aspectCache.key === __aspectKey;

    // ---- aspects (restore)
    let aspectTicks = "";
    let aspectLines = "";

    const cycleActive = window.cycleMode && window.cyclePlanet;
    if (cycleActive) {
      aspectTicks = '';
      aspectLines = '';
    } else if (__aspectHit) {
        aspectTicks = renderWheelSVG.__aspectCache.aspectTicks;
        aspectLines = renderWheelSVG.__aspectCache.aspectLines;
    } else if (show.length >= 2) {
      const aspects = [
        { deg: 0,   orb: 5, tick:"rgba(255,60,60,.85)",  line:"rgba(255,60,60,.45)" },
        { deg: 180, orb: 6, tick:"rgba(255,60,60,.75)",  line:"rgba(255,60,60,.35)" },
        { deg: 90,  orb: 5, tick:"rgba(255,60,60,.75)",  line:"rgba(255,60,60,.35)" },
        { deg: 120, orb: 5, tick:"rgba(70,160,255,.75)", line:"rgba(70,160,255,.32)" },
        { deg: 60,  orb: 4, tick:"rgba(70,160,255,.60)", line:"rgba(70,160,255,.22)" },
      ];

      function angleDiff(a, b) {
        let d = Math.abs(a - b) % 360;
        if (d > 180) d = 360 - d;
        return d;
      }

      function tickAt(lonDeg, stroke) {
        const a = ang(lonDeg);
        const [x1, y1] = pt(rAspectTickInner, a);
        const [x2, y2] = pt(rAspectTickOuter, a);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
          stroke="${stroke}" stroke-width="4" stroke-linecap="round" />`;
      }

      for (let i = 0; i < show.length; i++) {
        for (let j = i + 1; j < show.length; j++) {
          const Akey = show[i];
          const Bkey = show[j];

          // Skip node↔node (always 180° by definition)
          if (
            (Akey === "northNode" && Bkey === "southNode") ||
            (Akey === "southNode" && Bkey === "northNode")
          ) continue;

          const A = Number(bodyLons[Akey]);
          const B = Number(bodyLons[Bkey]);
          if (!Number.isFinite(A) || !Number.isFinite(B)) continue;

          const d = angleDiff(A, B);
          const hit = aspects.find(x => Math.abs(d - x.deg) <= x.orb);
          if (!hit) continue;

          aspectTicks += tickAt(A, hit.tick);
          aspectTicks += tickAt(B, hit.tick);

          const [x1, y1] = pt(rAspectLine, ang(A));
          const [x2, y2] = pt(rAspectLine, ang(B));
          aspectLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
            stroke="${hit.line}" stroke-width="2.5" stroke-linecap="round" />`;
        }
      }
        renderWheelSVG.__aspectCache.key = __aspectKey;
        renderWheelSVG.__aspectCache.aspectTicks = aspectTicks;
        renderWheelSVG.__aspectCache.aspectLines = aspectLines;
    }

    // ---- cycle overlay (retrograde/synodic chords on ecliptic) ---
    let cycleChords = '';
    const cycleMode = window.cycleMode || '';
    const cyclePlanet = window.cyclePlanet || '';

    // Center glyph + selected cycle marker(s) whenever a cycle is active.
    // Marker sits directly above the center planet glyph:
    //   retrograde => Rx, synodic => ☌, both => Rx + ☌
    if (cycleMode && cyclePlanet) {
      const centerGlyph = planetGlyph[cyclePlanet] || '•';
      const cycleMarkerParts = [];
      if (cycleMode === 'retrograde' || cycleMode === 'both') {
        cycleMarkerParts.push({ label: 'Rx', fill: '#e0a0d0' });
      }
      if (cycleMode === 'synodic' || cycleMode === 'both') {
        cycleMarkerParts.push({ label: '☌', fill: '#e8d888' });
      }
      const cycleMarkerText = cycleMarkerParts.map((part, idx) =>
        `<tspan ${idx ? 'dx="12"' : ''} fill="${part.fill}">${part.label}</tspan>`
      ).join('');
      if (cycleMarkerText) {
        cycleChords += `<text class="cycleCenterMarker" x="${cx}" y="${cy - 58}"
          font-size="20" text-anchor="middle" dominant-baseline="middle"
          font-family="Segoe UI, Inter, system-ui, sans-serif"
          font-weight="800" letter-spacing="0.04em"
          opacity="0.92">${cycleMarkerText}</text>`;
      }
      cycleChords += `<text class="cycleCenterGlyph" x="${cx}" y="${cy}" dy="0.35em"
        font-size="60" text-anchor="middle" dominant-baseline="middle"
        font-family="Segoe UI Symbol, Noto Sans Symbols2, DejaVu Sans, Arial Unicode MS, sans-serif"
        font-weight="400"
        fill="white" opacity="0.6">${centerGlyph}</text>`;
    }

    const trackState = window.cycleTrackState;
    if (trackState && trackState.pins && trackState.pins.length >= 1) {
      const retroPins = trackState.pins.filter(p => p.type === 'retrograde_station');
      const synPins = trackState.pins.filter(p => p.type === 'conjunction' || p.type === 'opposition');

      function drawFromPins(pins, color, opacity) {
        if (pins.length === 0) return;
        pins.forEach(p => {
          const [x, y] = pt(rSignInner, ang(Number(p.lon)));
          cycleChords += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${color}" stroke="rgba(255,255,255,0.3)" stroke-width="1" opacity="${opacity}" />`;
        });
        for (let i = 1; i < pins.length; i++) {
          const [x0, y0] = pt(rSignInner, ang(Number(pins[i-1].lon)));
          const [x1, y1] = pt(rSignInner, ang(Number(pins[i].lon)));
          cycleChords += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"
            stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="${opacity}" />`;
        }
      }

      if (retroPins.length >= 1) drawFromPins(retroPins, 'rgba(200,100,160,0.85)', '0.7');
      if (synPins.length >= 1) drawFromPins(synPins, 'rgba(200,200,100,0.85)', '0.7');
    }

    // ---- natal overlay (dots on ecliptic + glyphs with auto-separation + feathered circular shadows)
    let natalShadowDefs = "";
    let natalShadows = "";
    let natalDots = "";
    let natalLeaders = "";
    let natalLabels = "";
    const NATAL_DOT_R = 3.0;
    const NATAL_LEADER_GAP_DOT = 6;
    const NATAL_LEADER_GAP_GLYPH = 12;
    const rNatalEcliptic = rStemOuter2 - 3;
    const rNatalGlyph = (rSignInner + rOuter) / 2;
    const SHADOW_RADIUS = 24; // larger backdrop
    
    // Persistent natal glyph angle offsets
    const __natalGlyphAngOffset = (renderWheelSVG.__natalGlyphAngOffset ||= new Map());
    
    // Natal separation constants (less aggressive than transits)
    const NATAL_GLYPH_FONT_PX = 22;
    const NATAL_GLYPH_MIN_GAP_PX = 10;
    const NATAL_MIN_SEP_DEG = Math.max(
      0.5,
      Math.min(5.0, ((NATAL_GLYPH_FONT_PX + NATAL_GLYPH_MIN_GAP_PX) / rNatalGlyph) * (180 / Math.PI))
    );
    
    const enabled = window.enabledPlanets || {};
    if (opts.natalLons && typeof opts.natalLons === "object") {
      const natalKeys = Object.keys(opts.natalLons).filter(k => {
        const lon = Number(opts.natalLons[k]);
        // Only include asteroids if explicitly enabled in Bodies modal
        const isAsteroid = ['chiron','ceres','pallas','juno','vesta','eros'].includes(k);
        const enabledCheck = !isAsteroid || (enabled[k] === true);
        return k && k !== '0' && Number.isFinite(lon) && planetGlyph.hasOwnProperty(k) && enabledCheck;
      });
      
      // Compute separation offsets for natal glyphs
      const natalTargetOffsets = computeGlyphAngleOffsets(natalKeys, opts.natalLons, NATAL_MIN_SEP_DEG);
      
      // First pass: collect all positions
      const natalPositions = [];
      for (const k of natalKeys) {
        const lon = Number(opts.natalLons[k]);
        const targetOff = Number(natalTargetOffsets.get(k) || 0);
        const curOff = Number(__natalGlyphAngOffset.get(k) || 0);
        
        // Smooth transition
        const ANG_SMOOTH = 0.20;
        const ANG_DECAY = 0.35;
        const EPS = 1e-4;
        let nextOff;
        if (Math.abs(targetOff) < EPS) {
          nextOff = curOff + (0 - curOff) * ANG_DECAY;
          if (Math.abs(nextOff) < 0.001) nextOff = 0;
        } else {
          nextOff = curOff + (targetOff - curOff) * ANG_SMOOTH;
        }
        __natalGlyphAngOffset.set(k, nextOff);
        
        // Dot at TRUE longitude on ecliptic
        const aDot = ang(lon);
        const [dx, dy] = pt(rNatalEcliptic, aDot);
        
        // Glyph with offset angle
        const aGlyph = (nextOff === 0) ? aDot : ang(lon + nextOff);
        const [gx, gy] = pt(rNatalGlyph, aGlyph);
        
        // Leader line from dot to glyph
        const vx = gx - dx;
        const vy = gy - dy;
        const vLen = Math.hypot(vx, vy) || 1;
        const ux = vx / vLen;
        const uy = vy / vLen;
        
        const lx1 = dx + ux * NATAL_LEADER_GAP_DOT;
        const ly1 = dy + uy * NATAL_LEADER_GAP_DOT;
        const lx2 = gx - ux * NATAL_LEADER_GAP_GLYPH;
        const ly2 = gy - uy * NATAL_LEADER_GAP_GLYPH;
        
        natalPositions.push({ k, dx, dy, gx, gy, lx1, ly1, lx2, ly2 });
      }
      
      // Second pass: render shadow definitions first (very dark center, quick feather)
      for (const p of natalPositions) {
        natalShadowDefs += `
          <radialGradient id="shadowGrad_${p.k}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="black" stop-opacity="1"/>
            <stop offset="40%" stop-color="black" stop-opacity="0.95"/>
            <stop offset="70%" stop-color="black" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="black" stop-opacity="0"/>
          </radialGradient>`;
      }
      
      // Third pass: render circular shadow backdrops (centered on glyphs, accounting for text offset)
      const TEXT_DY_EM = 0.35;
      const fontSizePx = 22;
      const shadowYOffset = TEXT_DY_EM * fontSizePx;
      for (const p of natalPositions) {
        natalShadows += `<circle cx="${p.gx}" cy="${p.gy + shadowYOffset}" r="${SHADOW_RADIUS}" fill="url(#shadowGrad_${p.k})" />`;
      }
      
      // Third pass: render actual elements on top
      for (const p of natalPositions) {
        natalDots += `<circle cx="${p.dx}" cy="${p.dy}" r="${NATAL_DOT_R}" fill="rgba(180,140,0,1)" />`;
        natalLeaders += `<line x1="${p.lx1}" y1="${p.ly1}" x2="${p.lx2}" y2="${p.ly2}" 
          stroke="rgba(180,140,0,0.85)" stroke-width="2" stroke-linecap="round" />`;
        natalLabels += `<text x="${p.gx}" y="${p.gy}" dy="0.35em" 
          font-size="22" text-anchor="middle" dominant-baseline="middle"
          font-family="Segoe UI Symbol, Noto Sans Symbols2, DejaVu Sans, Arial Unicode MS, sans-serif"
          font-weight="400"
          fill="#B8860B" opacity="1">${planetGlyph[p.k] || "•"}</text>`;
      }
    }
// Auto-separate (glyphs only)
// Goals:
//  - Leaders are PERFECTLY RADIAL until there is a real overlap
//  - When overlap happens, offsets ease smoothly (no snapback / no 0° seam reset)
//  - Separation solved on a CIRCLE with a MOVING SEAM (prevents “0 Aries” glitch)
// ---------------------------------------------------------

// Persistent glyph angle offsets (already elsewhere in your file, but safe)
const __glyphAngOffset = (renderWheelSVG.__glyphAngOffset ||= new Map());

// px-based separation => converted to degrees using rGlyph
const GLYPH_FONT_PX = 21;         // your planet glyph font-size (reduced 30%)
const GLYPH_MIN_GAP_PX = 18;      // tweak: bigger = separates sooner
const MIN_SEP_DEG = Math.max(
  0.8,
  Math.min(8.0, ((GLYPH_FONT_PX + GLYPH_MIN_GAP_PX) / rGlyph) * (180 / Math.PI))
);

// Compute a “moving seam” opposite the cluster so nobody straddles 0°.
function computeSeamDeg(keys, lonsObj) {
  let sx = 0, sy = 0, n = 0;
  for (const k of keys) {
    const lon = Number(lonsObj?.[k]);
    if (!Number.isFinite(lon)) continue;
    const a = (lon * Math.PI) / 180;
    sx += Math.cos(a);
    sy += Math.sin(a);
    n++;
  }
  if (!n) return 0;
  const mean = (Math.atan2(sy, sx) * 180) / Math.PI; // -180..180
  const mean360 = (mean + 360) % 360;
  return (mean360 + 180) % 360; // seam opposite mean
}

// Returns Map key -> offsetDeg (small), stable across 0° Aries.
function computeGlyphAngleOffsets(keys, lonsObj, minSepDeg) {
  const seam = computeSeamDeg(keys, lonsObj);

  // normalize to [0,360) then rotate by seam so the “split” is away from the cluster
  const items = keys
    .map(k => {
      const lon0 = Number(lonsObj?.[k]);
      if (!Number.isFinite(lon0)) return null;
      const lon = ((lon0 % 360) + 360) % 360;
      const lonShift = ((lon - seam + 360) % 360); // 0..360 with seam at 0
      return { k, lon0: lon, lonShift };
    })
    .filter(Boolean)
    .sort((a, b) => (a.lonShift - b.lonShift) || a.k.localeCompare(b.k)); // stable

  const out = new Map();
  for (const it of items) out.set(it.k, 0);
  if (items.length < 2) return out;

  const offsets = new Array(items.length).fill(0);
  const ITER = 10;

  for (let iter = 0; iter < ITER; iter++) {
    // neighbors
    for (let i = 0; i < items.length - 1; i++) {
      const A = items[i].lonShift + offsets[i];
      const B = items[i + 1].lonShift + offsets[i + 1];
      const d = B - A;
      if (d < minSepDeg) {
        const push = (minSepDeg - d) / 2;
        offsets[i]     -= push;
        offsets[i + 1] += push;
      }
    }

    // wrap pair: last vs first + 360
    {
      const iL = items.length - 1;
      const A = items[iL].lonShift + offsets[iL];
      const B = (items[0].lonShift + 360) + offsets[0];
      const d = B - A;
      if (d < minSepDeg) {
        const push = (minSepDeg - d) / 2;
        offsets[iL] -= push;
        offsets[0]  += push;
      }
    }
  }

  // Clamp to prevent crazy spreads in big clusters
  for (let i = 0; i < items.length; i++) {
    let off = offsets[i];
    off = Math.max(-18, Math.min(18, off));
    out.set(items[i].k, off);
  }

  return out;
}

const targetOffsets = computeGlyphAngleOffsets(show, bodyLons, MIN_SEP_DEG);

// Smoothing:
// - if no collision, decay quickly to 0 so leaders become PERFECTLY radial again
const ANG_SMOOTH = 0.20;  // higher = faster tracking when separating
const ANG_DECAY  = 0.35;  // higher = faster snap-back to pure radial when clear
const EPS = 1e-4;

// ---- planets: dots on ecliptic + permanent leaders (NO radial stems)
let planetDots = "";
let planetLeaders = "";
let planetLabels = "";
let houseCuspLines = "";
let houseCuspLabels = "";
let eclipticTicks = "";

// Porphyry house system: trisect the 4 quadrants between the angles
// Order counterclockwise: ASC (H1) → IC (H4) → DSC (H7) → MC (H10) → ASC
function computePorphyryCusps(asc, mc) {
  const norm = (deg) => ((deg % 360) + 360) % 360;
  
  const dsc = norm(asc + 180);
  const ic  = norm(mc  + 180);

  // Calculate the 4 quadrant arcs going COUNTERCLOCKWISE
  // Quadrant 1: ASC → IC (contains houses 1, 2, 3, 4)
  const arc1 = norm(ic - asc);
  // Quadrant 2: IC → DSC (contains houses 4, 5, 6, 7)
  const arc2 = norm(dsc - ic);
  // Quadrant 3: DSC → MC (contains houses 7, 8, 9, 10)
  const arc3 = norm(mc - dsc);
  // Quadrant 4: MC → ASC (contains houses 10, 11, 12, 1)
  const arc4 = norm(asc - mc);

  // Trisect each quadrant
  const tris1 = arc1 / 3;  // for houses 2, 3
  const tris2 = arc2 / 3;  // for houses 5, 6
  const tris3 = arc3 / 3;  // for houses 8, 9
  const tris4 = arc4 / 3;  // for houses 11, 12

  return [
    asc,                                       // I   = ASC (start of quadrant 1)
    norm(asc + tris1),                         // II  = ASC + 1/3 of ASC→IC
    norm(asc + tris1 * 2),                     // III = ASC + 2/3 of ASC→IC
    ic,                                        // IV  = IC (end of quadrant 1)
    norm(ic + tris2),                          // V   = IC + 1/3 of IC→DSC
    norm(ic + tris2 * 2),                      // VI  = IC + 2/3 of IC→DSC
    dsc,                                       // VII = DSC (end of quadrant 2)
    norm(dsc + tris3),                         // VIII = DSC + 1/3 of DSC→MC
    norm(dsc + tris3 * 2),                     // IX   = DSC + 2/3 of DSC→MC
    mc,                                        // X   = MC (end of quadrant 3)
    norm(mc + tris4),                          // XI  = MC + 1/3 of MC→ASC
    norm(mc + tris4 * 2),                      // XII = MC + 2/3 of MC→ASC
  ];
}

// Whole Sign house system: each house is exactly one zodiac sign (30°),
// House 1 begins at 0° of the sign that contains the Ascendant
function computeWholeSignCusps(asc) {
  const ascNorm = ((asc % 360) + 360) % 360;
  const signIdx = Math.floor(ascNorm / 30); // 0=Aries, 11=Pisces
  // cusps[0] = 0° of sign containing ASC = House 1
  return Array.from({ length: 12 }, (_, i) => ((signIdx + i) % 12) * 30);
}

const DOT_R = 3.6;

// leader tuning (shorten here)
const LEADER_GAP_DOT   = 4;   // start offset from dot
const LEADER_GAP_GLYPH = 28;  // end offset from glyph center (increase to shorten line)

  const starNames = {
    regulus: "Regulus", aldebaran: "Aldebaran", antares: "Antares", fomalhaut: "Fomalhaut",
    sirius: "Sirius", spica: "Spica", rigel: "Rigel", algol: "Algol", deneb: "Deneb"
  };

for (const k of show) {
  const lon = Number(bodyLons?.[k]);
  if (!Number.isFinite(lon)) continue;

  // Dot always at TRUE longitude on the ecliptic
  const aTrue = ang(lon);
  const [dx, dy] = pt(rEcliptic, aTrue);
  planetDots += `<circle cx="${dx}" cy="${dy}" r="${DOT_R}" fill="rgba(255,255,255,.92)" />`;

  // Target separation (deg)
  const targetOff = Number(targetOffsets.get(k) || 0);
  const curOff = Number(__glyphAngOffset.get(k) || 0);

  let nextOff;
  if (Math.abs(targetOff) < EPS) {
    // decay back to 0 quickly -> perfect radial when no overlap
    nextOff = curOff + (0 - curOff) * ANG_DECAY;
    if (Math.abs(nextOff) < 0.001) nextOff = 0;
  } else {
    // ease toward target when overlap exists
    nextOff = curOff + (targetOff - curOff) * ANG_SMOOTH;
  }
  __glyphAngOffset.set(k, nextOff);

  // Glyph angle:
  // - true longitude when not separating
  // - adjusted longitude when separating
  const aGlyph = (nextOff === 0) ? aTrue : ang(lon + nextOff);

  // Glyph center point
  const [gx, gy] = pt(rGlyph, aGlyph);

  // Leader aims at glyph center
  const vx = gx - dx;
  const vy = gy - dy;
  const vLen = Math.hypot(vx, vy) || 1;
  const ux = vx / vLen;
  const uy = vy / vLen;

  const lx1 = dx + ux * LEADER_GAP_DOT;
  const ly1 = dy + uy * LEADER_GAP_DOT;
  const lx2 = gx - ux * LEADER_GAP_GLYPH;
  const ly2 = gy - uy * LEADER_GAP_GLYPH;

  planetLeaders += `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}"
    stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linecap="round" />`;

  const rxState = (typeof window.getRetrogradeState === 'function')
    ? window.getRetrogradeState(opts.dateUTC)
    : new Map();
  const rxSuffix = rxState.get(k) || '';

  planetLabels += `<text x="${gx}" y="${gy}" dy="0.35em"
    font-size="30" text-anchor="middle" dominant-baseline="middle"
    font-family="Segoe UI Symbol, Noto Sans Symbols2, DejaVu Sans, Arial Unicode MS, sans-serif"
    font-weight="400"
    fill="white" opacity="0.95">${planetGlyph[k] || "•"}${rxSuffix ? `<tspan font-size="14" dy="5">${rxSuffix}</tspan>` : ''}</text>`;

  // Star name label below glyph
  if (starNames[k]) {
    planetLabels += `<text x="${gx}" y="${gy + 22}" dy="0.35em"
      font-size="11" text-anchor="middle" dominant-baseline="middle"
      font-family="Segoe UI, sans-serif"
      font-weight="500"
      fill="rgba(255,215,0,0.85)"
    >${starNames[k]}</text>`;
  }
}
    // ---------------------------------------------------------
    // STAR OVERLAY PLACEMENT (locked-in tuning)
    // ---------------------------------------------------------
    const STAR_PAD = 128;   // size vs zodiac ring
    const STAR_DX  = 7;     // + right, - left
    const STAR_DY  = -8;    // + down,  - up
    const STAR_RADIUS = rOuter + STAR_PAD;

    // Compute precession delta degrees since J2000
    let precessionDeg = 0;
    if (Number.isFinite(jdUt)) {
      const years = (jdUt - PRECESS_EPOCH_JD) / 365.2422;
      precessionDeg = PRECESS_SIGN * (years * (PRECESS_ARCSEC_PER_YEAR / 3600));
    }

    // base manual rotation + precession
    const STAR_ROT = 3; // degrees (+ clockwise)

    const starOverlay = HEAVEN_DATA_URL ? `
      <g opacity="0.55" transform="rotate(${STAR_ROT + precessionDeg + baseLon} ${cx} ${cy})">
        <image href="${HEAVEN_DATA_URL}"
               x="${(cx - STAR_RADIUS) + STAR_DX}"
               y="${(cy - STAR_RADIUS) + STAR_DY}"
               width="${STAR_RADIUS * 2}"
               height="${STAR_RADIUS * 2}"
               preserveAspectRatio="xMidYMid meet" />
      </g>
    ` : "";


    // ---- House cusps (Placidus via SwissEph, or Porphyry from ASC/MC)
    // NATAL houses (inside ecliptic) and TRANSIT houses (outside ecliptic)
    houseCuspLines = "";
    houseCuspLabels = "";
    const houseSys = window.houseSystem || "whole-sign";

    if (typeof window.getHouseCusps === "function") {
      // TRANSIT houses: use main page location/time (honor navTargetDateUTC like drawAstroWheel)
      const transitLoc = window.locationData || null;
      const transitDate = (typeof timeState !== "undefined" && timeState && timeState.navTargetDateUTC instanceof Date)
        ? timeState.navTargetDateUTC
        : (typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date)
        ? timeState.dateUTC
        : new Date();
      
      const transitHouses = (transitLoc && transitLoc.lat != null && transitLoc.lon != null)
        ? (window._cachedTransitHouses && window._cachedTransitHousesKey === (
            transitLoc.lat + ':' + transitLoc.lon + ':' + Math.round(transitDate.getTime() / 30000))
          ? window._cachedTransitHouses
          : (window._cachedTransitHouses = window.getHouseCusps(transitDate, transitLoc.lat, transitLoc.lon),
             window._cachedTransitHousesKey = transitLoc.lat + ':' + transitLoc.lon + ':' + Math.round(transitDate.getTime() / 30000),
             window._cachedTransitHouses))
        : null;
      
      // NATAL houses: use natal chart location/time (only if natal is enabled)
      const natalLoc = (window.NatalChart && window.NatalChart.enabled && window.natalLocationData)
        ? window.natalLocationData
        : null;
      const natalDate = (window.NatalChart && window.NatalChart.enabled && window.NatalChart.dateUTC)
        ? window.NatalChart.dateUTC
        : null;
      
      const natalHouses = (natalLoc && natalLoc.lat != null && natalLoc.lon != null && natalDate)
        ? (window._cachedNatalHouses && window._cachedNatalHousesKey === (
            natalLoc.lat + ':' + natalLoc.lon + ':' + Math.round(natalDate.getTime() / 30000))
          ? window._cachedNatalHouses
          : (window._cachedNatalHouses = window.getHouseCusps(natalDate, natalLoc.lat, natalLoc.lon),
             window._cachedNatalHousesKey = natalLoc.lat + ':' + natalLoc.lon + ':' + Math.round(natalDate.getTime() / 30000),
             window._cachedNatalHouses))
        : null;
      
      // Helper function to draw house cusps
      function drawHouseCusps(houses, isNatal = false) {
        if (!houses || !houses.cusps || houses.cusps.length < 12 ||
            !Number.isFinite(houses.asc) || !Number.isFinite(houses.mc)) {
          return;
        }
        
        const asc = houses.asc;
        const mc = houses.mc;
        const dsc = (asc + 180) % 360;
        const ic = (mc + 180) % 360;
        
        let cusps;
        const houseSys = window.houseSystem || 'whole-sign';
        if (houseSys === "whole-sign") {
          cusps = computeWholeSignCusps(asc);
        } else {
          // Placidus, Porphyry, etc.: use SwissEph cusps directly
          const rawCusps = houses?.cusps;
          if (rawCusps && rawCusps.length === 12 && rawCusps.every(c => Number.isFinite(c) && c >= 0)) {
            cusps = rawCusps;
          } else {
            console.warn("[houses] SwissEph data invalid, falling back to Porphyry");
            cusps = computePorphyryCusps(asc, mc);
          }
        }
        
        // Store angles — transit always goes to _wheelAngles for the transits grid
        if (!isNatal) {
          window._wheelAngles = { asc, mc };
        } else if (window.NatalChart && window.NatalChart.enabled) {
          // Store natal angles separately so transit panel doesn't get overwritten
          window._natalAngles = { asc, mc };
        }
        
        // Cusp line positions: NATAL inside, TRANSIT outside
        const rCuspOuter = isNatal ? (rSignInner - 5) : (rEcliptic + 1);
        const rCuspInner = isNatal ? (rEcliptic - 1) : (rEcliptic + 15);
        
        // House number label radius: NATAL inside sign ring, TRANSIT at cusp end
        const rCuspLabel = isNatal ? (rSignInner - 25) : rCuspInner;
        
        // Cusp line color: NATAL gold, TRANSIT red
        const lineColor = isNatal ? "rgba(255,220,100,.55)" : "rgba(255,80,80,.55)";
        const labelColor = isNatal ? "rgba(255,220,100,.80)" : "rgba(255,80,80,.80)";
        
        // Angle label position: NATAL inside sign ring, TRANSIT outside
        const rAngleLabel = isNatal ? (rSignInner - 25) : (rEcliptic + 35);
        
        const _angleLons = [asc, mc, dsc, ic];
        
        for (let ci = 0; ci < 12; ci++) {
          const cuspLon = Number(cusps[ci]);
          if (!Number.isFinite(cuspLon)) continue;
          
          const a = ang(cuspLon);
          const [x1, y1] = pt(rCuspOuter, a);
          const [x2, y2] = pt(rCuspInner, a);
          houseCuspLines += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${lineColor}" stroke-width="2" stroke-linecap="round"/>`;
          
          const houseNum = ci + 1;
          const cuspNext = Number(cusps[(ci + 1) % 12]);
          const midLon = Number.isFinite(cuspNext) ? (((cuspLon + cuspNext + (cuspNext < cuspLon ? 360 : 0)) / 2) % 360) : (cuspLon + 15) % 360;
          
          const SEP_DEG = 8, SHIFT_DEG = 4;
          let shift = 0;
          for (const al of _angleLons) {
            let d = Math.abs(midLon - al) % 360;
            if (d > 180) d = 360 - d;
            if (d < SEP_DEG) {
              const delta = (al - midLon + 360) % 360;
              shift = (delta < 180) ? -SHIFT_DEG : SHIFT_DEG;
              break;
            }
          }
          const labelLon = (midLon + shift) % 360;
          const [lx, ly] = pt(rCuspLabel, ang(labelLon));
          houseCuspLabels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="${labelColor}" font-family="Segoe UI Symbol,Noto Sans Symbols2,Arial Unicode MS,sans-serif">${houseNum}</text>`;
        }
        
        // Four angle labels: ASC, MC, DSC, IC
        const angles = [
          { lon: asc,  label: "AC" },
          { lon: mc,   label: "MC" },
          { lon: dsc,  label: "DC" },
          { lon: ic,   label: "IC" }
        ];
        const angleColor = isNatal ? "rgba(255,210,80,.90)" : "rgba(255,100,100,.90)";
        for (const a of angles) {
          const [ex, ey] = pt(rEcliptic, ang(a.lon));  // point ON ecliptic
          const [px, py] = pt(rAngleLabel, ang(a.lon)); // label position
          const lon = a.lon % 360;
          const isLeftSide = lon > 90 && lon < 270;
          const anchor = isLeftSide ? "end" : "start";
          // Leader line from ecliptic outward toward label
          houseCuspLabels += `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"
            stroke="${angleColor}" stroke-width="1" stroke-linecap="round" stroke-opacity="0.6"/>`;
          houseCuspLabels += `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}"
            font-size="11" text-anchor="${anchor}" dominant-baseline="middle"
            fill="${angleColor}"
            font-family="Segoe UI Symbol,Noto Sans Symbols2,Arial Unicode MS,sans-serif"
            font-weight="600"
            letter-spacing="0.04em">${a.label}</text>`;
        }
      }
      
      // Draw TRANSIT houses first (outside), then NATAL houses (inside)
      if (window.housesVisible !== false) drawHouseCusps(transitHouses, false);
      if (natalHouses && window.NatalChart && window.NatalChart.enabled) {
        drawHouseCusps(natalHouses, true);
      }
    }

    // ---- Degree ticks on the ecliptic
    eclipticTicks = "";
    {
      const rEcl = rStemOuter2;            // ecliptic radius (canvas coords)
      const rTick1  = rEcl - 5;  // every degree
      const rTick5  = rEcl - 8;  // every 5 degrees
      const rTick10 = rEcl - 12; // every 10 degrees
      for (let deg = 0; deg < 360; deg++) {
        const a = ang(deg);
        let rInner;
        if (deg % 10 === 0)      rInner = rTick10;
        else if (deg % 5 === 0)   rInner = rTick5;
        else                      rInner = rTick1;
        const [x1, y1] = pt(rEcl, a);
        const [x2, y2] = pt(rInner, a);
        const sw = (deg % 10 === 0) ? 1.2 : (deg % 5 === 0) ? 0.9 : 0.5;
        const op = (deg % 10 === 0) ? 0.60 : (deg % 5 === 0) ? 0.40 : 0.22;
        eclipticTicks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,${op})" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs>
          ${natalShadowDefs}
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0)"/>
        ${starOverlay}
        ${wedges}
        <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${rSignInner}" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.20)" stroke-width="2"/>
        ${signText}
        ${natalShadows}
        ${natalLeaders}
        ${natalLabels}
        ${natalDots}
        ${aspectLines}
        ${aspectTicks}
        ${planetDots}
        ${planetLeaders}
        ${planetLabels}
        ${cycleChords}
        <circle cx="${cx}" cy="${cy}" r="${rEcliptic}" fill="none" stroke="rgba(255,255,255,.30)" stroke-width="2"/>
        ${houseCuspLines}
        ${houseCuspLabels}
        ${eclipticTicks}
      </svg>
    `;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  // =========================================================
  // PUBLIC: drawAstroWheel() (called from ui-controller.js)
  // =========================================================
  function drawAstroWheel() {
    if (!wheelImg) return;

    // Use current time when in live mode, otherwise use timeState/AstroEngine
    // If navTargetDateUTC is set (user clicked GO), use that for immediate feedback
    const t = isLiveMode 
      ? new Date()
      : (typeof timeState !== "undefined" && timeState && timeState.navTargetDateUTC instanceof Date) ? timeState.navTargetDateUTC :
        (typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date) ? timeState.dateUTC :
        (window.AstroEngine && window.AstroEngine.dateUTC instanceof Date) ? window.AstroEngine.dateUTC :
        (window.AstroEngine && window.AstroEngine.dateUTC) ? new Date(window.AstroEngine.dateUTC) :
        new Date();

    // live logging removed for debug silence

    const lons = (typeof window.getPlanetLongitudes === "function")
      ? window.getPlanetLongitudes(t)
      : null;

    // Merge fixed star longitudes into the same object
    const starLons = (typeof window.getFixedStarLongitudes === "function")
      ? window.getFixedStarLongitudes(t)
      : {};
    if (lons) {
      Object.assign(lons, starLons);
    }

    if (!lons) return;

    // Build list of enabled planets from toggle state
    const keys = [];
    const enabled = window.enabledPlanets || {};
    
    // Core planets
    if (enabled.sun !== false) keys.push("sun");
    if (enabled.moon !== false) keys.push("moon");
    if (enabled.mercury !== false) keys.push("mercury");
    if (enabled.venus !== false) keys.push("venus");
    if (enabled.mars !== false) keys.push("mars");
    if (enabled.jupiter !== false) keys.push("jupiter");
    if (enabled.saturn !== false) keys.push("saturn");
    if (enabled.uranus !== false) keys.push("uranus");
    if (enabled.neptune !== false) keys.push("neptune");
    if (enabled.pluto !== false) keys.push("pluto");
    
    // Nodes
    if (enabled.northNode !== false && Number.isFinite(Number(lons.northNode))) keys.push("northNode");
    if (enabled.southNode !== false && Number.isFinite(Number(lons.southNode))) keys.push("southNode");
    
    // Asteroids (only if explicitly enabled)
    if (enabled.chiron && Number.isFinite(Number(lons.chiron))) keys.push("chiron");
    if (enabled.ceres && Number.isFinite(Number(lons.ceres))) keys.push("ceres");
    if (enabled.pallas && Number.isFinite(Number(lons.pallas))) keys.push("pallas");
    if (enabled.juno && Number.isFinite(Number(lons.juno))) keys.push("juno");
    if (enabled.vesta && Number.isFinite(Number(lons.vesta))) keys.push("vesta");
    if (enabled.eros && Number.isFinite(Number(lons.eros))) keys.push("eros");

    // Fixed stars (only if explicitly enabled)
    if (enabled.regulus && Number.isFinite(Number(lons.regulus))) keys.push("regulus");
    if (enabled.aldebaran && Number.isFinite(Number(lons.aldebaran))) keys.push("aldebaran");
    if (enabled.antares && Number.isFinite(Number(lons.antares))) keys.push("antares");
    if (enabled.fomalhaut && Number.isFinite(Number(lons.fomalhaut))) keys.push("fomalhaut");
    if (enabled.sirius && Number.isFinite(Number(lons.sirius))) keys.push("sirius");
    if (enabled.spica && Number.isFinite(Number(lons.spica))) keys.push("spica");
    if (enabled.rigel && Number.isFinite(Number(lons.rigel))) keys.push("rigel");
    if (enabled.algol && Number.isFinite(Number(lons.algol))) keys.push("algol");
    if (enabled.deneb && Number.isFinite(Number(lons.deneb))) keys.push("deneb");

    const natalLons = (window.NatalChart && window.NatalChart.longitudes) ? window.NatalChart.longitudes : null;
    const url = renderWheelSVG(lons, { baseLon: 0, showKeys: keys, natalLons, dateUTC: t })
    // Free previous decoded SVG bitmap before assigning new one — prevents
    // cumulative memory growth from back-to-back data URL allocations
    wheelImg.src = "";
    wheelImg.src = url;

    // Update date/time overlay at top of wheel
    const wheelDateValue = document.getElementById("wheelDateValue");
    if (wheelDateValue) {
      const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      
      // t is UTC. Convert to location timezone (city from main input, or browser local if none).
      const locTz = window.locationData?.tz;
            const tz = locTz || undefined; // undefined = browser local timezone
      
      // Build date parts in the target timezone so we get correct local wall-clock values
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short", year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false
      }).formatToParts(t);
      const g = (t) => parts.find(p => p.type === t)?.value ?? "";
      
      const weekday = g("weekday").toUpperCase();
      const day = g("day").replace(/^0/, "");
      const month = g("month").toUpperCase();
      const year = g("year");
      
      let hours = parseInt(g("hour"), 10);
      const minutes = g("minute");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const displayHour = String(hours).padStart(2, "0");
      
      // Timezone label: IANA name if city set, else browser local abbreviation
      let shortTz;
      if (locTz) {
        // Get proper timezone abbreviation (e.g. HST, EST, PST)
        const tzParts = new Intl.DateTimeFormat("en-US", { timeZone: locTz, timeZoneName: "short" })
          .formatToParts(t);
        shortTz = tzParts.find(p => p.type === "timeZoneName")?.value ?? locTz.split("/").pop().replace("_", " ");
      } else {
        const parts2 = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
          .formatToParts(t);
        shortTz = parts2.find(p => p.type === "timeZoneName")?.value ?? "";
      }
      wheelDateValue.textContent = `${weekday}, ${day} ${month} ${year}, ${displayHour}:${minutes} ${ampm} ${shortTz}`;
    }

    // ---- Frame-by-frame cycle tracking — watch the tracked planet on every draw ---
    const cm = window.cycleMode;
    const cp = window.cyclePlanet;
    if (cm && cp && lons && Number.isFinite(Number(lons[cp]))) {
      if (!window.cycleTrackState || !window.cycleTrackState.active) {
        window.cycleTrackState = {
          pins: [],
          prevLon: Number(lons[cp]),
          prevSign: null,
          prevSunDiffSign: null,
          active: true,
          cycleMode: cm,
          cyclePlanet: cp,
          startTime: t.getTime()
        };
      }
      const ts = window.cycleTrackState;
      const curLon = Number(lons[cp]);
      const sunLon = Number(lons.sun);

      if (cm === 'retrograde' || cm === 'both') {
        if (ts.prevLon != null) {
          let dLon = curLon - ts.prevLon;
          while (dLon > 180) dLon -= 360;
          while (dLon < -180) dLon += 360;
          const sign = dLon > 0.001 ? 1 : (dLon < -0.001 ? -1 : 0);
          if (ts.prevSign !== null && sign !== 0 && ts.prevSign !== sign) {
            ts.pins.push({ lon: curLon, type: sign === -1 ? 'retrograde_station' : 'direct_station', time: t.getTime() });
          }
          if (sign !== 0) ts.prevSign = sign;
        }
        ts.prevLon = curLon;
      } else {
        // Track motion sign for synodic-only mode (needed by conjunction gating)
        if (ts.prevLon != null) {
          let dLon = curLon - ts.prevLon;
          while (dLon > 180) dLon -= 360;
          while (dLon < -180) dLon += 360;
          const sign = dLon > 0.001 ? 1 : (dLon < -0.001 ? -1 : 0);
          if (sign !== 0) ts.prevSign = sign;
        }
        ts.prevLon = curLon;
      }

      if (cm === 'synodic' || cm === 'both') {
        if (Number.isFinite(sunLon)) {
          let diff = curLon - sunLon;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          const isInner = ['mercury','venus'].includes(cp);
          const target = isInner ? 0 : 180;
          let dist = diff - target;
          while (dist > 180) dist -= 360;
          while (dist < -180) dist += 360;
          const distSign = dist > 0.001 ? 1 : (dist < -0.001 ? -1 : 0);
          if (ts.prevSunDiffSign !== null && distSign !== 0 && ts.prevSunDiffSign !== distSign) {
            // Only fire for inner planets when in prograde (direct) motion
            const isPrograde = ts.prevSign === null || ts.prevSign > 0;
            if (!isInner || isPrograde) {
              ts.pins.push({ lon: curLon, type: isInner ? 'conjunction' : 'opposition', time: t.getTime() });
            }
          }
          if (distSign !== 0) ts.prevSunDiffSign = distSign;
        }
      }

      window.cycleTrackState = ts;
    } else if (!cp || !cm) {
      window.cycleTrackState = null;
    }

    // Calculate and populate aspects grid overlay
    populateAspectsOverlay(lons, natalLons);

    // Ruler grid: hour + day planetary rulers
    const rulerDate = rulerShowNatal && window.NatalChart && window.NatalChart.enabled ? window.NatalChart.dateUTC : t;
    populateRulerGrid(rulerDate, rulerShowNatal);
  }

  // Calculate aspects and populate wheel overlay (bottom left)
  function populateAspectsOverlay(transitLons, natalLons) {
    const aspectsGrid = document.getElementById("wheelAspectsGrid");
    if (!aspectsGrid) return;

    const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "pluto"];
    const glyphs = ["☉", "☽", "☿", "♀", "♂", "♃", "♄", "♅", "♇"];

    const aspectDefs = [
      { symbol: "☌", angle: 0, orb: 6, name: "conj" },
      { symbol: "☍", angle: 180, orb: 6, name: "oppo" },
      { symbol: "△", angle: 120, orb: 5, name: "trine" },
      { symbol: "□", angle: 90, orb: 5, name: "square" },
      { symbol: "⚹", angle: 60, orb: 4, name: "sextile" }
    ];

    function angleDiff(a, b) {
      let d = Math.abs(a - b) % 360;
      if (d > 180) d = 360 - d;
      return d;
    }

    function findAspect(lon1, lon2) {
      if (!Number.isFinite(lon1) || !Number.isFinite(lon2)) return null;
      const diff = angleDiff(lon1, lon2);
      for (const asp of aspectDefs) {
        if (Math.abs(diff - asp.angle) <= asp.orb) {
          return asp;
        }
      }
      return null;
    }

    // Build stepped triangle with glyphs on right side
    let html = '';
    
    // Build from top (Sun) to bottom (Pluto)
    // Row 0: just glyph (Sun)
    html += '<div class="aspect-step-row">';
    html += `<div class="aspect-step-glyph">${glyphs[0]}</div>`;
    html += '</div>';
    
    // Rows 1-8: aspect cells + glyph at end
    for (let row = 1; row < planets.length; row++) {
      html += '<div class="aspect-step-row">';
      
      // Aspect cells (comparing to all planets above)
      for (let col = 0; col < row; col++) {
        const rowPlanet = planets[row];
        const colPlanet = planets[col];
        const rowLon = transitLons[rowPlanet];
        const colLon = transitLons[colPlanet];
        
        const asp = findAspect(rowLon, colLon);
        if (asp) {
          html += `<div class="aspect-step-cell ${asp.name}" title="${glyphs[row]} ${asp.symbol} ${glyphs[col]}">${asp.symbol}</div>`;
        } else {
          html += '<div class="aspect-step-cell empty"></div>';
        }
      }
      
      // Glyph on the right
      html += `<div class="aspect-step-glyph">${glyphs[row]}</div>`;
      html += '</div>';
    }
    
    aspectsGrid.innerHTML = html;

    // Populate elemental box with current transit positions
    populateElementalBox(transitLons, elemShowNatal);

    // Populate transits grid
    populateTransitsGrid(transitLons, natalLons);

    // Populate natal grid (only visible when natal is set)
    populateNatalGrid(natalLons);
    
    // Populate Hermetic Lots grid
    const natalAngles = window.NatalChart && window.NatalChart.enabled ? window.NatalChart.angles : null;
    const natalLonsForLots = window.NatalChart && window.NatalChart.enabled ? window.NatalChart.longitudes : null;
    populateLotsGrid(natalLonsForLots, natalAngles, lotsShowNatal);
    
    // Populate Lunar Phases grid
    populateLunarPhasesGrid(lunarShowNatal);

    // Populate HUD positions grid with element-colored sign glyphs
    populateHUDPositionsGrid(transitLons, natalLons);

  }

  // Show current transit positions in a grid
  function populateTransitsGrid(transitLons, natalLons) {
    const grid = document.getElementById("wheelTransitsGrid");
    if (!grid || !transitLons) return;

    const enabled = window.enabledPlanets || {};

    const allPlanets = [
      { id: "sun", glyph: "☉" },
      { id: "moon", glyph: "☽" },
      { id: "mercury", glyph: "☿" },
      { id: "venus", glyph: "♀" },
      { id: "mars", glyph: "♂" },
      { id: "jupiter", glyph: "♃" },
      { id: "saturn", glyph: "♄" },
      { id: "uranus", glyph: "♅" },
      { id: "neptune", glyph: "♆" },
      { id: "pluto", glyph: "♇" },
      { id: "northNode", glyph: "☊" },
      { id: "chiron", glyph: "⚷", asteroid: true },
      { id: "ceres", glyph: "⚳", asteroid: true },
      { id: "pallas", glyph: "⚴", asteroid: true },
      { id: "juno", glyph: "⚵", asteroid: true },
      { id: "vesta", glyph: "⚶", asteroid: true },
      { id: "eros", glyph: "♡", asteroid: true },
    ];

    const planets = allPlanets.filter(p => {
      if (p.asteroid) return enabled[p.id] === true;
      return true;
    });

    const signGlyphs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
    const signElements = ["fire", "earth", "air", "water", "fire", "earth", "air", "water", "fire", "earth", "air", "water"];
    const elementColors = {
      fire: '#ff6b35',
      earth: '#4ecdc4',
      air: '#ffe66d',
      water: '#6a82fb'
    };

    let html = '';

    for (const p of planets) {
      const lon = transitLons[p.id];
      if (!Number.isFinite(lon)) continue;

      const signIndex = Math.floor(lon / 30);
      const sign = signGlyphs[signIndex];
      const elem = signElements[signIndex];
      const deg = Math.floor(lon % 30);
      const min = Math.floor((lon % 30 - deg) * 60);

      const elemColor = elementColors[elem] || '#fff';

      html += `
        <div class="transit-row">
          <span class="transit-planet">${p.glyph}</span>
          <span class="transit-sign transit-${elem}">${sign}</span>
          <span class="transit-degree">${deg}°${min.toString().padStart(2, '0')}</span>
        </div>
      `;
    }

    // Add AC/MC at the bottom (show even if angles not yet available)
    const angles = window._wheelAngles;
    if (angles && Number.isFinite(angles.asc)) {
      const ascSign = signGlyphs[Math.floor(angles.asc / 30)];
      const ascElem = signElements[Math.floor(angles.asc / 30)];
      const ascDeg = Math.floor(angles.asc % 30);
      const ascMin = Math.floor((angles.asc % 30 - ascDeg) * 60);
      html += `
        <div class="transit-row">
          <span class="transit-planet ac-mc-text">AC</span>
          <span class="transit-sign transit-${ascElem}">${ascSign}</span>
          <span class="transit-degree">${ascDeg}°${ascMin.toString().padStart(2, '0')}</span>
        </div>
      `;
    } else {
      // Placeholder until angles are available
      html += `
        <div class="transit-row">
          <span class="transit-planet ac-mc-text">AC</span>
          <span class="transit-sign">—</span>
          <span class="transit-degree">—°——</span>
        </div>
      `;
    }
    if (angles && Number.isFinite(angles.mc)) {
      const mcSign = signGlyphs[Math.floor(angles.mc / 30)];
      const mcElem = signElements[Math.floor(angles.mc / 30)];
      const mcDeg = Math.floor(angles.mc % 30);
      const mcMin = Math.floor((angles.mc % 30 - mcDeg) * 60);
      html += `
        <div class="transit-row">
          <span class="transit-planet ac-mc-text">MC</span>
          <span class="transit-sign transit-${mcElem}">${mcSign}</span>
          <span class="transit-degree">${mcDeg}°${mcMin.toString().padStart(2, '0')}</span>
        </div>
      `;
    } else {
      // Placeholder until angles are available
      html += `
        <div class="transit-row">
          <span class="transit-planet ac-mc-text">MC</span>
          <span class="transit-sign">—</span>
          <span class="transit-degree">—°——</span>
        </div>
      `;
    }

    grid.innerHTML = html;
  }


  // Show natal planet positions (when natal chart is set)
  function populateNatalGrid(natalLons) {
    const overlay = document.getElementById("wheelNatalOverlay");
    const grid = document.getElementById("wheelNatalGrid");
    if (!grid) return;

    // Grid is always visible; content depends on enabled state
    const isEnabled = window.NatalChart && window.NatalChart.enabled;

    const enabled = window.enabledPlanets || {};

    const allPlanets = [
      { id: "sun", glyph: "☉" },
      { id: "moon", glyph: "☽" },
      { id: "mercury", glyph: "☿" },
      { id: "venus", glyph: "♀" },
      { id: "mars", glyph: "♂" },
      { id: "jupiter", glyph: "♃" },
      { id: "saturn", glyph: "♄" },
      { id: "uranus", glyph: "♅" },
      { id: "neptune", glyph: "♆" },
      { id: "pluto", glyph: "♇" },
      { id: "northNode", glyph: "☊" },
      { id: "chiron", glyph: "⚷", asteroid: true },
      { id: "ceres", glyph: "⚳", asteroid: true },
      { id: "pallas", glyph: "⚴", asteroid: true },
      { id: "juno", glyph: "⚵", asteroid: true },
      { id: "vesta", glyph: "⚶", asteroid: true },
      { id: "eros", glyph: "♡", asteroid: true },
    ];

    const planets = allPlanets.filter(p => {
      if (p.asteroid) return enabled[p.id] === true;
      return true;
    });

    const signGlyphs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
    const signElements = ["fire", "earth", "air", "water", "fire", "earth", "air", "water", "fire", "earth", "air", "water"];

    let html = '';

    for (const p of planets) {
      const lon = natalLons ? natalLons[p.id] : null;

      if (isEnabled && Number.isFinite(lon)) {
        // Full row: glyph + sign + degree
        const signIndex = Math.floor(lon / 30);
        const sign = signGlyphs[signIndex];
        const elem = signElements[signIndex];
        const deg = Math.floor(lon % 30);
        const min = Math.floor((lon % 30 - deg) * 60);
        html += `
          <div class="natal-row">
            <span class="natal-planet">${p.glyph}</span>
            <span class="natal-sign natal-${elem}">${sign}</span>
            <span class="natal-degree">${deg}°${min.toString().padStart(2, '0')}</span>
          </div>
        `;
      } else {
        // Disabled: render placeholder sign + degree to keep grid same size as transits
        html += `
          <div class="natal-row">
            <span class="natal-planet">${p.glyph}</span>
            <span class="natal-sign natal-placeholder">—</span>
            <span class="natal-degree">—°—</span>
          </div>
        `;
      }
    }

    // Add natal AC/MC at the bottom (always show, with placeholders until angles available)
    const angles = isEnabled && window.NatalChart && window.NatalChart.angles;
    
    if (angles && Number.isFinite(angles.asc)) {
      const ascSign = signGlyphs[Math.floor(angles.asc / 30)];
      const ascElem = signElements[Math.floor(angles.asc / 30)];
      const ascDeg = Math.floor(angles.asc % 30);
      const ascMin = Math.floor((angles.asc % 30 - ascDeg) * 60);
      html += `
        <div class="natal-row">
          <span class="natal-planet ac-mc-text">AC</span>
          <span class="natal-sign natal-${ascElem}">${ascSign}</span>
          <span class="natal-degree">${ascDeg}°${ascMin.toString().padStart(2, '0')}</span>
        </div>
      `;
    } else {
      // Placeholder until angles are available
      html += `
        <div class="natal-row">
          <span class="natal-planet ac-mc-text">AC</span>
          <span class="natal-sign">—</span>
          <span class="natal-degree">—°——</span>
        </div>
      `;
    }
    if (angles && Number.isFinite(angles.mc)) {
      const mcSign = signGlyphs[Math.floor(angles.mc / 30)];
      const mcElem = signElements[Math.floor(angles.mc / 30)];
      const mcDeg = Math.floor(angles.mc % 30);
      const mcMin = Math.floor((angles.mc % 30 - mcDeg) * 60);
      html += `
        <div class="natal-row">
          <span class="natal-planet ac-mc-text">MC</span>
          <span class="natal-sign natal-${mcElem}">${mcSign}</span>
          <span class="natal-degree">${mcDeg}°${mcMin.toString().padStart(2, '0')}</span>
        </div>
      `;
    } else {
      // Placeholder until angles are available
      html += `
        <div class="natal-row">
          <span class="natal-planet ac-mc-text">MC</span>
          <span class="natal-sign">—</span>
          <span class="natal-degree">—°——</span>
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  // Calculate Hermetic Lots (Arabic Parts)
  function calculateHermeticLots(dateUTC, asc, mc, sunLon, moonLon, mercuryLon, venusLon, marsLon, jupiterLon, saturnLon) {
    const norm = (deg) => ((deg % 360) + 360) % 360;
    
    // Determine if day or night birth (Sun above or below horizon)
    // Day: Sun in 7th-12th houses (above horizon, from DSC to ASC counterclockwise)
    // Night: Sun in 1st-6th houses (below horizon, from ASC to DSC)
    const isDayBirth = (() => {
      const dsc = norm(asc + 180);
      const sunDistFromAsc = norm(sunLon - asc);
      // Sun between ASC and DSC (0-180° from ASC) = below horizon = NIGHT
      // Sun between DSC and ASC (180-360° from ASC) = above horizon = DAY
      return sunDistFromAsc > 180;
    })();

    // Standard Hermetic lot formulas (Valens, Whole Sign House system)
    const lots = {};
    
    // Part of Fortune: ASC + Moon - Sun (reverse for night)
    lots.fortune = isDayBirth 
      ? norm(asc + moonLon - sunLon)
      : norm(asc + sunLon - moonLon);
    
    // Part of Spirit: ASC + Sun - Moon (reverse for night)
    lots.spirit = isDayBirth
      ? norm(asc + sunLon - moonLon)
      : norm(asc + moonLon - sunLon);
    
    // Part of Exaltation: ASC + 19° Taurus - Sun
    lots.exaltation = norm(asc + 49 - sunLon);
    
    // Part of Necessity: ASC + Spirit - Fortune
    lots.necessity = norm(asc + lots.spirit - lots.fortune);
    
    // Part of Eros: ASC + Venus - Spirit
    lots.eros = venusLon != null ? norm(asc + venusLon - lots.spirit) : null;
    
    // Part of Courage: ASC + Mars - Spirit
    lots.courage = marsLon != null ? norm(asc + marsLon - lots.spirit) : null;
    
    // Part of Victory: ASC + Jupiter - Spirit  
    lots.victory = jupiterLon != null ? norm(asc + jupiterLon - lots.spirit) : null;
    
    // Part of Nemesis: ASC + Fortune - Saturn
    lots.nemesis = saturnLon != null ? norm(asc + lots.fortune - saturnLon) : null;
    
    return lots;
  }

  // Calculate nearest lunar phases (2 before, current/next, 2 after) - ONE COMPLETE CYCLE
  function calculateLunarPhases(referenceDate, phaseType = 'transit') {
    const phaseNames = ['New', '1st Q', 'Full', '3rd Q'];
    const phaseSymbols = ['☌', '□', '☍', '□']; // aspect to Sun
    
    // Synodic month: ~29.53 days
    const SYNODIC_MONTH = 29.53058867 * 24 * 60 * 60 * 1000; // ms
    
    // Get current Moon and Sun positions
    const refDate = referenceDate instanceof Date ? referenceDate : new Date();
    let sunLon, moonLon;
    
    if (phaseType === 'natal' && window.NatalChart && window.NatalChart.enabled) {
      const natalLons = window.getPlanetLongitudes(window.NatalChart.dateUTC);
      sunLon = natalLons?.sun;
      moonLon = natalLons?.moon;
    } else {
      const transitDate = (typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date) 
        ? timeState.dateUTC 
        : new Date();
      const transitLons = window.getPlanetLongitudes(transitDate);
      sunLon = transitLons?.sun;
      moonLon = transitLons?.moon;
    }
    
    if (sunLon == null || moonLon == null) return null;
    
    // Calculate current phase angle (Moon - Sun)
    const phaseAngle = (moonLon - sunLon + 360) % 360;
    
    // Calculate exact phase times by finding when Moon-Sun angle = 0, 90, 180, 270
    // Use simple linear approximation (good enough for display)
    const moonSpeed = 13.176; // degrees per day
    const sunSpeed = 0.9856; // degrees per day
    const relativeSpeed = moonSpeed - sunSpeed; // ~12.19 deg/day
    
    // Find the most recent New Moon as reference
    const daysSinceNew = phaseAngle / relativeSpeed;
    const lastNewMoon = new Date(refDate.getTime() - daysSinceNew * 24 * 60 * 60 * 1000);
    
    // Generate all phases for current cycle and next cycle (8 phases total)
    const allPhases = [];
    for (let cycle = 0; cycle <= 1; cycle++) {
      const baseNewMoon = new Date(lastNewMoon.getTime() + cycle * SYNODIC_MONTH);
      
      // Add all 4 phases for this cycle
      for (let phaseIdx = 0; phaseIdx < 4; phaseIdx++) {
        const daysFromNew = (phaseIdx * 90) / relativeSpeed;
        const phaseDate = new Date(baseNewMoon.getTime() + daysFromNew * 24 * 60 * 60 * 1000);
        
        // Get Moon position at phase time
        const moonAtPhase = (moonLon + moonSpeed * ((phaseDate - refDate) / (24*60*60*1000))) % 360;
        
        allPhases.push({
          phaseIdx: phaseIdx,
          name: phaseNames[phaseIdx],
          symbol: phaseSymbols[phaseIdx],
          date: phaseDate,
          moonLon: ((moonAtPhase % 360) + 360) % 360
        });
      }
    }
    
    // Sort by date
    allPhases.sort((a, b) => a.date - b.date);
    
    // Find the first phase that is >= reference date
    let currentIndex = 0;
    for (let i = 0; i < allPhases.length; i++) {
      if (allPhases[i].date >= refDate) {
        currentIndex = i;
        break;
      }
      if (i === allPhases.length - 1) {
        // All phases are in the past, start from last one
        currentIndex = allPhases.length - 1;
      }
    }
    
    // Return 5 phases: 2 before current, current, 2 after
    // But ensure we start from a phase that makes sense (don't skip around)
    const startIndex = Math.max(0, currentIndex - 2);
    return allPhases.slice(startIndex, startIndex + 5);
  }

  // Display Lunar Phases grid
  function populateLunarPhasesGrid(showNatal = false) {
    const grid = document.getElementById("wheelLunarPhasesGrid");
    if (!grid) return;
    
    const signGlyphs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
    const signElements = ["fire", "earth", "air", "water", "fire", "earth", "air", "water", "fire", "earth", "air", "water"];
    
    const refDate = showNatal && window.NatalChart && window.NatalChart.enabled
      ? window.NatalChart.dateUTC
      : (typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date)
        ? timeState.dateUTC
        : new Date();
    
    const phases = calculateLunarPhases(refDate, showNatal ? 'natal' : 'transit');
    
    if (!phases) {
      grid.innerHTML = '<div class="lunar-phase-row"><span class="lunar-phase-name">No data</span></div>';
      return;
    }
    
    let html = '';
    for (const phase of phases) {
      const dateStr = phase.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = phase.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      
      const moonLonNorm = ((phase.moonLon % 360) + 360) % 360; // Ensure 0-360
      const signIndex = Math.floor(moonLonNorm / 30);
      const sign = signGlyphs[signIndex] || '?';
      const elem = signElements[signIndex] || 'fire';
      const deg = Math.floor(moonLonNorm % 30);
      const min = Math.floor(((moonLonNorm % 30) - deg) * 60);
      
      html += `<div class="lunar-phase-row">`;
      html += `<span class="lunar-phase-name">${phase.name}</span>`;
      html += `<span class="lunar-phase-date">${dateStr}</span>`;
      html += `<span class="lunar-phase-time">${timeStr}</span>`;
      html += `<span class="lunar-phase-position lunar-${elem}"><span class="sign-glyph">${sign}</span></span><span class="lunar-phase-degree">${deg}°${min.toString().padStart(2, '0')}</span>`;
      html += `</div>`;
    }
    
    grid.innerHTML = html;
  }

  // Display Hermetic Lots grid
  function populateLotsGrid(natalLons, natalAngles, showNatal = true) {
    const grid = document.getElementById("wheelLotsGrid");
    if (!grid) return;
    
    const signGlyphs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
    const signElements = ["fire", "earth", "air", "water", "fire", "earth", "air", "water", "fire", "earth", "air", "water"];
    
    const lotNames = {
      fortune: "Fortune",
      spirit: "Spirit",
      exaltation: "Exaltation",
      necessity: "Necessity",
      eros: "Eros",
      courage: "Courage",
      victory: "Victory",
      nemesis: "Nemesis"
    };
    
    let html = '';
    
    // Get angles and planetary positions based on mode
    let asc, sunLon, moonLon, mercuryLon, venusLon, marsLon, jupiterLon, saturnLon;
    if (showNatal && natalAngles && natalLons) {
      // Natal mode with data available
      asc = natalAngles.asc;
      sunLon = natalLons.sun;
      moonLon = natalLons.moon;
      mercuryLon = natalLons.mercury;
      venusLon = natalLons.venus;
      marsLon = natalLons.mars;
      jupiterLon = natalLons.jupiter;
      saturnLon = natalLons.saturn;
    } else if (showNatal) {
      // Natal mode but no natal data set - show empty placeholders
      asc = null;
      sunLon = null;
      moonLon = null;
    } else if (window._wheelAngles && window.getPlanetLongitudes) {
      // Transit mode - use current transit positions from timeline time
      asc = window._wheelAngles.asc;
      const transitDate = (typeof timeState !== "undefined" && timeState && timeState.navTargetDateUTC instanceof Date)
        ? timeState.navTargetDateUTC
        : (typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date) 
        ? timeState.dateUTC 
        : (window.AstroEngine && window.AstroEngine.dateUTC instanceof Date)
          ? window.AstroEngine.dateUTC
          : new Date();
      const transitLons = window.getPlanetLongitudes(transitDate);
      sunLon = transitLons?.sun;
      moonLon = transitLons?.moon;
      mercuryLon = transitLons?.mercury;
      venusLon = transitLons?.venus;
      marsLon = transitLons?.mars;
      jupiterLon = transitLons?.jupiter;
      saturnLon = transitLons?.saturn;
    }
    
    // Calculate lots if we have the required data
    let lots = null;
    if (asc != null && sunLon != null && moonLon != null) {
      lots = calculateHermeticLots(new Date(), asc, 0, sunLon, moonLon, mercuryLon, venusLon, marsLon, jupiterLon, saturnLon);
    }
    
    // Build grid rows
    for (const [key, name] of Object.entries(lotNames)) {
      html += `<div class="lots-row">`;
      html += `<span class="lots-name">${name}</span>`;
      
      if (lots && Number.isFinite(lots[key])) {
        const lon = lots[key];
        const signIndex = Math.floor(lon / 30);
        const sign = signGlyphs[signIndex];
        const elem = signElements[signIndex];
        const deg = Math.floor(lon % 30);
        const min = Math.floor((lon % 30 - deg) * 60);
        
        html += `<span class="lots-sign lots-${elem}">${sign}</span>`;
        html += `<span class="lots-degree">${deg}°${min.toString().padStart(2, '0')}</span>`;
        
        // Calculate house (simplified: based on whole sign from ASC)
        let houseNum = '';
        if (asc != null && Number.isFinite(asc)) {
          const ascSign = Math.floor(asc / 30);
          const lotSign = signIndex;
          houseNum = ((lotSign - ascSign + 12) % 12) + 1;
        }
        html += `<span class="lots-house">${houseNum || '—'}</span>`;
      } else {
        html += `<span class="lots-sign">—</span>`;
        html += `<span class="lots-degree">—°——</span>`;
        html += `<span class="lots-house">—</span>`;
      }
      
      html += `</div>`;
    }
    
    grid.innerHTML = html;
  }

  // Show where planets are currently located (transit positions)
  function populateElementalBox(transitLons, showNatal = false) {
    const grid = document.getElementById("wheelElementalGrid");
    if (!grid) return;
    
    // Get planet positions based on mode
    let lons = transitLons;
    if (showNatal && window.NatalChart && window.NatalChart.enabled) {
      lons = window.NatalChart.longitudes;
    }
    
    if (!lons) return;
    
    // Get enabled planets filter
    const enabled = window.enabledPlanets || {};

    // Planet glyphs
    const planetGlyphs = {
      sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
      jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
      chiron: "⚷", ceres: "⚳", pallas: "⚴", juno: "⚵", vesta: "⚶"
    };

    // Sign -> Element + Quality
    const signQualities = {
      "Aries": { elem: "Fire", qual: "Cardinal" },
      "Taurus": { elem: "Earth", qual: "Fixed" },
      "Gemini": { elem: "Air", qual: "Mutable" },
      "Cancer": { elem: "Water", qual: "Cardinal" },
      "Leo": { elem: "Fire", qual: "Fixed" },
      "Virgo": { elem: "Earth", qual: "Mutable" },
      "Libra": { elem: "Air", qual: "Cardinal" },
      "Scorpio": { elem: "Water", qual: "Fixed" },
      "Sagittarius": { elem: "Fire", qual: "Mutable" },
      "Capricorn": { elem: "Earth", qual: "Cardinal" },
      "Aquarius": { elem: "Air", qual: "Fixed" },
      "Pisces": { elem: "Water", qual: "Mutable" }
    };

    // Get sign from longitude
    function getSign(lon) {
      const signs = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
                       "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
      return signs[Math.floor(lon / 30)];
    }

    // Group planets by element/quality
    const gridData = {};
    const elements = ["Fire", "Earth", "Air", "Water"];
    const qualities = ["Cardinal", "Fixed", "Mutable"];
    
    elements.forEach(e => {
      qualities.forEach(q => {
        gridData[`${e}-${q}`] = [];
      });
    });

    // Place each planet in correct cell
    for (const [planet, lon] of Object.entries(lons)) {
      // Skip if not enabled by user
      if (enabled.hasOwnProperty(planet) && !enabled[planet]) continue;
      
      if (!planetGlyphs[planet] || !Number.isFinite(lon)) continue;
      
      const sign = getSign(lon);
      const eq = signQualities[sign];
      if (eq) {
        gridData[`${eq.elem}-${eq.qual}`].push(planetGlyphs[planet]);
      }
    }

    // Element symbols (alchemical)
    const elemSymbols = {
      "Fire": "🜂",
      "Earth": "🜃", 
      "Air": "🜁",
      "Water": "🜄"
    };

    // Build HTML
    let html = '';

    // Header row
    html += '<div class="elem-header-row">';
    html += '<div class="elem-corner"></div>';
    qualities.forEach(q => {
      html += `<div class="elem-col-header">${q.substring(0, 1)}</div>`;
    });
    html += '</div>';

    // Data rows
    elements.forEach(elem => {
      html += '<div class="elem-row">';

      qualities.forEach(qual => {
        const planets = gridData[`${elem}-${qual}`];
        const elemClass = elem.toLowerCase();
        html += `<div class="elem-cell ${elemClass}">`;
        planets.forEach(p => {
          html += `<span class="planet-glyph">${p}</span>`;
        });
        html += '</div>';
      });

      html += `<div class="elem-row-header ${elem.toLowerCase()}">${elemSymbols[elem]}</div>`;
      html += '</div>';
    });

    grid.innerHTML = html;
  }

  // Populate HUD Positions grid with element-colored sign glyphs

  // RULER GRID - Hourly and Daily planetary rulers
  const CHALDAEAN_ORDER = ["saturn","jupiter","mars","sun","venus","mercury","moon"];
  const DAY_RULERS = ["sun","moon","mars","mercury","jupiter","venus","saturn"];
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const RULER_COLORS = {
    sun: "#ffd700", moon: "#c0c0c0", mars: "#ff4444",
    mercury: "#87ceeb", jupiter: "#ffa500", venus: "#ff69b4", saturn: "#8b4513"
  };

  // Calculate planetary hour based on sunrise/sunset
  function getPlanetaryHourInfo(date, lat, lon, tz) {
    // Convert UTC date to local time at the given location
    // This is critical - we need LOCAL time, not UTC time
    let localHour;
    if (tz) {
      // Use timezone to get local hour
      try {
        const localTimeStr = date.toLocaleString("en-US", { timeZone: tz, hour: "numeric", minute: "numeric" });
        const [timePart, period] = localTimeStr.split(/\s+/);
        let [hours, minutes] = timePart.split(":").map(Number);
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        localHour = hours + minutes / 60;
      } catch (e) {
        // Fallback to UTC if timezone fails
        localHour = date.getUTCHours() + date.getUTCMinutes() / 60;
      }
    } else {
      // No timezone - use UTC (not ideal but fallback)
      localHour = date.getUTCHours() + date.getUTCMinutes() / 60;
    }
    
    // Simple sunrise/sunset approximation using date and latitude
    // More accurate would require full astronomical calculation
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    
    // Approximate day length based on latitude and day of year
    // This is a simplified model - actual calculation requires astronomical algorithms
    const latRad = (lat * Math.PI) / 180;
    const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
    const declRad = (declination * Math.PI) / 180;
    
    // Calculate hour angle at sunrise/sunset
    const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);
    
    // Clamp to valid range [-1, 1]
    const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * (180 / Math.PI);
    
    // Day length in hours
    const dayLength = (hourAngle * 2) / 15; // 15 degrees per hour
    
    // Solar noon is approximately at 12:00 local time (simplified)
    const solarNoon = 12;
    const sunrise = solarNoon - (dayLength / 2);
    const sunset = solarNoon + (dayLength / 2);
    
    const isDaytime = localHour >= sunrise && localHour < sunset;
    
    // Calculate which planetary hour we're in (1-12)
    let hourLength, dayStart, adjustedLocalHour;
    if (isDaytime) {
      // Daytime: sunrise to sunset, divided into 12 hours
      hourLength = (sunset - sunrise) / 12;
      dayStart = sunrise;
      adjustedLocalHour = localHour;
    } else {
      // Nighttime: sunset to next sunrise (crosses midnight)
      const nightLength = 24 - dayLength;
      hourLength = nightLength / 12;
      dayStart = sunset;
      // Adjust local hour for nighttime (add 24 if before sunrise)
      adjustedLocalHour = localHour < sunrise ? localHour + 24 : localHour;
    }
    
    // Handle edge cases
    if (hourLength <= 0) hourLength = 1;
    let hourIndex = Math.floor((adjustedLocalHour - dayStart) / hourLength);
    if (hourIndex < 0) hourIndex = 0;
    if (hourIndex > 11) hourIndex = 11;
    
    const planetaryHourNum = hourIndex + 1; // 1-12
    
    // Determine the ruler of this planetary hour
    const dayOfWeek = date.getDay(); // 0=Sunday
    const dayRuler = DAY_RULERS[dayOfWeek];
    const dayRulerIdx = CHALDAEAN_ORDER.indexOf(dayRuler);
    
    // For daytime hours, start from day ruler
    // For nighttime hours, start from opposite point in Chaldaean order
    let startIdx;
    if (isDaytime) {
      startIdx = dayRulerIdx;
    } else {
      // Night starts from the planet 6 steps away in Chaldaean order
      startIdx = (dayRulerIdx + 6) % 7;
    }
    
    const planetaryRuler = CHALDAEAN_ORDER[(startIdx + hourIndex) % 7];
    
    return {
      planetaryHourNum,
      planetaryRuler,
      isDaytime,
      sunrise,
      sunset,
      hourLength
    };
  }

  function populateRulerGrid(date, showNatal = false) {
    const grid = document.getElementById("wheelRulerGrid");
    if (!grid || !date) return;

    // Get location based on mode
    let loc;
    if (showNatal && window.NatalChart && window.NatalChart.enabled) {
      loc = window.natalLocationData || { lat: 40.7128, lon: -74.0060, tz: "America/New_York" };
    } else {
      loc = window.locationData || { lat: 40.7128, lon: -74.0060, tz: "America/New_York" };
    }
    
    // Calculate planetary hour info (sunrise-based)
    const planetaryHour = getPlanetaryHourInfo(date, loc.lat, loc.lon, loc.tz);
    const day = date.getDay(); // 0=Sun

    // Daily ruler
    const dailyPlanet = DAY_RULERS[day];

    const glyphMap = {
      sun: "☉", moon: "☽", mars: "♂", mercury: "☿",
      jupiter: "♃", venus: "♀", saturn: "♄"
    };

    const planetNames = {
      sun: "Sun", moon: "Moon", mars: "Mars", mercury: "Mercury",
      jupiter: "Jupiter", venus: "Venus", saturn: "Saturn"
    };

    // Hour suffix
    function getHourSuffix(h) {
      const n = h % 12 || 12; // Convert to 1-12
      if (n >= 11 && n <= 13) return "th";
      if (n % 10 === 1) return "st";
      if (n % 10 === 2) return "nd";
      if (n % 10 === 3) return "rd";
      return "th";
    }
    const hourNum = planetaryHour.planetaryHourNum;
    const hourSuffix = getHourSuffix(hourNum);

    const dayName = DAY_NAMES[day];
    const dayColor = RULER_COLORS[dailyPlanet];
    const hourColor = RULER_COLORS[planetaryHour.planetaryRuler];
    const dayGlyph = glyphMap[dailyPlanet];
    const hourGlyph = glyphMap[planetaryHour.planetaryRuler];
    const dayNameShort = dayName.slice(0, 3).toUpperCase();
    const hourPlanetName = planetNames[planetaryHour.planetaryRuler];
    const dayNightLabel = planetaryHour.isDaytime ? "Day" : "Night";

    let html = `
      <div class="ruler-rows">
        <div class="ruler-col">
          <span class="ruler-col-label">Day</span>
          <span class="ruler-col-glyph" style="color:${dayColor}">${dayGlyph}</span>
          <span class="ruler-col-name" style="color:${dayColor}">${dayNameShort}</span>
        </div>
        <div class="ruler-col">
          <span class="ruler-col-label">Hour</span>
          <span class="ruler-col-glyph" style="color:${hourColor}">${hourGlyph}</span>
          <span class="ruler-col-name" style="color:${hourColor}">${hourPlanetName}</span>
        </div>
      </div>
      <div class="ruler-hour-row">
        <span class="ruler-hour-num" style="color: rgba(255,255,255,.6); font-size: 12px">${hourNum}${hourSuffix} Hour of the ${planetaryHour.isDaytime ? 'Day' : 'Night'}</span>
      </div>
    `;
    grid.innerHTML = html;
  }

  // Wire up Lots mode toggle (Natal/Transit)
  let lotsShowNatal = false; // Default to transit
  const lotsTransitBtn = document.getElementById("lotsTransitBtn");
  const lotsNatalBtn = document.getElementById("lotsNatalBtn");
  
  // Wire up Lunar Phases mode toggle (Natal/Transit)
  let lunarShowNatal = false; // Default to transit
  const lunarTransitBtn = document.getElementById("lunarTransitBtn");
  const lunarNatalBtn = document.getElementById("lunarNatalBtn");
  
  // Wire up Elemental mode toggle (Natal/Transit)
  let elemShowNatal = false; // Default to transit
  const elemTransitBtn = document.getElementById("elemTransitBtn");
  const elemNatalBtn = document.getElementById("elemNatalBtn");
  
  // Wire up Ruler mode toggle (Natal/Transit)
  let rulerShowNatal = false; // Default to transit
  const rulerTransitBtn = document.getElementById("rulerTransitBtn");
  const rulerNatalBtn = document.getElementById("rulerNatalBtn");
  
  function updateLotsButtons() {
    if (lotsTransitBtn) {
      lotsTransitBtn.classList.toggle("is-active", !lotsShowNatal);
      lotsTransitBtn.setAttribute("title", !lotsShowNatal ? "Showing Transit" : "Show Transit");
    }
    if (lotsNatalBtn) {
      lotsNatalBtn.classList.toggle("is-active", lotsShowNatal);
      lotsNatalBtn.setAttribute("title", lotsShowNatal ? "Showing Natal" : "Show Natal");
    }
  }
  
  function updateLunarButtons() {
    if (lunarTransitBtn) {
      lunarTransitBtn.classList.toggle("is-active", !lunarShowNatal);
      lunarTransitBtn.setAttribute("title", !lunarShowNatal ? "Showing Transit" : "Show Transit");
    }
    if (lunarNatalBtn) {
      lunarNatalBtn.classList.toggle("is-active", lunarShowNatal);
      lunarNatalBtn.setAttribute("title", lunarShowNatal ? "Showing Natal" : "Show Natal");
    }
  }
  
  function updateElemButtons() {
    if (elemTransitBtn) {
      elemTransitBtn.classList.toggle("is-active", !elemShowNatal);
      elemTransitBtn.setAttribute("title", !elemShowNatal ? "Showing Transit" : "Show Transit");
    }
    if (elemNatalBtn) {
      elemNatalBtn.classList.toggle("is-active", elemShowNatal);
      elemNatalBtn.setAttribute("title", elemShowNatal ? "Showing Natal" : "Show Natal");
    }
  }
  
  function updateRulerButtons() {
    if (rulerTransitBtn) {
      rulerTransitBtn.classList.toggle("is-active", !rulerShowNatal);
      rulerTransitBtn.setAttribute("title", !rulerShowNatal ? "Showing Transit" : "Show Transit");
    }
    if (rulerNatalBtn) {
      rulerNatalBtn.classList.toggle("is-active", rulerShowNatal);
      rulerNatalBtn.setAttribute("title", rulerShowNatal ? "Showing Natal" : "Show Natal");
    }
  }
  
  if (lotsTransitBtn) {
    lotsTransitBtn.addEventListener("click", () => {
      lotsShowNatal = false;
      updateLotsButtons();
      const natalLons = window.NatalChart && window.NatalChart.enabled ? window.NatalChart.longitudes : null;
      const natalAngles = window.NatalChart && window.NatalChart.enabled ? window.NatalChart.angles : null;
      populateLotsGrid(natalLons, natalAngles, lotsShowNatal);
    });
  }
  
  if (lotsNatalBtn) {
    lotsNatalBtn.addEventListener("click", () => {
      lotsShowNatal = true;
      updateLotsButtons();
      const natalLons = window.NatalChart && window.NatalChart.enabled ? window.NatalChart.longitudes : null;
      const natalAngles = window.NatalChart && window.NatalChart.enabled ? window.NatalChart.angles : null;
      populateLotsGrid(natalLons, natalAngles, lotsShowNatal);
    });
  }
  
  if (lunarTransitBtn) {
    lunarTransitBtn.addEventListener("click", () => {
      lunarShowNatal = false;
      updateLunarButtons();
      populateLunarPhasesGrid(lunarShowNatal);
    });
  }
  
  if (lunarNatalBtn) {
    lunarNatalBtn.addEventListener("click", () => {
      lunarShowNatal = true;
      updateLunarButtons();
      populateLunarPhasesGrid(lunarShowNatal);
    });
  }
  
  if (elemTransitBtn) {
    elemTransitBtn.addEventListener("click", () => {
      elemShowNatal = false;
      updateElemButtons();
      const transitLons = window.getPlanetLongitudes(typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date ? timeState.dateUTC : new Date());
      populateElementalBox(transitLons, false);
    });
  }
  
  if (elemNatalBtn) {
    elemNatalBtn.addEventListener("click", () => {
      elemShowNatal = true;
      updateElemButtons();
      const natalLons = window.NatalChart && window.NatalChart.enabled ? window.NatalChart.longitudes : null;
      populateElementalBox(natalLons, true);
    });
  }
  
  if (rulerTransitBtn) {
    rulerTransitBtn.addEventListener("click", () => {
      rulerShowNatal = false;
      updateRulerButtons();
      const transitDate = typeof timeState !== "undefined" && timeState && timeState.navTargetDateUTC instanceof Date && timeState.navTargetDateUTC !== timeState.dateUTC
        ? timeState.navTargetDateUTC
        : typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date ? timeState.dateUTC : new Date();
      populateRulerGrid(transitDate, false);
    });
  }
  
  if (rulerNatalBtn) {
    rulerNatalBtn.addEventListener("click", () => {
      rulerShowNatal = true;
      updateRulerButtons();
      const natalDate = window.NatalChart && window.NatalChart.enabled ? window.NatalChart.dateUTC : new Date();
      populateRulerGrid(natalDate, true);
    });
  }
  
  // Initial ruler grid population (transit mode)
  const initialRulerDate = typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date ? timeState.dateUTC : new Date();
  populateRulerGrid(initialRulerDate, false);
  
  function populateHUDPositionsGrid(transitLons, natalLons) {
    const grid = document.getElementById("hudPositionsGrid");
    if (!grid || !transitLons) return;

    const planetGlyphs = {
      sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
      jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇"
    };

    const signGlyphs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
    const signElements = ["fire", "earth", "air", "water", "fire", "earth", "air", "water", "fire", "earth", "air", "water"];

    const planets = ["sun", "moon", "mercury", "venus", "mars",
                     "jupiter", "saturn", "uranus", "neptune", "pluto"];

    let html = '';

    for (const p of planets) {
      const transitLon = transitLons[p];
      if (!Number.isFinite(transitLon)) continue;

      const transitSignIndex = Math.floor(transitLon / 30);
      const transitSign = signGlyphs[transitSignIndex];
      const transitElem = signElements[transitSignIndex];
      const transitDeg = Math.floor(transitLon % 30);
      const transitMin = Math.floor((transitLon % 30 - transitDeg) * 60);

      // Build position display with element-colored sign glyph
      let positionHTML = `<span class="pos-sign pos-${transitElem}">${transitSign}</span> ${transitDeg}°${transitMin.toString().padStart(2, '0')}`;

      // Add natal position if available
      if (natalLons && natalLons[p] !== undefined) {
        const natalLon = natalLons[p];
        if (Number.isFinite(natalLon)) {
          const natalSignIndex = Math.floor(natalLon / 30);
          const natalSign = signGlyphs[natalSignIndex];
          const natalElem = signElements[natalSignIndex];
          const natalDeg = Math.floor(natalLon % 30);
          const natalMin = Math.floor((natalLon % 30 - natalDeg) * 60);
          positionHTML += ` <span class="pos-natal">/ <span class="pos-sign pos-${natalElem}">${natalSign}</span> ${natalDeg}°${natalMin.toString().padStart(2, '0')}</span>`;
        }
      }

      html += `
        <div class="pos-row">
          <span class="pos-planet">${p.glyph}</span>
          <span class="pos-position">${positionHTML}</span>
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  // Real-time update mechanism for live clock display
  let liveUpdateInterval = null;
  let isLiveMode = false;

  function startLiveUpdate() {
    if (liveUpdateInterval) return;
    isLiveMode = true;
    liveUpdateInterval = setInterval(() => {
      if (wheelModal.getAttribute("aria-hidden") !== "false") return;
      // Don't waste CPU/redraw when a natal chart is active — it freezes the clock
      if (window.NatalChart && window.NatalChart.enabled) return;
      drawAstroWheel();
    }, 5000); // Update every 5 seconds — reduces data URL allocations by 80% vs 1s
  }

  function stopLiveUpdate() {
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
    isLiveMode = false;
  }

  // Toggle live mode - can be called from ui-controller when "Reset to Now" is clicked
  window.setAstroWheelLiveMode = function(enabled) {
    if (enabled) {
      startLiveUpdate();
    } else {
      stopLiveUpdate();
    }
  };

  // Start live update when wheel opens
  wheelModal.addEventListener("transitionend", () => {
    if (wheelModal.getAttribute("aria-hidden") === "false" && isLiveMode) {
      startLiveUpdate();
    }
  });

  // Stop live update when wheel closes
  const originalCloseWheel = closeWheel;
  closeWheel = function() {
    stopLiveUpdate();
    originalCloseWheel();
  };

  // Keep the wheel tied to the timeline date; sky mode only changes orientation.

  // =========================================================
  window.astrowheelSkyMode = "tropical";
  const skyModeTropical = document.getElementById("skyModeTropical");
  const skyModeTransit = document.getElementById("skyModeTransit");
  const skyModeButtons = [skyModeTropical, skyModeTransit];
  const skyModeColors = {
    tropical: "rgba(255,200,50,.35)",
    transit: "rgba(0,200,80,.35)"
  };
  function updateSkyModeUI(mode) {
    skyModeButtons.forEach(button => {
      if (!button) return;
      const isActive = button.id.replace("skyMode", "").toLowerCase() === mode;
      button.classList.toggle("skyModeActive", isActive);
      button.classList.toggle("active", isActive);
      button.style.setProperty("background", isActive ? skyModeColors[mode] : "rgba(255,255,255,.1)", "important");
      button.style.setProperty("color", isActive ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.6)", "important");
      button.style.setProperty("font-weight", isActive ? "600" : "400", "important");
    });
  }
  function setSkyMode(mode) {
    if (mode !== "transit") mode = "tropical";
    window.astrowheelSkyMode = mode;
    if (window.__houseCache) {
      if (typeof window.__houseCache.clear === "function") window.__houseCache.clear();
      else window.__houseCache = new Map();
    }
    updateSkyModeUI(mode);
    drawAstroWheel();
  }
  window.setSkyMode = setSkyMode;
  skyModeButtons.forEach(button => {
    if (!button) return;
    const mode = button.id.replace("skyMode", "").toLowerCase();
    button.addEventListener("click", () => setSkyMode(mode));
  });
  updateSkyModeUI("tropical");
  
  // BODIES MODAL
  // =========================================================
  const bodiesBtn = document.getElementById("bodiesBtn");
  const bodiesModal = document.getElementById("bodiesModal");
  const bodiesClose = document.getElementById("bodiesClose");

  function openBodiesModal() {
    if (!bodiesModal) return;
    bodiesModal.setAttribute("aria-hidden", "false");
    populateBodiesGrid();
  }

  function closeBodiesModal() {
    if (!bodiesModal) return;
    bodiesModal.setAttribute("aria-hidden", "true");
  }

  if (bodiesBtn) {
    bodiesBtn.addEventListener("click", openBodiesModal);
  }

  if (bodiesClose) {
    bodiesClose.addEventListener("click", closeBodiesModal);
  }

  if (bodiesModal) {
    bodiesModal.addEventListener("click", (ev) => {
      // Close if clicking outside the modal card
      if (ev.target === bodiesModal) {
        closeBodiesModal();
      }
    });
  }

  // ---- Houses modal (Placidus / Porphyry selector)
  const housesBtn  = document.getElementById("housesBtn");
  const housesModal = document.getElementById("housesModal");
  const housesClose = document.getElementById("housesClose");
  const housesGrid  = document.getElementById("housesGrid");
  
  const HOUSE_LABELS = {
    "whole-sign": "Whole Sign",
    "P": "Placidus",
    "porphyry": "Porphyry"
  };
  
  function updateHousesBtnLabel() {
    if (!housesBtn) return;
    const sys = window.houseSystem || "whole-sign";
    housesBtn.textContent = HOUSE_LABELS[sys] || "Houses";
  }


  // ---- Houses visibility toggle
  function initHousesToggle() {
    const toggle = document.getElementById("housesToggle");
    if (!toggle) return;
    if (window.housesVisible === undefined) window.housesVisible = true;
    function refreshToggleUI() {
      const visible = window.housesVisible !== false;
      toggle.style.background = visible ? "rgba(34,197,94,.5)" : "rgba(100,100,100,.25)";
      const dot = document.getElementById("housesToggleDot");
      if (dot) dot.style.transform = visible ? "translateX(14px)" : "translateX(0)";
    }
    refreshToggleUI();
    toggle.addEventListener("click", function(ev) {
      ev.stopPropagation();
      window.housesVisible = !(window.housesVisible !== false);
      refreshToggleUI();
      if (typeof drawAstroWheel === "function") drawAstroWheel();
    });
  }
  initHousesToggle();
  

  function openHousesModal() {
    if (!housesModal) return;
    
    // Sync the active state to match current system
    const currentSys = window.houseSystem || "whole-sign";
    if (housesGrid) {
      const options = housesGrid.querySelectorAll(".house-option");
      options.forEach((btn) => {
        const isActive = btn.dataset.system === currentSys;
        btn.classList.toggle("active", isActive);
      });
    }
    
    housesModal.setAttribute("aria-hidden", "false");
  }
  function closeHousesModal() {
    if (!housesModal) return;
    housesModal.setAttribute("aria-hidden", "true");
  }
  if (housesBtn) {
    updateHousesBtnLabel();
    housesBtn.addEventListener("click", openHousesModal);
  }
  if (housesClose) {
    housesClose.addEventListener("click", closeHousesModal);
  }
  if (housesModal) {
    housesModal.addEventListener("click", (ev) => {
      // Close if clicking outside the modal card (on the modal background)
      if (ev.target === housesModal) {
        closeHousesModal();
      }
    });
  }
  // Use event delegation on housesGrid for reliable click handling
  if (housesGrid) {
    housesGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".house-option");
      if (!btn) return;
      const sys = btn.dataset.system || "P";
      window.houseSystem = sys;
      // Clear house cache when switching systems
      housesGrid.querySelectorAll(".house-option").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      closeHousesModal();
      updateHousesBtnLabel();
      if (typeof drawAstroWheel === "function") drawAstroWheel();
    });
  }

  // Populate the bodies grid with planet toggles
  function populateBodiesGrid() {
    const grid = document.getElementById("bodiesGrid");
    if (!grid) return;

    const planets = [
      { id: "sun", glyph: "☉", name: "Sun" },
      { id: "moon", glyph: "☽", name: "Moon" },
      { id: "mercury", glyph: "☿", name: "Mercury" },
      { id: "venus", glyph: "♀", name: "Venus" },
      { id: "mars", glyph: "♂", name: "Mars" },
      { id: "jupiter", glyph: "♃", name: "Jupiter" },
      { id: "saturn", glyph: "♄", name: "Saturn" },
      { id: "uranus", glyph: "♅", name: "Uranus" },
      { id: "neptune", glyph: "♆", name: "Neptune" },
      { id: "pluto", glyph: "♇", name: "Pluto" },
      { id: "northNode", glyph: "☊", name: "N. Node" },
      { id: "southNode", glyph: "☋", name: "S. Node" }
    ];

    const asteroids = [
      { id: "chiron", glyph: "⚷", name: "Chiron" },
      { id: "ceres", glyph: "⚳", name: "Ceres" },
      { id: "pallas", glyph: "⚴", name: "Pallas" },
      { id: "juno", glyph: "⚵", name: "Juno" },
      { id: "vesta", glyph: "⚶", name: "Vesta" },
      { id: "eros", glyph: "♡", name: "Eros" }
    ];

    const enabled = window.enabledPlanets || {};
    let html = "";
    
    // Planets
    for (const p of planets) {
      const isOn = enabled[p.id] !== false;
      const btnClass = isOn ? "" : "off";
      html += `
        <button class="body-toggle-btn ${btnClass}" data-planet="${p.id}" type="button">
          <span class="planet-glyph">${p.glyph}</span>
          <span class="planet-name">${p.name}</span>
        </button>
      `;
    }
    
    // Separator (spans full width)
    html += `<div class="bodies-separator"></div>`;
    
    // Asteroids
    for (const a of asteroids) {
      const isOn = enabled[a.id] === true;
      const btnClass = isOn ? "" : "off";
      html += `
        <button class="body-toggle-btn ${btnClass}" data-planet="${a.id}" type="button">
          <span class="planet-glyph">${a.glyph}</span>
          <span class="planet-name">${a.name}</span>
        </button>
      `;
    }

    // Separator
    html += `<div class="bodies-separator"></div>`;

    // Fixed stars
    const fixedStars = [
      { id: "regulus",   glyph: "★", name: "Regulus" },
      { id: "aldebaran", glyph: "★", name: "Aldebaran" },
      { id: "antares",   glyph: "★", name: "Antares" },
      { id: "fomalhaut", glyph: "★", name: "Fomalhaut" },
      { id: "sirius",    glyph: "★", name: "Sirius" },
      { id: "spica",     glyph: "★", name: "Spica" },
      { id: "rigel",     glyph: "★", name: "Rigel" },
      { id: "algol",     glyph: "★", name: "Algol" },
      { id: "deneb",     glyph: "★", name: "Deneb" }
    ];
    for (const s of fixedStars) {
      const isOn = enabled[s.id] === true;
      const btnClass = isOn ? "" : "off";
      html += `
        <button class="body-toggle-btn ${btnClass}" data-planet="${s.id}" type="button">
          <span class="planet-glyph">${s.glyph}</span>
          <span class="planet-name">${s.name}</span>
        </button>
      `;
    }
    
    grid.innerHTML = html;

    // Add click handlers for toggling
    grid.querySelectorAll(".body-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const planetId = btn.dataset.planet;
        const isCurrentlyOn = !btn.classList.contains("off");
        btn.classList.toggle("off");
        
        // Update the enabled state and redraw wheel
        if (typeof window.setPlanetEnabled === "function") {
          window.setPlanetEnabled(planetId, !isCurrentlyOn);
        }
      });
    });
  }

  window.drawAstroWheel = drawAstroWheel;
})();
