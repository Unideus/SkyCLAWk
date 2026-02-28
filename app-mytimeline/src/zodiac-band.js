// src/zodiac-band.js (SVG transform-only band, Page-3 style smoothness)

const viewport = document.getElementById("zodiacViewport");
const svg = document.getElementById("zodiacSVG");
const dateBox = document.getElementById("zodiacDateBox");

const trackGroup = document.getElementById("trackGroup");
const signBand = document.getElementById("signBand");
const degreeTicks = document.getElementById("degreeTicks");
const bodiesGroup = document.getElementById("bodiesGroup");
const conjunctionLayer = document.getElementById("conjunctionLayer");
const clipRect = document.getElementById("zodiacClipRect");
const aboveEclipticRect = document.getElementById("aboveEclipticRect");
const sunGlow = document.getElementById("sunGlow");

const eclipticLine = document.getElementById("eclipticLine");
const fixedOverlay = document.getElementById("fixedOverlay");

let bodiesOverlay = document.getElementById("bodiesOverlay");
if (!bodiesOverlay && fixedOverlay) {
  bodiesOverlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
  bodiesOverlay.setAttribute("id", "bodiesOverlay");
  fixedOverlay.appendChild(bodiesOverlay);
}

const BODY_GLYPHS = {
  sun: "☉",
  moon: "☾",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
  mean_node: "☊",
  south_node: "☋",
  chiron: "⚷",
  ceres: "⚳",
  pallas: "⚴",
  juno: "⚵",
  vesta: "⚶",
  eros: "⟡",
};

// =====================
// Filters from selector modals
// =====================
let FILTERS = { bodies: null, stars: null };

window.addEventListener("zy:filters", (e) => {
  const next = e?.detail || {};
  FILTERS = {
    bodies: Array.isArray(next.bodies) ? next.bodies : null,
    stars: Array.isArray(next.stars) ? next.stars : null,
  };
});

window.__ZY_FILTERS = window.__ZY_FILTERS || { bodies: [], stars: [] };

window.addEventListener("zy:filters", (e) => {
  if (!e?.detail) return;
  window.__ZY_FILTERS = e.detail;
});

const bodyNodes = {}; // { key: {dot,line,text} }
function ensureBodies() {
  if (!bodiesOverlay) return;
  for (const key of Object.keys(BODY_GLYPHS)) {
    if (bodyNodes[key]) continue;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("opacity", String(cfg.bodyOpacity));

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "rgba(255,255,255,0.75)");
    line.setAttribute("stroke-width", "1");

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", String(cfg.bodyDotR));
    dot.setAttribute("fill", "rgba(255,255,255,0.9)");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "rgba(255,255,255,0.95)");
    text.setAttribute("font-size", String(cfg.bodyGlyphSize));
    text.setAttribute("font-family", glyphFont);
    text.textContent = BODY_GLYPHS[key];

    g.appendChild(line);
    g.appendChild(dot);
    g.appendChild(text);

    bodiesOverlay.appendChild(g);
    bodyNodes[key] = { g, line, dot, text };
  }
}

function norm180(d) {
  return ((d + 540) % 360) - 180;
}

window.__ZY_APPLIED_FILTERS = window.__ZY_APPLIED_FILTERS || { bodies: [], stars: [] };

// =========================
// Fixed Stars (above ecliptic) — stable DOM (no flicker)
// =========================
const __STAR_NODES = new Map(); // name -> { g, dot, text, label }
// Stars selection that is "applied" to the band.
// We ONLY update this when a new zy:time payload arrives (Go/Calculate),
// so toggling pills won't instantly change the band.
let __STAR_APPLIED = [];

