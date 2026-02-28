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
      signText += `<text x="${tx}" y="${ty}" font-size="42" text-anchor="middle" dominant-baseline="middle"
        font-family="Segoe UI Symbol, Noto Sans Symbols2, DejaVu Sans, Arial Unicode MS, sans-serif"
        font-weight="400"
        fill="white" opacity="0.95">${signMeta[i].glyph}</text>`;
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
const GLYPH_FONT_PX = 30;         // your planet glyph font-size
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

    const t =
      (typeof timeState !== "undefined" && timeState && timeState.dateUTC instanceof Date) ? timeState.dateUTC :
      (window.AstroEngine && window.AstroEngine.dateUTC instanceof Date) ? window.AstroEngine.dateUTC :
      (window.AstroEngine && window.AstroEngine.dateUTC) ? new Date(window.AstroEngine.dateUTC) :
      new Date();

    const lons = (typeof window.getPlanetLongitudes === "function")
      ? window.getPlanetLongitudes(t)
      : null;

    if (!lons) return;

    // Keep the legacy toggles behavior:
    // - Always show Saturn + Jupiter
    // - Add inner/outer groups based on ui-controller toggles
    const keys = ["sun", "saturn", "jupiter"];

    if (typeof showInnerPlanets !== "undefined" && showInnerPlanets) {
      keys.push("moon", "mercury", "venus");
    }

    if (typeof showOuterPlanets !== "undefined" && showOuterPlanets) {
      keys.push("mars", "uranus", "neptune", "pluto");
    }

    // Nodes only when Inner Planets is enabled
    if (showInnerPlanets) {
      if (Number.isFinite(Number(lons.northNode))) keys.push("northNode");
      if (Number.isFinite(Number(lons.southNode))) keys.push("southNode");
    }
    const natalLons = (window.NatalChart && window.NatalChart.enabled && window.NatalChart.longitudes) ? window.NatalChart.longitudes : null;
    const url = renderWheelSVG(lons, { baseLon: 0, showKeys: keys, natalLons, dateUTC: t })
    wheelImg.src = url + `#t=${t.getTime()}`;
  }

  window.drawAstroWheel = drawAstroWheel;
})();
