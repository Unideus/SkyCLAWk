// ===============================
// ZODI-YUGA SKY CLOCK
// Main JavaScript (Refactor Step 2/3)
// Drop-in replacement for js/main.js
// ===============================

(() => {
  "use strict";

  // -----------------------------
  // Helpers
  // -----------------------------
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const toNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const norm360 = (deg) => {
    deg = deg % 360;
    if (deg < 0) deg += 360;
    return deg;
  };

  const lerp = (a, b, t) => a + (b - a) * t;

  // shortest-path angle interpolation (degrees)
  const lerpAngle = (a, b, t) => {
    let d = ((b - a + 540) % 360) - 180;
    return a + d * t;
  };

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const safeOn = (el, type, handler, opts) => {
    if (!el) return;
    el.addEventListener(type, handler, opts);
  };

  const setDisplay = (el, on, display = "block") => {
    if (!el) return;
    el.style.display = on ? display : "none";
  };

  // -----------------------------
  // Canonical state
  // -----------------------------
  const state = {
    // geometry
    R_ECLIPTIC: 340,

    // vendor ephemeris epoch (keeps planets stable when paused/reset)
    epochMs: new Date(2020, 12, 21, 0, 0, 0).getTime(), // Dec 21 2020 (local midnight)


    // view geometry (must match SVG)
    VIEW_CX: 400,
    VIEW_CY: 512,

    ENP_OFFSET_X: 0,
    ENP_OFFSET_Y: -60,

    // time / animation
    skyAngle: 0,
    eclAngle: 0,
    simDays: 0,
    animationRunning: false,
    lastTime: performance.now(),

    // rates
    skyRate: 10, // deg/s
    dayRate: 0,  // days/s

    // transitions
    resetTransition: null,
    modeTransition: null,
    lastMode: null,

    // yuga
    YUGA_NCP_OFFSET_DEG: 148,
    YUGA_ENP_OFFSET_DEG: 60,
    yugaOrbitAngle: 60,
    YUGA_ORBIT_SIGN: 1,
    YUGA_ORBIT_OFFSET_DEG: 0,
	
	// yuga entry snap (starting angle when you click Yuga)
    YUGA_ENTRY_SNAP_DEG: 300,

    // polar yuga ring tweak
    POLAR_YUGA_ROTATION_DEG: 300,

    // analemma stamping
    analemmaLastHitLen: null,
    analemmaAccumulatedTravel: 0,
    analemmaLastDriverDeg: null,
    ANALemma_STAMP_COUNT: 36,
  };

  // -----------------------------
  // DOM cache
  // -----------------------------
  const dom = {
    skyRotator: null,
    enpRotator: null,

    debug: null,
    debugText: null,

    vitruv: null,
    square: null,
    ncpGrid: null,
    enpGrid: null,
    constellationsLayer: null,

    planetEls: {},

    playBtn: null,
    speedSkySlider: null,
    speedPlanetsSlider: null,
    skyReadout: null,
    planetReadout: null,

    // yuga layers
    yugaRing: null,
    polarYugaRing: null,
    timeLayerImg: null,
    toggleYuga: null,
    togglePolarYuga: null,
    toggleTime: null,
    yugaOpacity: null,

    // bullinger
    bullingerTransform: null,
    bullingerOpacity: null,

    // glyphs & signs
    GLYPH_TEXTS: [],
    ARCS: [],
  };

  // -----------------------------
  // Debug panel (safe)
  // -----------------------------
  function updateDebugPanel(data) {
    if (!dom.debug || !data) return;
    dom.debug.textContent =
      `Sun λ: ${data.sunLambda?.toFixed?.(2) ?? "—"}\n` +
      `Sun θ: ${data.sunAngle?.toFixed?.(2) ?? "—"}\n` +
      `Radius: ${data.sunR?.toFixed?.(2) ?? "—"}\n` +
      `Sign: ${data.signIdx ?? "—"}\n` +
      `Band: ${data.bandId ?? "—"}`;
  }

	  // -----------------------------
	  // Mode
	  // -----------------------------
	  function getMode() {
		return document.querySelector('input[name="mode"]:checked')?.value || "fixed";
	  }

	  // -----------------------------
	  // Planet model constants
	  // -----------------------------
	  const SUN_PERIOD = 365.256;
	  const MOON_PERIOD = 27.321661;
	  const MERCURY_ORBIT = 87.969;
	  const VENUS_ORBIT = 224.701;
	  const MARS_PERIOD = 686.98;
	  const JUPITER_PERIOD = 4332.59;
	  const SATURN_PERIOD = 10759.22;

	  const MERCURY_ELONG = 22;
	  const VENUS_ELONG = 47;

	  const SUN_L0 = 130;
	  const MOON_L0 = 105;
	  const MARS_L0 = 220;
	  const JUPITER_L0 = 253;
	  const SATURN_L0 = 288;
	  const SPECIAL_MODE_SUN_L0 = 10.18;

	  const MERCURY_PHASE0 = Math.PI / 2;
	  const VENUS_PHASE0 = Math.PI / 2;

	  function getGeocentricLongitudes(simDays) {
		// Prefer vendor ephemeris if installed (retrograde-correct)
		try {
		  if (window.SkyclockEphemeris?.getEclipticLongitudes) {
			const date = new Date(state.epochMs + simDays * 86400000); // simDays -> real date
			return SkyclockEphemeris.getEclipticLongitudes(date);
		  }
		} catch (e) {
		  console.warn("Vendor ephemeris failed; falling back to toy model:", e);
		}

		// Fallback: original simple model
		const sunL = norm360(SUN_L0 + 360 * (simDays / SUN_PERIOD));
		const moonL = norm360(MOON_L0 + 360 * (simDays / MOON_PERIOD));

		const phaseMerc = MERCURY_PHASE0 + 2 * Math.PI * (simDays / MERCURY_ORBIT);
		const mercL = norm360(sunL + MERCURY_ELONG * Math.sin(phaseMerc));

		const phaseVenus = VENUS_PHASE0 + 2 * Math.PI * (simDays / VENUS_ORBIT);
		const venusL = norm360(sunL + VENUS_ELONG * Math.sin(phaseVenus));

		const marsL = norm360(MARS_L0 + 360 * (simDays / MARS_PERIOD));
		const jupL = norm360(JUPITER_L0 + 360 * (simDays / JUPITER_PERIOD));
		const satL = norm360(SATURN_L0 + 360 * (simDays / SATURN_PERIOD));

		return { sun: sunL, moon: moonL, mercury: mercL, venus: venusL, mars: marsL, jupiter: jupL, saturn: satL };
	  }

		// DEBUG: expose for DevTools console testing
		window.__getGeocentricLongitudes = getGeocentricLongitudes;

  // -----------------------------
  // Yuga orbit
  // -----------------------------
  function computeYugaOrbitAngleFromSun(sunLambdaDeg) {
    state.yugaOrbitAngle = norm360(
      state.YUGA_ORBIT_SIGN * (180 - sunLambdaDeg) +
        state.YUGA_ORBIT_OFFSET_DEG +
        state.YUGA_NCP_OFFSET_DEG
    );
  }

  // -----------------------------
  // Transitions
  // -----------------------------
  function startResetTransition(targetSky = 0, targetEcl = 0, duration = 1200) {
    state.resetTransition = {
      startSky: state.skyAngle,
      startEcl: state.eclAngle,
      targetSky,
      targetEcl,
      startTime: performance.now(),
      duration,
    };
  }

  function startModeTransition(fromMode, toMode, duration = 1200) {
    if (fromMode === "yuga" || toMode === "yuga") {
      const lambdas = getGeocentricLongitudes(state.simDays);
      computeYugaOrbitAngleFromSun(lambdas.sun);
    }

    const fromPivot = fromMode === "yuga" ? 1 : 0;
    const toPivot = toMode === "yuga" ? 1 : 0;

    const fromSkyRot = fromMode === "yuga" ? state.yugaOrbitAngle : state.skyAngle;
    const yugaEnpRot = -(state.yugaOrbitAngle + state.YUGA_ENP_OFFSET_DEG);
    const fromEnpRot = fromMode === "yuga" ? yugaEnpRot : state.eclAngle;

    let toSkyRot, toEnpRot;

    if (toMode === "yuga") {
      toSkyRot = state.yugaOrbitAngle;
      toEnpRot = yugaEnpRot;
    } else if (fromMode === "yuga") {
      toSkyRot = 0;
      toEnpRot = yugaEnpRot; // preserve ENP history frame on exit
    } else {
      toSkyRot = state.skyAngle;
      toEnpRot = state.eclAngle;
    }

    state.modeTransition = {
      fromMode,
      toMode,
      startTime: performance.now(),
      duration,
      fromPivot,
      toPivot,
      fromSkyRot,
      toSkyRot,
      fromEnpRot,
      toEnpRot,
      t: 0,
    };
  }

  // -----------------------------
  // Speeds + readouts
  // -----------------------------
  function sliderToSkyRate(v) {
    return toNum(v, 0);
  }

  function sliderToDayRate(v) {
    const ZERO = 25;
    v = toNum(v, ZERO);

    if (v < ZERO) return -5 * ((ZERO - v) / ZERO);
    if (v === ZERO) return 0;

    const t = (v - ZERO) / (100 - ZERO);
    return 30 * Math.pow(t, 2.5);
  }

  function updateReadouts() {
    if (dom.skyReadout && dom.speedSkySlider) {
      dom.skyReadout.textContent = `${toNum(dom.speedSkySlider.value, 0).toFixed(1)}°/s`;
    }
    if (dom.planetReadout) {
      dom.planetReadout.textContent = `${state.dayRate.toFixed(2)} d/s`;
    }
  }

  // -----------------------------
  // Grid drawing
  // -----------------------------
  function drawGrid({ container, radialColor, radius, circleColor, circleRadius, spokes = 12 }) {
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    for (let i = 0; i < spokes; i++) {
      const a = ((i * 360) / spokes) * (Math.PI / 180);
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", 0);
      line.setAttribute("y1", 0);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", radialColor);
      line.setAttribute("stroke-width", 1);
      container.appendChild(line);
    }

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", 0);
    circle.setAttribute("cy", 0);
    circle.setAttribute("r", circleRadius);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", circleColor);
    circle.setAttribute("stroke-width", 1);
    circle.setAttribute("stroke-dasharray", "5 4");
    container.appendChild(circle);
  }

  // -----------------------------
  // Toggle wiring utilities
  // -----------------------------
  function wireToggleDisplay(toggleId, targetEl, display = "block") {
    const toggle = $(toggleId);
    if (!toggle || !targetEl) return;
    const sync = () => setDisplay(targetEl, !!toggle.checked, display);
    safeOn(toggle, "change", sync);
    sync();
  }

  function wireOpacityStyle(targetId, sliderId) {
    const target = $(targetId);
    const slider = $(sliderId);
    if (!target || !slider) return;
    const sync = () => (target.style.opacity = slider.value);
    safeOn(slider, "input", sync);
    sync();
  }

  function wireOpacitySvgAttr(targetId, sliderId, attr = "opacity") {
    const target = $(targetId);
    const slider = $(sliderId);
    if (!target || !slider) return;
    const sync = () => target.setAttribute(attr, slider.value);
    safeOn(slider, "input", sync);
    sync();
  }

  // -----------------------------
  // Tropical system
  // -----------------------------
  const TROPICAL_BAND_IDS = ["band1-can", "band2-can", "band3-can", "band1-cap", "band2-cap", "band3-cap"];

  const SIGN_TO_BAND = [
    "band1-can", "band2-can", "band3-can",
    "band3-can", "band2-can", "band1-can",
    "band1-cap", "band2-cap", "band3-cap",
    "band3-cap", "band2-cap", "band1-cap",
  ];

  const SIGN_COLORS = [
    "rgba(255,0,0,0.6)",
    "rgba(0,100,0,0.6)",
    "rgba(255,255,0,0.6)",
    "rgba(59,130,246,0.6)",
    "rgba(255,0,0,0.6)",
    "rgba(0,100,0,0.6)",
    "rgba(255,255,0,0.6)",
    "rgba(59,130,246,0.6)",
    "rgba(255,0,0,0.6)",
    "rgba(0,100,0,0.6)",
    "rgba(255,255,0,0.6)",
    "rgba(59,130,246,0.6)",
  ];

  function isTropicalSystemOn() {
    return !!$("toggle-tropical-system")?.checked;
  }

  function getTropicalSignMode() {
    return document.querySelector('input[name="tropical-sign-mode"]:checked')?.value || "dynamic";
  }

  function updateTropicalLatitudes() {
    const tropicalOn = isTropicalSystemOn();

    const cancerOn = tropicalOn && !!$("toggle-cancer")?.checked;
    const equatorOn = tropicalOn && !!$("toggle-equator")?.checked;
    const capricornOn = tropicalOn && !!$("toggle-capricorn")?.checked;

    const southCrossNorthOn = tropicalOn && !!$("toggle-southern-cross-north")?.checked;
    const southCrossSouthOn = tropicalOn && !!$("toggle-southern-cross-south")?.checked;

    const signRingsOn = tropicalOn && !!$("toggle-tropical-sign-rings")?.checked;

    setDisplay($("tropic-cancer-group"), cancerOn);
    setDisplay($("equator-group"), equatorOn);
    setDisplay($("tropic-capricorn-group"), capricornOn);
    setDisplay($("southern-cross-north-group"), southCrossNorthOn);
    setDisplay($("southern-cross-south-group"), southCrossSouthOn);
    setDisplay($("tropical-sign-rings"), signRingsOn);
  }

  function initTropicalBands() {
    TROPICAL_BAND_IDS.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.style.display = "block";
      el.style.opacity = "0";
    });
  }

  // -----------------------------
  // Geometry helpers
  // -----------------------------
  function rot2D(x, y, deg) {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a), s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function getSunNcpPolar(lambdaDeg) {
    const rad = Math.PI - (lambdaDeg * Math.PI / 180);
    let x = state.R_ECLIPTIC * Math.cos(rad);
    let y = state.R_ECLIPTIC * Math.sin(rad);

    // apply eclAngle in non-precession modes (mirrors your existing behavior)
    if (getMode() !== "precession") {
      ({ x, y } = rot2D(x, y, state.eclAngle));
    }

    // ENP->NCP offset
    y += state.ENP_OFFSET_Y;

    const r = Math.hypot(x, y);
    const theta = (Math.atan2(y, x) * 180) / Math.PI;
    return { x, y, r, theta };
  }

  // -----------------------------
  // Planets placement + labels
  // -----------------------------
  const PLANET_LABEL_OFFSET = 22;

  function placePlanetWithLabel(group, lambdaDeg) {
    if (!group) return;

    const rad = Math.PI - (lambdaDeg * Math.PI / 180);
    const px = state.R_ECLIPTIC * Math.cos(rad);
    const py = state.R_ECLIPTIC * Math.sin(rad);

    const mode = getMode();

    if (mode === "precession" && group.id === "planet-sun") {
      group.setAttribute("transform", `rotate(${-state.eclAngle}) translate(${px}, ${py})`);
    } else {
      group.setAttribute("transform", `translate(${px}, ${py})`);
    }

    const label = group.querySelector(".planet-label");
    if (!label) return;

    const r = Math.hypot(px, py) || 1;
    const ux = px / r;
    const uy = py / r;

    let cancelRotation = 0;
    if (mode === "real-time") cancelRotation = -(state.skyAngle + state.eclAngle);
    else if (mode === "precession") cancelRotation = group.id === "planet-sun" ? 0 : -state.eclAngle;

    label.setAttribute(
      "transform",
      `translate(${ux * PLANET_LABEL_OFFSET}, ${uy * PLANET_LABEL_OFFSET}) rotate(${cancelRotation})`
    );
  }

  // -----------------------------
  // Glyph legibility
  // -----------------------------
  function updateGlyphLegibility() {
    const GLYPH_SELF_ROTATION = 103;
    const mode = getMode();
    const cancel = mode === "real-time"
      ? -state.skyAngle
      : mode === "yuga"
        ? -state.yugaOrbitAngle
        : 0;

    for (const t of dom.GLYPH_TEXTS) {
      if (!t) continue;
      const x = parseFloat(t.getAttribute("x") || "0");
      const y = parseFloat(t.getAttribute("y") || "0");
      t.setAttribute("transform", `rotate(${cancel + GLYPH_SELF_ROTATION} ${x} ${y})`);
    }
  }

  // -----------------------------
  // Analemma dots
  // -----------------------------
  function getAnalemmaStaticGroup() {
    return $("analema-static-group") || $("analemma-static-group");
  }

  function clearAnalemmaDots() {
    const g = $("analemma-dots");
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
  }

  function stampAnalemmaDot(x, y) {
    const g = $("analemma-dots");
    if (!g) return;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", x);
    c.setAttribute("cy", y);
    c.setAttribute("r", "7");
    c.setAttribute("fill", "#ffcc00");
    c.setAttribute("opacity", "0.85");
    g.appendChild(c);
  }

  function resetAnalemmaStamping() {
    state.analemmaLastHitLen = null;
    state.analemmaAccumulatedTravel = 0;
    state.analemmaLastDriverDeg = null;
  }

  function updateAnalemmaFromIntersection(analemmaPath, hitLen) {
    const total = analemmaPath.getTotalLength();
    if (!total || total <= 0) return;

    let L = hitLen % total;
    if (L < 0) L += total;

    if (state.analemmaLastHitLen === null) {
      state.analemmaLastHitLen = L;
      state.analemmaAccumulatedTravel = 0;
      const p0 = analemmaPath.getPointAtLength(L);
      stampAnalemmaDot(p0.x.toFixed(2), p0.y.toFixed(2));
      return;
    }

    let d = L - state.analemmaLastHitLen;
    if (d > total / 2) d -= total;
    if (d < -total / 2) d += total;

    state.analemmaAccumulatedTravel += Math.abs(d);
    state.analemmaLastHitLen = L;

    const step = total / state.ANALemma_STAMP_COUNT;
    if (state.analemmaAccumulatedTravel >= step) {
      state.analemmaAccumulatedTravel -= step;
      const p = analemmaPath.getPointAtLength(L);
      stampAnalemmaDot(p.x.toFixed(2), p.y.toFixed(2));
    }
  }

  // -----------------------------
  // Analemma intersection solver (cached sampling)
  // Exposes: window.__solveAnalemmaHit
  // -----------------------------
  (function buildAnalemmaSolver() {
    const STATE_KEY = "__ANALemmaTrackState__";
    const S = (window[STATE_KEY] = window[STATE_KEY] || {
      pathEl: null,
      total: 0,
      n: 0,
      xs: null,
      ys: null,
      lens: null,
      lastLen: null,
      lastDriverDeg: null,
      dir: -1,
    });

    const SAMPLES = 4096;
    const TOL_PX = 0.5;
    const MINSTEP_FRAC = 1 / 2000;
    const REFINE_ITERS = 12;
    const LEN_SMOOTH = 0.75;

    const wrapLen = (len, total) => {
      len %= total;
      if (len < 0) len += total;
      return len;
    };

    const wrapDelta = (from, to, total) => {
      let d = (to - from) % total;
      if (d > total / 2) d -= total;
      if (d < -total / 2) d += total;
      return d;
    };

    const angleDelta = (a, b) => {
      let d = (a - b) % 360;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return d;
    };

    function ensureCache(path) {
      if (S.pathEl === path && S.xs && S.ys && S.lens) return;

      const total = path.getTotalLength();
      const n = SAMPLES;

      const xs = new Float32Array(n + 1);
      const ys = new Float32Array(n + 1);
      const lens = new Float32Array(n + 1);

      for (let i = 0; i <= n; i++) {
        const len = (i / n) * total;
        const p = path.getPointAtLength(len);
        xs[i] = p.x;
        ys[i] = p.y;
        lens[i] = len;
      }

      S.pathEl = path;
      S.total = total;
      S.n = n;
      S.xs = xs;
      S.ys = ys;
      S.lens = lens;
      S.lastLen = null;
      S.lastDriverDeg = null;
    }

    function distToCircleForPoint(x, y, C, cx, cy, r) {
      const ex = x * C.a + y * C.c + C.e - cx;
      const ey = x * C.b + y * C.d + C.f - cy;
      return Math.hypot(ex, ey) - r;
    }

    function refineRoot(path, C, cx, cy, r, L0, L1, d0, d1) {
      let lo = L0, hi = L1;
      let dlo = d0, dhi = d1;

      if ((dlo < 0) === (dhi < 0)) {
        return Math.abs(dlo) <= Math.abs(dhi) ? lo : hi;
      }

      for (let i = 0; i < REFINE_ITERS; i++) {
        const mid = 0.5 * (lo + hi);
        const p = path.getPointAtLength(mid);
        const dm = distToCircleForPoint(p.x, p.y, C, cx, cy, r);

        if ((dlo < 0) !== (dm < 0)) {
          hi = mid;
          dhi = dm;
        } else {
          lo = mid;
          dlo = dm;
        }
      }
      return 0.5 * (lo + hi);
    }

    function getExpectedDecl(simDays) {
      const doy = ((simDays % SUN_PERIOD) / SUN_PERIOD) * 365.25;
      return 23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365.25);
    }

    function solve(path, circleEl, driverDeg) {
      ensureCache(path);

      const total = S.total;
      const n = S.n;
      const xs = S.xs, ys = S.ys, lens = S.lens;

      const mA = path.getCTM();
      const mE = circleEl.getCTM();
      if (!mA || !mE) return null;

      const invE = mE.inverse();
      const C = invE.multiply(mA);

      const cx = parseFloat(circleEl.getAttribute("cx") || "0");
      const cy = parseFloat(circleEl.getAttribute("cy") || "0");
      const r = parseFloat(circleEl.getAttribute("r") || "0");
      if (!Number.isFinite(r) || r <= 0) return null;

      const d = new Float64Array(n + 1);
      let bestI = 0;
      let bestAbs = Infinity;

      for (let i = 0; i <= n; i++) {
        const di = distToCircleForPoint(xs[i], ys[i], C, cx, cy, r);
        d[i] = di;
        const a = Math.abs(di);
        if (a < bestAbs) {
          bestAbs = a;
          bestI = i;
        }
      }

      const cand = [];
      const tol = TOL_PX;

      for (let i = 0; i < n; i++) {
        const d0 = d[i];
        const d1 = d[i + 1];

        if (Math.abs(d0) <= tol) cand.push({ L: lens[i], i0: i, i1: i, d0, d1: d0, near: true });
        if (Math.abs(d1) <= tol) cand.push({ L: lens[i + 1], i0: i + 1, i1: i + 1, d0: d1, d1, near: true });

        if ((d0 < 0) !== (d1 < 0)) {
          const t = d0 / (d0 - d1);
          const L = lens[i] + (lens[i + 1] - lens[i]) * t;
          cand.push({ L, i0: i, i1: i + 1, d0, d1, near: false });
        }
      }

      if (!cand.length) {
        const L = lens[bestI];
        const p = path.getPointAtLength(L);
        S.lastLen = L;
        S.lastDriverDeg = driverDeg;
        return { len: L, x: p.x, y: p.y };
      }

      cand.sort((a, b) => a.L - b.L);
      const uniq = [];
      const minSep = total / 3500;

      for (const c of cand) {
        if (!uniq.length || Math.abs(c.L - uniq[uniq.length - 1].L) > minSep) uniq.push(c);
      }

      const expectedDecl = getExpectedDecl(state.simDays);
      const declSign = Math.sign(expectedDecl);

      uniq.forEach((c) => {
        const p = path.getPointAtLength(c.L);
        const yLocal = p.y;
        c.score = Math.abs(yLocal) * (Math.sign(yLocal) === declSign ? 0.5 : 2);
      });

      let chosen = uniq[0];

      if (S.lastLen == null) {
        let bestY = Infinity;
        for (const c of uniq) {
          const p = path.getPointAtLength(wrapLen(c.L, total));
          if (p.y < bestY) {
            bestY = p.y;
            chosen = c;
          }
        }
      } else {
        const dAng = S.lastDriverDeg == null ? 0 : angleDelta(driverDeg, S.lastDriverDeg);
        const minStep = total * MINSTEP_FRAC;
        const approxStep = Math.max((Math.abs(dAng) / 360) * total, minStep);
        const pred = wrapLen(S.lastLen + S.dir * approxStep, total);

        let bestD = Infinity;
        for (const c of uniq) {
          const L = wrapLen(c.L, total);
          const dd = Math.abs(wrapDelta(pred, L, total)) + c.score;
          if (dd < bestD) {
            bestD = dd;
            chosen = c;
          }
        }
      }

      let finalLen = wrapLen(chosen.L, total);

      if (chosen.i0 !== chosen.i1) {
        const L0 = lens[chosen.i0];
        const L1 = lens[chosen.i1];
        finalLen = refineRoot(path, C, cx, cy, r, L0, L1, chosen.d0, chosen.d1);
        finalLen = wrapLen(finalLen, total);
      }

      if (S.lastLen != null) {
        const dl = wrapDelta(S.lastLen, finalLen, total);
        const minStep = total * MINSTEP_FRAC * 0.5;
        if (Math.abs(dl) > minStep) S.dir = Math.sign(dl) || S.dir;

        const sm = wrapDelta(S.lastLen, finalLen, total);
        finalLen = wrapLen(S.lastLen + LEN_SMOOTH * sm, total);
      }

      S.lastLen = finalLen;
      S.lastDriverDeg = driverDeg;

      const pFinal = path.getPointAtLength(finalLen);
      return { len: finalLen, x: pFinal.x, y: pFinal.y };
    }

    window.__solveAnalemmaHit = solve;
  })();

  // -----------------------------
  // Yuga layers controller
  // -----------------------------
  function updateYugaLayers() {
    const opacity = dom.yugaOpacity ? Number(dom.yugaOpacity.value) : 1;

    const setLayer = (layerEl, toggleEl) => {
      if (!layerEl || !toggleEl) return;
      const on = !!toggleEl.checked;
      layerEl.style.display = on ? "block" : "none";
      layerEl.style.opacity = on ? opacity : 0;
    };

    setLayer(dom.yugaRing, dom.toggleYuga);
    setLayer(dom.polarYugaRing, dom.togglePolarYuga);
    setLayer(dom.timeLayerImg, dom.toggleTime);
  }

  // Keep the polar-yuga artwork "locked" (no drifting) while the sky frame rotates in Yuga.
  // NOTE: polar-yuga-ring sits under #sky-rotator, so we counter-rotate by the applied sky rotation.
	function updatePolarYugaRing(mode, appliedEnpRotDeg = 0, appliedSkyRotDeg = 0) {
	  const ring = dom.polarYugaRing || $("polar-yuga-ring");
	  if (!ring) return;

	  if (mode === "yuga") {
		// ring inherits BOTH: skyRotator rotation + enpRotator rotation
		const a = norm360(state.POLAR_YUGA_ROTATION_DEG - appliedEnpRotDeg - appliedSkyRotDeg);
		ring.setAttribute("transform", `rotate(${a})`);
	  } else {
		ring.removeAttribute("transform");
	  }
	}



  // -----------------------------
  // Update transforms (single authority)
  // -----------------------------
  function updateTransforms() {
    const mode = getMode();
    if (!dom.skyRotator || !dom.enpRotator) return;

    // transition override
    if (state.modeTransition) {
      const t = state.modeTransition.t || 0;

      const pivotT = lerp(state.modeTransition.fromPivot, state.modeTransition.toPivot, t);
      const skyRot = lerpAngle(state.modeTransition.fromSkyRot, state.modeTransition.toSkyRot, t);
      const enpRot = lerpAngle(state.modeTransition.fromEnpRot, state.modeTransition.toEnpRot, t);

      const px = state.ENP_OFFSET_X * pivotT;
      const py = state.ENP_OFFSET_Y * pivotT;

      dom.skyRotator.setAttribute(
        "transform",
        `translate(${state.VIEW_CX},${state.VIEW_CY}) translate(${px},${py}) rotate(${skyRot}) translate(${-px},${-py})`
      );
      dom.enpRotator.setAttribute("transform", `rotate(${enpRot})`);

	// keep polar ring consistent with what is actually being applied during the transition
	updatePolarYugaRing(mode, enpRot, skyRot);

      updateGlyphLegibility();

      if (dom.debug) {
        dom.debug.textContent =
          `Mode: ${mode} | (Transition) Sky:${skyRot.toFixed(0)}° Ecl:${enpRot.toFixed(0)}° | Yuga:${state.yugaOrbitAngle.toFixed(0)}°`;
      }
      return;
    }

    // yuga orbit derived only from simDays
    if (mode === "yuga") {
      const { sun } = getGeocentricLongitudes(state.simDays);
      computeYugaOrbitAngleFromSun(sun);
    } else {
      state.yugaOrbitAngle = 0;
    }

    // SKY rotator (NCP)
    if (mode === "yuga") {
      dom.skyRotator.setAttribute(
        "transform",
        `translate(${state.VIEW_CX},${state.VIEW_CY}) translate(${state.ENP_OFFSET_X},${state.ENP_OFFSET_Y}) rotate(${state.yugaOrbitAngle}) translate(${-state.ENP_OFFSET_X},${-state.ENP_OFFSET_Y})`
      );
    } else {
      const applySky = mode === "real-time" || !!state.resetTransition;
      dom.skyRotator.setAttribute(
        "transform",
        applySky
          ? `translate(${state.VIEW_CX},${state.VIEW_CY}) rotate(${state.skyAngle})`
          : `translate(${state.VIEW_CX},${state.VIEW_CY})`
      );
    }

	// ENP rotator (ecliptic)
		let enpRotApplied = 0;

		if (mode === "yuga") {
		  enpRotApplied = -(state.yugaOrbitAngle + state.YUGA_ENP_OFFSET_DEG);
		  dom.enpRotator.setAttribute("transform", `rotate(${enpRotApplied})`);
		} else {
		  const applyEcl = mode === "precession" || mode === "real-time" || !!state.resetTransition;
		  enpRotApplied = applyEcl ? state.eclAngle : 0;
		  dom.enpRotator.setAttribute("transform", `rotate(${enpRotApplied})`);
		}

		// lock polar ring against the actually-applied ENP rotation
		updatePolarYugaRing(mode, enpRotApplied, mode === "yuga" ? state.yugaOrbitAngle : 0);

    updateGlyphLegibility();

    if (dom.debug) {
      dom.debug.textContent =
        `Mode: ${mode} | Sky: ${state.skyAngle.toFixed(0)}° | Ecl: ${state.eclAngle.toFixed(0)}° | Yuga: ${state.yugaOrbitAngle.toFixed(0)}°`;
    }

    // Analemma sun marker + stamping
    const analemmaToggle = $("toggle-analemma");
    const analemmaOn = !!analemmaToggle?.checked;

    const analemmaPath = $("analemma-path");
    const sunMarker = $("analemma-sun-marker");
    const eclipticCircle = document.querySelector("#ecliptic-group circle");

    // show/hide static analemma group (supports both spellings)
    const staticGroup = getAnalemmaStaticGroup();
    if (staticGroup) staticGroup.style.display = analemmaOn ? "block" : "none";

    const driverDeg = mode === "yuga" ? state.yugaOrbitAngle : state.skyAngle;

    const want =
      analemmaOn &&
      analemmaPath &&
      sunMarker &&
      eclipticCircle &&
      typeof window.__solveAnalemmaHit === "function";

    if (want) {
      const hit = window.__solveAnalemmaHit(analemmaPath, eclipticCircle, driverDeg);
      if (hit) {
        sunMarker.setAttribute("cx", hit.x.toFixed(2));
        sunMarker.setAttribute("cy", hit.y.toFixed(2));
        sunMarker.style.display = "block";

        // stamp based on driver advance
        const advanceThreshold = 2.0;

        if (state.analemmaLastDriverDeg == null) {
          state.analemmaLastDriverDeg = driverDeg;
        } else {
          let delta = driverDeg - state.analemmaLastDriverDeg;
          if (delta < 0) delta += 360;

          if (delta >= advanceThreshold) {
            updateAnalemmaFromIntersection(analemmaPath, hit.len);
            state.analemmaLastDriverDeg = driverDeg;
          }
        }
      } else {
        sunMarker.style.display = "none";
      }
    } else {
      if (window.__ANALemmaTrackState__) {
        window.__ANALemmaTrackState__.lastLen = null;
        window.__ANALemmaTrackState__.lastDriverDeg = null;
      }
      if (sunMarker) sunMarker.style.display = "none";
    }
  }
  
	// -----------------------------
	// Update planets + overlays (single authority)
	// -----------------------------
	function updatePlanets() {
	  const mode = getMode();

	  // Helper: SVG-safe visibility toggle (clears inline display:none correctly)
	  const show = (el, on) => {
		if (!el) return;
		el.style.display = on ? "" : "none";
	  };

	  const lambdas = (() => {
		if (mode === "precession") {
		  const base = getGeocentricLongitudes(0);
		  return { ...base, sun: SPECIAL_MODE_SUN_L0 };
		}

		if (mode === "yuga") {
		  const l = getGeocentricLongitudes(state.simDays);
		  const SUN_YUGA_VISUAL_OFFSET_DEG = 286.5;
		  return { ...l, sun: norm360(l.sun - SUN_YUGA_VISUAL_OFFSET_DEG) };
		}

		return getGeocentricLongitudes(state.simDays);
	  })();

	  // -----------------------------
	  // PLANETS
	  // -----------------------------
	  const planetsToggle = $("toggle-planets");
	  const sunForced = (mode === "precession" || mode === "yuga");
	  const planetsOn = sunForced ? false : !!planetsToggle?.checked;

	  // Ensure parent group isn't stuck hidden
	  const planetsGroup = $("planets-group");
	  show(planetsGroup, planetsOn || sunForced);

	  for (const [k, el] of Object.entries(dom.planetEls)) {
		if (!el) continue;
		if (typeof lambdas[k] !== "number") continue;

		placePlanetWithLabel(el, lambdas[k]);

		if (k === "sun") {
		  show(el, sunForced || planetsOn);
		} else {
		  show(el, planetsOn);
		}
	  }

	  // -----------------------------
	  // TROPICAL OVERLAYS
	  // -----------------------------
	  const tropicalOn = isTropicalSystemOn();
	  const signsOn   = tropicalOn && !!$("toggle-tropical-signs")?.checked;
	  const bandsOn   = tropicalOn && !!$("toggle-tropical-bands")?.checked;
	  const seasonsOn = tropicalOn && !!$("toggle-seasons")?.checked;
	  const signMode  = getTropicalSignMode();

	  // sun sign index from NCP-polar angle
	  const sunPolar = getSunNcpPolar(lambdas.sun);
	  const sunNcpAngle = norm360((Math.atan2(-sunPolar.y, sunPolar.x) * 180) / Math.PI + 180);
	  const sunSignIdx = Math.floor(sunNcpAngle / 30) % 12;

	  // glyphs
	  dom.GLYPH_TEXTS.forEach((t, i) => {
		if (!t) return;
		if (!signsOn) show(t, false);
		else if (signMode === "all") show(t, true);
		else show(t, i === sunSignIdx);
	  });

	  // sign arcs
	  dom.ARCS.forEach((a, i) => {
		if (!a) return;
		if (!signsOn) show(a, false);
		else if (signMode === "all") show(a, true);
		else show(a, i === sunSignIdx);
	  });

	  // tropical bands (hard-hide all, then show selected)
	  let bandId = null;
	  TROPICAL_BAND_IDS.forEach((id) => {
		const el = $(id);
		if (!el) return;
		show(el, false);
		el.style.opacity = "0";
	  });

	  if (bandsOn) {
		bandId = SIGN_TO_BAND[sunSignIdx];
		const band = bandId ? $(bandId) : null;
		if (band) {
		  show(band, true);
		  band.style.opacity = "1";
		  band.style.fill = SIGN_COLORS[sunSignIdx];
		}
	  }

	  // seasons wedges + labels
	  ["spring", "summer", "fall", "winter"].forEach((season) => {
		show($(`season-${season}`), false);
		show($(`season-label-${season}`), false);
	  });

	  if (seasonsOn && state.animationRunning) {
		const seasonKey =
		  sunSignIdx <= 2 ? "spring" :
		  sunSignIdx <= 5 ? "summer" :
		  sunSignIdx <= 8 ? "fall" : "winter";

		show($(`season-${seasonKey}`), true);
		show($(`season-label-${seasonKey}`), true);
	  }

	  updateDebugPanel({
		sunLambda: lambdas.sun,
		sunAngle: sunNcpAngle,
		sunR: sunPolar.r,
		signIdx: sunSignIdx,
		bandId: bandId || "—",
	  });
	}

  // -----------------------------
  // Animation loop
  // -----------------------------
  function animationLoop(time) {
    const dt = (time - state.lastTime) / 1000;
    state.lastTime = time;

    try {
      const mode = getMode();

      // reset transition
      if (state.resetTransition) {
        const tRaw = (time - state.resetTransition.startTime) / state.resetTransition.duration;
        const t = Math.min(1, Math.max(0, tRaw));

        if (t >= 1) {
          state.skyAngle = state.resetTransition.targetSky;
          state.eclAngle = state.resetTransition.targetEcl;
		  state.resetTransition = null;
		  state.animationRunning = false;
		  
			if (dom.playBtn) {
			  dom.playBtn.textContent = "▶️ Play";
			  dom.playBtn.classList.remove("is-playing");
			  dom.playBtn.classList.add("is-paused");
			}
		}
		
		else {
          const e = easeOutCubic(t);
          state.skyAngle = lerp(state.resetTransition.startSky, state.resetTransition.targetSky, e);
          state.eclAngle = lerp(state.resetTransition.startEcl, state.resetTransition.targetEcl, e);
        }

        updatePlanets();
        updateTransforms();
        requestAnimationFrame(animationLoop);
        return;
      }

      // mode transition
      if (state.modeTransition) {
        const tRaw = (time - state.modeTransition.startTime) / state.modeTransition.duration;
        const t = Math.min(1, Math.max(0, tRaw));
        state.modeTransition.t = easeOutCubic(t);

        if (t >= 1) {
          if (state.modeTransition.toMode !== "yuga") {
            state.skyAngle = norm360(state.modeTransition.toSkyRot);
            state.eclAngle = norm360(state.modeTransition.toEnpRot);
            state.yugaOrbitAngle = 0;
          }
          state.modeTransition = null;
        }

        updatePlanets();
        updateTransforms();
        requestAnimationFrame(animationLoop);
        return;
      }

      if (state.animationRunning) {
		const safeDayRate = Number.isFinite(state.dayRate) ? state.dayRate : 0;
		const appliedDayRate = (mode === "yuga") ? -safeDayRate : safeDayRate;
		state.simDays += dt * appliedDayRate;

        const safeSkyRate = Number.isFinite(state.skyRate) ? state.skyRate : 0;

        if (mode === "real-time") state.skyAngle = norm360(state.skyAngle + dt * safeSkyRate);
        else if (mode === "precession") state.eclAngle = norm360(state.eclAngle - dt * safeSkyRate);

        updatePlanets();
        updateTransforms();
      }
    } catch (err) {
      console.error("FATAL inside animationLoop:", err);
      if (dom.debugText) dom.debugText.textContent = `FATAL: ${err.message}\n${err.stack || ""}`;
    }

    requestAnimationFrame(animationLoop);
  }

  function togglePlay() {
    state.animationRunning = !state.animationRunning;

    if (dom.playBtn) {
      if (state.animationRunning) {
        dom.playBtn.textContent = "⏸ Pause";
        dom.playBtn.classList.remove("is-paused");
        dom.playBtn.classList.add("is-playing");
      } else {
        dom.playBtn.textContent = "▶️ Play";
        dom.playBtn.classList.remove("is-playing");
        dom.playBtn.classList.add("is-paused");
      }
    }
  }

  // -----------------------------
  // Scaling
  // -----------------------------
  function scaleSkyclock() {
    const wrapper = $("scale-wrapper");
    if (!wrapper) return;

    const DESIGN_WIDTH = 1220;
    const DESIGN_HEIGHT = 1090;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const usableWidth = vw - 300;
    const scale = Math.min(usableWidth / DESIGN_WIDTH, vh / DESIGN_HEIGHT, 1);

    wrapper.style.transform = `scale(${scale})`;
  }

  // -----------------------------
  // Intro modal
  // -----------------------------
  function wireIntroModal() {
    const introButton = $("intro-button");
    const introModal = $("intro-modal");
    const closeIntro = $("close-intro");
    if (!introButton || !introModal || !closeIntro) return;

    const openModal = () => (introModal.style.display = "flex");
    const closeModal = () => (introModal.style.display = "none");

    safeOn(introButton, "click", (e) => {
      e.stopPropagation();
      openModal();
    });

    safeOn(closeIntro, "click", (e) => {
      e.stopPropagation();
      closeModal();
    });

    safeOn(introModal, "click", (e) => {
      if (e.target === introModal) closeModal();
    });

    safeOn(document, "keydown", (e) => {
      if (e.key === "Escape" && introModal.style.display === "flex") closeModal();
    });

    try {
      if (!localStorage.getItem("zodiYugaIntroSeen")) {
        setTimeout(openModal, 1200);
        localStorage.setItem("zodiYugaIntroSeen", "true");
      }
    } catch (_) {}
  }

  // -----------------------------
  // Tropical popup (gear)
  // -----------------------------
  function wireTropicalPopup() {
    const popup = $("tropical-popup");
    const btn = $("tropical-settings-btn");
    const closeBtn = $("tropical-close");
    const overlay = $("tropical-overlay");
    const master = $("toggle-tropical-system");
    if (!popup || !btn) return;

    if (overlay) {
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0)";
      overlay.style.zIndex = "2999";
      overlay.style.display = "none";
    }

    const open = () => {
      popup.style.display = "block";
      if (overlay) overlay.style.display = "block";
    };

    const close = () => {
      popup.style.display = "none";
      if (overlay) overlay.style.display = "none";
    };

    safeOn(btn, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (popup.style.display === "block") close();
      else open();
    });

    safeOn(closeBtn, "click", (e) => {
      e.preventDefault();
      close();
    });

    safeOn(overlay, "click", close);

    safeOn(document, "keydown", (e) => {
      if (e.key === "Escape") close();
    });

    safeOn(master, "change", () => {
      if (master && !master.checked) close();
    });
  }

  // -----------------------------
  // Error traps (prevent silent death)
  // -----------------------------
  function wireErrorTraps() {
    let lastFatal = null;

    window.addEventListener("error", (e) => {
      const msg = `[JS ERROR] ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`;
      if (lastFatal !== msg) {
        lastFatal = msg;
        console.error(msg);
        if (dom.debugText) dom.debugText.textContent = msg;
      }
    });

    window.addEventListener("unhandledrejection", (e) => {
      const msg = `[PROMISE ERROR] ${e.reason}`;
      if (lastFatal !== msg) {
        lastFatal = msg;
        console.error(msg);
        if (dom.debugText) dom.debugText.textContent = msg;
      }
    });
  }

  // -----------------------------
  // Mode circle quadrants (optional)
  // -----------------------------
  function wireModeCircle() {
    const modeCircle = $("mode-circle");
    if (!modeCircle) return;

    const updateQuadrantsHighlight = () => {
      const mode = getMode();
      $$("#mode-circle .quadrant").forEach((q) => q.classList.toggle("selected", q.dataset.mode === mode));
    };

    $$("#mode-circle .quadrant").forEach((el) => {
      safeOn(el, "click", () => {
        const mode = el.dataset.mode;
        const input = document.querySelector(`input[name="mode"][value="${mode}"]`);
        if (input) {
          input.checked = true;
          input.dispatchEvent(new Event("change"));
          updateQuadrantsHighlight();
        }
      });
    });

    updateQuadrantsHighlight();
  }

  // -----------------------------
  // Wire mode inputs (canonical)
  // -----------------------------
  function wireModeInputs() {
    $$('input[name="mode"]').forEach((el) => {
      safeOn(el, "change", () => {
        const newMode = getMode();
        if (state.lastMode == null) state.lastMode = newMode;
        const oldMode = state.lastMode;
        state.lastMode = newMode;

		// stop animation on mode change
		state.animationRunning = false;
		if (dom.playBtn) {
		  dom.playBtn.textContent = "▶️ Play";
		  dom.playBtn.classList.remove("is-playing");
		  dom.playBtn.classList.add("is-paused");
		}

        // reset behavior (keeps your original intent)
        if (newMode === "fixed" || newMode === "precession") {
          startResetTransition(0, 0, 1200);
        }
		
        // yuga start snap (changes only the starting angle when selected)
        if (newMode === "yuga") {
          // anchor simDays=0 to the moment you enter yuga
          state.epochMs = Date.now();
          state.simDays = 0;

          // compute an entry-only offset so the first yuga angle = YUGA_ENTRY_SNAP_DEG
          const sunNow = getGeocentricLongitudes(0).sun;
          state.YUGA_ORBIT_OFFSET_DEG = norm360(
            state.YUGA_ENTRY_SNAP_DEG -
              (state.YUGA_ORBIT_SIGN * (180 - sunNow) + state.YUGA_NCP_OFFSET_DEG)
          );

          // set it immediately so the transition uses the snapped angle
          computeYugaOrbitAngleFromSun(sunNow);
        }

        // smooth entering/leaving yuga
        if (oldMode === "yuga" || newMode === "yuga") {
          startModeTransition(oldMode, newMode, 1200);
        }

        // force redraw
        updatePlanets();
        updateTransforms();
        updateTropicalLatitudes();
      });
    });
  }

  // -----------------------------
  // Init DOM cache
  // -----------------------------
  function initDomCache() {
    dom.skyRotator = $("sky-rotator");
    dom.enpRotator = $("enp-rotator");

    dom.vitruv = $("vitruv-img");
    dom.square = $("square");
    dom.ncpGrid = $("ncp-grid");
    dom.enpGrid = $("enp-grid");
    dom.constellationsLayer = $("constellations-layer");

    dom.debug = $("debug");
    dom.debugText = $("debugText");

    dom.planetEls = {
      sun: $("planet-sun"),
      moon: $("planet-moon"),
      mercury: $("planet-mercury"),
      venus: $("planet-venus"),
      mars: $("planet-mars"),
      jupiter: $("planet-jupiter"),
      saturn: $("planet-saturn"),
	  uranus: $("planet-uranus"),
	  neptune: $("planet-neptune"),
	  pluto: $("planet-pluto"),
    };

    // supports either id to avoid “wrong button” bugs
    dom.playBtn = $("toggle-btn") || $("playBtn");

    dom.speedSkySlider = $("speed-sky");
    dom.speedPlanetsSlider = $("speed-planets");
    dom.skyReadout = $("sky-readout");
    dom.planetReadout = $("planet-readout");

    dom.yugaRing = $("yuga-ring");
    dom.polarYugaRing = $("polar-yuga-ring");
    dom.timeLayerImg = $("time-layer-img");

    dom.toggleYuga = $("toggle-yuga");
    dom.togglePolarYuga = $("toggle-polar-yuga");
    dom.toggleTime = $("toggle-time");
    dom.yugaOpacity = $("yuga-opacity");

    dom.bullingerTransform = $("bullinger-transform");
    dom.bullingerOpacity = $("bullinger-opacity");

    dom.GLYPH_TEXTS = $$("#sign-glyphs-counter text");

    dom.ARCS = [
      "#aries-sign path",
      "#taurus-sign path",
      "#gemini-sign path",
      "#cancer-sign path",
      "#leo-sign path",
      "#virgo-sign path",
      "#libra-sign path",
      "#scorpio-sign path",
      "#sagittarius-sign path",
      "#capricorn-sign path",
      "#aquarius-sign path",
      "#pisces-sign path",
    ].map((sel) => document.querySelector(sel));
  }

  // -----------------------------
  // Init (runs once)
  // -----------------------------
  function init() {
    initDomCache();
    wireErrorTraps();

    // grids
    drawGrid({ container: dom.ncpGrid, radialColor: "red", radius: 400, circleColor: "deepskyblue", circleRadius: 60 });
    drawGrid({ container: dom.enpGrid, radialColor: "deepskyblue", radius: 400, circleColor: "red", circleRadius: 60 });

    // layer toggles (safe)
    wireToggleDisplay("toggle-vitruv", dom.vitruv);
    wireToggleDisplay("toggle-square", dom.square);
    wireToggleDisplay("toggle-ncp-grid", dom.ncpGrid);
    wireToggleDisplay("toggle-ncp-marker", $("ncp-marker"));
    wireToggleDisplay("toggle-enp-grid", dom.enpGrid);
    wireToggleDisplay("toggle-enp-marker", $("enp-marker"));
    wireToggleDisplay("toggle-ecliptic", $("ecliptic-group"));
    wireToggleDisplay("toggle-tropical-sign-rings", $("tropical-sign-rings"));
    wireToggleDisplay("toggle-houses", $("houses-group"));
    wireToggleDisplay("toggle-gleasons", $("gleasons-group"));

    // constellations toggle + opacity
	wireToggleDisplay("toggle-constellations", dom.constellationsLayer);
	wireOpacitySvgAttr("constellations-layer", "constellations-opacity", "opacity");

    // draco toggle
    safeOn($("toggle-draco"), "change", (e) => {
      const wrap = $("draco-wrapper");
      if (wrap) wrap.style.display = e.target.checked ? "block" : "none";
    });

    // gleason + vitruv opacity
    wireOpacityStyle("gleasons-group", "gleason-opacity");
    wireOpacityStyle("vitruv-img", "vitruv-opacity");

    // bullinger opacity
	wireToggleDisplay("toggle-bullinger", dom.bullingerTransform);

	if (dom.bullingerOpacity && dom.bullingerTransform) dom.bullingerTransform.style.opacity = dom.bullingerOpacity.value;
	safeOn(dom.bullingerOpacity, "input", (e) => {
	  if (dom.bullingerTransform) dom.bullingerTransform.style.opacity = e.target.value;
	});
	
    // yuga layers controller
    safeOn(dom.yugaOpacity, "input", () => { updateYugaLayers(); updateTransforms(); });
    safeOn(dom.toggleYuga, "change", () => { updateYugaLayers(); updateTransforms(); });
    safeOn(dom.togglePolarYuga, "change", () => { updateYugaLayers(); updateTransforms(); });
    safeOn(dom.toggleTime, "change", () => { updateYugaLayers(); updateTransforms(); });
    updateYugaLayers();

    // planets toggle (forces redraw)
    safeOn($("toggle-planets"), "change", () => updatePlanets());

    // tropical toggles + sign-mode radios (force redraw)
    [
      "toggle-tropical-system",
      "toggle-cancer",
      "toggle-equator",
      "toggle-capricorn",
      "toggle-southern-cross-north",
      "toggle-southern-cross-south",
      "toggle-tropical-sign-rings",
      "toggle-tropical-signs",
      "toggle-tropical-bands",
      "toggle-seasons",
    ].forEach((id) => safeOn($(id), "change", () => { updateTropicalLatitudes(); updatePlanets(); }));

    $$('input[name="tropical-sign-mode"]').forEach((el) => {
      safeOn(el, "change", () => updatePlanets());
    });

    updateTropicalLatitudes();
    initTropicalBands();

    // analemma toggle: clear stamps + redraw
    safeOn($("toggle-analemma"), "change", () => {
      clearAnalemmaDots();
      resetAnalemmaStamping();
      updateTransforms();
    });

    // horizon toggle + opacity
    safeOn($("toggle-horizon"), "change", (e) => setDisplay($("horizon-group"), !!e.target.checked));
    safeOn($("horizon-opacity"), "input", () => {
      const h = $("horizon-group");
      const s = $("horizon-opacity");
      if (h && s) h.style.opacity = s.value;
    });

    // detach horizon from sky rotator (if nested)
    const horizon = $("horizon-group");
    if (horizon && dom.skyRotator && dom.skyRotator.contains(horizon)) {
      dom.skyRotator.parentNode?.appendChild(horizon);
      console.log("✅ Horizon detached from rotating sky");
    }

    // speed sliders
    if (dom.speedSkySlider) {
      if (dom.speedSkySlider.value === "" || dom.speedSkySlider.value == null) dom.speedSkySlider.value = "10";
      state.skyRate = sliderToSkyRate(dom.speedSkySlider.value);
      safeOn(dom.speedSkySlider, "input", () => {
        state.skyRate = sliderToSkyRate(dom.speedSkySlider.value);
        updateReadouts();
      });
    }

    if (dom.speedPlanetsSlider) {
      if (dom.speedPlanetsSlider.value === "" || dom.speedPlanetsSlider.value == null) dom.speedPlanetsSlider.value = "25";
      state.dayRate = sliderToDayRate(dom.speedPlanetsSlider.value);
      safeOn(dom.speedPlanetsSlider, "input", () => {
        state.dayRate = sliderToDayRate(dom.speedPlanetsSlider.value);
        updateReadouts();
      });
    }

    updateReadouts();

    // play button
    if (dom.playBtn) {
      dom.playBtn.classList.add("is-paused");
      safeOn(dom.playBtn, "click", togglePlay);
    }

    // mode circle + mode inputs
    wireModeCircle();
    wireModeInputs();

    // popups + intro
    wireTropicalPopup();
    wireIntroModal();

    // initial render
    updatePlanets();
    updateTransforms();

    // scale + animate
    scaleSkyclock();
    safeOn(window, "resize", scaleSkyclock);

    state.lastTime = performance.now();
    requestAnimationFrame(animationLoop);
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
