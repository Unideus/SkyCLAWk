// /src/timeline.js
// ============================================================
// Personal Timeline (3 rails under the band)
// - Ticks are SOLAR RETURNS (birthdays) => integer ages.
// - The 3 lanes are dynamic and terminate at the end of each Saturn Return
//   "by sign" (final exit from natal Saturn sign, after all retrogrades).
// - Saturn strip spans Saturn's transit through the natal Saturn sign PLUS
//   a 10° buffer on either side (signStart-10° .. signEnd+10°).
// - Saturn glyph (♄) moves in real-time across that strip, including retrogrades,
//   driven by the same live ephemeris stream as the zodiac band (zy:time).
// ============================================================

/* ============================================================
   1) DOM HOOKS
============================================================ */
const personalTimeline = document.getElementById("personalTimeline");
const ptSun = document.getElementById("ptSun");

const cycleBtn = document.getElementById("cycleBtn");
const cycleModal = document.getElementById("cycleModal");
const cycleClose = document.getElementById("cycleClose");
const cycleSaturn = document.getElementById("cycleSaturn");
const cycleSaturnStatus = document.getElementById("cycleSaturnStatus");
const SATURN_ASPECT_ORB_DEG = 1.25; // try 1.25–2.0 if you want fatter windows

/* ============================================================
   2) STATE
============================================================ */
let __natalDetail = null;

// live time coming from the band stream (zy:time)
let __liveDateUTC = null;
// live longitudes coming from the SAME band stream (zy:time)
let __liveBodyLons = null;

// cycles selection
const __cycles = { saturn: true };

// Saturn return windows (computed once per natal)
let __saturnReturns = null; // [{n, signIdx, signStart, coreEntryUTC, finalExitUTC, paddedEntryUTC, paddedExitUTC}]
let __saturnComputeRunning = false;
let __saturnComputeDone = false;
let __saturnComputeError = null;

// Lane ranges (computed once per natal): 3 lanes separated by return final exits
let __laneRanges = null; // [{lane:1,startAge,endAge},{lane:2,...},{lane:3,...}]

// Jupiter windows (computed once per natal)
let __jupiterReturns = null;  // same shape as Saturn windows, but for Jupiter returns
let __jupiterAspects = null;  // { squares:[], oppositions:[] }

// --- Saturn squares (transit Saturn square natal Saturn) ---
const SATURN_SQUARE_ORB_DEG = 1.25; // tweak: 1.0–2.0 feels right

let __saturnAspects = null;
// [{ aUTC, bUTC, midUTC, midAge }]

let __saturnAspectStrips = null; 
// [{ key:"sq1"|"sq2"|"sq3"|"opp", type:"square"|"opposition", aUTC,bUTC, signIdx, signStart }]


