// js/_era_markers.js
// Cathedral: global data (non-module). Loaded before screw-renderer.js.

window.ERA_MARKERS = [



  // Saeculum / U.S. Cultural Eras
  {
    id: "augustan_age_of_empire",
    label: "Augustan Age of Empire",
    start: "1704-01-01",
    end: "1727-12-31",
    category: "era",
    display: {
      textBelow: "1704–1727",
      fade: true
    }
  },
  {
    id: "great_awakening",
    label: "Great Awakening",
    start: "1730-01-01",
    end: "1749-12-31",
    category: "era",
    display: {
      textBelow: "1730s–1740s",
      fade: true
    }
  },
  {
    id: "french_and_indian_wars",
    label: "French & Indian Wars",
    start: "1754-01-01",
    end: "1763-12-31",
    category: "war",
    display: {
      textBelow: "1754–1763",
      fade: true,
	  yOffset: -2
    }
  },
    {
    id: "american_revolution",
    label: "American Revolution",
    start: "1775-04-19",
    end: "1783-09-03",
    category: "war",
    display: {
      textBelow: "1775–1783",
      fade: true,
      yOffset: 15
    }
  },
  {
    id: "era_of_good_feelings",
    label: "Era of Good Feelings",
    start: "1815-01-01",
    end: "1825-12-31",
    category: "era",
    display: {
      textBelow: "1815–1825",
      fade: true
    }
  },
  {
    id: "transcendental_awakening",
    label: "Transcendental Awakening",
    start: "1820-01-01",
    end: "1849-12-31",
    category: "era",
    display: {
      textBelow: "1820s–1840s",
      fade: true

    }
  },
  {
    id: "mexican_war",
    label: "Mexican War",
    start: "1846-01-01",
    end: "1850-12-31",
    category: "war",
    display: {
      textBelow: "1846–1850",
      fade: true
    }
  },
  {
     id: "sectionalism",
    label: "Sectionalism",
    start: "1846-01-01",
    end: "1850-12-31",
    category: "era",
    display: {
      textBelow: "1846–1850",
      fade: true,
	  yOffset: -75
    }
  },
  {
    id: "civil_war",
    label: "Civil War",
    start: "1861-04-12",
    end: "1865-04-09",
    category: "war",
    display: {
      textBelow: "1861–1865",
      fade: true
    }
  },
  {
    id: "reconstruction_gilded_age",
    label: "Reconstruction & Gilded Age",
    start: "1865-01-01",
    end: "1896-12-31",
    category: "era",
    display: {
      textBelow: "1865–1896",
      fade: true
    }
  },
  {
    id: "third_great_awakening",
    label: "3rd Great Awakening",
    start: "1880-01-01",
    end: "1900-12-31",
    category: "era",
    display: {
      textBelow: "1880s–1900s",
      fade: true
    }
  },
  {
    id: "wwi",
    label: "WWI",
    start: "1914-01-01",
    end: "1918-11-11",
    category: "war",
    display: {
      textBelow: "1914–1918",
      fade: true
    }
  },
    {
    id: "wwii",
    label: "WWII",
    start: "1939-09-01",
    end: "1945-09-02",
    category: "war",
    display: {
      textBelow: "1939–1945",
      fade: true
    }
  },
  {
    id: "prohibition",
    label: "Prohibition",
    start: "1920-01-17",
    end: "1933-12-05",
    category: "era",
    display: {
      textBelow: "1920–1933",
      fade: true
    }
  },
  {
    id: "american_high",
    label: "American High",
    start: "1946-01-01",
    end: "1964-12-31",
    category: "era",
    display: {
      textBelow: "1946–1964",
      fade: true,
	  yOffset: -40
    }
  },
  {
    id: "consciousness_revolution",
    label: "Consciousness Revolution",
    start: "1960-01-01",
    end: "1979-12-31",
    category: "era",
    display: {
      textBelow: "1960s–1970s",
      fade: true,
	  yOffset: 30
    }
  },
  {
    id: "culture_wars",
    label: "Culture Wars",
    start: "1980-01-01",
    end: "2009-12-31",
    category: "era",
    display: {
      textBelow: "1980s–2000s",
      fade: true
    }
  },
  {
    id: "covid",
    label: "Covid",
    start: "2019-01-01",
    end: "2024-12-31",
    category: "era",
    display: {
      textBelow: "2019–2024",
      fade: true
    }
  },

  {
    id: "industrial_revolution",
    label: "Industrial Revolution",
    start: "1760-01-01",
    end: "1849-12-31",
    category: "era",
    display: {
      textBelow: "1760s–1840s",
      fade: true,
      band: true,
	  yOffset: 75,
	  bandYOffset: 90,
      anchor: "start"
    }
  },

  {
    id: "information_age",
    label: "Information Age",
    start: "1970-01-01",
    end: "null",
    category: "era",
    display: {
      textBelow: "1970s–",
      fade: true,
      band: true,
	  yOffset: 15,
	  bandYOffset: 105,
	  bandEndYear: 2030,
      anchor: "start",
	  bandFadePx: 60
    }
  }
];

