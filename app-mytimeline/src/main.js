// src/main.js
import "./engine/astronomy-adapter.js";

/* =========================
   Modal wiring
========================= */
const birthModal = document.getElementById("birthModal");
const eventsModal = document.getElementById("eventsModal");
const bodiesModal = document.getElementById("bodiesModal");
const starsModal  = document.getElementById("starsModal");

const openBodiesBtn = document.getElementById("openBodies");
const openStarsBtn  = document.getElementById("openStars");

const closeBodiesBtn  = document.getElementById("closeBodies");
const closeBodiesBtn2 = document.getElementById("closeBodies2");
const closeStarsBtn   = document.getElementById("closeStars");
const closeStarsBtn2  = document.getElementById("closeStars2");

const bodiesGrid = document.getElementById("bodiesGrid");
const starsGrid  = document.getElementById("starsGrid");

const bodiesAllBtn  = document.getElementById("bodiesAll");
const bodiesNoneBtn = document.getElementById("bodiesNone");
const starsAllBtn   = document.getElementById("starsAll");
const starsNoneBtn  = document.getElementById("starsNone");

const openBirthBtn = document.getElementById("openBirth");
const openEventsBtn = document.getElementById("openEvents");

const closeBirthBtn = document.getElementById("closeBirth");
const closeBirthBtn2 = document.getElementById("closeBirth2");
const closeEventsBtn = document.getElementById("closeEvents");
const closeEventsBtn2 = document.getElementById("closeEvents2");

if (birthModal) birthModal.inert = true;
if (eventsModal) eventsModal.inert = true;
if (bodiesModal) bodiesModal.inert = true;
if (starsModal) starsModal.inert = true;

function getFirstFocusable(modalEl) {
  return modalEl?.querySelector(
    "[data-autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
  );
}

function openModal(modalEl, openerEl) {
  if (!modalEl) return;
  modalEl.__opener = openerEl || document.activeElement;
  modalEl.classList.add("isOpen");
  modalEl.setAttribute("aria-hidden", "false");
  modalEl.inert = false;
  getFirstFocusable(modalEl)?.focus?.();
}

function closeModal(modalEl) {
  if (!modalEl) return;
  const opener = modalEl.__opener;
  if (opener && typeof opener.focus === "function") opener.focus();
  modalEl.classList.remove("isOpen");
  modalEl.setAttribute("aria-hidden", "true");
  modalEl.inert = true;
}

openBirthBtn?.addEventListener("click", () => {
  openModal(birthModal, openBirthBtn);

  // reset button colors every time the modal opens
  setBandReady(false);
  syncRunPill();
  if (wheelImg) wheelImg.src = renderBirthWheelSVG(null);
});

openEventsBtn?.addEventListener("click", () => openModal(eventsModal, openEventsBtn));
openBodiesBtn?.addEventListener("click", () => openModal(bodiesModal, openBodiesBtn));

openStarsBtn?.addEventListener("click", async () => {
  await rebuildStarsGrid();                 // fill the grid first
  openModal(starsModal, openStarsBtn);      // then open the modal
});

closeBodiesBtn?.addEventListener("click", () => closeModal(bodiesModal, openBodiesBtn));

closeBodiesBtn2?.addEventListener("click", () => closeModal(bodiesModal, openBodiesBtn));
closeStarsBtn?.addEventListener("click", () => closeModal(starsModal, openStarsBtn));
closeStarsBtn2?.addEventListener("click", () => closeModal(starsModal, openStarsBtn));

closeBirthBtn?.addEventListener("click", () => closeModal(birthModal));
closeBirthBtn2?.addEventListener("click", () => closeModal(birthModal));
closeEventsBtn?.addEventListener("click", () => closeModal(eventsModal));
closeEventsBtn2?.addEventListener("click", () => closeModal(eventsModal));

birthModal?.addEventListener("click", (e) => {
  if (e.target === birthModal) closeModal(birthModal);
});
eventsModal?.addEventListener("click", (e) => {
  if (e.target === eventsModal) closeModal(eventsModal);
});

bodiesModal?.addEventListener("click", (e) => {
  if (e.target === bodiesModal) closeModal(bodiesModal);
});
starsModal?.addEventListener("click", (e) => {
  if (e.target === starsModal) closeModal(starsModal);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
  closeModal(birthModal);
  closeModal(eventsModal);
  closeModal(bodiesModal);
  closeModal(starsModal);
  }
});

/* =========================
   Birth modal: Calculate wiring (visual-only phase)
========================= */
const birthForm = document.getElementById("birthForm");
const birthError = document.getElementById("birthError");

const bName = document.getElementById("name");
const bDate = document.getElementById("date");
const bTime = document.getElementById("time");
const bCity = document.getElementById("city");
const bState = document.getElementById("state");
const bHsys = document.getElementById("hsys");
const bLat = document.getElementById("lat");
const bLon = document.getElementById("lon");

const runBtn = document.getElementById("run");

const wheelImg = document.getElementById("wheelImg");
const toBandBtn = document.getElementById("toBand");
const timelineStatusBtn = document.getElementById("timelineStatus");
const personalTimelineEl = document.getElementById("personalTimeline");
const saveBirthBtn   = document.getElementById("saveBirth");
const renameBirthBtn = document.getElementById("renameBirth");
const newBirthBtn    = document.getElementById("newBirth");
const deleteBirthBtn = document.getElementById("deleteBirth");

const savedList      = document.getElementById("savedList");
const loadBirthBtn   = document.getElementById("loadBirth");

const LS_BIRTH = "zy_birth_charts_v1";

function setTimelineLoadStatus(state) {
  if (!timelineStatusBtn) return;

  timelineStatusBtn.classList.remove("isCalc", "isDone");

  if (state === "calc") {
    timelineStatusBtn.classList.add("isCalc");
    timelineStatusBtn.textContent = "Calculating...";
    if (personalTimelineEl) personalTimelineEl.classList.add("isLoading");
    return;
  }

  if (state === "done") {
    timelineStatusBtn.classList.add("isDone");
    timelineStatusBtn.textContent = "Finished";
    if (personalTimelineEl) personalTimelineEl.classList.remove("isLoading");
    return;
  }

  if (state === "error") {
    timelineStatusBtn.classList.add("isCalc");
    timelineStatusBtn.textContent = "Error";
    if (personalTimelineEl) personalTimelineEl.classList.remove("isLoading");
    return;
  }

  // default/reset
  timelineStatusBtn.textContent = "Timeline";
  if (personalTimelineEl) personalTimelineEl.classList.remove("isLoading");
}

// Listen for timeline.js calc lifecycle events
window.addEventListener("zy:timeline:calc", (ev) => {
  const state = ev?.detail?.state;
  if (state === "start") return setTimelineLoadStatus("calc");
  if (state === "done") return setTimelineLoadStatus("done");
  if (state === "error") return setTimelineLoadStatus("error");
  return setTimelineLoadStatus("reset");
});

function birthChartFromForm() {
  return {
    name:  (bName?.value || "").trim() || "Unnamed",
    date:  (bDate?.value || "").trim(),
    time:  (bTime?.value || "").trim(),
    city:  (bCity?.value || "").trim(),
    state: (bState?.value || "").trim().toUpperCase(),
    hsys:  (bHsys?.value || "W"),
  };
}

function chartId(ch) {
  return `${ch.name}__${ch.date}__${ch.time}__${ch.city}__${ch.state}`.toLowerCase();
}