function updateStars(sunLon, fixedStars) {
  const g = document.getElementById("starsGroup");
  if (!g) return;

  // Cache lives on the function so we don't need any extra globals
  const cache =
    updateStars._cache ||
    (updateStars._cache = { nodes: new Map(), lastSig: "" });

  const nodes = cache.nodes;

  // No data -> hide anything we already made
  if (!fixedStars) {
    for (const n of nodes.values()) n.g.setAttribute("display", "none");
    return;
  }

  // ✅ IMPORTANT: use the same applied band filters the planets use
  // (this is what gets set when you actually Load to Band / Go)
  const rawSelected = Array.isArray(FILTERS?.stars) ? FILTERS.stars : [];

  // normalize + de-dupe (case-insensitive)
  const selected = [];
  const seen = new Set();
  for (const s of rawSelected) {
    const label = String(s || "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({ key, label });
  }

  // None selected -> hide all
  if (!selected.length) {
    for (const n of nodes.values()) n.g.setAttribute("display", "none");
    return;
  }

  // Signature so we only create DOM nodes when selection changes
  const sig = selected.map(o => o.key).sort().join("|");
  const selectionChanged = sig !== cache.lastSig;
  if (selectionChanged) cache.lastSig = sig;

  // longitude reader (supports a few shapes just in case)
  const readLon = (key) => {
    const v =
      fixedStars[key] ??
      fixedStars[key.toLowerCase?.()] ??
      fixedStars[key.toUpperCase?.()];

    const n = Number(v);
    if (Number.isFinite(n)) return n;

    if (v && typeof v === "object") {
      const a = Number(v.lon);
      if (Number.isFinite(a)) return a;
      const b = Number(v.eclLon);
      if (Number.isFinite(b)) return b;
      const c = Number(v.lambda);
      if (Number.isFinite(c)) return c;
    }

    return NaN;
  };

  // Sun-centered mapping
  const cx = S.w / 2;
  const toX = (lon) => {
    const dx = norm180(Number(lon) - Number(sunLon));
    return cx + dx * S.pxPerDeg;
  };

  // Place stars above the ecliptic
  const eclipticY = S.h - cfg.eclipticFromBottom;
  const dotY = eclipticY - 2;
  const glyphY = eclipticY - 18;
  const labelY = glyphY - 10;

  // If selection changed, make sure nodes exist (create once)
  if (selectionChanged) {
    // Hide everything first; we’ll re-show selected below
    for (const n of nodes.values()) n.g.setAttribute("display", "none");

    for (const { key, label } of selected) {
      if (nodes.has(key)) continue;

      const sg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      sg.setAttribute("data-star", key);
      sg.classList.add("zyStar");

      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("r", "2.5");
      dot.setAttribute("fill", "white");
      dot.setAttribute("opacity", "0.9");

      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("fill", "white");
      t.setAttribute("font-size", "14");
      t.setAttribute("font-family", glyphFont);
      t.textContent = "✶";

      // Hover label (your CSS already hides/shows .starLabel)
      const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lab.classList.add("starLabel");
      lab.setAttribute("text-anchor", "middle");
      lab.setAttribute("dominant-baseline", "alphabetic");
      lab.setAttribute("fill", "rgba(255,255,255,0.90)");
      lab.setAttribute("font-size", "12");
      lab.setAttribute("font-family", "system-ui,sans-serif");
      lab.textContent = label;

      // Native tooltip (optional)
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = label;

      sg.appendChild(title);
      sg.appendChild(dot);
      sg.appendChild(t);
      sg.appendChild(lab);

      g.appendChild(sg);
      nodes.set(key, { g: sg, dot, text: t, label: lab });
    }
  }

  // Update positions for selected
  const selectedSet = new Set(selected.map(o => o.key));

  for (const { key } of selected) {
    const node = nodes.get(key);
    if (!node) continue;

    const lon = readLon(key);
    if (!Number.isFinite(lon)) {
      node.g.setAttribute("display", "none");
      continue;
    }

    const x = toX(lon);

    node.g.setAttribute("display", "");
    node.dot.setAttribute("cx", String(x));
    node.dot.setAttribute("cy", String(dotY));

    node.text.setAttribute("x", String(x));
    node.text.setAttribute("y", String(glyphY));

    node.label.setAttribute("x", String(x));
    node.label.setAttribute("y", String(labelY));
  }

  // Hide nodes that exist but are not selected
  for (const [key, node] of nodes.entries()) {
    if (!selectedSet.has(key)) node.g.setAttribute("display", "none");
  }
}

function angDiffDeg(a, b) {
  return Math.abs(norm180(a - b));
}

// =====================
// HELPERS: Conjunctions
// =====================

function fmtDegMin(d) {
  const deg = Math.floor(d);
  const min = Math.floor((d - deg) * 60 + 1e-6);
  return `${deg}°${String(min).padStart(2, "0")}'`;
}

function renderConjunctions(xByKey, lonByKey, glyphY, sunLon) {
  if (!conjunctionLayer) return;

  clearNode(conjunctionLayer);

  const pairs = [];
  for (let i = 0; i < CONJ_KEYS.length; i++) {
    for (let j = i + 1; j < CONJ_KEYS.length; j++) {
      const a = CONJ_KEYS[i], b = CONJ_KEYS[j];
      const xa = xByKey[a], xb = xByKey[b];
      const la = lonByKey[a], lb = lonByKey[b];
      if (!Number.isFinite(xa) || !Number.isFinite(xb) || !Number.isFinite(la) || !Number.isFinite(lb)) continue;

      const sep = Math.abs(norm180(la - lb));
      if (sep > cfg.conjOrbDeg) continue;

      pairs.push({ a, b, xa, xb, sep });
    }
  }

  pairs.sort((p, q) => p.sep - q.sep);
  const shown = pairs.slice(0, cfg.conjMaxShown);

  // --- label lane layout (farther from Sun on top, closer to Sun lower)
const sun = Number(sunLon);
const labels = shown.map(p => {
  const { xa, xb, sep, a, b } = p;
  const midX = (xa + xb) / 2;

  // midpoint longitude (handles wrap correctly)
  const la = Number(lonByKey[a]);
  const lb = Number(lonByKey[b]);
  const midLon = wrap360(la + norm180(lb - la) / 2);

  const sunDist = Number.isFinite(sun) ? Math.abs(norm180(midLon - sun)) : 999;

  return { ...p, midX, midLon, sunDist };
});

// farther-from-sun first => top rows; closer-to-sun later => lower rows
labels.sort((p, q) => q.sunDist - p.sunDist);

// assign lanes with simple collision avoidance per row
const lanes = []; // lanes[i] = array of midX already placed in that lane
for (const it of labels) {
  let lane = 0;
  while (true) {
    if (!lanes[lane]) lanes[lane] = [];
    const collide = lanes[lane].some(x => Math.abs(x - it.midX) < cfg.conjLabelMinDxPx);
    if (!collide) {
      it.lane = lane;
      lanes[lane].push(it.midX);
      break;
    }
    lane++;
  }
}

  for (const p of labels) {
    const { xa, xb, sep, a, b } = p;

    const x1 = xa, x2 = xb;
    const midX = (x1 + x2) / 2;

    // closeness 0..1 (1 = exact)
    const t = Math.max(0, Math.min(1, 1 - (sep / cfg.conjOrbDeg)));

    // Fixed peak height (top of signs), only sharpness changes with closeness
    const peakY = cfg.signBandY - 10; // in the black above signs
    const depth = Math.max(6, glyphY - peakY); // how tall the arch is

    // 0 = arched, 1 = pointed
    const sharp = t;

    // Control points move inward as planets approach -> sharper peak
    const span = Math.abs(x2 - x1);
    const inset = (0.06 + 0.44 * sharp) * span; // more inset when closer = pointier


    const c1x = x1 + inset;
    const c2x = x2 - inset;
    const c1y = glyphY - depth;
    const c2y = glyphY - depth;

    const strokeW = 1 + 2.2 * t;
    const alpha = 0.12 + 0.55 * t;

   const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${x1} ${glyphY} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${glyphY}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", `rgba(199,160,255,${alpha})`);
    path.setAttribute("stroke-width", String(strokeW));
    path.setAttribute("stroke-linecap", "round");
    conjunctionLayer.appendChild(path);

    // Optional separation label
    if (cfg.conjShowText) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(midX));
      // ✅ keep ALL labels above the sign band (in the black area)
      const labelBaseY = cfg.signBandY - 18; // just above the top edge of the signs
      const labelY = labelBaseY - (p.lane * cfg.conjLabelLaneStepPx); // stack upward
      label.setAttribute("y", String(labelY));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "alphabetic");
      label.setAttribute("fill", `rgba(255,255,255,${0.35 + 0.55 * t})`);
      label.setAttribute("font-size", "12");
      label.setAttribute("font-family", "system-ui, sans-serif");
      // show tiny glyphs + separation (compact, readable)
      const ga = (BODY_GLYPHS && BODY_GLYPHS[a]) ? BODY_GLYPHS[a] : a[0];
      const gb = (BODY_GLYPHS && BODY_GLYPHS[b]) ? BODY_GLYPHS[b] : b[0];
      label.textContent = `${ga}${gb} ${fmtDegMin(sep)}`;
      conjunctionLayer.appendChild(label);
    }
  }
}

