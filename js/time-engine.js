/* time-engine.js — Time authority + TIL + AstroEngine */
/* =========================================================
   OPTION A — CONJUNCTION-LOCKED AXIS
   ---------------------------------------------------------
   The screw's major marks are the primary lattice.

   • Each Saturn–Jupiter conjunction occupies exactly ONE major step (PX_PER_MAJOR).
   • dateToScrollX / scrollXToDate are piecewise-linear between conjunction instants.
   • Result: AstroTime (UTC) stays glued to the screw markers forever.
   ========================================================= */

/* =========================================================
   SECTION 05.9 — EPOCH & TIME ANCHOR (ABSOLUTE TIME ORIGIN)
   ========================================================= */

const EPOCH_YEAR = 2020;
const epochDate  = new Date("2020-12-21T18:20:00Z");

// Authoritative view-state (declared once; derived each frame)
let scrollX = 0;
let nowX = 0;
let screwTranslateX = 0;

let lastTime = 0;
let isPaused = false;

/* =========================================================
   SECTION 05.9.1 — TIME STATE
   ========================================================= */

const timeState = {
  mode: "timeline",            // "timeline" | "manual" (future)
  dateUTC: new Date(), // authoritative (start at now)
  scrollX: 0,                   // derived each frame (render only)
  navTargetDateUTC: null,       // smooth nav target (buttons)
};

// Expose timeState globally for ui-controller and other modules
window.timeState = timeState;

const MS_PER_YEAR = 365.2422 * 24 * 60 * 60 * 1000;

/* =========================================================
   SECTION 07.1.1 — CONJUNCTION LATTICE (DISCRETE HISTORY)
   ========================================================= */

const FALLBACK_CONJUNCTION_YEARS = (() => {
  // CATHEDRAL: if master CONJUNCTION_DATA exists, use its years as the lattice basis.
  // This eliminates "blank sign" slots caused by mismatched hardcoded fallback years
  // (e.g. fallback 333 vs master 332, 1683 vs master 1682, etc).
  if (typeof CONJUNCTION_DATA !== "undefined" && Array.isArray(CONJUNCTION_DATA) && CONJUNCTION_DATA.length) {
    const yrs = CONJUNCTION_DATA
      .map(d => new Date(d.t).getUTCFullYear())
      .filter(Number.isFinite);

    // unique + sorted
    return Array.from(new Set(yrs)).sort((a, b) => a - b);
  }

  // Legacy fallback (only when master is missing)
  return [
    14, 34, 54, 74, 94,
    114, 134, 154, 173, 193,
    213, 233, 253, 273, 292,
    312, 333, 352, 372, 392,
    412, 432, 452, 471, 491,
    511, 531, 551, 571, 590,
    610, 630, 650, 670, 690,
    710, 729, 749, 769, 789,
    809, 829, 848, 868, 888,
    908, 928, 948, 968, 988,
    1008, 1027, 1047, 1067, 1087,
    1107, 1127, 1146, 1166, 1186,
    1206, 1226, 1246, 1265, 1286,
    1306, 1325, 1345, 1365, 1385,
    1405, 1425, 1444, 1464, 1484,
    1504, 1524, 1544, 1563, 1583,
    1603, 1623, 1643, 1663, 1683,
    1702, 1723, 1742, 1762, 1782,
    1802, 1821, 1842, 1861, 1881,
    1901, 1921, 1941, 1961, 1981,
    2000, 2020, 2040, 2060, 2080,
    2100, 2119, 2140, 2159, 2179, 2199,
    2219, 2238, 2259, 2279, 2298,
    2318, 2338, 2358, 2378, 2398,
  ];
})();


const SIGN_ABBR_TO_FULL = {
  Ari: "aries",
  Tau: "taurus",
  Gem: "gemini",
  Can: "cancer",
  Leo: "leo",
  Vir: "virgo",
  Lib: "libra",
  Sco: "scorpio",
  Sag: "sagittarius",
  Cap: "capricorn",
  Aqu: "aquarius",
  Pis: "pisces",
};

// Optional: loaded from js/_conjunction_data.js
const CONJUNCTION_EVENTS = (typeof CONJUNCTION_DATA !== "undefined" && Array.isArray(CONJUNCTION_DATA))
  ? CONJUNCTION_DATA
      .map((d) => {
        const iso = d?.t;
        const dateUTC = new Date(iso);
        const tMs = dateUTC.getTime();
        const abbr = (d?.sign || "").trim();
        const sign = (SIGN_ABBR_TO_FULL[abbr] || "").toLowerCase();
        return {
          dateUTC,
          tMs,
          year: dateUTC.getUTCFullYear(),
          sign,
        };
      })
      .filter((e) => e.dateUTC instanceof Date && Number.isFinite(e.tMs))
      .sort((a, b) => a.tMs - b.tMs)
  : [];
  
