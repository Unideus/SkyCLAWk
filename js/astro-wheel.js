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

  if (!wheelModal || !wheelFab || !wheelClose || !wheelImg) {
    console.warn("[astro-wheel] modal DOM not found; wheel disabled.");
    window.drawAstroWheel = function () {};
    return;
  }

  // =========================================================
  // NATAL CHART (kept for existing ui-controller wiring)
  // =========================================================
  window.NatalChart = window.NatalChart || {
    enabled: false,
    dateUTC: null,
    longitudes: null,
    setDateUTC(d) {
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) return;
      this.dateUTC = d;
      if (typeof getPlanetLongitudes === "function") {
        this.longitudes = getPlanetLongitudes(d);
      }
    }
  };

  // =========================================================
  // ENABLED PLANETS STATE (for Bodies modal toggles)
  // =========================================================
  window.enabledPlanets = window.enabledPlanets || {
    sun: true,
    moon: true,
    mercury: true,
    venus: true,
    mars: true,
    jupiter: true,
    saturn: true,
    uranus: true,
    neptune: true,
    pluto: true,
    chiron: false,
    ceres: false,
    pallas: false,
    juno: false,
    vesta: false,
    northNode: true,
    southNode: true
  };

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

      // ✅ Click-through modal: only the card should capture input
      wheelModal.style.pointerEvents = "none";
      if (wheelBackdropEl) wheelBackdropEl.style.pointerEvents = "none";
      if (wheelCardEl) wheelCardEl.style.pointerEvents = "auto";

      drawAstroWheel();
      if (typeof syncEventShield === "function") syncEventShield();
    }

    function closeWheel() {
      wheelModal.setAttribute("aria-hidden", "true");

      // reset (safe)
      wheelModal.style.pointerEvents = "";
      if (wheelBackdropEl) wheelBackdropEl.style.pointerEvents = "";
      if (wheelCardEl) wheelCardEl.style.pointerEvents = "";

      if (typeof syncEventShield === "function") syncEventShield();
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
  wheelFab.addEventListener("click", openWheel);
  wheelClose.addEventListener("click", closeWheel);

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
  const MAX_W = 900;  // safe; can go bigger if you want
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

  // Open by default on first load
  requestAnimationFrame(openWheel);

  // ---------------------------------------------------------
  // Preload constellation SVG and embed as data URL (works inside data: SVG wheel)
  // ---------------------------------------------------------
  let HEAVEN_DATA_URL = "";

  fetch("/heaven_constellations.svg")
    .then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(txt => {
      HEAVEN_DATA_URL = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(txt);
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
  };

  // Smooth glyph angle offsets (degrees), keyed by body key (persist across frames)
  const __glyphAngOffset = new Map();

  function renderWheelSVG(bodyLons, opts = {}) {
    const W = 900, H = 900;
    const cx = W / 2, cy = H / 2;

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
    const rAspectTickOuter = 275 * ZODIAC_SCALE;
    const rAspectTickInner = 250 * ZODIAC_SCALE;
    const rAspectLine = rAspectTickInner - (8 * ZODIAC_SCALE);

    const degToRad = (d) => (d * Math.PI) / 180;

    // 0° Aries at 9 o’clock (same convention as MyTimeline)
    const baseLon = Number.isFinite(opts.baseLon) ? opts.baseLon : 0;
    const ang = (lonDeg) => degToRad(180 - (lonDeg - baseLon));

    const pt = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

    // ---- ring wedges + sign glyphs
    let wedges = "";
    let signText = "";

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

    // ---------------------------------------------------------
    // SHOW LIST (must exist BEFORE aspects + autoseparate)
    // ---------------------------------------------------------
    const showKeys = Array.isArray(opts.showKeys)
      ? opts.showKeys
      : Object.keys(bodyLons || {});

    // preserve the order of showKeys (no sorting here)
    const show = showKeys.filter(k => Number.isFinite(Number(bodyLons?.[k])));

    // ---- aspects (restore)
    let aspectTicks = "";
    let aspectLines = "";

    if (show.length >= 2) {
      const aspects = [
        { deg: 0,   orb: 6, tick:"rgba(255,255,255,.22)", line:"rgba(255,255,255,.14)" },
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
    }

    // ---- natal overlay (optional, inside sign ring)
    let natalLabels = "";
    if (opts.natalLons && typeof opts.natalLons === "object") {
      const rNatal = 325 * ZODIAC_SCALE; // keep it inside the scaled wheel
      for (const k of show) {
        const lon = Number(opts.natalLons[k]);
        if (!Number.isFinite(lon)) continue;
        const a = ang(lon);
        const [x, y] = pt(rNatal, a);
        natalLabels += `<text x="${x}" y="${y}" font-size="24" text-anchor="middle" dominant-baseline="middle"
          font-family="Segoe UI Symbol, Noto Sans Symbols2, DejaVu Sans, Arial Unicode MS, sans-serif"
          font-weight="400"
          fill="white" opacity="0.55">${planetGlyph[k] || "•"}</text>`;
      }
    }

    // ---------------------------------------------------------
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

const DOT_R = 3.6;

// leader tuning (shorten here)
const LEADER_GAP_DOT   = 4;   // start offset from dot
const LEADER_GAP_GLYPH = 28;  // end offset from glyph center (increase to shorten line)

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

  planetLabels += `<text x="${gx}" y="${gy}" dy="0.35em"
    font-size="30" text-anchor="middle" dominant-baseline="middle"
    font-family="Segoe UI Symbol, Noto Sans Symbols2, DejaVu Sans, Arial Unicode MS, sans-serif"
    font-weight="400"
    fill="white" opacity="0.95">${planetGlyph[k] || "•"}</text>`;
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

    const starOverlay = (HEAVEN_DATA_URL)
      ? `
        <g opacity="0.55" transform="rotate(${STAR_ROT + precessionDeg} ${cx} ${cy})">
          <image
            href="${HEAVEN_DATA_URL}"
            x="${(cx - STAR_RADIUS) + STAR_DX}"
            y="${(cy - STAR_RADIUS) + STAR_DY}"
            width="${STAR_RADIUS * 2}"
            height="${STAR_RADIUS * 2}"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      `
      : "";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <rect width="100%" height="100%" fill="rgba(0,0,0,0)"/>
        ${starOverlay}
        ${wedges}
        <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${rSignInner}" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.20)" stroke-width="2"/>
        ${signText}
        ${natalLabels}
        ${aspectLines}
        ${aspectTicks}
        ${planetDots}
        ${planetLeaders}
        ${planetLabels}
      </svg>
    `;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // =========================================================
  // PUBLIC: drawAstroWheel() (called from ui-controller.js)
  // =========================================================
  function drawAstroWheel() {
    if (!wheelImg) return;

    // Use current time when in live mode, otherwise use timeState/AstroEngine
    const t = isLiveMode 
      ? new Date()
      : (typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date) ? timeState.dateUTC :
        (window.AstroEngine && window.AstroEngine.dateUTC instanceof Date) ? window.AstroEngine.dateUTC :
        (window.AstroEngine && window.AstroEngine.dateUTC) ? new Date(window.AstroEngine.dateUTC) :
        new Date();

    const lons = (typeof window.getPlanetLongitudes === "function")
      ? window.getPlanetLongitudes(t)
      : null;

    if (!lons) return;

    // Build list of enabled planets from toggle state
    const keys = [];
    const enabled = window.enabledPlanets || {};
    
    // Core planets (always check these)
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

    const natalLons = (window.NatalChart && window.NatalChart.enabled && window.NatalChart.longitudes) ? window.NatalChart.longitudes : null;
    const url = renderWheelSVG(lons, { baseLon: 0, showKeys: keys, natalLons, dateUTC: t })
    wheelImg.src = url + `#t=${t.getTime()}`;

    // Update date/time overlay at top of wheel
    const wheelDateValue = document.getElementById("wheelDateValue");
    if (wheelDateValue) {
      const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      
      const weekday = weekdays[t.getDay()];
      const day = t.getDate();
      const month = months[t.getMonth()];
      const year = t.getFullYear();
      
      let hours = t.getHours();
      const minutes = String(t.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      
      wheelDateValue.textContent = `${weekday}, ${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    }

    // Calculate and populate aspects grid overlay
    populateAspectsOverlay(lons, natalLons);
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
    populateElementalBox(transitLons);

    // Populate transits grid
    populateTransitsGrid(transitLons, natalLons);

    // Populate HUD positions grid with element-colored sign glyphs
    populateHUDPositionsGrid(transitLons, natalLons);
  }

  // Show current transit positions in a grid
  function populateTransitsGrid(transitLons, natalLons) {
    const grid = document.getElementById("wheelTransitsGrid");
    if (!grid || !transitLons) return;

    const planetGlyphs = {
      sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
      jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇"
    };

    const signGlyphs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
    const signElements = ["fire", "earth", "air", "water", "fire", "earth", "air", "water", "fire", "earth", "air", "water"];
    const elementColors = {
      fire: '#ff6b35',
      earth: '#4ecdc4',
      air: '#ffe66d',
      water: '#6a82fb'
    };

    const planets = ["sun", "moon", "mercury", "venus", "mars",
                     "jupiter", "saturn", "uranus", "neptune", "pluto"];

    let html = '';

    for (const p of planets) {
      const lon = transitLons[p];
      if (!Number.isFinite(lon)) continue;

      const signIndex = Math.floor(lon / 30);
      const sign = signGlyphs[signIndex];
      const elem = signElements[signIndex];
      const deg = Math.floor(lon % 30);
      const min = Math.floor((lon % 30 - deg) * 60);

      // DEBUG: Log what we're assigning
      console.log(`[AstroWheel] ${p}: lon=${lon.toFixed(2)}, signIndex=${signIndex}, sign=${sign}, elem=${elem}`);

      const elemColor = elementColors[elem] || '#fff';

      html += `
        <div class="transit-row">
          <span class="transit-planet">${planetGlyphs[p]}</span>
          <span class="transit-sign transit-${elem}">${sign}</span>
          <span class="transit-degree">${deg}°${min.toString().padStart(2, '0')}</span>
        </div>
      `;
    }

    grid.innerHTML = html;
    console.log('[AstroWheel] Transits HTML:', html.substring(0, 200));
  }

  // Show where planets are currently located (transit positions)
  function populateElementalBox(transitLons) {
    const grid = document.getElementById("wheelElementalGrid");
    if (!grid || !transitLons) return;

    // Planet glyphs
    const planetGlyphs = {
      sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
      jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇"
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
    for (const [planet, lon] of Object.entries(transitLons)) {
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
      html += `<div class="elem-row-header ${elem.toLowerCase()}">${elemSymbols[elem]}</div>`;

      qualities.forEach(qual => {
        const planets = gridData[`${elem}-${qual}`];
        const elemClass = elem.toLowerCase();
        html += `<div class="elem-cell ${elemClass}">`;
        planets.forEach(p => {
          html += `<span class="planet-glyph">${p}</span>`;
        });
        html += '</div>';
      });

      html += '</div>';
    });

    grid.innerHTML = html;
  }

  // Populate HUD Positions grid with element-colored sign glyphs
  function populateHUDPositionsGrid(transitLons, natalLons) {
    const grid = document.getElementById("hudPositionsGrid");
    console.log('[AstroWheel] populateHUDPositionsGrid called, grid:', grid, 'transitLons:', transitLons);
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
          <span class="pos-planet">${planetGlyphs[p]}</span>
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
      drawAstroWheel();
    }, 1000); // Update every second
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

  // Start live mode by default on page load
  startLiveUpdate();

  // =========================================================
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
      const t = ev.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "bodies") {
        closeBodiesModal();
      }
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
      { id: "pluto", glyph: "♇", name: "Pluto" }
    ];

    const asteroids = [
      { id: "chiron", glyph: "⚷", name: "Chiron" },
      { id: "ceres", glyph: "⚳", name: "Ceres" },
      { id: "pallas", glyph: "⚴", name: "Pallas" },
      { id: "juno", glyph: "⚵", name: "Juno" },
      { id: "vesta", glyph: "⚶", name: "Vesta" }
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