function loadBirthStore() {
  try {
    const raw = localStorage.getItem(LS_BIRTH);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveBirthStore(arr) {
  localStorage.setItem(LS_BIRTH, JSON.stringify(arr));
}

function refreshBirthDropdown(selectId = null) {
  if (!savedList) return;
  const store = loadBirthStore();
  savedList.innerHTML = "";
  for (const ch of store) {
    const opt = document.createElement("option");
    opt.value = ch.id;
    opt.textContent = ch.name || "Unnamed";
    savedList.appendChild(opt);
  }
  if (selectId) savedList.value = selectId;
}

function fillFormFromChart(ch) {
  if (!ch) return;
  if (bName)  bName.value  = ch.name || "";
  if (bDate)  bDate.value  = ch.date || "";
  if (bTime)  bTime.value  = ch.time || "";
  if (bCity)  bCity.value  = ch.city || "";
  if (bState) bState.value = (ch.state || "").toUpperCase();
  if (bHsys)  bHsys.value  = ch.hsys || "W";
  syncRunPill();
}

// Save / Update
saveBirthBtn?.addEventListener("click", () => {
  setBirthError("");
  if (!birthIsReady()) return setBirthError("Fill date, time, city, state first.");

  const ch = birthChartFromForm();
  ch.id = chartId(ch);

  const store = loadBirthStore();
  const idx = store.findIndex(x => x.id === ch.id);
  if (idx >= 0) store[idx] = ch;
  else store.unshift(ch);

  saveBirthStore(store);
  refreshBirthDropdown(ch.id);
});

// Load
loadBirthBtn?.addEventListener("click", () => {
  setBirthError("");
  const id = savedList?.value;
  if (!id) return;

  const store = loadBirthStore();
  const ch = store.find(x => x.id === id);
  if (!ch) return;

  fillFormFromChart(ch);

  // reset preview state until user recalculates
  setBandReady(false);
  birthWheelPending = false;
  lastBirthLons = null;
  if (wheelImg) wheelImg.src = renderBirthWheelSVG(null);
});

// Rename
renameBirthBtn?.addEventListener("click", () => {
  const id = savedList?.value;
  if (!id) return;

  const store = loadBirthStore();
  const idx = store.findIndex(x => x.id === id);
  if (idx < 0) return;

  const next = prompt("New name:", store[idx].name || "Unnamed");
  if (!next) return;

  store[idx].name = next.trim();
  saveBirthStore(store);
  refreshBirthDropdown(id);
});

// New (clear form)
newBirthBtn?.addEventListener("click", () => {
  setBirthError("");
  fillFormFromChart({ name:"", date:"", time:"", city:"", state:"", hsys:"W" });
  setBandReady(false);
  birthWheelPending = false;
  lastBirthLons = null;
  if (wheelImg) wheelImg.src = renderBirthWheelSVG(null);
});

// Delete
deleteBirthBtn?.addEventListener("click", () => {
  const id = savedList?.value;
  if (!id) return;

  const store = loadBirthStore().filter(x => x.id !== id);
  saveBirthStore(store);
  refreshBirthDropdown();
});

// boot dropdown once
refreshBirthDropdown();

/* =========================
   Bodies / Stars selection (pill grids)
========================= */
const LS_FILTERS = "zy_filters_v1";

const DEFAULT_BODIES = [
  "sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto",
  "mean_node","south_node",
  "chiron","ceres","pallas","juno","vesta","eros"
];

function loadFilters() {
  try {
    const raw = localStorage.getItem(LS_FILTERS);
    const obj = raw ? JSON.parse(raw) : null;
    const bodies = Array.isArray(obj?.bodies) ? obj.bodies : DEFAULT_BODIES.slice();
    const stars  = Array.isArray(obj?.stars)  ? obj.stars  : [];
    return { bodies, stars };
  } catch {
    return { bodies: DEFAULT_BODIES.slice(), stars: [] };
  }
}

function saveFilters(next) {
  localStorage.setItem(LS_FILTERS, JSON.stringify(next));
}

let FILTERS = loadFilters();

let birthWheelPending = false;
let lastBirthLons = null;
let lastWheelOpts = null;

function dispatchFilters({ toBand = true, toWheel = true } = {}) {
  if (toBand) {
    window.dispatchEvent(new CustomEvent("zy:filters", { detail: FILTERS }));
  }

  // wheel preview redraw (keep this behavior)
  if (toWheel && wheelImg && lastBirthLons && lastWheelOpts && !birthWheelPending) {
    wheelImg.src = renderBirthWheelSVG(lastBirthLons, lastWheelOpts);
  }
}

function pill(el, on) {
  if (!el) return;
  el.classList.toggle("isOn", !!on);
}

function buildPillGrid(gridEl, keys, getLabel, selectedArr, onChange) {
  if (!gridEl) return;

  const sel = new Set(selectedArr);
  gridEl.innerHTML = "";

  for (const k of keys) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "selectPill";
    b.dataset.key = k;

    const lab = getLabel(k);

    const g = document.createElement("span");
    g.className = "glyph";
    g.textContent = lab.glyph;
    b.appendChild(g);

    // Tooltip + accessibility label always
    b.title = lab.text;
    b.setAttribute("aria-label", lab.text);

    // If this item wants visible text (stars), add a stacked label line
    if (lab.showText) {
      b.classList.add("hasLabel");

      const t = document.createElement("span");
      t.className = "label";
      t.textContent = lab.text;
      b.appendChild(t);
    }


    pill(b, sel.has(k));

    b.addEventListener("click", () => {
      if (sel.has(k)) sel.delete(k);
      else sel.add(k);
      pill(b, sel.has(k));
      onChange(Array.from(sel));
    });

    gridEl.appendChild(b);
  }
}

// Body glyphs for selector UI (don’t rely on window.*)
const BODY_GLYPHS_UI = {
  sun: "☉",
  moon: "☾",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
  mean_node: "☊",
  south_node: "☋",
  chiron: "⚷",
  ceres: "⚳",
  pallas: "⚴",
  juno: "⚵",
  vesta: "⚶",
  eros: "⟡",
};

const BODY_LABEL = (k) => ({
  glyph: BODY_GLYPHS_UI[k] || "•",
  text: k.replaceAll("_", " "),
  showText: false, // bodies are glyph-only pills
});

// Star labels (simple: first letter + name, until you give custom glyphs)
const STAR_LABEL = (k) => ({
  glyph: "✶",
  text: k.replaceAll("_"," "),
  showText: true, // stars show name under the glyph
});

// ----- FILTERS grids (Bodies / Stars) -----
// Modal toggles should update the WHEEL preview,
// but should NOT change the REAL-TIME BAND until you "apply" (Go / Load to Band).

window.__ZY_FILTERS_DIRTY = false;

// Call this when you actually want the band to change (Go / Load to Band)
window.__ZY_APPLY_FILTERS_TO_BAND = function () {
  window.__ZY_FILTERS_DIRTY = false;
  dispatchFilters({ toBand: true, toWheel: false });
};

function markFiltersDirty() {
  window.__ZY_FILTERS_DIRTY = true;
}

function rebuildBodiesGrid() {
  buildPillGrid(
    bodiesGrid,
    DEFAULT_BODIES,
    BODY_LABEL,
    FILTERS.bodies,
    (nextBodies) => {
      FILTERS = { ...FILTERS, bodies: nextBodies };
      saveFilters(FILTERS);
      markFiltersDirty();
      dispatchFilters({ toBand: false, toWheel: true }); // ✅ wheel only
    }
  );
}

// Stars list: prefer cached keys from latest zy:time; fallback to getFixedStars()
async function rebuildStarsGrid() {
  if (!starsGrid) return;

  let starKeys = Array.isArray(window.__ZY_STAR_KEYS) ? window.__ZY_STAR_KEYS.slice() : [];
  if (!starKeys.length) {
    try {
      const stars = await getFixedStars();
      starKeys = Object.keys(stars || {});
    } catch {
      starKeys = [];
    }
  }

  buildPillGrid(
    starsGrid,
    starKeys,
    STAR_LABEL,
    FILTERS.stars,
    (nextStars) => {
      FILTERS = { ...FILTERS, stars: nextStars };
      saveFilters(FILTERS);
      markFiltersDirty();
      dispatchFilters({ toBand: false, toWheel: true }); // ✅ wheel only
    }
  );
}

bodiesAllBtn?.addEventListener("click", () => {
  FILTERS = { ...FILTERS, bodies: DEFAULT_BODIES.slice() };
  saveFilters(FILTERS);
  rebuildBodiesGrid();
  markFiltersDirty();
  dispatchFilters({ toBand: false, toWheel: true });
});

bodiesNoneBtn?.addEventListener("click", () => {
  FILTERS = { ...FILTERS, bodies: [] };
  saveFilters(FILTERS);
  rebuildBodiesGrid();
  markFiltersDirty();
  dispatchFilters({ toBand: false, toWheel: true });
});

starsAllBtn?.addEventListener("click", async () => {
  let starKeys = Array.isArray(window.__ZY_STAR_KEYS) ? window.__ZY_STAR_KEYS.slice() : [];
  if (!starKeys.length) {
    const stars = await getFixedStars().catch(() => ({}));
    starKeys = Object.keys(stars || {});
  }

  FILTERS = { ...FILTERS, stars: starKeys.slice() };
  saveFilters(FILTERS);
  await rebuildStarsGrid();
  markFiltersDirty();
  dispatchFilters({ toBand: false, toWheel: true });
});

starsNoneBtn?.addEventListener("click", async () => {
  FILTERS = { ...FILTERS, stars: [] };
  saveFilters(FILTERS);
  await rebuildStarsGrid();
  markFiltersDirty();
  dispatchFilters({ toBand: false, toWheel: true });
});

// First load: build grids + update WHEEL preview only (do NOT touch the band)
rebuildBodiesGrid();
rebuildStarsGrid();
dispatchFilters({ toBand: false, toWheel: true });


// Build grids on first load
rebuildBodiesGrid();
window.__ZY_APPLIED_FILTERS = { bodies: FILTERS.bodies || [], stars: FILTERS.stars || [] };
dispatchFilters();

// Top-left Birth Summary strip
const bsName = document.getElementById("bsName");
const bsLocalDT = document.getElementById("bsLocalDT");
const bsUTC = document.getElementById("bsUTC");
const bsPlace = document.getElementById("bsPlace");
const bsHsys = document.getElementById("bsHsys");
const bsLatLon = document.getElementById("bsLatLon");

function fmtLocalLine(dateStr, timeStr) {
  if (!dateStr) return "—";
  // dateStr from <input type="date">: YYYY-MM-DD
  const [Y, M, D] = String(dateStr).split("-").map(Number);
  if (!Y || !M || !D) return "—";

  // timeStr from <input type="time">: HH:MM
  let hh = 0, mm = 0;
  if (timeStr) {
    const parts = String(timeStr).split(":").map(Number);
    hh = Number.isFinite(parts[0]) ? parts[0] : 0;
    mm = Number.isFinite(parts[1]) ? parts[1] : 0;
  }

  // simple "Wed., 1 Jan 1975  1:03 PM"
  const dt = new Date(Y, M - 1, D, hh, mm, 0);
  const wd = dt.toLocaleDateString(undefined, { weekday: "short" });
  const mon = dt.toLocaleDateString(undefined, { month: "short" });
  const day = dt.getDate();
  const yr = dt.getFullYear();

  let h12 = dt.getHours();
  const ampm = h12 >= 12 ? "PM" : "AM";
  h12 = h12 % 12; if (h12 === 0) h12 = 12;
  const m2 = String(dt.getMinutes()).padStart(2, "0");

  return `${wd}., ${day} ${mon} ${yr}   Time: ${h12}:${m2} ${ampm}`;
}

function hsysLabel(v) {
  const k = String(v || "").toUpperCase();
  if (k === "W") return "Houses: Whole Sign";
  if (k === "O") return "Houses: Porphyry";
  return "Houses: —";
}

function updateBirthSummaryUI({ name, date, time, city, state, lat, lon, hsys }) {
  if (bsName) bsName.textContent = (name && name.trim()) ? `♂ ${name.trim()}` : "♂ —";
  if (bsLocalDT) bsLocalDT.textContent = fmtLocalLine(date, time);

  // We’ll fill UTC properly once the offline timezone resolver is in.
  if (bsUTC) bsUTC.textContent = "UTC: —";

  const place = [city, state].filter(Boolean).join(", ");
  if (bsPlace) bsPlace.textContent = place ? place : "—";

  if (bsHsys) bsHsys.textContent = hsysLabel(hsys);

  const haveLatLon = Number.isFinite(lat) && Number.isFinite(lon);
  if (bsLatLon) bsLatLon.textContent = haveLatLon
    ? `Lat/Lon: ${lat.toFixed(4)}, ${lon.toFixed(4)}`
    : "Lat/Lon: —";
}

let lastBirthGeo = null;   // {lat, lon, tz, cc, admin1}
let lastBirthUTC = null;   // Date (true UTC instant for the birth)
let lastBirthAscLon = null;
let lastBirthRates = null; // { bodyKey: degPerSec } for natal s/rx

toBandBtn?.addEventListener("click", () => {
  // must have a calculated chart in memory
  if (!lastBirthLons) return setBirthError("Calculate first.");

  // ✅ If user changed Bodies/Stars, apply to the band before drawing
  if (window.__ZY_FILTERS_DIRTY) {
    window.__ZY_FILTERS_DIRTY = false;
    dispatchFilters({ toBand: true, toWheel: false });
  }

  // ✅ clear previous natal before setting new natal
  window.dispatchEvent(new CustomEvent("zy:natal", { detail: null }));

  const date = (bDate?.value || "").trim();
  const time = (bTime?.value || "").trim();
  if (!date || !time) return setBirthError("Missing date/time.");

    // Update top-left summary strip ONLY when we commit to band
    updateBirthSummaryUI({
      name: (bName?.value || "").trim(),
      date,
      time,
      city: (bCity?.value || "").trim(),
      state: (bState?.value || "").trim().toUpperCase(),
      lat: Number(lastBirthGeo?.lat),
      lon: Number(lastBirthGeo?.lon),
      hsys: (bHsys?.value || "W"),
    });

  // THIS is what you wanted Load-to-Band to do:
  // 1) update the real-time inputs
  if (zDate) zDate.value = date;
  if (zTime) zTime.value = time;

  // 2) update the band by running the normal pipeline (NOT birthCalc)
  const dtUTC = (lastBirthUTC instanceof Date) ? lastBirthUTC : new Date(`${date}T${time}:00`);
  runGo({ dtLocal: dtUTC, origin: "timeline" });

  // Tell the band: lock in this natal chart for the under-ecliptic readout
window.dispatchEvent(new CustomEvent("zy:natal", {
  detail: {
    natalBodyLons: lastBirthLons,   // your calculated lons
    natalBodyRateDegPerSec: lastBirthRates,
    ascLon: lastBirthAscLon,
    mcLon: Number.isFinite(lastBirthAscLon) && lastBirthUTC instanceof Date && Number.isFinite(Number(lastBirthGeo?.lon))
      ? computeMcLon(lastBirthUTC, Number(lastBirthGeo?.lon))
      : NaN,
    hsys: (bHsys?.value || "W").toUpperCase(),
    lat: Number(lastBirthGeo?.lat),
    lon: Number(lastBirthGeo?.lon),
    utc: lastBirthUTC,              // birth UTC instant (optional, but useful)
  }
}));
});

function birthIsReady() {
  const date = (bDate?.value || "").trim();
  const time = (bTime?.value || "").trim();
  const city = (bCity?.value || "").trim();
  const state = (bState?.value || "").trim();
  return !!(date && time && city && state.length === 2);
}

function syncRunPill() {
  if (!runBtn) return;
  runBtn.classList.toggle("isReady", birthIsReady());
}

[bName, bDate, bTime, bCity, bState, bLat, bLon, bHsys].forEach((el) => {
  el?.addEventListener("input", () => {
    syncRunPill();
    setBandReady(false);
    birthWheelPending = false;
    lastBirthLons = null;

    // ✅ clear old natal overlay immediately
    window.dispatchEvent(new CustomEvent("zy:natal", { detail: null }));

    if (wheelImg) wheelImg.src = renderBirthWheelSVG(null);
  });

  el?.addEventListener("change", () => {
    syncRunPill();
    setBandReady(false);
    birthWheelPending = false;
    lastBirthLons = null;

    // ✅ clear old natal overlay immediately
    window.dispatchEvent(new CustomEvent("zy:natal", { detail: null }));

     if (wheelImg) wheelImg.src = renderBirthWheelSVG(null);
  });
});

// initial state
setBandReady(false);
syncRunPill();
if (wheelImg) wheelImg.src = renderBirthWheelSVG(null);

bState?.addEventListener("input", () => {
  bState.value = (bState.value || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  syncRunPill();
});

function setBirthError(msg) {
  if (!birthError) return;
  birthError.textContent = msg || "";
}

birthForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // reset
  setBirthError("");
  setBandReady(false);
  birthWheelPending = true;
  lastBirthLons = null;

  const date = (bDate?.value || "").trim();
  const time = (bTime?.value || "").trim();
  const city = (bCity?.value || "").trim();
  const state = (bState?.value || "").trim();

  if (wheelImg) wheelImg.src = "";

  if (!date) return setBirthError("Missing date.");
  if (!time) return setBirthError("Missing time.");
  if (!city) return setBirthError("Missing city.");
  if (state.length !== 2) return setBirthError("State must be 2 letters.");

  // Offline place resolve (GeoNames) — US only for now
  const cc = "US";
  const admin1 = state.toUpperCase();

  lastBirthGeo = await resolveGeoNames(city, admin1, cc);
  if (!lastBirthGeo) return setBirthError("Place not found (offline). Try a nearby larger city.");

  const { Y, M, D } = parseYMD(date);
  const { hh, mm } = parseHM(time);

  lastBirthUTC = zonedWallTimeToUTC({ Y, M, D, hh, mm, ss: 0 }, lastBirthGeo.tz);

  birthWheelPending = true;
  lastBirthLons = null;
  lastBirthAscLon = null;

  // run ephemeris at true UTC instant (band ignores birthCalc)
  runGo({ dtLocal: lastBirthUTC, origin: "birthCalc" });
  });

function parseNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : NaN;
}

// computes Ascendant longitude (0..360) from local Date + latitude/longitude
// lon: use negative for West (USA is negative)
function computeAscLon(dtLocal, latDeg, lonDeg) {
  if (!(dtLocal instanceof Date)) return NaN;
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return NaN;

  // Julian Day (UTC)
  const y = dtLocal.getUTCFullYear();
  const m = dtLocal.getUTCMonth() + 1;
  const D =
    dtLocal.getUTCDate() +
    (dtLocal.getUTCHours() + (dtLocal.getUTCMinutes() + dtLocal.getUTCSeconds() / 60) / 60) / 24;

  let Y = y;
  let M = m;
  if (M <= 2) { Y -= 1; M += 12; }

  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);

  const JD = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;

  // GMST (degrees)
  const T = (JD - 2451545.0) / 36525.0;
  let GMST =
    280.46061837 +
    360.98564736629 * (JD - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;

  GMST = ((GMST % 360) + 360) % 360;

  // LST (degrees). lonDeg is East-positive; West is negative (US).
  let LST = GMST + lonDeg;
  LST = ((LST % 360) + 360) % 360;

  // mean obliquity of the ecliptic (degrees)
  const eps = 23.439291 - 0.0130042 * T;

  // Asc formula
  const lst = (LST * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const e = (eps * Math.PI) / 180;

    // Correct ASC formula (ecliptic longitude of Ascendant)
    const num = Math.cos(lst);
    const den = -(Math.sin(lst) * Math.cos(e) + Math.tan(lat) * Math.sin(e));

    let asc = Math.atan2(num, den) * 180 / Math.PI;
    asc = ((asc % 360) + 360) % 360;
    return asc;
}

function wrap360(x) {
  x = x % 360;
  return x < 0 ? x + 360 : x;
}

function arcForward(fromDeg, toDeg) {
  return wrap360(toDeg - fromDeg);
}

// MC (ecliptic longitude). Uses the same LST you already compute for ASC.
function computeMcLon(dtUTC, lonDeg) {
  // --- copy/paste the exact GMST/LST + obliquity pieces from your ASC function ---
  // You already have these inside ASC; keep them identical here:

  const jd = (dtUTC.getTime() / 86400000) + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;

  // mean obliquity (deg)
  const eps = 23.439291111 - (46.8150/3600)*T - (0.00059/3600)*T*T + (0.001813/3600)*T*T*T;
  const e = eps * Math.PI / 180;

  // GMST (deg)
  let gmst = 280.46061837 + 360.98564736629*(jd - 2451545.0) + 0.000387933*T*T - (T*T*T)/38710000;
  gmst = wrap360(gmst);

  // LST (rad)
  const lst = wrap360(gmst + lonDeg) * Math.PI / 180;

  // MC longitude (deg)
  // λ = atan2( sin(LST)*cos(e), cos(LST) )
  const mc = Math.atan2(Math.sin(lst) * Math.cos(e), Math.cos(lst)) * 180 / Math.PI;
  return wrap360(mc);
}

function computeHousesWhole(ascLon) {
  const c1 = Math.floor(wrap360(ascLon) / 30) * 30;
  const cusps = [];
  for (let i = 0; i < 12; i++) cusps.push(wrap360(c1 + i * 30));
  return cusps; // [1..12] but 0-based array
}

function computeHousesPorphyry(ascLon, mcLon) {
  const asc = wrap360(ascLon);
  const mc  = wrap360(mcLon);
  const dsc = wrap360(asc + 180);
  const ic  = wrap360(mc + 180);

  // quadrant arcs going forward (increasing degrees)
  const arcASC_to_IC  = arcForward(asc, ic);
  const arcIC_to_DSC  = arcForward(ic, dsc);
  const arcDSC_to_MC  = arcForward(dsc, mc);
  const arcMC_to_ASC  = arcForward(mc, asc);

  const c1  = asc;
  const c2  = wrap360(asc + arcASC_to_IC / 3);
  const c3  = wrap360(asc + 2 * arcASC_to_IC / 3);
  const c4  = ic;
  const c5  = wrap360(ic + arcIC_to_DSC / 3);
  const c6  = wrap360(ic + 2 * arcIC_to_DSC / 3);
  const c7  = dsc;
  const c8  = wrap360(dsc + arcDSC_to_MC / 3);
  const c9  = wrap360(dsc + 2 * arcDSC_to_MC / 3);
  const c10 = mc;
  const c11 = wrap360(mc + arcMC_to_ASC / 3);
  const c12 = wrap360(mc + 2 * arcMC_to_ASC / 3);

  return [c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12];
}

// =========================
// Offline GeoNames + timezone -> UTC
// =========================
const GEO_INDEX_URL = "/places/geonames-index.json";
const __geoCache = { index: null, shards: new Map() };

function normPlaceKey(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shardKeyFromCity(cityNorm) {
  const a = cityNorm[0] || "0";
  const b = cityNorm[1] || "_";
  const ok = (ch) => (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
  return `${ok(a) ? a : "0"}${ok(b) ? b : "_"}`;
}

async function resolveGeoNames(city, admin1, cc) {
  const cityNorm = normPlaceKey(city);
  const key = `${cityNorm}|${String(admin1 || "").trim().toUpperCase()}|${String(cc || "").trim().toUpperCase()}`;

  if (!__geoCache.index) {
    const r = await fetch(GEO_INDEX_URL);
    __geoCache.index = await r.json();
  }

  const sk = shardKeyFromCity(cityNorm);
  const fname = __geoCache.index?.[sk];
  if (!fname) return null;

  if (!__geoCache.shards.has(fname)) {
    const r = await fetch(`/places/${fname}`);
    __geoCache.shards.set(fname, await r.json());
  }

  const shard = __geoCache.shards.get(fname);
  return shard?.[key] || null; // {lat, lon, tz, cc, admin1}
}

// get offset minutes for a timezone at a UTC instant
function tzOffsetMinutesAt(utcDate, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(utcDate);
  const get = (t) => Number(parts.find(p => p.type === t)?.value);

  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");

  const asUTC = Date.UTC(y, m - 1, d, hh, mm, ss);
  return Math.round((asUTC - utcDate.getTime()) / 60000);
}

// Convert "wall time in IANA tz" -> real UTC Date (DST-safe via 2 passes)
function zonedWallTimeToUTC({ Y, M, D, hh, mm, ss = 0 }, timeZone) {
  const guess = new Date(Date.UTC(Y, M - 1, D, hh, mm, ss));
  const off1 = tzOffsetMinutesAt(guess, timeZone);
  const utc1 = new Date(guess.getTime() - off1 * 60000);

  const off2 = tzOffsetMinutesAt(utc1, timeZone);
  return new Date(guess.getTime() - off2 * 60000);
}

function parseYMD(dateStr) {
  const [Y, M, D] = String(dateStr).split("-").map(Number);
  return { Y, M, D };
}

function parseHM(timeStr) {
  const [hh, mm] = String(timeStr).split(":").map(Number);
  return { hh, mm };
}

function setBandReady(isReady) {
  if (!toBandBtn) return;
  toBandBtn.disabled = !isReady;
  toBandBtn.classList.toggle("isReady", !!isReady);
}

/* Super-basic wheel SVG (placeholder visual for verification) */
    function renderBirthWheelSVG(bodyLons, opts = {}) {
  const W = 900, H = 900;
  const cx = W / 2, cy = H / 2;

  const rOuter = 360;
  const rSignInner = 290;

  // planets OUTSIDE the ring
  const rPlanet = 425;      // glyph position
  const rStemOuter = 385;   // stem end (outside)
  const rStemInner = 360;   // stem start (at ring edge)

  // aspects as tick marks INSIDE the ring
  const rAspectTickOuter = 275;
  const rAspectTickInner = 250;
  const rAspectLine = rAspectTickInner - 8; // where aspect lines connect (inside)

  // ✅ match zodiac-band.js colors exactly
  const elementColors = {
    fire:  "#d32f2f",
    earth: "#2e7d32",
    air:   "#fbc02d",
    water: "#1976d2",
  };

  // ✅ match zodiac-band.js sign order + elements (Aries..Pisces)
  const signMeta = [
    { glyph: "♈︎", element: "fire"  },
    { glyph: "♉︎", element: "earth" },
    { glyph: "♊︎", element: "air"   },
    { glyph: "♋︎", element: "water" },
    { glyph: "♌︎", element: "fire"  },
    { glyph: "♍︎", element: "earth" },
    { glyph: "♎︎", element: "air"   },
    { glyph: "♏︎", element: "water" },
    { glyph: "♐︎", element: "fire"  },
    { glyph: "♑︎", element: "earth" },
    { glyph: "♒︎", element: "air"   },
    { glyph: "♓︎", element: "water" },
  ];

  const planetGlyph = {
    sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
    jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
    mean_node: "☊", south_node: "☋",
    chiron: "⚷", ceres: "⚳", pallas: "⚴", juno: "⚵", vesta: "⚶", eros: "⟡",
  };

  // ✅ use the Bodies modal selection (FILTERS.bodies) if present
  const selected = Array.isArray(FILTERS?.bodies) ? FILTERS.bodies : DEFAULT_BODIES;

  // Only show bodies that (a) are selected and (b) exist in this wheel payload
  const show = selected.filter(k => Number.isFinite(Number(bodyLons?.[k])));


  const degToRad = (d) => (d * Math.PI) / 180;

  // ✅ 0° Aries at 9 o’clock:
  // SVG angle 0 = 3 o’clock, 180 = 9 o’clock.
  // So lon=0 -> angle=180.
  const baseLon = Number.isFinite(opts.baseLon) ? opts.baseLon : 0; // what goes to 9 o’clock
  const ang = (lonDeg) => degToRad(180 - (lonDeg - baseLon));

  const pt = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

  // --- Sign ring (colored by element)
  let wedges = "";
  let signText = "";
  for (let i = 0; i < 12; i++) {
    const a0 = ang(i * 30);
    const a1 = ang((i + 1) * 30);

    const [x0,y0] = pt(rOuter, a0);
    const [x1,y1] = pt(rOuter, a1);
    const [x2,y2] = pt(rSignInner, a1);
    const [x3,y3] = pt(rSignInner, a0);

    const large = (a1 - a0) > Math.PI ? 1 : 0;

    const fill = elementColors[signMeta[i].element];

    wedges += `
      <path d="
        M ${x0} ${y0}
        A ${rOuter} ${rOuter} 0 ${large} 0 ${x1} ${y1}
        L ${x2} ${y2}
        A ${rSignInner} ${rSignInner} 0 ${large} 1 ${x3} ${y3}
        Z
      " fill="${fill}" opacity="0.35" />
    `;


    // white glyph in center of wedge
    const mid = ang(i * 30 + 15);
    const [tx, ty] = pt((rOuter + rSignInner) / 2, mid);
    signText += `<text x="${tx}" y="${ty}" font-size="42" text-anchor="middle" dominant-baseline="middle"
      fill="white" opacity="0.95">${signMeta[i].glyph}</text>`;
  }

  // --- Planets OUTSIDE + stems to the ring
    let planetStems = "";
    let planetDots = "";
    let planetLabels = "";

    for (const k of show) {
      const lon = Number(bodyLons[k]);
      const a = ang(lon);

      // stem from ring edge -> outside
      const [sx, sy] = pt(rStemInner, a);
      const [ex, ey] = pt(rStemOuter, a);
      planetStems += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="rgba(255,255,255,.45)" stroke-width="2" />`;

      // dot + glyph outside
      const [x, y] = pt(rPlanet, a);
      planetLabels += `<text x="${x}" y="${y - 18}" font-size="30" text-anchor="middle" dominant-baseline="middle"
        fill="white" opacity="0.95">${planetGlyph[k] || "•"}</text>`;
    }

  // --- Aspects: tick marks + connecting lines (inside)
  let aspectTicks = "";
  let aspectLines = "";

  if (show.length >= 2) {
    const aspects = [
      { deg: 0,   orb: 6, tick:"rgba(255,255,255,.22)", line:"rgba(255,255,255,.14)" }, // conj
      { deg: 180, orb: 6, tick:"rgba(255,60,60,.75)",   line:"rgba(255,60,60,.35)" },   // opp
      { deg: 90,  orb: 5, tick:"rgba(255,60,60,.75)",   line:"rgba(255,60,60,.35)" },   // square
      { deg: 120, orb: 5, tick:"rgba(70,160,255,.75)",  line:"rgba(70,160,255,.32)" },  // trine
      { deg: 60,  orb: 4, tick:"rgba(70,160,255,.60)",  line:"rgba(70,160,255,.22)" },  // sext
    ];

    function angleDiff(a, b) {
      let d = Math.abs(a - b) % 360;
      if (d > 180) d = 360 - d;
      return d;
    }

    function tickAt(lonDeg, stroke) {
      const a = ang(lonDeg);
      const [x1, y1] = pt(rAspectTickInner, a);
      const [x2, y2] = pt(rAspectTickOuter, a);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="4" stroke-linecap="round" />`;
    }

    for (let i = 0; i < show.length; i++) {
      for (let j = i + 1; j < show.length; j++) {
        const A = Number(bodyLons[show[i]]);
        const B = Number(bodyLons[show[j]]);
        const d = angleDiff(A, B);

        const hit = aspects.find(x => Math.abs(d - x.deg) <= x.orb);
        if (!hit) continue;

        // ticks at both planets
        aspectTicks += tickAt(A, hit.tick);
        aspectTicks += tickAt(B, hit.tick);

        // connecting line inside the wheel
        const [x1, y1] = pt(rAspectLine, ang(A));
        const [x2, y2] = pt(rAspectLine, ang(B));
        aspectLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${hit.line}" stroke-width="2.5" stroke-linecap="round" />`;
      }
    }
  }

    // =========================
    // Markers + House Cusps
    // (draw ONLY when provided)
    // =========================

    let ascMark = "";
    let mcMark  = "";
    let dscMark = "";
    let icMark  = "";

    // helper to draw a labeled marker
    function marker(lon, label) {
      const a = ang(lon);
      const [x1, y1] = pt(rOuter + 2, a);
      const [x2, y2] = pt(rOuter + 26, a);
      return `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
              stroke="white" stroke-width="3" stroke-linecap="round" />
        <text x="${x2}" y="${y2}" font-size="22"
              text-anchor="middle" dominant-baseline="middle" fill="white">${label}</text>
      `;
    }

    // ASC
    if (Number.isFinite(opts.ascLon)) {
      ascMark = marker(opts.ascLon, "ASC");
    }

    // MC
    if (Number.isFinite(opts.mcLon)) {
      mcMark = marker(opts.mcLon, "MC");
    }

    // DSC
    if (Number.isFinite(opts.dscLon)) {
      dscMark = marker(opts.dscLon, "DSC");
    }

    // IC
    if (Number.isFinite(opts.icLon)) {
      icMark = marker(opts.icLon, "IC");
    }

    // House cusp lines (12)
    let houseLines = "";
    if (Array.isArray(opts.houseCusps) && opts.houseCusps.length === 12) {
      for (const deg of opts.houseCusps) {
        if (!Number.isFinite(deg)) continue;
        const h = ang(deg);
        const [hx1, hy1] = pt(rAspectTickOuter, h);
        const [hx2, hy2] = pt(rSignInner + 6, h);
        houseLines += `<line x1="${hx1}" y1="${hy1}" x2="${hx2}" y2="${hy2}"
          stroke="rgba(255,255,255,.35)" stroke-width="2" />`;
      }
    }

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="100%" height="100%" fill="rgba(0,0,0,0)"/>
    ${wedges}
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="${rSignInner}" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.20)" stroke-width="2"/>
    ${signText}
    ${ascMark}
    ${mcMark}
    ${dscMark}
    ${icMark}
    ${houseLines}
    ${aspectLines}
    ${aspectTicks}
    ${planetStems}
    ${planetDots}
    ${planetLabels}
  </svg>`;

  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

  window.addEventListener("zy:time", (ev) => {
  const bodyLons = ev?.detail?.bodyLons;
  if (!bodyLons) return;

    // --- keep a live list of fixed star keys for the Stars modal
    const fixedStars = ev?.detail?.fixedStars;

    // supports: plain object OR Map
    let keys = [];
    if (fixedStars instanceof Map) {
      keys = Array.from(fixedStars.keys());
    } else if (fixedStars && typeof fixedStars === "object") {
      keys = Object.keys(fixedStars);
    }

    // only update if we actually got something
   if (keys.length) {
  window.__ZY_STAR_KEYS = keys.sort();

  // ✅ Do NOT auto-select stars here.
  // The Stars modal (and localStorage) is the only source of truth for what shows.
  // This prevents "None" or partial selections from being overwritten.
}

  lastBirthLons = bodyLons;
    // store birth-time rates so natal can show s/rx immediately
    if (ev?.detail?.origin === "birthCalc") {
      lastBirthRates = ev?.detail?.bodyRateDegPerSec || null;
    }

  if (!birthWheelPending) return;

  // ASC from offline GeoNames lat/lon + true UTC instant (no Swiss Ephemeris)
  const lat = Number(lastBirthGeo?.lat);
  const lon = Number(lastBirthGeo?.lon);

  const ascLon =
    (lastBirthUTC instanceof Date && Number.isFinite(lat) && Number.isFinite(lon))
      ? computeAscLon(lastBirthUTC, lat, lon)
      : NaN;

  lastBirthAscLon = ascLon;
  const hasAsc = Number.isFinite(ascLon);

  // choose what goes at 9 o’clock
  let baseLon = 0; // fallback (Aries 0° at 9)
  const hsys = (bHsys?.value || "W").toUpperCase();

  if (hasAsc) {
    if (hsys === "W") {
      // Whole Sign: 0° of rising sign at 9 o’clock
      baseLon = Math.floor(ascLon / 30) * 30;
    } else {
      // Porphyry: ASC degree at 9 o’clock
      baseLon = ascLon;
    }
  }

  if (wheelImg) {
  const lat = Number(lastBirthGeo?.lat);
  const lon = Number(lastBirthGeo?.lon);

  // MC/IC/DSC
  const mcLon =
    (lastBirthUTC instanceof Date && Number.isFinite(lon))
      ? computeMcLon(lastBirthUTC, lon)
      : NaN;

  const icLon  = Number.isFinite(mcLon)  ? wrap360(mcLon + 180)  : NaN;
  const dscLon = Number.isFinite(ascLon) ? wrap360(ascLon + 180) : NaN;

  // houses (use the EXISTING "hsys" you already computed above)
  const houseCusps =
    (hsys === "W")
      ? computeHousesWhole(ascLon)
      : computeHousesPorphyry(ascLon, mcLon);

    lastWheelOpts = { baseLon, ascLon, mcLon, icLon, dscLon, houseCusps, showAngles: true };
    wheelImg.src = renderBirthWheelSVG(bodyLons, lastWheelOpts);

    }

  setBandReady(true);
  birthWheelPending = false;
});

/* =========================
   Real-time inputs
========================= */
const zDate = document.getElementById("zDate");
const zTime = document.getElementById("zTime");
const zGo = document.getElementById("zGo");

function pad2(n) {
  return String(n).padStart(2, "0");
}
function ymdLocal(dt) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
function hmLocal(dt) {
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

(function bootRealtimeInputs() {
  const now = new Date();
  if (zDate && !zDate.value) zDate.value = ymdLocal(now);
  if (zTime && !zTime.value) zTime.value = hmLocal(now);
})();


// Boot: render initial zodiac band at current local inputs
queueMicrotask(() => {
  zGo?.click();
});

function parseLocalInputsToDate() {
  const d = (zDate?.value ?? "").trim();
  const t = (zTime?.value ?? "00:00").trim();
  return new Date(`${d}T${t}:00`);
}

function setInputsFromLocalDate(dtLocal) {
  const y = dtLocal.getFullYear();
  const m = pad2(dtLocal.getMonth() + 1);
  const d = pad2(dtLocal.getDate());
  const hh = pad2(dtLocal.getHours());
  const mm = pad2(dtLocal.getMinutes());
  if (zDate) zDate.value = `${y}-${m}-${d}`;
  if (zTime) zTime.value = `${hh}:${mm}`;
}

/* =========================
   Ephemeris API (lazy import once)
========================= */
let ephApiPromise = null;
async function getEphApi() {
  if (!ephApiPromise) ephApiPromise = import("./engine/ephm/ephem-loader.js");
  return ephApiPromise;
}

// ============================================================
// Expose main.js ephemeris (Go-backed) to other modules (timeline, etc.)
// so everyone reads from the SAME source as the band.
// ============================================================
let __zyTransitFnPromise = null;

async function __getZyTransitFn() {
  if (!__zyTransitFnPromise) {
    __zyTransitFnPromise = getEphApi().then((m) => m.getTransitLongitudesUTC);
  }
  return __zyTransitFnPromise;
}

window.__zyEphem = window.__zyEphem || {};
window.__zyEphem.getPlanetLongitudesUTC = async (dateUTC) => {
  const fn = await __getZyTransitFn();
  return await fn(dateUTC);
};

async function runGo(opts = {}) {
  const fast = !!opts.fast;
  const origin = String(opts.origin || "timeline");

  const payload = {
    date: (zDate?.value ?? "").trim(),
    time: (zTime?.value ?? "").trim(),
  };

  if (!fast) console.log("Go payload:", JSON.stringify(payload, null, 2));

  const { getTransitLongitudesUTC, getFixedStars } = await getEphApi();

  const dtLocal =
    opts.dtLocal instanceof Date
      ? new Date(opts.dtLocal.getTime())
      : parseLocalInputsToDate();

    const longs = await getTransitLongitudesUTC(dtLocal);

      // ✅ If fast sampling, drop stale/out-of-order results
      if (fast && Number.isFinite(opts.seq) && opts.seq !== goSeq) return;

  if (!fast) {
    console.log("Planet longitudes @", dtLocal.toString());
    console.table(longs);
  }

  // ---- Broadcast time + rates + bodies to visual consumers
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj && obj[k] != null) return Number(obj[k]);
    }
    return NaN;
  };

  const wrap360 = (x) => {
    x = x % 360;
    return x < 0 ? x + 360 : x;
  };

  // body longitudes (tropical visual)
  const bodyLons = {
    sun:      pick(longs, ["sun", "Sun", "SOL", "sol", "☉"]),
    moon:     pick(longs, ["moon", "Moon", "☽", "☾"]),
    mercury:  pick(longs, ["mercury", "Mercury", "☿"]),
    venus:    pick(longs, ["venus", "Venus", "♀"]),
    mars:     pick(longs, ["mars", "Mars", "♂"]),
    jupiter:  pick(longs, ["jupiter", "Jupiter", "♃"]),
    saturn:   pick(longs, ["saturn", "Saturn", "♄"]),
    uranus:   pick(longs, ["uranus", "Uranus", "♅"]),
    neptune:  pick(longs, ["neptune", "Neptune", "♆"]),
    pluto:    pick(longs, ["pluto", "Pluto", "♇"]),

    mean_node: pick(longs, ["mean_node", "MeanNode", "meanNode", "node", "Node"]),
    // south_node derived below (keep your existing logic)

    // asteroids
    chiron: pick(longs, ["chiron", "Chiron", "⚷"]),
    ceres:  pick(longs, ["ceres", "Ceres", "⚳"]),
    pallas: pick(longs, ["pallas", "Pallas", "⚴", "pallas_athena", "PallasAthena"]),
    juno:   pick(longs, ["juno", "Juno", "⚵"]),
    vesta:  pick(longs, ["vesta", "Vesta", "⚶"]),
    eros:   pick(longs, ["eros", "Eros", "⟡"]),
  };

  // ASC: comes from Birth chart (city/state -> lat/lon) via the Birth modal pipeline.
  // Timeline "Go" does NOT compute ASC.
  const ascLon = NaN;

  // normalize + derive south node (always opposite)
  if (Number.isFinite(bodyLons.mean_node)) {
    bodyLons.mean_node = wrap360(bodyLons.mean_node);
    bodyLons.south_node = wrap360(bodyLons.mean_node + 180);
  } else {
    bodyLons.south_node = NaN;
  }

  const sunLon = Number.isFinite(bodyLons.sun) ? wrap360(bodyLons.sun) : NaN;

  if (Number.isFinite(sunLon)) {
    const bodyRateDegPerSec = {};
    let sunRateDegPerSec = 0;

    const prev = window.__ZY_LAST_SAMPLE;
    const origin = opts?.origin || "timeline";

    const dtSecRaw = (prev?.tMs != null) ? (dtLocal.getTime() - prev.tMs) / 1000 : NaN;

    const paused = Number(window.TIMELINE_SPEED || 0) === 0;
    const noUsefulPrev = !Number.isFinite(dtSecRaw) || Math.abs(dtSecRaw) < 1; // same-second / first run
    const bigJump = !Number.isFinite(dtSecRaw) || Math.abs(dtSecRaw) > 300;     // > 5 minutes

    // We need a fresh sample when:
    // - birthCalc (preview)
    // - big time jump
    // - paused + no usable previous dt (fixes "rx/s only appears after Play")
    const needFreshRates = (origin === "birthCalc") || bigJump || (paused && noUsefulPrev);


    if (!fast && needFreshRates) {
    // For real-time display when not playing, 60s can quantize to ~0.
    // Use a bigger sample ONLY for timeline+paused so rx/s is correct immediately.
    const stepSec = (origin === "birthCalc") ? 60 : (paused ? 21600 : 60); // 6h when paused
    const dt2 = new Date(dtLocal.getTime() + stepSec * 1000);

    const longs2 = await getTransitLongitudesUTC(dt2);

    const pick = (obj, keys) => {
      for (const k of keys) if (obj && obj[k] != null) return Number(obj[k]);
      return NaN;
    };

    const wrap360 = (x) => {
      x = x % 360;
      return x < 0 ? x + 360 : x;
    };

    const bodyLons2 = {
      sun:       pick(longs2, ["sun", "Sun", "SOL", "sol", "☉"]),
      moon:      pick(longs2, ["moon", "Moon", "☽"]),
      mercury:   pick(longs2, ["mercury", "Mercury", "☿"]),
      venus:     pick(longs2, ["venus", "Venus", "♀"]),
      mars:      pick(longs2, ["mars", "Mars", "♂"]),
      jupiter:   pick(longs2, ["jupiter", "Jupiter", "♃"]),
      saturn:    pick(longs2, ["saturn", "Saturn", "♄"]),
      uranus:    pick(longs2, ["uranus", "Uranus", "♅"]),
      neptune:   pick(longs2, ["neptune", "Neptune", "♆"]),
      pluto:     pick(longs2, ["pluto", "Pluto", "♇"]),
      mean_node: pick(longs2, ["mean_node", "MeanNode", "meanNode", "node", "Node"]),
    };

    if (Number.isFinite(bodyLons2.mean_node)) {
      bodyLons2.mean_node = wrap360(bodyLons2.mean_node);
      bodyLons2.south_node = wrap360(bodyLons2.mean_node + 180);
    } else {
      bodyLons2.south_node = NaN;
    }

    for (const k of Object.keys(bodyLons)) {
      const a = Number(bodyLons[k]);
      const b = Number(bodyLons2[k]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

      let d = b - a;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;

      bodyRateDegPerSec[k] = d / stepSec;
    }

    if (Number.isFinite(bodyRateDegPerSec.sun)) sunRateDegPerSec = bodyRateDegPerSec.sun;
  } else if (prev?.bodyLons && Number.isFinite(prev.tMs)) {
    // Normal smooth stepping: use previous truth sample.
    const dtSec = Math.abs(dtSecRaw) < 1 ? NaN : dtSecRaw;

    if (Number.isFinite(dtSec)) {
      for (const k of Object.keys(bodyLons)) {
        const a = Number(prev.bodyLons?.[k]);
        const b = Number(bodyLons?.[k]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

        let d = b - a;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;

        bodyRateDegPerSec[k] = d / dtSec;
      }
    }

    if (Number.isFinite(bodyRateDegPerSec.sun)) sunRateDegPerSec = bodyRateDegPerSec.sun;
  }

  // store for next truth sample
  // IMPORTANT: Birth->Calculate is preview-only and must NOT overwrite timeline sampling,
  // or s/rx won't compute until Play.
  if ((opts?.origin || "timeline") !== "birthCalc") {
    window.__ZY_LAST_SAMPLE = { tMs: dtLocal.getTime(), sunLon, bodyLons };
  }

  // sim rate (ms/sec) from current UI speed + selected unit
  const unitMs = (u) => {
    const H = 3600000;
    const D = 86400000;
    if (u === "hour") return H;
    if (u === "day") return D;
    if (u === "week") return 7 * D;
    if (u === "month") return 30.436875 * D; // avg month (visual)
    if (u === "year") return 365.2425 * D;   // avg year (visual)
    return D;
  };

  const u = window.TIMELINE_UNIT || bumpUnit || "year";
  const simRateMsPerSec = Number(window.TIMELINE_SPEED || 0) * unitMs(u);

  const fixedStars = await getFixedStars().catch(() => ({}));

  // ✅ Commit current selector choices to the band ONLY on Go
  try {
    localStorage.setItem("zy_filters_committed_v1", JSON.stringify(FILTERS));
    window.__ZY_FILTERS_COMMITTED = { ...FILTERS };
  } catch {}

  window.dispatchEvent(
  new CustomEvent("zy:time", {
    detail: {
      date: dtLocal,
      sunLon,
      sunRateDegPerSec,
      simRateMsPerSec,
      bodyLons,
      bodyRateDegPerSec,
      origin: opts?.origin || "timeline",
      ascLon,
      fixedStars,
    },
  })
);

} else {
  console.warn("[zy:time] Could not find Sun longitude in longs:", longs);
}

  // debug-only (don’t run during play)
  if (fast) return;

  const stars = await getFixedStars();
  console.log("Fixed stars:");
  console.table(stars);

  const dt2 = new Date(dtLocal.getTime() + 60_000);
  const longs2 = await getTransitLongitudesUTC(dt2);

  const jumpReport = {};
  for (const k of Object.keys(longs)) {
    const a = Number(longs[k]);
    const b = Number(longs2[k]);
    let d = b - a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    jumpReport[k] = d;
  }

  console.log("Δlon over +60s (deg) @", dt2.toString());
  console.table(jumpReport);
}

zGo?.addEventListener("click", async () => {
  try {
    // ✅ If user changed Bodies/Stars, apply that to the band NOW
    if (window.__ZY_FILTERS_DIRTY) {
      window.__ZY_FILTERS_DIRTY = false;
      dispatchFilters({ toBand: true, toWheel: false });
    }

    await runGo();

    // ✅ keep playback start aligned (your existing logic)
    timelineMs = parseLocalInputsToDate().getTime();
    lastSampleTimelineMs = timelineMs;
    lastTruthLocalMs = timelineMs;
  } catch (err) {
    console.error(err);
  }
});

/* =========================
   Time unit toggles (selects bump unit)
========================= */
let bumpUnit = "year"; // year | month | week | day | hour

function setUnitSelected(scale) {
  bumpUnit = scale;
  window.TIMELINE_UNIT = bumpUnit; // <— band uses this for smooth per-frame sim
  document.querySelectorAll("#timeToggles .tgl").forEach((b) => b.classList.remove("isOn"));
  const active = document.querySelector(`#timeToggles .tgl[data-scale="${scale}"]`);
  active?.classList.add("isOn");
}

document.querySelectorAll("#timeToggles .tgl").forEach((btn) => {
  btn.addEventListener("click", () => setUnitSelected(btn.dataset.scale));
});

/* =========================
   Play/Pause + Slider speed
========================= */
const track = document.getElementById("bipolarTrack");
const thumb = document.getElementById("thumb");
const speedValueEl = document.getElementById("speedValue");
const playPauseBtn = document.getElementById("playPause");

const MAX_UNITS_PER_SEC = 4;
const DEADZONE_PX = 20; // total width centered
const CURSOR_PAD = 12;

let isDragging = false;
let isPlaying = false;

let simLocal = null;         // the time we're animating
let lastTickT = performance.now();
let goInFlight = false;

// "truth" resync tracking (based on SIMULATED time advanced, not real time)
let lastTruthLocalMs = null;

// thresholds per unit (simulated time)
function truthThresholdMsForUnit(u) {
  const H = 3600000;
  const D = 86400000;

  if (u === "hour")  return 6 * H;   // resync every 6 simulated hours
  if (u === "day")   return 1 * D;   // every 1 simulated day
  if (u === "week")  return 3 * D;   // every 3 simulated days
  if (u === "month") return 7 * D;   // every 7 simulated days
  if (u === "year")  return 30 * D;  // every 30 simulated days

  return 1 * D;
}

const INPUT_THROTTLE_MS = 200;
let lastInputsT = 0;


// ephemeris calls max ~4/sec
let targetSpeed = 0;  // raw target (units/sec)
let currentSpeed = 0; // smoothed (units/sec)
let lastNorm = 0; // remembers thumb position in [-1..+1]

window.TIMELINE_SPEED = 0;
window.TIMELINE_TARGET_SPEED = 0;
window.TIMELINE_IS_PLAYING = false;

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function curve01(x) {
  // 0..1 -> 0..1 : slow near center, faster near edges
  const k = 4.0;
  return (Math.exp(k * x) - 1) / (Math.exp(k) - 1);
}

function setThumbFromNorm(norm) {
  if (!track || !thumb) return;
  const rect = track.getBoundingClientRect();
  const usable = Math.max(1, rect.width - CURSOR_PAD * 2);
  const x = CURSOR_PAD + ((norm + 1) / 2) * usable;
  thumb.style.left = `${x}px`;
}

function computeNormFromClientX(clientX) {
  if (!track) return 0;
  const rect = track.getBoundingClientRect();
  const x = clientX - rect.left;

  const mid = rect.width / 2;
  const halfDead = DEADZONE_PX / 2;

  if (Math.abs(x - mid) <= halfDead) return 0;

  const leftEnd = CURSOR_PAD;
  const rightEnd = rect.width - CURSOR_PAD;

  if (x < mid - halfDead) {
    const t = (x - leftEnd) / ((mid - halfDead) - leftEnd);
    return clamp(t, 0, 1) - 1; // [-1..0]
  } else {
    const t = (x - (mid + halfDead)) / (rightEnd - (mid + halfDead));
    return clamp(t, 0, 1); // [0..+1]
  }
}

function normToSpeed(norm) {
  const s = Math.sign(norm);
  const a = Math.abs(norm);
  const curved = curve01(a);
  return s * (curved * MAX_UNITS_PER_SEC);
}

function updateTargetFromClientX(clientX) {
  const norm = computeNormFromClientX(clientX);
  lastNorm = norm; // ✅ keep for resize reflow

  const spd = normToSpeed(norm);

  targetSpeed = spd;
  window.TIMELINE_TARGET_SPEED = targetSpeed;

  setThumbFromNorm(norm);

 if (speedValueEl) speedValueEl.textContent = targetSpeed.toFixed(2);
}

function reflowThumb() {
  setThumbFromNorm(lastNorm);
}

// Re-apply thumb position when layout changes
window.addEventListener("resize", reflowThumb);

// Optional: if fonts/images shift layout after load
window.addEventListener("load", reflowThumb);

// ---- Timeline clock (UTC instant in ms)
let timelineMs = Date.now();
let lastSampleTimelineMs = timelineMs;
let goSeq = 0; // ✅ increments for fast sampling; newest wins

function setPlayState(nextPlaying) {
  const wasPlaying = isPlaying;
  isPlaying = !!nextPlaying;
  window.TIMELINE_IS_PLAYING = isPlaying;

  if (playPauseBtn) {
    playPauseBtn.textContent = isPlaying ? "Pause" : "Play";
    playPauseBtn.classList.toggle("isPlay", !isPlaying);
    playPauseBtn.classList.toggle("isPause", isPlaying);
  }

if (isPlaying) {
  // ✅ Only seed when transitioning from paused -> playing
  if (!wasPlaying) {
    simLocal = parseLocalInputsToDate();
    timelineMs = simLocal.getTime();
    lastSampleTimelineMs = timelineMs;
    lastTruthLocalMs = timelineMs;
  }

  lastTickT = performance.now(); // always reset frame timer
  } else {
    // ✅ commit the *actual* playback clock (timelineMs), not stale simLocal
    setInputsFromLocalDate(new Date(timelineMs));
  }
}

function isPaused() {
  return !isPlaying;
}

// pointer interactions
function onPointerDown(e) {
  if (!track) return;
  e.preventDefault();
  isDragging = true;
  track.setPointerCapture?.(e.pointerId);

  updateTargetFromClientX(e.clientX);

  // ✅ Slider is the “authority”: only toggle when state actually changes
  if (targetSpeed !== 0 && !isPlaying) setPlayState(true);
  if (targetSpeed === 0 && isPlaying) setPlayState(false);
}

function onPointerMove(e) {
  if (!isDragging) return;
  updateTargetFromClientX(e.clientX);

  // ✅ re-engage automatically when moving off deadzone
  if (targetSpeed !== 0 && !isPlaying) setPlayState(true);
  if (targetSpeed === 0 && isPlaying) setPlayState(false);
}

function onPointerUp() {
  isDragging = false;
}

track?.addEventListener("pointerdown", onPointerDown);
thumb?.addEventListener("pointerdown", onPointerDown); // ✅ allow grabbing the thumb
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
track?.addEventListener("dragstart", (e) => e.preventDefault());
thumb?.addEventListener("dragstart", (e) => e.preventDefault());

// play/pause click
playPauseBtn?.addEventListener("click", () => {
  setPlayState(!isPlaying);
});

// init visuals
lastNorm = 0;
setThumbFromNorm(lastNorm);
if (speedValueEl) speedValueEl.textContent = "0.00";
setPlayState(false);

// ✅ keep thumb glued to correct spot when layout/viewport changes
window.addEventListener("resize", () => {
  setThumbFromNorm(lastNorm);
});

function addYearsUTC(d, years) {
  const out = new Date(d.getTime());
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

function addMonthsUTC(d, months) {
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

function advanceLocal(dt, unitsPerSec, dtSec) {
  const du = unitsPerSec * dtSec;
  if (!Number.isFinite(du) || du === 0) return dt;

  const DAY_MS = 86400000;
  let ms = 0;

  if (bumpUnit === "hour") ms = du * 3600000;
  else if (bumpUnit === "day") ms = du * DAY_MS;
  else if (bumpUnit === "week") ms = du * 7 * DAY_MS;
  else if (bumpUnit === "month") return addMonthsUTC(dt, Math.trunc(du));
  else if (bumpUnit === "year")  return addYearsUTC(dt, Math.trunc(du));

  return new Date(dt.getTime() + ms);
}

// sample when simulated time advances enough (varies by unit)
function sampleStepMsForUnit(u) {
  if (u === "hour") return 2 * 60_000;            // 2 minutes
  if (u === "day") return 60 * 60_000;           // 1 hour
  if (u === "week") return 6 * 60 * 60_000;      // 6 hours
  if (u === "month") return 24 * 60 * 60_000;    // 1 day
  if (u === "year") return 30 * 24 * 60 * 60_000; // ~30 days
  return 60_000;
}

let lastFrameMs = performance.now();

function unitMs(u) {
  if (u === "hour") return 3600000;
  if (u === "day") return 86400000;
  if (u === "week") return 7 * 86400000;
  if (u === "month") return 30.436875 * 86400000;
  if (u === "year") return 365.2425 * 86400000;
  return 0;
}

function tick() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastFrameMs) / 1000);
  lastFrameMs = now;

  // Ease toward target speed (prevents jumpy slider)
  currentSpeed += (targetSpeed - currentSpeed) * (1 - Math.pow(0.001, dt));
  window.TIMELINE_SPEED = currentSpeed;

  if (speedValueEl) {
  const txt = Math.abs(currentSpeed) < 0.005 ? "0.00" : currentSpeed.toFixed(2);
  speedValueEl.textContent = txt; // keep your UI formatting consistent
}

    // Advance timeline when playing (smooth ms-based)
  const u = window.TIMELINE_UNIT || bumpUnit || "year";
  const simRateMsPerSec = Number(window.TIMELINE_SPEED || 0) * unitMs(u);

  if (window.TIMELINE_IS_PLAYING && simRateMsPerSec !== 0) {
    timelineMs += simRateMsPerSec * dt;

    const step = sampleStepMsForUnit(u);
    if (Math.abs(timelineMs - lastSampleTimelineMs) >= step) {
      lastSampleTimelineMs = timelineMs;
      const seq = ++goSeq;
      Promise.resolve(runGo({ fast: true, dtLocal: new Date(timelineMs), seq })).catch(console.error);
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* =========================
   Bump arrows (only when paused)
   Rules:
   - Month bump = same day number if possible, else clamp (e.g. 31 -> 30/28)
   - Year bump = Feb 29 -> Feb 28 on non-leap years (automatic via clamp)
========================= */
const bumpBack = document.getElementById("bumpBack");
const bumpFwd = document.getElementById("bumpFwd");

function daysInMonthUTC(y, m0) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

function addMonthsClampUTC(dtUTC, deltaMonths) {
  const y = dtUTC.getUTCFullYear();
  const m = dtUTC.getUTCMonth();
  const d = dtUTC.getUTCDate();

  const targetM = m + deltaMonths;
  const y2 = y + Math.floor(targetM / 12);
  const m2 = ((targetM % 12) + 12) % 12;

  const maxD = daysInMonthUTC(y2, m2);
  const d2 = Math.min(d, maxD);

  return new Date(Date.UTC(
    y2, m2, d2,
    dtUTC.getUTCHours(), dtUTC.getUTCMinutes(), dtUTC.getUTCSeconds()
  ));
}

function addYearsClampUTC(dtUTC, deltaYears) {
  return addMonthsClampUTC(dtUTC, deltaYears * 12);
}

function addDaysUTC(dtUTC, deltaDays) {
  return new Date(dtUTC.getTime() + deltaDays * 86400000);
}

function addHoursUTC(dtUTC, deltaHours) {
  return new Date(dtUTC.getTime() + deltaHours * 3600000);
}

function daysInMonthLocal(y, m0) {
  // m0 = 0..11
  return new Date(y, m0 + 1, 0).getDate();
}

function addMonthsClampLocal(dtLocal, deltaMonths) {
  const y = dtLocal.getFullYear();
  const m = dtLocal.getMonth();
  const d = dtLocal.getDate();

  const hh = dtLocal.getHours();
  const mm = dtLocal.getMinutes();
  const ss = dtLocal.getSeconds();
  const ms = dtLocal.getMilliseconds();

  const targetM = m + deltaMonths;
  const y2 = y + Math.floor(targetM / 12);
  const m2 = ((targetM % 12) + 12) % 12;

  const maxD = daysInMonthLocal(y2, m2);
  const d2 = Math.min(d, maxD);

  return new Date(y2, m2, d2, hh, mm, ss, ms);
}

function addYearsClampLocal(dtLocal, deltaYears) {
  return addMonthsClampLocal(dtLocal, deltaYears * 12);
}

async function doBump(direction) {
  if (!isPaused()) return;

  const sign = direction === "back" ? -1 : 1;

  const dtLocal = parseLocalInputsToDate();
  let nextLocal = dtLocal;

  if (bumpUnit === "year") nextLocal = addYearsClampLocal(dtLocal, 1 * sign);
  else if (bumpUnit === "month") nextLocal = addMonthsClampLocal(dtLocal, 1 * sign);
  else if (bumpUnit === "week") nextLocal = new Date(dtLocal.getTime() + sign * 7 * 86400000);
  else if (bumpUnit === "day") nextLocal = new Date(dtLocal.getTime() + sign * 86400000);
  else if (bumpUnit === "hour") nextLocal = new Date(dtLocal.getTime() + sign * 3600000);

  setInputsFromLocalDate(nextLocal);
  await runGo();
}

bumpBack?.addEventListener("click", () => doBump("back"));
bumpFwd?.addEventListener("click", () => doBump("fwd"));

// Optional: disable bump while playing (makes it obvious)
setInterval(() => {
  const disabled = !isPaused();
  if (bumpBack) bumpBack.disabled = disabled;
  if (bumpFwd) bumpFwd.disabled = disabled;
}, 200);

