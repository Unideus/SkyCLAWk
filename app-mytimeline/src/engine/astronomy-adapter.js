/* astronomy-adapter.js — ephemeris adapter layer (FIXED)
   =========================================================
   PLANET LONGITUDES ADAPTER
   Geocentric apparent ecliptic longitudes (retrograde-capable)
   + True / Mean Lunar Nodes (☊/☋)
   + Robust SwissEph WASM return-shape handling
   + Frame cache (band + wheel call this a lot)
   ========================================================= */

const __EPHEM_CACHE__ = window.__ephem_cache || (window.__ephem_cache = Object.create(null));

function getPlanetLongitudes(dateUTC) {
  const norm = (deg) => ((deg % 360) + 360) % 360;

  const useDate = (dateUTC instanceof Date && !Number.isNaN(dateUTC.getTime()))
    ? dateUTC
    : (window.AstroEngine && window.AstroEngine.dateUTC instanceof Date ? window.AstroEngine.dateUTC : new Date());

  const cacheKey = String(useDate.getTime());
  if (__EPHEM_CACHE__[cacheKey]) return __EPHEM_CACHE__[cacheKey];

  // JD(UT) helpers
  const jdFromDateUTC_fallback = (d) => (d.getTime() / 86400000) + 2440587.5;

  const meanAscendingNodeLon = (jd) => {
    const T = (jd - 2451545.0) / 36525.0;
    const omega =
      125.04452
      - 1934.136261 * T
      + 0.0020708 * T * T
      + (T * T * T) / 450000;
    return norm(omega);
  };

  const jdUT = (typeof window.jdFromDateUTC === "function")
    ? window.jdFromDateUTC(useDate)
    : jdFromDateUTC_fallback(useDate);

  const nodeMeanA = meanAscendingNodeLon(jdUT);
  const nodeMeanD = norm(nodeMeanA + 180);
  
  // --- Swiss Ephemeris initialization (ensure ephemeris engine is ready) ---
	if (window.SWE) {
	  // Try the basic initialization call — this makes SwissEph behave consistently
	  if (typeof window.SWE.swe_set_ephe_path === "function") {
		window.SWE.swe_set_ephe_path(""); // empty string = use default/embedded ephemeris
		console.log("[SWE] ephemeris path initialized via swe_set_ephe_path");
	  } else if (typeof window.SWE.swe_set_ephe_path_utf8 === "function") {
		window.SWE.swe_set_ephe_path_utf8("");
		console.log("[SWE] ephemeris path initialized via swe_set_ephe_path_utf8");
	  } else {
    if (!window.__SWE_EPHEMSG_ONCE__) {
      window.__SWE_EPHEMSG_ONCE__ = true;
      console.log("[SWE] swe_set_ephe_path not exposed (ok for embedded/wasm builds).");
    }
	  }
	}


  // --- Swiss Ephemeris (WASM) ---
  const canSwiss = !!(window.SWE_READY && window.SWE && typeof window.SWE.calc_ut === "function");
  if (canSwiss) {
    const swe = window.SWE;

    const gregFlag =
      (typeof swe.SE_GREG_CAL !== "undefined") ? swe.SE_GREG_CAL :
      (typeof swe.GREG_CAL !== "undefined") ? swe.GREG_CAL :
      1;

    let jdSwe = jdUT;
    try {
      const hour =
        useDate.getUTCHours() +
        useDate.getUTCMinutes() / 60 +
        useDate.getUTCSeconds() / 3600 +
        useDate.getUTCMilliseconds() / 3600000;

      if (typeof swe.julday === "function") {
        // (year, month, day, hour, gregflag)
        jdSwe = swe.julday(
          useDate.getUTCFullYear(),
          useDate.getUTCMonth() + 1,
          useDate.getUTCDate(),
          hour,
          gregFlag
        );
      }
    } catch (e) {
      // keep jdSwe = jdUT
    }

    const flags =
      (swe.SEFLG_SWIEPH || 0) |
      (swe.SEFLG_SPEED  || 0);

    const extractLon = (out) => {
      let xx = out;
      // 1) [lon, lat, dist, ...]
      // 2) [[lon, lat, dist, ...], retflag]
      // 3) { xx: [lon, lat, dist, ...], ... }
      // 4) { data: [lon, lat, dist, ...], ... }
      if (Array.isArray(out) && Array.isArray(out[0])) xx = out[0];
      if (out && typeof out === "object" && Array.isArray(out.xx)) xx = out.xx;
      if (out && typeof out === "object" && Array.isArray(out.data)) xx = out.data;
      if (!Array.isArray(xx) && xx && typeof xx === "object" && typeof xx.length === "number") {
        xx = Array.from(xx);
      }
      const lon = Array.isArray(xx) ? Number(xx[0]) : Number(xx);
      return lon;
    };

    const swissLon = (pid) => {
      const out = swe.calc_ut(jdSwe, pid, flags);
      const lon = extractLon(out);
      if (!Number.isFinite(lon)) throw new Error("SwissEph calc_ut returned non-finite longitude");
      return norm(lon);
    };

    try {
      const result = {
        sun:     swissLon(swe.SE_SUN),
        moon:    swissLon(swe.SE_MOON),
        mercury: swissLon(swe.SE_MERCURY),
        venus:   swissLon(swe.SE_VENUS),
        mars:    swissLon(swe.SE_MARS),
        jupiter: swissLon(swe.SE_JUPITER),
        saturn:  swissLon(swe.SE_SATURN),
        uranus:  swissLon(swe.SE_URANUS),
        neptune: swissLon(swe.SE_NEPTUNE),
        pluto:   swissLon(swe.SE_PLUTO),
      };

      if (typeof swe.SE_TRUE_NODE !== "undefined") {
        const nn = swissLon(swe.SE_TRUE_NODE);
        result.northNode = nn;
        result.southNode = norm(nn + 180);
      } else {
        result.northNode = nodeMeanA;
        result.southNode = nodeMeanD;
      }

      if (!window.__EPHEM_ONCE__) {
        window.__EPHEM_ONCE__ = true;
        console.log("[EPHEM] SwissEph OK", useDate.toISOString(), "JD(UT)", jdSwe, "gregFlag", gregFlag);
      }

      __EPHEM_CACHE__[cacheKey] = result;
      return result;
    } catch (e) {
      console.warn("[EPHEM] SwissEph failed; falling back.", e);
    }
  }

  // --- Astronomy Engine fallback ---
  if (typeof window.Astronomy !== "undefined") {
    try {
      const t = window.Astronomy.MakeTime(useDate);
      const geoLon = (body) => {
        const vec = window.Astronomy.GeoVector(body, t, true);
        const ecl = window.Astronomy.Ecliptic(vec);
        return norm(ecl.elon);
      };

      const result = {
        sun:     geoLon(window.Astronomy.Body.Sun),
        moon:    geoLon(window.Astronomy.Body.Moon),
        mercury: geoLon(window.Astronomy.Body.Mercury),
        venus:   geoLon(window.Astronomy.Body.Venus),
        mars:    geoLon(window.Astronomy.Body.Mars),
        jupiter: geoLon(window.Astronomy.Body.Jupiter),
        saturn:  geoLon(window.Astronomy.Body.Saturn),
        uranus:  geoLon(window.Astronomy.Body.Uranus),
        neptune: geoLon(window.Astronomy.Body.Neptune),
        pluto:   geoLon(window.Astronomy.Body.Pluto),
        northNode: nodeMeanA,
        southNode: nodeMeanD,
      };

      __EPHEM_CACHE__[cacheKey] = result;
      return result;
    } catch (e) {
      console.warn("[EPHEM] Astronomy Engine failed; falling back.", e);
    }
  }

  // --- last resort fallback ---
  const days = (jdUT - 2451545.0);
  const years = days / 365.2425;

  const result = {
    sun:     norm(270 + days * 0.985647),
    moon:    norm(90  + days * (360 / 27.321661)),
    mercury: norm(60  + days * (360 / 87.969)),
    venus:   norm(180 + days * (360 / 224.701)),
    mars:    norm(23  + years * (360 / 1.88)),
    jupiter: norm(300 + days * (360 / (11.86 * 365.25))),
    saturn:  norm(300 + days * (360 / (29.45 * 365.25))),
    uranus:  norm(36  + years * (360 / 84.01)),
    neptune: norm(348 + years * (360 / 164.8)),
    pluto:   norm(293 + years * (360 / 248.0)),
    northNode: nodeMeanA,
    southNode: nodeMeanD,
  };

  __EPHEM_CACHE__[cacheKey] = result;
  return result;
}