function updateBodies(sunLon, bodyLons) {
  if (!S.w || !S.h) return;

  const cx = S.w / 2;
  const eclipticY = S.h - cfg.eclipticFromBottom;

  const glyphY = eclipticY - cfg.bodyLeaderH + cfg.bodyGlyphYOffset;
  const conjX = Object.create(null);
  const conjLon = Object.create(null);

  // NEW: eclipse overlays (needs moon + node)
  const moonLon = Number(bodyLons?.moon);
  const nodeLon = Number(bodyLons?.mean_node);

if (solarEclipseGlow || lunarEclipseGlow) {
  let showSolar = false;
  let showLunar = false;
  let solarStrength = 0;
  let lunarStrength = 0;

  if (Number.isFinite(moonLon) && Number.isFinite(nodeLon) && Number.isFinite(sunLon)) {
    // node proximity: closest to ascending OR descending node
    const nodeA = angDiffDeg(moonLon, nodeLon);
    const nodeD = angDiffDeg(moonLon, (nodeLon + 180) % 360);
    const nodeMin = Math.min(nodeA, nodeD);

    // syzygy: Moon-Sun angle (0=new, 180=full)
    const syz = angDiffDeg(moonLon, sunLon);
    const toNew = syz;
    const toFull = Math.abs(180 - syz);

    // thresholds
    if (nodeMin <= cfg.eclipseNodeDeg) {
      if (toNew <= cfg.eclipseSyzygyDeg) {
        showSolar = true;
        // strength fades out toward the edge of thresholds
        const a = 1 - (toNew / cfg.eclipseSyzygyDeg);
        const b = 1 - (nodeMin / cfg.eclipseNodeDeg);
        solarStrength = Math.max(0, Math.min(1, a * b));
      }
      if (toFull <= cfg.eclipseSyzygyDeg) {
        showLunar = true;
        const a = 1 - (toFull / cfg.eclipseSyzygyDeg);
        const b = 1 - (nodeMin / cfg.eclipseNodeDeg);
        lunarStrength = Math.max(0, Math.min(1, a * b));
      }
    }
  }

    if (solarEclipseGlow) {
      solarEclipseGlow.setAttribute("display", showSolar ? "" : "none");
      if (showSolar) solarEclipseGlow.setAttribute("opacity", String(0.15 + 0.85 * solarStrength));
    }
    if (lunarEclipseGlow) {
      lunarEclipseGlow.setAttribute("display", showLunar ? "" : "none");
      if (showLunar) lunarEclipseGlow.setAttribute("opacity", String(0.12 + 0.80 * lunarStrength));
    }
  }

  // Compute the SAME base translate as applyScroll(), so we can convert
  // desired screen-x into trackGroup local-x (prevents "double shift"/seam issues).
  const raw = (S.w * 0.5) - (wrap360(sunLon) * S.pxPerDeg);
  let base = raw % S.w;
  if (base > 0) base -= S.w;

  // Position the track bodies (bodyEls) in TRACK coordinates
  for (const b of BODY_META) {
    const key = b.k;

    // Apply Bodies filter (if present)
    if (Array.isArray(FILTERS.bodies) && !FILTERS.bodies.includes(key)) {
      const node = bodyEls.get(key);
      if (node) node.g.setAttribute("display", "none");
      continue;
    }

    const node = bodyEls.get(key);
    if (!node) continue;

    // We draw the Sun as fixed overlay, so hide any track sun node if present
    if (key === "sun") {
      node.g.setAttribute("display", "none");
      continue;
    }

    const lon = Number(bodyLons?.[key]);
    if (!Number.isFinite(lon)) {
      node.g.setAttribute("display", "none");
      continue;
    }
    node.g.setAttribute("display", "");

    // Screen x should be Sun-centered:
    const dx = norm180(lon - sunLon);
    const xScreen = cx + dx * S.pxPerDeg;

    // Convert to track coords by subtracting the track translate base:
    const xLocal = xScreen - base;

    if (CONJ_KEYS.includes(key)) {
      conjX[key] = xLocal;
      conjLon[key] = lon;
    }

    // Dimming for Mercury/Venus visibility
    // NEW: dim any body inside its Sun-glare orb
    const glareDeg = cfg.glareDegByKey?.[key];
    const inGlare = Number.isFinite(glareDeg) ? (Math.abs(dx) < glareDeg) : false;

    node.g.setAttribute(
      "opacity",
      inGlare ? String(cfg.glareDimOpacity) : String(cfg.bodyOpacity)
    );


    node.dot.setAttribute("cx", xLocal);
    node.dot.setAttribute("cy", eclipticY);
    node.dot.setAttribute("r", String(cfg.bodyDotR));

    node.line.setAttribute("x1", xLocal);
    node.line.setAttribute("x2", xLocal);
    node.line.setAttribute("y1", eclipticY);
    node.line.setAttribute("y2", eclipticY - cfg.bodyLeaderH);

    // NEW: moon phase glyph
    if (key === "moon") {
      node.text.textContent = moonPhaseGlyph(sunLon, lon);
    }

    const gy = eclipticY - cfg.bodyLeaderH + cfg.bodyGlyphYOffset;

    node.text.setAttribute("x", xLocal);
    node.text.setAttribute("y", gy);
    node.text.setAttribute("font-size", String(cfg.bodyGlyphSize));


    // NEW: rx / station marker (lower-right of glyph)
    if (node.status) {
      const rates = anim.bodyRateDegPerSec || {};
      const rDegPerSec = Number(rates[key]);
      const degPerDay = Number.isFinite(rDegPerSec) ? (rDegPerSec * 86400) : NaN;

      let label = "";
      if (Number.isFinite(degPerDay)) {
        if (Math.abs(degPerDay) <= cfg.stationDegPerDay) label = "s";
        else if (degPerDay <= -cfg.rxDeadbandDegPerDay) label = "rx";
      }

      if (label) {
        node.status.textContent = label;
        node.status.setAttribute("display", "");
        node.status.setAttribute("x", xLocal + cfg.statusDx);
        node.status.setAttribute("y", glyphY + cfg.statusDy);
        node.status.setAttribute("font-size", String(cfg.statusFontSize));
      } else {
        node.status.setAttribute("display", "none");
      }
    }
  }
  renderConjunctions(conjX, conjLon, glyphY);
}

