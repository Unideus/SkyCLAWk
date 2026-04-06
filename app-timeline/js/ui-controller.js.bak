/* ui-controller.js — DOM wiring + animation loop */
/* =========================================================
			SECTION 08 — DOM REFERENCES
	========================================================= */

	const bands = document.getElementById("bands");
	const diags = document.getElementById("diags");
	const ticks = document.getElementById("ticks");
	const grid = document.getElementById("grid");
	const bottomYears = document.getElementById("bottomYears");
	const scrollGroup = document.getElementById("scrollGroup");
	const labelBG = document.getElementById("labelBG");
	const labelText = document.getElementById("labelText");
	const lifeCycleOverlay = document.getElementById("lifeCycleOverlay");
	const dateBoxText = document.getElementById("dateBoxText");
	const dateBoxInput = document.getElementById("dateBoxInput");
	const astroDateText = document.getElementById("astroDateText");
		let dateBoxGoBtn =
		  document.getElementById("dateBoxGoBtn") ||
		  document.querySelector("#menuDate .dateGoBtn") ||
		  document.querySelector("#menuDate button");
	const resetEpochBtn = document.getElementById("resetBtn");
	const resetNowBtn   = document.getElementById("resetNowBtn");
	const speedSlider = document.getElementById("speedSlider");
	const speedInfo = document.getElementById("speedInfo");
	const unitKnob = document.getElementById("unitKnob");
	const unitKnobTrack = document.getElementById("unitKnobTrack");
	const unitKnobThumb = document.getElementById("unitKnobThumb");
	const pauseBtn    = document.getElementById("pauseBtn");
	const bumpRevBtn  = document.getElementById("bumpRevBtn");
	const bumpFwdBtn  = document.getElementById("bumpFwdBtn");
	const scaleSelector = document.getElementById("scaleSelector");

	// Extra vertical room for the overlay conjunction band (px)
	const EXTRA_SCREW_TOP_PAD = 25;

	/* =========================================================
	SPEED UNITS (knob cycles what slider “means”)
	Slider magnitude stays logarithmic; selected unit changes
	both display and how far time advances per second.
	========================================================= */

	const SPEED_UNITS = ["yrs", "months", "weeks", "days", "hours"];

	const SPEED_UNIT_LABEL = {
	yrs: " yr",
	months: " mo",
	weeks: " wk",
	days: " dy",
	hours: " hr",
	};

	const SPEED_UNIT_KNOB = {
	yrs: "yrs",
	months: "mo",
	weeks: "wk",
	days: "day",
	hours: "hr",
	};

	// How many YEARS are in 1 unit (so: yearsPerSec = unitsPerSec * YEARS_PER_UNIT[unit])
	const YEARS_PER_UNIT = {
	yrs: 1,
	months: 1 / 12,
	weeks: 7 / 365.2422,
	days: 1 / 365.2422,
	hours: 1 / (365.2422 * 24),
	};

	let speedUnit = localStorage.getItem("zy_speed_unit") || "yrs";
	let timelineScale = localStorage.getItem("zy_timeline_scale") || "generational";

	function setTimelineScale(nextScale) {
	if (!scaleSelector) return;
	if (!nextScale) nextScale = "generational";
	if (!/^(yuga|generational|personal)$/.test(nextScale)) nextScale = "generational";

	timelineScale = nextScale;
	localStorage.setItem("zy_timeline_scale", timelineScale);
	scaleSelector.dataset.scale = timelineScale;

	// a11y + visuals
	scaleSelector.querySelectorAll(".scaleOpt").forEach(btn => {
		const isOn = btn.dataset.scale === timelineScale;
		btn.setAttribute("aria-checked", isOn ? "true" : "false");
		btn.tabIndex = isOn ? 0 : -1;
	});
	}

	function setSpeedUnit(nextUnit) {
		if (!YEARS_PER_UNIT[nextUnit]) nextUnit = "yrs";
		speedUnit = nextUnit;
		localStorage.setItem("zy_speed_unit", speedUnit);

		const i = Math.max(0, SPEED_UNITS.indexOf(speedUnit));

		// Thumb position: exact stops 0/25/50/75/100 (matches tick placement)
		if (unitKnob) {
			unitKnob.style.setProperty("--unit-i", String(i));      // keep if used elsewhere
			unitKnob.style.setProperty("--unit-p", `${i * 25}%`);   // NEW: percent anchor
		}

		// Black letter inside the thumb
		if (unitKnobThumb) {
			const THUMB_LETTER = { yrs: "Y", months: "M", weeks: "W", days: "D", hours: "H" };
			unitKnobThumb.dataset.u = THUMB_LETTER[speedUnit] || "y";
		}

		// Highlight active tick
		if (unitKnobTrack) {
			unitKnobTrack.querySelectorAll(".unitTick").forEach(t => {
			t.classList.toggle("isActive", t.dataset.unit === speedUnit);
			});
		}
	}

		function cycleSpeedUnit() {
			const i = SPEED_UNITS.indexOf(speedUnit);
			const next = SPEED_UNITS[(i + 1) % SPEED_UNITS.length];
			setSpeedUnit(next);
		}

		/* =========================================================
		UNIT KNOB INPUT: click tick OR drag thumb (snaps 0..4)
		========================================================= */
		let unitDragging = false;
		let unitDragMoved = false;

		function unitIndexFromClientX(clientX) {
		if (!unitKnobTrack) return 0;

		const r = unitKnobTrack.getBoundingClientRect();
		const thumbW = unitKnobThumb ? unitKnobThumb.getBoundingClientRect().width : 18;

		// Clamp within usable travel range (track width - thumb width)
		const minX = r.left;
		const maxX = r.right - thumbW;

		const clamped = Math.min(maxX, Math.max(minX, clientX - thumbW / 2));
		const t = (clamped - minX) / (r.width - thumbW);  // 0..1
		const idx = Math.round(t * 4);                     // 5 positions => 0..4
		return Math.max(0, Math.min(4, idx));
		}

		function setSpeedUnitByIndex(idx) {
		const unit = SPEED_UNITS[Math.max(0, Math.min(4, idx))] || "yrs";
		setSpeedUnit(unit);
		}
		const nextElementBtn = document.getElementById("nextElementBtn");
		const prevElementBtn = document.getElementById("prevElementBtn"); 	// Crisis button hover/color is handled in CSS (timeline.css)
		const nextCrisisBtn  = document.getElementById("nextCrisisBtn");
		const prevCrisisBtn  = document.getElementById("prevCrisisBtn");

		// Selected-cycle conj nav (whatever the cycle modal chose)
		const nextConjBtn = document.getElementById("nextConjBtn");
		const prevConjBtn = document.getElementById("prevConjBtn");

		// NEW: Dedicated Saturn/Jupiter conj nav (always Sat–Jup)
		const nextSatJupConjBtn = document.getElementById("nextSatJupConjBtn");
		const prevSatJupConjBtn = document.getElementById("prevSatJupConjBtn");
		const astroContainer = document.getElementById("astroContainer");
		const river3dContainer = document.getElementById("river3dContainer");
		const diagLabels = document.getElementById("diagLabels");
		const saeculumWave = document.getElementById("saeculumWave");
		const saeculumLight = document.getElementById("saeculumLight");
		const saeculumLine  = document.getElementById("saeculumLine");
		const elementalCycle = document.getElementById("elementalCycle");
		const baseY = CANON.TIMELINE_Y + DIAG_LABEL_Y_OFFSET;
		let phaseLabels = []; // Stores phase label elements (saeculum wave)

		// Keep the global time spine BELOW the top menu so it never slices the controls
		// AND place the NOW label into the element/age band area.
		const topMenu = document.getElementById("topMenu");
		const screwSVGEl = document.getElementById("screwSVG");
		const labelSVGEl = document.getElementById("labelSVG");
		


		function syncTimeMarkerLayout() {
		if (!screwSVGEl) return;

		const sr = screwSVGEl.getBoundingClientRect();
		
		// CATHEDRAL: expose the bottom edge of the top menu so fixed overlays can sit below it
		if (topMenu) {
			const tr = topMenu.getBoundingClientRect();
			document.documentElement.style.setProperty("--top-menu-bottom", `${Math.round(tr.bottom)}px`);
		}


		// CATHEDRAL: NOW_X is the LEFT EDGE of the archetype label box (measured from DOM)
		if (labelSVGEl) {
			const lr = labelSVGEl.getBoundingClientRect();
			document.documentElement.style.setProperty("--time-marker-left", `${Math.round(lr.left)}px`);
		}

		// CATHEDRAL: time spine begins at the TOP of the diagonal/body field (not the menu)
		const markerTop = Math.round(sr.top + CANON.SCREW_TOP_PAD + EXTRA_SCREW_TOP_PAD - 10);
		document.documentElement.style.setProperty("--time-marker-top", `${markerTop}px`);

		const nowY = Math.round(sr.top + CANON.SCREW_TOP_PAD + EXTRA_SCREW_TOP_PAD - 10);
		document.documentElement.style.setProperty("--now-label-age-top", `${nowY}px`);
		}
		
		function syncScrewSVGHeight() {
		if (!screwSVGEl) return;

		// Make the SVG at least as tall as the visible viewport from its top to bottom
			const r = screwSVGEl.getBoundingClientRect();
			const needPx = Math.max(CANON.SCREW_TOTAL_HEIGHT, document.documentElement.scrollHeight);

		screwSVGEl.style.height = `${needPx}px`;
		document.documentElement.style.setProperty("--screw-svg-height", `${needPx}px`);
		}

		// ---------------------------------------------------------
		// Wheel popout window bridge
		// ---------------------------------------------------------
		let wheelWin = null;

		function openWheelPopout() {
		// Must be called from a user gesture to avoid popup blocking.
		if (wheelWin && !wheelWin.closed) {
			wheelWin.focus();
			return wheelWin;
		}

		wheelWin = window.open(
			"/wheel-popout.html",
			"ZodiYugaWheel",
			"width=520,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no"
		);

		return wheelWin;
		}

		// =========================================================
		// CATHEDRAL — EVENT SHIELD (locks to astro-wheel in screen space)
		// =========================================================
			function syncEventShield() {
			// Masking box removed intentionally.
			// If an old shield path exists from prior versions, clear it.
			const shield = document.getElementById("eventShieldPath");
			if (shield) shield.setAttribute("d", "");
			}

			window.addEventListener("resize", () => {
			syncTimeMarkerLayout();
			syncScrewSVGHeight();
			syncEventShield();
			syncRiverClip();
			if (window.River3D) River3D.resize();
			});

			// ---------------------------------------------------------
			// River band: confine Three.js render to the screw band only
			// Uses screwSVG DOM rect + viewBox (no CTM guessing)
			// Band in ROOT SVG coords:
			//   top    = CANON.SCREW_TOP_PAD
			//   bottom = CANON.SCREW_TOP_PAD + CANON.TIMELINE_Y
			// ---------------------------------------------------------
			function syncRiverClip() {
			if (!window.River3D) return;

			const svg = document.getElementById("screwSVG");
			if (!svg) return;

			const topLine  = svg.querySelector("#elementalBoundaryLine");
			const axisLine = svg.querySelector("#timelineAxisLine");
			if (!topLine || !axisLine) return;

			const topPx = topLine.getBoundingClientRect().top;
			const botPx = axisLine.getBoundingClientRect().top;
			River3D.setBand(topPx, botPx);

			const screwRect = svg.getBoundingClientRect();
			const nowBoundaryScreenX = screwRect.left + getNowScreenX();

			River3D.setXEdge(nowBoundaryScreenX);
			River3D.setXClip(screwRect.left, nowBoundaryScreenX);
			
			// ✅ Archetype box river (labelSVG)
				if (labelSVGEl && typeof River3D.setLabelRect === "function") {
				const lr = labelSVGEl.getBoundingClientRect();
				River3D.setLabelRect(lr.left, lr.top, lr.right, lr.bottom);
				}
			}


		window.addEventListener("scroll", () => {
			if (isWheelOpen()) syncEventShield();
		}, { passive: true });


		const innerPlanetToggle = document.getElementById("innerPlanetToggle");
		const outerPlanetToggle = document.getElementById("outerPlanetToggle");

		if (innerPlanetToggle) {
		innerPlanetToggle.classList.toggle("active", showInnerPlanets);
		innerPlanetToggle.addEventListener("click", () => {
			showInnerPlanets = !showInnerPlanets;
			innerPlanetToggle.classList.toggle("active", showInnerPlanets);
			requestWheelRedraw();
		});
		}

		if (outerPlanetToggle) {
		outerPlanetToggle.classList.toggle("active", showOuterPlanets);
		outerPlanetToggle.addEventListener("click", () => {
			showOuterPlanets = !showOuterPlanets;
			outerPlanetToggle.classList.toggle("active", showOuterPlanets);
			drawAstroWheel();
			syncEventShield();
		});
		}
		
		const natalToggle = document.getElementById("natalToggle");

		// --- Natal button text lives ON the button (no extra box) ---
		const setNatalToggleText = () => {
		if (!natalToggle) return;

		// Always fixed-width label so the button never "jumps"
		if (window.NatalChart && window.NatalChart.dateUTC instanceof Date) {
			const d = window.NatalChart.dateUTC;
			const dd = String(d.getUTCDate()).padStart(2, "0");
			const mon = d.toLocaleString(undefined, { month: "short", timeZone: "UTC" });
			const yyyy = String(d.getUTCFullYear());
			natalToggle.textContent = `Natal ${dd} ${mon} ${yyyy}`;
		} else {
			natalToggle.textContent = "Natal -- --- ----";
		}

		natalToggle.classList.toggle("active", !!(window.NatalChart && window.NatalChart.enabled));
		};

	// initial sync (on load)
	setNatalToggleText();

	if (natalToggle) {
	  natalToggle.addEventListener("click", () => {
		// Do not overwrite an existing object (it may contain setDateUTC + longitudes)
		if (!window.NatalChart) window.NatalChart = { enabled:false, dateUTC:null, longitudes:null };

		window.NatalChart.enabled = !window.NatalChart.enabled;

		// If turning ON, seed date from dateBox (or engine date) and compute natal longitudes
		if (window.NatalChart.enabled && typeof window.NatalChart.setDateUTC === "function") {
		  let y, m, d;

		const v = (dateBoxInput && dateBoxInput.value) ? String(dateBoxInput.value).trim() : "";
		if (v) {
		  if (v.includes("-")) {
			const parts = v.split("-");
			y = Number(parts[0]);
			m = Number(parts[1]);
			d = Number(parts[2]);
		  } else {
			const parts = v.replace(/\s+/g, " ").trim().split(" ");
			if (parts.length === 3) {
			  d = Number(parts[0]);
			  const monStr = String(parts[1]).toLowerCase();
			  y = Number(parts[2]);
			  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
			  m = months.indexOf(monStr) + 1;
			}
		  }
		}


		  // fallback: current engine date
		  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
			const cur = AstroEngine.dateUTC;
			y = cur.getUTCFullYear();
			m = cur.getUTCMonth() + 1;
			d = cur.getUTCDate();
		  }

		  const natalUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // date-only noon UTC
		  window.NatalChart.setDateUTC(natalUTC);
		  window.NatalChart.dateUTC = natalUTC;
		}

		setNatalToggleText();
		drawAstroWheel();
		syncEventShield();
	  });
	}