/* ============================================================
   3) HELPERS (math + time)
============================================================ */
function setTimelineActive(isOn) {
  if (!personalTimeline) return;
  personalTimeline.classList.toggle("isActive", !!isOn);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function normalizeDeg(x) {
  const v = Number(x);
  if (!Number.isFinite(v)) return NaN;
  return ((v % 360) + 360) % 360;
}

function signIndexFromLon(lonDeg) {
  const v = Number(lonDeg);
  if (!Number.isFinite(v)) return 0;
  return Math.floor(normalizeDeg(v) / 30); // 0=Aries ... 11=Pisces
}

function pickLon(obj, keys) {
  if (!obj) return NaN;
  for (const k of keys) {
    const v = obj[k];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function angularDistanceDeg(a, b) {
  const A = normalizeDeg(a);
  const B = normalizeDeg(b);
  if (!Number.isFinite(A) || !Number.isFinite(B)) return NaN;
  const d = Math.abs((((A - B) % 360) + 540) % 360 - 180);
  return d; // 0..180
}

function birthdayUTC(birthUTC, year) {
  // same UTC month/day/time as birth
  return new Date(
    Date.UTC(
      year,
      birthUTC.getUTCMonth(),
      birthUTC.getUTCDate(),
      birthUTC.getUTCHours(),
      birthUTC.getUTCMinutes(),
      birthUTC.getUTCSeconds(),
      birthUTC.getUTCMilliseconds()
    )
  );
}

function distToTargetDeg(a, target) {
  return angularDistanceDeg(a, target); // 0..180
}

async function computeSaturnAspects(birthUTC, natalSatDeg, endAge) {
  const period = 29.457;

  const natalSatSignIdx = signIndexFromLon(natalSatDeg);

  // Same “by sign” window logic as returns, but for an arbitrary target sign + target age.
  async function computeSaturnSignWindowByAge(targetSignIdx, targetAge) {
    const scanHalfWidth = 7; // match return behavior (wide enough to catch retrograde passes)
    const startAge = Math.max(0, targetAge - scanHalfWidth);
    const endAge2  = targetAge + scanHalfWidth;

    const startUTC = birthdayUTC(birthUTC, birthUTC.getUTCFullYear() + Math.floor(startAge));
    const endUTC   = birthdayUTC(birthUTC, birthUTC.getUTCFullYear() + Math.ceil(endAge2));

    const signStart = targetSignIdx * 30;

    const inCore = (satDeg) => {
      const rel = normalizeDeg(satDeg - signStart);
      return rel < 30;
    };

    const inPadded = (satDeg) => {
      const rel = normalizeDeg(satDeg - signStart);
      return (rel >= 350) || (rel <= 40); // [-10..+40] like return windows
    };

    async function satInsideAt(date, isInFn) {
      const eph = await getEphemAt(date);
      if (!eph) return false;
      const sat = getSaturnDegFromLonObj(eph);
      if (!Number.isFinite(sat)) return false;
      return !!isInFn(sat);
    }

    async function refineEdge(t0, t1, wantInside, isInFn) {
      let a = new Date(t0);
      let b = new Date(t1);
      for (let i = 0; i < 18; i++) {
        const mid = new Date((a.getTime() + b.getTime()) / 2);
        const inside = await satInsideAt(mid, isInFn);
        if (inside === wantInside) b = mid;
        else a = mid;
      }
      return b;
    }

    async function buildWindows(isInFn) {
      const wins = [];
      const stepDays = 7;

      let curStart = null;
      let prevD = null;

      for (let d = new Date(startUTC); d <= endUTC; d.setUTCDate(d.getUTCDate() + stepDays)) {
        const inside = await satInsideAt(d, isInFn);

        if (inside && !curStart) {
          curStart = prevD ? await refineEdge(prevD, d, true, isInFn) : new Date(d);
        }

        if (!inside && curStart) {
          const edge = prevD ? await refineEdge(prevD, d, false, isInFn) : new Date(d);
          wins.push({ a: curStart, b: edge });
          curStart = null;
        }

        prevD = new Date(d);
      }

      if (curStart) wins.push({ a: curStart, b: new Date(endUTC) });
      return wins;
    }

    const coreWins = await buildWindows(inCore);
    const padWins  = await buildWindows(inPadded);
    if (!coreWins.length || !padWins.length) return null;

    // pick the “neighborhood” around targetAge (same as returns)
    const coreNeighborhood = coreWins.filter(w => {
      const mid = new Date((w.a.getTime() + w.b.getTime()) / 2);
      const ageMid = solarReturnAgeFloat(birthUTC, mid);
      return Math.abs(ageMid - targetAge) <= 4;
    });
    if (!coreNeighborhood.length) return null;

    let coreEntryUTC = coreNeighborhood[0].a;
    let finalExitUTC = coreNeighborhood[0].b;
    for (const w of coreNeighborhood) {
      if (w.a < coreEntryUTC) coreEntryUTC = w.a;
      if (w.b > finalExitUTC) finalExitUTC = w.b;
    }

    // padded span overlapping the core span + safety (same as returns)
    const padStart = new Date(coreEntryUTC.getTime() - 365 * 86400000);
    const padEnd   = new Date(finalExitUTC.getTime() + 365 * 86400000);
    const padNeighborhood = padWins.filter(w => !(w.b <= padStart || w.a >= padEnd));
    if (!padNeighborhood.length) return null;

    let paddedEntryUTC = padNeighborhood[0].a;
    let paddedExitUTC  = padNeighborhood[0].b;
    for (const w of padNeighborhood) {
      if (w.a < paddedEntryUTC) paddedEntryUTC = w.a;
      if (w.b > paddedExitUTC) paddedExitUTC = w.b;
    }

    return {
      signIdx: targetSignIdx,
      signStart,
      coreEntryUTC,
      finalExitUTC,
      paddedEntryUTC,
      paddedExitUTC,
    };
  }

  // targets by cycle age, but WINDOWS are by SIGN (square/opposition signs)
  const targets = [];
  for (let k = 0; k <= 4; k++) {
    const base = period * k;

    const sq1 = base + period / 4;
    const opp = base + period / 2;
    const sq2 = base + (3 * period) / 4;

    if (sq1 > 0.2 && sq1 <= endAge + 1) targets.push({ kind: "square", age: sq1, signDelta: +3 });
    if (opp > 0.2 && opp <= endAge + 1) targets.push({ kind: "opposition", age: opp, signDelta: +6 });
    if (sq2 > 0.2 && sq2 <= endAge + 1) targets.push({ kind: "square", age: sq2, signDelta: -3 });
  }

  const squares = [];
  const oppositions = [];

  for (const t of targets) {
    const targetSignIdx = (natalSatSignIdx + t.signDelta + 12) % 12;
    const win = await computeSaturnSignWindowByAge(targetSignIdx, t.age);
    if (!win) continue;

    const rec = {
      kind: t.kind,
      aUTC: win.paddedEntryUTC,
      bUTC: win.paddedExitUTC,
      midUTC: new Date((win.paddedEntryUTC.getTime() + win.paddedExitUTC.getTime()) / 2),
      signIdx: win.signIdx,
      signStart: win.signStart,
    };

    if (t.kind === "square") squares.push(rec);
    else oppositions.push(rec);
  }

  squares.sort((a, b) => a.midUTC - b.midUTC);
  oppositions.sort((a, b) => a.midUTC - b.midUTC);

  return { squares, oppositions };
}

async function computeJupiterAspects(birthUTC, natalJupDeg, endAge) {
  const period = 11.862;
  const natalSignIdx = signIndexFromLon(natalJupDeg);

  // Direct scan (like Saturn), not "return-centered"
  async function computeJupiterSignWindowByAge(targetSignIdx, targetAge) {
    // widen enough to catch retrograde & multi-pass; Jupiter needs less than Saturn, but keep safe
    const scanHalfWidth = 6; // years
    const startAge = Math.max(0, targetAge - scanHalfWidth);
    const endAge2  = targetAge + scanHalfWidth;

    const startUTC = birthdayUTC(birthUTC, birthUTC.getUTCFullYear() + Math.floor(startAge));
    const endUTC   = birthdayUTC(birthUTC, birthUTC.getUTCFullYear() + Math.ceil(endAge2));

    const signStart = targetSignIdx * 30;

    const inCore = (deg) => {
      const rel = normalizeDeg(deg - signStart);
      return rel < 30;
    };

    const inPadded = (deg) => {
      const rel = normalizeDeg(deg - signStart);
      // [-10..+40] around sign start
      return (rel >= 350) || (rel <= 40);
    };

    async function jupInsideAt(date, isInFn) {
      const eph = await getEphemAt(date);
      if (!eph) return false;
      const jup = getJupiterDegFromLonObj(eph);
      if (!Number.isFinite(jup)) return false;
      return !!isInFn(jup);
    }

    async function refineEdge(t0, t1, wantInside, isInFn) {
      let a = new Date(t0);
      let b = new Date(t1);
      for (let i = 0; i < 18; i++) {
        const mid = new Date((a.getTime() + b.getTime()) / 2);
        const inside = await jupInsideAt(mid, isInFn);
        if (inside === wantInside) b = mid;
        else a = mid;
      }
      return b;
    }

    async function buildWindows(isInFn) {
      const wins = [];
      const stepDays = 5; // Jupiter moves faster

      let curStart = null;
      let prevD = null;

      for (let d = new Date(startUTC); d <= endUTC; d.setUTCDate(d.getUTCDate() + stepDays)) {
        const inside = await jupInsideAt(d, isInFn);

        if (inside && !curStart) {
          curStart = prevD ? await refineEdge(prevD, d, true, isInFn) : new Date(d);
        }

        if (!inside && curStart) {
          const edge = prevD ? await refineEdge(prevD, d, false, isInFn) : new Date(d);
          wins.push({ a: curStart, b: edge });
          curStart = null;
        }

        prevD = new Date(d);
      }

      if (curStart) wins.push({ a: curStart, b: new Date(endUTC) });
      return wins;
    }

    const coreWins = await buildWindows(inCore);
    const padWins  = await buildWindows(inPadded);
    if (!coreWins.length || !padWins.length) return null;

    // choose neighborhood around targetAge
    const coreNeighborhood = coreWins.filter(w => {
      const mid = new Date((w.a.getTime() + w.b.getTime()) / 2);
      const ageMid = solarReturnAgeFloat(birthUTC, mid);
      return Math.abs(ageMid - targetAge) <= 4;
    });
    if (!coreNeighborhood.length) return null;

    let coreEntryUTC = coreNeighborhood[0].a;
    let finalExitUTC = coreNeighborhood[0].b;
    for (const w of coreNeighborhood) {
      if (w.a < coreEntryUTC) coreEntryUTC = w.a;
      if (w.b > finalExitUTC) finalExitUTC = w.b;
    }

    // padded span overlapping the core span + safety
    const padStart = new Date(coreEntryUTC.getTime() - 240 * 86400000);
    const padEnd   = new Date(finalExitUTC.getTime() + 240 * 86400000);
    const padNeighborhood = padWins.filter(w => !(w.b <= padStart || w.a >= padEnd));
    if (!padNeighborhood.length) return null;

    let paddedEntryUTC = padNeighborhood[0].a;
    let paddedExitUTC  = padNeighborhood[0].b;
    for (const w of padNeighborhood) {
      if (w.a < paddedEntryUTC) paddedEntryUTC = w.a;
      if (w.b > paddedExitUTC) paddedExitUTC = w.b;
    }

    return {
      signIdx: targetSignIdx,
      signStart,
      coreEntryUTC,
      finalExitUTC,
      paddedEntryUTC,
      paddedExitUTC,
    };
  }

  // targets by cycle age (squares/oppositions), but windows are “by sign”
  const targets = [];
  for (let k = 0; k <= 12; k++) {
    const base = period * k;
    const sq1 = base + period / 4;
    const opp = base + period / 2;
    const sq2 = base + (3 * period) / 4;

    if (sq1 > 0.2 && sq1 <= endAge + 1) targets.push({ kind: "square", age: sq1, signDelta: +3 });
    if (opp > 0.2 && opp <= endAge + 1) targets.push({ kind: "opposition", age: opp, signDelta: +6 });
    if (sq2 > 0.2 && sq2 <= endAge + 1) targets.push({ kind: "square", age: sq2, signDelta: -3 });
  }

  const squares = [];
  const oppositions = [];

  for (const t of targets) {
    const targetSignIdx = (natalSignIdx + t.signDelta + 12) % 12;
    const win = await computeJupiterSignWindowByAge(targetSignIdx, t.age);
    if (!win) continue;

    const rec = {
      kind: t.kind,
      aUTC: win.paddedEntryUTC,
      bUTC: win.paddedExitUTC,
      midUTC: new Date((win.paddedEntryUTC.getTime() + win.paddedExitUTC.getTime()) / 2),
      signIdx: win.signIdx,
      signStart: win.signStart,
    };

    if (t.kind === "square") squares.push(rec);
    else oppositions.push(rec);
  }

  squares.sort((a, b) => a.midUTC - b.midUTC);
  oppositions.sort((a, b) => a.midUTC - b.midUTC);

  return { squares, oppositions };
}


/**
 * Age in years, aligned to solar returns (birthdays).
 * - At the exact birthday moment: age is an integer.
 * - Between birthdays: returns a smooth fraction (0..1) into the year.
 */
function solarReturnAgeFloat(birthUTC, nowUTC) {
  const y = nowUTC.getUTCFullYear();
  const bThisYear = birthdayUTC(birthUTC, y);

  // last birthday <= now
  const last = (nowUTC >= bThisYear) ? bThisYear : birthdayUTC(birthUTC, y - 1);
  // next birthday > now
  const next = (nowUTC >= bThisYear) ? birthdayUTC(birthUTC, y + 1) : bThisYear;

  const ageInt = last.getUTCFullYear() - birthUTC.getUTCFullYear();
  const span = Math.max(1, next.getTime() - last.getTime());
  const frac = (nowUTC.getTime() - last.getTime()) / span;

  return ageInt + frac;
}


// Orb for Saturn aspect windows (degrees).
// Start with ~2°; adjust later if you want wider/narrower aspect strips.

/* ============================================================
   4) SIGN / COLOR (whole sign from ASC)
============================================================ */
const elementColors = {
  fire: "#d32f2f",
  earth: "#2e7d32",
  air: "#fbc02d",
  water: "#1976d2",
};

const SIGNS = [
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

function houseForAge(ageYears) {
  // age 0 => 1, age 1 => 2 ... age 11 => 12, age 12 => 1 ...
  const m = ((ageYears % 12) + 12) % 12;
  return m + 1;
}

function signInfoForHouse(houseNum, ascLon) {
  // Whole-sign houses: House 1 = ASC sign, House 2 = next sign, etc.
  const ascIdx = signIndexFromLon(ascLon); // 0..11
  const idx = (ascIdx + (houseNum - 1)) % 12;

  const s = SIGNS[idx] || { glyph: "?", element: "air" };
  const color = elementColors[s.element] || "rgba(255,255,255,0.12)";

  return { glyph: s.glyph, color, signIdx: idx };
}

function fitTickLabelIntoBox(tickEl) {
  const seg = tickEl?.querySelector?.(".ptSeg");
  if (!seg) return;

  const w = seg.getBoundingClientRect().width;

  const houseEl = seg.querySelector(".ptSegHouse");
  const glyphEl = seg.querySelector(".ptSegGlyph");

  // Reset first (in case of rerenders)
  if (houseEl) houseEl.style.display = "";
  if (glyphEl) glyphEl.style.display = "";

  // Tune these thresholds as needed
  if (w < 26) {
    // too small: hide both
    if (houseEl) houseEl.style.display = "none";
    if (glyphEl) glyphEl.style.display = "none";
  } else if (w < 40) {
    // small: hide glyph (prevents crowding into next sign)
    if (glyphEl) glyphEl.style.display = "none";
  }
}

function signColor(idx) {
  const s = SIGNS[idx];
  return s ? elementColors[s.element] : "rgba(255,255,255,0.12)";
}


/* ============================================================
   5) EPHEMERIS ACCESS (MATCHES main.js)
   - For scanning: use getTransitLongitudesUTC via lazy import
   - For real-time marker: __liveBodyLons from zy:time (preferred)
============================================================ */
let ephApiPromise = null;
async function getEphApi() {
  if (!ephApiPromise) ephApiPromise = import("./engine/ephm/ephem-loader.js");
  return ephApiPromise;
}

const __EPH_CACHE = new Map(); // key: ISO -> lonObj

async function getEphemAt(dateUTC) {
  if (!(dateUTC instanceof Date)) return null;
  const key = dateUTC.toISOString();
  if (__EPH_CACHE.has(key)) return __EPH_CACHE.get(key);

  try {
    const { getTransitLongitudesUTC } = await getEphApi();
    const lonObj = await getTransitLongitudesUTC(dateUTC);
    __EPH_CACHE.set(key, lonObj || null);
    return lonObj || null;
  } catch (e) {
    __EPH_CACHE.set(key, null);
    return null;
  }
}

function getSaturnDegFromLonObj(lonObj) {
  const raw = pickLon(lonObj, ["saturn", "Saturn", "♄"]);
  return normalizeDeg(raw);
}

function getJupiterDegFromLonObj(lonObj) {
  const raw = pickLon(lonObj, ["jupiter", "Jupiter", "♃"]);
  return normalizeDeg(raw);
}

async function computePlanetReturnBySignWindow(birthUTC, natalSignIdx, n, planetKey, periodYears) {
  const targetAge = periodYears * n;

  // Wide enough to always catch retrograde passes + multiple entries
  const scanHalfWidth = 4; // years each side (Jupiter needs far less than Saturn)
  const startAge = Math.max(0, targetAge - scanHalfWidth);
  const endAge = targetAge + scanHalfWidth;

  const startUTC = birthdayUTC(birthUTC, birthUTC.getUTCFullYear() + Math.floor(startAge));
  const endUTC   = birthdayUTC(birthUTC, birthUTC.getUTCFullYear() + Math.ceil(endAge));

  const signStart = natalSignIdx * 30;

  const getPlanetDeg = (lonObj) => {
    if (planetKey === "saturn") return getSaturnDegFromLonObj(lonObj);
    if (planetKey === "jupiter") return getJupiterDegFromLonObj(lonObj);
    return NaN;
  };

  const inCore = (deg) => {
    const rel = normalizeDeg(deg - signStart);
    return rel < 30;
  };

  const inPadded = (deg) => {
    const rel = normalizeDeg(deg - signStart);
    return (rel >= 350) || (rel <= 40); // [-10..+40]
  };

  async function planetInsideAt(date, isInFn) {
    const eph = await getEphemAt(date);
    if (!eph) return false;
    const deg = getPlanetDeg(eph);
    if (!Number.isFinite(deg)) return false;
    return !!isInFn(deg);
  }

  async function refineEdge(t0, t1, wantInside, isInFn) {
    let a = new Date(t0);
    let b = new Date(t1);
    for (let i = 0; i < 18; i++) {
      const mid = new Date((a.getTime() + b.getTime()) / 2);
      const inside = await planetInsideAt(mid, isInFn);
      if (inside === wantInside) b = mid;
      else a = mid;
    }
    return b;
  }

  async function buildWindows(isInFn) {
    const wins = [];
    const stepDays = 5; // Jupiter moves faster; finer step helps edges

    let curStart = null;
    let prevD = null;

    for (let d = new Date(startUTC); d <= endUTC; d.setUTCDate(d.getUTCDate() + stepDays)) {
      const inside = await planetInsideAt(d, isInFn);

      if (inside && !curStart) {
        curStart = prevD ? await refineEdge(prevD, d, true, isInFn) : new Date(d);
      }

      if (!inside && curStart) {
        const edge = prevD ? await refineEdge(prevD, d, false, isInFn) : new Date(d);
        wins.push({ a: curStart, b: edge });
        curStart = null;
      }

      prevD = new Date(d);
    }

    if (curStart) wins.push({ a: curStart, b: new Date(endUTC) });
    return wins;
  }

  const coreWins = await buildWindows(inCore);
  const padWins  = await buildWindows(inPadded);
  if (!coreWins.length || !padWins.length) return null;

  // Neighborhood around targetAge (same idea as Saturn)
  const coreNeighborhood = coreWins.filter(w => {
    const mid = new Date((w.a.getTime() + w.b.getTime()) / 2);
    const ageMid = solarReturnAgeFloat(birthUTC, mid);
    return Math.abs(ageMid - targetAge) <= 3;
  });
  if (!coreNeighborhood.length) return null;

  let coreEntryUTC = coreNeighborhood[0].a;
  let finalExitUTC = coreNeighborhood[0].b;
  for (const w of coreNeighborhood) {
    if (w.a < coreEntryUTC) coreEntryUTC = w.a;
    if (w.b > finalExitUTC) finalExitUTC = w.b;
  }

  // Padded span overlapping the core span + safety
  const padStart = new Date(coreEntryUTC.getTime() - 200 * 86400000);
  const padEnd   = new Date(finalExitUTC.getTime() + 200 * 86400000);
  const padNeighborhood = padWins.filter(w => !(w.b <= padStart || w.a >= padEnd));
  if (!padNeighborhood.length) return null;

  let paddedEntryUTC = padNeighborhood[0].a;
  let paddedExitUTC  = padNeighborhood[0].b;
  for (const w of padNeighborhood) {
    if (w.a < paddedEntryUTC) paddedEntryUTC = w.a;
    if (w.b > paddedExitUTC) paddedExitUTC = w.b;
  }

  return {
    n,
    signIdx: natalSignIdx,
    signStart,
    coreEntryUTC,
    finalExitUTC,
    paddedEntryUTC,
    paddedExitUTC,
  };
}

/* ============================================================
   6) SATURN RETURN (BY SIGN) WINDOWS (async coarse scan + refine)
============================================================ */
async function computeSaturnReturnBySignWindow(birthUTC, natalSatSignIdx, n) {
  const period = 29.457;
  const targetAge = period * n;

  const scanHalfWidth = 7; // years on each side
  const startAge = Math.max(0, targetAge - scanHalfWidth);
  const endAge = targetAge + scanHalfWidth;

  const startUTC = birthdayUTC(birthUTC, birthUTC.getUTCFullYear() + Math.floor(startAge));
  const endUTC   = birthdayUTC(birthUTC, birthUTC.getUTCFullYear() + Math.ceil(endAge));

  const signStart = natalSatSignIdx * 30;

  const inCore = (satDeg) => {
    const rel = normalizeDeg(satDeg - signStart); // 0..360
    return rel < 30; // 0..29.999 in that sign
  };

  const inPadded = (satDeg) => {
    const rel = normalizeDeg(satDeg - signStart);
    return (rel >= 350) || (rel <= 40); // [-10..+40] around sign start
  };

  async function satInsideAt(date, isInFn) {
    const eph = await getEphemAt(date);
    if (!eph) return false;
    const sat = getSaturnDegFromLonObj(eph);
    if (!Number.isFinite(sat)) return false;
    return !!isInFn(sat);
  }

  async function refineEdge(t0, t1, wantInside, isInFn) {
    // binary refine to ~hour-ish
    let a = new Date(t0);
    let b = new Date(t1);
    for (let i = 0; i < 18; i++) {
      const mid = new Date((a.getTime() + b.getTime()) / 2);
      const inside = await satInsideAt(mid, isInFn);
      if (inside === wantInside) b = mid;
      else a = mid;
    }
    return b;
  }

  async function buildWindows(isInFn) {
    const wins = [];
    const stepDays = 7;

    let curStart = null;
    let prevD = null;

    for (let d = new Date(startUTC); d <= endUTC; d.setUTCDate(d.getUTCDate() + stepDays)) {
      const inside = await satInsideAt(d, isInFn);

      if (inside && !curStart) {
        curStart = prevD ? await refineEdge(prevD, d, true, isInFn) : new Date(d);
      }

      if (!inside && curStart) {
        const edge = prevD ? await refineEdge(prevD, d, false, isInFn) : new Date(d);
        wins.push({ a: curStart, b: edge });
        curStart = null;
      }

      prevD = new Date(d);
    }

    if (curStart) wins.push({ a: curStart, b: new Date(endUTC) });
    return wins;
  }

  const coreWins = await buildWindows(inCore);
  const padWins  = await buildWindows(inPadded);
  if (!coreWins.length || !padWins.length) return null;

  // Core “neighborhood” around this return
  const coreNeighborhood = coreWins.filter(w => {
    const mid = new Date((w.a.getTime() + w.b.getTime()) / 2);
    const ageMid = solarReturnAgeFloat(birthUTC, mid);
    return Math.abs(ageMid - targetAge) <= 4;
  });
  if (!coreNeighborhood.length) return null;

  // Earliest entry + latest exit (final exit after retrogrades)
  let coreEntryUTC = coreNeighborhood[0].a;
  let finalExitUTC = coreNeighborhood[0].b;
  for (const w of coreNeighborhood) {
    if (w.a < coreEntryUTC) coreEntryUTC = w.a;
    if (w.b > finalExitUTC) finalExitUTC = w.b;
  }

  // Padded span: any padded windows overlapping [coreEntry..finalExit] + safety
  const padStart = new Date(coreEntryUTC.getTime() - 365 * 86400000);
  const padEnd   = new Date(finalExitUTC.getTime() + 365 * 86400000);
  const padNeighborhood = padWins.filter(w => !(w.b <= padStart || w.a >= padEnd));
  if (!padNeighborhood.length) return null;

  let paddedEntryUTC = padNeighborhood[0].a;
  let paddedExitUTC  = padNeighborhood[0].b;
  for (const w of padNeighborhood) {
    if (w.a < paddedEntryUTC) paddedEntryUTC = w.a;
    if (w.b > paddedExitUTC) paddedExitUTC = w.b;
  }

  return {
    n,
    signIdx: natalSatSignIdx,
    signStart,
    coreEntryUTC,
    finalExitUTC,
    paddedEntryUTC,
    paddedExitUTC,
  };
}

let __saturnComputePromise = null;

async function computeSaturnReturnsAndLanes(natalDetail) {
  // ----------------------------
  // Single-flight guard
  // ----------------------------
  if (__saturnComputePromise) return __saturnComputePromise;

  // Local helper to safely set modal/status text
  const setStatus = (txt) => {
    if (cycleSaturnStatus) cycleSaturnStatus.textContent = String(txt || "");
  };

  __saturnComputeRunning = true;
  __saturnComputeDone = false;
  __saturnComputeError = null;

  // Create the tracked promise immediately (so re-entrancy returns same promise)
  __saturnComputePromise = (async () => {
    try {
      const birthUTC = natalDetail?.utc instanceof Date ? natalDetail.utc : null;
      if (!birthUTC) throw new Error("Missing natalDetail.utc (Date).");

      // ----------------------------
      // SATURN: returns + lanes
      // ----------------------------
      const natalSatLon = pickLon(natalDetail?.natalBodyLons, ["saturn", "Saturn", "♄"]);
      if (!Number.isFinite(natalSatLon)) throw new Error("Missing natal Saturn longitude.");

      const natalSatDeg = normalizeDeg(natalSatLon);
      const natalSatSign = signIndexFromLon(natalSatLon);

      setStatus("Calculating cycles…");

      const r1 = await computeSaturnReturnBySignWindow(birthUTC, natalSatSign, 1);
      const r2 = await computeSaturnReturnBySignWindow(birthUTC, natalSatSign, 2);
      const r3 = await computeSaturnReturnBySignWindow(birthUTC, natalSatSign, 3);

      __saturnReturns = [r1, r2, r3].filter(Boolean);

      const w1 = __saturnReturns[0] || null;
      const w2 = __saturnReturns[1] || null;
      const w3 = __saturnReturns[2] || null;

      const end1Age = (w1?.finalExitUTC instanceof Date) ? solarReturnAgeFloat(birthUTC, w1.finalExitUTC) : 33;
      const end2Age = (w2?.finalExitUTC instanceof Date) ? solarReturnAgeFloat(birthUTC, w2.finalExitUTC) : (end1Age + 33);
      const end3Age = (w3?.finalExitUTC instanceof Date) ? solarReturnAgeFloat(birthUTC, w3.finalExitUTC) : (end2Age + 33);

      __laneRanges = [
        { lane: 1, startAge: 0,       endAge: end1Age },
        { lane: 2, startAge: end1Age, endAge: end2Age },
        { lane: 3, startAge: end2Age, endAge: end3Age },
      ];

      // ----------------------------
      // SATURN: aspects within full lane envelope
      // ----------------------------
      const endAgeForAspects =
        (__laneRanges && __laneRanges.length)
          ? __laneRanges[__laneRanges.length - 1].endAge
          : 90;

      __saturnAspects = await computeSaturnAspects(birthUTC, natalSatDeg, endAgeForAspects);

      // ----------------------------
      // JUPITER: returns + aspects (always set arrays/objects)
      // ----------------------------
      __jupiterReturns = [];
      __jupiterAspects = { squares: [], oppositions: [] };

      const natalJupLon = pickLon(natalDetail?.natalBodyLons, ["jupiter", "Jupiter", "♃"]);
      const natalJupDeg = normalizeDeg(natalJupLon);

      if (Number.isFinite(natalJupDeg)) {
        const natalJupSign = signIndexFromLon(natalJupLon);
        const jupPeriod = 11.862;

        // compute enough returns to cover endAgeForAspects
        const jMax = Math.max(1, Math.ceil((endAgeForAspects + 2) / jupPeriod));
        const jr = [];
        for (let n = 1; n <= jMax; n++) {
          const w = await computePlanetReturnBySignWindow(birthUTC, natalJupSign, n, "jupiter", jupPeriod);
          if (w) jr.push(w);
        }
        __jupiterReturns = jr;

        __jupiterAspects = await computeJupiterAspects(birthUTC, natalJupDeg, endAgeForAspects);
      }

      // ----------------------------
      // Logs (optional, but useful)
      // ----------------------------
      console.log(
        "[timeline] laneRanges:",
        (__laneRanges || []).map(x => ({
          lane: x.lane,
          start: x.startAge.toFixed(2),
          end: x.endAge.toFixed(2),
        }))
      );

      console.log(
        "[saturn] returns:",
        (__saturnReturns || []).map(r => ({
          n: r.n,
          sign: SIGNS[r.signIdx]?.glyph,
          core: [r.coreEntryUTC?.toISOString(), r.finalExitUTC?.toISOString()],
          padded: [r.paddedEntryUTC?.toISOString(), r.paddedExitUTC?.toISOString()],
        }))
      );

      console.log("[saturn] aspects:", {
        squares: __saturnAspects?.squares?.length ?? 0,
        oppositions: __saturnAspects?.oppositions?.length ?? 0,
      });

      // done
      setStatus(__saturnReturns.length ? "Cycles ready." : "Could not compute cycles (see console).");
    } catch (err) {
      __saturnComputeError = err;
      console.warn("[timeline] computeSaturnReturnsAndLanes failed:", err);

      // Keep data structures sane so renderers don't explode
      __saturnReturns = __saturnReturns || [];
      __saturnAspects = __saturnAspects || { squares: [], oppositions: [] };
      __laneRanges = __laneRanges || [
        { lane: 1, startAge: 0, endAge: 30 },
        { lane: 2, startAge: 30, endAge: 60 },
        { lane: 3, startAge: 60, endAge: 90 },
      ];
      __jupiterReturns = __jupiterReturns || [];
      __jupiterAspects = __jupiterAspects || { squares: [], oppositions: [] };

      setStatus("Could not compute cycles (see console).");
    } finally {
      __saturnComputeRunning = false;
      __saturnComputeDone = true;
    }
  })();

  return __saturnComputePromise;
}


// ============================================================
// Lane lookup + Base timeline renderer (DROP-IN REPLACEMENT)
// - Keeps exactly ONE findLaneForAge()
// - Renders immediately using default 0–30 / 30–60 / 60–90 lanes
//   if Saturn lanes haven't finished computing yet.
// - When Saturn lanes compute later, your existing code will
//   re-call renderPersonalTimeline() and this will re-render
//   using the real __laneRanges.
// ============================================================

function findLaneForAge(ageFloat) {
  // Use computed ranges if available, otherwise default 0–30 / 30–60 / 60–90
  const ranges = (__laneRanges && __laneRanges.length)
    ? __laneRanges
    : [
        { lane: 1, startAge: 0, endAge: 30 },
        { lane: 2, startAge: 30, endAge: 60 },
        { lane: 3, startAge: 60, endAge: 90 },
      ];

  for (let i = 0; i < ranges.length; i++) {
  const r = ranges[i];
  const isLast = (i === ranges.length - 1);

  // end-exclusive prevents boundary ages from being "claimed" by the lane above
  if (ageFloat >= r.startAge && (isLast ? (ageFloat <= r.endAge) : (ageFloat < r.endAge))) {
    return i;
  }
}
return ranges.length - 1; // clamp
}

/* ============================================================
   7) RENDER: BASE TIMELINE (ticks + houses + sign segments)
============================================================ */
export function renderPersonalTimeline(natalDetail) {
  if (!personalTimeline) return;

  const lanes = Array.from(personalTimeline.querySelectorAll(":scope > .ptLane"));
  if (!lanes.length) return;

  const birthUTC = natalDetail?.utc instanceof Date ? natalDetail.utc : null;
  const ascLon = Number(natalDetail?.ascLon);

  // If we don't have computed ranges yet, render with defaults.
  // Async compute will re-render later.
  const rangesToUse = (__laneRanges && __laneRanges.length)
    ? __laneRanges
    : [
        { lane: 1, startAge: 0, endAge: 30 },
        { lane: 2, startAge: 30, endAge: 60 },
        { lane: 3, startAge: 60, endAge: 90 },
      ];

  lanes.forEach((laneEl, i) => {
    const laneRange = rangesToUse[i] || { startAge: i * 30, endAge: (i + 1) * 30 };

    laneEl.innerHTML = "";

    const ticks = document.createElement("div");
    ticks.className = "ptTicks";
    laneEl.appendChild(ticks);

    const a0 = Math.ceil(laneRange.startAge);
    const a1 = Math.floor(laneRange.endAge);

    // Build *segment starts* (year columns). If lane ends exactly on an integer,
    // do NOT include that integer as a start (prevents a dangling extra year column).
    const endIsInt = Math.abs(laneRange.endAge - a1) < 1e-9;

    const ages = [];
    const lastStart = endIsInt ? (a1 - 1) : a1;
    for (let age = a0; age <= lastStart; age++) ages.push(age);

    if (ages.length < 1) {
      ages.length = 0;
      ages.push(Math.floor(laneRange.startAge));
    }

    // Fractional columns at edges so grid width matches true lane span
    const startFrac = Math.max(0, a0 - laneRange.startAge);     // 0..1 (partial year at lane start)
    const endPart   = endIsInt ? 0 : Math.max(0, laneRange.endAge - a1); // 0..1 (partial year at lane end)

    // Grid columns:
    // [startFrac] + [full 1yr columns] + [endPart]
    ticks.style.display = "grid";
    ticks.style.position = "";

    const hasStart = startFrac > 1e-6;
    const hasEnd   = (!endIsInt && endPart > 1e-6);

    const fullCount = hasEnd ? Math.max(0, ages.length - 1) : ages.length;

    let cols = [];
    if (hasStart) cols.push(`${startFrac}fr`);
    if (fullCount > 0) cols.push(`repeat(${fullCount}, 1fr)`);
    if (hasEnd) cols.push(`${endPart}fr`);

    ticks.style.gridTemplateColumns = cols.join(" ");

    // Carryover partial segment (only when lane start is fractional)
// This fills the remainder of the cut-off sign/year at the start of the next lane (no gaps).
if (hasStart) {
  const carryAge = a0 - 1;                  // floor(laneRange.startAge)
  const carryHouse = houseForAge(carryAge); // house/sign that was cut off

  const tick = document.createElement("div");
  tick.className = "ptTick ptCarry";
  tick.dataset.age = String(carryAge);
  tick.dataset.house = String(carryHouse);

  if (Number.isFinite(ascLon)) {
    const info = signInfoForHouse(carryHouse, ascLon);

    const seg = document.createElement("div");
    seg.className = "ptSeg";
    seg.style.background = info.color;

    const h = document.createElement("span");
    h.className = "ptSegHouse";
    h.textContent = String(carryHouse);

    const g = document.createElement("span");
    g.className = "ptSegGlyph";
    g.textContent = info.glyph;

    seg.appendChild(h);
    seg.appendChild(g);
    tick.appendChild(seg);
  }

  // no age label for carryover fragment (keeps numbering clean)
  ticks.appendChild(tick);
  requestAnimationFrame(() => fitTickLabelIntoBox(tick));
}

    for (const age of ages) {

      const house = houseForAge(age);

      const tick = document.createElement("div");
      tick.className = "ptTick";
      tick.dataset.age = String(age);
      tick.dataset.house = String(house);

      // IMPORTANT: do NOT absolutely position ticks
      tick.style.position = "";
      tick.style.left = "";
      tick.style.width = "";
      tick.style.top = "";
      tick.style.bottom = "";


      if (Number.isFinite(ascLon)) {
        const info = signInfoForHouse(house, ascLon);

        const seg = document.createElement("div");
        seg.className = "ptSeg";
        seg.style.background = info.color;

        const h = document.createElement("span");
        h.className = "ptSegHouse";
        h.textContent = String(house);

        const g = document.createElement("span");
        g.className = "ptSegGlyph";
        g.textContent = info.glyph;

        seg.appendChild(h);
        seg.appendChild(g);
        tick.appendChild(seg);
      }

      const ageLabel = document.createElement("span");
      ageLabel.className = "ptAge";
      ageLabel.textContent = String(age);
      tick.appendChild(ageLabel);

      if (birthUTC) {
        const yr = birthUTC.getUTCFullYear() + age;
        tick.title = `Age ${age} (≈ ${yr}) • House ${house}`;
      } else {
        tick.title = `Age ${age} • House ${house}`;
      }

      ticks.appendChild(tick);
      requestAnimationFrame(() => fitTickLabelIntoBox(tick));
    }
   });
  }

/* ============================================================
   8) SUN MARKER (moves on the lane center line)
============================================================ */
function renderSunMarker(natalDetail) {
  if (!personalTimeline || !ptSun) return;

  const birthUTC = natalDetail?.utc instanceof Date ? natalDetail.utc : null;
  if (!birthUTC) return;

  const nowUTC = __liveDateUTC instanceof Date ? __liveDateUTC : null;
  if (!nowUTC) return;

  if (!__laneRanges) computeSaturnReturnsAndLanes(natalDetail);
  if (!__laneRanges) return;

  const ageFloat = solarReturnAgeFloat(birthUTC, nowUTC);
  const laneIdx = findLaneForAge(ageFloat);

  const r = __laneRanges[laneIdx];
  const span = Math.max(0.25, r.endAge - r.startAge);
  const pct = clamp((ageFloat - r.startAge) / span, 0, 1);

  const lane = personalTimeline.querySelector(`.ptLane[data-lane="${laneIdx + 1}"]`);
  if (!lane) return;

  const laneRect = lane.getBoundingClientRect();
  const pad = 14;
  const usableW = Math.max(1, laneRect.width - pad * 2);

  const x = laneRect.left + pad + usableW * pct;
  const yMid = laneRect.top + laneRect.height * 0.5;

  ptSun.style.position = "fixed";
  ptSun.style.left = `${x}px`;
  ptSun.style.top = `${yMid}px`;
  ptSun.style.transform = "translate(-50%, -50%)";
  ptSun.style.pointerEvents = "none";
  ptSun.style.zIndex = "50";
}

/* ============================================================
   9) MODAL: CYCLES (Saturn toggle for now)
============================================================ */
function openCycles(open) {
  if (!cycleModal) return;
  cycleModal.classList.toggle("isOpen", !!open);
  cycleModal.setAttribute("aria-hidden", open ? "false" : "true");
}

if (cycleBtn) cycleBtn.addEventListener("click", () => openCycles(true));
if (cycleClose) cycleClose.addEventListener("click", () => openCycles(false));
if (cycleModal) {
  cycleModal.addEventListener("click", (e) => {
    if (e.target === cycleModal) openCycles(false);
  });
}

if (cycleSaturn) {
  __cycles.saturn = !!cycleSaturn.checked;

  cycleSaturn.addEventListener("change", () => {
    __cycles.saturn = !!cycleSaturn.checked;
    console.log("[timeline] Saturn cycle:", __cycles.saturn ? "ON" : "OFF");
    if (__natalDetail) renderCyclesOverlays(__natalDetail);
  });
}

/* ============================================================
   10) OVERLAYS: CLEAR / RENDER DISPATCH
============================================================ */
function _clearCyclesOverlays() {
  if (!personalTimeline) return;
  personalTimeline.querySelectorAll(".ptCycleStrip").forEach((el) => el.remove());
  personalTimeline.querySelectorAll(".ptAspectStrip").forEach((el) => el.remove());
  personalTimeline.querySelectorAll(".ptSqMark").forEach((el) => el.remove());
  if (cycleSaturnStatus) cycleSaturnStatus.textContent = "";
}

function renderCyclesOverlays(natalDetail) {
  _clearCyclesOverlays();


  // for now, keep the same toggle controlling “cycles overlay visibility”
  // (we’ll add checkboxes per planet later)
  if (!__cycles.saturn) return;

  try {
    // Jupiter row (0) + Saturn row (1)
    renderJupiterCycleStrips(natalDetail);
    renderJupiterAspectStrips(natalDetail);

    renderSaturnCycleStrips(natalDetail);
    renderSaturnAspectStrips(natalDetail);
  } catch (err) {
    console.warn("[timeline] cycles overlay failed", err);
    if (cycleSaturnStatus) cycleSaturnStatus.textContent = "Cycles overlay error (see console).";
  }
}

// ============================================================
// Cycle overlay vertical layout (per-lane)
// - Lane-relative (no getBoundingClientRect for vertical)
// - Pixel-snapped to prevent subpixel "jumping"
// - Back-compat: supports old --ptCycleTop, prefers new --ptCycleTop0
// ============================================================

const CYCLE_ROW = {
  // bottom → up
  pluto: 4,
  neptune: 3,
  uranus: 2,
  saturn: 1,
  jupiter: 0,
};

const CYCLE_DEFAULTS = {
  top0: 10,   // px from lane top (reasonable default)
  rowH: 46,   // px per planet block (return+gap+aspect)
  subH: 22,   // px between return strip (sub=0) and aspect strip (sub=1)
};

function _num(v) {
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}

function _readCssPxVar(el, varName) {
  if (!el) return NaN;
  const raw = getComputedStyle(el).getPropertyValue(varName);
  return _num(raw);
}

function _clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Returns the vertical "top" for a strip inside a lane.
 * planetKey: "saturn" | "jupiter" | ...
 * sub: 0 => return strip, 1 => aspect strip
 */
function cycleTopPxInLane(laneEl, planetKey, sub = 0) {
  const r = CYCLE_ROW[planetKey] ?? 0;

  // Prefer the new name (top of the first planet row)
  let top0 = _readCssPxVar(laneEl, "--ptCycleTop0");

  // Back-compat: if only --ptCycleTop exists, use it BUT clamp hard.
  // This prevents the old "88px" value from pushing strips into the timeline.
  if (!Number.isFinite(top0)) {
    top0 = _readCssPxVar(laneEl, "--ptCycleTop");
  }
  if (!Number.isFinite(top0)) top0 = CYCLE_DEFAULTS.top0;
  top0 = _clamp(top0, 0, 40); // <— key fix: stops 88px from breaking layout

  let rowH = _readCssPxVar(laneEl, "--ptCycleRowH");
  if (!Number.isFinite(rowH)) rowH = CYCLE_DEFAULTS.rowH;
  rowH = _clamp(rowH, 30, 80);

  let subH = _readCssPxVar(laneEl, "--ptCycleSubH");
  if (!Number.isFinite(subH)) subH = CYCLE_DEFAULTS.subH;
  subH = _clamp(subH, 18, 40);

  // Pixel snap prevents jitter from fractional layout/zoom changes
  const y = Math.round(top0 + r * rowH + sub * subH);
  return `${y}px`;
}

/* ============================================================
   11) SATURN CYCLE STRIPS (ONE PER RETURN / LANE)
============================================================ */
function ensureSaturnStripNode(returnN, laneEl) {
  if (!laneEl) return null;

  let strip = personalTimeline.querySelector(
  `.ptCycleStrip[data-planet="saturn"][data-return="${returnN}"]`
  );
  if (strip && strip.parentElement !== laneEl) laneEl.appendChild(strip);

  if (!strip) {
    strip = document.createElement("div");
    strip.className = "ptCycleStrip";
    strip.dataset.planet = "saturn";
    strip.dataset.return = String(returnN);

    strip.style.position = "absolute";
    strip.style.height = "18px";
    strip.style.borderRadius = "4px";
    strip.style.zIndex = "60";
    strip.style.pointerEvents = "none";
    strip.style.overflow = "hidden";
    strip.style.display = "flex";
    strip.style.alignItems = "center";

    strip.innerHTML = `
      <div class="ptCycleEdge left"></div>
      <div class="ptCycleCenter"></div>
      <div class="ptCycleEdge right"></div>
      <div class="ptSaturnNow">♄</div>
    `;

    laneEl.appendChild(strip);
  }

  return strip;
}

    function ensureSaturnAspectStripNode(key, laneEl) {
      if (!laneEl) return null;

    let strip = laneEl.querySelector(
      `.ptAspectStrip[data-planet="saturn"][data-key="${key}"]`
    );

  if (!strip) {
    strip = document.createElement("div");
    strip.className = "ptAspectStrip";
    strip.dataset.planet = "saturn";
    strip.dataset.key = key;

    strip.style.position = "absolute";
    strip.style.height = "18px";
    strip.style.borderRadius = "4px";
    strip.style.zIndex = "59";
    strip.style.pointerEvents = "none";
    strip.style.overflow = "hidden";
    strip.style.display = "flex";
    strip.style.alignItems = "center";

    strip.innerHTML = `
      <div class="ptCycleEdge left"></div>
      <div class="ptCycleCenter"></div>
      <div class="ptCycleEdge right"></div>
      <div class="ptSaturnNow">♄</div>
    `;

    laneEl.appendChild(strip);
  }

  return strip;
}


function renderSaturnAspectStrips(natalDetail) {
  if (!personalTimeline) return;
  const birthUTC = natalDetail?.utc instanceof Date ? natalDetail.utc : null;
  if (!birthUTC) return;

  if (!__saturnAspects || !__laneRanges) return;

  const nowUTC = __liveDateUTC instanceof Date ? __liveDateUTC : null;

  // live saturn (prefer stream)
  const liveSatDeg = (() => {
    const src = __liveBodyLons || null;
    if (!src) return NaN;
    const v = pickLon(src, ["saturn", "Saturn", "♄"]);
    const d = normalizeDeg(v);
    return Number.isFinite(d) ? d : NaN;
  })();

  // NOTE: don't remove on every tick; we reuse nodes so the transit marker can update smoothly
  // personalTimeline.querySelectorAll(".ptAspectStrip").forEach(el => el.remove());

  const all = [
    ...(__saturnAspects.squares || []),
    ...(__saturnAspects.oppositions || []),
  ];

  for (let i = 0; i < all.length; i++) {
    const a = all[i];

    const entryAge = solarReturnAgeFloat(birthUTC, a.aUTC);
    const exitAge  = solarReturnAgeFloat(birthUTC, a.bUTC);

    const midAge = (entryAge + exitAge) / 2;
    const laneIdx = findLaneForAge(midAge);
    const laneRange = __laneRanges[laneIdx];
    const laneEl = personalTimeline.querySelector(`.ptLane[data-lane="${laneIdx + 1}"]`);
    if (!laneEl) continue;

    const key = `${a.kind}-${i}`;
    const strip = ensureSaturnAspectStripNode(key, laneEl);
    if (!strip) continue;

    const laneRect = laneEl.getBoundingClientRect();

    const pad = 14;
    const usableW = Math.max(1, laneRect.width - pad * 2);

    const laneSpan = Math.max(0.25, laneRange.endAge - laneRange.startAge);
    const x0pct = clamp((entryAge - laneRange.startAge) / laneSpan, 0, 1);
    const x1pct = clamp((exitAge  - laneRange.startAge) / laneSpan, 0, 1);

    const leftPx  = pad + usableW * x0pct;
    const widthPx = Math.max(1, usableW * (x1pct - x0pct));


    strip.style.left  = `${leftPx}px`;
    strip.style.width = `${widthPx}px`;

    const returnSign = a.signIdx;
    const prevSign = (returnSign + 11) % 12;
    const nextSign = (returnSign + 1) % 12;

    strip.style.background = signColor(returnSign);

    const leftEdge = strip.querySelector(".ptCycleEdge.left");
    const rightEdge = strip.querySelector(".ptCycleEdge.right");
    const center = strip.querySelector(".ptCycleCenter");
    const marker = strip.querySelector(".ptSaturnNow");

    if (leftEdge) { leftEdge.style.background = signColor(prevSign); leftEdge.style.width = "18%"; leftEdge.style.height = "100%"; }
    if (rightEdge){ rightEdge.style.background = signColor(nextSign); rightEdge.style.width = "18%"; rightEdge.style.height = "100%"; }

    if (center) {
      const aspectGlyph = (a.kind === "square") ? "□" : (a.kind === "opposition") ? "☍" : "";
      center.textContent = `${SIGNS[returnSign]?.glyph ?? "?"} ${aspectGlyph}`.trim();
      center.style.fontSize = "14px";
      center.style.lineHeight = "1";
      center.style.flex = "1";
      center.style.textAlign = "center";
    }

    // marker (same behavior as return strips)
    if (marker) {
      marker.style.position = "absolute";
      marker.style.top = "50%";
      marker.style.transform = "translate(-50%, -50%)";
      marker.style.zIndex = "65";
      marker.style.opacity = "0";

      const inWindow = !!nowUTC && (nowUTC >= a.aUTC && nowUTC <= a.bUTC) && Number.isFinite(liveSatDeg);

      if (inWindow) {
        // padded window mapping: [-10..+40] => 0..50
        const windowStart = normalizeDeg(a.signStart - 10);
        const rel = normalizeDeg(liveSatDeg - windowStart); // 0..360
        const t = clamp(rel / 50, 0, 1);

        marker.style.left = `${widthPx * t}px`;
        marker.style.opacity = "0.95";
      }
    }
  }
}

function ensureJupiterStripNode(returnN, laneEl) {
  if (!laneEl) return null;

  let strip = personalTimeline.querySelector(
  `.ptCycleStrip[data-planet="jupiter"][data-return="${returnN}"]`
  );
  if (strip && strip.parentElement !== laneEl) laneEl.appendChild(strip);


  if (!strip) {
    strip = document.createElement("div");
    strip.className = "ptCycleStrip";
    strip.dataset.planet = "jupiter";
    strip.dataset.return = String(returnN);

    strip.style.position = "absolute";
    strip.style.height = "18px";
    strip.style.borderRadius = "4px";
    strip.style.zIndex = "57";
    strip.style.pointerEvents = "none";
    strip.style.overflow = "hidden";
    strip.style.display = "flex";
    strip.style.alignItems = "center";

    strip.innerHTML = `
      <div class="ptCycleEdge left"></div>
      <div class="ptCycleCenter"></div>
      <div class="ptCycleEdge right"></div>
      <div class="ptSaturnNow">♃</div>
    `;

    laneEl.appendChild(strip);
  }

  return strip;
}

function ensureJupiterAspectStripNode(key, laneEl) {
  if (!laneEl) return null;

  let strip = laneEl.querySelector(
    `.ptAspectStrip[data-planet="jupiter"][data-key="${key}"]`
  );

  if (!strip) {
    strip = document.createElement("div");
    strip.className = "ptAspectStrip";
    strip.dataset.planet = "jupiter";
    strip.dataset.key = key;

    strip.style.position = "absolute";
    strip.style.height = "18px";
    strip.style.borderRadius = "4px";
    strip.style.zIndex = "56";
    strip.style.pointerEvents = "none";
    strip.style.overflow = "hidden";
    strip.style.display = "flex";
    strip.style.alignItems = "center";

    strip.innerHTML = `
      <div class="ptCycleEdge left"></div>
      <div class="ptCycleCenter"></div>
      <div class="ptCycleEdge right"></div>
      <div class="ptSaturnNow">♃</div>
    `;

    laneEl.appendChild(strip);
  }

   return strip;
}

function renderJupiterCycleStrips(natalDetail) {
  if (!personalTimeline) return;

  const birthUTC = natalDetail?.utc instanceof Date ? natalDetail.utc : null;
  if (!birthUTC) return;

  if (!__jupiterReturns || !__laneRanges) return;

  const nowUTC = __liveDateUTC instanceof Date ? __liveDateUTC : null;

  const liveJupDeg = (() => {
    const src = __liveBodyLons || null;
    if (!src) return NaN;
    const v = pickLon(src, ["jupiter", "Jupiter", "♃"]);
    const d = normalizeDeg(v);
    return Number.isFinite(d) ? d : NaN;
  })();

  for (const w of __jupiterReturns) {
  // PADDED edges (for strip width)
  const aUTC = w.paddedEntryUTC;
  const bUTC = w.paddedExitUTC;
  if (!(aUTC instanceof Date) || !(bUTC instanceof Date)) continue;

  // CORE edges (for lane assignment)
  const caUTC = w.coreEntryUTC;
  const cbUTC = w.finalExitUTC;
  if (!(caUTC instanceof Date) || !(cbUTC instanceof Date)) continue;

  // ages for width
  const entryAge = solarReturnAgeFloat(birthUTC, aUTC);
  const exitAge  = solarReturnAgeFloat(birthUTC, bUTC);

  // ages for lane choice (stable)
  const coreEntryAge = solarReturnAgeFloat(birthUTC, caUTC);
  const coreExitAge  = solarReturnAgeFloat(birthUTC, cbUTC);
  const coreMidAge   = (coreEntryAge + coreExitAge) / 2;

  const laneIdx = findLaneForAge(coreMidAge);
  const laneRange = __laneRanges[laneIdx];
  const laneEl = personalTimeline.querySelector(`.ptLane[data-lane="${laneIdx + 1}"]`);
  if (!laneEl) continue;


    const strip = ensureJupiterStripNode(w.n, laneEl);
    if (!strip) continue;

    // IMPORTANT: let CSS own vertical placement (kills old inline top from earlier builds)
    strip.style.removeProperty("top");

    const laneRect = laneEl.getBoundingClientRect();

    const pad = 14;
    const usableW = Math.max(1, laneRect.width - pad * 2);

    const laneSpan = Math.max(0.25, laneRange.endAge - laneRange.startAge);
    const x0pct = clamp((entryAge - laneRange.startAge) / laneSpan, 0, 1);
    const x1pct = clamp((exitAge  - laneRange.startAge) / laneSpan, 0, 1);

    const leftPx  = pad + usableW * x0pct;
    const widthPx = usableW * (x1pct - x0pct);

    strip.style.left  = `${leftPx}px`;
    strip.style.width = `${widthPx}px`;

    const signIdx = w.signIdx;
    const prevSign = (signIdx + 11) % 12;
    const nextSign = (signIdx + 1) % 12;

    strip.style.background = signColor(signIdx);

    const leftEdge = strip.querySelector(".ptCycleEdge.left");
    const rightEdge = strip.querySelector(".ptCycleEdge.right");
    const center = strip.querySelector(".ptCycleCenter");
    const marker = strip.querySelector(".ptSaturnNow");

    if (leftEdge) { leftEdge.style.background = signColor(prevSign); leftEdge.style.width = "18%"; leftEdge.style.height = "100%"; }
    if (rightEdge){ rightEdge.style.background = signColor(nextSign); rightEdge.style.width = "18%"; rightEdge.style.height = "100%"; }

    if (center) {
      const signGlyph = SIGNS[signIdx]?.glyph ?? "?";
      center.textContent = `${signGlyph} ☌`;
      center.style.fontSize = "14px";
      center.style.lineHeight = "1";
      center.style.flex = "1";
      center.style.textAlign = "center";
    }

    if (marker) {
      marker.style.position = "absolute";
      marker.style.top = "50%";
      marker.style.transform = "translate(-50%, -50%)";
      marker.style.zIndex = "65";
      marker.style.opacity = "0";

      const inWindow = !!nowUTC && (nowUTC >= aUTC && nowUTC <= bUTC) && Number.isFinite(liveJupDeg);

      if (inWindow) {
        const windowStart = normalizeDeg(w.signStart - 10);
        const rel = normalizeDeg(liveJupDeg - windowStart);
        const t = clamp(rel / 50, 0, 1);

        marker.style.left = `${widthPx * t}px`;
        marker.style.opacity = "0.95";
      }
    }
  }
}

function renderJupiterAspectStrips(natalDetail) {
  if (!personalTimeline) return;

  const birthUTC = natalDetail?.utc instanceof Date ? natalDetail.utc : null;
  if (!birthUTC) return;

  if (!__jupiterAspects || !__laneRanges) return;

  const nowUTC = __liveDateUTC instanceof Date ? __liveDateUTC : null;

  const liveJupDeg = (() => {
    const src = __liveBodyLons || null;
    if (!src) return NaN;
    const v = pickLon(src, ["jupiter", "Jupiter", "♃"]);
    const d = normalizeDeg(v);
    return Number.isFinite(d) ? d : NaN;
  })();

  const all = [
    ...(__jupiterAspects.squares || []),
    ...(__jupiterAspects.oppositions || []),
  ];

  for (let i = 0; i < all.length; i++) {
    const a = all[i];

    const entryAge = solarReturnAgeFloat(birthUTC, a.aUTC);
    const exitAge  = solarReturnAgeFloat(birthUTC, a.bUTC);

    const midAge = (entryAge + exitAge) / 2;
    const laneIdx = findLaneForAge(midAge);
    const laneRange = __laneRanges[laneIdx];
    const laneEl = personalTimeline.querySelector(`.ptLane[data-lane="${laneIdx + 1}"]`);
    if (!laneEl) continue;

    const key = `${a.kind}-${i}`;
    const strip = ensureJupiterAspectStripNode(key, laneEl);
    if (!strip) continue;

    const laneRect = laneEl.getBoundingClientRect();

    const pad = 14;
    const usableW = Math.max(1, laneRect.width - pad * 2);

    const laneSpan = Math.max(0.25, laneRange.endAge - laneRange.startAge);
    const x0pct = clamp((entryAge - laneRange.startAge) / laneSpan, 0, 1);
    const x1pct = clamp((exitAge  - laneRange.startAge) / laneSpan, 0, 1);

    const leftPx  = pad + usableW * x0pct;
    const widthPx = Math.max(1, usableW * (x1pct - x0pct));

    strip.style.left  = `${leftPx}px`;
    strip.style.width = `${widthPx}px`;

    const signIdx = a.signIdx;
    const prevSign = (signIdx + 11) % 12;
    const nextSign = (signIdx + 1) % 12;

    strip.style.background = signColor(signIdx);

    const leftEdge = strip.querySelector(".ptCycleEdge.left");
    const rightEdge = strip.querySelector(".ptCycleEdge.right");
    const center = strip.querySelector(".ptCycleCenter");
    const marker = strip.querySelector(".ptSaturnNow");

    if (leftEdge) { leftEdge.style.background = signColor(prevSign); leftEdge.style.width = "18%"; leftEdge.style.height = "100%"; }
    if (rightEdge){ rightEdge.style.background = signColor(nextSign); rightEdge.style.width = "18%"; rightEdge.style.height = "100%"; }

    if (center) {
      const aspectGlyph = (a.kind === "square") ? "□" : (a.kind === "opposition") ? "☍" : "";
      center.textContent = `${SIGNS[signIdx]?.glyph ?? "?"} ${aspectGlyph}`.trim();
      center.style.fontSize = "14px";
      center.style.lineHeight = "1";
      center.style.flex = "1";
      center.style.textAlign = "center";
    }

    if (marker) {
      marker.style.position = "absolute";
      marker.style.top = "50%";
      marker.style.transform = "translate(-50%, -50%)";
      marker.style.zIndex = "65";
      marker.style.opacity = "0";

      const inWindow = !!nowUTC && (nowUTC >= a.aUTC && nowUTC <= a.bUTC) && Number.isFinite(liveJupDeg);

      if (inWindow) {
        const windowStart = normalizeDeg(a.signStart - 10);
        const rel = normalizeDeg(liveJupDeg - windowStart);
        const t = clamp(rel / 50, 0, 1);

        marker.style.left = `${widthPx * t}px`;
        marker.style.opacity = "0.95";
      }
    }
  }
}

function renderSaturnCycleStrips(natalDetail) {
  if (!personalTimeline) return;

  const birthUTC = natalDetail?.utc instanceof Date ? natalDetail.utc : null;
  if (!birthUTC) return;

  if ((!__saturnReturns || !__laneRanges) && !__saturnComputeRunning) {
  // kick off compute once
  __saturnComputePromise = computeSaturnReturnsAndLanes(natalDetail);
}

if (!__saturnReturns || !__laneRanges) {
  // ✅ show "working" while async compute is in flight
  if (cycleSaturnStatus) {
    cycleSaturnStatus.textContent = __saturnComputeDone
      ? "Could not compute cycles (see console)."
      : "Calculating cycles…";
  }
  return;
}
  const nowUTC = __liveDateUTC instanceof Date ? __liveDateUTC : null;

  const natalSatLon = pickLon(natalDetail?.natalBodyLons, ["saturn", "Saturn", "♄"]);
  const natalSatDeg = normalizeDeg(natalSatLon);

  // live saturn (prefer stream)
  const liveSatDeg = (() => {
  const src = __liveBodyLons || null;
  if (!src) return NaN;
  const v = pickLon(src, ["saturn", "Saturn", "♄"]);
  const d = normalizeDeg(v);
  return Number.isFinite(d) ? d : NaN;
})();

  let statusLine = "";

  for (const w of __saturnReturns) {
    // PADDED edges (for strip width)
    const aUTC = w.paddedEntryUTC;
    const bUTC = w.paddedExitUTC;
    if (!(aUTC instanceof Date) || !(bUTC instanceof Date)) continue;

    // CORE edges (for lane assignment)
    const caUTC = w.coreEntryUTC;
    const cbUTC = w.finalExitUTC;
    if (!(caUTC instanceof Date) || !(cbUTC instanceof Date)) continue;

    // ages for width
    const entryAge = solarReturnAgeFloat(birthUTC, aUTC);
    const exitAge  = solarReturnAgeFloat(birthUTC, bUTC);

    // ages for lane choice (stable)
    const coreEntryAge = solarReturnAgeFloat(birthUTC, caUTC);
    const coreExitAge  = solarReturnAgeFloat(birthUTC, cbUTC);
    const coreMidAge   = (coreEntryAge + coreExitAge) / 2;

    const laneIdx = findLaneForAge(coreMidAge);
    const laneRange = __laneRanges[laneIdx];
    const laneEl = personalTimeline.querySelector(`.ptLane[data-lane="${laneIdx + 1}"]`);
    if (!laneEl) continue;

    const strip = ensureSaturnStripNode(w.n, laneEl);
    if (!strip) continue;

    // IMPORTANT: let CSS own vertical placement (kills old inline top from earlier builds)
    strip.style.removeProperty("top");

    // lane geometry
    const laneRect = laneEl.getBoundingClientRect();

    const pad = 14;
    const usableW = Math.max(1, laneRect.width - pad * 2);

    // map using actual lane span
    const laneSpan = Math.max(0.25, laneRange.endAge - laneRange.startAge);
    const x0pct = clamp((entryAge - laneRange.startAge) / laneSpan, 0, 1);
    const x1pct = clamp((exitAge  - laneRange.startAge) / laneSpan, 0, 1);

    const leftPx  = pad + usableW * x0pct;                 // ✅ relative to lane
    const widthPx = usableW * (x1pct - x0pct);             // ✅ true span

    strip.style.left  = `${leftPx}px`;
    strip.style.width = `${widthPx}px`;

    // visuals
    const returnSign = w.signIdx;
    const prevSign = (returnSign + 11) % 12;
    const nextSign = (returnSign + 1) % 12;

    strip.style.background = signColor(returnSign);

    const leftEdge = strip.querySelector(".ptCycleEdge.left");
    const rightEdge = strip.querySelector(".ptCycleEdge.right");
    const center = strip.querySelector(".ptCycleCenter");
    const marker = strip.querySelector(".ptSaturnNow");

    if (leftEdge) leftEdge.style.background = signColor(prevSign);
    if (rightEdge) rightEdge.style.background = signColor(nextSign);

    if (center) {
      const signGlyph = SIGNS[returnSign]?.glyph ?? "?";
      center.textContent = `${signGlyph} ☌`;
      center.style.fontSize = "14px";
      center.style.lineHeight = "1";
      center.style.flex = "1";
    }

    // edges need width (even if CSS is missing)
    if (leftEdge) { leftEdge.style.width = "18%"; leftEdge.style.height = "100%"; }
    if (rightEdge){ rightEdge.style.width = "18%"; rightEdge.style.height = "100%"; }

    // marker
    if (marker) {
      marker.style.position = "absolute";
      marker.style.top = "50%";
      marker.style.transform = "translate(-50%, -50%)";
      marker.style.zIndex = "65";
      marker.style.opacity = "0";

      const inWindow = !!nowUTC && (nowUTC >= aUTC && nowUTC <= bUTC) && Number.isFinite(liveSatDeg);

      if (inWindow) {
        // padded window mapping: [-10..+40] => 0..50
        const windowStart = normalizeDeg(w.signStart - 10);
        const rel = normalizeDeg(liveSatDeg - windowStart); // 0..360
        const t = clamp(rel / 50, 0, 1);

        marker.style.left = `${widthPx * t}px`;
        marker.style.opacity = "0.95";

        const dist = angularDistanceDeg(liveSatDeg, natalSatDeg);
        statusLine = `♄ return ${w.n}: ${SIGNS[returnSign]?.glyph ?? "?"} • orb: ${dist.toFixed(1)}°`;
      }
    }
  }

  if (cycleSaturnStatus) {
    cycleSaturnStatus.textContent = statusLine || "Saturn Return (by sign) ready.";
  }
}

/* ============================================================
   12) EVENT WIRING: NATAL LOADED (main.js dispatches "zy:natal")
============================================================ */
window.addEventListener("zy:natal", (e) => {
  const on = !!(e?.detail?.natalBodyLons);
  setTimelineActive(on);

  __natalDetail = on ? e.detail : null;

  __saturnReturns = null;
  __laneRanges = null;
  __EPH_CACHE?.clear?.();
  __saturnComputePromise = null;

  if (!on) {
    // Notify UI: timeline is idle/reset
    window.dispatchEvent(new CustomEvent("zy:timeline:calc", { detail: { state: "reset" } }));
    _clearCyclesOverlays();
    return;
  }

  // Notify UI: we are about to calculate/render timeline + cycles
  window.dispatchEvent(new CustomEvent("zy:timeline:calc", { detail: { state: "start" } }));

  // 1) Render immediately with default lanes so UI is never blank
  renderPersonalTimeline(e.detail);
  renderSunMarker(e.detail);
  renderCyclesOverlays(e.detail);

  // 2) Compute async, then re-render with true Saturn-terminated lanes
  __saturnComputePromise = (async () => {
    try {
      await computeSaturnReturnsAndLanes(e.detail);
      renderPersonalTimeline(e.detail);
      renderSunMarker(e.detail);
      renderCyclesOverlays(e.detail);

      // Notify UI: done
      window.dispatchEvent(new CustomEvent("zy:timeline:calc", { detail: { state: "done" } }));
    } catch (err) {
      console.warn("computeSaturnReturnsAndLanes failed", err);
      window.dispatchEvent(new CustomEvent("zy:timeline:calc", { detail: { state: "error" } }));
    }
  })();
});

/* ============================================================
   13) EVENT WIRING: LIVE TIME (band dispatches "zy:time")
============================================================ */
window.addEventListener("zy:time", (ev) => {
  const d = ev?.detail?.date;
  if (!(d instanceof Date)) return;

  __liveDateUTC = d;
  __liveBodyLons = ev?.detail?.bodyLons || null;

  if (personalTimeline?.classList.contains("isActive") && __natalDetail) {
    renderSunMarker(__natalDetail);
        if (__cycles.saturn) {
          // Don't clear; just reposition + move marker
          try { renderJupiterCycleStrips(__natalDetail); } catch {}
          try { renderJupiterAspectStrips(__natalDetail); } catch {}
          try { renderSaturnCycleStrips(__natalDetail); } catch {}
          try { renderSaturnAspectStrips(__natalDetail); } catch {}
        }
  }
});

/* ============================================================
   14) RESIZE-SAFE REDRAW
============================================================ */
if (personalTimeline) {
  const ro = new ResizeObserver(() => {
    if (!personalTimeline.classList.contains("isActive")) return;
    if (!__natalDetail) return;

      renderPersonalTimeline(__natalDetail);
      renderSunMarker(__natalDetail);
      renderCyclesOverlays(__natalDetail);
    });
  ro.observe(personalTimeline);
}