/* =========================================================
   CATHEDRAL — MASTER-DERIVED ELEMENT SHIFTS + CRISIS
   ---------------------------------------------------------
   Goal: eliminate competing reference systems.

   Source of truth (when present):
   • CONJUNCTION_DATA from js/_conjunction_data.js
     Each item: { t, sign, element, elementShift, crisis }

   If CONJUNCTION_DATA is missing, we fall back to the existing
   lattice/mechanics so geometry does not break.
   ========================================================= */

function nearestConjunctionToMs(targetMs) {
  // Kept for compatibility (and for snapping fallbacks if needed)
  if (!CONJUNCTION_EVENTS || !CONJUNCTION_EVENTS.length) return null;

  let best = CONJUNCTION_EVENTS[0];
  let bestDist = Math.abs(best.tMs - targetMs);

  for (let i = 1; i < CONJUNCTION_EVENTS.length; i++) {
    const d = Math.abs(CONJUNCTION_EVENTS[i].tMs - targetMs);
    if (d < bestDist) {
      bestDist = d;
      best = CONJUNCTION_EVENTS[i];
    }
  }
  return best;
}

// ---------- MASTER-DERIVED ELEMENT SHIFTS (no hard-coded dates) ----------
const ELEMENT_SWITCHES = (() => {
  // Prefer master conjunction dataset (single source of truth)
  if (typeof CONJUNCTION_DATA !== "undefined" && Array.isArray(CONJUNCTION_DATA) && CONJUNCTION_DATA.length) {
    return CONJUNCTION_DATA
      .filter((d) => !!d?.elementShift)
      .map((d) => {
        const dateUTC = new Date(d.t);
        const tMs = dateUTC.getTime();
        return {
          element: String(d.element || "").toLowerCase(), // from MASTER
          tMs,
          dateUTC,
          year: dateUTC.getUTCFullYear(),
          sign: d.sign || "",
        };
      })
      .filter((e) => Number.isFinite(e.tMs))
      .sort((a, b) => a.tMs - b.tMs);
  }

  // Fallback: if master not present, keep behavior stable (no element switches)
  return [];
})();

function getNextElementSwitch(dateUTC, direction) {
  const t = (dateUTC instanceof Date ? dateUTC : new Date(dateUTC)).getTime();
  if (!Number.isFinite(t) || !ELEMENT_SWITCHES.length) return null;

  if (direction > 0) {
    for (let i = 0; i < ELEMENT_SWITCHES.length; i++) {
      if (ELEMENT_SWITCHES[i].tMs > t) return ELEMENT_SWITCHES[i];
    }
  } else {
    for (let i = ELEMENT_SWITCHES.length - 1; i >= 0; i--) {
      if (ELEMENT_SWITCHES[i].tMs < t) return ELEMENT_SWITCHES[i];
    }
  }
  return null;
}


// Always guarantee we have a lattice with at least 2 points.
const FALLBACK_EVENTS = FALLBACK_CONJUNCTION_YEARS.map((y) => {
  const tMs = epochDate.getTime() + (y - EPOCH_YEAR) * MS_PER_YEAR;
  const dateUTC = new Date(tMs);
  return { dateUTC, tMs, year: y, sign: "" };
});

// CATHEDRAL: Never allow loaded CONJUNCTION_EVENTS to truncate the timeline.
// We merge events + fallback so the lattice extends into the future.
const CONJUNCTION_LATTICE = (() => {
  const map = new Map();

  // Prefer real events (exact tMs + sign)
  for (const e of (CONJUNCTION_EVENTS || [])) {
    if (!e || !Number.isFinite(e.tMs)) continue;
    map.set(e.year, e);
  }

  // Fill gaps with fallback years
  for (const e of (FALLBACK_EVENTS || [])) {
    if (!e) continue;
    if (!map.has(e.year)) map.set(e.year, e);
  }

  return Array.from(map.values()).sort((a, b) => a.tMs - b.tMs);
})();

const CONJUNCTION_YEARS = CONJUNCTION_LATTICE.map((e) => e.year);

// Anchor index nearest the epoch instant
const CONJUNCTION_ANCHOR_INDEX = (() => {
  if (!CONJUNCTION_LATTICE.length) return -1;
  const t0 = epochDate.getTime();
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < CONJUNCTION_LATTICE.length; i++) {
    const d = Math.abs(CONJUNCTION_LATTICE[i].tMs - t0);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
})();

