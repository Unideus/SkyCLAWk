/* ui-controller.js — DOM wiring + animation loop */
/* =========================================================
			SECTION 08 — DOM REFERENCES
	========================================================= */

	const DIAG_LABEL_Y_OFFSET = -18;
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
	const timeBoxInput = document.getElementById("timeBoxInput");
	const locationBoxInput = document.getElementById("locationBoxInput");
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

	const SPEED_UNITS = ["yrs", "months", "weeks", "days", "hours", "minutes"];

	const SPEED_UNIT_LABEL = {
	yrs: " yr",
	months: " mo",
	weeks: " wk",
	days: " dy",
	hours: " hr",
	minutes: " min",
	};

	const SPEED_UNIT_KNOB = {
	yrs: "yrs",
	months: "mo",
	weeks: "wk",
	days: "day",
	hours: "hr",
	minutes: "min",
	};

	// How many YEARS are in 1 unit (so: yearsPerSec = unitsPerSec * YEARS_PER_UNIT[unit])
	const YEARS_PER_UNIT = {
	yrs: 1,
	months: 1 / 12,
	weeks: 7 / 365.2422,
	days: 1 / 365.2422,
	hours: 1 / (365.2422 * 24),
	minutes: 1 / (365.2422 * 24 * 60),
	};

	let speedUnit = localStorage.getItem("zy_speed_unit") || "yrs";
	let lastTime = 0;
	// Planting fork: keep Personal shell behavior, but highlight the isolated route.
	let timelineScale = "planting";

	function setTimelineScale(nextScale) {
		if (!scaleSelector) return;
		if (!nextScale) nextScale = "planting";
		if (!/^(skyclock|generational|personal|planting)$/.test(nextScale)) nextScale = "planting";

		timelineScale = nextScale;
		localStorage.setItem("zy_timeline_scale", timelineScale);
		scaleSelector.dataset.scale = timelineScale;

		// Highlight active button
		scaleSelector.querySelectorAll(".scaleOpt").forEach(btn => {
			btn.classList.toggle("active", btn.dataset.scale === timelineScale);
		});
	}

	function setSpeedUnit(nextUnit) {
		if (!YEARS_PER_UNIT[nextUnit]) nextUnit = "yrs";
		speedUnit = nextUnit;
		localStorage.setItem("zy_speed_unit", speedUnit);

		const i = Math.max(0, SPEED_UNITS.indexOf(speedUnit));

		// Thumb position: dynamic spacing based on tick count
		if (unitKnob) {
			const totalTicks = SPEED_UNITS.length;
			const edgeInset = 7;
			const stepSize = (100 - (edgeInset * 2)) / (totalTicks - 1);
			unitKnob.style.setProperty("--unit-i", String(i));
			unitKnob.style.setProperty("--unit-p", `${edgeInset + (i * stepSize)}%`);
		}

		// Black letter inside the thumb
		if (unitKnobThumb) {
			const THUMB_LETTER = { yrs: "Y", months: "M", weeks: "W", days: "D", hours: "H", minutes: "M" };
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
		const edgeInsetPx = r.width * 0.07;

		// Clamp within usable travel range (track width - thumb width)
		const minX = r.left + edgeInsetPx;
		const maxX = r.right - edgeInsetPx;

		const clamped = Math.min(maxX, Math.max(minX, clientX));
		const t = (clamped - minX) / (maxX - minX);  // 0..1
		const idx = Math.round(t * (SPEED_UNITS.length - 1));
		return Math.max(0, Math.min(5, idx));
		}

		function setSpeedUnitByIndex(idx) {
		const unit = SPEED_UNITS[Math.max(0, Math.min(5, idx))] || "yrs";
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

		const viewportBounds = typeof getPlantingViewportBounds === "function"
			? getPlantingViewportBounds()
			: screwSVGEl.getBoundingClientRect();
		
		// CATHEDRAL: expose the bottom edge of the top menu so fixed overlays can sit below it
		if (topMenu) {
			const tr = topMenu.getBoundingClientRect();
			document.documentElement.style.setProperty("--top-menu-bottom", `${Math.round(tr.bottom)}px`);
		}

		// labelSVG bottom anchors to TIMELINE_Y (X-axis at bottom of bands)
		{
			const scrollGroupY = CANON.SCREW_TOP_PAD + EXTRA_SCREW_TOP_PAD;
			const xAxisY = viewportBounds.top + scrollGroupY + CANON.TIMELINE_Y;
			const labelHeight = 180; // matches labelSVG height=180 in planting/index.html
			const topMenuBottom = topMenu ? Math.round(topMenu.getBoundingClientRect().bottom) : 0;
			const labelTop = Math.max(topMenuBottom, Math.round(xAxisY - labelHeight));
			document.documentElement.style.setProperty("--label-top", `${labelTop}px`);
			document.documentElement.style.setProperty("--label-height", `${labelHeight}px`);
		}


		// Planting: NOW_X is the center of the visible timeline viewport.
		const markerLeft = Math.round(
			typeof getPlantingNowViewportX === "function"
				? getPlantingNowViewportX()
				: (viewportBounds.left + getNowScreenX())
		);
		document.documentElement.style.setProperty("--time-marker-left", `${markerLeft}px`);

		// CATHEDRAL: time spine begins at the TOP of the diagonal/body field (not the menu)
		const markerTop = Math.round(viewportBounds.top + CANON.SCREW_TOP_PAD + EXTRA_SCREW_TOP_PAD - 10);
		document.documentElement.style.setProperty("--time-marker-top", `${markerTop}px`);

		const nowY = Math.round(viewportBounds.top + CANON.SCREW_TOP_PAD + EXTRA_SCREW_TOP_PAD - 10);
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

			const viewportBounds = typeof getPlantingViewportBounds === "function"
				? getPlantingViewportBounds()
				: svg.getBoundingClientRect();
			const nowBoundaryScreenX = typeof getPlantingNowViewportX === "function"
				? getPlantingNowViewportX()
				: (viewportBounds.left + getNowScreenX());

			River3D.setXEdge(nowBoundaryScreenX);
			River3D.setXClip(viewportBounds.left, nowBoundaryScreenX);
			
			// ✅ Archetype box river (labelSVG)
				if (labelSVGEl && typeof River3D.setLabelRect === "function") {
				const lr = labelSVGEl.getBoundingClientRect();
				River3D.setLabelRect(lr.left, lr.top, lr.right, lr.bottom);
				}
			}


		window.addEventListener("resize", () => {
			if (typeof syncRiverClip === "function") syncRiverClip();
		});

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
		
		const natalToggle = document.getElementById("hudNatalBtn");

		// --- Natal button text lives ON the button (no extra box) ---
		const setNatalToggleText = () => {
		if (!natalToggle) return;

		// Always fixed-width label so the button never "jumps"
		if (window.NatalChart && window.NatalChart.dateUTC instanceof Date) {
			const d = window.NatalChart.dateUTC;
			const tz = window.locationData?.tz;
			// Format date/time + tz label all in one shot using city's timezone
			const fmt = Intl.DateTimeFormat("en-US", {
				year: "numeric", month: "short", day: "2-digit",
				hour: "2-digit", minute: "2-digit", hour12: true,
				timeZoneName: "short", timeZone: tz || undefined
			});
			const parts = fmt.formatToParts(d);
			const get = (t) => parts.find(p => p.type === t)?.value ?? "";
			const dd = get("day");
			const mon = get("month");
			const yyyy = get("year");
			const hr = get("hour");
			const mn = get("minute");
			const ap = get("dayPeriod");
			const timeStr = (hr && mn) ? `${hr}:${mn}${ap}` : "";
			const tzLabel = get("timeZoneName");
			natalToggle.textContent = timeStr
				? `Natal ${dd} ${mon} ${yyyy} ${timeStr} ${tzLabel}`
				: `Natal ${dd} ${mon} ${yyyy} ${tzLabel}`;
		} else {
			natalToggle.textContent = "Natal -- --- ----";
		}

		natalToggle.classList.toggle("active", !!(window.NatalChart && window.NatalChart.enabled));
		};

	// initial sync (on load)
	setNatalToggleText();

	// Natal button - set current timeline date as natal chart
	if (natalToggle) {
	  natalToggle.addEventListener("click", () => {
		// Toggle off if already enabled
		if (window.NatalChart && window.NatalChart.enabled) {
			window.NatalChart.enabled = false;
			const natalBtn = document.getElementById("hudNatalBtn");
			if (natalBtn) natalBtn.classList.remove("active");
			if (typeof drawAstroWheel === "function") drawAstroWheel();
			return;
		}
		const now = (timeState.navTargetDateUTC instanceof Date) ? timeState.navTargetDateUTC : timeState.dateUTC;
		if (now instanceof Date && !Number.isNaN(now.getTime())) {
			const natalUTC = new Date(now.getTime());

			if (!window.NatalChart) window.NatalChart = { enabled:false, dateUTC:null, longitudes:null };
			if (typeof window.NatalChart.setDateUTC === "function") {
				window.NatalChart.setDateUTC(natalUTC);
			}
			window.NatalChart.dateUTC = natalUTC;
			window.NatalChart.enabled = true;

			// Move aspects grid inward to make room for natal houses
			const aspectsOverlay = document.getElementById("wheelAspectsOverlay");
			if (aspectsOverlay) aspectsOverlay.classList.add("natal-active");

			if (typeof drawAstroWheel === "function") drawAstroWheel();

			const natalBtn = document.getElementById("hudNatalBtn");
			if (natalBtn) {
				// Show the timezone of the selected city (or browser local if none)
				const fmt = Intl.DateTimeFormat("en-US", {
					year: "numeric", month: "short", day: "2-digit",
					hour: "2-digit", minute: "2-digit", hour12: true,
					timeZoneName: "short", timeZone: tz || undefined
				});
				const parts = fmt.formatToParts(natalUTC);
				const get = (t) => parts.find(p => p.type === t)?.value ?? "";
				const dd = get("day");
				const mon = get("month");
				const yyyy = get("year");
				const hr = get("hour");
				const mn = get("minute");
				const ap = get("dayPeriod");
				const timeStr = (hr && mn) ? `${hr}:${mn}${ap}` : "";
				const tzLabel = get("timeZoneName");
				natalBtn.textContent = timeStr
					? `Natal ${dd} ${mon} ${yyyy} ${timeStr} ${tzLabel}`
					: `Natal ${dd} ${mon} ${yyyy} ${tzLabel}`;
				natalBtn.classList.toggle("active", true);
			}
		}
	  });
	}

	// ================================================================
	// NATAL PICKER — Date/Time/Location/Set/Clear
	// ================================================================

	// --- DOM refs ---
	const natalPicker           = document.getElementById("natalPicker");
	const natalDateInput        = document.getElementById("natalDateInput");
	const natalTimeInput        = document.getElementById("natalTimeInput");
	const natalLocationInput    = document.getElementById("natalLocationInput");
	const natalLocationDropdown = document.getElementById("natalLocationDropdown");
	const natalSetBtn           = document.getElementById("natalSetBtn");
	const natalCancelBtn        = document.getElementById("natalCancelBtn");

	window.natalLocationData = null;
	let natalCities = null;
	let selectedNatalCityIndex = -1;

	// --- Load cities.json once (async, cached) ---
	function loadNatalCities() {
		if (natalCities) return Promise.resolve(natalCities);
		return fetch("../data/cities.json")
			.then(r => r.json())
			.then(data => { natalCities = data; return natalCities; });
	}

	// --- Location dropdown: filter + show ---
	function showNatalDropdown(query) {
		if (!natalCities) return;
		const q = query.toLowerCase();
		const results = natalCities.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
		if (!results.length) { natalLocationDropdown.style.display = "none"; return; }
		const html = results.map((c, i) =>
			`<div class="location-dropdown-item" data-index="${i}" data-lat="${c.lat}" data-lon="${c.lon}" data-tz="${c.tz}" data-name="${c.name.replace(/"/g,"'")}">${c.name} <span>${c.tz}</span></div>`
		).join("");
		natalLocationDropdown.innerHTML = html;
		natalLocationDropdown.style.display = "block";
		natalLocationDropdown.querySelectorAll(".location-dropdown-item").forEach(el => {
			el.addEventListener("mousedown", (e) => {
				e.preventDefault();
				const idx = parseInt(el.dataset.index);
				const city = results[idx];
				// Store temporarily, don't apply until Set is clicked
				pendingNatalLocation = { name: city.name, lat: city.lat, lon: city.lon, tz: city.tz };
				natalLocationInput.value = city.name;
				natalLocationDropdown.style.display = "none";
				selectedNatalCityIndex = -1;
			});
		});
	}

	// --- Natal location input: type or focus ---
	if (natalLocationInput) {
		natalLocationInput.addEventListener("focus", () => {
			loadNatalCities().then(() => showNatalDropdown(natalLocationInput.value));
		});
		natalLocationInput.addEventListener("input", () => {
			loadNatalCities().then(() => showNatalDropdown(natalLocationInput.value));
			selectedNatalCityIndex = -1;
		});
		natalLocationInput.addEventListener("keydown", (e) => {
			const items = natalLocationDropdown.querySelectorAll(".location-dropdown-item");
			if (!items.length) return;
			if (e.key === "ArrowDown") { e.preventDefault(); selectedNatalCityIndex = Math.min(selectedNatalCityIndex + 1, items.length - 1); items[selectedNatalCityIndex].scrollIntoView(); }
			else if (e.key === "ArrowUp") { e.preventDefault(); selectedNatalCityIndex = Math.max(selectedNatalCityIndex - 1, 0); items[selectedNatalCityIndex].scrollIntoView(); }
			else if (e.key === "Enter" && selectedNatalCityIndex >= 0) {
				items[selectedNatalCityIndex].dispatchEvent(new MouseEvent("mousedown"));
			} else if (e.key === "Escape") { natalLocationDropdown.style.display = "none"; selectedNatalCityIndex = -1; }
		});
		document.addEventListener("click", (e) => {
			if (!natalLocationDropdown.contains(e.target) && e.target !== natalLocationInput) {
				natalLocationDropdown.style.display = "none";
			}
		});
	}

	// Temp storage for natal location (only applied on Set)
	let pendingNatalLocation = null;

	// --- Get timezone offset in ms for a given IANA tz string ---
	function getTzOffsetMs(tz, localDate) {
		if (!tz || !localDate) return 0;
		try {
			const parts = new Intl.DateTimeFormat("en-US", {
				timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
				hour: "numeric", minute: "numeric", second: "numeric"
			}).formatToParts(localDate);
			const get = (t) => parseInt(parts.find(p => p.type === t)?.value || "0");
			const wall = new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")));
			return wall.getTime() - localDate.getTime();
		} catch (e) { return 0; }
	}

	// --- Fallback: hardcoded Hawaii detection ---
	function detectHawaiiFallback(locStr) {
		if (!locStr) return null;
		const s = locStr.toLowerCase();
		if (s.includes("kailua") || s.includes("kona") || s.includes("honolulu") || s.includes("hawaii")) {
			return { name: "Hawaii, USA", lat: 19.8968, lon: -155.5828, tz: "Pacific/Honolulu" };
		}
		return null;
	}

	// --- SET button ---
	if (natalSetBtn) {
		natalSetBtn.addEventListener("click", () => {
			try {
				const dateStr = natalDateInput ? natalDateInput.value : "";
				const timeStr = natalTimeInput ? natalTimeInput.value : "12:00";
				const locStr  = natalLocationInput ? natalLocationInput.value.trim() : "";

				if (!dateStr) { console.warn("[natalSet] no date"); return; }

				const [y, m, d] = dateStr.split("-").map(Number);
				const [hr, mi]  = timeStr.split(":").map(Number);
				if (!y || !m || !d) { console.warn("[natalSet] bad date"); return; }

				// Resolve timezone from selected location
				let tz = window.natalLocationData?.tz || null;
				// Use pending location if available (user just selected from dropdown)
				if (pendingNatalLocation) {
					tz = pendingNatalLocation.tz;
					window.natalLocationData = { ...pendingNatalLocation };
					pendingNatalLocation = null;
				}
				if (!tz && locStr) {
					const fallback = detectHawaiiFallback(locStr);
					if (fallback) { tz = fallback.tz; window.natalLocationData = fallback; }
				}
				
				// Convert local wall-clock time to UTC using timezone
				let natalUTC;
				if (tz) {
					// Parse the local date/time string
					const localStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(hr||0).padStart(2,'0')}:${String(mi||0).padStart(2,'0')}:00`;
					// Use Intl to get the UTC equivalent
					// Format a date in the target timezone and extract the UTC components
					const formatter = new Intl.DateTimeFormat("en-US", {
						timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
						hour: "numeric", minute: "numeric", second: "numeric", hour12: false
					});
					// Iterate to find the UTC time that produces our target local time
					// Start with a guess and adjust
					let guess = new Date(Date.UTC(y, m - 1, d, hr || 0, mi || 0, 0));
					for (let i = 0; i < 5; i++) {
						const parts = formatter.formatToParts(guess);
						const get = (t) => parseInt(parts.find(p => p.type === t)?.value || "0");
						const yearL = get("year"), monthL = get("month"), dayL = get("day");
						const hourL = get("hour"), minL = get("minute"), secL = get("second");
						const localFromGuess = new Date(Date.UTC(yearL, monthL-1, dayL, hourL, minL, secL));
						const targetLocal = new Date(Date.UTC(y, m-1, d, hr||0, mi||0, 0));
						const diff = targetLocal.getTime() - localFromGuess.getTime();
						guess = new Date(guess.getTime() + diff);
						if (Math.abs(diff) < 1000) break;
					}
					natalUTC = guess;
				} else {
					// No timezone - treat input as UTC
					natalUTC = new Date(Date.UTC(y, m - 1, d, hr || 0, mi || 0, 0));
				}

				if (!window.NatalChart) window.NatalChart = { enabled: false, dateUTC: null, longitudes: null };
				if (typeof window.NatalChart.setDateUTC === "function") {
					window.NatalChart.setDateUTC(natalUTC);
				}
				window.NatalChart.dateUTC = natalUTC;
				window.NatalChart.enabled = true;

				if (typeof drawAstroWheel === "function") drawAstroWheel();
			} catch(e) {
				console.error("[natalSet] ERROR:", e.message, e.stack);
			}
		});
	}

	// --- CANCEL/CLEAR button ---
	if (natalCancelBtn) {
		natalCancelBtn.addEventListener("click", () => {
			if (window.NatalChart) { window.NatalChart.enabled = false; window.NatalChart.longitudes = null; }
			window.natalLocationData = null;
			if (natalDateInput) natalDateInput.value = "";
			if (natalTimeInput) natalTimeInput.value = "12:00";
			if (natalLocationInput) natalLocationInput.value = "";
			if (natalLocationDropdown) natalLocationDropdown.style.display = "none";
			const natalToggle = document.getElementById("hudNatalBtn");

			// Move aspects grid back to normal position
			const aspectsOverlay = document.getElementById("wheelAspectsOverlay");
			if (aspectsOverlay) aspectsOverlay.classList.remove("natal-active");
			if (natalToggle) {
				natalToggle.textContent = "Natal -- --- ----";
				natalToggle.classList.remove("active");
			}
			if (typeof drawAstroWheel === "function") drawAstroWheel();
		});
	}

	// Import date control click handler
	const importToNatalBtn = document.getElementById("importToNatalBtn");
	function importDateToNatal() {
		const t = timeState.dateUTC;
		if (!t) return;
		// Get the timezone from main location and display local time
		const tz = window.locationData?.tz;
		if (tz) {
			// Format date/time in the location's timezone
			const parts = new Intl.DateTimeFormat("en-US", {
				timeZone: tz,
				year: "numeric", month: "2-digit", day: "2-digit",
				hour: "2-digit", minute: "2-digit", hour12: false
			}).formatToParts(t);
			const g = (type) => parts.find(p => p.type === type)?.value ?? "";
			const year = g("year");
			const month = g("month");
			const day = g("day");
			const hours = g("hour");
			const mins = g("minute");
			if (natalDateInput) natalDateInput.value = `${year}-${month}-${day}`;
			if (natalTimeInput) natalTimeInput.value = `${hours}:${mins}`;
		} else {
			// Fallback to local browser time
			const year = t.getFullYear();
			const month = String(t.getMonth() + 1).padStart(2, "0");
			const day = String(t.getDate()).padStart(2, "0");
			const hours = String(t.getHours()).padStart(2, "0");
			const mins = String(t.getMinutes()).padStart(2, "0");
			if (natalDateInput) natalDateInput.value = `${year}-${month}-${day}`;
			if (natalTimeInput) natalTimeInput.value = `${hours}:${mins}`;
		}
		// Import location from main input - store as pending, don't apply yet
		const mainLocationInput = document.getElementById("locationBoxInput");
		if (mainLocationInput && natalLocationInput) {
			natalLocationInput.value = mainLocationInput.value;
			// Store location data as pending (only applied on Set)
			if (window.locationData) {
				pendingNatalLocation = { ...window.locationData };
			}
		}
	}
	if (importToNatalBtn) importToNatalBtn.addEventListener("click", importDateToNatal);

/* ============================================================
   SECTION 08.1 — CONTROL WIRING (INTERACTION BEHAVIOR)
   ============================================================ */

	   
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
			if (unit === "minutes") {
				return new Date(d.getTime() + dir * 60 * 1000);
			}
			return d;
			}

		function bumpBySelectedUnit(dir){
		if (!isPausedNow()) return;

		const cur = timeState.dateUTC; // canonical current date
		const next = addUnitUTC(cur, speedUnit, dir);

		// instant jump (not a glide), but only while paused
		timeState.navTargetDateUTC = null;
		
		// Disable live mode so the wheel reads from timeState.dateUTC instead of new Date()
		if (typeof window.setAstroWheelLiveMode === "function") {
			window.setAstroWheelLiveMode(false);
		}
		
		AstroEngine.setDateUTC(next);

		updateDate();
		if (typeof drawAstroWheel === "function") drawAstroWheel();
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

				const order = ["skyclock", "generational", "personal", "planting"];
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
			if (typeof drawAstroWheel === "function") drawAstroWheel();
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
				const commitNatalFromYMD = (natalUTC) => {
					console.log("[commitNatalFromYMD] called, natalUTC:", natalUTC);

					if (!window.NatalChart) window.NatalChart = { enabled:false, dateUTC:null, longitudes:null };

					// compute natal longitudes if your setter exists
					if (typeof window.NatalChart.setDateUTC === "function") {
						window.NatalChart.setDateUTC(natalUTC);
					}

					window.NatalChart.dateUTC = natalUTC;
					window.NatalChart.enabled = true;

				// Force wheel redraw to show natal positions
				if (typeof drawAstroWheel === "function") {
					drawAstroWheel();
				}

					// Keep Natal button text + state in sync (single button, no extra box)
					const natalBtn = document.getElementById("hudNatalBtn");
					if (natalBtn) {
						const tz = window.locationData?.tz;
					if (!tz) { console.warn("[applyDateBox] NO tz — city not selected from dropdown? Input:", dateBoxInput.value, "timeBoxInput:", timeBoxInput && timeBoxInput.value); }
						const fmt = Intl.DateTimeFormat("en-US", {
							year: "numeric", month: "short", day: "2-digit",
							hour: "2-digit", minute: "2-digit", hour12: true,
							timeZoneName: "short", timeZone: tz || undefined
						});
						const parts = fmt.formatToParts(natalUTC);
						const get = (t) => parts.find(p => p.type === t)?.value ?? "";
						const dd = get("day");
						const mon = get("month");
						const yyyy = get("year");
						const hr = get("hour");
						const mn = get("minute");
						const ap = get("dayPeriod");
						const timeStr = (hr && mn) ? `${hr}:${mn}${ap}` : "";
						const tzLabel = get("timeZoneName");
						natalBtn.textContent = timeStr
							? `Natal ${dd} ${mon} ${yyyy} ${timeStr} ${tzLabel}`
							: `Natal ${dd} ${mon} ${yyyy} ${tzLabel}`;
						natalBtn.classList.toggle("active", true);
					}
				};

				window.commitNatalFromYMD = commitNatalFromYMD;

				const applyDateBox = () => {
					// IMPORTANT: use pending value first (survives blur->revert issues)
					const v = ((dateBoxInput.dataset.pending || dateBoxInput.value || "") + "").trim();
					if (!v) {
						return;
					}

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


					// Read time from timeBoxInput and use it for the target date
					const timeBoxInput = document.getElementById("timeBoxInput");
					let hours = 12, minutes = 0;
					if (timeBoxInput && timeBoxInput.value) {
					  const timeParts = timeBoxInput.value.split(":");
					  if (timeParts.length >= 2) {
					    hours = Number(timeParts[0]) || 0;
					    minutes = Number(timeParts[1]) || 0;
					  }
					}

					// Convert local input time to UTC for storage
					// Formula: UTC = local_wall_clock + tzOffset  [where tzOffset < 0 for west of UTC]
					// getTzOffsetMs returns the raw offset for the date, so ADD it (subtract negative)
					const tz = window.locationData?.tz;
					if (!tz) { console.warn("[applyDateBox] NO tz — city not selected from dropdown? Input:", dateBoxInput.value, "timeBoxInput:", timeBoxInput && timeBoxInput.value); }
					const localMs = Date.UTC(y, m - 1, d, hours, minutes, 0);
					let target;
					if (tz) {
						const tzOffset = getTzOffsetMs(tz, new Date(localMs));
						target = new Date(localMs - tzOffset); // subtract negative = add
											} else {
						target = new Date(localMs);
						console.log("[applyDateBox] NO TZ: y=" + y + " m=" + m + " d=" + d + " h=" + hours + " mi=" + minutes + " | localMs=" + localMs + " target=" + target.getTime());
					}

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

					// ✅ Disable live mode in astro wheel when user enters a manual date
					if (typeof window.setAstroWheelLiveMode === "function") {
						window.setAstroWheelLiveMode(false);
					}

					// ✅ Force wheel redraw if open
					if (typeof drawAstroWheel === "function" && typeof isWheelOpen === "function" && isWheelOpen()) {
						drawAstroWheel();
					}
					
					// ✅ Also request redraw for when wheel opens later
					if (typeof requestWheelRedraw === "function") {
						requestWheelRedraw();
					}

					// Sync the natal button label (NOT natal commit — GO is for transits only)
					setNatalToggleText();
				};

				dateBoxInput.addEventListener("input", markDirty);

				// ✅ CRITICAL FIX:
				// Don't revert on blur - let user tab to other inputs freely
				// Only revert when Escape key is pressed
				const timeBoxInput = document.getElementById("timeBoxInput");
				const locationBoxInput = document.getElementById("locationBoxInput");
			const locationDropdown = document.getElementById("locationDropdown");
			let citiesData = [];
			let selectedLocationIndex = -1;

			// Load cities on first focus
			async function loadCities() {
				if (citiesData.length) return;
				try {
					const res = await fetch("../data/cities.json");
					citiesData = await res.json();
				} catch(e) { console.warn("[location] failed to load cities.json", e); }
			}

			// Auto-detect user's location on page load
			async function detectUserLocation() {
				try {
					// Try browser geolocation first
					if (navigator.geolocation) {
						const position = await new Promise((resolve, reject) => {
							navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
						});
						const { latitude, longitude } = position.coords;
						
						// Find nearest city from our database
						if (citiesData.length) {
							let nearest = null;
							let minDist = Infinity;
							for (const city of citiesData) {
								const dLat = city.lat - latitude;
								const dLon = city.lon - longitude;
								const dist = dLat * dLat + dLon * dLon; // Simple distance approximation
								if (dist < minDist) {
									minDist = dist;
									nearest = city;
								}
							}
							if (nearest) {
								window.locationData = { lat: nearest.lat, lon: nearest.lon, tz: nearest.tz };
								if (locationBoxInput) locationBoxInput.value = `${nearest.name}, ${nearest.country}`;
								console.log(`[location] Auto-detected: ${nearest.name}, ${nearest.country}`);
								// Menu grew — recompute label/box positions
								requestAnimationFrame(() => { syncTimeMarkerLayout(); syncScrewSVGHeight(); });
								return;
							}
						}
					}
					
					// Fallback: use browser timezone to find a major city
					const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
					const majorCities = {
						"America/New_York": { name: "New York", country: "US", lat: 40.7128, lon: -74.0060, tz: "America/New_York" },
						"America/Chicago": { name: "Chicago", country: "US", lat: 41.8781, lon: -87.6298, tz: "America/Chicago" },
						"America/Denver": { name: "Denver", country: "US", lat: 39.7392, lon: -104.9903, tz: "America/Denver" },
						"America/Los_Angeles": { name: "Los Angeles", country: "US", lat: 34.0522, lon: -118.2437, tz: "America/Los_Angeles" },
						"America/Phoenix": { name: "Phoenix", country: "US", lat: 33.4484, lon: -112.0740, tz: "America/Phoenix" },
						"America/Anchorage": { name: "Anchorage", country: "US", lat: 61.2181, lon: -149.9003, tz: "America/Anchorage" },
						"Pacific/Honolulu": { name: "Honolulu", country: "US", lat: 21.3099, lon: -157.8581, tz: "Pacific/Honolulu" },
						"Europe/London": { name: "London", country: "UK", lat: 51.5074, lon: -0.1278, tz: "Europe/London" },
						"Europe/Paris": { name: "Paris", country: "FR", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" },
						"Europe/Berlin": { name: "Berlin", country: "DE", lat: 52.5200, lon: 13.4050, tz: "Europe/Berlin" },
						"Asia/Tokyo": { name: "Tokyo", country: "JP", lat: 35.6762, lon: 139.6503, tz: "Asia/Tokyo" },
						"Australia/Sydney": { name: "Sydney", country: "AU", lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" },
					};
					
					const city = majorCities[browserTz];
					if (city) {
						window.locationData = { lat: city.lat, lon: city.lon, tz: city.tz };
						if (locationBoxInput) locationBoxInput.value = `${city.name}, ${city.country}`;
						console.log(`[location] Auto-detected from timezone: ${city.name}, ${city.country}`);
						// Menu grew — recompute label/box positions
						requestAnimationFrame(() => { syncTimeMarkerLayout(); syncScrewSVGHeight(); });
					} else {
						// Last resort: use first city in database
						const fallback = citiesData[0];
						if (fallback) {
							window.locationData = { lat: fallback.lat, lon: fallback.lon, tz: fallback.tz };
							if (locationBoxInput) locationBoxInput.value = `${fallback.name}, ${fallback.country}`;
						}
					}
				} catch(e) {
					console.warn("[location] Auto-detection failed:", e);
					// Guaranteed fallback: use timezone or default to New York
					const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
					const majorCities = {
						"America/New_York": { name: "New York", country: "US", lat: 40.7128, lon: -74.0060, tz: "America/New_York" },
						"America/Chicago": { name: "Chicago", country: "US", lat: 41.8781, lon: -87.6298, tz: "America/Chicago" },
						"America/Denver": { name: "Denver", country: "US", lat: 39.7392, lon: -104.9903, tz: "America/Denver" },
						"America/Los_Angeles": { name: "Los Angeles", country: "US", lat: 34.0522, lon: -118.2437, tz: "America/Los_Angeles" },
						"America/Phoenix": { name: "Phoenix", country: "US", lat: 33.4484, lon: -112.0740, tz: "America/Phoenix" },
						"America/Anchorage": { name: "Anchorage", country: "US", lat: 61.2181, lon: -149.9003, tz: "America/Anchorage" },
						"Pacific/Honolulu": { name: "Honolulu", country: "US", lat: 21.3099, lon: -157.8581, tz: "Pacific/Honolulu" },
						"Europe/London": { name: "London", country: "UK", lat: 51.5074, lon: -0.1278, tz: "Europe/London" },
						"Europe/Paris": { name: "Paris", country: "FR", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" },
						"Europe/Berlin": { name: "Berlin", country: "DE", lat: 52.5200, lon: 13.4050, tz: "Europe/Berlin" },
						"Asia/Tokyo": { name: "Tokyo", country: "JP", lat: 35.6762, lon: 139.6503, tz: "Asia/Tokyo" },
						"Australia/Sydney": { name: "Sydney", country: "AU", lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" },
					};
					const city = majorCities[browserTz] || majorCities["America/New_York"];
					window.locationData = { lat: city.lat, lon: city.lon, tz: city.tz };
					if (locationBoxInput) locationBoxInput.value = `${city.name}, ${city.country}`;
					console.log(`[location] Using fallback: ${city.name}, ${city.country}`);
				}
			}

			// Initialize location detection after cities are loaded
			loadCities().then(async () => {
				await detectUserLocation();
				if (typeof window.refreshPlantingGuidanceBands === "function") {
					window.refreshPlantingGuidanceBands();
				}
				if (typeof drawAstroWheel === "function") {
					drawAstroWheel();
				}
			});

			function searchCities(q) {
				if (!citiesData.length || !q) return [];
				const lower = q.toLowerCase();
				return citiesData
					.filter(c => c.name.toLowerCase().includes(lower) || c.country.toLowerCase().includes(lower))
					.slice(0, 8);
			}

			function showDropdown(results) {
				if (!locationDropdown) return;
				selectedLocationIndex = -1;
				if (!results.length) { locationDropdown.style.display = "none"; return; }
				let html = "";
				results.forEach((c, i) => {
					html += `<div class="location-dropdown-item" data-index="${i}">
						<span class="city-name">${c.name}</span>
						<span class="city-country">${c.country} · ${c.tz}</span>
					</div>`;
				});
				locationDropdown.innerHTML = html;
				locationDropdown.style.display = "block";
				locationDropdown.querySelectorAll(".location-dropdown-item").forEach(el => {
					el.addEventListener("mousedown", (e) => {
						e.preventDefault();
						const idx = Number(el.dataset.index);
							pickCity(results[idx]);
						});
				});
			}

			function pickCity(city) {
				if (!locationBoxInput || !city) return;
				locationBoxInput.value = city.name;
				if (locationDropdown) locationDropdown.style.display = "none";
				// Store lat/lon/tz on window for house calculations
				window.locationData = { lat: city.lat, lon: city.lon, tz: city.tz };
				if (typeof window.refreshPlantingGuidanceBands === "function") {
					window.refreshPlantingGuidanceBands();
				}
														// Clear house cache so new location takes effect immediately
				if (window.__houseCache) window.__houseCache.clear();
				// Redraw wheel with new house cusps and updated timezone
				if (typeof drawAstroWheel === "function") {
					drawAstroWheel();
				}
			}

			// Expose for GO button to use
			window.__pickCity = pickCity;

			locationBoxInput.addEventListener("focus", () => { loadCities().then(() => showDropdown(searchCities(locationBoxInput.value.trim()))); });
			locationBoxInput.addEventListener("input", () => {
				const q = locationBoxInput.value.trim();
				if (!citiesData.length) return;
				showDropdown(searchCities(q));
			});
			locationBoxInput.addEventListener("keydown", (e) => {
				const items = locationDropdown ? locationDropdown.querySelectorAll(".location-dropdown-item") : [];
				if (!items.length) return;
				if (e.key === "ArrowDown") { e.preventDefault(); selectedLocationIndex = Math.min(selectedLocationIndex + 1, items.length - 1); items[selectedLocationIndex]?.scrollIntoView({ block: "nearest" }); }
				else if (e.key === "ArrowUp") { e.preventDefault(); selectedLocationIndex = Math.max(selectedLocationIndex - 1, -1); items[selectedLocationIndex]?.scrollIntoView({ block: "nearest" }); }
				else if (e.key === "Enter" && selectedLocationIndex >= 0) { e.preventDefault(); items[selectedLocationIndex].dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); }
				else if (e.key === "Escape") { locationDropdown.style.display = "none"; selectedLocationIndex = -1; }
			});
			// Close on outside click
			document.addEventListener("click", (e) => { if (locationDropdown && !locationDropdown.contains(e.target) && e.target !== locationBoxInput) locationDropdown.style.display = "none"; });
			loadCities(); // preload city list immediately

			locationBoxInput.removeAttribute("disabled");

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
					} else if (e.key === "Escape") {
						e.preventDefault();
						revertIfDirty();
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

	function dateToPlantingYearForUI(date) {
		const year = date.getUTCFullYear();
		const start = Date.UTC(year, 0, 1, 0, 0, 0);
		const next = Date.UTC(year + 1, 0, 1, 0, 0, 0);
		return year + ((date.getTime() - start) / (next - start));
	}

	function plantingYearToXForUI(yearValue) {
		return SCREW_EPOCH_X + (yearValue - 2020) * PX_PER_YEAR;
	}

	function dateToPlantingXForUI(date) {
		return plantingYearToXForUI(dateToPlantingYearForUI(date));
	}

	function dateToPlantingScrollX(date) {
		return SCREW_EPOCH_X - dateToPlantingXForUI(date);
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

	const PLANTING_SEASON_RGB = {
	  spring: "255,65,54",
	  summer: "0,116,217",
	  fall: "255,220,0",
	  winter: "46,204,64"
	};

	function getPlantingSeasonKey(date) {
	  const month = date.getUTCMonth() + 1;
	  const day = date.getUTCDate();
	  const md = (month * 100) + day;
	  if (md >= 320 && md < 621) return "spring";
	  if (md >= 621 && md < 922) return "summer";
	  if (md >= 922 && md < 1221) return "fall";
	  return "winter";
	}


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
		if (lifeCycleOverlay) lifeCycleOverlay.innerHTML = "";

		const rows = [
			{ glyph: "\u2648\uFE0E", label: "Spring", subtitle: "emergence / plant", color: "rgb(84, 22, 20)", glyphColor: "rgb(255, 65, 54)" },
			{ glyph: "\u264B\uFE0E", label: "Summer", subtitle: "growth / tend", color: "rgb(0, 38, 72)", glyphColor: "rgb(0, 116, 217)" },
			{ glyph: "\u264E\uFE0E", label: "Fall", subtitle: "harvest / protect", color: "rgb(84, 73, 0)", glyphColor: "rgb(255, 220, 0)" },
			{ glyph: "\u2651\uFE0E", label: "Winter", subtitle: "dormancy / plan", color: "rgb(15, 67, 21)", glyphColor: "rgb(46, 204, 64)" }
		];

		const winterAnchorX = dateToPlantingXForUI(new Date(Date.UTC(2020, 11, 21, 12, 0, 0)));
		const seasonalOffsets = [
			0,
			dateToPlantingXForUI(new Date(Date.UTC(2021, 2, 20, 12, 0, 0))) - winterAnchorX,
			dateToPlantingXForUI(new Date(Date.UTC(2021, 5, 21, 12, 0, 0))) - winterAnchorX,
			dateToPlantingXForUI(new Date(Date.UTC(2021, 8, 22, 12, 0, 0))) - winterAnchorX,
			dateToPlantingXForUI(new Date(Date.UTC(2021, 11, 21, 12, 0, 0))) - winterAnchorX
		];
		const cyclePx = seasonalOffsets[4];
		const worldXAtLabel = SCREW_EPOCH_X - scrollX;
		const phaseX = ((worldXAtLabel - winterAnchorX) % cyclePx + cyclePx) % cyclePx;
		let seasonIndex = 0;
		for (let i = 0; i < 4; i++) {
			if (phaseX >= seasonalOffsets[i] && phaseX < seasonalOffsets[i + 1]) {
				seasonIndex = i;
				break;
			}
		}
		const segmentStart = seasonalOffsets[seasonIndex];
		const segmentEnd = seasonalOffsets[seasonIndex + 1];
		const rowOffset = 3 + seasonIndex + ((phaseX - segmentStart) / (segmentEnd - segmentStart));

		for (let i = 0; i < 12; i++) {
			const idx = i % 4;
			const y = (i - rowOffset) * CANON.ROW_HEIGHT;
			if (y < -CANON.ROW_HEIGHT || y > CANON.ROW_HEIGHT * 4) continue;
			const row = rows[idx];

			const r = document.createElementNS(
				"http://www.w3.org/2000/svg","rect"
			);
			r.setAttribute("x",0);
			r.setAttribute("y",y);
			r.setAttribute("width",CANON.LABEL_WIDTH);
			r.setAttribute("height",CANON.ROW_HEIGHT);
			r.setAttribute("fill", row.color);
			r.setAttribute("opacity","1");
			labelBG.appendChild(r);

			const t = document.createElementNS(
				"http://www.w3.org/2000/svg","text"
			);
			t.setAttribute("x", CANON.LABEL_WIDTH / 2);
			t.setAttribute("y", y + (CANON.ROW_HEIGHT / 2));
			t.setAttribute("fill","#ffffff");
			t.setAttribute("font-size","15");
			t.setAttribute("font-weight","700");
			t.setAttribute("text-anchor","middle");
			t.setAttribute("dominant-baseline","middle");

			const glyph = document.createElementNS(
				"http://www.w3.org/2000/svg","tspan"
			);
			glyph.setAttribute("fill", row.glyphColor);
			glyph.setAttribute("font-size", "17");
			glyph.textContent = row.glyph;
			t.appendChild(glyph);

			const label = document.createElementNS(
				"http://www.w3.org/2000/svg","tspan"
			);
			label.setAttribute("dx", "7");
			label.textContent = row.label;
			t.appendChild(label);

			const sub = document.createElementNS(
				"http://www.w3.org/2000/svg","tspan"
			);
			sub.setAttribute("dx", "10");
			sub.setAttribute("font-size", "10");
			sub.setAttribute("font-weight", "500");
			sub.setAttribute("fill", "rgba(255,255,255,0.78)");
			sub.textContent = row.subtitle;
			t.appendChild(sub);

			labelText.appendChild(t);

			if (lifeCycleOverlay) {
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

			}
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

			const seasonKey = getPlantingSeasonKey(date);

			const localTzLabel2 = Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
				.formatToParts(date)
				.find(p => p.type === "timeZoneName")?.value ?? "";
			if (dateBoxText) {
			  dateBoxText.textContent = `${day} ${monthUpper} ${year}`;
			  dateBoxText.setAttribute("data-turning", seasonKey.toUpperCase());
			  dateBoxText.style.setProperty("--phase-rgb", PLANTING_SEASON_RGB[seasonKey] || "255,255,255");
			}

		  // Astro center (requested) — show local timezone
		  const localTzLabel = Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
			  .formatToParts(date)
			  .find(p => p.type === "timeZoneName")?.value ?? "";
		  if (astroDateText) astroDateText.textContent = `${day} ${monthTitle} ${year}`;

		  // Keep the native date input synchronized (UTC) unless the user is editing
		  // Allow tabbing between date/time/location without reverting
		  const activeEl = document.activeElement;
		  const isEditingDate = activeEl === dateBoxInput;
		  const isEditingRelated = activeEl === timeBoxInput || activeEl === locationBoxInput;
		  const userEditing = isEditingDate || isEditingRelated || dateBoxInput.dataset.dirty;
		  if (dateBoxInput && !userEditing) {
			const dd = String(date.getUTCDate()).padStart(2, "0");
			const mon = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
			const yyyy = String(date.getUTCFullYear());
			const pretty = `${dd} ${mon} ${yyyy}`;
			if (dateBoxInput.value !== pretty) dateBoxInput.value = pretty;
			dateBoxInput.classList.remove("invalid");
		  }
		}

		let lastWheelDrawMs = 0;
		const WHEEL_FPS = 10;
		const WHEEL_FRAME_MS = 1000 / WHEEL_FPS;
		let lastIdleFrameMs = 0;
		const IDLE_FRAME_MS = 250; // When paused/idle, refresh at 4fps instead of burning 60fps.
		const HIDDEN_FRAME_MS = 1000; // Browser tab hidden/backgrounded: 1fps health check only.

		function requestWheelRedraw() {
			if (typeof drawAstroWheel === 'function' && isWheelOpen()) {
				drawAstroWheel();
			}
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

		let __layoutResyncDeadline = performance.now() + 3000; // re-sync layout for first 3s

		function animate(t) {

			if (!lastTime) lastTime = t;
			const dt = (t - lastTime) / 1000;
			lastTime = t;

			// Re-sync layout for first few seconds to catch menu/location shifts
			if (performance.now() < __layoutResyncDeadline) {
				syncTimeMarkerLayout();
				if (typeof window.updatePlantingNowLuminaryFrame === "function") {
					window.updatePlantingNowLuminaryFrame(performance.now());
				}
			}

			const v = speedSlider.value / 100;
			if (pauseBtn) pauseBtn.classList.toggle("paused", Math.abs(v) < 0.0001);
			const pausedNow = (Math.abs(v) < 0.0001) && !timeState.navTargetDateUTC;
			if (bumpRevBtn) bumpRevBtn.disabled = !pausedNow;
			if (bumpFwdBtn) bumpFwdBtn.disabled = !pausedNow;

			// Idle tabs were still doing full label/layout work at 60fps.
			// Keep controls responsive, but throttle when nothing is moving.
			const idleNow = pausedNow && !isWheelOpen();
			const minFrameMs = document.hidden ? HIDDEN_FRAME_MS : (idleNow ? IDLE_FRAME_MS : 0);
			if (minFrameMs && lastIdleFrameMs && (t - lastIdleFrameMs) < minFrameMs) {
				setTimeout(() => requestAnimationFrame(animate), Math.max(0, minFrameMs - (t - lastIdleFrameMs)));
				return;
			}
			lastIdleFrameMs = t;

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
			scrollX = dateToPlantingScrollX(timeState.dateUTC);
			timeState.scrollX = scrollX;

			// Canonical hinge: 0px in time (SCREW_EPOCH_X) aligns to the label box left edge.
			nowX = getNowScreenX();   // reuse global
			const screwTranslateX = nowX - SCREW_EPOCH_X + scrollX;

			scrollGroup.setAttribute(
				"transform",
				`translate(${screwTranslateX}, ${CANON.SCREW_TOP_PAD + EXTRA_SCREW_TOP_PAD})`
			);

			updateLabels(scrollX);
			updateDate();
			updateElementButtonLabels();
			if (typeof window.updatePlantingNowLuminaryFrame === "function") {
				window.updatePlantingNowLuminaryFrame(t);
			}
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
			const wheelOpen = isWheelOpen();

			if (wheelOpen && (t - lastWheelDrawMs) >= WHEEL_FRAME_MS) {
				drawAstroWheel();
				lastWheelDrawMs = t;
			}
			syncEventShield();
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

	// Expose syncTimeMarkerLayout so astro-wheel.js can call it on modal open/close
	window.syncTimeMarkerLayout = syncTimeMarkerLayout;

	// 🔁 Start loop (only once)
	requestAnimationFrame(animate);

	// 📷 When the sky map loads, force a redraw (optional but fine)
	const wheelImgEl = document.getElementById("wheelImg");
	if (wheelImgEl) {
	wheelImgEl.onload = () => {
		requestWheelRedraw();
		};
	};
	
