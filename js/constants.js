/* constants.js — Spatial + structural canon */
/* =========================================================
	   SECTION 06 — SPATIAL CANON (ABSOLUTE LAW)
	   ---------------------------------------------------------
	   • Single source of truth for space & scale
	   • NO rendering logic
	   • NO animation logic
	   • Geometry only
	   ========================================================= 
	*/

	// ─────────────────────────────
	// SCREW VERTICAL ANATOMY (LAW)
	// ─────────────────────────────
	//
	// All Y values are measured from the TOP of the SVG.
	//
	// y = 0
	// ├─ SCREW_TOP_PAD        (elemental cycle, accents)
	// ├─ SCREW_BODY           (bands, diagonals, saeculum wave)
	// ├─ SINE_OFFSET          (clearance below body)
	// ├─ SINE_AMPLITUDE       (saeculum wave vertical span)
	// ├─ SCREW_BOTTOM_PAD     (safety margin)
	// └─ YEAR_LABELS
	//

		const CANON = {

			// ─────────────────────────────
			// HORIZONTAL SCALE (TIME)
			// ─────────────────────────────
			PX_PER_YEAR: 5,
			YEARS_PER_MAJOR: 20,

			get PX_PER_MAJOR() {
				return this.PX_PER_YEAR * this.YEARS_PER_MAJOR;
			},

			// ─────────────────────────────
			// VERTICAL LAYERS (LAW)
			// ─────────────────────────────

			// Top reserved space for elemental cycle & accents
			SCREW_TOP_PAD: 20,

			// Main generational field (bands + diagonals + wave centerline)
			SCREW_BODY: 160,

			// Vertical spacing below the body before the wave begins
			SINE_OFFSET: 15,

			// Vertical travel of the saeculum wave (±15 = 30px total)
			SINE_AMPLITUDE: 15,

			// Safety margin below wave before year labels
			SCREW_BOTTOM_PAD: 10,

			// Distance below geometry for year numbers
			YEAR_LABEL_PAD: 420, // event lane height under the axis. shield will protect astro-wheel zone.

			// ─────────────────────────────
			// DERIVED HEIGHTS (DO NOT HAND‑EDIT)
			// ─────────────────────────────
			
			get SCREW_HEIGHT() {
			return this.SCREW_TOP_PAD + this.SCREW_BODY;
			},

			// Top of timeline axis (where diagonals meet)
			get TIMELINE_Y() {
			return this.SCREW_TOP_PAD + this.SCREW_BODY;
			},

			// Bottom of saeculum wave
			get SINE_BOTTOM_Y() {
			return this.TIMELINE_Y + this.SINE_OFFSET + this.SINE_AMPLITUDE;
			},

			// Total SVG height required so nothing clips
			get SCREW_TOTAL_HEIGHT() {
			return this.SINE_BOTTOM_Y + this.SCREW_BOTTOM_PAD + this.YEAR_LABEL_PAD;
			},
			
			// ─────────────────────────────
			// ROW / LABEL GEOMETRY
			// ─────────────────────────────
			ROW_HEIGHT: 45,

			// ─────────────────────────────
			// LAYOUT CONSTANTS
			// ─────────────────────────────
			SCREW_SIDE_PAD: 20,
			LABEL_WIDTH: 200
		};
/* =========================================================
	   SECTION 06.1 — SCREEN ANCHORS (REAL DOM MEASURED)
	   ---------------------------------------------------------
	   Compute preferred screen positions for landmark anchors
	   ========================================================= */

	/*
		NOW_X — AUTHORITATIVE SCREEN ANCHOR
		----------------------------------
		NOW is defined as the LEFT EDGE of the archetype label box.
		This is measured directly from the DOM.

		This removes all geometric assumptions and makes
		the timeline self-calibrating.
	*/

		function getNowScreenX() {
			const screwSVG = document.getElementById("screwSVG");
			const labelSVG = document.getElementById("labelSVG");

			const screwRect = screwSVG.getBoundingClientRect();
			const labelRect = labelSVG.getBoundingClientRect();

			// Return label's left edge expressed in SCREW SVG space
			return labelRect.left - screwRect.left;
		}
/* =========================================================
	   SECTION 07 — TIMELINE GEOMETRY (DERIVED FROM CANON)
	   ========================================================= */

	   const COLORS = ["#ff0000","#00aa00","#d0b300","#2b5ea8"];
	   const SCREW_HEIGHT = CANON.SCREW_HEIGHT;
	   const ROW_H        = CANON.ROW_HEIGHT;
	   const PX_PER_YEAR  = CANON.PX_PER_YEAR;
	   const PX_PER_MAJOR = CANON.PX_PER_MAJOR;
	   const PIX_PER_YEAR = PX_PER_YEAR; // legacy alias (animation + astro engine)
	   const CYCLE = PX_PER_MAJOR * 4;   // 4 archetypes per cycle
	   const MINX  = -20000;
	   const MAXX  =  20000;
	   
	/*
		SCREW_EPOCH_X — CANONICAL CONJUNCTION ANCHOR
		-------------------------------------------
		This is the screw-space X coordinate that corresponds
		EXACTLY to the 2020-12-21 Saturn–Jupiter conjunction.

		When scrollX === 0, this X MUST align with NOW_X.
	*/
		// 2020 MUST sit exactly on the LEFT EDGE of the label box
		// Therefore the epoch must align to a MAJOR boundary, not mid-cycle
		const SCREW_EPOCH_X = PX_PER_MAJOR * 2;
