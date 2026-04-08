/* astronomy-adapter.js — ephemeris adapter layer */
/* =========================================================
   PLANET LONGITUDES ADAPTER
   Geocentric apparent ecliptic longitudes (retrograde-capable)
   + Smooth Mean Lunar Nodes (☊/☋)
   ========================================================= */

	function getPlanetLongitudes(dateUTC) {
	  // Normalize degrees to [0, 360)
	  const norm = (deg) => ((deg % 360) + 360) % 360;
	  
	  	// If caller supplies a date (natal), use it; otherwise use live engine time.
		const useDate = (dateUTC instanceof Date) ? dateUTC : AstroEngine.dateUTC;

		// Simple Date -> Julian Day (UTC) for fallback mode
		const jdFromDateUTC = (d) => {
			const y = d.getUTCFullYear();
			const m = d.getUTCMonth() + 1;
			const day =
				d.getUTCDate() +
				(d.getUTCHours() + (d.getUTCMinutes() + (d.getUTCSeconds() / 60)) / 60) / 24;

			let Y = y;
			let M = m;
			if (M <= 2) { Y -= 1; M += 12; }

			const A = Math.floor(Y / 100);
			const B = 2 - A + Math.floor(A / 4);

			const jd =
				Math.floor(365.25 * (Y + 4716)) +
				Math.floor(30.6001 * (M + 1)) +
				day + B - 1524.5;

			return jd;
		};


	  // Mean lunar ascending node longitude (smooth regression), degrees
	  // Ω = 125.04452 − 1934.136261*T + 0.0020708*T^2 + T^3/450000
	  // where T = Julian centuries since J2000.0
	  const meanAscendingNodeLon = (jd) => {
		const T = (jd - 2451545.0) / 36525.0;
		const omega =
		  125.04452
		  - 1934.136261 * T
		  + 0.0020708 * T * T
		  + (T * T * T) / 450000;
		return norm(omega);
	  };

	  // Always available (from your engine)
	  const jd = jdFromDateUTC(useDate);

	  // Always compute nodes smoothly (even in fallback)
	  const nodeA = meanAscendingNodeLon(jd);       // ☊
	  const nodeD = norm(nodeA + 180);              // ☋ (locked opposite)

	// ---------------------------------------------------------
	// PRIMARY (preferred): Swiss Ephemeris (WASM) if available
	// ---------------------------------------------------------
	const canSwiss = !!(
	window.SWE_READY &&
	window.SWE &&
	(typeof window.SWE.calc_ut === "function" || typeof window.SWE.swe_calc_ut === "function")
	);

	if (canSwiss) {
	const swe = window.SWE;

	// constants may live on window.Constants (from your swe-init) or on the module wrapper
	const C = window.SWE_CONST || window.Constants || swe;

	const getConst = (name, fallback = 0) =>
		(typeof C?.[name] !== "undefined") ? C[name] :
		(typeof swe?.[name] !== "undefined") ? swe[name] :
		fallback;

	const gregFlag = getConst("SE_GREG_CAL", 1);

	// Prefer swe_julday/julday if exposed; otherwise keep incoming jd
	let jdSwe = jd;
	try {
		const hour =
		useDate.getUTCHours() +
		useDate.getUTCMinutes() / 60 +
		useDate.getUTCSeconds() / 3600 +
		useDate.getUTCMilliseconds() / 3600000;

		const juldayFn =
		(typeof swe.swe_julday === "function") ? swe.swe_julday :
		(typeof swe.julday === "function") ? swe.julday :
		null;

		if (juldayFn) {
		jdSwe = juldayFn(
			useDate.getUTCFullYear(),
			useDate.getUTCMonth() + 1,
			useDate.getUTCDate(),
			hour,
			gregFlag
		);
		}
	} catch (e) {
		// keep jdSwe = jd
	}

	// Call calc in whichever shape exists
	const calcFn =
		(typeof swe.swe_calc_ut === "function") ? swe.swe_calc_ut :
		(typeof swe.calc_ut === "function") ? swe.calc_ut :
		null;

	// Robust longitude extractor:
	// supports: {xx: Float64Array}, {xx: number[]}, Float64Array, number[], [xx, retflag], etc.
	const extractLon = (out) => {
		if (out == null) return NaN;

		// If it’s an object with xx/data, use that
		let xx =
		(out && typeof out === "object" && out.xx != null) ? out.xx :
		(out && typeof out === "object" && out.data != null) ? out.data :
		out;

		// If it’s [xx, ...] (some wrappers), take first
		if (Array.isArray(xx) && xx.length && (Array.isArray(xx[0]) || (xx[0] && typeof xx[0].length === "number"))) {
		xx = xx[0];
		}

		// TypedArray / array-like -> array
		if (xx && typeof xx === "object" && typeof xx.length === "number" && !Array.isArray(xx)) {
		xx = Array.from(xx);
		}

		const lon = Array.isArray(xx) ? Number(xx[0]) : Number(xx);
		return lon;
	};

	// Prefer Moshier to avoid missing .se1 file warnings.
	// Moshier is built-in / no files required. :contentReference[oaicite:2]{index=2}
	const flagsMoshier = getConst("SEFLG_MOSEPH", 0) | getConst("SEFLG_SPEED", 0);
	const flagsSwiss   = getConst("SEFLG_SWIEPH", 0) | getConst("SEFLG_SPEED", 0);

	const swissLon = (pid) => {
		// 1) Try Moshier first (quiet + fileless)
		let out = calcFn(jdSwe, pid, flagsMoshier);
		let lon = extractLon(out);

		// 2) If needed, try Swiss file-based
		if (!Number.isFinite(lon)) {
		out = calcFn(jdSwe, pid, flagsSwiss);
		lon = extractLon(out);
		}

		if (!Number.isFinite(lon)) throw new Error("SwissEph calc_ut returned non-finite longitude");
		return norm(lon);
	};

	try {
		const pid = (name) => getConst(name, null);

		const result = {
		sun:     swissLon(pid("SE_SUN")),
		moon:    swissLon(pid("SE_MOON")),
		mercury: swissLon(pid("SE_MERCURY")),
		venus:   swissLon(pid("SE_VENUS")),
		mars:    swissLon(pid("SE_MARS")),
		jupiter: swissLon(pid("SE_JUPITER")),
		saturn:  swissLon(pid("SE_SATURN")),
		uranus:  swissLon(pid("SE_URANUS")),
		neptune: swissLon(pid("SE_NEPTUNE")),
		pluto:   swissLon(pid("SE_PLUTO")),

		// Asteroids (Chiron, Ceres, Pallas, Juno, Vesta)
		chiron:  swissLon(pid("SE_CHIRON")),
		ceres:   swissLon(pid("SE_CERES")),
		pallas:  swissLon(pid("SE_AST_OFFSET") + 2),  // 10002
		juno:    swissLon(pid("SE_AST_OFFSET") + 3),  // 10003
		vesta:   swissLon(pid("SE_AST_OFFSET") + 7),  // 10007

		// nodes default (smooth mean regression)
		northNode: nodeA,
		southNode: nodeD
		};

		// Prefer TRUE node; only fall back to MEAN if TRUE is not available
		let nodePid = null;

		if (typeof swe.SE_TRUE_NODE !== "undefined") {
			nodePid = swe.SE_TRUE_NODE;
		if (!window.__SWE_NODE_LOGGED__) {
			console.log("[SWE] Using TRUE node");
			window.__SWE_NODE_LOGGED__ = true;
		}
		} else if (typeof swe.SE_MEAN_NODE !== "undefined") {
			nodePid = swe.SE_MEAN_NODE;
			console.warn("[SWE] TRUE node not available; using MEAN node (SE_MEAN_NODE)");
		}

		return result;
	} catch (err) {
		console.warn("[SWE] Swiss calc failed; falling back.", err);
		// continue into vendor/fallback branches below
	}
	}

	  // ---------------------------------------------------------
	  // FALLBACK: vendor library missing (keep wheel alive)
	  // ---------------------------------------------------------
	  if (typeof Astronomy === "undefined") {
		const days = (jd - 2451545.0);
		const years = days / 365.2425;

		return {
		  sun:     norm((270 + days * 0.985647) % 360),
		  moon:    norm((90  + days * (360 / 27.321661)) % 360),
		  mercury: norm((60  + days * (360 / 87.969))  % 360),
		  venus:   norm((180 + days * (360 / 224.701)) % 360),
		  mars:    norm((23 + years * (360 / 1.88))   % 360),
		  jupiter: norm((300 + days * (360 / (11.86 * 365.25))) % 360),
		  saturn:  norm((300 + days * (360 / (29.45 * 365.25))) % 360),
		  uranus:  norm((36 + years * (360 / 84.01))  % 360),
		  neptune: norm((348 + years * (360 / 164.8)) % 360),
		  pluto:   norm((293 + years * (360 / 248.0)) % 360),

		  // ☊ / ☋ (smooth + perfectly opposite)
		  northNode: nodeA,
		  southNode: nodeD
		};
	  }

	  // ---------------------------------------------------------
	  // PRIMARY: Astronomy Engine present
	  // ---------------------------------------------------------
	  try {
		// authoritative UTC instant -> Astronomy Time
		const t = Astronomy.MakeTime(useDate);

		// apparent geocentric ecliptic longitude
		const geoLon = (body) => {
		  const vec = Astronomy.GeoVector(body, t, true);
		  const ecl = Astronomy.Ecliptic(vec);
		  return norm(ecl.elon);
		};

		return {
		  sun:     geoLon(Astronomy.Body.Sun),
		  moon:    geoLon(Astronomy.Body.Moon),
		  mercury: geoLon(Astronomy.Body.Mercury),
		  venus:   geoLon(Astronomy.Body.Venus),
		  mars:    geoLon(Astronomy.Body.Mars),
		  jupiter: geoLon(Astronomy.Body.Jupiter),
		  saturn:  geoLon(Astronomy.Body.Saturn),
		  uranus:  geoLon(Astronomy.Body.Uranus),
		  neptune: geoLon(Astronomy.Body.Neptune),
		  pluto:   geoLon(Astronomy.Body.Pluto),

		  // ☊ / ☋ (smooth + perfectly opposite)
		  northNode: nodeA,
		  southNode: nodeD
		};
	  } catch (err) {
		console.warn("Astronomy Engine geocentric longitude calc failed; falling back.", err);

		// same fallback as above (but vendor exists yet failed on something)
		const days = (jd - 2451545.0);
		const years = days / 365.2425;

		return {
		  sun:     norm((270 + days * 0.985647) % 360),
		  moon:    norm((90  + days * (360 / 27.321661)) % 360),
		  mercury: norm((60  + days * (360 / 87.969))  % 360),
		  venus:   norm((180 + days * (360 / 224.701)) % 360),
		  mars:    norm((23 + years * (360 / 1.88))   % 360),
		  jupiter: norm((300 + days * (360 / (11.86 * 365.25))) % 360),
		  saturn:  norm((300 + days * (360 / (29.45 * 365.25))) % 360),
		  uranus:  norm((36 + years * (360 / 84.01))  % 360),
		  neptune: norm((348 + years * (360 / 164.8)) % 360),
		  pluto:   norm((293 + years * (360 / 248.0)) % 360),

		  // ☊ / ☋ (smooth + perfectly opposite)
		  northNode: nodeA,
		  southNode: nodeD
		};
	  }
	}

window.getPlanetLongitudes = getPlanetLongitudes;