/* =========================================================
   SECTION 08.1 — CONTROL WIRING (INTERACTION BEHAVIOR)
   ========================================================= */

	   
		function freezeTime() {
			// Slider = 0 already stops motion; do not hard-freeze the loop.
			speedSlider.value = 0;
			isPaused = false;
		}

		// PAUSE = stop motion NOW (slider->0) and cancel any smooth button-travel.
		// Slider always remains the authority.
		if (pauseBtn) {
		  pauseBtn.addEventListener("click", () => {
			if (speedSlider) speedSlider.value = 0;
			timeState.navTargetDateUTC = null;
			isPaused = false;
		  });
		}

		// ---------------------------------------------------------
		// BUMP (paused-only): step by selected unit
		// ---------------------------------------------------------
		function isPausedNow(){
		const v = speedSlider ? (speedSlider.value / 100) : 0;
		return Math.abs(v) < 0.0001 && !timeState.navTargetDateUTC;
		}

		function angleDiffDeg(a, b){
			// returns signed diff in [-180, +180)
			let d = (a - b) % 360;
			if (d < -180) d += 360;
			if (d >= 180) d -= 360;
			return d;
			}

			function moonLonDegAt(date){
			// Uses your existing wheel pipeline if present
			if (typeof getPlanetLongitudes === "function") {
				const L = getPlanetLongitudes(date);
				if (L && typeof L.moon === "number") return L.moon;
			}
			return null;
			}

			function findMoonReturn(date, dir){
			// Find next time Moon returns to SAME longitude (mod 360)
			// Uses a bracket scan + bisection around a sidereal month.
			const SIDEREAL_MONTH_DAYS = 27.321661;
			const ms0 = date.getTime();

			const lon0 = moonLonDegAt(date);
			if (lon0 == null) {
				// fallback: approximate sidereal month
				return new Date(ms0 + dir * SIDEREAL_MONTH_DAYS * 24 * 60 * 60 * 1000);
			}

			const stepMs = 6 * 60 * 60 * 1000; // 6 hours scan
			const minMs  = ms0 + dir * 20 * 24 * 60 * 60 * 1000;
			const maxMs  = ms0 + dir * 35 * 24 * 60 * 60 * 1000;

			// scan to find a sign change of f(t)=angleDiff(moonLon(t), lon0)
			let tPrev = minMs;
			let fPrev = angleDiffDeg(moonLonDegAt(new Date(tPrev)), lon0);

			for (let t = tPrev + dir * stepMs; dir > 0 ? t <= maxMs : t >= maxMs; t += dir * stepMs) {
				const lon = moonLonDegAt(new Date(t));
				if (lon == null) break;

				const f = angleDiffDeg(lon, lon0);

				// bracket: sign change or very close
				if (Math.abs(f) < 0.05 || (fPrev <= 0 && f >= 0) || (fPrev >= 0 && f <= 0)) {
				// bisection refine between tPrev and t
				let a = tPrev, b = t;
				let fa = fPrev, fb = f;

				for (let i = 0; i < 30; i++) { // ~1e-9 of range if stable
					const mid = (a + b) / 2;
					const fm = angleDiffDeg(moonLonDegAt(new Date(mid)), lon0);

					if (Math.abs(fm) < 0.0005) return new Date(mid); // ~0.0005° tight

					// keep the bracket
					if ((fa <= 0 && fm >= 0) || (fa >= 0 && fm <= 0)) {
					b = mid; fb = fm;
					} else {
					a = mid; fa = fm;
					}
				}
				return new Date((a + b) / 2);
				}

				tPrev = t;
				fPrev = f;
			}

			// fallback if bracket failed
			return new Date(ms0 + dir * SIDEREAL_MONTH_DAYS * 24 * 60 * 60 * 1000);
			}

			function addUnitUTC(date, unit, dir){
			const d = new Date(date.getTime());

			if (unit === "yrs") {
				d.setUTCFullYear(d.getUTCFullYear() + dir);
				return d;
			}
			if (unit === "months") {
				// lunar month: return Moon to same longitude (best match for “lands where it was”)
				return findMoonReturn(d, dir);
			}
			if (unit === "weeks") {
				return new Date(d.getTime() + dir * 7 * 24 * 60 * 60 * 1000);
			}
			if (unit === "days") {
				return new Date(d.getTime() + dir * 24 * 60 * 60 * 1000);
			}
			if (unit === "hours") {
				return new Date(d.getTime() + dir * 60 * 60 * 1000);
			}
			return d;
			}

		function bumpBySelectedUnit(dir){
		if (!isPausedNow()) return;

		const cur = timeState.dateUTC; // canonical current date
		const next = addUnitUTC(cur, speedUnit, dir);

		// instant jump (not a glide), but only while paused
		timeState.navTargetDateUTC = null;
		AstroEngine.setDateUTC(next);

		updateDate();
		requestWheelRedraw();
		}

		// press-and-hold repeat (tap bumps once, hold repeats)
		function wireBumpHold(btn, dir){
		if (!btn) return;

		let holdTimeout = null;
		let holdInterval = null;
		let holding = false;

		function stopHold(){
			holding = false;
			if (holdTimeout) { clearTimeout(holdTimeout); holdTimeout = null; }
			if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
		}

		btn.addEventListener("pointerdown", (e) => {
			if (!isPausedNow()) return;

			holding = true;
			btn.setPointerCapture(e.pointerId);

			// 1) immediate single bump on press
			bumpBySelectedUnit(dir);

			// 2) after short delay, start repeating
			holdTimeout = setTimeout(() => {
			if (!holding) return;

			holdInterval = setInterval(() => {
				if (!isPausedNow()) { stopHold(); return; }
				bumpBySelectedUnit(dir);
			}, 90); // repeat speed (ms)
			}, 320); // delay before repeat starts (ms)

			e.preventDefault();
			e.stopPropagation();
		});

		btn.addEventListener("pointerup", stopHold);
		btn.addEventListener("pointercancel", stopHold);
		btn.addEventListener("pointerleave", stopHold);

		// prevent an extra "click" bump after pointerdown
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		}

		wireBumpHold(bumpRevBtn, -1);
		wireBumpHold(bumpFwdBtn, +1);

		// Units knob (cycles: yrs → months → weeks → days → hours)
		if (unitKnob) {
			setSpeedUnit(speedUnit); // init thumb + active tick

			// Click a tick letter => exact unit
			if (unitKnobTrack) {
				unitKnobTrack.addEventListener("click", (e) => {
				const tick = e.target.closest(".unitTick");
				if (tick && tick.dataset.unit) {
					setSpeedUnit(tick.dataset.unit);
					e.stopPropagation();
					return;
				}

				// Click anywhere on the track => snap to nearest stop
				const idx = unitIndexFromClientX(e.clientX);
				setSpeedUnitByIndex(idx);
				e.stopPropagation();
				});
			}

			// Drag thumb => snap continuously
			if (unitKnobThumb) {
				unitKnobThumb.addEventListener("pointerdown", (e) => {
				unitDragging = true;
				unitDragMoved = false;
				unitKnobThumb.setPointerCapture(e.pointerId);
				e.preventDefault();
				e.stopPropagation();
				});

				unitKnobThumb.addEventListener("pointermove", (e) => {
				if (!unitDragging) return;
				unitDragMoved = true;
				const idx = unitIndexFromClientX(e.clientX);
				setSpeedUnitByIndex(idx);
				e.preventDefault();
				e.stopPropagation();
				});

				unitKnobThumb.addEventListener("pointerup", (e) => {
				unitDragging = false;
				e.preventDefault();
				e.stopPropagation();
				});
			}

			// Optional: click the pill (not track/thumb) cycles units
			unitKnob.addEventListener("click", (e) => {
				// If we just dragged, ignore the click that follows
				if (unitDragMoved) { unitDragMoved = false; return; }
				if (e.target.closest(".unitKnobTrack")) return;
				cycleSpeedUnit();
			});
			}

			// Timeline scale selector (Yuga / Generational / Personal)
			if (scaleSelector) {
			setTimelineScale(timelineScale); // init (default = generational)

			scaleSelector.addEventListener("click", (e) => {
				const btn = e.target.closest(".scaleOpt");
				if (!btn || !btn.dataset.scale) return;
				setTimelineScale(btn.dataset.scale);
			});

			scaleSelector.addEventListener("keydown", (e) => {
				if (!/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) return;
				e.preventDefault();

				const order = ["yuga", "generational", "personal"];
				let i = order.indexOf(timelineScale);
				if (e.key === "Home") i = 0;
				else if (e.key === "End") i = order.length - 1;
				else if (e.key === "ArrowUp" || e.key === "ArrowLeft") i = Math.max(0, i - 1);
				else if (e.key === "ArrowDown" || e.key === "ArrowRight") i = Math.min(order.length - 1, i + 1);

				setTimelineScale(order[i]);
				const active = scaleSelector.querySelector(`.scaleOpt[data-scale="${order[i]}"]`);
				if (active) active.focus();
			});
			}

		// RESET TO 2020 (center label above slider)
		if (resetEpochBtn) {
			resetEpochBtn.addEventListener("click", () => {
				// Canonical reset is handled in SECTION 08.3; keep this harmless.
				speedSlider.value = 0;
				isPaused = false;
			});
		}
		
		if (resetNowBtn) {
			resetNowBtn.addEventListener("click", () => {
				if (speedSlider) speedSlider.value = 0;
				timeState.navTargetDateUTC = null;
				isPaused = false;

				// jump to real current time (UTC)
				AstroEngine.setDateUTC(new Date());

				// Enable live mode in astro wheel
				if (typeof window.setAstroWheelLiveMode === "function") {
					window.setAstroWheelLiveMode(true);
				}
			});
		}
		
		
		// =========================================================
		// CONJUNCTION NAV (ACTIVE CYCLE)
		// ---------------------------------------------------------
		// Uses window.getActiveConjunctionEvents() (your selector helper)
		// If missing/unavailable, falls back to CONJUNCTION_YEARS + gotoYearExact(year)
		// =========================================================

		function getActiveConjunctionTimesMs() {
			// Preferred: your helper (selected cycle)
			let events = [];
			if (window.getActiveConjunctionEvents && typeof window.getActiveConjunctionEvents === "function") {
				events = window.getActiveConjunctionEvents() || [];
			} else if (typeof CONJUNCTION_DATA !== "undefined" && Array.isArray(CONJUNCTION_DATA)) {
				events = CONJUNCTION_DATA;
			}

			// Build sorted unique instants
			const times = [];
			for (const e of events) {
				if (!e || !e.t) continue;
				const d = new Date(e.t);
				const ms = d.getTime();
				if (Number.isFinite(ms)) times.push(ms);
			}
			times.sort((a, b) => a - b);

			const uniq = [];
			for (let i = 0; i < times.length; i++) {
				if (i === 0 || times[i] !== times[i - 1]) uniq.push(times[i]);
			}
			if (!uniq.length) return uniq;

			// --- Cluster hits that belong to the same retrograde conjunction window ---
			// Any hits within this many days are treated as the same conjunction cluster.
			// 420 days is conservative for slow outer-planet clusters.
			const CLUSTER_DAYS = 420;
			const CLUSTER_MS = CLUSTER_DAYS * 24 * 60 * 60 * 1000;

			const definitive = [];
			let clusterStart = uniq[0];
			let clusterLast = uniq[0];

			for (let i = 1; i < uniq.length; i++) {
				const t = uniq[i];

				// Same cluster if close to previous hit
				if (t - clusterLast <= CLUSTER_MS) {
				clusterLast = t; // keep updating "last hit"
				continue;
				}

				// Cluster ended: Option B = choose LAST hit as definitive
				definitive.push(clusterLast);

				// Start new cluster
				clusterStart = t;
				clusterLast = t;
			}

			// Final cluster
			definitive.push(clusterLast);

			return definitive;
			}

		function gotoConjunctionInstantMs(ms) {
			const d = new Date(ms);
			if (!Number.isFinite(d.getTime())) return;

			// Use the app's smooth navigation system
			freezeTime();                    // slider=0, keeps loop running
			isPaused = false;

			timeState.navTargetDateUTC = d;  // <-- this triggers the smooth glide in your main loop
			requestWheelRedraw();
			}

			function fallbackMasterConjunctionYears() {
			if (typeof CONJUNCTION_YEARS === "undefined" || !Array.isArray(CONJUNCTION_YEARS)) return null;
			const yrs = CONJUNCTION_YEARS.filter(y => Number.isFinite(y));
			return yrs.length ? yrs.slice().sort((a,b)=>a-b) : null;
			}

			function fallbackGotoConjunctionYearSmooth(year) {
			if (typeof gotoYearExact !== "function") return;
			speedSlider.value = 0;
			isPaused = false;
			gotoYearExact(year);
			}

			function getNowMsForNav() {
			if (timeState && timeState.dateUTC instanceof Date) {
				const ms = timeState.dateUTC.getTime();
				if (Number.isFinite(ms)) return ms;
			}
			try {
				if (AstroEngine && typeof AstroEngine.getDateUTC === "function") {
				const d = AstroEngine.getDateUTC();
				const ms = d && d.getTime ? d.getTime() : NaN;
				if (Number.isFinite(ms)) return ms;
				}
			} catch (e) {}
			return Date.now();
			}

			// ---------------------------------------------------------
			// Conjunction navigation
			// ---------------------------------------------------------

			function getConjunctionTimesMsForPair(p1, p2) {
			const keyA = `${p1}|${p2}`;
			const keyB = `${p2}|${p1}`;
			const ds =
				(typeof window !== "undefined" && window.CONJUNCTION_DATASETS && (window.CONJUNCTION_DATASETS[keyA] || window.CONJUNCTION_DATASETS[keyB]))
				? (window.CONJUNCTION_DATASETS[keyA] || window.CONJUNCTION_DATASETS[keyB])
				: null;

			if (!ds || !Array.isArray(ds.events)) return null;

			const times = ds.events
				.map(e => Date.parse(e?.t))
				.filter(Number.isFinite)
				.sort((a, b) => a - b);

			return times.length ? times : null;
			}

			function stepInTimes(times, dir) {
			if (!times || !times.length) return null;
			const nowMs = getNowMsForNav();

			if (dir > 0) {
				for (const t of times) if (t > nowMs + 1000) return t;
				return times[0]; // wrap
			} else {
				for (let i = times.length - 1; i >= 0; i--) if (times[i] < nowMs - 1000) return times[i];
				return times[times.length - 1]; // wrap
			}
			}

			// -----------------------------
			// Selected-cycle Conjunction nav
			// -----------------------------

			// NEXT CONJUNCTION →
			if (nextConjBtn) {
			nextConjBtn.addEventListener("click", () => {
				freezeTime();

				const times = getActiveConjunctionTimesMs();

				// If we have active-cycle times, step through those (true cycle nav)
				if (times && times.length) {
				const target = stepInTimes(times, +1);
				if (target !== null) gotoConjunctionInstantMs(target);
				return;
				}

				// Fallback: master lattice behavior
				const list = fallbackMasterConjunctionYears();
				if (!list || !list.length) return;
				const yearRaw = getYearForNavigation();
				const year = snapToListYear(yearRaw, list) ?? yearRaw;
				const next = getNextFromList(year, list, +1);
				if (next !== null) fallbackGotoConjunctionYearSmooth(next);
			});
			}

			// ← PREV CONJUNCTION
			if (prevConjBtn) {
			prevConjBtn.addEventListener("click", () => {
				freezeTime();

				const times = getActiveConjunctionTimesMs();

				// If we have active-cycle times, step through those (true cycle nav)
				if (times && times.length) {
				const target = stepInTimes(times, -1);
				if (target !== null) gotoConjunctionInstantMs(target);
				return;
				}

				// Fallback: master lattice behavior
				const list = fallbackMasterConjunctionYears();
				if (!list || !list.length) return;
				const yearRaw = getYearForNavigation();
				const year = snapToListYear(yearRaw, list) ?? yearRaw;
				const prev = getNextFromList(year, list, -1);
				if (prev !== null) fallbackGotoConjunctionYearSmooth(prev);
			});
			}

			// --------------------------------------
			// NEW: Dedicated Saturn/Jupiter conj nav
			// --------------------------------------

			if (nextSatJupConjBtn) {
			nextSatJupConjBtn.addEventListener("click", () => {
				freezeTime();

				const times = getConjunctionTimesMsForPair("Saturn", "Jupiter");
				if (times && times.length) {
				const target = stepInTimes(times, +1);
				if (target !== null) gotoConjunctionInstantMs(target);
				}
			});
			}

			if (prevSatJupConjBtn) {
			prevSatJupConjBtn.addEventListener("click", () => {
				freezeTime();

				const times = getConjunctionTimesMsForPair("Saturn", "Jupiter");
				if (times && times.length) {
				const target = stepInTimes(times, -1);
				if (target !== null) gotoConjunctionInstantMs(target);
				}
			});
			}

			// NEXT CRISIS →
			if (nextCrisisBtn) {
			nextCrisisBtn.addEventListener("click", () => {
				freezeTime();
				const list = (typeof CRISIS_YEARS !== "undefined" && Array.isArray(CRISIS_YEARS))
				? CRISIS_YEARS.slice().filter(Number.isFinite).sort((a,b)=>a-b)
				: null;
				if (!list || !list.length) return;

				const yearRaw = getYearForNavigation();
				const year = snapToListYear(yearRaw, list) ?? yearRaw;
				const next = getNextFromList(year, list, +1);
				if (next !== null) fallbackGotoConjunctionYearSmooth(next);
			});
			}

			// ← PREV CRISIS
			if (prevCrisisBtn) {
			prevCrisisBtn.addEventListener("click", () => {
				freezeTime();
				const list = (typeof CRISIS_YEARS !== "undefined" && Array.isArray(CRISIS_YEARS))
				? CRISIS_YEARS.slice().filter(Number.isFinite).sort((a,b)=>a-b)
				: null;
				if (!list || !list.length) return;

				const yearRaw = getYearForNavigation();
				const year = snapToListYear(yearRaw, list) ?? yearRaw;
				const prev = getNextFromList(year, list, -1);
				if (prev !== null) fallbackGotoConjunctionYearSmooth(prev);
			});
			}


			// DATE BOX (manual date → AstroEngine authority)
			// ------------------------------------------------------
			// Editing should NOT move the timeline.
			// Only GO (or Enter) commits the date.
			// ALSO: seeds Natal (date-only @ UTC noon).
			// ------------------------------------------------------
			if (dateBoxInput) {

				const markDirty = () => {
					dateBoxInput.dataset.dirty = "1";
					dateBoxInput.classList.remove("invalid");
					// keep a live copy so GO can't lose the user's value on blur
					dateBoxInput.dataset.pending = (dateBoxInput.value || "").trim();
				};

				const revertIfDirty = () => {
					if (!dateBoxInput.dataset.dirty) return;
					const iso = dateBoxInput.dataset.last || "";
					if (iso) dateBoxInput.value = iso;
					delete dateBoxInput.dataset.dirty;
					delete dateBoxInput.dataset.pending;
					dateBoxInput.classList.remove("invalid");
				};

				// ✅ Seeds natal from Y/M/D (no time, noon UTC)
				const commitNatalFromYMD = (y, m, d) => {
					const natalUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

					if (!window.NatalChart) window.NatalChart = { enabled:false, dateUTC:null, longitudes:null };

					// compute natal longitudes if your setter exists
					if (typeof window.NatalChart.setDateUTC === "function") {
						window.NatalChart.setDateUTC(natalUTC);
					}

					window.NatalChart.dateUTC = natalUTC;
					window.NatalChart.enabled = true;

					// Keep Natal button text + state in sync (single button, no extra box)
					const natalBtn = document.getElementById("natalToggle");
					if (natalBtn) {
						const dd = String(natalUTC.getUTCDate()).padStart(2, "0");
						const mon = natalUTC.toLocaleString(undefined, { month:"short", timeZone:"UTC" });
						const yyyy = String(natalUTC.getUTCFullYear());
						natalBtn.textContent = `Natal ${dd} ${mon} ${yyyy}`;
						natalBtn.classList.toggle("active", true);
					}
				};

				const applyDateBox = () => {
					// IMPORTANT: use pending value first (survives blur->revert issues)
					const v = ((dateBoxInput.dataset.pending || dateBoxInput.value || "") + "").trim();
					if (!v) return;

				let y, m, d;

				// Accept either "YYYY-MM-DD" or "DD Mon YYYY"
				if (v.includes("-")) {
				  const parts = v.split("-");
				  if (parts.length !== 3) {
					dateBoxInput.classList.add("invalid");
					return;
				  }
				  y = Number(parts[0]);
				  m = Number(parts[1]);
				  d = Number(parts[2]);
				} else {
				  const parts = v.replace(/\s+/g, " ").trim().split(" ");
				  if (parts.length !== 3) {
					dateBoxInput.classList.add("invalid");
					return;
				  }
				  d = Number(parts[0]);
				  const monStr = String(parts[1]).toLowerCase();
				  y = Number(parts[2]);

				  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
				  m = months.indexOf(monStr) + 1;
				}

				if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12) {
				  dateBoxInput.classList.add("invalid");
				  return;
				}


					// Preserve current UTC time-of-day while changing the calendar date
					const cur = timeState.dateUTC;
					const target = new Date(Date.UTC(
						y, m - 1, d,
						cur.getUTCHours(),
						cur.getUTCMinutes(),
						cur.getUTCSeconds(),
						cur.getUTCMilliseconds()
					));

					if (Number.isNaN(target.getTime())) {
						dateBoxInput.classList.add("invalid");
						return;
					}

					// ✅ Commit: stop slider motion + smooth-navigate timeline to target
					if (speedSlider) speedSlider.value = 0;
					isPaused = false;

					dateBoxInput.classList.remove("invalid");
					delete dateBoxInput.dataset.dirty;
					delete dateBoxInput.dataset.pending;
					dateBoxInput.dataset.last = v;

					// ✅ This moves the timeline
					timeState.navTargetDateUTC = target;

					// ✅ Then seed natal to the entered date
					commitNatalFromYMD(y, m, d);
				};

				dateBoxInput.addEventListener("input", markDirty);

				// ✅ CRITICAL FIX:
				// If blur is caused by clicking GO, do NOT revert (that would erase the user's typed date).
				dateBoxInput.addEventListener("blur", (e) => {
					if (e && e.relatedTarget && dateBoxGoBtn && e.relatedTarget === dateBoxGoBtn) return;
					revertIfDirty();
				});

				// ✅ GO must commit BEFORE blur/revert can fire
				if (dateBoxGoBtn) {
					// ensure it can't submit anything
					try { dateBoxGoBtn.type = "button"; } catch(_) {}

					// commit on pointerdown (fires before input blur)
					dateBoxGoBtn.addEventListener("pointerdown", (e) => {
						e.preventDefault();
						e.stopPropagation();
						applyDateBox();
					});

					// also handle click (safe fallback)
					dateBoxGoBtn.addEventListener("click", (e) => {
						e.preventDefault();
						e.stopPropagation();
						applyDateBox();
						dateBoxInput.blur();
					});
				}

				dateBoxInput.addEventListener("keydown", (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						applyDateBox();
						dateBoxInput.blur();
					}
				});
			}


		

		function getCurrentElementEraIndex(year) {
			for (let i = ELEMENT_ERA_YEARS.length - 1; i >= 0; i--) {
				if (year >= ELEMENT_ERA_YEARS[i]) return i;
			}
			return 0;
		}

