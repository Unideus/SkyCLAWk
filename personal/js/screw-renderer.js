	/* screw-renderer.js — builds the timeline SVG screw */
	/* =========================================================
		   SECTION 09 — BUILD THE SCREW (STATIC GEOMETRY)
		   ---------------------------------------------------------
		   Constructs ALL immutable timeline geometry.
		   Must be re-runnable and side-effect free.
		   ========================================================= */

		function buildScrew() {

	// This is the Personal split renderer: always use personal screw geometry.
	const _isPersonal = true;
	const BAND_OFFSET = PX_PER_MAJOR * 0.64;
			
			const svg = document.getElementById("screwSVG");


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

    // AGE BAND: horizontal line from start->end with faded ends
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
			// 09.2 — ARCHETYPE BANDS (PRIMARY VISUAL MASS)
			// -----------------------------------------------------

			for (let x = MINX; x <= MAXX; x += CYCLE) {
				for (let p = 0; p < 4; p++) {
					const base = x + p * PX_PER_MAJOR + BAND_OFFSET;

					const poly = document.createElementNS(
						"http://www.w3.org/2000/svg",
						"polygon"
					);

						poly.setAttribute(
						"points",
						`
							${base},${SCREW_HEIGHT}
							${base + PX_PER_MAJOR},${SCREW_HEIGHT}
							${base + PX_PER_MAJOR * 5},0
							${base + PX_PER_MAJOR * 4},0
						`
					);

				poly.setAttribute("fill", COLORS[_isPersonal ? (p % 4) : ((p + 2) % 4)]);
				poly.setAttribute("opacity", "0.33");

				bands.appendChild(poly);
			}
		}


			// -----------------------------------------------------
			// 09.3 — CONJUNCTION DIAGONALS (SYMBOLIC LAYER)
			// -----------------------------------------------------

			for (let x = MINX; x <= MAXX; x += CYCLE) {
				for (let p = 0; p < 4; p++) {
					const base = x + p * PX_PER_MAJOR + BAND_OFFSET;

					const ln = document.createElementNS(
						"http://www.w3.org/2000/svg",
						"line"
					);

					ln.setAttribute("x1", base);
					ln.setAttribute("y1", CANON.TIMELINE_Y);
					ln.setAttribute("x2", base + CYCLE);
					ln.setAttribute("y2", 0);

					ln.setAttribute("stroke", "white");
					ln.setAttribute("stroke-width", "1.2");

					diags.appendChild(ln);
				}
			}

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


		// =========================================================
		//   TIMELINE GRID — vertical conjunction lines + horizontal
		//   Y-axis lines, behind the screw (seen through opacity)
		//   =========================================================
		(function buildTimelineGrid() {
			const gridGroup = document.getElementById("timelineGrid");
			if (!gridGroup) return;
			gridGroup.innerHTML = "";

			const ns = "http://www.w3.org/2000/svg";
			const X_MIN = MINX, X_MAX = MAXX;
			const SCREW_TOP = 0;
			const SCREW_BOTTOM = CANON.TIMELINE_Y;

			// ---- 1) Vertical dashed lines at each conjunction position ----
			// Align start to SCREW_EPOCH_X so lines pass through conj markers
			const gridStart = SCREW_EPOCH_X + Math.floor((X_MIN - SCREW_EPOCH_X) / PX_PER_MAJOR) * PX_PER_MAJOR;
			for (let x = gridStart; x <= X_MAX; x += PX_PER_MAJOR) {
				const vLine = document.createElementNS(ns, "line");
				vLine.setAttribute("x1", x);
				vLine.setAttribute("x2", x);
				vLine.setAttribute("y1", SCREW_TOP);
				vLine.setAttribute("y2", SCREW_BOTTOM);
				vLine.setAttribute("stroke", "rgba(255,255,255,0.35)");
				vLine.setAttribute("stroke-width", "2");
				vLine.setAttribute("stroke-dasharray", "6,4");
				vLine.setAttribute("pointer-events", "none");
				gridGroup.appendChild(vLine);
			}

			// ---- 2) Horizontal lines at 20-y Y-axis increments ----
			const Y_COUNT = 4;  // 4 bands per conjunction cycle (prophet/nomad/hero/artist)
			const Y_STEP = SCREW_BOTTOM / Y_COUNT;
			for (let i = 1; i < Y_COUNT; i++) {  // skip y=0 (top) and y=SCREW_BOTTOM (axis)
				const y = i * Y_STEP;
				const hLine = document.createElementNS(ns, "line");
				hLine.setAttribute("x1", X_MIN);
				hLine.setAttribute("x2", X_MAX);
				hLine.setAttribute("y1", y);
				hLine.setAttribute("y2", y);
				hLine.setAttribute("stroke", "rgba(255,255,255,0.25)");
				hLine.setAttribute("stroke-width", "1");
				hLine.setAttribute("pointer-events", "none");
				gridGroup.appendChild(hLine);
			}
		})();

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


		/* ---------------------------------------------------------
		   09.5.2 — BUILD MULTI‑COLORED SAECULUM WAVE
		   --------------------------------------------------------- */
		function buildSaeculumWave() {

			saeculumLine.innerHTML = "";

			const svgNS = "http://www.w3.org/2000/svg";
			const A = CANON.SINE_AMPLITUDE;
			const P = SAECULUM.PERIOD_PX;
			const X0 = SAECULUM.TROUGH_X + P / 2;
			const Y0 = CANON.TIMELINE_Y + A;
			const STEP = 6;
			
						// -----------------------------------------------------
			// X → archetype phase
			// -----------------------------------------------------
			
			function getPhaseAtX(x) {
				
				// Conjunction-locked phasing: each major step is 20y (visual law)
				const step = Math.floor((x - SCREW_EPOCH_X) / PX_PER_MAJOR);
				const idx = ((step % 4) + 4) % 4;
				return ["prophet", "nomad", "hero", "artist"][idx];
			}

			// -----------------------------------------------------
			// Generate sine points
			// -----------------------------------------------------
			const points = [];
			for (let x = MINX; x <= MAXX; x += STEP) {
				const phase = ((x - X0) / P) * Math.PI * 2;
				const y = Y0 - Math.cos(phase) * A;
				points.push({ x, y });
			}

			let currentPhase = getPhaseAtX(points[0].x);
			let segment = [];
			let segId = 0; // unique id for each label path


			// -----------------------------------------------------
			// Draw one colored segment + optional label
			// -----------------------------------------------------
	function flushSegment() {
	  if (segment.length < 2) return;

	  // Build the curve string once
	  let d = "";
	  segment.forEach((pt, i) => {
		d += (i === 0 ? "M" : "L") + `${pt.x},${pt.y} `;
	  });

	  // ✅ color for this segment (define BEFORE you use it)
	  const phaseColor = SAECULUM_PHASE_COLORS[currentPhase] || "#ffffff";

	  // Main wave segment
	  const path = document.createElementNS(svgNS, "path");
	  path.setAttribute("d", d);
	  path.setAttribute("fill", "none");
	  path.setAttribute("stroke", phaseColor);
	  path.setAttribute("stroke-width", "2.1");
	  path.setAttribute("stroke-linecap", "round");

	  // ✅ glow on the wave (not the text)
	  path.style.filter =
		`drop-shadow(0 0 4px ${phaseColor}) drop-shadow(0 0 10px ${phaseColor})`;

	  saeculumLine.appendChild(path);

	  // =============================
	  // Curved label under the wave
	  // =============================
	  if (showSaeculumLabels) {
		const phaseNameRaw =
		  (typeof SAECULUM_PHASE_NAMES !== "undefined" && SAECULUM_PHASE_NAMES[currentPhase])
			? SAECULUM_PHASE_NAMES[currentPhase]
			: currentPhase;

		const phaseName = String(phaseNameRaw).toUpperCase();

		// Tight, always-below placement (bigger number = lower)
		const LABEL_DROP = 12; // try 10–16

		// Unique id for this segment
		const segId = `saecSeg_${currentPhase}_${Math.floor(segment[0].x)}`;
		path.setAttribute("id", segId);

		// Label path = same curve, shifted down
		const labelPath = document.createElementNS(svgNS, "path");
		labelPath.setAttribute("d", d);
		labelPath.setAttribute("fill", "none");
		labelPath.setAttribute("stroke", "none");
		labelPath.setAttribute("id", `${segId}_label`);
		labelPath.setAttribute("transform", `translate(0, ${LABEL_DROP})`);
		saeculumLine.appendChild(labelPath);

		// Text riding the label path
		const label = document.createElementNS(svgNS, "text");

		// ✔ phase colored text (direct match wave color)
		const phaseColor = SAECULUM_PHASE_COLORS[currentPhase] || "#ffffff";
		label.setAttribute("fill", phaseColor);

		// smaller text so it’s less crowded
		label.setAttribute("font-size", "9px");
		label.setAttribute("letter-spacing", "0.35px");
		label.setAttribute("opacity", "0.90");

		// remove outlines + glow entirely
		label.removeAttribute("paint-order");
		label.removeAttribute("stroke");
		label.removeAttribute("stroke-width");
		label.removeAttribute("stroke-linejoin");
		label.style.filter = "none";


		const tp = document.createElementNS(svgNS, "textPath");
		tp.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${segId}_label`);
		tp.setAttribute("startOffset", "50%");
		tp.setAttribute("text-anchor", "middle");

		tp.textContent = phaseName;

		label.appendChild(tp);
		saeculumLine.appendChild(label);
	  }

	  segment = [];
	}

				// -----------------------------------------------------
				// Walk through points and split by phase
				// -----------------------------------------------------
				for (let i = 0; i < points.length; i++) {
					const pt = points[i];
					const phase = getPhaseAtX(pt.x);

					if (phase !== currentPhase && segment.length) {
						flushSegment();
						currentPhase = phase;
					}
					segment.push(pt);
				}

				flushSegment(); // final segment
			}

			/* ---------------------------------------------------------
			   09.5.3 — GLOW SYSTEM (OPTIONAL, COLOR‑AWARE)
			   --------------------------------------------------------- */
			function buildSaeculumLighting() {

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
				if (!saeculumGlowNode) return;

				const year = getYearForUI(scrollX);
				const phase = findArchetypePhase(year);
				const color = SAECULUM_PHASE_COLORS[phase] || "#ffffff";

				saeculumGlowNode.setAttribute("flood-color", color);
			}
			window.updateSaeculumGlow = updateSaeculumGlow;

			function syncCycleProjectionHeight() {
				const svg = document.getElementById("screwSVG");
				const projectionRoot = document.getElementById("cycleProjections");
				if (!svg || !projectionRoot) return;

				const svgHeight = Math.max(
					parseFloat(svg.style.height) || 0,
					svg.getBoundingClientRect().height || 0
				);
				const documentHeight = Math.max(
					document.documentElement.scrollHeight || 0,
					document.body ? document.body.scrollHeight : 0
				);
				const projectionHeight = Math.ceil(Math.max(
					CANON.SCREW_TOTAL_HEIGHT,
					svgHeight,
					documentHeight
				));

				projectionRoot.querySelectorAll("rect").forEach((rect) => {
					rect.setAttribute("height", String(projectionHeight));
				});
				projectionRoot.querySelectorAll("line").forEach((line) => {
					line.setAttribute("y2", String(projectionHeight));
				});
			}
			window.syncCycleProjectionHeight = syncCycleProjectionHeight;
		
			/* =========================================================
				SECTION 09.6 — CONJUNCTION CYCLE BAND (SWAPPABLE)
				---------------------------------------------------------
				Lives ABOVE the screw.
				Uses the Saturn–Jupiter baseline time mapping (dateToScrewX)
				so the generational screw scale never changes.
				========================================================= */

			function buildConjunctionCycleBand() {
				const baselineGroup = document.getElementById("elementalCycle");
				const overlayGroup  = document.getElementById("overlayCycle");
				const yugaGroup     = document.getElementById("yugaCycle");
				const projectionRoot = document.getElementById("cycleProjections");
				if (!baselineGroup) return;

				const projectionState = window.__zyCycleProjectionState || (() => {
					let saved = {};
					try { saved = JSON.parse(localStorage.getItem("zy_cycle_projections") || "{}"); } catch (e) {}
					return (window.__zyCycleProjectionState = {
						baseline: true, // Always show Saturn/Jupiter band
						overlay: saved.overlay !== false,
						yuga: saved.yuga !== false
					});
				})();

				function saveProjectionState() {
					try { localStorage.setItem("zy_cycle_projections", JSON.stringify(projectionState)); } catch (e) {}
				}

				function getProjectionLane(laneKey) {
					if (!projectionRoot) return null;
					let lane = projectionRoot.querySelector(`[data-projection-lane="${laneKey}"]`);
					if (!lane) {
						lane = document.createElementNS("http://www.w3.org/2000/svg", "g");
						lane.setAttribute("data-projection-lane", laneKey);
						projectionRoot.appendChild(lane);
					}
					lane.innerHTML = "";
					return lane;
				}

				const baselineProjection = getProjectionLane("baseline");
				const overlayProjection = getProjectionLane("overlay");
				const yugaProjection = getProjectionLane("yuga");

				// -----------------------------
				// HUD helpers (ported from generational page to prevent label jump on click)
				// -----------------------------
				function applyProjectionVisibility(laneKey, enabled) {
					if (!projectionRoot) return;
					const lane = projectionRoot.querySelector(`[data-projection-lane="${laneKey}"]`);
					if (lane) {
						lane.style.visibility = enabled ? "visible" : "hidden";
						lane.style.pointerEvents = "none";
					}
				}

				function applyHudPressedState(el, enabled, activeTitle, inactiveTitle) {
					el.setAttribute("aria-pressed", enabled ? "true" : "false");
					el.style.border = enabled
						? "1px solid rgba(255,255,255,0.55)"
						: "1px solid rgba(255,255,255,0.16)";
					el.title = enabled ? activeTitle : inactiveTitle;
				}

				function snapshotHudPositions() {
					const out = {};
					for (const id of ["conjHud_lane0", "conjHud_lane1", "yugaHudToggle"]) {
						const el = document.getElementById(id);
						if (!el) continue;
						out[id] = {
							left: el.style.left,
							top: el.style.top
						};
					}
					return out;
				}

				function restoreHudPositions(snapshot) {
					for (const id of Object.keys(snapshot || {})) {
						const el = document.getElementById(id);
						if (!el) continue;
						el.style.left = snapshot[id].left;
						el.style.top = snapshot[id].top;
					}
				}

				function lockHudPositions(snapshot) {
					window.__zyCycleHudLockedPositions = snapshot || {};
					restoreHudPositions(window.__zyCycleHudLockedPositions);
					requestAnimationFrame(() => restoreHudPositions(window.__zyCycleHudLockedPositions));
				}

				function restoreScrollPosition(x, y) {
					window.scrollTo(x, y);
					requestAnimationFrame(() => {
						window.scrollTo(x, y);
						requestAnimationFrame(() => window.scrollTo(x, y));
					});
				}

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
					document.body.appendChild(hud);
					}
					hud.style.zIndex = "1000"; // above top menu (z=999) so labels aren't hidden
					// mark existing as unused, we'll keep only the ones we touch this pass
				Array.from(hud.children).forEach(ch => { ch.dataset.keep = "0"; });

				// Clear both SVG band groups (prevents "old cycle sticks around")
				baselineGroup.innerHTML = "";
				if (overlayGroup) overlayGroup.innerHTML = "";
				if (yugaGroup) yugaGroup.innerHTML = "";

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
				const HUD_LEFT_OFFSET = 74;
				const YUGA_BUTTON_H = H * 2 + GAP;

				// Bands live ABOVE the screw (matches generational page)
				const Y_BASE = -(H * 2 + GAP);
				const Y_OVER = -H;

				const OP_BASE = 0.30;
				const OP_OVER = 0.26;

				// -----------------------------
				// helpers (screen-space band center queries)
				// -----------------------------
				function getBandScreenCenterY(groupId, fallbackY, fallbackHeight = H) {
					const group = document.getElementById(groupId);
					const bandRect = group
						? group.querySelector(".cycleRectLayer rect, rect[data-dense-mask='1'], rect")
						: null;
					if (bandRect && typeof bandRect.getBoundingClientRect === "function") {
						const r = bandRect.getBoundingClientRect();
						if (Number.isFinite(r.top) && Number.isFinite(r.height) && r.height > 0) {
							return r.top + (r.height / 2);
						}
					}
					if (group && typeof group.getBoundingClientRect === "function") {
						const r = group.getBoundingClientRect();
						if (Number.isFinite(r.top) && Number.isFinite(r.height) && r.height > 0) {
							return r.top + (r.height / 2);
						}
					}

					const svgRect = svg.getBoundingClientRect();
					const scrollGroupY = CANON.SCREW_TOP_PAD + (typeof EXTRA_SCREW_TOP_PAD === "number" ? EXTRA_SCREW_TOP_PAD : 55);
					return svgRect.top + scrollGroupY + fallbackY + (fallbackHeight / 2);
				}

				function getConjBandScreenCenterY(Y) {
					const svgRect = svg.getBoundingClientRect();
					const scrollGroupY = CANON.SCREW_TOP_PAD + (typeof EXTRA_SCREW_TOP_PAD === "number" ? EXTRA_SCREW_TOP_PAD : 55);
					return svgRect.top + scrollGroupY + Y + (H / 2);
				}

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

				function setHudLabelForLane(Y, p1Label, p2Label, projectionKey) {
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
						"Venus|Jupiter": "~14 mo",
						"Jupiter|Venus": "~14 mo",
						"Venus|Saturn": "~14 mo",
						"Saturn|Venus": "~14 mo",
						"Venus|Uranus": "~13 mo",
						"Uranus|Venus": "~13 mo",
						"Venus|Neptune": "~13 mo",
						"Neptune|Venus": "~13 mo",
						"Venus|Pluto": "~5 mo",
						"Pluto|Venus": "~5 mo",
						"Mars|Jupiter": "~11 mo",
						"Jupiter|Mars": "~11 mo",
						"Mars|Saturn": "~2.1",
						"Saturn|Mars": "~2.1",
						"Mars|Uranus": "~24 mo",
						"Uranus|Mars": "~24 mo",
						"Mars|Neptune": "~23 mo",
						"Neptune|Mars": "~23 mo",
						"Mars|Pluto": "~23 mo",
						"Pluto|Mars": "~23 mo",
						"Mercury|Venus": "~6 mo",
						"Venus|Mercury": "~6 mo",
						"Mercury|Mars": "~2 mo",
						"Mars|Mercury": "~2 mo",
						"Mercury|Jupiter": "~12 mo",
						"Jupiter|Mercury": "~12 mo",
						"Mercury|Saturn": "~12 mo",
						"Saturn|Mercury": "~12 mo",
						"Mercury|Uranus": "~12 mo",
						"Uranus|Mercury": "~12 mo",
						"Mercury|Neptune": "~12 mo",
						"Neptune|Mercury": "~12 mo",
						"Mercury|Pluto": "~12 mo",
						"Pluto|Mercury": "~12 mo",
						"default": ""
					};

					const g1 = GLYPH[p1Label] || p1Label;
					const g2 = GLYPH[p2Label] || p2Label;

					const isOverlay = (Y === Y_OVER);
					const laneIdx = isOverlay ? 1 : 0;
					const labelId = `conjHud_lane${laneIdx}`;

					let el = document.getElementById(labelId);
					if (!el) {
						el = document.createElement("div");
						el.id = labelId;
						hud.appendChild(el);
					}

					// Re-apply every render so already-open pages do not keep stale label styles.
					el.style.position = "fixed";
					el.style.whiteSpace = "nowrap";
					el.style.pointerEvents = "auto";
					el.style.cursor = "pointer";
					el.style.fontFamily = "Segoe UI Symbol, Noto Sans Symbols2, Symbola, system-ui, sans-serif";
					el.style.fontSize = "18px";
					el.style.fontWeight = "900";
					el.style.color = "#fff";
					el.style.display = "inline-flex";
					el.style.alignItems = "center";
					el.style.gap = "3px";
					el.style.lineHeight = "1";
					el.style.textShadow = "0 0 3px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.85)";
					el.style.background = "rgba(0,0,0,0.90)";
					el.style.padding = "0 8px";
					el.style.height = H + "px";
					el.style.boxSizing = "border-box";
					el.style.display = "inline-flex";
					el.style.alignItems = "center";
					el.style.borderRadius = "6px";
					el.style.border = projectionState[projectionKey]
						? "1px solid rgba(255,255,255,0.55)"
						: "1px solid rgba(255,255,255,0.16)";
					el.style.opacity = "1";
					el.title = projectionState[projectionKey]
						? "Hide elemental projection through history"
						: "Show elemental projection through history";
					el.setAttribute("role", "button");
					applyHudPressedState(
						el,
						projectionState[projectionKey],
						"Hide elemental projection through history",
						"Show elemental projection through history"
					);
					el.tabIndex = -1;
					el.onpointerdown = (event) => {
						event.preventDefault();
						event.stopPropagation();
						window.__zyCycleHudPointerSnapshot = snapshotHudPositions();
					};
					el.onclick = (event) => {
						event.preventDefault();
						event.stopPropagation();
						const keepX = window.scrollX;
						const keepY = window.scrollY;
						const labelPositions = window.__zyCycleHudPointerSnapshot || snapshotHudPositions();
						window.__zyCycleHudLockedPositions = labelPositions;
						projectionState[projectionKey] = !projectionState[projectionKey];
						saveProjectionState();
						applyProjectionVisibility(projectionKey, projectionState[projectionKey]);
						applyHudPressedState(
							el,
							projectionState[projectionKey],
							"Hide elemental projection through history",
							"Show elemental projection through history"
						);
						lockHudPositions(labelPositions);
						restoreScrollPosition(keepX, keepY);
						window.__zyCycleHudPointerSnapshot = null;
					};
					el.style.background = "rgba(0,0,0,0.90)";
					el.style.padding = "0 8px";
					el.style.height = H + "px";
					el.style.boxSizing = "border-box";
					el.style.display = "inline-flex";
					el.style.alignItems = "center";
					el.style.borderRadius = "6px";

					el.dataset.keep = "1";

					// lock to left edge of the SVG on screen
					const svgRect = svg.getBoundingClientRect();
					const HUD_LEFT_OFFSET = 74;
					const bandLeftPx = svgRect.left + HUD_LEFT_OFFSET;

					// Exact band center on screen + nudge to sit on the band
					const scrollGroupY = CANON.SCREW_TOP_PAD + (typeof EXTRA_SCREW_TOP_PAD === "number" ? EXTRA_SCREW_TOP_PAD : 55);
					const laneCenterY = svgRect.top + scrollGroupY + Y + (H / 2) + 32 + (H + GAP);

					const lockedPosition = window.__zyCycleHudLockedPositions && window.__zyCycleHudLockedPositions[labelId];
					el.style.left = lockedPosition ? lockedPosition.left : `${bandLeftPx}px`;
					el.style.top = lockedPosition ? lockedPosition.top : `${laneCenterY}px`;
					el.style.transform = "translateY(-50%)";
					el.style.visibility = "visible";
					el.style.opacity = "1";

					const g1t = String(g1).includes("\uFE0E") ? String(g1) : (String(g1) + "\uFE0E");
					const g2t = String(g2).includes("\uFE0E") ? String(g2) : (String(g2) + "\uFE0E");
					
					// Get cycle duration
					const cycleKey = `${p1Label}|${p2Label}`;
					const duration = CYCLE_DURATION[cycleKey] || CYCLE_DURATION["default"];
					
					const planetGlyph = (g) => `<span class="conjHudPlanetGlyph" style="font-size:${Math.max(12, H - 4)}px; line-height:1; display:inline-block;">${g}</span>`;
					const conjGlyph = `<span class="conjHudConjGlyph" style="font-size:0.58em; line-height:1; opacity:0.9; display:inline-block; transform: translateY(-0.03em);">☌</span>`;
					const durationText = duration ? `<span style="font-size: 80%; opacity: 0.85; margin-left: 4px; line-height:1;">${duration}${String(duration).includes("mo") ? "" : " yrs"}</span>` : "";

					// Larger planet glyphs, smaller conjunction mark, vertically centered as one flex row
					el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:3px;">${planetGlyph(g1t)}${conjGlyph}${planetGlyph(g2t)}${durationText}</span>`;
				}

				function dateFromYearOffset(anchorDate, yearsOffset) {
					const d = new Date(anchorDate.getTime());
					d.setUTCFullYear(anchorDate.getUTCFullYear() + yearsOffset);
					return d;
				}

				function setYugaHudButton() {
					if (!yugaGroup) return;

					const labelId = "yugaHudToggle";
					let el = document.getElementById(labelId);
					if (!el) {
						el = document.createElement("div");
						el.id = labelId;
						hud.appendChild(el);
					}

					el.style.position = "fixed";
					el.style.whiteSpace = "nowrap";
					el.style.pointerEvents = "auto";
					el.style.cursor = "pointer";
					el.style.fontFamily = "system-ui, sans-serif";
					el.style.fontSize = "12px";
					el.style.fontWeight = "900";
					el.style.letterSpacing = "0.08em";
					el.style.textTransform = "uppercase";
					el.style.color = "#fff";
					el.style.display = "inline-flex";
					el.style.alignItems = "center";
					el.style.justifyContent = "center";
					el.style.lineHeight = "1";
					el.style.textShadow = "0 0 3px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.85)";
					el.style.background = "rgba(0,0,0,0.90)";
					el.style.padding = "0 8px";
					el.style.height = YUGA_BUTTON_H + "px";
					el.style.minWidth = "62px";
					el.style.boxSizing = "border-box";
					el.style.borderRadius = "6px";
					el.setAttribute("role", "button");
					applyHudPressedState(
						el,
						projectionState.yuga,
						"Hide yuga age projection through history",
						"Show yuga age projection through history"
					);
					el.tabIndex = -1;
					el.onpointerdown = (event) => {
						event.preventDefault();
						event.stopPropagation();
						window.__zyCycleHudPointerSnapshot = snapshotHudPositions();
					};
					el.onclick = (event) => {
						event.preventDefault();
						event.stopPropagation();
						const keepX = window.scrollX;
						const keepY = window.scrollY;
						const labelPositions = window.__zyCycleHudPointerSnapshot || snapshotHudPositions();
						window.__zyCycleHudLockedPositions = labelPositions;
						projectionState.yuga = !projectionState.yuga;
						saveProjectionState();
						applyProjectionVisibility("yuga", projectionState.yuga);
						applyHudPressedState(
							el,
							projectionState.yuga,
							"Hide yuga age projection through history",
							"Show yuga age projection through history"
						);
						lockHudPositions(labelPositions);
						restoreScrollPosition(keepX, keepY);
						window.__zyCycleHudPointerSnapshot = null;
					};
					el.dataset.keep = "1";
					el.textContent = "Yuga";

					const svgRect = svg.getBoundingClientRect();

					const twoBandCenterY = getBandScreenCenterY("yugaCycle", Y_BASE, H * 2 + GAP) + 59;
					const lockedPosition = window.__zyCycleHudLockedPositions && window.__zyCycleHudLockedPositions[labelId];
					el.style.left = lockedPosition ? lockedPosition.left : `${svgRect.left}px`;
					el.style.top = lockedPosition ? lockedPosition.top : `${twoBandCenterY}px`;
					el.style.transform = "translateY(-50%)";
					el.style.visibility = "visible";
					el.style.opacity = "1";
				}

				function drawYugaCycleBand() {
					if (!yugaGroup || !yugaProjection || typeof dateToScrewX !== "function") return;

					yugaGroup.innerHTML = "";
					yugaProjection.innerHTML = "";

					const anchorDate = new Date("2020-12-21T18:20:00Z");
					const segments = [
						{ name: "Descending Dwapara", short: "Bronze", start: -3600, end: -1200, rgb: "205, 92, 43" },
						{ name: "Kali", short: "Iron", start: -1200, end: 0, rgb: "106, 106, 112" },
						{ name: "Ascending Dwapara", short: "Bronze", start: 0, end: 2400, rgb: "224, 104, 47" },
						{ name: "Ascending Treta", short: "Silver", start: 2400, end: 6000, rgb: "204, 204, 192" },
						{ name: "Ascending Satya", short: "Gold", start: 6000, end: 10800, rgb: "240, 199, 64" }
					];

					const visiblePad = PX_PER_MAJOR * 2;
					const historyY = CANON.TIMELINE_Y + 34;
					const historyH = Math.max(1, CANON.SCREW_TOTAL_HEIGHT - historyY);
					const watermarkY = historyY + historyH * 0.44;
					const transitionLabelY = watermarkY + 38;

					function transitionYears(seg) {
						return Math.max(1, (seg.end - seg.start) / 12);
					}

					function addTransitionWindow(seg, startYear, endYear, anchor) {
						const d0 = dateFromYearOffset(anchorDate, startYear);
						const d1 = dateFromYearOffset(anchorDate, endYear);
						const x0 = dateToScrewX(d0);
						const x1 = dateToScrewX(d1);
						const w = x1 - x0;
						if (!Number.isFinite(w) || w <= 0) return;
						if (x1 < MINX - visiblePad || x0 > MAXX + visiblePad) return;

						const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
						rect.setAttribute("x", x0);
						rect.setAttribute("y", String(historyY));
						rect.setAttribute("width", w);
						rect.setAttribute("height", String(historyH));
						rect.setAttribute("fill", `rgb(${seg.rgb})`);
						rect.setAttribute("fill-opacity", "0.11");
						rect.setAttribute("pointer-events", "none");
						yugaProjection.appendChild(rect);

						const edge = anchor === "end" ? x1 : x0;
						const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
						line.setAttribute("x1", String(edge));
						line.setAttribute("x2", String(edge));
						line.setAttribute("y1", String(historyY));
						line.setAttribute("y2", String(historyY + historyH));
						line.setAttribute("stroke", `rgb(${seg.rgb})`);
						line.setAttribute("stroke-opacity", "0.36");
						line.setAttribute("stroke-width", "1");
						line.setAttribute("pointer-events", "none");
						yugaProjection.appendChild(line);
					}

					for (const seg of segments) {
						const d0 = dateFromYearOffset(anchorDate, seg.start);
						const d1 = dateFromYearOffset(anchorDate, seg.end);
						const x0 = dateToScrewX(d0);
						const x1 = dateToScrewX(d1);
						const w = x1 - x0;
						if (!Number.isFinite(w) || w <= 0) continue;
						if (x1 < MINX - visiblePad || x0 > MAXX + visiblePad) continue;

						const projectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
						projectionRect.setAttribute("x", x0);
						projectionRect.setAttribute("y", String(historyY));
						projectionRect.setAttribute("width", w);
						projectionRect.setAttribute("height", String(historyH));
						projectionRect.setAttribute("fill", `rgb(${seg.rgb})`);
						projectionRect.setAttribute("fill-opacity", "0.045");
						projectionRect.setAttribute("pointer-events", "none");
						yugaProjection.appendChild(projectionRect);
					}

					for (const seg of segments) {
						const t = transitionYears(seg);
						addTransitionWindow(seg, seg.start, seg.start + t, "start");
						addTransitionWindow(seg, seg.end - t, seg.end, "end");
					}

					const cuspX = dateToScrewX(anchorDate);
					const previousYuga = segments.find(seg => seg.start < 0 && seg.end === 0) || segments[1];
					const previousLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
					previousLabel.setAttribute("x", String(cuspX - 26));
					previousLabel.setAttribute("y", String(watermarkY));
					previousLabel.setAttribute("text-anchor", "end");
					previousLabel.setAttribute("dominant-baseline", "middle");
					previousLabel.setAttribute("font-size", "30");
					previousLabel.setAttribute("font-weight", "900");
					previousLabel.setAttribute("letter-spacing", "0.08em");
					previousLabel.setAttribute("fill", "#ffffff");
					previousLabel.setAttribute("opacity", "0.12");
					previousLabel.setAttribute("paint-order", "stroke");
					previousLabel.setAttribute("stroke", "rgba(0,0,0,0.62)");
					previousLabel.setAttribute("stroke-width", "2");
					previousLabel.setAttribute("pointer-events", "none");
					previousLabel.textContent = `Ascending ${previousYuga.name} / ${previousYuga.short}`;
					yugaProjection.appendChild(previousLabel);

					const previousTransitionLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
					previousTransitionLabel.setAttribute("x", String(cuspX - 26));
					previousTransitionLabel.setAttribute("y", String(transitionLabelY));
					previousTransitionLabel.setAttribute("text-anchor", "end");
					previousTransitionLabel.setAttribute("dominant-baseline", "middle");
					previousTransitionLabel.setAttribute("font-size", "12");
					previousTransitionLabel.setAttribute("font-weight", "900");
					previousTransitionLabel.setAttribute("letter-spacing", "0.08em");
					previousTransitionLabel.setAttribute("fill", "#ffffff");
					previousTransitionLabel.setAttribute("opacity", "0.16");
					previousTransitionLabel.setAttribute("paint-order", "stroke");
					previousTransitionLabel.setAttribute("stroke", "rgba(0,0,0,0.70)");
					previousTransitionLabel.setAttribute("stroke-width", "2");
					previousTransitionLabel.setAttribute("pointer-events", "none");
					previousTransitionLabel.textContent = `${previousYuga.short} dusk`;
					yugaProjection.appendChild(previousTransitionLabel);

					const currentYuga = segments.find(seg => seg.start <= 0 && seg.end > 0) || segments[2];
					const currentLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
					currentLabel.setAttribute("x", String(cuspX + 26));
					currentLabel.setAttribute("y", String(watermarkY));
					currentLabel.setAttribute("text-anchor", "start");
					currentLabel.setAttribute("dominant-baseline", "middle");
					currentLabel.setAttribute("font-size", "30");
					currentLabel.setAttribute("font-weight", "900");
					currentLabel.setAttribute("letter-spacing", "0.08em");
					currentLabel.setAttribute("fill", "#ffffff");
					currentLabel.setAttribute("opacity", "0.12");
					currentLabel.setAttribute("paint-order", "stroke");
					currentLabel.setAttribute("stroke", "rgba(0,0,0,0.62)");
					currentLabel.setAttribute("stroke-width", "2");
					currentLabel.setAttribute("pointer-events", "none");
					currentLabel.textContent = `${currentYuga.name} / ${currentYuga.short}`;
					yugaProjection.appendChild(currentLabel);

					const currentTransitionLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
					currentTransitionLabel.setAttribute("x", String(cuspX + 26));
					currentTransitionLabel.setAttribute("y", String(transitionLabelY));
					currentTransitionLabel.setAttribute("text-anchor", "start");
					currentTransitionLabel.setAttribute("dominant-baseline", "middle");
					currentTransitionLabel.setAttribute("font-size", "12");
					currentTransitionLabel.setAttribute("font-weight", "900");
					currentTransitionLabel.setAttribute("letter-spacing", "0.08em");
					currentTransitionLabel.setAttribute("fill", "#ffffff");
					currentTransitionLabel.setAttribute("opacity", "0.16");
					currentTransitionLabel.setAttribute("paint-order", "stroke");
					currentTransitionLabel.setAttribute("stroke", "rgba(0,0,0,0.70)");
					currentTransitionLabel.setAttribute("stroke-width", "2");
					currentTransitionLabel.setAttribute("pointer-events", "none");
					currentTransitionLabel.textContent = `${currentYuga.short} dawn`;
					yugaProjection.appendChild(currentTransitionLabel);

					const projectionCusp = document.createElementNS("http://www.w3.org/2000/svg", "line");
					projectionCusp.setAttribute("x1", cuspX);
					projectionCusp.setAttribute("x2", cuspX);
					projectionCusp.setAttribute("y1", String(historyY));
					projectionCusp.setAttribute("y2", String(historyY + historyH));
					projectionCusp.setAttribute("stroke", "#ffffff");
					projectionCusp.setAttribute("stroke-opacity", "0.32");
					projectionCusp.setAttribute("stroke-width", "1.5");
					projectionCusp.setAttribute("pointer-events", "none");
					yugaProjection.appendChild(projectionCusp);
				}

				// -----------------------------
				// band renderer
				// -----------------------------
				function drawBand(groupEl, projectionGroup, projectionEnabled, events, Y, bandOpacity, p1Label, p2Label) {
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
				const isOverlay = (Y === Y_OVER);
				const laneIdx = isOverlay ? 1 : 0;

				// ── Venus-Mercury mask: too dense (every ~6 mo = ~3000 events over 2400 yr).
				// Render a single solid band instead of thousands of sub-pixel rects.
				const pairKey = (p1Label && p2Label) ? `${p1Label}|${p2Label}` : '';
				const isVenusMercury = pairKey === "Venus|Mercury" || pairKey === "Mercury|Venus";
				const MASKED_PAIR = isVenusMercury;

				if (MASKED_PAIR && events && events.length >= 2) {
					// Full screw span — use MINX/MAXX so mask covers the entire timeline
					const xStart = MINX;
					const xEnd = MAXX;
					if (Number.isFinite(xStart) && Number.isFinite(xEnd) && xEnd > xStart) {
						const maskRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
							maskRect.setAttribute("x", xStart);
							maskRect.setAttribute("y", Y);
							maskRect.setAttribute("width", xEnd - xStart);
							maskRect.setAttribute("height", H);
							maskRect.setAttribute("fill", "rgba(255,255,255,0.08)");
							maskRect.setAttribute("data-venus-mercury-mask", "1");
						groupEl.appendChild(maskRect);
					}
					// Skip the individual rect rendering below
					groupEl.appendChild(rectLayer);
					groupEl.appendChild(glyphLayer);
					return;
				}

				// --- Safe viewport values (works even early-load) ---
				const haveViewport = Number.isFinite(MINX) && Number.isFinite(MAXX) && Number.isFinite(PX_PER_MAJOR);
				const safeMinX = haveViewport ? MINX : -1e12;
				const safeMaxX = haveViewport ? MAXX :  1e12;
				const safePad  = haveViewport ? PX_PER_MAJOR : 0;

				// Subtle temporal decay: when the zodiac/conjunction pattern repeats,
				// older cycle dividers sit a little darker than newer adjacent dividers.
				// This preserves the band colors while giving the repeated cadence depth.
				const totalSegments = Math.max(1, events.length - 2);
				function cycleDecayForIndex(idx) {
					const t = Math.max(0, Math.min(1, idx / totalSegments)); // 0=oldest, 1=newest
					return {
						fill: 0.78 + t * 0.22,
						stroke: 0.38 + t * 0.42,
						glyph: 0.72 + t * 0.23
					};
				}

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

				function placeGlyph(signKey, xMid, rgb, glyphOpacity = 0.95) {
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
					t.setAttribute("font-size", "15");
					t.setAttribute("font-weight", "800");
					t.setAttribute("fill", `rgb(${rgb})`);
					t.setAttribute("opacity", String(glyphOpacity));
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
				let runGlyphOpacitySum = 0;
				let runGlyphCount = 0;

				function flushRun() {
					if (!runSign || runStartX === null || runEndX === null) return;

					// midpoint of the VISIBLE portion of the run
					const v0 = Math.max(runStartX, safeMinX);
					const v1 = Math.min(runEndX,   safeMaxX);
					const mid = (v0 + v1) / 2;

					const runGlyphOpacity = Number.isFinite(runGlyphOpacitySum) && runGlyphCount > 0
						? runGlyphOpacitySum / runGlyphCount
						: 0.95;
					if (Number.isFinite(mid)) placeGlyph(runSign, mid, runRgb, runGlyphOpacity);
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
					const decay = cycleDecayForIndex(i);

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
					rect.setAttribute("opacity", String(bandOpacity * decay.fill));
					rectLayer.appendChild(rect);

					if (projectionGroup && projectionEnabled) {
						const projectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
						projectionRect.setAttribute("x", x0);
						projectionRect.setAttribute("y", "0");
						projectionRect.setAttribute("width", w);
						projectionRect.setAttribute("height", String(CANON.SCREW_TOTAL_HEIGHT));
						projectionRect.setAttribute("fill", `rgb(${rgb})`);
						projectionRect.setAttribute("fill-opacity", "0.05");
						projectionRect.setAttribute("pointer-events", "none");
						projectionGroup.appendChild(projectionRect);

						const boundary = document.createElementNS("http://www.w3.org/2000/svg", "line");
						boundary.setAttribute("x1", x0);
						boundary.setAttribute("x2", x0);
						boundary.setAttribute("y1", "0");
						boundary.setAttribute("y2", String(CANON.SCREW_TOTAL_HEIGHT));
						boundary.setAttribute("stroke", `rgb(${rgb})`);
						boundary.setAttribute("stroke-opacity", "0.15");
						boundary.setAttribute("stroke-width", "1");
						boundary.setAttribute("pointer-events", "none");
						projectionGroup.appendChild(boundary);
					}

					// White boundary line — decays subtly so repeated older cycles recede
					rect.setAttribute("shape-rendering", "crispEdges");
					rect.setAttribute("stroke", "#ffffff");
					rect.setAttribute("stroke-width", "1");
					rect.setAttribute("stroke-opacity", String(decay.stroke));

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
						runGlyphOpacitySum = decay.glyph;
						runGlyphCount = 1;
					} else if (signKey === runSign) {
						runEndX = x1;
						runGlyphOpacitySum += decay.glyph;
						runGlyphCount += 1;
					} else {
						flushRun();
						runSign = signKey;
						runRgb = rgb;
						runStartX = x0;
						runEndX = x1;
						runGlyphOpacitySum = decay.glyph;
						runGlyphCount = 1;
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
				// 0) YUGA: age bands + watermark
				// -------------------------
				drawYugaCycleBand();
				setYugaHudButton();

				// -------------------------
				// 1) BASELINE: Saturn–Jupiter always
				// -------------------------
				const baseEvents = getEventsForPair("Saturn", "Jupiter");
				if (baseEvents) {
					drawBand(baselineGroup, baselineProjection, projectionState.baseline, baseEvents, Y_BASE, OP_BASE, "Saturn", "Jupiter");
					setHudLabelForLane(Y_BASE, "Saturn", "Jupiter", "baseline");
				}

				// shadow strip
				const oldShadow = document.getElementById("elementBandShadowRect");
				if (oldShadow) oldShadow.remove();

				if (typeof bands !== "undefined" && bands && Number.isFinite(MINX) && Number.isFinite(MAXX) && Number.isFinite(PX_PER_MAJOR)) {
					const shadeTop = Y_OVER + H;
					const shadeBottom = shadeTop + 14;
					grad.setAttribute("y1", String(shadeTop));
					grad.setAttribute("y2", String(shadeBottom));

					const shadow = document.createElementNS("http://www.w3.org/2000/svg", "rect");
					shadow.setAttribute("id", "elementBandShadowRect");
					shadow.setAttribute("x", MINX - PX_PER_MAJOR);
					shadow.setAttribute("y", String(Y_OVER + H));
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
							drawBand(overlayGroup, overlayProjection, projectionState.overlay, overlayEvents, Y_OVER, OP_OVER, sel.p1, sel.p2);
							setHudLabelForLane(Y_OVER, sel.p1, sel.p2, "overlay");
						}
					}
				}

				// Cleanup unused HUD labels (prevents "ghost" labels)
				applyProjectionVisibility("baseline", projectionState.baseline);
				applyProjectionVisibility("overlay", projectionState.overlay);
				applyProjectionVisibility("yuga", projectionState.yuga);

				Array.from(hud.children).forEach(ch => {
					if (ch.dataset.keep !== "1") ch.remove();
				});
				syncCycleProjectionHeight();
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

		const labels = ["Elder","Midlife","Young Adult","Childhood"];
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
			text.setAttribute("x",CANON.LABEL_WIDTH - 8);
			text.setAttribute("y",y + 28);
			text.setAttribute("font-size","12");
			text.setAttribute("fill","white");
			text.setAttribute("opacity","0.85");
			text.setAttribute("text-anchor","end");
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

		const phases = ["Prophet","Nomad","Hero","Artist"];
		for (let i = 0; i < 4; i++) {
			const t = (i + 0.5)/4;
			const x = 8 + t*(W - 16);
			const y = 8 + t*(H - 16);

			const dot = document.createElementNS(
				"http://www.w3.org/2000/svg","circle"
			);
			dot.setAttribute("cx",x);
			dot.setAttribute("cy",y);
			dot.setAttribute("r",2.5);
			dot.setAttribute("fill","white");
			dot.setAttribute("opacity","0.8");
			g.appendChild(dot);

			const label = document.createElementNS(
				"http://www.w3.org/2000/svg","text"
			);
			label.setAttribute("x",x+6);
			label.setAttribute("y",y+4);
			label.setAttribute("font-size","10");
			label.setAttribute("fill","white");
			label.setAttribute("opacity","0.6");
			label.textContent = phases[i];
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

		const angleDeg = -Math.atan2(CANON.SCREW_HEIGHT, CYCLE) * 180 / Math.PI;
		const slope = CANON.SCREW_HEIGHT / CYCLE;



		CUSTOM_GENERATION_LABELS.forEach((gen) => {
			const baseX = SCREW_EPOCH_X + (gen.x - 2020) * PX_PER_YEAR;
			const baseY = CANON.TIMELINE_Y - slope * (gen.startYear - EPOCH_YEAR);
			const archetypeOffset = ARCHETYPE_Y_OFFSETS[gen.archetype] || 0;
			const labelY = CANON.TIMELINE_Y + gen.y;

			// Estimate text width (~8px per char for 14px bold)
			const estW = Math.max(30, gen.label.length * 8 + 16);
			const estH = 20;
			const ns = "http://www.w3.org/2000/svg";



			// Group with rotation — background rect + text together
			const g = document.createElementNS(ns, "g");
			g.setAttribute(
				"transform",
				`rotate(${angleDeg} ${baseX} ${labelY})`
			);



			const text = document.createElementNS(ns, "text");
			text.textContent = gen.label;
			text.setAttribute("x", baseX);
			text.setAttribute("y", labelY);
			text.setAttribute("fill", "#ffffff");
			text.setAttribute("font-size", "14");
			text.setAttribute("font-weight", "bold");
			text.setAttribute("opacity", "0.95");
			text.setAttribute("text-anchor", "start");
			// Thick background-colored stroke erases the DLL behind each letter
			text.setAttribute("paint-order", "stroke");
			text.setAttribute("stroke", "#0d0d14");
			text.setAttribute("stroke-width", "5");
			text.setAttribute("stroke-linecap", "round");
			text.setAttribute("stroke-linejoin", "round");

			g.appendChild(text);
			diagLabels.appendChild(g);
		});
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

	// Signal that screw geometry is ready
	window.screwReady = true;
	window.dispatchEvent(new CustomEvent('zy:screwBuilt'));

	// Expose so ui-controller can rebuild labels after --top-menu-bottom is set
	window.rebuildConjunctionCycleBand = buildConjunctionCycleBand;
	}

		// Rebuild the cycle band when the selector changes
	if (!window.__zyCycleBandHooked) {
		window.__zyCycleBandHooked = true;
		window.addEventListener("zy:cyclechange", () => {
			window.__zyCycleHudLockedPositions = null;
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

	// Signal + dispatch are now inside initScrewRenderer() below

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