function updateNatal(sunLon) {
  const g = document.getElementById("natalGroup");
  if (!g) return;

  // Ensure required natal sub-groups exist (create them if missing)
  const NS = "http://www.w3.org/2000/svg";
  function ensureGroup(id) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElementNS(NS, "g");
      el.setAttribute("id", id);
      g.appendChild(el);
    }
    return el;
  }

  // Order matters for layering (lines under glyphs)
  const houseLinesG   = ensureGroup("natalHouseLines");
  const houseLabelsG  = ensureGroup("natalHouseLabels");
  const angleMarksG   = ensureGroup("natalAngleMarks");
  const dotsG         = ensureGroup("natalDots");
  const leadersG      = ensureGroup("natalLeaders");
  const glyphsG       = ensureGroup("natalGlyphs");

  // Hide everything until the user has committed natal via "Load to Band"
   if (!NATAL?.natalBodyLons) {
    houseLinesG.innerHTML = "";
    houseLabelsG.innerHTML = "";
    angleMarksG.innerHTML = "";
    dotsG.innerHTML = "";
    leadersG.innerHTML = "";
    glyphsG.innerHTML = "";
    return;
  }

  const eclipticY = S.h - cfg.eclipticFromBottom;

  // Under-ecliptic lanes
  const dotY = eclipticY + 2;
  const glyphY = eclipticY + 24;

  // Convert longitude -> screen x using SAME mapping as bodies (Sun centered)
  const cx = S.w / 2;
  const toX = (lon) => {
    const dx = norm180(Number(lon) - Number(sunLon));
    return cx + dx * S.pxPerDeg;
  };

  // ---------------------
  // Houses (below ecliptic only)
  // ---------------------
  const asc = Number(NATAL.ascLon);
  const mc = Number(NATAL.mcLon);
  const hsys = String(NATAL.hsys || "W").toUpperCase();

  let cusps = null;
  if (Number.isFinite(asc)) {
    if (hsys === "W") cusps = computeWholeCusps(asc);
    else if (hsys === "O" && Number.isFinite(mc)) cusps = computePorphyryCusps(asc, mc);
  }

  houseLinesG.innerHTML = "";
    houseLabelsG.innerHTML = "";
    angleMarksG.innerHTML = "";
  if (Array.isArray(cusps) && cusps.length === 12) {
    for (const deg of cusps) {
      const x = toX(deg);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x);
      line.setAttribute("x2", x);
      line.setAttribute("y1", eclipticY + 2);
      line.setAttribute("y2", eclipticY + 24);
      line.setAttribute("stroke", "rgba(255,255,255,0.28)");
      line.setAttribute("stroke-width", "2");
      houseLinesG.appendChild(line);
    }
  }

    // --- House numbers (1–12)
  if (Array.isArray(cusps) && cusps.length === 12) {
    for (let i = 0; i < cusps.length; i++) {
      const deg = cusps[i];
      const x = toX(deg);

      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", x);
      txt.setAttribute("y", eclipticY + 34);
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("dominant-baseline", "middle");
      txt.setAttribute("fill", "rgba(255,255,255,0.70)");
      txt.setAttribute("font-size", "10");
      txt.setAttribute("font-family", "system-ui,sans-serif");
      txt.textContent = String(i + 1);
      houseLabelsG.appendChild(txt);
    }
  }

  // --- Angle markers (ASC / MC / DSC / IC) on natal band only
  const dsc = Number.isFinite(asc) ? wrap360(asc + 180) : NaN;
  const ic  = (Number.isFinite(mc)) ? wrap360(mc + 180) : NaN;

  function addAngleMark(label, lon) {
    if (!Number.isFinite(lon)) return;

    const x = toX(lon);

    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("x1", x);
    tick.setAttribute("x2", x);
    tick.setAttribute("y1", eclipticY - 2);
    tick.setAttribute("y2", eclipticY + 12);
    tick.setAttribute("stroke", "rgba(255,255,255,0.85)");
    tick.setAttribute("stroke-width", "2");
    angleMarksG.appendChild(tick);

    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x);
    t.setAttribute("y", eclipticY + 18);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("fill", "rgba(255,255,255,0.90)");
    t.setAttribute("font-size", "11");
    t.setAttribute("font-family", "system-ui,sans-serif");
    t.textContent = label;
    angleMarksG.appendChild(t);
  }

  addAngleMark("ASC", asc);
  addAngleMark("MC",  mc);
  addAngleMark("DSC", dsc);
  addAngleMark("IC",  ic);

  // ---------------------
  // Natal bodies (gold) — FILTERED by the Bodies modal selection
  // ---------------------
  const lons = NATAL.natalBodyLons || {};

  // Read selected bodies from:
  //  1) window.__ZY_FILTERS (if you later add it)
  //  2) localStorage zy_filters_v1 (this is what your modal uses right now)
  //  3) fallback: show all keys in natalBodyLons
  function getSelectedBodies() {
    // (1) preferred if present
    const fromWindow = window.__ZY_FILTERS?.bodies;
    if (Array.isArray(fromWindow)) return fromWindow;

    // (2) localStorage (current master behavior)
    try {
      const raw = localStorage.getItem("zy_filters_v1");
      const obj = raw ? JSON.parse(raw) : null;
      if (Array.isArray(obj?.bodies)) return obj.bodies;
    } catch {}

    // (3) fallback: everything in natal lons
    return null;
  }

  const selected = getSelectedBodies();

  // Build final key list (selected-only if selection exists; otherwise all)
  const keys = (Array.isArray(selected) && selected.length ? selected : Object.keys(lons))
    .filter(k => Number.isFinite(Number(lons[k])));

  // If nothing selected, clear natal layer cleanly
  dotsG.innerHTML = "";
  leadersG.innerHTML = "";
  glyphsG.innerHTML = "";
  if (!keys.length) return;

  // map -> screen X at true dot position
  const pts = keys
    .map(k => {
      const lon = Number(lons[k]);
      const x0 = toX(lon);
      return { k, lon, x0 };
    })
    .sort((a, b) => a.x0 - b.x0);

  // spacing knobs
  const minDx = 20; // a bit wider so tight asteroid clusters actually separate
  const pad = 14;
  const xMin = pad;
  const xMax = (S?.w ?? 0) - pad;

  // Build clusters ONLY where dots are crowded.
  // Lone bodies stay exactly under their dot (vertical leader).
  const desired = [];
  let cluster = [];

  function flushCluster() {
    if (!cluster.length) return;

    if (cluster.length === 1) {
      desired.push({ ...cluster[0], x: cluster[0].x0 });
      cluster = [];
      return;
    }

    // crowded cluster → spread around the cluster’s true center
    const n = cluster.length;
    const meanX0 = cluster.reduce((s, p) => s + p.x0, 0) / n;

    let start = meanX0 - ((n - 1) * minDx) / 2;
    let xs = cluster.map((p, i) => ({ ...p, x: start + i * minDx }));

    // clamp cluster into viewport while preserving spacing
    const left = xs[0].x;
    const right = xs[xs.length - 1].x;

    let shift = 0;
    if (left < xMin) shift = xMin - left;
    if (right + shift > xMax) shift -= (right + shift) - xMax;

    if (shift) xs = xs.map(p => ({ ...p, x: p.x + shift }));

    desired.push(...xs);
    cluster = [];
  }

  // cluster detection by dot proximity
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!cluster.length) {
      cluster.push(p);
      continue;
    }

    const prev = cluster[cluster.length - 1];
    if (p.x0 - prev.x0 < minDx) cluster.push(p);
    else {
      flushCluster();
      cluster.push(p);
    }
  }
  flushCluster();

  // draw: dot at true x0 on ecliptic; glyph at separated x; leader line connects
  for (const p of desired) {
    const xDot = p.x0;
    const xGlyph = (Math.abs(p.x - p.x0) < 0.25) ? p.x0 : p.x;

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", xDot);
    dot.setAttribute("cy", dotY);
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#ffd24d"); // gold
    dotsG.appendChild(dot);

    const lead = document.createElementNS("http://www.w3.org/2000/svg", "line");
    lead.setAttribute("x1", xDot);
    lead.setAttribute("y1", dotY);
    lead.setAttribute("x2", xGlyph);
    lead.setAttribute("y2", glyphY - 6);
    lead.setAttribute("stroke", "#ffd24d");
    lead.setAttribute("stroke-width", "1.5");
    leadersG.appendChild(lead);

    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", xGlyph);
    t.setAttribute("y", glyphY);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("fill", "#ffd24d");
    t.setAttribute("font-size", "16");
    t.setAttribute("font-family", glyphFont);
    t.textContent = BODY_GLYPHS[p.k] || p.k[0].toUpperCase();
    glyphsG.appendChild(t);

    // natal s / rx marker (gold)
    const natalRates = NATAL?.natalBodyRateDegPerSec || {};
    const rDegPerSec = Number(natalRates[p.k]);
    const degPerDay = Number.isFinite(rDegPerSec) ? (rDegPerSec * 86400) : NaN;

    let status = "";
    if (Number.isFinite(degPerDay)) {
      if (Math.abs(degPerDay) <= cfg.stationDegPerDay) status = "s";
      else if (degPerDay <= -cfg.rxDeadbandDegPerDay) status = "rx";
    }

    if (status) {
      const st = document.createElementNS("http://www.w3.org/2000/svg", "text");
      st.setAttribute("x", xGlyph + cfg.statusDx);
      st.setAttribute("y", glyphY + cfg.statusDy);
      st.setAttribute("text-anchor", "start");
      st.setAttribute("dominant-baseline", "middle");
      st.setAttribute("fill", "#ffd24d");
      st.setAttribute("font-size", String(cfg.statusFontSize));
      st.setAttribute("font-family", "system-ui,sans-serif");
      st.textContent = status;
      glyphsG.appendChild(st);
    }
  }
}