// =========================================================
// CATHEDRAL — ELEMENT BUTTONS = NEXT/PREV ELEMENT SWITCH
// ---------------------------------------------------------
// • Uses getNextElementSwitch() from time-engine.js
// • Face shows TARGET glyph
// • Only glyph is colored; arrows stay white
// • Click navigates to target.tMs
// =========================================================

const ELEMENT_GLYPH = { fire:"🜂", earth:"🜃", air:"🜁", water:"🜄" };

function elementColorCSS(el) {
  const key = String(el || "").toLowerCase();
  const rgb =
    (typeof ELEMENTAL !== "undefined" &&
     ELEMENTAL &&
     ELEMENTAL.COLORS &&
     ELEMENTAL.COLORS[key])
      ? ELEMENTAL.COLORS[key]
      : "255,255,255";
  return `rgb(${rgb})`;
}

function setElementBtnFace(btn, direction) {
  if (!btn || typeof getNextElementSwitch !== "function") return;

  const target = getNextElementSwitch(timeState.dateUTC, direction);

  // arrows stay white
  btn.style.color = "#fff";

  // default
  btn.innerHTML = (direction < 0) ? "←" : "→";
  if (!target) return;

  const el = String(target.element || "").toLowerCase();
  const glyph = ELEMENT_GLYPH[el] || "✦";
  const c = elementColorCSS(el);

  const g = `<span class="elementGlyph" style="color:${c}">${glyph}</span>`;
  btn.innerHTML = (direction < 0) ? `← ${g}` : `${g} →`;
}

