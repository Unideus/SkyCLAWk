	/* screw-renderer.js — builds the timeline SVG screw */
	const PLANTING_ROW_COLORS = {
		prophet: "rgb(255, 65, 54)",
		nomad: "rgb(0, 116, 217)",
		hero: "rgb(255, 220, 0)",
		artist: "rgb(46, 204, 64)"
	};

	/* =========================================================
		   SECTION 09 — BUILD THE SCREW (STATIC GEOMETRY)
		   ---------------------------------------------------------
		   Constructs ALL immutable timeline geometry.
		   Must be re-runnable and side-effect free.
		   ========================================================= */

	function buildScrew() {
			
			const svg = document.getElementById("screwSVG");
			if (svg) svg.style.pointerEvents = "auto";


			// SVG layer order is defined in index.html.
			// Do not re-append groups here (it can break nesting + z-order).
			
			// -----------------------------------------------------
			// 09.0.1 — EVENT SHIELD (screen-anchored, protects astro area)
			// -----------------------------------------------------
			if (svg && !document.getElementById("eventShieldPath")) {
				const shield = document.createElementNS("http://www.w3.org/2000/svg", "path");
				shield.setAttribute("id", "eventShieldPath");
				
				// Default should NOT tint. JS will sync exact background fill every frame.
				shield.setAttribute("fill", "transparent");
				shield.setAttribute("opacity", "1");
				shield.setAttribute("pointer-events", "none");

				// Put it LAST in the root so it sits above labels
				svg.appendChild(shield);
			}


			// -----------------------------------------------------
			// 09.1 — RESET ALL GEOMETRIC PLANES
			// -----------------------------------------------------

			bands.innerHTML =
			diags.innerHTML =
			ticks.innerHTML =
			grid.innerHTML =
			bottomYears.innerHTML = "";
		
		// Bottom year labels (conjunction-locked majors)
		if (bottomYears) bottomYears.innerHTML = "";
		if (typeof conjIndexToScrewX === "function" && Array.isArray(CONJUNCTION_YEARS) && CONJUNCTION_YEARS.length) {
			for (let i = 0; i < CONJUNCTION_YEARS.length; i++) {
				const x = conjIndexToScrewX(i);
				if (x < MINX || x > MAXX) continue;

			const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
			label.setAttribute("x", x);
			label.setAttribute("y", CANON.TIMELINE_Y + 27);   // a touch lower for the bigger font
			label.setAttribute("text-anchor", "middle");

			// bigger + bolder
			label.setAttribute("font-size", "13");
			label.setAttribute("font-weight", "700");

			// keep letters white
			label.setAttribute("fill", "#fff");
			label.setAttribute("opacity", "0.95");

			// dark outline for readability
			label.setAttribute("paint-order", "stroke");
			label.setAttribute("stroke", "rgba(0,0,0,0.85)");
			label.setAttribute("stroke-width", "2");
			label.setAttribute("stroke-linejoin", "round");

			// elemental glow (slot-aligned; master-first)
			const glow = (() => {
			  const year = (Array.isArray(CONJUNCTION_YEARS) ? CONJUNCTION_YEARS[i] : null);
			  if (!Number.isFinite(year)) return null;

			  // master lookup by year (if present)
			  let rawSign = "";
			  let masterElement = "";

			  if (typeof CONJUNCTION_DATA !== "undefined" && Array.isArray(CONJUNCTION_DATA) && CONJUNCTION_DATA.length) {
				for (let k = 0; k < CONJUNCTION_DATA.length; k++) {
				  const d = CONJUNCTION_DATA[k];
				  if (!d || !d.t) continue;
				  const y = new Date(d.t).getUTCFullYear();
				  if (y === year) {
					rawSign = (d.sign || "");
					masterElement = String(d.element || "").toLowerCase();
					break;
				  }
				}
			  }

			  // fallback to slot lattice sign (index-aligned)
			  if (!rawSign && typeof CONJUNCTION_LATTICE !== "undefined" && Array.isArray(CONJUNCTION_LATTICE) && CONJUNCTION_LATTICE[i]) {
				rawSign = (CONJUNCTION_LATTICE[i].sign || "");
			  }

			  const raw = String(rawSign).trim().toLowerCase();

			  const map = {
				ari: "aries", aries: "aries",
				tau: "taurus", taurus: "taurus",
				gem: "gemini", gemini: "gemini",
				can: "cancer", cancer: "cancer",
				leo: "leo",
				vir: "virgo", virgo: "virgo",
				lib: "libra", libra: "libra",
				sco: "scorpio", scorpio: "scorpio",
				sag: "sagittarius", sagi: "sagittarius", sagittarius: "sagittarius",
				cap: "capricorn", capricorn: "capricorn",
				aqu: "aquarius", aqua: "aquarius", aquarius: "aquarius",
				pis: "pisces", pisc: "pisces", pisces: "pisces"
			  };

			  const signKey = map[raw] || raw;

			  // Prefer master element if present; else derive from signKey
			  const element = masterElement
				? masterElement
				: ((typeof ELEMENT_SIGNS !== "undefined") ? (ELEMENT_SIGNS[signKey] || "") : "");

			  const rgb =
				(ELEMENTAL && ELEMENTAL.COLORS && element && ELEMENTAL.COLORS[element])
				  ? ELEMENTAL.COLORS[element]
				  : null;

			  return rgb ? `rgb(${rgb})` : null;
			})();


			if (glow) {
			  label.style.filter = `drop-shadow(0 0 4px ${glow}) drop-shadow(0 0 10px ${glow})`;
			}

			label.textContent = String(CONJUNCTION_YEARS[i]);
			bottomYears.appendChild(label);

			}
		}

		renderPlantingMonthTicks();
		
				// -----------------------------------------------------
				// 09.1.1 — ERA MARKERS (BOTTOM DROPS)
				// -----------------------------------------------------
				function yearFromISODate(iso) {
					const d = new Date(iso + "T00:00:00Z");
					if (isNaN(d.getTime())) return null;

					// If your canonical converter exists, use it.
					if (typeof dateUTCToContinuousYear === "function") {
						return dateUTCToContinuousYear(d);
					}

					// Fallback: year + day-of-year fraction (good enough for labels)
					const y = d.getUTCFullYear();
					const start = Date.UTC(y, 0, 1);
					const end = Date.UTC(y + 1, 0, 1);
					return y + ((d.getTime() - start) / ((end - start) || 1));
				}

function buildEraMarkers() {
  const list = (typeof window !== "undefined" && Array.isArray(window.ERA_MARKERS))
    ? window.ERA_MARKERS
    : null;

  if (!list || !bottomYears) return;

  const axisY = CANON.TIMELINE_Y;

  // Pick knob-set by category (with fallback to ERA_STYLE)
  function getStyleForMarker(e) {
    const fallback = (typeof window !== "undefined" && window.ERA_STYLE) ? window.ERA_STYLE : {};
    const cat = String(e?.category || "").toLowerCase();

    if (cat === "war") {
      return (typeof window !== "undefined" && window.ERA_STYLE_WAR) ? window.ERA_STYLE_WAR : fallback;
    }
    if (cat === "event") {
      return (typeof window !== "undefined" && window.ERA_STYLE_EVENT) ? window.ERA_STYLE_EVENT : fallback;
    }
    // default = era
    return (typeof window !== "undefined" && window.ERA_STYLE_ERA) ? window.ERA_STYLE_ERA : fallback;
  }

  function yearFromISODate(iso) {
    if (!iso) return null;
    const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
    if (isNaN(d.getTime())) return null;

    if (typeof dateUTCToContinuousYear === "function") {
      return dateUTCToContinuousYear(d);
    }

    const y = d.getUTCFullYear();
    const start = Date.UTC(y, 0, 1);
    const end = Date.UTC(y + 1, 0, 1);
    return y + ((d.getTime() - start) / ((end - start) || 1));
  }

  function fmtYearRange(e) {
    const tb = (e && e.display && typeof e.display.textBelow === "string")
      ? e.display.textBelow.trim()
      : "";
    if (tb) return tb;

    const y1 = yearFromISODate(e.start);
    const y2 = yearFromISODate(e.end);

    const a = Number.isFinite(y1) ? String(Math.floor(y1)) : "";
    const b = Number.isFinite(y2) ? String(Math.floor(y2)) : "";

    if (a && b && a !== b) return `${a}–${b}`;
    if (a && b && a === b) return a;
    if (a && !b) return `${a}–`;
    return "";
  }
  
    function ensureDefs() {
    const svg = bottomYears.ownerSVGElement || bottomYears;
    if (!svg) return null;
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    return defs;
  }


  // Separate staggering for each category so they don't fight
// AUTO-LANES: track occupied x-ranges per lane, per category
const laneState = {
  era:   { lanes: [] },   // each lane is an array of {x0,x1}
  war:   { lanes: [] },
  event: { lanes: [] }
};

function overlaps(a0, a1, b0, b1) {
  return !(a1 <= b0 || a0 >= b1);
}

function chooseAutoLane(kindState, x0, x1, maxLanes) {
  // Try existing lanes first
  for (let li = 0; li < kindState.lanes.length; li++) {
    const occ = kindState.lanes[li];
    let ok = true;
    for (let j = 0; j < occ.length; j++) {
      if (overlaps(x0, x1, occ[j].x0, occ[j].x1)) {
        ok = false;
        break;
      }
    }
    if (ok) return li;
  }

  // Need a new lane?
  if (kindState.lanes.length < maxLanes) {
    kindState.lanes.push([]);
    return kindState.lanes.length - 1;
  }

  // If maxed out, just use last lane (best-effort)
  return Math.max(0, maxLanes - 1);
}

function reserveInLane(kindState, laneIndex, x0, x1) {
  if (!kindState.lanes[laneIndex]) kindState.lanes[laneIndex] = [];
  kindState.lanes[laneIndex].push({ x0, x1 });
}


  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e) continue;

    const y1 = yearFromISODate(e.start);
    const y2 = yearFromISODate(e.end);
    if (!Number.isFinite(y1) && !Number.isFinite(y2)) continue;

    const catRaw = String(e.category || "").toLowerCase();
    const kind = (catRaw === "war") ? "war" : (catRaw === "event") ? "event" : "era";
    const isWar = (kind === "war");

	// ANCHOR RULE (with per-label override)
	const anchorMode = e?.display?.anchor;

	const anchorYear =
	  (anchorMode === "start" && Number.isFinite(y1)) ? y1 :
	  (anchorMode === "end" && Number.isFinite(y2)) ? y2 :
	  (isWar && Number.isFinite(y1)) ? y1 :
	  ((Number.isFinite(y1) && Number.isFinite(y2)) ? ((y1 + y2) / 2) :
	   (Number.isFinite(y1) ? y1 : y2));


    const x = SCREW_EPOCH_X + (anchorYear - 2020) * PX_PER_YEAR;

    if (x < MINX || x > MAXX) continue;


    const style = getStyleForMarker(e);

    // ---- knobs (per kind) ----
    const dropPx   = Number(style.dropPx ?? 60);
    const textGap  = Number(style.textGapPx ?? 12);
    const dotR     = Number(style.dotR ?? 2.8);
    const lineW    = Number(style.lineW ?? 0.8);
    const fontSize = Number(style.fontSize ?? 12);
    const opacity  = Number(style.opacity ?? 0.85);

    const lanes     = Number(style.lanes ?? 3);
    const laneGapPx = Number(style.laneGapPx ?? 14);
    const minGapPx  = Number(style.minGapPx ?? 110);

    const nearAxisPx   = Number(style.nearAxisPx ?? 26);
    const dateFontSize = Number(style.dateFontSize ?? Math.max(9, fontSize - 3));
    const dateDy       = Number(style.dateDy ?? 12);

    // IMPORTANT: baseY is ALWAYS “pixels below the axis”
    // If baseY is not provided, we fall back to nearAxisPx
    const baseY = axisY + Number(style.baseY ?? nearAxisPx);

    // Wars: drop line endpoint is still axisY + dropPx
    const warLineY2 = axisY + dropPx;

    // Wars: text position uses baseY (same mental model as eras/events)
    // If you don't set WAR.baseY, it falls back to old behavior (dropPx + textGap)
    const warTextYBase = axisY + Number(style.baseY ?? (dropPx + textGap));

    // ---- staggering per kind ----
	const dr = fmtYearRange(e);

	// AUTO width estimate:
	// - we can’t measure exact SVG text width until it exists
	// - so we approximate width using character count (works well enough),
	//   plus a padding knob
	const padPx = Number(style.padPx ?? 10);
	const maxAutoLanes = Number(style.maxAutoLanes ?? Math.max(1, lanes));

	const mainText = String(e.label || "");
	const subText  = dr ? String(dr) : "";

	// Approximate width (conservative so auto-lanes actually kick in)
	// - charPx scales with fontSize unless you override it
	// - minLabelW ensures short labels still reserve real space
	const approxCharPx = Number(style.charPx ?? Math.max(7, fontSize * 0.62));
	const minLabelW = Number(style.minLabelW ?? 140);

	const wRaw = Math.max(mainText.length, subText.length) * approxCharPx + (padPx * 2);
	const w = Math.max(minLabelW, wRaw);

	const x0 = x - (w / 2);
	const x1 = x + (w / 2);

	// Choose lane based on real occupied ranges
	const kindState = laneState[kind] || laneState.era;
	const laneIndex = chooseAutoLane(kindState, x0, x1, maxAutoLanes);
	reserveInLane(kindState, laneIndex, x0, x1);

	// Lane spacing must account for 2-line labels (main + date)
	// Otherwise the date line overlaps the next lane.
	const hasDateLine = !!dr;

	// Rough vertical footprint (px):
	// - main line ~ fontSize
	// - date line ~ dateFontSize
	// - separation between lines = dateDy
	// - add a little safety padding
	const neededPitch =
	  hasDateLine
		? (fontSize + dateDy + dateFontSize + 4)
		: (fontSize + 4);

	// Use whichever is larger: your knob laneGapPx, or what’s actually needed.
	const lanePitch = Math.max(laneGapPx, neededPitch);

	const yLaneOffset = laneIndex * lanePitch;


    // -------- WAR: dot + drop line + label (+ date under) --------
    if (isWar) {
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", axisY);
      dot.setAttribute("r", dotR);
      dot.setAttribute("fill", "white");
      dot.setAttribute("opacity", String(opacity));
      bottomYears.appendChild(dot);

      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", x);
      ln.setAttribute("x2", x);
      ln.setAttribute("y1", axisY);
      ln.setAttribute("y2", warLineY2);
      ln.setAttribute("stroke", "white");
      ln.setAttribute("stroke-width", String(lineW));
      ln.setAttribute("opacity", String(opacity));
      bottomYears.appendChild(ln);

      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", x);
      const yOffset = Number(e?.display?.yOffset ?? 0);
	  t.setAttribute("y", warTextYBase + yLaneOffset + yOffset);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", String(fontSize));
      t.setAttribute("fill", "#ff3b3b");
      t.setAttribute("opacity", String(opacity));

      const main = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      main.textContent = e.label || "";
      t.appendChild(main);

      if (dr) {
        const sub = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        sub.setAttribute("x", x);
        sub.setAttribute("dy", String(dateDy));
        sub.setAttribute("font-size", String(dateFontSize));
        sub.setAttribute("opacity", String(Math.min(1, opacity * 0.85)));
        sub.textContent = dr;
        t.appendChild(sub);
      }

      bottomYears.appendChild(t);
      continue;
    }

    // AGE BAND: straight line from start->end with faded ends
    if (e?.display?.band) {
      const defs = ensureDefs();

      // start and end x positions
      const xStart = (Number.isFinite(y1))
        ? (SCREW_EPOCH_X + (y1 - 2020) * PX_PER_YEAR)
        : x;

      // if end is null/open-ended, cap it to "now" (or a chosen year), otherwise MAXX
      const bandEndYear =
        Number.isFinite(y2) ? y2 :
        (e?.display?.bandToNow ? (new Date().getUTCFullYear()) :
         (Number.isFinite(e?.display?.bandEndYear) ? Number(e.display.bandEndYear) : null));

      const xEnd = Number.isFinite(bandEndYear)
        ? (SCREW_EPOCH_X + (bandEndYear - 2020) * PX_PER_YEAR)
        : MAXX;


      const xA = Math.min(xStart, xEnd);
      const xB = Math.max(xStart, xEnd);

      // band sits a bit ABOVE the text baseline (tweak per marker with bandYOffset)
      const bandYOffset = Number(e?.display?.bandYOffset ?? -18);
      const bandY = (axisY + Number(style.baseY ?? nearAxisPx)) + bandYOffset;

      // gradient id unique per marker
      const gid = `ageBand_${String(e.id || i).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

      if (defs && !defs.querySelector(`#${gid}`)) {
        const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        grad.setAttribute("id", gid);
        grad.setAttribute("gradientUnits", "userSpaceOnUse");
        grad.setAttribute("x1", String(xA));
        grad.setAttribute("y1", String(bandY));
        grad.setAttribute("x2", String(xB));
        grad.setAttribute("y2", String(bandY));

        // Pixel-based fade so long "open-ended" bands don't get a huge fade zone
        const bandOpacity = Math.min(1, Number(style.bandOpacity ?? 0.55));

        // How many pixels the fade should take on EACH end
        const fadePx = Number(e?.display?.bandFadePx ?? style.bandFadePx ?? 60);

        const len = Math.max(1, (xB - xA));
        // Convert px fade distance into 0..1 offsets
        const p = Math.max(0.001, Math.min(0.45, fadePx / len));

        const stops = [
          { o: "0",           a: "0" },
          { o: String(p),     a: String(bandOpacity) },
          { o: String(1 - p), a: String(bandOpacity) },
          { o: "1",           a: "0" }
        ];


        for (const s of stops) {
          const st = document.createElementNS("http://www.w3.org/2000/svg", "stop");
          st.setAttribute("offset", s.o);
          st.setAttribute("stop-color", "white");
          st.setAttribute("stop-opacity", s.a);
          grad.appendChild(st);
        }

        defs.appendChild(grad);
      }

      const band = document.createElementNS("http://www.w3.org/2000/svg", "line");
      band.setAttribute("x1", String(xA));
      band.setAttribute("x2", String(xB));
      band.setAttribute("y1", String(bandY));
      band.setAttribute("y2", String(bandY));
      band.setAttribute("stroke", `url(#${gid})`);
      band.setAttribute("stroke-width", String(Number(style.bandW ?? 2)));
      band.setAttribute("stroke-linecap", "round");
      bottomYears.appendChild(band);
    }

    // -------- ERA / EVENT: NO dot, NO drop line — label (+ date under) --------
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x);
    const yOffset = Number(e?.display?.yOffset ?? 0);
	t.setAttribute("y", baseY + yLaneOffset + yOffset);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", String(fontSize));
    t.setAttribute("fill", "white");

    const fade = !!(e.display && e.display.fade);
    t.setAttribute("opacity", String(fade ? Math.min(1, opacity * 0.72) : opacity));

    const main = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    main.textContent = e.label || "";
    t.appendChild(main);

    if (dr) {
      const sub = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      sub.setAttribute("x", x);
      sub.setAttribute("dy", String(dateDy));
      sub.setAttribute("font-size", String(dateFontSize));
      sub.setAttribute("opacity", String(Math.min(1, (fade ? opacity * 0.72 : opacity) * 0.85)));
      sub.textContent = dr;
      t.appendChild(sub);
    }

    bottomYears.appendChild(t);
  }
}


				buildEraMarkers();


			// -----------------------------------------------------
			// 09.2 / 09.3 — PLANTING SCREW BODY
			// -----------------------------------------------------
			renderPlantingSeasonalScrewBody();

		// -----------------------------------------------------
			// 09.4 — AUTHORITATIVE TIME AXIS + CROSS TICKS
			// -----------------------------------------------------

			// Ensure only ONE axis line exists (prevents syncRiverClip grabbing an old one)
			const oldAxis = document.getElementById("timelineAxisLine");
			if (oldAxis) oldAxis.remove();

			// Draw main timeline axis — structural baseline
			const axis = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"line"
			);

			axis.setAttribute("id", "timelineAxisLine");

			// CANON.TIMELINE_Y already includes SCREW_TOP_PAD, and scrollGroup is translated by SCREW_TOP_PAD.
			// So inside scrollGroup space, the true axis is TIMELINE_Y - SCREW_TOP_PAD.
			axis.setAttribute("x1", MINX);
			axis.setAttribute("x2", MAXX);
			axis.setAttribute("y1", CANON.TIMELINE_Y);
			axis.setAttribute("y2", CANON.TIMELINE_Y);


			axis.setAttribute("stroke", "#ffffff");
			axis.setAttribute("stroke-width", "3");

			grid.appendChild(axis);

			// Tick marks — symmetric about the axis (visual only)
			// Minor = every 5 years
			// Major = every 10 years
			for (let x = MINX; x <= MAXX; x += PX_PER_YEAR) {
				const yr = Math.round(x / PX_PER_YEAR);
				const is20 = (yr % 20 === 0);
				const is10 = (yr % 10 === 0) && !is20;

				const tick = document.createElementNS(
					"http://www.w3.org/2000/svg",
					"line"
				);

			let half;
			let weight;
			let opacity;

			if (is20) {
				half = 10;      // major — every 20 years
				weight = 1.6;
				opacity = 0.9;
			} else if (is10) {
				half = 8;       // medium — every 10 years
				weight = 1.0;
				opacity = 0.75;
			} else {
				half = 5;       // every 1 year
				weight = 0.6;
				opacity = 0.55;
			}

			tick.setAttribute("x1", x);
			tick.setAttribute("x2", x);
			tick.setAttribute("y1", CANON.TIMELINE_Y);
			tick.setAttribute("y2", CANON.TIMELINE_Y + half);


			tick.setAttribute("stroke", "white");
			tick.setAttribute("stroke-width", weight);
			tick.setAttribute("opacity", opacity);

			ticks.appendChild(tick);


			}
		}

	/* =========================================================
		   SECTION 09.5 — SAECULUM WAVE (STRUCTURAL TIME PHASE)
		   ---------------------------------------------------------
		   • 80 years = 1 full cycle
		   • Trough at 2020 exactly
		   • Peaks at 1980 / 1900 / …
		   • Lives in screw space
		   • Color encodes archetype phase
		   ========================================================= */

		let saeculumGlowNode = null;   // retained for compatibility (unused now)

		/* ---------------------------------------------------------
		   09.5.1 — PHASE COLOR MAP (AUTHORITATIVE)
		   --------------------------------------------------------- */
		const SAECULUM_PHASE_COLORS = {
			prophet: "#ff3c3c",   // 🔴 Red — Crisis
			nomad:   "#00c800",   // 🟢 Green — High
			hero:    "#ffd700",   // 🟡 Yellow — Awakening
			artist:  "#3c82ff"    // 🔵 Blue — Unraveling
		};

		const PLANTING_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const PLANTING_SEASONS = [
			{ key: "spring", label: "Spring / Emergence", month: 2, day: 20, color: "#ef4444" },
			{ key: "summer", label: "Summer / Growth", month: 5, day: 21, color: "#3b82f6" },
			{ key: "fall", label: "Fall / Harvest", month: 8, day: 22, color: "#facc15" },
			{ key: "winter", label: "Winter / Dormancy", month: 11, day: 21, color: "#22c55e" }
		];

		function getSeasonalAnchorDates(year) {
			return PLANTING_SEASONS.map(season => ({
				...season,
				date: new Date(Date.UTC(year, season.month, season.day, 12, 0, 0))
			}));
		}

		function getVisibleYearsForPlantingScale() {
			const centerDate = (window.timeState && window.timeState.dateUTC instanceof Date)
				? window.timeState.dateUTC
				: new Date();
			const centerYear = centerDate.getUTCFullYear();
			return { start: centerYear - 100, end: centerYear + 100, center: centerYear };
		}

		function dateToPlantingYear(date) {
			const year = date.getUTCFullYear();
			const start = Date.UTC(year, 0, 1, 0, 0, 0);
			const next = Date.UTC(year + 1, 0, 1, 0, 0, 0);
			return year + ((date.getTime() - start) / (next - start));
		}

		function plantingYearToX(yearValue) {
			return SCREW_EPOCH_X + (yearValue - 2020) * PX_PER_YEAR;
		}

		function dateToPlantingX(date) {
			return plantingYearToX(dateToPlantingYear(date));
		}

		function createSvgEl(tag, attrs = {}) {
			const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
			Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
			return el;
		}

		function getPlantingImplementationRows() {
			return [
				{ key: "prophet", label: "\u2648\uFE0E Aries / Spring", color: PLANTING_ROW_COLORS.prophet },
				{ key: "nomad", label: "\u264B\uFE0E Cancer / Summer", color: PLANTING_ROW_COLORS.nomad },
				{ key: "hero", label: "\u264E\uFE0E Libra / Fall", color: PLANTING_ROW_COLORS.hero },
				{ key: "artist", label: "\u2651\uFE0E Capricorn / Winter", color: PLANTING_ROW_COLORS.artist }
			];
		}

		function plantingWindowToX(year, monthStart, dayStart, monthEnd, dayEnd) {
			const start = new Date(Date.UTC(year, monthStart - 1, dayStart, 12, 0, 0));
			const end = new Date(Date.UTC(year, monthEnd - 1, dayEnd, 12, 0, 0));
			return {
				x0: dateToPlantingX(start),
				x1: dateToPlantingX(end)
			};
		}

		function getPlantingActionMarkers(year) {
			return [
				{ season: "winter", label: "Plan", month: 1, day: 10, color: PLANTING_ROW_COLORS.artist, priority: 1 },
				{ season: "winter", label: "Prune", month: 1, day: 25, color: PLANTING_ROW_COLORS.artist, priority: 2 },
				{ season: "winter", label: "Compost", month: 2, day: 10, color: PLANTING_ROW_COLORS.artist, priority: 1 },
				{ season: "winter", label: "Map water", month: 2, day: 25, color: PLANTING_ROW_COLORS.artist, priority: 3 },

				{ season: "spring", label: "Sow", month: 3, day: 25, color: PLANTING_ROW_COLORS.prophet, priority: 1 },
				{ season: "spring", label: "Transplant", month: 4, day: 15, color: PLANTING_ROW_COLORS.prophet, priority: 1 },
				{ season: "spring", label: "Establish", month: 5, day: 5, color: PLANTING_ROW_COLORS.prophet, priority: 2 },
				{ season: "spring", label: "Mulch", month: 5, day: 20, color: PLANTING_ROW_COLORS.prophet, priority: 1 },

				{ season: "summer", label: "Water", month: 6, day: 25, color: PLANTING_ROW_COLORS.nomad, priority: 1 },
				{ season: "summer", label: "Tend", month: 7, day: 15, color: PLANTING_ROW_COLORS.nomad, priority: 2 },
				{ season: "summer", label: "Pollinators", month: 8, day: 1, color: PLANTING_ROW_COLORS.nomad, priority: 3 },
				{ season: "summer", label: "Chop/drop", month: 8, day: 20, color: PLANTING_ROW_COLORS.nomad, priority: 2 },

				{ season: "fall", label: "Harvest", month: 9, day: 25, color: PLANTING_ROW_COLORS.hero, priority: 1 },
				{ season: "fall", label: "Save seed", month: 10, day: 10, color: PLANTING_ROW_COLORS.hero, priority: 2 },
				{ season: "fall", label: "Cover crop", month: 10, day: 25, color: PLANTING_ROW_COLORS.hero, priority: 1 },
				{ season: "fall", label: "Protect", month: 11, day: 15, color: PLANTING_ROW_COLORS.hero, priority: 1 }
			].map((marker, index) => ({
				...marker,
				index,
				date: new Date(Date.UTC(year, marker.month - 1, marker.day, 12, 0, 0))
			}));
		}

		function getPlantingSeasonStartDate(seasonKey, year) {
			const starts = {
				winter: [year - 1, 12, 21],
				spring: [year, 3, 20],
				summer: [year, 6, 21],
				fall: [year, 9, 22]
			};
			const start = starts[seasonKey] || starts.spring;
			return new Date(Date.UTC(start[0], start[1] - 1, start[2], 12, 0, 0));
		}

		function getPlantingScrewBandGeometry(seasonKey, year) {
			const seasonIndexByKey = {
				spring: 0,
				summer: 1,
				fall: 2,
				winter: 3
			};
			const seasonIndex = seasonIndexByKey[seasonKey];
			if (!Number.isFinite(seasonIndex)) return null;

			const bandYear = seasonKey === "winter" ? year - 1 : year;
			const anchors = getSeasonalAnchorDates(bandYear);
			const nextSpring = getSeasonalAnchorDates(bandYear + 1)[0].date;
			const lowerLeftX = dateToPlantingX(anchors[seasonIndex].date);
			const lowerRightX = dateToPlantingX(seasonIndex < 3 ? anchors[seasonIndex + 1].date : nextSpring);
			const topShiftX = PX_PER_YEAR;

			return {
				lowerLeft: { x: lowerLeftX, y: SCREW_HEIGHT },
				lowerRight: { x: lowerRightX, y: SCREW_HEIGHT },
				upperRight: { x: lowerRightX + topShiftX, y: 0 },
				upperLeft: { x: lowerLeftX + topShiftX, y: 0 }
			};
		}

		function getYOnSegmentAtX(a, b, x) {
			const minX = Math.min(a.x, b.x);
			const maxX = Math.max(a.x, b.x);
			if (x < minX || x > maxX) return null;
			if (a.x === b.x) return null;
			const t = (x - a.x) / (b.x - a.x);
			return a.y + ((b.y - a.y) * t);
		}

		function getPlantingScrewBandCenterAtX(geometry, x) {
			if (!geometry) return null;
			const points = [
				geometry.lowerLeft,
				geometry.lowerRight,
				geometry.upperRight,
				geometry.upperLeft
			];
			const intersections = [];

			for (let i = 0; i < points.length; i++) {
				const y = getYOnSegmentAtX(points[i], points[(i + 1) % points.length], x);
				if (y === null) continue;
				if (!intersections.some(existingY => Math.abs(existingY - y) < 0.001)) {
					intersections.push(y);
				}
			}

			if (intersections.length < 2) return null;
			intersections.sort((a, b) => a - b);
			return (intersections[0] + intersections[intersections.length - 1]) / 2;
		}

		function getPlantingScrewBandInteriorPoint(geometry, x, diagonalRatio) {
			if (!geometry) return null;
			const seasonWidth = geometry.lowerRight.x - geometry.lowerLeft.x;
			if (!seasonWidth) return null;

			const dateRatio = Math.min(0.82, Math.max(0.18, (x - geometry.lowerLeft.x) / seasonWidth));
			const bandRatio = Math.min(0.78, Math.max(0.22, diagonalRatio));
			const lowerX = geometry.lowerLeft.x + (seasonWidth * dateRatio);
			const upperX = geometry.upperLeft.x + (seasonWidth * dateRatio);

			return {
				x: lowerX + ((upperX - lowerX) * bandRatio),
				y: SCREW_HEIGHT - (SCREW_HEIGHT * bandRatio)
			};
		}

		function renderPlantingActionMarkers(groupEl, year) {
			if (!groupEl) return;

			const seasonCounts = {};
			const markerHeight = 12;
			const diagonalRatios = [0.24, 0.42, 0.60, 0.76];
			const bandAngle = -Math.atan2(SCREW_HEIGHT, PX_PER_YEAR) * 180 / Math.PI;

			getPlantingActionMarkers(year).forEach(marker => {
				const x = dateToPlantingX(marker.date);
				if (x < MINX || x > MAXX) return;
				const geometry = getPlantingScrewBandGeometry(marker.season, year);
				if (!geometry) return;

				const position = seasonCounts[marker.season] || 0;
				seasonCounts[marker.season] = position + 1;

				const width = Math.max(28, marker.label.length * 5 + 12);
				const point = getPlantingScrewBandInteriorPoint(geometry, x, diagonalRatios[position % diagonalRatios.length]);
				if (!point || point.x < MINX || point.x > MAXX) return;
				const y = -markerHeight / 2;
				const chip = createSvgEl("g", {
					opacity: "0.92",
					transform: `translate(${point.x},${point.y}) rotate(${bandAngle})`
				});

				const rect = createSvgEl("rect", {
					x: -(width / 2),
					y,
					width,
					height: markerHeight,
					rx: "6",
					ry: "6",
					fill: "rgba(0,0,0,0.56)",
					stroke: marker.color,
					"stroke-width": "0.9"
				});

				const text = createSvgEl("text", {
					x: 0,
					y: 0,
					"text-anchor": "middle",
					"dominant-baseline": "middle",
					"font-size": "8",
					"font-weight": "700",
					fill: "#ffffff"
				});
				text.textContent = marker.label;

				const title = createSvgEl("title");
				title.textContent = `${marker.season}: ${marker.label}`;
				chip.appendChild(title);
				chip.appendChild(rect);
				chip.appendChild(text);
				groupEl.appendChild(chip);
			});
		}

		function getPlantingCurrentDate() {
			return (window.timeState && window.timeState.dateUTC instanceof Date)
				? window.timeState.dateUTC
				: new Date();
		}

		function getUpcomingPlantingActions(currentDate) {
			const year = currentDate.getUTCFullYear();
			const currentTime = currentDate.getTime();
			const dayMs = 86400000;
			const actions = [
				...getPlantingActionMarkers(year - 1),
				...getPlantingActionMarkers(year),
				...getPlantingActionMarkers(year + 1)
			].map(action => ({
				...action,
				daysUntil: Math.round((action.date.getTime() - currentTime) / dayMs)
			}));

			return actions
				.filter(action => action.daysUntil >= -10 && action.daysUntil <= 160)
				.sort((a, b) => {
					const aWindow = a.daysUntil < 0 ? 0 : a.daysUntil;
					const bWindow = b.daysUntil < 0 ? 0 : b.daysUntil;
					return (aWindow - bWindow) || (a.priority - b.priority) || (a.date - b.date);
				})
				.slice(0, 5);
		}

		function getPlantingFixedPanelFrame() {
			const bounds = typeof getPlantingViewportBounds === "function"
				? getPlantingViewportBounds()
				: { left: 0, top: 190, width: window.innerWidth, centerX: window.innerWidth / 2 };
			const nowScreenX = typeof getPlantingNowViewportX === "function"
				? getPlantingNowViewportX()
				: (bounds.left + (bounds.width || window.innerWidth) / 2);
			const guildWidth = 300;
			let guildLeft = Math.max(bounds.left + 18, nowScreenX - guildWidth - 42);
			let budgetLeft = bounds.left + 18;
			// When zodiac panel is open, push panels right of it
			if (document.body.classList.contains("zodiac-panel-open")) {
			  const zpw = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--zodiac-panel-width")) || 655;
			  guildLeft = Math.max(guildLeft, zpw + 18);
			  budgetLeft = Math.max(budgetLeft, zpw + 18);
			}
			return {
				nowScreenX,
				guildLeft,
				guildWidth,
				guildTop: bounds.top + CANON.TIMELINE_Y + CANON.SCREW_TOP_PAD + 235,
				budgetLeft,
				budgetWidth: Math.max(420, bounds.width - 36)
			};
		}

		function syncPlantingFixedPanelVars(frame) {
			const root = document.documentElement;
			if (!root || !frame) return;

			root.style.setProperty("--planting-guild-left", `${Math.round(frame.guildLeft)}px`);
			root.style.setProperty("--planting-guild-top", `${Math.round(frame.guildTop)}px`);
			root.style.setProperty("--planting-guild-width", `${Math.round(frame.guildWidth)}px`);
		}

		function stylePlantingFixedPanel(el, frame, kind) {
			syncPlantingFixedPanelVars(frame);

			el.style.position = "fixed";
			el.style.pointerEvents = "none";
			el.style.zIndex = "165";
			el.style.boxSizing = "border-box";
			el.style.border = "1px solid rgba(255,255,255,0.16)";
			el.style.background = "rgba(0,0,0,0.42)";
			el.style.boxShadow = "0 14px 42px rgba(0,0,0,0.38)";
			el.style.backdropFilter = "blur(2px)";
			el.style.color = "#fff";

			if (kind === "guild") {
				el.style.left = `${frame.guildLeft}px`;
				el.style.top = `${frame.guildTop}px`;
				el.style.width = `${frame.guildWidth}px`;
				el.style.height = "110px";
				el.style.borderRadius = "8px";
				return;
			}

			el.style.left = `${frame.budgetLeft}px`;
			el.style.right = "18px";
			el.style.bottom = "16px";
			el.style.width = `${frame.budgetWidth}px`;
			el.style.minHeight = "50px";
			el.style.borderRadius = "8px";
			el.style.opacity = "0.62";
		}

		// NOTE: Living guild preview disabled — kept for future re-enable.
		// function renderPlantingFixedGuildPreview() {
		// 	let panel = document.getElementById("plantingFixedGuildPreview");
		// 	if (!panel) {
		// 		panel = document.createElement("div");
		// 		panel.id = "plantingFixedGuildPreview";
		// 		document.body.appendChild(panel);
		// 	}
		// 	stylePlantingFixedPanel(panel, getPlantingFixedPanelFrame(), "guild");
		// 	panel.innerHTML = `
		// 		<div style="position:absolute;left:14px;top:10px;font-size:12px;font-weight:900;color:#e7f8d2;">Living guild preview</div>
		// 		<div style="position:absolute;left:14px;top:29px;font-size:9px;color:rgba(255,255,255,0.62);">free mode: soil becomes a generic food forest</div>
		// 		<svg viewBox="0 0 300 110" width="300" height="110" aria-hidden="true" style="position:absolute;left:0;top:0;">
		// 			<path d="M18 76 C72 66 112 88 162 74 C214 59 246 74 282 66 L282 94 L18 94 Z" fill="rgba(88,49,24,0.82)" stroke="rgba(245,222,179,0.28)" stroke-width="1"></path>
		// 			<path d="M24 68 C82 61 136 72 188 62 C230 54 258 60 280 56" fill="none" stroke="#c08457" stroke-width="5" opacity="0.68" stroke-linecap="round"></path>
		// 			<g stroke-linecap="round">
		// 				<line x1="84" y1="70" x2="84" y2="48" stroke="#22c55e" stroke-width="2.5"></line>
		// 				<ellipse cx="77" cy="46" rx="8" ry="4" fill="#22c55e" transform="rotate(-26 77 46)" opacity="0.9"></ellipse>
		// 				<ellipse cx="92" cy="40" rx="8" ry="4" fill="#22c55e" transform="rotate(28 92 40)" opacity="0.86"></ellipse>
		// 				<line x1="128" y1="70" x2="128" y2="34" stroke="#86efac" stroke-width="2.5"></line>
		// 				<ellipse cx="121" cy="32" rx="8" ry="4" fill="#86efac" transform="rotate(-26 121 32)" opacity="0.9"></ellipse>
		// 				<ellipse cx="136" cy="26" rx="8" ry="4" fill="#86efac" transform="rotate(28 136 26)" opacity="0.86"></ellipse>
		// 				<line x1="176" y1="70" x2="176" y2="16" stroke="#4ade80" stroke-width="2.5"></line>
		// 				<ellipse cx="169" cy="14" rx="8" ry="4" fill="#4ade80" transform="rotate(-26 169 14)" opacity="0.9"></ellipse>
		// 				<ellipse cx="184" cy="8" rx="8" ry="4" fill="#4ade80" transform="rotate(28 184 8)" opacity="0.86"></ellipse>
		// 				<line x1="218" y1="70" x2="218" y2="40" stroke="#bef264" stroke-width="2.5"></line>
		// 				<ellipse cx="211" cy="38" rx="8" ry="4" fill="#bef264" transform="rotate(-26 211 38)" opacity="0.9"></ellipse>
		// 				<ellipse cx="226" cy="32" rx="8" ry="4" fill="#bef264" transform="rotate(28 226 32)" opacity="0.86"></ellipse>
		// 			</g>
		// 		</svg>
		// 	`;
		// }
		function renderPlantingFixedGuildPreview() {
			// Disabled — living guild preview removed per request. See commented code above to re-enable.
			const panel = document.getElementById("plantingFixedGuildPreview");
			if (panel) panel.remove();
		}

		window.repositionPlantingFixedPanels = function() {
			renderPlantingFixedGuildPreview();
			renderPlantingFixedBudgetTracker();
		};

		function renderPlantingFixedBudgetTracker() {
			let panel = document.getElementById("plantingFixedBudgetTracker");
			if (!panel) {
				panel = document.createElement("div");
				panel.id = "plantingFixedBudgetTracker";
				document.body.appendChild(panel);
			}

			stylePlantingFixedPanel(panel, getPlantingFixedPanelFrame(), "budget");
			panel.innerHTML = `
				<div style="display:flex;align-items:center;gap:18px;padding:10px 14px;font-size:9px;color:rgba(255,255,255,0.48);">
					<div style="min-width:150px;">
						<div style="font-size:11px;font-weight:900;color:rgba(255,255,255,0.72);margin-bottom:3px;">Budget tracker</div>
						<div>Personal plan unlocks cost tracking and material totals.</div>
					</div>
					<div style="display:flex;gap:26px;font-weight:800;color:rgba(255,255,255,0.44);">
						<span>Trees</span><span>Mulch</span><span>Tools</span><span>Soil</span><span>Irrigation</span><span>Seeds</span><span>Total</span>
					</div>
				</div>
			`;
		}

		if (!window.__plantingFixedPanelsResizeBound) {
			window.__plantingFixedPanelsResizeBound = true;
			window.addEventListener("resize", () => {
				renderPlantingFixedGuildPreview();
				renderPlantingFixedBudgetTracker();
			});
		}

		function renderPlantingLivingDashboard() {
			if (!bottomYears) return;

			const currentDate = getPlantingCurrentDate();
			const nowX = dateToPlantingX(currentDate);
			const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			const actions = getUpcomingPlantingActions(currentDate);
			const y = CANON.TIMELINE_Y + 280;
			const dashboard = createSvgEl("g", {
				id: "plantingLivingDashboard",
				opacity: "0.97"
			});

			renderPlantingFixedGuildPreview();
			renderPlantingFixedBudgetTracker();

			const actionPanel = createSvgEl("g", {
				transform: `translate(${nowX + 56},${y})`
			});
			actionPanel.appendChild(createSvgEl("rect", {
				x: 0,
				y: 0,
				width: 330,
				height: 124,
				rx: "8",
				ry: "8",
				fill: "rgba(0,0,0,0.42)",
				stroke: "rgba(255,255,255,0.18)",
				"stroke-width": "1"
			}));
			const actionTitle = createSvgEl("text", {
				x: 14,
				y: 21,
				"font-size": "12",
				"font-weight": "900",
				fill: "#fff7d6"
			});
			actionTitle.textContent = "Next garden actions";
			actionPanel.appendChild(actionTitle);
			const actionSub = createSvgEl("text", {
				x: 14,
				y: 38,
				"font-size": "9",
				fill: "rgba(255,255,255,0.6)"
			});
			actionSub.textContent = "date-based guidance, upgraded by a personal plan";
			actionPanel.appendChild(actionSub);

			actions.forEach((action, index) => {
				const rowY = 56 + (index * 13);
				const due = action.daysUntil < 0 ? "now" : `${action.daysUntil}d`;
				const dateLabel = `${monthNames[action.month - 1]} ${action.day}`;
				actionPanel.appendChild(createSvgEl("circle", {
					cx: 18,
					cy: rowY - 3,
					r: "3",
					fill: action.color,
					opacity: "0.9"
				}));
				const label = createSvgEl("text", {
					x: 30,
					y: rowY,
					"font-size": "10",
					"font-weight": index === 0 ? "900" : "700",
					fill: index === 0 ? "#ffffff" : "rgba(255,255,255,0.82)"
				});
				label.textContent = action.label;
				actionPanel.appendChild(label);
				const meta = createSvgEl("text", {
					x: 185,
					y: rowY,
					"font-size": "9",
					fill: "rgba(255,255,255,0.58)"
				});
				meta.textContent = `${dateLabel} · ${due}`;
				actionPanel.appendChild(meta);
			});
			dashboard.appendChild(actionPanel);

			bottomYears.appendChild(dashboard);
		}

		function renderPlantingSeasonalScrewBody() {
			if (!bands || !diags) return;
			bands.innerHTML = "";
			diags.innerHTML = "";

			const topShiftX = PX_PER_YEAR;
			const phases = [
				{ key: "spring", glyph: "\u2648\uFE0E", label: "Aries / Spring", color: PLANTING_ROW_COLORS.prophet },
				{ key: "summer", glyph: "\u264B\uFE0E", label: "Cancer / Summer", color: PLANTING_ROW_COLORS.nomad },
				{ key: "fall", glyph: "\u264E\uFE0E", label: "Libra / Fall", color: PLANTING_ROW_COLORS.hero },
				{ key: "winter", glyph: "\u2651\uFE0E", label: "Capricorn / Winter", color: PLANTING_ROW_COLORS.artist }
			];

			const startYear = Math.floor(2020 + ((MINX - SCREW_EPOCH_X) / PX_PER_YEAR)) - 2;
			const endYear = Math.ceil(2020 + ((MAXX - SCREW_EPOCH_X) / PX_PER_YEAR)) + 2;

			for (let year = startYear; year <= endYear; year++) {
				for (let p = 0; p < 4; p++) {
					const geometryYear = phases[p].key === "winter" ? year + 1 : year;
					const geometry = getPlantingScrewBandGeometry(phases[p].key, geometryYear);
					if (!geometry) continue;
					if (geometry.upperRight.x < MINX || geometry.lowerLeft.x > MAXX) continue;

					const poly = document.createElementNS(
						"http://www.w3.org/2000/svg",
						"polygon"
					);

					poly.setAttribute(
						"points",
						`
							${geometry.lowerLeft.x},${geometry.lowerLeft.y}
							${geometry.lowerRight.x},${geometry.lowerRight.y}
							${geometry.upperRight.x},${geometry.upperRight.y}
							${geometry.upperLeft.x},${geometry.upperLeft.y}
						`
					);

					poly.setAttribute("fill", phases[p].color);
					poly.setAttribute("opacity", "0.33");
					const title = createSvgEl("title");
					title.textContent = `${phases[p].glyph} ${phases[p].label}`;
					poly.appendChild(title);
					bands.appendChild(poly);
				}
			}

			for (let year = startYear; year <= endYear; year++) {
				const anchors = getSeasonalAnchorDates(year);

				for (let p = 0; p < 4; p++) {
					const x = dateToPlantingX(anchors[p].date);
					if (x + topShiftX < MINX || x > MAXX) continue;

					const ln = document.createElementNS(
						"http://www.w3.org/2000/svg",
						"line"
					);

					ln.setAttribute("x1", x);
					ln.setAttribute("y1", CANON.TIMELINE_Y);
					ln.setAttribute("x2", x + topShiftX);
					ln.setAttribute("y2", 0);
					ln.setAttribute("stroke", "white");
					ln.setAttribute("stroke-width", "1.2");
					diags.appendChild(ln);
				}
			}

			const markerYear = getVisibleYearsForPlantingScale().center + 1;
			renderPlantingActionMarkers(diags, markerYear);
			renderPlantingLivingDashboard();
		}

		function getPlantingImplementationTasks(year) {
			return {
				prophet: [
					{ label: "Site survey", start: [1, 10], end: [1, 31], color: "#f87171" },
					{ label: "Soil test", start: [1, 20], end: [2, 10], color: "#fb923c" },
					{ label: "Water mapping", start: [2, 1], end: [2, 20], color: "#38bdf8" },
					{ label: "Bed layout", start: [2, 15], end: [3, 10], color: "#facc15" }
				],
				nomad: [
					{ label: "Tree planting", start: [2, 20], end: [3, 20], color: "#4ade80" },
					{ label: "Irrigation install", start: [3, 10], end: [4, 5], color: "#60a5fa" },
					{ label: "Fencing / protection", start: [3, 1], end: [4, 1], color: "#a3e635" },
					{ label: "Staking / support", start: [3, 15], end: [4, 15], color: "#2dd4bf" }
				],
				hero: [
					{ label: "Shrub insertion", start: [4, 1], end: [5, 15], color: "#fde047" },
					{ label: "Herb layer planting", start: [4, 15], end: [5, 30], color: "#bef264" },
					{ label: "Groundcover planting", start: [5, 1], end: [6, 10], color: "#86efac" }
				],
				artist: [
					{ label: "Pruning", start: [1, 15], end: [2, 15], color: "#93c5fd" },
					{ label: "Mulch renewal", start: [5, 15], end: [6, 30], color: "#c084fc" },
					{ label: "Harvest window", start: [7, 1], end: [9, 30], color: "#fbbf24" },
					{ label: "Replacement / succession", start: [10, 1], end: [11, 15], color: "#f472b6" }
				]
			};
		}

		function getPlantingRibbonWindows() {
			const params = new URLSearchParams(window.location.search);
			const location = window.locationData || {};
			const latitude = Number(location.lat);
			const isSouthern = Number.isFinite(latitude) && latitude < 0;
			const zone = String(params.get("zone") || "");
			const zoneNumber = Number.parseInt(zone, 10);
			const koppen = String(params.get("koppen") || "");
			const isTropical = koppen.startsWith("A") || zoneNumber >= 11;
			const isArid = koppen.startsWith("B");

			if (isTropical) {
				return {
					constraints: [
						{ label: "Heat / sun stress", start: [2, 15], end: [5, 31], color: "#f97316", reason: "High heat and evaporative demand can stress new transplants and shallow roots.", response: "Favor early-morning work, shade tender starts, mulch, and maintain even moisture." },
						{ label: "Heavy rain / disease", start: [6, 1], end: [10, 15], color: "#38bdf8", reason: "Persistent rain and leaf wetness can increase waterlogging and disease pressure.", response: "Prioritize drainage, airflow, staking, and short dry planting windows." },
						{ label: "Dry-season stress", start: [10, 16], end: [12, 31], color: "#f59e0b", reason: "Declining rainfall raises establishment and irrigation risk.", response: "Plant only where irrigation and deep mulch are ready." }
					],
					actions: [
						{ label: "Plant with irrigation", start: [1, 1], end: [5, 15], color: "#22c55e", reason: "Warm soils support growth, but establishment depends on reliable moisture.", response: "Plant heat-adapted crops and perennials with irrigation in place." },
						{ label: "Drain / protect", start: [5, 16], end: [10, 15], color: "#38bdf8", reason: "Wet-season work should reduce saturation and foliar disease.", response: "Improve drainage, trellis, prune for airflow, and pause during saturated periods." },
						{ label: "Mulch / irrigate", start: [10, 16], end: [12, 31], color: "#facc15", reason: "Dry-season planting needs active water conservation.", response: "Mulch deeply, irrigate at the root zone, and monitor young plants." }
					]
				};
			}

			const windows = {
				constraints: [
					{ label: "Frost / cold soil", start: [1, 1], end: [3, zoneNumber && zoneNumber <= 5 ? 31 : 20], color: "#60a5fa", reason: "Freezing nights and cold soil can damage tender growth and slow germination.", response: "Wait, start indoors, or use frost protection until conditions improve." },
					{ label: isArid ? "Heat / water deficit" : "Heat stress", start: [6, 21], end: [8, 31], color: "#f97316", reason: "High temperature and evaporative demand increase transplant and moisture stress.", response: "Water deeply, mulch, provide temporary shade, and avoid midday transplanting." },
					{ label: "Wind / storm risk", start: [9, 1], end: [10, 15], color: "#a78bfa", reason: "Seasonal wind and storms can damage unsupported plants and exposed new trees.", response: "Stake only where needed, secure covers, and delay planting around severe weather." },
					{ label: "Frost return", start: [10, 16], end: [12, 31], color: "#3b82f6", reason: "Shortening days and returning freezes limit tender crop establishment.", response: "Protect remaining crops, harvest tender produce, and favor dormant planting." }
				],
				actions: [
					{ label: "Start / prepare", start: [1, 15], end: [3, 15], color: "#facc15", reason: "This is the preparation and protected-start window for the coming season.", response: "Start suitable crops indoors, prepare beds, repair irrigation, and stage mulch." },
					{ label: "Sow / transplant", start: [3, 16], end: [5, 31], color: "#22c55e", reason: "Warming soil and declining frost risk create the main establishment window.", response: "Direct sow cool-tolerant crops first, then transplant tender plants after frost risk passes." },
					{ label: "Water / tend", start: [6, 1], end: [8, 31], color: "#38bdf8", reason: "Active growth shifts priority from establishment to moisture and canopy management.", response: "Irrigate, mulch, trellis, scout, and succession-sow where heat permits." },
					{ label: "Harvest / protect", start: [9, 1], end: [12, 15], color: "#f59e0b", reason: "Maturity and falling temperatures make harvest and protection the priority.", response: "Harvest, preserve, protect tender crops, and plant hardy dormant stock where appropriate." }
				]
			};

			if (!isSouthern) return windows;

			function shiftSixMonths(items) {
				return items.flatMap(item => {
					const shift = ([month, day]) => [((month + 5) % 12) + 1, day];
					const start = shift(item.start);
					const end = shift(item.end);
					if (start[0] <= end[0]) return [{ ...item, start, end }];
					return [
						{ ...item, start, end: [12, 31] },
						{ ...item, start: [1, 1], end }
					];
				});
			}

			return {
				constraints: shiftSixMonths(windows.constraints),
				actions: shiftSixMonths(windows.actions)
			};
		}

		function renderPlantingRibbonLane(groupEl, windows, y, height, opacity) {
			if (!groupEl) return;
			if (!groupEl.dataset.guidanceEventsBound) {
				const openSegment = target => {
					const segment = target?.closest?.(".planting-guidance-segment");
					if (!segment || !groupEl.contains(segment)) return;
					try {
						const detail = JSON.parse(segment.dataset.guidance || "{}");
						window.dispatchEvent(new CustomEvent("planting-guidance-open", { detail }));
					} catch (error) {
						console.warn("[planting-guidance] Could not open segment", error);
					}
				};
				groupEl.addEventListener("click", event => openSegment(event.target));
				groupEl.addEventListener("keydown", event => {
					if (event.key !== "Enter" && event.key !== " ") return;
					event.preventDefault();
					openSegment(event.target);
				});
				groupEl.dataset.guidanceEventsBound = "true";
			}
			const years = getVisibleYearsForPlantingScale();
			for (let year = years.start; year <= years.end; year++) {
				windows.forEach(win => {
					const range = plantingWindowToX(year, win.start[0], win.start[1], win.end[0], win.end[1]);
					if (range.x1 < MINX || range.x0 > MAXX) return;
					const x0 = Math.max(range.x0, MINX);
					const x1 = Math.min(range.x1, MAXX);
					const width = Math.max(3, x1 - x0);
					const rect = createSvgEl("rect", {
						x: x0,
						y,
						width,
						height,
						rx: "2",
						ry: "2",
						fill: win.color,
						opacity,
						stroke: "rgba(255,255,255,0.42)",
						"stroke-width": "0.65"
					});
					rect.setAttribute("class", "planting-guidance-segment");
					rect.setAttribute("tabindex", "0");
					rect.setAttribute("role", "button");
					rect.setAttribute("aria-label", `${win.label}, ${year}`);
					const detail = {
						...win,
						lane: groupEl.id === "overlayCycle" ? "condition" : "action",
						year,
						startDate: `${year}-${String(win.start[0]).padStart(2, "0")}-${String(win.start[1]).padStart(2, "0")}`,
						endDate: `${year}-${String(win.end[0]).padStart(2, "0")}-${String(win.end[1]).padStart(2, "0")}`
					};
					rect.dataset.guidance = JSON.stringify(detail);
					const title = createSvgEl("title");
					title.textContent = `${win.label} · click for planting guidance`;
					rect.appendChild(title);
					groupEl.appendChild(rect);
				});
			}

			window.refreshPlantingGuidanceBands = renderPlantingCycleRibbons;
		}

		function positionPlantingCycleHud() {
			const hud = document.getElementById("conjLaneHud");
			const svg = document.getElementById("screwSVG");
			if (!hud || !svg) return;

			const height = ELEMENTAL.HEIGHT;
			const gap = 6;
			const svgRect = svg.getBoundingClientRect();
			const baselineTopPad = 22;
			const actionsCenterY = svgRect.top + baselineTopPad + (height / 2);
			const constraintsCenterY = actionsCenterY - (height + gap);
			const labelLeft = svgRect.left + 64;

			[
				{ selector: '[data-planting-cycle-label="constraints"]', y: constraintsCenterY },
				{ selector: '[data-planting-cycle-label="actions"]', y: actionsCenterY }
			].forEach(item => {
				const el = hud.querySelector(item.selector);
				if (!el) return;
				el.style.left = `${labelLeft}px`;
				el.style.top = `${item.y - (el.offsetHeight / 2)}px`;
			});

			const keyBtn = hud.querySelector("[data-planting-key-open]");
			if (keyBtn) {
				keyBtn.style.left = `${svgRect.left + 14}px`;
				keyBtn.style.top = `${constraintsCenterY - (height / 2)}px`;
				keyBtn.style.height = `${(height * 2) + gap}px`;
			}
		}

		function renderPlantingCycleRibbons() {
			const constraintsGroup = document.getElementById("overlayCycle");
			const actionsGroup = document.getElementById("elementalCycle");
			if (constraintsGroup) constraintsGroup.innerHTML = "";
			if (actionsGroup) actionsGroup.innerHTML = "";

			const oldHud = document.getElementById("conjLaneHud");
			if (oldHud) oldHud.remove();

			const height = ELEMENTAL.HEIGHT;
			const gap = 6;
			const windows = getPlantingRibbonWindows();

			renderPlantingRibbonLane(constraintsGroup, windows.constraints, -(height * 2 + gap), height, "0.54");
			renderPlantingRibbonLane(actionsGroup, windows.actions, -height, height, "0.58");

			const svg = document.getElementById("screwSVG");
			if (svg) {
				const hud = document.createElement("div");
				hud.id = "conjLaneHud";
				hud.style.position = "fixed";
				hud.style.left = "0";
				hud.style.top = "0";
				hud.style.width = "0";
				hud.style.height = "0";
				hud.style.pointerEvents = "none";
				hud.style.zIndex = "5";
				document.body.appendChild(hud);

				const keyBtn = document.createElement("button");
				keyBtn.type = "button";
				keyBtn.textContent = "Key";
				keyBtn.className = "plantingCycleKeyBtn";
				keyBtn.setAttribute("data-planting-key-open", "true");
				keyBtn.setAttribute("aria-haspopup", "dialog");
				keyBtn.setAttribute("aria-controls", "plantingKeyModal");
				keyBtn.style.position = "fixed";
				hud.appendChild(keyBtn);

				[
					{ key: "constraints", label: "Constraints" },
					{ key: "actions", label: "Actions" }
				].forEach(item => {
					const el = document.createElement("div");
					el.textContent = item.label;
					el.className = "plantingCycleLabel";
					el.dataset.plantingCycleLabel = item.key;
					el.style.position = "fixed";
					hud.appendChild(el);
				});
				positionPlantingCycleHud();
			}

		}

		function renderPlantingMonthTicks() {
			if (!bottomYears || !ticks) return;
			bottomYears.innerHTML = "";
			ticks.innerHTML = "";

			const years = getVisibleYearsForPlantingScale();
			for (let year = years.start; year <= years.end; year++) {
				for (let month = 0; month < 12; month++) {
					const date = new Date(Date.UTC(year, month, 1, 12, 0, 0));
					const x = dateToPlantingX(date);
					if (x < MINX || x > MAXX) continue;

					const isJanuary = month === 0;
					const isQuarter = month % 3 === 0;
					const tick = createSvgEl("line", {
						x1: x,
						x2: x,
						y1: CANON.TIMELINE_Y,
						y2: CANON.TIMELINE_Y + (isJanuary ? 14 : isQuarter ? 10 : 6),
						stroke: "white",
						"stroke-width": isJanuary ? "1.2" : isQuarter ? "0.9" : "0.55",
						opacity: isJanuary ? "0.85" : isQuarter ? "0.58" : "0.34"
					});
					ticks.appendChild(tick);

					if (isJanuary) {
						const yearLabel = createSvgEl("text", {
							x,
							y: CANON.TIMELINE_Y + 34,
							"text-anchor": "middle",
							"font-size": "13",
							"font-weight": "800",
							fill: "#ffffff",
							opacity: "0.95",
							"paint-order": "stroke",
							stroke: "rgba(0,0,0,0.85)",
							"stroke-width": "2",
							"stroke-linejoin": "round"
						});
						yearLabel.textContent = String(year);
						bottomYears.appendChild(yearLabel);
					}

					if (month % 2 === 0) {
						const monthLabel = createSvgEl("text", {
							x,
							y: CANON.TIMELINE_Y + 20,
							"text-anchor": "middle",
							"font-size": "10",
							"font-weight": isQuarter ? "700" : "500",
							fill: "rgba(255,255,255,0.78)",
							"paint-order": "stroke",
							stroke: "rgba(0,0,0,0.72)",
							"stroke-width": "1.4",
							"stroke-linejoin": "round"
						});
						monthLabel.textContent = PLANTING_MONTHS[month];
						bottomYears.appendChild(monthLabel);
					}
				}
			}
		}


		/* ---------------------------------------------------------
		   09.5.2 — BUILD PLANTING ANNUAL SEASONAL WAVE
		   --------------------------------------------------------- */
		function buildSaeculumWave() {
			renderAnnualSeasonalWave();
		}

		function plantingAstronomyTimeToDate(timeLike) {
			if (timeLike instanceof Date) return timeLike;
			if (timeLike && timeLike.date instanceof Date) return timeLike.date;
			if (timeLike && typeof timeLike.toDate === "function") return timeLike.toDate();
			if (timeLike && typeof timeLike.toString === "function") {
				const parsed = new Date(timeLike.toString());
				if (!Number.isNaN(parsed.getTime())) return parsed;
			}
			return null;
		}

		function getPlantingLunarEvents() {
			if (window.__plantingLunarEvents) return window.__plantingLunarEvents;

			const start = new Date(Date.UTC(2020, 0, 1, 12, 0, 0));
			const end = new Date(Date.UTC(2041, 0, 1, 12, 0, 0));
			const events = [];
			const astronomy = (typeof window !== "undefined") ? window.Astronomy : null;

			if (astronomy && typeof astronomy.SearchMoonPhase === "function") {
				[
					{ phase: "new", angle: 0, label: "New" },
					{ phase: "full", angle: 180, label: "Full" }
				].forEach(config => {
					let cursor = new Date(start.getTime());
					let guard = 0;
					while (cursor < end && guard < 600) {
						const found = plantingAstronomyTimeToDate(astronomy.SearchMoonPhase(config.angle, cursor, 40));
						if (!found || found >= end) break;
						if (found >= start) {
							events.push({
								phase: config.phase,
								label: config.label,
								date: found,
								isEclipse: false,
								eclipseKind: ""
							});
						}
						cursor = new Date(found.getTime() + 20 * 86400000);
						guard++;
					}
				});
			} else {
				const synodicDays = 29.530588853;
				const knownNew = Date.UTC(2020, 0, 24, 21, 42, 0);
				for (let t = knownNew; t < end.getTime(); t += synodicDays * 86400000) {
					if (t >= start.getTime()) events.push({ phase: "new", label: "New", date: new Date(t), isEclipse: false, eclipseKind: "" });
					const fullT = t + (synodicDays * 86400000 / 2);
					if (fullT >= start.getTime() && fullT < end.getTime()) events.push({ phase: "full", label: "Full", date: new Date(fullT), isEclipse: false, eclipseKind: "" });
				}
			}

			function flagEclipses(searchName, nextName, phase) {
				if (!astronomy || typeof astronomy[searchName] !== "function") return;
				let eclipse = null;
				try {
					eclipse = astronomy[searchName](start);
				} catch (err) {
					return;
				}
				let guard = 0;
				while (eclipse && guard < 80) {
					const peak = plantingAstronomyTimeToDate(eclipse.peak || eclipse.time);
					if (!peak || peak >= end) break;
					const match = events
						.filter(event => event.phase === phase)
						.sort((a, b) => Math.abs(a.date - peak) - Math.abs(b.date - peak))[0];
					if (match && Math.abs(match.date - peak) < 2 * 86400000) {
						match.isEclipse = true;
						match.eclipseKind = String(eclipse.kind || "eclipse");
						match.date = peak;
					}
					if (typeof astronomy[nextName] !== "function") break;
					try {
						eclipse = astronomy[nextName](peak);
					} catch (err) {
						break;
					}
					guard++;
				}
			}

			flagEclipses("SearchGlobalSolarEclipse", "NextGlobalSolarEclipse", "new");
			flagEclipses("SearchLunarEclipse", "NextLunarEclipse", "full");

			window.__plantingLunarEvents = events.sort((a, b) => a.date - b.date);
			return window.__plantingLunarEvents;
		}

		function renderPlantingLunarEventLayer() {
			if (!saeculumLine) return;
			const layer = createSvgEl("g", {
				id: "plantingLunarEvents",
				opacity: "0.92"
			});
			const moonY = {
				full: CANON.TIMELINE_Y + 54,
				new: CANON.TIMELINE_Y + 82
			};
			const labelY = {
				full: CANON.TIMELINE_Y + 70,
				new: CANON.TIMELINE_Y + 98
			};
			const monthFmt = new Intl.DateTimeFormat("en-US", {
				timeZone: "UTC",
				month: "short",
				day: "numeric",
				year: "2-digit"
			});

			getPlantingLunarEvents().forEach((event, index) => {
				const x = dateToPlantingX(event.date);
				if (x < MINX || x > MAXX) return;
				const y = moonY[event.phase];
				const color = event.phase === "full" ? "#e5e7eb" : "#94a3b8";
				const glow = event.isEclipse ? "#f97316" : color;

				layer.appendChild(createSvgEl("line", {
					x1: x,
					x2: x,
					y1: CANON.TIMELINE_Y,
					y2: y - 8,
					stroke: event.isEclipse ? "#f97316" : "rgba(255,255,255,0.34)",
					"stroke-width": event.isEclipse ? "1.1" : "0.55",
					opacity: event.isEclipse ? "0.92" : "0.42"
				}));

				const marker = createSvgEl("g", {
					transform: `translate(${x},${y})`
				});
				marker.style.filter = `drop-shadow(0 0 ${event.isEclipse ? 8 : 4}px ${glow})`;
				marker.appendChild(createSvgEl("circle", {
					cx: 0,
					cy: 0,
					r: event.isEclipse ? "7" : "5",
					fill: event.phase === "full" ? "#f8fafc" : "#0f172a",
					stroke: event.isEclipse ? "#f97316" : color,
					"stroke-width": event.isEclipse ? "1.5" : "1"
				}));
				if (event.phase === "new") {
					marker.appendChild(createSvgEl("circle", {
						cx: -1.5,
						cy: -1.5,
						r: "2",
						fill: "rgba(255,255,255,0.28)"
					}));
				}
				if (event.isEclipse) {
					marker.appendChild(createSvgEl("circle", {
						cx: 0,
						cy: 0,
						r: "10",
						fill: "none",
						stroke: "#f97316",
						"stroke-width": "0.85",
						opacity: "0.85"
					}));
				}
				const phaseText = createSvgEl("text", {
					x: 0,
					y: 2.5,
					"text-anchor": "middle",
					"font-size": event.isEclipse ? "7" : "6",
					"font-weight": "900",
					fill: event.phase === "full" ? "#0f172a" : "#e5e7eb",
					"paint-order": "stroke",
					stroke: event.phase === "full" ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.6)",
					"stroke-width": "0.6"
				});
				phaseText.textContent = event.phase === "full" ? "F" : "N";
				marker.appendChild(phaseText);
				const title = createSvgEl("title");
				title.textContent = `${event.isEclipse ? "Eclipse " : ""}${event.label} Moon - ${monthFmt.format(event.date)}`;
				marker.appendChild(title);
				layer.appendChild(marker);

				if (!event.isEclipse) return;
				const label = createSvgEl("text", {
					x,
					y: labelY[event.phase] + ((index % 2) * 9),
					"text-anchor": "middle",
					"font-size": event.isEclipse ? "8.5" : "7.5",
					"font-weight": event.isEclipse ? "900" : "700",
					fill: event.isEclipse ? "#fed7aa" : "rgba(255,255,255,0.68)",
					"paint-order": "stroke",
					stroke: "rgba(0,0,0,0.86)",
					"stroke-width": "1.8",
					"stroke-linejoin": "round"
				});
				label.textContent = `${event.isEclipse ? "Ecl " : ""}${event.label} ${monthFmt.format(event.date)}`;
				layer.appendChild(label);
			});

			saeculumLine.appendChild(layer);
		}

		function getPlantingMoonPhaseDegrees(date) {
			if (typeof window !== "undefined" && typeof window.getPlanetLongitudes === "function") {
				try {
					const longitudes = window.getPlanetLongitudes(date);
					if (longitudes && typeof longitudes.moon === "number" && typeof longitudes.sun === "number") {
						return (((longitudes.moon - longitudes.sun) % 360) + 360) % 360;
					}
				} catch (err) {
					// Fall through to Astronomy Engine phase.
				}
			}
			const astronomy = (typeof window !== "undefined") ? window.Astronomy : null;
			if (astronomy && typeof astronomy.MoonPhase === "function") {
				try {
					return astronomy.MoonPhase(date);
				} catch (err) {
					// Fall through to mean-cycle estimate.
				}
			}
			const knownNew = Date.UTC(2020, 0, 24, 21, 42, 0);
			const synodicMs = 29.530588853 * 86400000;
			return ((((date.getTime() - knownNew) / synodicMs) % 1 + 1) % 1) * 360;
		}

		function getPlantingMoonPhasePath(cx, cy, radius, phaseDeg) {
			const phase = ((phaseDeg % 360) + 360) % 360;
			if (phase < 2 || phase > 358) return "";
			if (Math.abs(phase - 180) < 2) {
				return [
					`M ${cx} ${cy - radius}`,
					`A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
					`A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
					"Z"
				].join(" ");
			}

			const waxing = phase < 180;
			const terminator = Math.cos(phase * Math.PI / 180);
			const innerRx = Math.max(0.01, Math.abs(terminator) * radius);
			const innerSweep = terminator > 0
				? (waxing ? 0 : 1)
				: (waxing ? 1 : 0);
			const outerSweep = waxing ? 1 : 0;

			return [
				`M ${cx} ${cy - radius}`,
				`A ${radius} ${radius} 0 0 ${outerSweep} ${cx} ${cy + radius}`,
				`A ${innerRx.toFixed(2)} ${radius} 0 0 ${innerSweep} ${cx} ${cy - radius}`,
				"Z"
			].join(" ");
		}

		// Conceptual Planting-scale lunar node model.
		// The Sun/ecliptic axis remains fixed. The Moon keeps the existing
		// new-to-full vertical timing, while a small sinusoidal x-offset shows the
		// lunar orbital plane swiveling across the fixed ecliptic. Node positions
		// use the lunar node longitude relative to the Sun when the astronomy
		// adapter is available; exact lunar latitude and eclipse thresholds are deferred.
		function getPlantingLunarNodePhaseDegrees(date) {
			if (typeof window !== "undefined" && typeof window.getPlanetLongitudes === "function") {
				try {
					const longitudes = window.getPlanetLongitudes(date);
					if (longitudes && typeof longitudes.northNode === "number" && typeof longitudes.sun === "number") {
						return (((longitudes.northNode - longitudes.sun) % 360) + 360) % 360;
					}
				} catch (err) {
					// Fall through to the conceptual fallback cycle.
				}
			}
			const nodeCycleMs = 18.6 * 365.2422 * 86400000;
			const reference = Date.UTC(2020, 0, 1, 12, 0, 0);
			return ((((date.getTime() - reference) / nodeCycleMs) % 1 + 1) % 1) * 360;
		}

		function getPlantingMoonPhasePoint(phaseDeg, geometry) {
			const phase = ((phaseDeg % 360) + 360) % 360;
			const phaseRad = phase * Math.PI / 180;
			const fullness = (1 - Math.cos(phaseRad)) / 2;
			const argumentFromNode = (((phase - geometry.nodePhase) % 360) + 360) % 360;
			const argumentRad = argumentFromNode * Math.PI / 180;
			const lunarOffset = Math.sin(argumentRad) * geometry.maxTiltOffset;
			return {
				x: geometry.centerX + lunarOffset,
				y: geometry.sunY - fullness * geometry.orbitHeight,
				argumentFromNode,
				lunarOffset,
				fullness
			};
		}

		function getPlantingLunarOrbitGeometry(date, phaseDeg, localSunY) {
			const nodePhase = getPlantingLunarNodePhaseDegrees(date);
			const geometry = {
				centerX: 45,
				sunY: localSunY,
				topY: 20,
				orbitHeight: localSunY - 20,
				maxTiltOffset: 22,
				nodePhase
			};
			const moon = getPlantingMoonPhasePoint(phaseDeg, geometry);
			const northNode = getPlantingMoonPhasePoint(nodePhase, geometry);
			const southNode = getPlantingMoonPhasePoint(nodePhase + 180, geometry);
			const maxNorth = getPlantingMoonPhasePoint(nodePhase + 90, geometry);
			const maxSouth = getPlantingMoonPhasePoint(nodePhase + 270, geometry);
			const phase = ((phaseDeg % 360) + 360) % 360;
			const newMoonDistance = Math.min(Math.abs(phase), Math.abs(phase - 360));
			const fullMoonDistance = Math.abs(phase - 180);
			const nodeDistance = Math.min(moon.argumentFromNode, Math.abs(moon.argumentFromNode - 180), Math.abs(moon.argumentFromNode - 360));
			const isNearNode = nodeDistance < 18;
			const solarEclipseAlignment = isNearNode && newMoonDistance < 14;
			const lunarEclipseAlignment = isNearNode && fullMoonDistance < 14;
			const eclipseStrength = solarEclipseAlignment
				? Math.max(0, 1 - Math.max(newMoonDistance / 14, nodeDistance / 18))
				: (lunarEclipseAlignment ? Math.max(0, 1 - Math.max(fullMoonDistance / 14, nodeDistance / 18)) : 0);

			return {
				...geometry,
				moon,
				northNode,
				southNode,
				maxNorth,
				maxSouth,
				eclipseAlignment: solarEclipseAlignment || lunarEclipseAlignment,
				eclipseType: solarEclipseAlignment ? "solar" : (lunarEclipseAlignment ? "lunar" : null),
				eclipseStrength
			};
		}

		function getPlantingLunarOrbitPath(geometry) {
			const points = [];
			for (let degrees = 0; degrees <= 360; degrees += 8) {
				const point = getPlantingMoonPhasePoint(degrees, geometry);
				points.push(`${degrees === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`);
			}
			return points.join(" ");
		}

		const PLANTING_MOON_ZODIAC_SIGNS = [
			{ glyph: "♈", name: "Aries", color: "#ff4136" },
			{ glyph: "♉", name: "Taurus", color: "#2ecc40" },
			{ glyph: "♊", name: "Gemini", color: "#ffdc00" },
			{ glyph: "♋", name: "Cancer", color: "#0074d9" },
			{ glyph: "♌", name: "Leo", color: "#ff4136" },
			{ glyph: "♍", name: "Virgo", color: "#2ecc40" },
			{ glyph: "♎", name: "Libra", color: "#ffdc00" },
			{ glyph: "♏", name: "Scorpio", color: "#0074d9" },
			{ glyph: "♐", name: "Sagittarius", color: "#ff4136" },
			{ glyph: "♑", name: "Capricorn", color: "#2ecc40" },
			{ glyph: "♒", name: "Aquarius", color: "#ffdc00" },
			{ glyph: "♓", name: "Pisces", color: "#0074d9" }
		];

		function getPlantingMoonLongitudeDegrees(date) {
			if (typeof window !== "undefined" && typeof window.getPlanetLongitudes === "function") {
				try {
					const longitudes = window.getPlanetLongitudes(date);
					if (longitudes && typeof longitudes.moon === "number") {
						return ((longitudes.moon % 360) + 360) % 360;
					}
				} catch (err) {
					// Fall through to the approximate visual longitude below.
				}
			}

			// Approximate mean lunar longitude for the compact visual only.
			// Later this can be replaced with exact ephemeris longitude throughout.
			const daysSinceJ2000 = (date.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
			return ((218.316 + (13.176396 * daysSinceJ2000)) % 360 + 360) % 360;
		}

		function getPlantingMoonZodiacSign(date) {
			const longitude = getPlantingMoonLongitudeDegrees(date);
			const signIndex = Math.floor(longitude / 30) % PLANTING_MOON_ZODIAC_SIGNS.length;
			const degreeInSign = longitude % 30;
			return {
				...PLANTING_MOON_ZODIAC_SIGNS[signIndex],
				longitude,
				degreeInSign
			};
		}

		function getPlantingSunLongitudeDegrees(date) {
			if (typeof window !== "undefined" && typeof window.getPlanetLongitudes === "function") {
				try {
					const longitudes = window.getPlanetLongitudes(date);
					if (longitudes && typeof longitudes.sun === "number") {
						return ((longitudes.sun % 360) + 360) % 360;
					}
				} catch (err) {
					// Fall through to the approximate visual longitude below.
				}
			}

			// Approximate mean solar longitude for the compact visual only.
			const daysSinceJ2000 = (date.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
			return ((280.466 + (0.98564736 * daysSinceJ2000)) % 360 + 360) % 360;
		}

		function getPlantingSunZodiacSign(date) {
			const longitude = getPlantingSunLongitudeDegrees(date);
			const signIndex = Math.floor(longitude / 30) % PLANTING_MOON_ZODIAC_SIGNS.length;
			const degreeInSign = longitude % 30;
			return {
				...PLANTING_MOON_ZODIAC_SIGNS[signIndex],
				longitude,
				degreeInSign
			};
		}

		function getPlantingMoonPhaseReadout(phaseDeg) {
			const phase = ((phaseDeg % 360) + 360) % 360;
			const phaseIndex = Math.round(phase / 45) % 8;
			return [
				{ glyph: "🌑", name: "New Moon" },
				{ glyph: "🌒", name: "Waxing Crescent" },
				{ glyph: "🌓", name: "First Quarter" },
				{ glyph: "🌔", name: "Waxing Gibbous" },
				{ glyph: "🌕", name: "Full Moon" },
				{ glyph: "🌖", name: "Waning Gibbous" },
				{ glyph: "🌗", name: "Last Quarter" },
				{ glyph: "🌘", name: "Waning Crescent" }
			][phaseIndex];
		}

		function formatPlantingMoonPhaseExact(phaseDeg) {
			const phase = ((phaseDeg % 360) + 360) % 360;
			const degree = Math.floor(phase);
			const minutes = Math.floor((phase - degree) * 60);
			const ageDays = (phase / 360) * 29.530588853;
			const illumination = Math.round(((1 - Math.cos(phase * Math.PI / 180)) / 2) * 100);
			return `${degree}°${String(minutes).padStart(2, "0")}' from New · age ${ageDays.toFixed(1)}d · illum ${illumination}%`;
		}

		function getPlantingPlanContextForMoon() {
			const params = new URLSearchParams(window.location.search);
			const plants = String(params.get("plants") || "")
				.split(",")
				.map(plant => plant.trim())
				.filter(Boolean)
				.slice(0, 3);
			const zone = params.get("zone") || "";
			const sunSign = params.get("sunSign") || "";
			const hasPlan = Boolean(params.get("projectId") || params.get("guildId") || plants.length || zone || sunSign || params.get("source") === "permaculture");
			return { hasPlan, plants, zone, sunSign };
		}

		function formatPlantingPlanNounList(items) {
			if (!items.length) return "";
			if (items.length === 1) return items[0];
			if (items.length === 2) return `${items[0]} and ${items[1]}`;
			return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
		}

		function getPlantingMoonAdvice(phaseName, context) {
			const generic = {
				"New Moon": "Plan, observe, map beds, and set intentions for the next planting cycle.",
				"Waxing Crescent": "Sow quick greens, start tender seedlings, and begin light establishment work.",
				"First Quarter": "Transplant, trellis, irrigate, and support vigorous above-ground growth.",
				"Waxing Gibbous": "Tend plants, feed soil biology, mulch lightly, and correct stress before peak fullness.",
				"Full Moon": "Harvest herbs and fruits, observe vigor, and make notes while plant response is visible.",
				"Waning Gibbous": "Compost, chop-and-drop, spread mulch, and return nutrients to the beds.",
				"Last Quarter": "Prune, weed, divide perennials, prepare beds, and focus on roots and soil structure.",
				"Waning Crescent": "Rest the beds, repair tools, review the plan, and avoid major disturbance when possible."
			}[phaseName] || "Observe the site and align work with weather, soil moisture, and plant readiness.";

			if (!context?.hasPlan) return generic;

			const plantList = formatPlantingPlanNounList(context.plants);
			const planTail = [
				plantList ? `focus this around ${plantList}` : "",
				context.zone ? `zone ${context.zone}` : "",
				context.sunSign ? `${context.sunSign} mineral themes` : ""
			].filter(Boolean).join(" · ");

			if (!planTail) return `${generic} Apply this to the connected food forest plan.`;

			return `${generic} For the connected plan: ${planTail}.`;
		}

		function updatePlantingMoonPhaseReadout() {
			const readout = document.getElementById("plantingMoonPhaseReadout");
			if (!readout) return;
			Object.assign(readout.style, {
				position: "fixed",
				zIndex: "160",
				display: "grid",
				pointerEvents: "none",
				boxSizing: "border-box"
			});
			const bounds = typeof getPlantingViewportBounds === "function" ? getPlantingViewportBounds() : null;
			if (bounds) {
				const extraTop = (typeof EXTRA_SCREW_TOP_PAD !== "undefined") ? Number(EXTRA_SCREW_TOP_PAD) || 0 : 0;
				const lunarLayerRect = document.getElementById("plantingLunarEvents")?.getBoundingClientRect();
				const markerBottom = lunarLayerRect && Number.isFinite(lunarLayerRect.bottom)
					? lunarLayerRect.bottom
					: bounds.top + CANON.SCREW_TOP_PAD + extraTop + CANON.TIMELINE_Y + 112;
				const top = markerBottom + 16;
				const nowLeft = typeof getPlantingNowViewportX === "function"
					? getPlantingNowViewportX()
					: bounds.left + Math.max(14, bounds.width * getPlantingNowAnchorFraction());
				const rightLimit = Math.max(260, bounds.right - nowLeft - 14);
				const width = Math.min(PX_PER_YEAR, rightLimit);
				const left = nowLeft;
				document.documentElement.style.setProperty("--planting-moon-readout-left", `${Math.round(left)}px`);
				document.documentElement.style.setProperty("--planting-moon-readout-width", `${Math.round(width)}px`);
				document.documentElement.style.setProperty("--planting-moon-readout-top", `${Math.round(top)}px`);
				readout.style.left = `${Math.round(left)}px`;
				readout.style.top = `${Math.round(top)}px`;
				readout.style.width = `${Math.round(width)}px`;
			}

			const currentDate = getPlantingCurrentDate();
			const phaseDeg = getPlantingMoonPhaseDegrees(currentDate);
			const phaseReadout = getPlantingMoonPhaseReadout(phaseDeg);
			const zodiac = getPlantingMoonZodiacSign(currentDate);
			const context = getPlantingPlanContextForMoon();
			const glyphEl = document.getElementById("moonPhaseReadoutGlyph");
			const nameEl = document.getElementById("moonPhaseReadoutName");
			const metaEl = document.getElementById("moonPhaseReadoutMeta");
			const adviceEl = document.getElementById("moonPhaseReadoutAdvice");

			if (glyphEl) glyphEl.textContent = phaseReadout.glyph;
			if (nameEl) nameEl.textContent = `${phaseReadout.name} Moon in ${zodiac.name}`;
			if (metaEl) metaEl.textContent = formatPlantingMoonPhaseExact(phaseDeg);
			if (adviceEl) adviceEl.textContent = getPlantingMoonAdvice(phaseReadout.name, context);

			// Sun position + season
			const sunZodiac = getPlantingSunZodiacSign(currentDate);
			const season = getPlantingCurrentSeason(currentDate);
			const sunEl = document.getElementById("moonPhaseReadoutSun");
			if (sunEl) {
				sunEl.textContent = `☉ ${sunZodiac.glyph}\uFE0E ${Math.floor(sunZodiac.degreeInSign)}°${String(Math.floor((sunZodiac.degreeInSign % 1) * 60)).padStart(2,"0")}' · ${season.name}`;
			}

			// Next lunation + next eclipse
			const summary = getPlantingNextLunarSummary(currentDate);
			const lunationEl = document.getElementById("moonPhaseReadoutLunation");
			const eclipseEl = document.getElementById("moonPhaseReadoutEclipse");
			if (lunationEl && summary.lunation) {
				lunationEl.textContent = summary.lunation;
			}
			if (eclipseEl && summary.eclipse) {
				eclipseEl.textContent = summary.eclipse;
			}
			}

		function formatPlantingZodiacPosition(zodiac) {
			const degree = Math.floor(zodiac.degreeInSign);
			const minutes = Math.floor((zodiac.degreeInSign - degree) * 60);
			return `${zodiac.glyph}\uFE0E ${degree}°${String(minutes).padStart(2, "0")}'`;
		}

		function formatPlantingRelativeDays(fromDate, toDate) {
			const days = Math.max(0, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000));
			if (days === 0) return "today";
			if (days === 1) return "1d";
			return `${days}d`;
		}

		function getPlantingCurrentSeason(date) {
			const year = date.getUTCFullYear();
			const anchors = [
				...getSeasonalAnchorDates(year - 1),
				...getSeasonalAnchorDates(year),
				...getSeasonalAnchorDates(year + 1)
			].sort((a, b) => a.date - b.date);
			let current = anchors[0];
			anchors.forEach(anchor => {
				if (anchor.date <= date) current = anchor;
			});
			return {
				...current,
				name: current.label.split(" / ")[0]
			};
		}

		function getPlantingNextLunarSummary(date) {
			const events = getPlantingLunarEvents();
			const nextLunation = events.find(event => event.date > date) || null;
			const nextEclipse = events.find(event => event.date > date && event.isEclipse) || null;

			function describeEvent(event) {
				if (!event) return "None in range";
				const zodiac = getPlantingMoonZodiacSign(event.date);
				const phaseLabel = event.phase === "new" ? "New Moon" : "Full Moon";
				const relative = formatPlantingRelativeDays(date, event.date);
				return `Next lunation: ${phaseLabel} ${relative} ${formatPlantingZodiacPosition(zodiac)}`;
			}

			function describeEclipse(event) {
				if (!event) return "Next eclipse: None in range";
				const zodiac = getPlantingMoonZodiacSign(event.date);
				const type = event.phase === "new" ? "Solar" : "Lunar";
				const kind = event.eclipseKind ? ` ${String(event.eclipseKind).slice(0, 7)}` : "";
				const relative = formatPlantingRelativeDays(date, event.date);
				return `Next eclipse: ${type}${kind} ${relative} ${formatPlantingZodiacPosition(zodiac)}`;
			}

			return {
				lunation: describeEvent(nextLunation),
				eclipse: describeEclipse(nextEclipse)
			};
		}

		function renderPlantingNowLuminary() {
			let host = document.getElementById("plantingNowLuminary");
			if (!host) {
				host = document.createElement("div");
				host.id = "plantingNowLuminary";
				host.style.position = "fixed";
				host.style.left = "0";
				host.style.top = "0";
				host.style.width = "110px";
				host.style.height = "240px";
				host.style.marginLeft = "0";
				host.style.marginTop = "0";
				host.style.pointerEvents = "none";
				host.style.zIndex = "900";
				host.style.overflow = "visible";
				document.body.appendChild(host);
			}
			if (!host.querySelector("#plantingNowLunarOrbitPath") || !host.querySelector("#plantingNowMoonZodiacReadout") || !host.querySelector("#plantingNowOrbitVeilGroup")) {
				host.innerHTML = `
					<svg viewBox="0 0 110 240" width="110" height="240" aria-hidden="true" style="overflow:visible;">
						<defs>
							<filter id="plantingNowOrbitVeilBlur" x="-80%" y="-18%" width="260%" height="136%">
								<feGaussianBlur stdDeviation="8"></feGaussianBlur>
							</filter>
							<clipPath id="plantingNowScrewClip">
								<rect x="-130" y="20" width="260" height="180"></rect>
							</clipPath>
							<linearGradient id="plantingNowTextVeilGradient" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%" stop-color="rgba(0,0,0,0)"></stop>
								<stop offset="70%" stop-color="rgba(0,0,0,0.52)"></stop>
								<stop offset="100%" stop-color="rgba(0,0,0,0)"></stop>
							</linearGradient>
						</defs>
						<g id="plantingNowOrbitVeilGroup" clip-path="url(#plantingNowScrewClip)">
							<path id="plantingNowOrbitVeilFeather" fill="none" stroke="rgba(0,0,0,0.52)" stroke-width="66" stroke-linecap="round" stroke-linejoin="round" filter="url(#plantingNowOrbitVeilBlur)"></path>
							<path id="plantingNowOrbitVeilCore" fill="none" stroke="rgba(0,0,0,0.38)" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"></path>
						</g>
						<line id="plantingNowEcliptic" x1="45" x2="45" y1="20" y2="200" stroke="rgba(250,204,21,0.42)" stroke-width="1.1"></line>
						<path id="plantingNowLunarOrbitPath" fill="none" stroke="rgba(148,163,184,0.46)" stroke-width="1.2" stroke-dasharray="4 5"></path>
						<circle id="plantingNowSunGlow" cx="45" cy="200" r="18" fill="rgba(250,204,21,0.18)"></circle>
						<circle id="plantingNowSun" cx="45" cy="200" r="8" fill="#facc15" stroke="#fff7ad" stroke-width="1.2"></circle>
						<g id="plantingNowSolarEclipseCue" opacity="0">
							<circle id="plantingNowSolarEclipseAura" cx="45" cy="200" r="24" fill="rgba(249,115,22,0.16)"></circle>
							<circle id="plantingNowSolarEclipseRing" cx="45" cy="200" r="15" fill="none" stroke="#fdba74" stroke-width="2.4"></circle>
							<circle id="plantingNowSolarEclipseShadow" cx="45" cy="200" r="8.8" fill="#020617" stroke="#fed7aa" stroke-width="0.8"></circle>
						</g>
						<g id="plantingNowOrbitMarkers" font-size="13" font-weight="800" text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="rgba(0,0,0,0.9)" stroke-width="1.5" stroke-linejoin="round">
							<circle id="plantingNowNorthNode" r="3.2" fill="#38bdf8"></circle>
							<line id="plantingNowNorthNodeLeader" stroke="#bae6fd" stroke-width="0.8" stroke-dasharray="2 2" opacity="0"></line>
							<text id="plantingNowNorthNodeLabel" fill="#bae6fd">☊</text>
							<circle id="plantingNowSouthNode" r="3.2" fill="#ef4444"></circle>
						</g>
						<g id="plantingNowMoon">
							<circle id="plantingNowMoonDark" cx="45" cy="200" r="6.5" fill="#0f172a"></circle>
							<path id="plantingNowMoonLight" fill="#f8fafc"></path>
						</g>
						<circle id="plantingNowMoonRim" cx="45" cy="200" r="6.5" fill="none" stroke="#cbd5e1" stroke-width="1"></circle>
					</svg>
				`;
				host.querySelector("#plantingNowSun").style.filter = "drop-shadow(0 0 6px #f97316) drop-shadow(0 0 14px #facc15)";
				host.querySelector("#plantingNowSunGlow").style.filter = "drop-shadow(0 0 18px #f97316)";
			}
			updatePlantingNowLuminary();
		}

		function updatePlantingNowLuminary(options = {}) {
			const host = document.getElementById("plantingNowLuminary");
			if (!host) return;
			const updateDetails = options.updateDetails !== false;
			const bounds = typeof getPlantingViewportBounds === "function" ? getPlantingViewportBounds() : null;
			if (!bounds) return;
			const currentDate = getPlantingCurrentDate();
			const screenX = typeof getPlantingNowViewportX === "function"
				? getPlantingNowViewportX()
				: bounds.centerX;
			// Position luminary orbit at the sun's screen position on the screw (unchanged)
			const sunY = bounds.top + CANON.SCREW_TOP_PAD + 25 + CANON.TIMELINE_Y;
			const phaseDeg = getPlantingMoonPhaseDegrees(currentDate);
			const orbit = getPlantingLunarOrbitGeometry(currentDate, phaseDeg, 200);
			const moonX = orbit.moon.x;
			const moonY = orbit.moon.y;
			const refs = host.__plantingNowRefs || (host.__plantingNowRefs = {
				moon: host.querySelector("#plantingNowMoon"),
				moonDark: host.querySelector("#plantingNowMoonDark"),
				moonLight: host.querySelector("#plantingNowMoonLight"),
				moonRim: host.querySelector("#plantingNowMoonRim"),
				lunarOrbitPath: host.querySelector("#plantingNowLunarOrbitPath"),
				northNode: host.querySelector("#plantingNowNorthNode"),
				southNode: host.querySelector("#plantingNowSouthNode"),
				northNodeLabel: host.querySelector("#plantingNowNorthNodeLabel"),
				northNodeLeader: host.querySelector("#plantingNowNorthNodeLeader"),
				moonZodiacReadout: null,
				moonPhaseIconDark: null,
				moonPhaseIconLight: null,
				moonPhaseIconRim: null,
				moonPhaseName: null,
				moonZodiacGlyph: null,
				moonZodiacDegree: null,
				sunZodiacReadout: null,
				sunZodiacGlyph: null,
				sunZodiacDegree: null,
				sunSeasonLabel: null,
				nextLunationText: null,
				nextEclipseText: null,
				orbitVeilFeather: host.querySelector("#plantingNowOrbitVeilFeather"),
				orbitVeilCore: host.querySelector("#plantingNowOrbitVeilCore"),
				solarEclipseCue: host.querySelector("#plantingNowSolarEclipseCue"),
				solarEclipseAura: host.querySelector("#plantingNowSolarEclipseAura"),
				solarEclipseRing: host.querySelector("#plantingNowSolarEclipseRing"),
				solarEclipseShadow: host.querySelector("#plantingNowSolarEclipseShadow")
			});
			const {
				moon, moonDark, moonLight, moonRim, lunarOrbitPath,
				northNode, southNode, northNodeLabel, northNodeLeader,
				moonZodiacReadout, moonPhaseIconDark, moonPhaseIconLight,
				moonPhaseIconRim, moonPhaseName, moonZodiacGlyph, moonZodiacDegree,
				sunZodiacReadout, sunZodiacGlyph, sunZodiacDegree, sunSeasonLabel,
				nextLunationText, nextEclipseText, orbitVeilFeather, orbitVeilCore,
				solarEclipseCue, solarEclipseAura, solarEclipseRing, solarEclipseShadow
			} = refs;

			host.style.transform = `translate3d(${screenX - orbit.centerX}px, ${sunY - orbit.sunY}px, 0)`;
			const orbitPathD = getPlantingLunarOrbitPath(orbit);
			if (lunarOrbitPath) lunarOrbitPath.setAttribute("d", orbitPathD);
			[orbitVeilFeather, orbitVeilCore].forEach(path => {
				if (path) path.setAttribute("d", orbitPathD);
			});
			[
				{ el: northNode, point: orbit.northNode },
				{ el: southNode, point: orbit.southNode }
			].forEach(item => {
				if (!item.el) return;
				item.el.setAttribute("cx", item.point.x.toFixed(2));
				item.el.setAttribute("cy", item.point.y.toFixed(2));
			});
			if (northNodeLabel) {
				// Demo geometry: treat the midpoint of the compact lunar orbit as
				// Earth, then keep the north node glyph outward from it.
				const orbitCenter = {
					x: orbit.centerX,
					y: orbit.sunY - (orbit.orbitHeight / 2)
				};
				const dx = orbit.northNode.x - orbitCenter.x;
				const dy = orbit.northNode.y - orbitCenter.y;
				const length = Math.hypot(dx, dy) || 1;
				const ux = dx / length;
				const uy = dy / length;
				let labelX = orbit.northNode.x + (ux * 13);
				let labelY = orbit.northNode.y + (uy * 13);
				let needsLeader = false;
				const moonDistance = Math.hypot(labelX - moonX, labelY - moonY);
				if (moonDistance < 18) {
					const pushX = moonDistance > 0 ? (labelX - moonX) / moonDistance : ux;
					const pushY = moonDistance > 0 ? (labelY - moonY) / moonDistance : uy;
					const push = 18 - moonDistance;
					labelX += pushX * push;
					labelY += pushY * push;
					needsLeader = true;
				}
				northNodeLabel.setAttribute("x", labelX.toFixed(2));
				northNodeLabel.setAttribute("y", labelY.toFixed(2));
				northNodeLabel.removeAttribute("transform");
				if (northNodeLeader) {
					northNodeLeader.setAttribute("x1", orbit.northNode.x.toFixed(2));
					northNodeLeader.setAttribute("y1", orbit.northNode.y.toFixed(2));
					northNodeLeader.setAttribute("x2", labelX.toFixed(2));
					northNodeLeader.setAttribute("y2", labelY.toFixed(2));
					northNodeLeader.setAttribute("opacity", needsLeader ? "0.72" : "0");
				}
			}
			[northNode, southNode].forEach(node => {
				if (!node) return;
				node.setAttribute("r", orbit.eclipseAlignment ? "4.8" : "3.2");
				node.setAttribute("opacity", orbit.eclipseAlignment ? "1" : "0.82");
			});
			if (solarEclipseCue && solarEclipseAura && solarEclipseRing && solarEclipseShadow) {
				const isSolarEclipse = orbit.eclipseType === "solar";
				const strength = isSolarEclipse ? Math.max(0.35, orbit.eclipseStrength) : 0;
				solarEclipseCue.setAttribute("opacity", isSolarEclipse ? strength.toFixed(2) : "0");
				solarEclipseAura.setAttribute("r", (22 + (strength * 10)).toFixed(2));
				solarEclipseRing.setAttribute("r", (13 + (strength * 4)).toFixed(2));
				solarEclipseShadow.setAttribute("r", (8.2 + (strength * 1.4)).toFixed(2));
				solarEclipseCue.style.filter = isSolarEclipse ? "drop-shadow(0 0 9px #f97316) drop-shadow(0 0 18px #facc15)" : "";
			}

			if (moon && moonDark && moonLight && moonRim) {
				const radius = 6.5;
				const isLunarEclipse = orbit.eclipseType === "lunar";
				moonDark.setAttribute("cx", moonX.toFixed(2));
				moonDark.setAttribute("cy", moonY.toFixed(2));
				moonDark.setAttribute("fill", isLunarEclipse ? "#3f0a0a" : "#0f172a");
				moonLight.setAttribute("d", getPlantingMoonPhasePath(moonX, moonY, radius, phaseDeg));
				moonLight.setAttribute("transform", `rotate(90 ${moonX.toFixed(2)} ${moonY.toFixed(2)})`);
				moonLight.setAttribute("fill", isLunarEclipse ? "#b91c1c" : "#f8fafc");
				moonLight.style.filter = isLunarEclipse ? "drop-shadow(0 0 7px #ef4444)" : "";
				moonRim.setAttribute("cx", moonX.toFixed(2));
				moonRim.setAttribute("cy", moonY.toFixed(2));
				moonRim.setAttribute("stroke", orbit.eclipseAlignment ? (isLunarEclipse ? "#fca5a5" : "#f97316") : "#cbd5e1");
				moonRim.setAttribute("stroke-width", orbit.eclipseAlignment ? (isLunarEclipse ? "2.1" : "1.8") : "1");
				moonRim.style.filter = orbit.eclipseAlignment ? (isLunarEclipse ? "drop-shadow(0 0 8px #dc2626)" : "drop-shadow(0 0 7px #f97316)") : "";

				if (updateDetails && moonZodiacReadout && moonPhaseIconDark && moonPhaseIconLight && moonPhaseIconRim && moonPhaseName && moonZodiacGlyph && moonZodiacDegree) {
					const zodiac = getPlantingMoonZodiacSign(currentDate);
					const phaseReadout = getPlantingMoonPhaseReadout(phaseDeg);
					const iconX = -130;
					const iconY = 43;
					const iconRadius = 8.5;
					moonPhaseIconDark.setAttribute("fill", isLunarEclipse ? "#3f0a0a" : "#0f172a");
					moonPhaseIconLight.setAttribute("d", getPlantingMoonPhasePath(iconX, iconY, iconRadius, phaseDeg));
					moonPhaseIconLight.removeAttribute("transform");
					moonPhaseIconLight.setAttribute("fill", isLunarEclipse ? "#b91c1c" : "#f8fafc");
					moonPhaseIconRim.setAttribute("stroke", isLunarEclipse ? "#fca5a5" : "#cbd5e1");
					moonPhaseName.textContent = phaseReadout.name;
					moonZodiacGlyph.textContent = `${zodiac.glyph}\uFE0E`;
					moonZodiacGlyph.setAttribute("fill", zodiac.color);
					const degree = Math.floor(zodiac.degreeInSign);
					const minutes = Math.floor((zodiac.degreeInSign - degree) * 60);
					moonZodiacDegree.textContent = `${degree}°${String(minutes).padStart(2, "0")}'`;
					moonZodiacReadout.style.filter = orbit.eclipseAlignment ? "drop-shadow(0 0 5px rgba(249,115,22,0.72))" : "";
					const title = moonZodiacReadout.querySelector("title") || document.createElementNS("http://www.w3.org/2000/svg", "title");
					title.textContent = `${phaseReadout.name} Moon in ${zodiac.name}`;
					if (!title.parentNode) moonZodiacReadout.appendChild(title);
				}
			}

			if (updateDetails && sunZodiacReadout && sunZodiacGlyph && sunZodiacDegree) {
				const sunZodiac = getPlantingSunZodiacSign(currentDate);
				const currentSeason = getPlantingCurrentSeason(currentDate);
				const degree = Math.floor(sunZodiac.degreeInSign);
				const minutes = Math.floor((sunZodiac.degreeInSign - degree) * 60);
				sunZodiacGlyph.textContent = `${sunZodiac.glyph}\uFE0E`;
				sunZodiacGlyph.setAttribute("fill", sunZodiac.color);
				sunZodiacDegree.textContent = `${degree}°${String(minutes).padStart(2, "0")}'`;
				if (sunSeasonLabel) {
					sunSeasonLabel.textContent = currentSeason.name;
					sunSeasonLabel.setAttribute("fill", currentSeason.color);
				}
				const title = sunZodiacReadout.querySelector("title") || document.createElementNS("http://www.w3.org/2000/svg", "title");
				title.textContent = `${currentSeason.name}; Sun in ${sunZodiac.name}`;
				if (!title.parentNode) sunZodiacReadout.appendChild(title);
			}

			if (updateDetails && nextLunationText && nextEclipseText) {
				const nextSummary = getPlantingNextLunarSummary(currentDate);
				nextLunationText.textContent = nextSummary.lunation;
				nextEclipseText.textContent = nextSummary.eclipse;
			}
		}

		let lastPlantingMoonDetailFrame = 0;
		window.updatePlantingNowLuminaryFrame = function updatePlantingNowLuminaryFrame(frameTime) {
			const now = Number.isFinite(frameTime) ? frameTime : performance.now();
			const updateDetails = !lastPlantingMoonDetailFrame || (now - lastPlantingMoonDetailFrame) >= 80;
			updatePlantingNowLuminary({ updateDetails });
			if (updateDetails) {
				updatePlantingMoonPhaseReadout();
				lastPlantingMoonDetailFrame = now;
			}
		};

		if (!window.__plantingNowLuminaryTimer) {
			const tickPlantingNowLuminary = () => {
				if (typeof window.updatePlantingNowLuminaryFrame === "function") {
					window.updatePlantingNowLuminaryFrame(performance.now());
				}
				const delay = document.hidden ? 5000 : 1000;
				window.__plantingNowLuminaryTimer = window.setTimeout(tickPlantingNowLuminary, delay);
			};
			tickPlantingNowLuminary();
		}

		function renderAnnualSeasonalWave() {

			saeculumLine.innerHTML = "";

			const A = CANON.SINE_AMPLITUDE;
			const Y0 = CANON.TIMELINE_Y + A;
			const STEP_DAYS = 5;
			const years = getVisibleYearsForPlantingScale();
			const winterSolsticeReferenceYear = dateToPlantingYear(new Date(Date.UTC(2020, 11, 21, 12, 0, 0)));

				function makeWavePath(startDate, endDate) {
				let d = "";
				for (let t = startDate.getTime(), i = 0; t <= endDate.getTime(); t += STEP_DAYS * 86400000, i++) {
					const date = new Date(t);
					const yearValue = dateToPlantingYear(date);
					const x = plantingYearToX(yearValue);
					const phase = ((yearValue - winterSolsticeReferenceYear) * Math.PI * 2) - (Math.PI / 2);
					const y = Y0 - Math.sin(phase) * A;
					d += `${i === 0 ? "M" : "L"}${x},${y} `;
				}
				return d;
			}

			for (let year = years.start; year <= years.end; year++) {
				const anchors = getSeasonalAnchorDates(year);
				const nextSpring = getSeasonalAnchorDates(year + 1)[0].date;
				const seasonalSegments = anchors.map((anchor, index) => ({
					...anchor,
					endDate: index < anchors.length - 1 ? anchors[index + 1].date : nextSpring
				}));

				seasonalSegments.forEach(season => {
					const path = createSvgEl("path", {
						d: makeWavePath(season.date, season.endDate),
						fill: "none",
						stroke: season.color,
						"stroke-width": "2.2",
						"stroke-linecap": "round",
						opacity: "0.92"
					});
					path.style.filter =
						`drop-shadow(0 0 4px ${season.color}) drop-shadow(0 0 12px ${season.color}) drop-shadow(0 0 22px ${season.color})`;
					saeculumLine.appendChild(path);

					const x = dateToPlantingX(season.date);
					if (x < MINX || x > MAXX) return;

					const anchorLine = createSvgEl("line", {
						x1: x,
						x2: x,
						y1: CANON.TIMELINE_Y - 4,
						y2: CANON.TIMELINE_Y + 23,
						stroke: season.color,
						"stroke-width": "1.1",
						opacity: "0.74"
					});
					anchorLine.style.filter = `drop-shadow(0 0 7px ${season.color})`;
					saeculumLine.appendChild(anchorLine);

				});
			}

			renderPlantingLunarEventLayer();
			renderPlantingNowLuminary();
			updatePlantingMoonPhaseReadout();
		}

			/* ---------------------------------------------------------
			   09.5.3 — GLOW SYSTEM (OPTIONAL, COLOR‑AWARE)
			   --------------------------------------------------------- */
			function buildSaeculumLighting() {
				if (_scale === "planting") return;

				const svgNS = "http://www.w3.org/2000/svg";
				const svg = document.getElementById("screwSVG");

				let defs = svg.querySelector("defs");
				if (!defs) {
					defs = document.createElementNS(svgNS,"defs");
					svg.insertBefore(defs, svg.firstChild);
				}

				const old = defs.querySelector("#saeculum-glow");
				if (old) old.remove();

				const filter = document.createElementNS(svgNS,"filter");
				filter.setAttribute("id","saeculum-glow");

				const drop = document.createElementNS(svgNS,"feDropShadow");
				drop.setAttribute("dx","0");
				drop.setAttribute("dy","0");
				drop.setAttribute("stdDeviation","10");
				drop.setAttribute("flood-color","#ffffff");
				drop.setAttribute("flood-opacity","0.5");

				filter.appendChild(drop);
				defs.appendChild(filter);
				saeculumGlowNode = drop;

				// Apply to all wave segments
				saeculumLine.querySelectorAll("path").forEach(p=>{
					p.setAttribute("filter","url(#saeculum-glow)");
				});
			}

			/* ---------------------------------------------------------
			   09.5.4 — UPDATE GLOW COLOR FROM CURRENT PHASE
			   --------------------------------------------------------- */
			function updateSaeculumGlow() {
				positionPlantingCycleHud();
				if (!saeculumGlowNode) return;

				const year = getYearForUI(scrollX);
				const phase = findArchetypePhase(year);
				const color = SAECULUM_PHASE_COLORS[phase] || "#ffffff";

				saeculumGlowNode.setAttribute("flood-color", color);
			}
			window.updateSaeculumGlow = updateSaeculumGlow;
		
			/* =========================================================
				SECTION 09.6 — CONJUNCTION CYCLE BAND (SWAPPABLE)
				---------------------------------------------------------
				Lives ABOVE the screw.
				Uses the Saturn–Jupiter baseline time mapping (dateToScrewX)
				so the generational screw scale never changes.
				========================================================= */

			function buildConjunctionCycleBand() {
				if (_scale === "planting") {
					renderPlantingCycleRibbons();
					return;
				}

				const baselineGroup = document.getElementById("elementalCycle");
				const overlayGroup  = document.getElementById("overlayCycle");
				if (!baselineGroup) return;

				// -----------------------------
				// HUD housekeeping (screen-fixed labels)
				// -----------------------------
				let hud = document.getElementById("conjLaneHud");
				if (!hud) {
					hud = document.createElement("div");
					hud.id = "conjLaneHud";
					hud.style.position = "fixed";
					hud.style.left = "0";
					hud.style.top = "0";
					hud.style.width = "0";
					hud.style.height = "0";
					hud.style.pointerEvents = "none";
					hud.style.zIndex = "5"; // above elemental bands (z=3), below astro-wheel (z=10)
					document.body.appendChild(hud);
				}
				// mark existing as unused, we’ll keep only the ones we touch this pass
				Array.from(hud.children).forEach(ch => { ch.dataset.keep = "0"; });

				// Clear both SVG band groups (prevents “old cycle sticks around”)
				baselineGroup.innerHTML = "";
				if (overlayGroup) overlayGroup.innerHTML = "";

				const svg = document.getElementById("screwSVG");
				if (!svg) return;

				// Ensure defs exists (shadow gradient uses it)
				let defs = svg.querySelector("defs");
				if (!defs) {
					defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
					svg.insertBefore(defs, svg.firstChild);
				}

				const H   = ELEMENTAL.HEIGHT;
				const GAP = 6;

				// Bands live ABOVE the screw
				const Y_BASE = -H;
				const Y_OVER = -(H * 2 + GAP);

				const OP_BASE = 0.18;
				const OP_OVER = 0.26;

				// -----------------------------
				// helpers
				// -----------------------------
				const normalizeSign = (raw) => {
					const s = (raw || "").toString().trim().toLowerCase();
					if (!s) return "";
					const map = {
						ari: "aries", aries: "aries",
						tau: "taurus", taurus: "taurus",
						gem: "gemini", gemini: "gemini",
						can: "cancer", cancer: "cancer",
						leo: "leo",
						vir: "virgo", virgo: "virgo",
						lib: "libra", libra: "libra",
						sco: "scorpio", scorpio: "scorpio",
						sag: "sagittarius", sagi: "sagittarius", sagittarius: "sagittarius",
						cap: "capricorn", capricorn: "capricorn",
						aqu: "aquarius", aqua: "aquarius", aquarius: "aquarius",
						pis: "pisces", pisc: "pisces", pisces: "pisces"
					};
					return map[s] || s;
				};

				function getEventsForPair(p1, p2) {
					const map = window.CONJUNCTION_DATASETS || {};
					const ds = map[`${p1}|${p2}`] || map[`${p2}|${p1}`];
					if (ds && Array.isArray(ds.events) && ds.events.length > 1) return ds.events;

					// legacy fallback for Sat–Jup
					if (
						(p1 === "Saturn" && p2 === "Jupiter") ||
						(p1 === "Jupiter" && p2 === "Saturn")
					) {
						return Array.isArray(window.CONJUNCTION_DATA) ? window.CONJUNCTION_DATA : null;
					}
					return null;
				}

				// Remove exact duplicate rows (your Neptune/Pluto data has repeats)
				function dedupeEvents(events) {
					const out = [];
					const seen = new Set();
					for (const e of (events || [])) {
						if (!e || !e.t) continue;
						const sign = normalizeSign(e.sign || "");
						const key = `${e.t}|${sign}`;
						if (seen.has(key)) continue;
						seen.add(key);
						out.push({ ...e, sign });
					}
					return out;
				}

				function setHudLabelForLane(Y, p1Label, p2Label) {
					if (!p1Label || !p2Label) return;

					const GLYPH = {
						Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
						Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂"
					};

					// Approximate cycle durations in years
					const CYCLE_DURATION = {
						"Saturn|Jupiter": "~20",
						"Jupiter|Saturn": "~20",
						"Saturn|Uranus": "~45",
						"Uranus|Saturn": "~45",
						"Saturn|Neptune": "~36",
						"Neptune|Saturn": "~36",
						"Saturn|Pluto": "~33",
						"Pluto|Saturn": "~33",
						"Uranus|Neptune": "~172",
						"Neptune|Uranus": "~172",
						"Uranus|Pluto": "~127",
						"Pluto|Uranus": "~127",
						"Neptune|Pluto": "~492",
						"Pluto|Neptune": "~492",
						"Jupiter|Uranus": "~14",
						"Uranus|Jupiter": "~14",
						"Jupiter|Neptune": "~13",
						"Neptune|Jupiter": "~13",
						"Jupiter|Pluto": "~12",
						"Pluto|Jupiter": "~12",
						"default": ""
					};

					const g1 = GLYPH[p1Label] || p1Label;
					const g2 = GLYPH[p2Label] || p2Label;

					const isOverlay = (Y <= -(H * 1.5));
					const laneIdx = isOverlay ? 1 : 0;
					const labelId = `conjHud_lane${laneIdx}`;

					let el = document.getElementById(labelId);
					if (!el) {
						el = document.createElement("div");
						el.id = labelId;
						el.style.position = "fixed";
						el.style.whiteSpace = "nowrap";
						el.style.pointerEvents = "none";
						el.style.fontFamily = "Segoe UI Symbol, Noto Sans Symbols2, Symbola, system-ui, sans-serif";
						el.style.fontSize = "16px";
						el.style.fontWeight = "900";
						el.style.color = "#fff";
						el.style.textShadow = "0 0 3px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.85)";
						hud.appendChild(el);
					}

					el.dataset.keep = "1";

					// lock to left edge of the SVG on screen
					const svgRect = svg.getBoundingClientRect();
					el.style.left = `${svgRect.left + 14}px`;

					// lock to lane vertical position (no wobble)
					const BASELINE_TOP_PAD = 22; // keep your tuned value
					const baselineCenterY = svgRect.top + BASELINE_TOP_PAD + (H / 2);
					const laneCenterY = baselineCenterY + (isOverlay ? -(H + GAP) : 0);
					el.style.top = `${laneCenterY - 8}px`;

					const g1t = String(g1).includes("\uFE0E") ? String(g1) : (String(g1) + "\uFE0E");
					const g2t = String(g2).includes("\uFE0E") ? String(g2) : (String(g2) + "\uFE0E");
					
					// Get cycle duration
					const cycleKey = `${p1Label}|${p2Label}`;
					const duration = CYCLE_DURATION[cycleKey] || CYCLE_DURATION["default"];
					
					// Build content with smaller, dimmer duration text
					if (duration) {
						el.innerHTML = `${g1t} ☌ ${g2t}<span style="font-size: 80%; opacity: 0.85; margin-left: 4px;">${duration} yrs</span>`;
					} else {
						el.textContent = `${g1t} ☌ ${g2t}`;
					}
				}

				// -----------------------------
				// band renderer
				// -----------------------------
				function drawBand(groupEl, events, Y, bandOpacity, p1Label, p2Label) {
				if (!groupEl || !events || events.length < 2 || typeof dateToScrewX !== "function") return;

				// Clear ONLY this band so old cycles don't stick around
				groupEl.innerHTML = "";

				// Build layers inside this band group
				const rectLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
				rectLayer.setAttribute("class", "cycleRectLayer");

				const glyphLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
				glyphLayer.setAttribute("class", "cycleGlyphLayer");

				groupEl.appendChild(rectLayer);
				groupEl.appendChild(glyphLayer);

				// Lane check: baseline = 0, overlay = 1
				const isOverlay = (Y <= -(H * 1.5));
				const laneIdx = isOverlay ? 1 : 0;

				

				// --- Safe viewport values (works even early-load) ---
				const haveViewport = Number.isFinite(MINX) && Number.isFinite(MAXX) && Number.isFinite(PX_PER_MAJOR);
				const safeMinX = haveViewport ? MINX : -1e12;
				const safeMaxX = haveViewport ? MAXX :  1e12;
				const safePad  = haveViewport ? PX_PER_MAJOR : 0;

				// --- BC-safe timestamp parser (handles "-0083-..." etc) ---
				function parseIsoZ(t) {
					// Accepts "YYYY-MM-DDTHH:MM:SSZ" or "-YYYY-..." (any year length)
					const m = String(t || "").match(/^([+-]?\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z$/);
					if (!m) return new Date(NaN);

					const year = parseInt(m[1], 10);
					const mon  = parseInt(m[2], 10) - 1; // 0-based
					const day  = parseInt(m[3], 10);
					const hh   = parseInt(m[4], 10);
					const mm   = parseInt(m[5], 10);
					const ss   = parseInt(m[6] || "0", 10);

					// Build UTC date reliably (works for negative years too)
					const d = new Date(Date.UTC(0, 0, 1, hh, mm, ss, 0));
					d.setUTCFullYear(year, mon, day);
					return d;
				}

				function placeGlyph(signKey, xMid, rgb) {
					if (typeof SIGN_GLYPHS === "undefined" || !signKey || !SIGN_GLYPHS[signKey]) return;

					let glyph = SIGN_GLYPHS[signKey];
					if (!glyph.includes("\uFE0E")) glyph += "\uFE0E";

					const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
					t.setAttribute("x", xMid);
					// Capricorn sits a touch low; bump it up 2 px, leave others alone
					const capBump = (signKey === "capricorn" || signKey === "cap") ? -2 : 0;
					t.setAttribute("y", Y + (H / 2) + capBump); // true vertical center
					t.setAttribute("text-anchor", "middle");
					t.setAttribute("dominant-baseline", "central");
					t.setAttribute("font-size", "13");
					t.setAttribute("font-weight", "800");
					t.setAttribute("fill", `rgb(${rgb})`);
					t.setAttribute("opacity", "0.95");
					t.setAttribute("paint-order", "stroke");
					t.setAttribute("stroke", "rgba(0,0,0,0.65)");
					t.setAttribute("stroke-width", "1");
					t.setAttribute("pointer-events", "none");
					t.setAttribute("font-family", "Segoe UI Symbol, Noto Sans Symbols2, Symbola, system-ui, sans-serif");
					t.textContent = glyph;

					glyphLayer.appendChild(t);
				}

				// Baseline spacing guard (so glyphs don't pile up)
				let lastGlyphX = -1e12;
				const MIN_GLYPH_GAP_PX = 6;

				// Overlay run-merging (removes retrograde duplicate glyphs)
				let runSign = "";
				let runRgb = "";
				let runStartX = null;
				let runEndX = null;

				function flushRun() {
					if (!runSign || runStartX === null || runEndX === null) return;

					// midpoint of the VISIBLE portion of the run
					const v0 = Math.max(runStartX, safeMinX);
					const v1 = Math.min(runEndX,   safeMaxX);
					const mid = (v0 + v1) / 2;

					if (Number.isFinite(mid)) placeGlyph(runSign, mid, runRgb);
				}

				for (let i = 0; i < events.length - 1; i++) {
					const e0 = events[i];
					const e1 = events[i + 1];
					if (!e0?.t || !e1?.t) continue;

					const d0 = parseIsoZ(e0.t);
					const d1 = parseIsoZ(e1.t);
					if (!Number.isFinite(d0.getTime()) || !Number.isFinite(d1.getTime())) continue;

					const x0 = dateToScrewX(d0);
					const x1 = dateToScrewX(d1);
					const w  = x1 - x0;
					if (!Number.isFinite(w) || w <= 0) continue;

					// Only cull by viewport if viewport is valid
					if (haveViewport) {
					if (x1 < safeMinX - safePad || x0 > safeMaxX + safePad) continue;
					}

					const signKey = normalizeSign(e0.sign || "");

					const element = (
					e0.element ||
					(typeof ELEMENT_SIGNS !== "undefined" && signKey ? (ELEMENT_SIGNS[signKey] || "") : "")
					).toString().toLowerCase();

					const rgb =
					(ELEMENTAL && ELEMENTAL.COLORS && element && ELEMENTAL.COLORS[element])
						? ELEMENTAL.COLORS[element]
						: "255,255,255";

					// Draw the block
					const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
					rect.setAttribute("x", x0);
					rect.setAttribute("y", Y);
					rect.setAttribute("width", w);
					rect.setAttribute("height", H);
					rect.setAttribute("fill", `rgb(${rgb})`);
					rect.setAttribute("opacity", bandOpacity);
					rectLayer.appendChild(rect);

					// White boundary line
					rect.setAttribute("shape-rendering", "crispEdges");
					rect.setAttribute("stroke", "#ffffff");
					rect.setAttribute("stroke-width", "1");

					// --- Midpoint based on what’s actually visible on screen ---
					const vis0 = Math.max(x0, safeMinX);
					const vis1 = Math.min(x1, safeMaxX);
					const xMidVisible = (vis0 + vis1) / 2;

					// Glyphs — merge same-sign runs into one glyph per block
					if (!runSign) {
						runSign = signKey;
						runRgb = rgb;
						runStartX = x0;
						runEndX = x1;
					} else if (signKey === runSign) {
						runEndX = x1;
					} else {
						flushRun();
						runSign = signKey;
						runRgb = rgb;
						runStartX = x0;
						runEndX = x1;
					}
				}

				// Finish run
				flushRun();

				// NOTE: your band-label HUD code can stay exactly where it already is.
				// This function doesn’t remove or alter it.
				}

				// -----------------------------
				// baseline shadow gradient (where it meets the screw)
				// -----------------------------
				let grad = document.getElementById("elementBandShade");
				if (!grad) {
					grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
					grad.setAttribute("id", "elementBandShade");
					grad.setAttribute("gradientUnits", "userSpaceOnUse");
					grad.setAttribute("x1", "0");
					grad.setAttribute("x2", "0");

					const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
					stop1.setAttribute("offset", "0%");
					stop1.setAttribute("stop-color", "#000");
					stop1.setAttribute("stop-opacity", "0.55");

					const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
					stop2.setAttribute("offset", "100%");
					stop2.setAttribute("stop-color", "#000");
					stop2.setAttribute("stop-opacity", "0");

					grad.appendChild(stop1);
					grad.appendChild(stop2);
					defs.appendChild(grad);
				}

				// -------------------------
				// 1) BASELINE: Saturn–Jupiter always
				// -------------------------
				const baseEvents = getEventsForPair("Saturn", "Jupiter");
				if (baseEvents) {
					drawBand(baselineGroup, baseEvents, Y_BASE, OP_BASE);
					setHudLabelForLane(Y_BASE, "Saturn", "Jupiter");
				}

				// shadow strip
				const oldShadow = document.getElementById("elementBandShadowRect");
				if (oldShadow) oldShadow.remove();

				if (typeof bands !== "undefined" && bands && Number.isFinite(MINX) && Number.isFinite(MAXX) && Number.isFinite(PX_PER_MAJOR)) {
					const shadeTop = Y_BASE + H;
					const shadeBottom = shadeTop + 14;
					grad.setAttribute("y1", String(shadeTop));
					grad.setAttribute("y2", String(shadeBottom));

					const shadow = document.createElementNS("http://www.w3.org/2000/svg", "rect");
					shadow.setAttribute("id", "elementBandShadowRect");
					shadow.setAttribute("x", MINX - PX_PER_MAJOR);
					shadow.setAttribute("y", String(Y_BASE + H));
					shadow.setAttribute("width", String((MAXX - MINX) + PX_PER_MAJOR * 2));
					shadow.setAttribute("height", "14");
					shadow.setAttribute("fill", "url(#elementBandShade)");
					shadow.setAttribute("opacity", "0.9");
					shadow.setAttribute("pointer-events", "none");
					bands.appendChild(shadow);
				}

				// -------------------------
				// 2) OVERLAY: selected pair (unless Saturn–Jupiter)
				// -------------------------
				if (overlayGroup) {
					const sel = (window.CycleSelection && window.CycleSelection.p1 && window.CycleSelection.p2)
						? window.CycleSelection
						: { p1: "Saturn", p2: "Jupiter" };

					const selKey = `${sel.p1}|${sel.p2}`;
					if (selKey !== "Saturn|Jupiter" && selKey !== "Jupiter|Saturn") {
						const overlayEvents = getEventsForPair(sel.p1, sel.p2);
						if (overlayEvents) {
							drawBand(overlayGroup, overlayEvents, Y_OVER, OP_OVER);
							setHudLabelForLane(Y_OVER, sel.p1, sel.p2);
						}
					}
				}

				// Cleanup unused HUD labels (prevents “ghost” labels)
				Array.from(hud.children).forEach(ch => {
					if (ch.dataset.keep !== "1") ch.remove();
				});
			}

			// Back-compat: older code paths still call this
			function buildElementalCycle() {
				if (window.__zyBuildingCycleBand) return;
				window.__zyBuildingCycleBand = true;
				try {
					return buildConjunctionCycleBand();
				} finally {
					window.__zyBuildingCycleBand = false;
				}
			}

		/* =========================================================
	   SECTION 09.7 — STATIC LABEL STRUCTURE (NON-TEMPORAL)
	   ========================================================= */

		function buildLabelTicks() {
		  const g = document.getElementById("labelStructure");
		  if (!g) return;
		  g.innerHTML = "";

		  const ROW_H = CANON.ROW_HEIGHT;
		  for (let i = 0; i <= 4; i++) {
			const y = i * ROW_H;

			const major = document.createElementNS(
			  "http://www.w3.org/2000/svg",
			  "line"
			);
			major.setAttribute("x1", 0);
			major.setAttribute("x2", 14);
			major.setAttribute("y1", y);
			major.setAttribute("y2", y);
			major.setAttribute("stroke", "white");
			major.setAttribute("stroke-width", "1.5");
			major.setAttribute("opacity", "0.8");
			g.appendChild(major);

			if (i < 4) {
			  const minor = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"line"
			  );
			  minor.setAttribute("x1", 0);
			  minor.setAttribute("x2", 8);
			  minor.setAttribute("y1", y + ROW_H / 2);
			  minor.setAttribute("y2", y + ROW_H / 2);
			  minor.setAttribute("stroke", "white");
			  minor.setAttribute("stroke-width", "1");
			  minor.setAttribute("opacity", "0.45");
			  g.appendChild(minor);
			}
		  }
		}


	function buildLifeCycleOverlay() {
		if (!lifeCycleOverlay) return;
		lifeCycleOverlay.innerHTML = "";

		const labels = ["emergence / plant","growth / tend","harvest / protect","dormancy / plan"];
		for (let i = 0; i < 4; i++) {
			const y = i * CANON.ROW_HEIGHT;

			const line = document.createElementNS(
				"http://www.w3.org/2000/svg","line"
			);
			line.setAttribute("x1",0);
			line.setAttribute("x2",CANON.LABEL_WIDTH);
			line.setAttribute("y1",y);
			line.setAttribute("y2",y);
			line.setAttribute("stroke","white");
			line.setAttribute("stroke-width","1");
			line.setAttribute("opacity","0.35");
			lifeCycleOverlay.appendChild(line);

			const text = document.createElementNS(
				"http://www.w3.org/2000/svg","text"
			);
			text.setAttribute("x",42);
			text.setAttribute("y",y + 38);
			text.setAttribute("font-size","10");
			text.setAttribute("fill","rgba(255,255,255,0.78)");
			text.setAttribute("opacity","0.9");
			text.setAttribute("text-anchor","start");
			text.textContent = labels[i];
			lifeCycleOverlay.appendChild(text);
		}
	}

	function buildDiagonalIndex() {
		const g = document.getElementById("diagonalIndex");
		if (!g) return;
		g.innerHTML = "";

		const W = CANON.LABEL_WIDTH;
		const H = CANON.SCREW_HEIGHT;

		const diag = document.createElementNS(
			"http://www.w3.org/2000/svg","line"
		);
		diag.setAttribute("x1",8);
		diag.setAttribute("y1",H - 8);
		diag.setAttribute("x2",W - 8);
		diag.setAttribute("y2",8);
		diag.setAttribute("stroke","white");
		diag.setAttribute("stroke-width","1");
		diag.setAttribute("opacity","0.35");
		g.appendChild(diag);

		const phases = [
			{ glyph: "\u2648\uFE0E", label: "Aries", color: PLANTING_ROW_COLORS.prophet },
			{ glyph: "\u264B\uFE0E", label: "Cancer", color: PLANTING_ROW_COLORS.nomad },
			{ glyph: "\u264E\uFE0E", label: "Libra", color: PLANTING_ROW_COLORS.hero },
			{ glyph: "\u2651\uFE0E", label: "Capricorn", color: PLANTING_ROW_COLORS.artist }
		];
		for (let i = 0; i < 4; i++) {
			const t = (i + 0.5)/4;
			const x = 8 + t*(W - 16);
			const y = 8 + t*(H - 16);
			const phase = phases[i];

			const label = document.createElementNS(
				"http://www.w3.org/2000/svg","text"
			);
			label.setAttribute("x",x+4);
			label.setAttribute("y",y+4);
			label.setAttribute("font-size","10");
			label.setAttribute("fill","white");

			const glyph = document.createElementNS(
				"http://www.w3.org/2000/svg","tspan"
			);
			glyph.setAttribute("fill",phase.color);
			glyph.textContent = phase.glyph;
			label.appendChild(glyph);

			const name = document.createElementNS(
				"http://www.w3.org/2000/svg","tspan"
			);
			name.setAttribute("dx","4");
			name.setAttribute("opacity","0.68");
			name.textContent = phase.label;
			label.appendChild(name);

			g.appendChild(label);
		}
	}

	function archetypeToY(archetype) {
		const map = {
			Prophet: 0,
			Nomad:   1,
			Hero:    2,
			Artist:  3
		};
		const idx = map[archetype];
		return CANON.TIMELINE_Y - (idx + 1) * CANON.ROW_HEIGHT;
	}


	function buildDiagonalLabels() {
		if (!diagLabels) return;
		diagLabels.innerHTML = "";
	}
/* =========================================================
	   SECTION 09.9 — STATIC INITIALIZATION (CALLED BY UI)
	   ---------------------------------------------------------
	   In the monolith, this ran inline.
	   In the split build, UI owns DOM references, so UI triggers
	   this one-time construction after wiring the scene.
	   ========================================================= */

	function initScrewRenderer() {
		buildScrew();
		// buildPresidentThumbnails(); // Removed - now using fixed HTML element
		buildConjunctionCycleBand();
		buildSaeculumWave();
		buildSaeculumLighting(0.3);
		buildLabelTicks();
		buildLifeCycleOverlay();
		buildDiagonalIndex();
		buildDiagonalLabels();
		document.documentElement.style.setProperty(
			"--screw-svg-height",
			`${CANON.SCREW_TOTAL_HEIGHT}px`
		);
	}

		// Rebuild the cycle band when the selector changes
	if (!window.__zyCycleBandHooked) {
		window.__zyCycleBandHooked = true;
		window.addEventListener("zy:cyclechange", () => {
			try { buildConjunctionCycleBand(); }
			catch (e) { console.warn("[cycle] buildConjunctionCycleBand failed", e); }
		});
	}

	// =========================================================
	// PRESIDENT THUMBNAILS
	// =========================================================
	function yearToScrewX(year) {
		return SCREW_EPOCH_X + (year - 2020) * PX_PER_YEAR;
	}
	
	// Expose for external use (events-renderer.js)
	window.yearToScrewX = yearToScrewX;
	
	// Signal that screw is ready
	window.screwReady = true;

	function buildPresidentThumbnails() {
		const presidentsGroup = document.getElementById("presidents");
		if (!presidentsGroup) return;
		presidentsGroup.innerHTML = "";

		// Trump - 2025 to 2029, positioned at year 2024, at bottom of screw
		const trumpX = yearToScrewX(2024);
		const thumbY = CANON.SCREW_TOTAL_HEIGHT - 72; // Position at bottom, fully visible
		console.log("[Thumb] SCREW_TOTAL_HEIGHT:", CANON.SCREW_TOTAL_HEIGHT, "thumbY:", thumbY);
		
		const trumpImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
		trumpImage.setAttribute("x", trumpX - 30);
		trumpImage.setAttribute("y", thumbY); // Bottom of screw, image fully visible
		trumpImage.setAttribute("width", 60);
		trumpImage.setAttribute("height", 72);
		trumpImage.setAttribute("href", "/images/trump-portrait.jpg");
		trumpImage.setAttribute("class", "president-thumb");
		trumpImage.setAttribute("data-president", "Trump");
		trumpImage.setAttribute("data-term", "2025-2029");
		trumpImage.style.cursor = "pointer";
		
		// Hover effects — expand up and right, anchored at left edge and bottom
		const BOTTOM_ANCHOR = CANON.SCREW_TOTAL_HEIGHT - 18; // bottom stays fixed
		const LEFT_ANCHOR = trumpX - 30;                      // left edge stays fixed
		const NORMAL_W = 60, NORMAL_H = 72;
		const HOVER_W  = 90, HOVER_H  = 108;
		const HOVER_Y  = BOTTOM_ANCHOR - HOVER_H;             // = CANON.SCREW_TOTAL_HEIGHT - 126
		trumpImage.addEventListener("mouseenter", () => {
			trumpImage.setAttribute("width",  HOVER_W);
			trumpImage.setAttribute("height", HOVER_H);
			trumpImage.setAttribute("x",      LEFT_ANCHOR);
			trumpImage.setAttribute("y",      HOVER_Y);
		});
		trumpImage.addEventListener("mouseleave", () => {
			trumpImage.setAttribute("width",  NORMAL_W);
			trumpImage.setAttribute("height", NORMAL_H);
			trumpImage.setAttribute("x",      LEFT_ANCHOR);
			trumpImage.setAttribute("y",      BOTTOM_ANCHOR - NORMAL_H);
		});
		
		presidentsGroup.appendChild(trumpImage);
	}

	// Expose to window
	window.buildPresidentThumbnails = buildPresidentThumbnails;