// ---------- MASTER-DERIVED CRISIS YEARS (fallback-safe) ----------
const CRISIS_YEARS = (() => {
  // If master provides crisis flags, use them (single source of truth)
  if (typeof CONJUNCTION_DATA !== "undefined" && Array.isArray(CONJUNCTION_DATA) && CONJUNCTION_DATA.length) {
    return CONJUNCTION_DATA
      .filter((d) => !!d?.crisis)
      .map((d) => new Date(d.t).getUTCFullYear())
      .filter((y) => Number.isFinite(y));
  }

  // Fallback to legacy behavior only when master is absent
  const _crisisMod = (CONJUNCTION_ANCHOR_INDEX >= 0) ? (CONJUNCTION_ANCHOR_INDEX % 4) : 0;
  return CONJUNCTION_YEARS.filter((_, i) => (i % 4) === _crisisMod);
})();


function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function conjIndexToScrewX(i) {
  return SCREW_EPOCH_X + (i - CONJUNCTION_ANCHOR_INDEX) * PX_PER_MAJOR;
}

function getConjunctionIndexForScrollX(scrollX) {
  if (!CONJUNCTION_LATTICE.length || CONJUNCTION_ANCHOR_INDEX < 0) return 0;
  const x = SCREW_EPOCH_X - scrollX;
  const iFloat = CONJUNCTION_ANCHOR_INDEX + (x - SCREW_EPOCH_X) / PX_PER_MAJOR;
  const i = Math.round(iFloat);
  return clamp(i, 0, CONJUNCTION_LATTICE.length - 1);
}

function getConjunctionStepForScrollX(scrollX) {
  return getConjunctionIndexForScrollX(scrollX) - CONJUNCTION_ANCHOR_INDEX;
}


/* =========================================================
   SECTION 07.1.2 — PIECEWISE MAPPING (UTC <-> SCREW)
   ========================================================= */

function dateToScrewX(date) {
  // Fallback: linear year projection
  if (!CONJUNCTION_LATTICE.length || CONJUNCTION_LATTICE.length < 2 || CONJUNCTION_ANCHOR_INDEX < 0) {
    const deltaYears = (date.getTime() - epochDate.getTime()) / MS_PER_YEAR;
    return SCREW_EPOCH_X + deltaYears * PX_PER_YEAR;
  }

  const t = date.getTime();
  const n = CONJUNCTION_LATTICE.length;

  // Choose bracketing points by UTC time
  let i0 = 0;
  let i1 = 1;

  if (t <= CONJUNCTION_LATTICE[0].tMs) {
    i0 = 0;
    i1 = 1;
  } else if (t >= CONJUNCTION_LATTICE[n - 1].tMs) {
    i0 = n - 2;
    i1 = n - 1;
  } else {
    // Binary search for i0 such that t in [i0, i0+1]
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t >= CONJUNCTION_LATTICE[mid].tMs) lo = mid;
      else hi = mid;
    }
    i0 = lo;
    i1 = lo + 1;
  }

  const e0 = CONJUNCTION_LATTICE[i0];
  const e1 = CONJUNCTION_LATTICE[i1];
  const denom = (e1.tMs - e0.tMs) || 1;
  const frac = (t - e0.tMs) / denom;

  const x0 = conjIndexToScrewX(i0);
  return x0 + frac * PX_PER_MAJOR;
}

// UTC Date -> scrollX (authoritative)
function dateToScrollX(date) {
  const x = dateToScrewX(date);
  return SCREW_EPOCH_X - x;
}

// scrollX -> UTC Date (authoritative)
function scrollXToDate(scrollX) {
  // Fallback: linear year projection
  if (!CONJUNCTION_LATTICE.length || CONJUNCTION_LATTICE.length < 2 || CONJUNCTION_ANCHOR_INDEX < 0) {
    const deltaYears = (-scrollX) / PX_PER_YEAR;
    return new Date(epochDate.getTime() + deltaYears * MS_PER_YEAR);
  }

  const x = SCREW_EPOCH_X - scrollX;
  const n = CONJUNCTION_LATTICE.length;

  // Map x to lattice segment index (uniform pixel step)
  let i0;
  if (x <= conjIndexToScrewX(0)) i0 = 0;
  else if (x >= conjIndexToScrewX(n - 1)) i0 = n - 2;
  else {
    const iFloat = CONJUNCTION_ANCHOR_INDEX + (x - SCREW_EPOCH_X) / PX_PER_MAJOR;
    i0 = clamp(Math.floor(iFloat), 0, n - 2);
  }

  const x0 = conjIndexToScrewX(i0);
  const frac = (x - x0) / PX_PER_MAJOR;

  const e0 = CONJUNCTION_LATTICE[i0];
  const e1 = CONJUNCTION_LATTICE[i0 + 1];
  const tMs = e0.tMs + frac * (e1.tMs - e0.tMs);
  return new Date(tMs);
}