// Helpers (local to zodiac-band.js; matches main.js logic)
function computeWholeCusps(ascLon) {
  const c1 = Math.floor(wrap360(ascLon) / 30) * 30;
  const out = [];
  for (let i = 0; i < 12; i++) out.push(wrap360(c1 + i * 30));
  return out;
}
function computePorphyryCusps(ascLon, mcLon) {
  const asc = wrap360(ascLon);
  const mc  = wrap360(mcLon);
  const dsc = wrap360(asc + 180);
  const ic  = wrap360(mc + 180);

  const arcF = (a,b)=>wrap360(b-a);

  const arcASC_to_IC = arcF(asc, ic);
  const arcIC_to_DSC = arcF(ic, dsc);
  const arcDSC_to_MC = arcF(dsc, mc);
  const arcMC_to_ASC = arcF(mc, asc);

  const c1  = asc;
  const c2  = wrap360(asc + arcASC_to_IC / 3);
  const c3  = wrap360(asc + 2 * arcASC_to_IC / 3);
  const c4  = ic;
  const c5  = wrap360(ic + arcIC_to_DSC / 3);
  const c6  = wrap360(ic + 2 * arcIC_to_DSC / 3);
  const c7  = dsc;
  const c8  = wrap360(dsc + arcDSC_to_MC / 3);
  const c9  = wrap360(dsc + 2 * arcDSC_to_MC / 3);
  const c10 = mc;
  const c11 = wrap360(mc + arcMC_to_ASC / 3);
  const c12 = wrap360(mc + 2 * arcMC_to_ASC / 3);

  return [c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12];
}

if (!viewport || !svg || !dateBox || !trackGroup || !signBand || !degreeTicks || !clipRect || !bodiesGroup) {
  console.warn("[zodiac-band] Missing required DOM nodes");
}