window.ERA_STYLE = {
  dropPx: 60,          // vertical line length (down from axis)
  textGapPx: 12,       // gap between line end and text
  dotR: 2.8,           // anchor dot radius
  lineW: .8,
  fontSize: 12,
  opacity: 0.85
};

window.ERA_STYLE_ERA = {
  // =========================
  // ERA LABEL LANE (near axis)
  // =========================

  // VERTICAL (all are px BELOW the axis)
  baseY: 105,          // where ERA text starts (main label baseline)
  nearAxisPx: 26,      // fallback if baseY is not used by your renderer

  // AUTO-SEPARATION (lane packing)
  padPx: 10,           // extra breathing room between labels (px)
  charPx: 7,           // width estimate per character (bigger = more spacing)
  maxAutoLanes: 8,     // maximum auto lanes allowed for ERAs
  minLabelW: 160,   // minimum reserved width (px) for any era label

  // TEXT LOOK
  fontSize: 12,        // main label size
  opacity: 0.85,       // label opacity (0..1)
  dateFontSize: 9,     // smaller date line size
  dateDy: 12,          // spacing between main label and date line (px)

  // LANE GEOMETRY
  lanes: 3,            // legacy/manual lanes (still used if your renderer falls back)
  laneGapPx: 14,       // vertical distance between lanes (px)
  minGapPx: 190        // legacy/manual x-gap trigger (px)
};


window.ERA_STYLE_WAR = {
  // =========================
  // WAR LABEL LANE (with drops)
  // =========================

  // VERTICAL (all are px BELOW the axis)
  baseY: 58,           // where WAR text starts (main label baseline)
  dropPx: 50,          // length of the drop line from axis down (px)
  textGapPx: 12,       // gap after line end IF renderer falls back to (dropPx + textGapPx)

  // AUTO-SEPARATION (lane packing)
  padPx: 6,           // extra breathing room between labels (px)
  charPx: 5,           // width estimate per character
  maxAutoLanes: 1,     // maximum auto lanes allowed for WARS
  minLabelW: 60,

  // WAR MARKER LOOK
  dotR: 2.8,           // axis dot radius
  lineW: 0.8,          // drop line width

  // TEXT LOOK
  fontSize: 12,
  opacity: 0.85,
  dateFontSize: 9,
  dateDy: 12,

  // LANE GEOMETRY
  lanes: 1,
  laneGapPx: 18,
  minGapPx: 120
};


window.ERA_STYLE_EVENT = {
  // =========================
  // EVENT LANE (future dense layer)
  // =========================

  // VERTICAL (px BELOW the axis)
  baseY: 140,         // where EVENT text starts (main label baseline)

  // AUTO-SEPARATION (lane packing)
  padPx: 10,          // extra breathing room between labels (px)
  charPx: 7,          // width estimate per character
  maxAutoLanes: 16,   // events need more lanes than eras/wars
  minLabelW: 180,

  // LANE GEOMETRY
  lanes: 10,          // legacy/manual lanes (fine to keep)
  laneGapPx: 16,      // vertical distance between event lanes (px)
  minGapPx: 200,      // legacy/manual x-gap trigger (px)

  // TEXT LOOK
  fontSize: 11,
  opacity: 0.8,
  dateFontSize: 9,
  dateDy: 12
};