function updateElementButtonLabels() {
  setElementBtnFace(prevElementBtn, -1);
  setElementBtnFace(nextElementBtn, +1);
}

if (prevElementBtn) {
  prevElementBtn.addEventListener("click", () => {
    freezeTime();
    if (typeof getNextElementSwitch !== "function") return;
    const target = getNextElementSwitch(timeState.dateUTC, -1);
    if (!target) return;
    timeState.navTargetDateUTC = new Date(target.tMs);
  });
}

if (nextElementBtn) {
  nextElementBtn.addEventListener("click", () => {
    freezeTime();
    if (typeof getNextElementSwitch !== "function") return;
    const target = getNextElementSwitch(timeState.dateUTC, +1);
    if (!target) return;
    timeState.navTargetDateUTC = new Date(target.tMs);
  });
}


/* =========================================================
	   SECTION 08.3 — EPOCH & VIEW CONTROLS
	   ---------------------------------------------------------
	   • Non-kinetic controls
	   • No animation logic
	   • No geometry mutation
	   • Declarative state changes only
	   ========================================================= */

	// -----------------------------------------
	// Reset to Epoch (2020 Grand Conjunction) — SMOOTH GLIDE
	// -----------------------------------------
	resetEpochBtn.addEventListener("click", () => {
		freezeTime();                 // sets slider=0, keeps loop running
		timeState.navTargetDateUTC = new Date(epochDate.getTime()); // glide target
		requestWheelRedraw();
	});

	// -----------------------------------------
	// Reset to NOW — SMOOTH GLIDE
	// -----------------------------------------
	if (resetNowBtn) {
		resetNowBtn.addEventListener("click", () => {
			freezeTime();
			timeState.navTargetDateUTC = new Date();   // user's current instant
			requestWheelRedraw();
		});
	}

	window.addEventListener("resize", () => {
		let nowX = getNowScreenX(); // reuse variable from boot
		let screwTranslateX = nowX - SCREW_EPOCH_X + scrollX;

		scrollGroup.setAttribute(
			"transform",
			`translate(${screwTranslateX}, ${CANON.SCREW_TOP_PAD + EXTRA_SCREW_TOP_PAD})`
		);
	});

	function mod(n, m) {
	  return ((n % m) + m) % m; // always 0..m-1 (works for past/future)
	}

	// CATHEDRAL: align archetype phase colors to your saeculum display
	// (fixes the “yellow->blue” and “blue->purple” 1-phase shift)
	const ARCHETYPE_PHASE_SHIFT_YEARS = -20;

	function findArchetypePhase(year) {
	  const offset = mod(year - EPOCH_YEAR + ARCHETYPE_PHASE_SHIFT_YEARS, 80);
	  const phases = ["prophet", "nomad", "hero", "artist"];
	  return phases[Math.floor(offset / 20)];
	}

	// =========================================================
	// CATHEDRAL: SAECULUM TURNINGS (High/Awakening/Unraveling/Crisis)
	// =========================================================
	// This is what the wave labels use, and what the date pill should match.

	const TURNING_PHASE_SHIFT_YEARS = ARCHETYPE_PHASE_SHIFT_YEARS; // keep your alignment

	function findTurningPhase(year) {
	  // CATHEDRAL: anchor turnings to CRISIS_YEARS when available
	  // Crisis years are the trough anchors; each turning is 20y (80y cycle total).
	  // Ordering from a crisis anchor:
	  //   0–20  = crisis
	  //   20–40 = high
	  //   40–60 = awakening
	  //   60–80 = unraveling

	  const y = Number(year);
	  if (!Number.isFinite(y)) return "high";

	  if (typeof CRISIS_YEARS === "undefined" || !Array.isArray(CRISIS_YEARS) || !CRISIS_YEARS.length) {
		// Fallback to legacy modulo behavior (keeps the app stable if master missing)
		const offset = mod(y - EPOCH_YEAR + TURNING_PHASE_SHIFT_YEARS, 80);
		const turns = ["high", "awakening", "unraveling", "crisis"];
		return turns[Math.floor(offset / 20)];
	  }

	  // Ensure sorted
	  const list = CRISIS_YEARS.slice().filter(Number.isFinite).sort((a, b) => a - b);

	  // Find most recent crisis year <= y
	  let anchor = list[0];
	  for (let i = 0; i < list.length; i++) {
		if (list[i] <= y) anchor = list[i];
		else break;
	  }

	  let offset = y - anchor;

	  // If before first anchor, wrap backward in 80y blocks
	  offset = mod(offset, 80);

	  const idx = Math.floor(offset / 20); // 0..3
	  const turnsFromCrisis = ["crisis", "high", "awakening", "unraveling"];
	  return turnsFromCrisis[idx] || "high";
	}


	// Elemental / brand colors (NO cyan, NO purple)
	const TURNING_HEX = {
	  high:      "#22c55e", // green
	  awakening: "#facc15", // yellow
	  unraveling:"#3b82f6", // blue
	  crisis:    "#dc2626"  // red
	};

	const TURNING_RGB = {
	  high:      "34,197,94",
	  awakening: "250,204,21",
	  unraveling:"59,130,246",
	  crisis:    "220,38,38"
	};


	function updateWaveColor(scrollX) {
	  const year = getYearForUI(scrollX);
	  const turning = findTurningPhase(year);

	  const glowColor = TURNING_HEX[turning] || "#ffffff";
	  const path = saeculumLine.querySelector("path");

	  if (path) {
		path.style.filter = `drop-shadow(0 0 16px ${glowColor})`;
	  }
	}

	