const cfg = {
  viewportH: 250,

  // layout knobs
  signBandY: 130,
  signBandH: 80,
  featherH: 15, // (visual fade can be added later)

  // sign knobs
  signOpacity: 0.20,
  signGlyphOpacity: 0.30,
  signGlyphSize: 20,
  signGlyphYOffset: -12,

    // NEW: conjunction visuals (Mars-out)
  conjOrbDeg: 5,           // <-- knob (change this)
  conjMaxShown: 6,          // limit to avoid clutter (increase if you want)
  conjDotSnapDeg: 0.35,     // below this, line collapses into the dot
  conjArcPx: 46,            // max curve height
  conjShowText: true,       // set false if cluttered

  conjLabelLaneStepPx: 14,   // vertical spacing between label rows
  conjLabelMinDxPx: 64,      // minimum horizontal spacing before we drop a label to a lower row

  eclipticFromBottom: 40,

  sunGlowR: 105,          // glow size

  // NEW: eclipse detection + glow sizing
  eclipseSyzygyDeg: 7,   // how close to exact New/Full counts (deg)
  eclipseNodeDeg: 12,    // how close Moon must be to a node (deg)
  eclipseGlowR: 90,      // size of eclipse overlay glow


  // NEW: glare/orb thresholds for all bodies (deg from Sun)
  glareDimOpacity: 0.22, // how dark things go inside glare zone (0..1)

  glareDegByKey: {
    moon: 7,
    mercury: 18,
    venus: 10,
    mars: 15,
    jupiter: 12,
    saturn: 12,
    uranus: 10,
    neptune: 10,
    pluto: 10,
    mean_node: 12,
    south_node: 12,
  },


  sunDotR: 3,
  sunGlyphSize: 44,
  sunGlyphYOffset: -130,
  truthBlend: 0.12, // 0..1 (smaller = fewer “random jumps”)
  // bodies (planets + nodes)
  bodyDotR: 3,
  bodyLeaderH: 18,
  bodyGlyphSize: 18,
  bodyGlyphYOffset: -10,
  bodyOpacity: 0.95,
  // NEW: retrograde / station markers
  rxDeadbandDegPerDay: 0.001,   // must be < -this to count as RX
  stationDegPerDay: 0.02,       // abs(deg/day) below this = station
  statusFontSize: 10,
  statusDx: 10,                 // lower-right offset from glyph center
  statusDy: 10,
};

// =========================
// Receive filters from main.js (bodies + stars)
// =========================
let ZY_FILTERS = { bodies: null, stars: null };

window.addEventListener("zy:filters", (ev) => {
  if (ev && ev.detail) ZY_FILTERS = ev.detail;
});

const glyphFont =
  '"Segoe UI Symbol","Noto Sans Symbols 2","Apple Symbols","Symbola",system-ui,sans-serif';

// NEW: Moon phases need emoji-capable fonts, but ONLY for the moon
const moonFont =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';

const elementColors = {
  fire: "#d32f2f",
  earth: "#2e7d32",
  air: "#fbc02d",
  water: "#1976d2",
};

const signs = [
  { glyph: "♈︎", element: "fire" },
  { glyph: "♉︎", element: "earth" },
  { glyph: "♊︎", element: "air" },
  { glyph: "♋︎", element: "water" },
  { glyph: "♌︎", element: "fire" },
  { glyph: "♍︎", element: "earth" },
  { glyph: "♎︎", element: "air" },
  { glyph: "♏︎", element: "water" },
  { glyph: "♐︎", element: "fire" },
  { glyph: "♑︎", element: "earth" },
  { glyph: "♒︎", element: "air" },
  { glyph: "♓︎", element: "water" },
];

const MS_PER_MIN = 60000;
let lastMinuteKey = null;

// Size cache
const S = { w: 0, h: 0, pxPerDeg: 0 };

// Animation cache (interpolates between zy:time samples)
const anim = {
  have: false,
  basePerf: 0,
  baseSunLon: 0,
  sunRate: 0,          // deg/sec (per simulated second)
  baseDate: null,      // Date object (simulated)
  bodyLons: null,      // latest truth sample (deg)
  bodyRateDegPerSec: null, // per-body deg/sec (per simulated second)
};

let rafId = 0;

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtLocalNoSeconds(dt) {
  const mo = pad2(dt.getMonth() + 1);
  const da = pad2(dt.getDate());
  const yr = dt.getFullYear();
  let hh = dt.getHours();
  const mm = pad2(dt.getMinutes());
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12; if (hh === 0) hh = 12;
  return `${mo}/${da}/${yr}, ${pad2(hh)}:${mm} ${ampm}`;
}

function wrap360(x) {
  x = x % 360;
  return x < 0 ? x + 360 : x;
}

// NEW: Moon phase glyphs (8-phase)
const MOON_PHASE_GLYPHS = ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"];

function moonPhaseGlyph(sunLon, moonLon) {
  // phase angle: 0=new, 180=full
  // ✅ reversed to match your band orientation
  const phase = wrap360(sunLon - moonLon);
  const idx = Math.floor((phase + 22.5) / 45) % 8;
  return MOON_PHASE_GLYPHS[idx];
}