window.getPlanetLongitudes = getPlanetLongitudes;

// ---------------------------------------------------------
// Houses + Angles (single source of truth for wheel + band)
// Uses SWE.houses_ex2 and chooses Asc/MC indices by comparing
// to cusp1 (Asc) and cusp10 (MC). This avoids 90° swaps.
// ---------------------------------------------------------
function getHousesAngles(dateUTC, lat, lon, hsys = "P") {
  if (!window.SWE_READY || !window.SWE) return null;
  if (!(dateUTC instanceof Date) || Number.isNaN(dateUTC.getTime())) return null;

  // default to 0,0 if unknown (still returns a consistent result)
  lat = Number.isFinite(lat) ? lat : 0;
  lon = Number.isFinite(lon) ? lon : 0;

  const norm360 = (deg) => ((deg % 360) + 360) % 360;
  const shortest = (deg) => (((deg + 180) % 360 + 360) % 360) - 180;
  const score = (a, b) => Math.abs(shortest(norm360(a) - norm360(b)));

  // JD(UT) — prefer global helper, else Swiss julday, else JS -> JD
  const jd =
    (typeof window.jdFromDateUTC === "function")
      ? window.jdFromDateUTC(dateUTC)
      : (typeof window.SWE.julday === "function")
        ? window.SWE.julday(
            dateUTC.getUTCFullYear(),
            dateUTC.getUTCMonth() + 1,
            dateUTC.getUTCDate(),
            dateUTC.getUTCHours() + dateUTC.getUTCMinutes() / 60 + dateUTC.getUTCSeconds() / 3600,
            1
          )
        : (dateUTC.getTime() / 86400000) + 2440587.5;

  let out;
  try {
    out = window.SWE.houses_ex2(jd, 0, lat, lon, hsys);
  } catch (e) {
    console.warn("[SWE] houses_ex2 failed", e);
    return null;
  }
  if (!out || !out.ascmc || !out.cusps) return null;

  const ascmc = out.ascmc;
  const cusps = out.cusps;

  const H = String(hsys || "P").toUpperCase();

  // Swiss Ephemeris spec:
  // ascmc[0] = Ascendant, ascmc[1] = MC
  // (keep a swap-guard ONLY for quadrant systems if a wrapper ever flips them)
  let ascIdx = 0;
  let mcIdx  = 1;

  // Only do cusp-based swap detection for quadrant systems where:
  // cusp[1] ≈ Asc and cusp[10] ≈ MC (true for P=Placidus, O=Porphyry).
  if (H !== "W" && cusps && ascmc) {
    const cuspAsc = Number(cusps[1]);
    const cuspMc  = Number(cusps[10]);

    const a0 = Number(ascmc[0]);
    const a1 = Number(ascmc[1]);

    // If ascmc[1] matches cusp1 better than ascmc[0], swap.
    if (Number.isFinite(cuspAsc) && Number.isFinite(a0) && Number.isFinite(a1)) {
      if (score(a1, cuspAsc) < score(a0, cuspAsc)) {
        ascIdx = 1;
        mcIdx  = 0;
      }
    }

    // Optional extra sanity: if MC looks swapped vs cusp10, swap too.
    if (Number.isFinite(cuspMc) && Number.isFinite(a0) && Number.isFinite(a1)) {
      const mcLooksSwapped = score(ascmc[ascIdx], cuspMc) < score(ascmc[mcIdx], cuspMc);
      if (mcLooksSwapped) {
        const tmp = ascIdx; ascIdx = mcIdx; mcIdx = tmp;
      }
    }
  }

  const asc = norm360(ascmc[ascIdx]);
  const mc  = norm360(ascmc[mcIdx]);   // ✅ always the true MC (smooth in Whole Sign too)

  const dsc = norm360(asc + 180);
  const ic  = norm360(mc  + 180);

  return {
    jd,
    hsys: H,
    asc,
    dsc,
    dc: dsc,   // wheel expects `dc`
    mc,
    ic,
    cusps,
    ascmc,
    _ascIdx: ascIdx,
    _mcIdx: mcIdx
  };
}

// publish for both module consumers + legacy globals
window.getHousesAngles = getHousesAngles;
window.AstroEngine = window.AstroEngine || {};
window.AstroEngine.getHousesAngles = getHousesAngles;
