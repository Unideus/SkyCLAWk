/* generation-model.js — cohorts + labels + visibility state */
/* =========================================================
	   SECTION 07.3 — DIAGONAL COHORT LABELS (EXPLICIT)
	   ---------------------------------------------------------
	   • Each generation has an exact start year + archetype
	   • Direct placement in screw space
	   • Independent of diag stripe drawing
	   ========================================================= */

	const CUSTOM_GENERATION_LABELS = [

	  { archetype: "Artist", label: "??",			     	x: 1540, y: -20 },
	 
	  { archetype: "Prophet", label: "Reformation",  		x: 1560, y: -20 },
	  { archetype: "Nomad",   label: "Reprisal",      		x: 1580, y: -20 },
	  { archetype: "Hero",    label: "Elizabethan",			x: 1600, y: -20 },				
	  { archetype: "Artist",  label: "Parlimentary",     	x: 1620, y: -20 },				
	  
	  { archetype: "Prophet", label: "Puritan",  			x: 1640, y: -20 },
	  { archetype: "Nomad",   label: "Cavalier",      		x: 1660, y: -20 },				
	  { archetype: "Hero",    label: "Glorious Revolution",	x: 1680, y: -20 },
	  { archetype: "Artist",  label: "Enlightenment",     	x: 1700, y: -20 },
	  
	  { archetype: "Prophet", label: "Awakening",  			x: 1720, y: -20 },
	  { archetype: "Nomad",   label: "Liberty",      		x: 1740, y: -20 },
	  { archetype: "Hero",    label: "Republican", 			x: 1760, y: -20 },
	  { archetype: "Artist",  label: "Compromise",     		x: 1780, y: -20 },
	 
	  { archetype: "Prophet", label: "Transcendental",  	x: 1800, y: -20 },
	  { archetype: "Nomad",   label: "Gilded",      		x: 1820, y: -20 },
	  { archetype: "Hero",    label: "-", 					x: 1840, y: -20 },
	  { archetype: "Artist",  label: "Progressive", 		x: 1860, y: -20 },

	  { archetype: "Prophet", label: "Missionary", 			x: 1880, y: -20 },
	  { archetype: "Nomad",   label: "Lost",        		x: 1900, y: -20 },
	  { archetype: "Hero",    label: "GI",          		x: 1920, y: -20 },
	  { archetype: "Artist",  label: "Silent",      		x: 1940, y: -20 },

	  { archetype: "Prophet", label: "Boomers",     		x: 1960, y: -20 },
	  { archetype: "Nomad",   label: "Gen X",       		x: 1980, y: -20 },
	  { archetype: "Hero",    label: "Millennials", 		x: 2000, y: -20 },
	  { archetype: "Artist",  label: "Gen Z",       		x: 2020, y: -20 },
	  
	  { archetype: "Prophet", label: "Gen A",		     	x: 2040, y: -20 }
	];


	// Purely visual lift for label placement
	const DIAG_LABEL_Y_OFFSET = -18;

	const ARCHETYPE_Y_OFFSETS = {
		"Prophet": -100,
		"Nomad": -20,
		"Hero": -20,
		"Artist": -20
	};

	/* =========================================================
	   SAECULUM LABEL STATE (AUTHORITATIVE)
	   ========================================================= */
	let showSaeculumLabels = true;

	/* =========================================================
	   PLANET VISIBILITY STATE (AUTHORITATIVE)
	   ---------------------------------------------------------
	   • Controls NON-Saturn/Jupiter planets only
	   • Jupiter/Saturn always render with Astro Wheel
	   ========================================================= */
	let showInnerPlanets = true; // Moon, Mercury, Venus
	let showOuterPlanets = true; // Mars, Uranus, Neptune, Pluto