// maps your selected unit -> ms per unit (matches main.js)
function unitMsBand(u) {
  if (u === "hour") return 3600000;
  if (u === "day") return 86400000;
  if (u === "week") return 7 * 86400000;
  if (u === "month") return 30.436875 * 86400000;
  if (u === "year") return 365.2425 * 86400000;
  return 0;
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function buildStaticBand() {
  if (!S.w || !S.h) return;

  clearNode(signBand);
  clearNode(degreeTicks);

  const bandTop = cfg.signBandY;
  const bandH = cfg.signBandH;
  const segW = S.w / 12;
  const eclipticY = S.h - cfg.eclipticFromBottom;

  // ✅ define cx ONCE, early (used by glow + boundaries + sun overlay)
  const cx = S.w / 2;

  // --- Above-ecliptic clip (glow only above the ecliptic)
  if (aboveEclipticRect) {
    aboveEclipticRect.setAttribute("x", "0");
    aboveEclipticRect.setAttribute("y", "0");
    aboveEclipticRect.setAttribute("width", String(S.w));
    aboveEclipticRect.setAttribute("height", String(eclipticY));
  }

  // --- Glow positioning (centered on the Sun, which is fixed at cx/eclipticY)
  if (sunGlow) {
    sunGlow.setAttribute("cx", String(cx));
    sunGlow.setAttribute("cy", String(eclipticY));
    sunGlow.setAttribute("r", String(cfg.sunGlowR));
  }

  // NEW: eclipse overlays sit on the Sun too
  if (solarEclipseGlow) {
    solarEclipseGlow.setAttribute("cx", String(cx));
    solarEclipseGlow.setAttribute("cy", String(eclipticY));
    solarEclipseGlow.setAttribute("r", String(cfg.eclipseGlowR));
  }
  if (lunarEclipseGlow) {
    lunarEclipseGlow.setAttribute("cx", String(cx));
    lunarEclipseGlow.setAttribute("cy", String(eclipticY));
    lunarEclipseGlow.setAttribute("r", String(cfg.eclipseGlowR));
  }

  // --- Signs tiled -1..+1 for seamless wrap
  for (let tile = -1; tile <= 1; tile++) {
    for (let i = 0; i < 12; i++) {
      const x0 = tile * S.w + i * segW;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", x0);
      rect.setAttribute("y", bandTop);
      rect.setAttribute("width", segW);
      rect.setAttribute("height", bandH);
      rect.setAttribute("fill", elementColors[signs[i].element]);
      rect.setAttribute("fill-opacity", String(cfg.signOpacity));
      rect.setAttribute("stroke", "rgba(255,255,255,0.08)");
      rect.setAttribute("stroke-width", "1");
      signBand.appendChild(rect);

      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", x0 + segW / 2);
      t.setAttribute("y", bandTop + bandH / 2 + cfg.signGlyphYOffset);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("fill", "rgba(255,255,255,0.95)");
      t.setAttribute("fill-opacity", String(cfg.signGlyphOpacity));
      t.setAttribute("font-size", String(cfg.signGlyphSize));
      t.setAttribute("font-family", glyphFont);
      t.textContent = signs[i].glyph;
      signBand.appendChild(t);
    }
  }

  // --- Ticks tiled -1..+1 (0..359 degrees)
  for (let tile = -1; tile <= 1; tile++) {
    for (let deg = 0; deg < 360; deg++) {
      const x = tile * S.w + (deg / 360) * S.w;

      const isMajor = deg % 10 === 0;
      const isMid = !isMajor && deg % 5 === 0;

      const len = isMajor ? 14 : (isMid ? 9 : 4);
      const stroke = isMajor
        ? "rgba(255,255,255,0.32)"
        : isMid
          ? "rgba(255,255,255,0.18)"
          : "rgba(255,255,255,0.08)";
      const sw = isMajor ? 2 : 1;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x);
      line.setAttribute("x2", x);
      line.setAttribute("y1", eclipticY);
      line.setAttribute("y2", eclipticY - len);
      line.setAttribute("stroke", stroke);
      line.setAttribute("stroke-width", String(sw));
      degreeTicks.appendChild(line);
    }
  }

  // --- Ecliptic line
  if (eclipticLine) {
    eclipticLine.setAttribute("x1", -S.w);
    eclipticLine.setAttribute("x2", 2 * S.w);
    eclipticLine.setAttribute("y1", eclipticY);
    eclipticLine.setAttribute("y2", eclipticY);
  }

  // --- Fixed sun overlay
  if (sunDot) {
    sunDot.setAttribute("cx", cx);
    sunDot.setAttribute("cy", eclipticY);
    sunDot.setAttribute("r", String(cfg.sunDotR));
  }
  if (sunGlyph) {
    sunGlyph.setAttribute("x", cx);
    sunGlyph.setAttribute("y", eclipticY + cfg.sunGlyphYOffset);
    sunGlyph.setAttribute("font-size", String(cfg.sunGlyphSize));
    sunGlyph.setAttribute("font-family", glyphFont);
  }

  // ensure body nodes exist (positions updated per-frame)
  ensureBodies();
}

function applyScroll(sunLon) {
  // Same math as your reference: center sun at width/2, wrap underlay.
  const raw = (S.w * 0.5) - (wrap360(sunLon) * S.pxPerDeg);
  let base = raw % S.w;
  if (base > 0) base -= S.w;

  trackGroup.setAttribute("transform", `translate(${base},0)`);
}

const BODY_META = [
  { k: "sun", glyph: "☉" },
  { k: "moon", glyph: "☽" },
  { k: "mercury", glyph: "☿" },
  { k: "venus", glyph: "♀" },
  { k: "mars", glyph: "♂" },
  { k: "jupiter", glyph: "♃" },
  { k: "saturn", glyph: "♄" },
  { k: "uranus", glyph: "♅" },
  { k: "neptune", glyph: "♆" },
  { k: "pluto", glyph: "♇" },
  { k: "mean_node", glyph: "☊" },
  { k: "south_node", glyph: "☋" },

  // asteroids (now selectable)
  { k: "chiron", glyph: "⚷" },
  { k: "ceres", glyph: "⚳" },
  { k: "pallas", glyph: "⚴" },
  { k: "juno", glyph: "⚵" },
  { k: "vesta", glyph: "⚶" },
  { k: "eros", glyph: "⟡" },
];

// All bodies except Moon (too busy)
const CONJ_KEYS = BODY_META.map(b => b.k).filter(k => k !== "moon");

const bodyEls = new Map();

function buildBodies() {
  if (!bodiesGroup || !S.w || !S.h) return;
  clearNode(bodiesGroup);
  bodyEls.clear();

  const eclipticY = S.h - cfg.eclipticFromBottom;

  for (const b of BODY_META) {
  // if filters are loaded, skip anything not selected
  if (FILTERS?.bodies instanceof Set && !FILTERS.bodies.has(b.k)) continue;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("opacity", String(cfg.bodyOpacity));

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("y1", eclipticY);
    line.setAttribute("y2", eclipticY - cfg.bodyLeaderH);
    line.setAttribute("stroke", "rgba(255,255,255,0.35)");
    line.setAttribute("stroke-width", "1");

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", String(cfg.bodyDotR));
    dot.setAttribute("fill", "rgba(255,255,255,0.9)");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "rgba(255,255,255,0.95)");
    text.setAttribute("font-size", String(cfg.bodyGlyphSize));
    text.setAttribute("font-family", b.k === "moon" ? moonFont : glyphFont);
    text.textContent = b.glyph;

    // NEW: status marker (rx / s)
    const status = document.createElementNS("http://www.w3.org/2000/svg", "text");
    status.setAttribute("text-anchor", "start");
    status.setAttribute("dominant-baseline", "middle");
    status.setAttribute("fill", "rgba(255,255,255,0.80)");
    status.setAttribute("font-size", String(cfg.statusFontSize));
    status.setAttribute("font-family", 'system-ui, sans-serif');
    status.textContent = "";
    status.setAttribute("display", "none");

    g.appendChild(line);
    g.appendChild(dot);
    g.appendChild(text);
    g.appendChild(status);

    bodiesGroup.appendChild(g);
    bodyEls.set(b.k, { g, line, dot, text, status });
  }
}

