/* conjunction-selector.js — UI for selecting a planetary ☌ cycle
   =========================================================
   Phase 1 (this patch):
   • Adds a small popout to choose Planet 1 + Planet 2
   • Persists choice in localStorage
   • Updates labels: top cycle button + prev/next conjunction nav buttons
   • Does NOT yet rebuild the timeline cycle graphics (next step)
   ========================================================= */
(function () {
  const cycleModal = document.getElementById("cycleModal");
  const cycleFab   = document.getElementById("cycleFab");
  const cycleClose = document.getElementById("cycleClose");
  const cycleApply = document.getElementById("cycleApply");
  const p1Sel      = document.getElementById("cyclePlanet1");
  const p2Sel      = document.getElementById("cyclePlanet2");

  if (!cycleModal || !cycleFab || !cycleClose || !cycleApply || !p1Sel || !p2Sel) {
    console.warn("[cycle] modal DOM not found; conjunction selector disabled.");
    return;
  }

  const cycleCardEl = cycleModal.querySelector(".zyModalCard");
  const cycleBackdropEl = cycleModal.querySelector(".zyModalBackdrop");

    // Outer-planet cycles only (Saturn → Pluto).
    // Inner planets (and Jupiter) will appear at the next scale down / personal timeline.
    const PLANETS = [
        { id: "Saturn",  label: "Saturn ♄",  glyph: "♄" },
        { id: "Uranus",  label: "Uranus ♅",  glyph: "♅" },
        { id: "Neptune", label: "Neptune ♆", glyph: "♆" },
        { id: "Pluto",   label: "Pluto ♇",   glyph: "♇" },
    ];

  const planetById = new Map(PLANETS.map(p => [p.id, p]));

  function fillSelect(sel) {
    sel.innerHTML = "";
    for (const p of PLANETS) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      sel.appendChild(opt);
    }
  }

  function getGlyph(id) {
    const p = planetById.get(id);
    return p ? p.glyph : "?";
  }

  function setCycleSelection(p1, p2, persist = true) {
    // Defaults now that Jupiter is removed from the modal:
    if (!planetById.has(p1)) p1 = "Saturn";
    if (!planetById.has(p2)) p2 = "Neptune";

    // If same planet chosen, pick a sane alternate that exists in PLANETS
    if (p1 === p2) {
      // prefer Neptune unless p1 is Neptune, then use Uranus
      p2 = (p1 === "Neptune") ? "Uranus" : "Neptune";
      // if still somehow invalid, hard fallback
      if (!planetById.has(p2)) p2 = "Uranus";
    }

    if (persist) {
      localStorage.setItem("zy_cycle_p1", p1);
      localStorage.setItem("zy_cycle_p2", p2);
    }

    // Global anchor for next step (cycle renderer swap)
    window.CycleSelection = { p1, p2 };

    // Global helper: active conjunction list for the currently selected pair
    window.getActiveConjunctionEvents = function () {
    const sel = window.CycleSelection || { p1: "Saturn", p2: "Neptune" };
    const key = `${sel.p1}|${sel.p2}`;

    const map = window.CONJUNCTION_DATASETS || {};
    const ds = map[key] || map[`${sel.p2}|${sel.p1}`];

    // Fallback: legacy Saturn–Jupiter dataset
    if (!ds || !Array.isArray(ds.events) || ds.events.length < 2) {
        return window.CONJUNCTION_DATA || [];
    }
    return ds.events;
    };

    const pair = `${getGlyph(p1)} ☌ ${getGlyph(p2)}`;
    const textSpan = cycleFab.querySelector('.cycleFabText');
    if (textSpan) {
      // Keep the static text, glyphs are already in HTML
    } else {
      cycleFab.textContent = pair;
    }

    // Keep the conj nav buttons consistent with the chosen pair
    const prevConjBtn = document.getElementById("prevConjBtn");
    const nextConjBtn = document.getElementById("nextConjBtn");
    if (prevConjBtn) prevConjBtn.textContent = `← ${pair}`;
    if (nextConjBtn) nextConjBtn.textContent = `${pair} →`;
  }

  function openCycle() {
    cycleModal.setAttribute("aria-hidden", "false");

    // Click-through modal: only the card captures input (matches wheel behavior)
    cycleModal.style.pointerEvents = "none";
    if (cycleBackdropEl) cycleBackdropEl.style.pointerEvents = "none";
    if (cycleCardEl) cycleCardEl.style.pointerEvents = "auto";

    // Anchor card to the Cycle button's top-left (viewport coords)
    const r = cycleFab.getBoundingClientRect();

    const margin = 8;
    const desiredLeft = r.left;
    const desiredTop  = r.top;

    // Clamp so it never renders off-screen
    const cardW = cycleCardEl.offsetWidth || 360;
    const cardH = cycleCardEl.offsetHeight || 220;

    const maxLeft = Math.max(margin, window.innerWidth - cardW - margin);
    const maxTop  = Math.max(margin, window.innerHeight - cardH - margin);

    const left = Math.min(Math.max(desiredLeft, margin), maxLeft);
    const top  = Math.min(Math.max(desiredTop,  margin), maxTop);

    cycleCardEl.style.left = `${left}px`;
    cycleCardEl.style.top  = `${top}px`;

    // Sync selects to current selection
    const cur = window.CycleSelection || {};
    if (cur.p1) p1Sel.value = cur.p1;
    if (cur.p2) p2Sel.value = cur.p2;
    }

  function closeCycle() {
    cycleModal.setAttribute("aria-hidden", "true");

    // reset (safe)
    cycleModal.style.pointerEvents = "";
    if (cycleBackdropEl) cycleBackdropEl.style.pointerEvents = "";
    if (cycleCardEl) cycleCardEl.style.pointerEvents = "";
  }

  // init
  fillSelect(p1Sel);
  fillSelect(p2Sel);

  const savedP1 = localStorage.getItem("zy_cycle_p1") || "Saturn";
  const savedP2 = localStorage.getItem("zy_cycle_p2") || "Neptune";
  setCycleSelection(savedP1, savedP2, false);

  closeCycle();

  // wiring
  cycleFab.addEventListener("click", openCycle);
  cycleClose.addEventListener("click", closeCycle);

  cycleApply.addEventListener("click", () => {
    setCycleSelection(p1Sel.value, p2Sel.value, true);
    closeCycle();

    // Hook for next step (renderer swap)
    window.dispatchEvent(new CustomEvent("zy:cyclechange", { detail: window.CycleSelection }));

    // Force rebuild immediately (covers cases where listeners attach late)
    try {
    if (typeof window.rebuildConjunctionCycleBand === "function") window.rebuildConjunctionCycleBand();
    else if (typeof window.buildElementalCycle === "function") window.buildElementalCycle();
    } catch (e) {
    console.warn("[cycle] immediate rebuild failed", e);
    }
  });

  cycleModal.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t && t.getAttribute && t.getAttribute("data-close") === "cycle") closeCycle();
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && cycleModal.getAttribute("aria-hidden") === "false") closeCycle();
  });
})();