/* =========================================================
   SECTION 07.1.3 — CANONICAL YEAR ACCESSORS
   ========================================================= */

function dateUTCToContinuousYear(date) {
  const y = date.getUTCFullYear();
  const t = date.getTime();
  const start = Date.UTC(y, 0, 1, 0, 0, 0, 0);
  const end   = Date.UTC(y + 1, 0, 1, 0, 0, 0, 0);
  const frac = (t - start) / ((end - start) || 1);
  return y + frac;
}

function scrollXToContinuousYear(scrollX) {
  return dateUTCToContinuousYear(scrollXToDate(scrollX));
}

// Nearest conjunction year (real, from data)
function scrollXToConjunctionYear(scrollX) {
  const idx = getConjunctionIndexForScrollX(scrollX);
  return CONJUNCTION_YEARS[idx] ?? null;
}

// Smooth, continuous calendar year (used by planets & wheel)
function getYearForPlanets(scrollX) {
  return scrollXToContinuousYear(scrollX);
}

// Discrete, conjunction-locked year FOR UI PHASING (20y majors are LAW)
function getYearForUI(scrollX) {
  const step = getConjunctionStepForScrollX(scrollX);
  return EPOCH_YEAR + step * 20;
}

// BUTTON NAVIGATION YEAR (AUTHORITATIVE DATE)
function getYearForNavigation() {
  return dateUTCToContinuousYear(timeState.dateUTC);
}

/* =========================================================
   SECTION 07.1.4 — DISCRETE TEMPORAL EVENTS (CRISIS CANON)
   ========================================================= */

/* =========================================================
   CONJUNCTION SNAP (AUTHORITATIVE)
   ========================================================= */

function snapToConjunctionYear(targetYear) {
  if (targetYear == null) return null;
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < CONJUNCTION_YEARS.length; i++) {
    const y = CONJUNCTION_YEARS[i];
    const d = Math.abs(y - targetYear);
    if (d < bestDist) {
      bestDist = d;
      best = y;
    }
  }
  return best;
}

function gotoYearExact(targetYear) {
  if (targetYear == null) return;

  const snappedYear = snapToConjunctionYear(targetYear);
  if (snappedYear == null) return;

  // CATHEDRAL: snap by LATTICE SLOT (prevents skipping/jumping).
  // CONJUNCTION_EVENTS may be shorter/different; CONJUNCTION_LATTICE is the geometry authority.
  const idx = CONJUNCTION_YEARS.indexOf(snappedYear);
  if (idx >= 0 && CONJUNCTION_LATTICE && CONJUNCTION_LATTICE[idx] && Number.isFinite(CONJUNCTION_LATTICE[idx].tMs)) {
    timeState.navTargetDateUTC = new Date(CONJUNCTION_LATTICE[idx].tMs);
    return;
  }

  // Fallback: construct a rough date in the target year
  timeState.navTargetDateUTC = new Date(Date.UTC(snappedYear, 11, 21, 18, 20, 0));
}


function snapToListYear(targetYear, list) {
  if (targetYear == null) return null;
  if (!list || list.length === 0) return null;

  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < list.length; i++) {
    const y = list[i];
    const d = Math.abs(y - targetYear);
    if (d < bestDist) {
      bestDist = d;
      best = y;
    }
  }
  return best;
}

function getNextFromList(currentYear, list, direction) {
  if (!list || !list.length) return null;

  if (direction > 0) {
    for (let i = 0; i < list.length; i++) {
      if (list[i] > currentYear) return list[i];
    }
  } else {
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] < currentYear) return list[i];
    }
  }
  return null;
}

/* =========================================================
   OPTIONAL — YEAR -> scrollX helper (rarely used)
   ========================================================= */

function yearToScrollX(year) {
  // Use mid-year (UTC) so this is stable
  const d = new Date(Date.UTC(year, 6, 2, 0, 0, 0));
  return dateToScrollX(d);
}

/* =========================================================
   SECTION 10.5 — ASTRO TIME ENGINE (PHASE 2A)
   ========================================================= */

const AstroEngine = {
  get dateUTC() {
    return timeState.dateUTC;
  },

  setDateUTC(date) {
    if (!date) return;
    const d = (date instanceof Date) ? date : new Date(date);
    timeState.dateUTC = new Date(d.getTime());
  },

  get julianDay() {
    const d = this.dateUTC;
    return d / 86400000 + 2440587.5;
  },

  get T() {
    return (this.julianDay - 2451545.0) / 36525;
  },
};