function resize() {
  if (!viewport || !svg) return;

  viewport.style.height = `${cfg.viewportH}px`;

  const r = viewport.getBoundingClientRect();
  S.w = Math.max(300, Math.floor(r.width));
  S.h = Math.max(180, Math.floor(cfg.viewportH));
  S.pxPerDeg = S.w / 360;

  svg.setAttribute("viewBox", `0 0 ${S.w} ${S.h}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  clipRect.setAttribute("width", S.w);
  clipRect.setAttribute("height", S.h);

  buildStaticBand();
  buildBodies(); // ✅ required so planets exist

  if (window.__ZY_LAST_TIME && typeof window.__ZY_LAST_TIME.sunLon === "number") {
    applyScroll(window.__ZY_LAST_TIME.sunLon);
  }
}

window.addEventListener("resize", resize);

document.addEventListener("visibilitychange", () => {
  // avoid giant dt when returning to the tab
  anim.basePerf = performance.now();
});

if ("ResizeObserver" in window && viewport) {
  const ro = new ResizeObserver(() => resize());
  ro.observe(viewport);
}

function loop() {
  rafId = requestAnimationFrame(loop);
  if (!anim.have) return;

  const now = performance.now();
  const playing = !!window.TIMELINE_IS_PLAYING;

  // per-frame dt (avoids “retroactive” jumps when speed/unit changes)
  const dtPerfMsRaw = now - anim.basePerf;
  anim.basePerf = now;

  // prevent “warp” when the tab hiccups / devtools / GC / window drag
  if (dtPerfMsRaw > 250) return; // drop this frame’s catch-up entirely
  const dtPerfMs = Math.min(50, Math.max(0, dtPerfMsRaw)); // clamp to ~20fps worst-case

  if (!playing) {
    applyScroll(anim.baseSunLon);
    updateBodies(anim.baseSunLon, anim.bodyLons);
    updateNatal(anim.baseSunLon);
    updateStars(anim.baseSunLon, anim.fixedStars);
    
    if (anim.baseDate instanceof Date) {
      const minuteKey = Math.floor(anim.baseDate.getTime() / MS_PER_MIN);
      if (minuteKey !== lastMinuteKey) {
        lastMinuteKey = minuteKey;
        dateBox.textContent = fmtLocalNoSeconds(anim.baseDate);
      }
    }
    return;
  }

  // live speed+unit every frame (no runGo needed for smooth slider response)
  const u = window.TIMELINE_UNIT || "year";
  const simRateMsPerSec = Number(window.TIMELINE_SPEED || 0) * unitMsBand(u);

  // advance simulated time by dt
  const simDeltaMs = simRateMsPerSec * (dtPerfMs / 1000);

  // sunRate is deg/sec per simulated second -> convert simDeltaMs to seconds
  anim.baseSunLon = wrap360(
    anim.baseSunLon + (Number(anim.sunRate) || 0) * (simDeltaMs / 1000)
  );

  if (anim.baseDate instanceof Date) {
    anim.baseDate = new Date(anim.baseDate.getTime() + simDeltaMs);
  }

  applyScroll(anim.baseSunLon);

  // advance bodies using deg/sec rates and the simulated seconds advanced this frame
  if (anim.bodyLons && anim.bodyRateDegPerSec) {
    const lons = anim.bodyLons;
    const rates = anim.bodyRateDegPerSec;
    const simDeltaSec = simDeltaMs / 1000;

    for (const k of Object.keys(lons)) {
      const v = Number(lons[k]);
      const r = Number(rates[k]);
      if (!Number.isFinite(v) || !Number.isFinite(r)) continue;
      lons[k] = wrap360(v + r * simDeltaSec);
    }
  }

  updateBodies(anim.baseSunLon, anim.bodyLons);
  updateNatal(anim.baseSunLon);
  updateStars(anim.baseSunLon, anim.fixedStars);

    // date text: keep stable-ish while playing (minute cadence)
    if (anim.baseDate instanceof Date) {
      const minuteKey = Math.floor(anim.baseDate.getTime() / MS_PER_MIN);
      if (minuteKey !== lastMinuteKey) {
        lastMinuteKey = minuteKey;
        dateBox.textContent = fmtLocalNoSeconds(anim.baseDate);
      }
    }
 }

  // =====================
  // Natal (static under-ecliptic)
  // =====================
  let NATAL = null;

  window.addEventListener("zy:natal", (e) => {
    NATAL = e?.detail || null;
    // force a redraw next zy:time tick (positions depend on sun-centered view)
  });

  window.addEventListener("zy:time", (e) => {
    // Birth Calculate should NEVER move the band
    if (e?.detail?.origin === "birthCalc") return;

    const { date, sunLon, sunRateDegPerSec, bodyLons, bodyRateDegPerSec, fixedStars } = e.detail || {};

    if (!(date instanceof Date) || typeof sunLon !== "number") return;

    window.__ZY_LAST_TIME = { date, sunLon };

    anim.have = true;
    anim.basePerf = performance.now();
    anim.baseSunLon = wrap360(sunLon);
    anim.sunRate = Number(sunRateDegPerSec) || 0;
    anim.baseDate = date;

    // bodies: copy so our per-frame integration doesn't mutate the source object
    anim.bodyLons = bodyLons ? { ...bodyLons } : null;
    anim.bodyRateDegPerSec = bodyRateDegPerSec ? { ...bodyRateDegPerSec } : null;
    anim.fixedStars = fixedStars || null;

    // ✅ Apply the current Stars modal selection ONLY when new ephemeris arrives
    // (so pill toggles won't instantly change the band)
    try {
      const raw = localStorage.getItem("zy_filters_v1");
      const obj = raw ? JSON.parse(raw) : null;
      __STAR_APPLIED = Array.isArray(obj?.stars) ? obj.stars.slice() : [];
    } catch {
      __STAR_APPLIED = [];
    }

    resize();

    // snap immediately to truth (stable)
    applyScroll(anim.baseSunLon);
    updateBodies(anim.baseSunLon, anim.bodyLons);
    updateNatal(anim.baseSunLon);
    updateStars(anim.baseSunLon, fixedStars);
    dateBox.textContent = fmtLocalNoSeconds(date);

    if (!rafId) loop();
  });

  // expose knobs
  window.ZY_BAND_CFG = cfg;
  window.ZY_BAND_REDRAW = () => { resize(); };
  resize();