/* =========================================================
	   SECTION 07.1 — SAECULUM WAVE CANON
	   ---------------------------------------------------------
	   • 80 years = 1 full cycle
	   • Anchored in screw space
	   • Trough at 2020 exactly
	   ========================================================= */

		const SAECULUM = {

			// ─────────── WAVE ANCHORING ───────────
			PERIOD_PX: CANON.PX_PER_YEAR * 80,
			TROUGH_X:  SCREW_EPOCH_X,
			Y_OFFSET:  CANON.SINE_OFFSET,

			// ──────── LIGHTING GEOMETRY ──────────
			LIGHT_HEIGHT: 34,
			LIGHT_PAD:    17
		};
/* =========================================================
	   SECTION 07.1.2 — ELEMENTAL CYCLE CANON (STRUCTURAL)
	   ---------------------------------------------------------
	   • Driven by Jupiter–Saturn conjunctions
	   • ~200-year elemental periods
	   • 4 elements → ~800+ year civilizational cycle
	   • Subdivided internally at 20-year majors
	   • Structure only — no labels rendered here
	   ========================================================= */

	const ELEMENTAL = {

		// Order is LAW (do not reorder)
		ORDER: ["earth", "air", "water", "fire"],

		// Canonical colors (standard astrology)
		COLORS: {
			fire:  "255, 65, 54",    // red
			earth: "46, 204, 64",    // green
			air:   "255, 220, 0",    // yellow
			water: "0, 116, 217"     // blue
		},

		// Duration & scaling
		YEARS_PER_ELEMENT: 200,

		get PX_PER_ELEMENT() {
			return this.YEARS_PER_ELEMENT * PX_PER_YEAR;
		},

		// Epoch anchor (Dec 21, 2020 = AIR ingress)
		ANCHOR_ELEMENT: "air",
		ANCHOR_X: SCREW_EPOCH_X,

		// Vertical band height
		HEIGHT: 20
	};

	/* =========================================================
	   ELEMENT ERA SNAP TARGETS (CANONICAL)
	   ---------------------------------------------------------
	   One per ~200-year elemental ingress
	   Used ONLY for navigation buttons
	   ========================================================= */

	const ELEMENT_ERA_YEARS = [

		 760, // Fire
		1008, // Earth
		1186, // Air
		1365, // Water
		1600, // Fire
		1800, // Earth
		1980, // Air
		2200  // Water (future)
	];
/* =========================================================
	   SECTION 07.1.3 — ARCHETYPE LABELS (STRUCTURAL PHASES)
	   ---------------------------------------------------------
	   Used for optional labels on the saeculum wave
	   ========================================================= */

	const SAECULUM_PHASE_NAMES = {
		prophet: "CRISIS",
		nomad:   "HIGH",
		hero:    "AWAKENING",
		artist:  "UNRAVELING"
	};
/* =========================================================
	   SECTION 07.1.4 — GLOBAL ELEMENT MAP (ZODIAC → ELEMENT)
	   ---------------------------------------------------------
	   Maps each zodiac sign to its associated element
	   ========================================================= */

	const ELEMENT_SIGNS = {
		aries:       "fire",
		taurus:      "earth",
		gemini:      "air",
		cancer:      "water",
		leo:         "fire",
		virgo:       "earth",
		libra:       "air",
		scorpio:     "water",
		sagittarius: "fire",
		capricorn:   "earth",
		aquarius:    "air",
		pisces:      "water"
	};
/* =========================================================
	   SECTION 07.1.5 — ZODIAC SIGN GLYPHS (UNICODE SYMBOLS)
	   ---------------------------------------------------------
	   Used for rendering glyphs in the elemental cycle
	   ========================================================= */

	const SIGN_GLYPHS = {
	  aries:       "♈\uFE0E",
	  taurus:      "♉\uFE0E",
	  gemini:      "♊\uFE0E",
	  cancer:      "♋\uFE0E",
	  leo:         "♌\uFE0E",
	  virgo:       "♍\uFE0E",
	  libra:       "♎\uFE0E",
	  scorpio:     "♏\uFE0E",
	  sagittarius: "♐\uFE0E",
	  capricorn:   "♑\uFE0E",
	  aquarius:    "♒\uFE0E",
	  pisces:      "♓\uFE0E"
	};