/* =========================================================
	   SECTION 10 — LABEL & DATE UPDATES
	   ========================================================= */

	function updateLabels(scrollX) {
		labelBG.innerHTML = "";
		labelText.innerHTML = "";

		const phase = ((-scrollX % CYCLE) + CYCLE) % CYCLE;
		const rowOffset = (phase / PX_PER_MAJOR);

		const names = ["Prophet","Nomad","Hero","Artist"];
		for (let i = 0; i < 8; i++) {
			const idx = i % 4;
			const y = (i - rowOffset)*CANON.ROW_HEIGHT;

			if (y < -CANON.ROW_HEIGHT || y > CANON.SCREW_HEIGHT) continue;

			const r = document.createElementNS(
				"http://www.w3.org/2000/svg","rect"
			);
			r.setAttribute("x",0);
			r.setAttribute("y",y);
			r.setAttribute("width",CANON.LABEL_WIDTH);
			r.setAttribute("height",CANON.ROW_HEIGHT);
			r.setAttribute("fill", COLORS[idx]);
			r.setAttribute("opacity","0.33");
			labelBG.appendChild(r);

			const t = document.createElementNS(
				"http://www.w3.org/2000/svg","text"
			);
			t.setAttribute("x",25);
			t.setAttribute("y",y+30);
			t.setAttribute("fill","black");
			t.setAttribute("font-size","22");
			t.setAttribute("font-weight","700");
			t.setAttribute("paint-order","stroke");
			t.setAttribute("stroke","white");
			t.setAttribute("stroke-width","2.5");
			t.setAttribute("stroke-linejoin","round");
			t.textContent = names[idx];
			labelText.appendChild(t);
		}
	}
	
		// =========================================================
		// CATHEDRAL: TURNING PHASE (High / Awakening / Unraveling / Crisis)
		// Anchored by CRISIS_YEARS (from time-engine.js)
		// =========================================================

		function updateDate() {
			// Phase 2A: timeState/AstroEngine defines time
			renderDateBox(timeState.dateUTC);
		}


		function renderDateBox(date) {
		  const day = date.getUTCDate().toString().padStart(2, "0");

		  const monthTitle = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }); // "Dec"
		  const monthUpper = monthTitle.toUpperCase(); // "DEC"

		  const year = date.getUTCFullYear();

		  // Continuous-ish year for phase detection (good enough for UI tint)
		  const yearFrac =
			year +
			(date.getUTCMonth() / 12) +
			((date.getUTCDate() - 1) / 365.2422);

			const turningKey = findTurningPhase(yearFrac); // "high" | "awakening" | "unraveling" | "crisis"

			if (dateBoxText) {
			  dateBoxText.textContent = `${day} ${monthUpper} ${year}`;
			  dateBoxText.setAttribute("data-turning", turningKey.toUpperCase()); // label shows HIGH/CRISIS/etc
			  dateBoxText.style.setProperty("--phase-rgb", TURNING_RGB[turningKey] || "255,255,255");
			}

		  // Astro center (requested)
		  if (astroDateText) astroDateText.textContent = `${day} ${monthTitle} ${year}`;

		  // Keep the native date input synchronized (UTC) unless the user is editing
		  if (dateBoxInput && document.activeElement !== dateBoxInput && !dateBoxInput.dataset.dirty) {
			const dd = String(date.getUTCDate()).padStart(2, "0");
			const mon = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
			const yyyy = String(date.getUTCFullYear());
			const pretty = `${dd} ${mon} ${yyyy}`;
			if (dateBoxInput.value !== pretty) dateBoxInput.value = pretty;
			dateBoxInput.classList.remove("invalid");
		  }
		}

		let lastWheelDrawMs = 0;
		const WHEEL_FPS = 30;
		const WHEEL_FRAME_MS = 1000 / WHEEL_FPS;

		let wheelNeedsRedraw = true;

		function isWheelOpen() {
		const wheelModal = document.getElementById("wheelModal");
		return wheelModal && wheelModal.getAttribute("aria-hidden") === "false";
		}

		function requestWheelRedraw() {
		wheelNeedsRedraw = true;
		}

		function isWheelOpen() {
			const m = document.getElementById("wheelModal");
			if (!m) return false;

			const s = getComputedStyle(m);
			if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;

			const r = m.getBoundingClientRect();
			return r.width > 0 && r.height > 0;
		}

		/* =========================================================
	   SECTION 12 — MAIN ANIMATION LOOP
	   ========================================================= */

		function animate(t) {

			if (!lastTime) lastTime = t;
			const dt = (t - lastTime) / 1000;
			lastTime = t;

			const v = speedSlider.value / 100;
			if (pauseBtn) pauseBtn.classList.toggle("paused", Math.abs(v) < 0.0001);
			const pausedNow = (Math.abs(v) < 0.0001) && !timeState.navTargetDateUTC;
			if (bumpRevBtn) bumpRevBtn.disabled = !pausedNow;
			if (bumpFwdBtn) bumpFwdBtn.disabled = !pausedNow;
			const rawSpeed = Math.pow(Math.abs(v), 3) * 250;
			const speed = (v > 0 ? rawSpeed : -rawSpeed);

			// Treat slider output as “selected units per second”
			const unitsPerSec = speed / PIX_PER_YEAR; // signed
			const yearsPerSec = unitsPerSec * (YEARS_PER_UNIT[speedUnit] || 1);

			if (speedInfo) {
				const n = Math.abs(unitsPerSec).toFixed(2);
				const u = (SPEED_UNIT_LABEL[speedUnit] || "y") + "/sec";
				speedInfo.innerHTML = `<span class="speedNum">${n}</span> <span class="speedUnit">${u}</span>`;
			}

			const MS_PER_YEAR = 365.2422 * 24 * 60 * 60 * 1000;

			// If user touches the slider, cancel any button-driven navigation
			if (Math.abs(v) > 0.0001) {
			timeState.navTargetDateUTC = null;
				// Disable live mode in astro wheel when user takes manual control
				if (typeof window.setAstroWheelLiveMode === "function") {
					window.setAstroWheelLiveMode(false);
				}
			}

			// --- BUTTON NAVIGATION (SMOOTH / LOG-STYLE EASE) ---
			if (timeState.navTargetDateUTC) {
				const curMs = timeState.dateUTC.getTime();
				const tgtMs = timeState.navTargetDateUTC.getTime();
				const deltaMs = tgtMs - curMs;

				// Exponential approach (feels logarithmic) and frame-rate independent
				const alpha = 1 - Math.pow(2, -10 * dt);
				const nextMs = curMs + deltaMs * alpha;

				// Only hard-snap when we're basically already there (sub-second)
				if (Math.abs(deltaMs) < 250) { // 0.25s
				AstroEngine.setDateUTC(timeState.navTargetDateUTC);
				timeState.navTargetDateUTC = null;
				} else {
				AstroEngine.setDateUTC(new Date(nextMs));
				}

			} else {
			// --- CONTINUOUS MOTION (SLIDER) ---
			const deltaYears = yearsPerSec * dt;
			if (deltaYears !== 0) {
				AstroEngine.setDateUTC(
				new Date(timeState.dateUTC.getTime() + deltaYears * MS_PER_YEAR)
				);
			}
			}

			// --- PROJECTION: DATE → SCROLL ---
			scrollX = dateToScrollX(timeState.dateUTC);
			timeState.scrollX = scrollX;

			// Canonical hinge: 0px in time (SCREW_EPOCH_X) must align to label box left
			nowX = getNowScreenX();   // reuse global
			const screwTranslateX = nowX - SCREW_EPOCH_X + scrollX;

			scrollGroup.setAttribute(
				"transform",
				`translate(${screwTranslateX}, ${CANON.SCREW_TOP_PAD + EXTRA_SCREW_TOP_PAD})`
			);

			updateLabels(scrollX);
			updateDate();
			updateElementButtonLabels();
			if (typeof updateSaeculumGlow === "function") updateSaeculumGlow();
			// 3D River backdrop (Phase 1): follow the master time flow
			if (window.River3D) {
			// keep band + NOW edge updated
			syncRiverClip();

			River3D.update({
				dt,
				yearsPerSec: (Math.abs(yearsPerSec) < 0.0001) ? 0 : yearsPerSec
				});
			}

			// Only redraw the wheel when the modal is open, and throttle redraw rate.
			const wheelModal = document.getElementById("wheelModal");
			const wheelOpen = isWheelOpen();

			if (wheelOpen) {
				if ((t - lastWheelDrawMs) >= WHEEL_FRAME_MS) {
					// Only compute/draw wheel when it's open (prevents Swiss calls when wheel is closed)
					const wheelOpen = (typeof isWheelOpen === "function") ? isWheelOpen() : true;

					if (wheelOpen) {
					if ((t - lastWheelDrawMs) >= WHEEL_FRAME_MS) {
						drawAstroWheel();
						lastWheelDrawMs = t;
					}
					}
					lastWheelDrawMs = t;
				}
				syncEventShield();
			}
			requestAnimationFrame(animate);
		}

	// =========================================================
	// ONE-TIME STATIC BUILD (SPLIT PACKAGE)
	// =========================================================
	if (typeof initScrewRenderer === "function") {
	  initScrewRenderer();
	}

	// Phase 1: mount the 3D river backdrop (safe no-op if missing)
		if (river3dContainer && window.River3D) {
		River3D.init("river3dContainer");

		// Immediately set band + NOW edge once (prevents "start point too far right" on refresh)
		if (typeof syncRiverClip === "function") syncRiverClip();
		}


	// Ensure layout/shield is correct AFTER the DOM has painted once
		requestAnimationFrame(() => {
		syncTimeMarkerLayout();
		syncScrewSVGHeight();
		syncEventShield();

		// ✅ lock river into the screw band immediately after first paint
		if (window.River3D) {
			syncRiverClip();
		}
		});

	// 🔁 Start loop (only once)
	requestAnimationFrame(animate);

	// 📷 When the sky map loads, force a redraw (optional but fine)
	const wheelImgEl = document.getElementById("wheelImg");
	if (wheelImgEl) {
	wheelImgEl.onload = () => {
		requestWheelRedraw();
		};
	};
	

