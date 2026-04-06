// js/swe-init.js
// Initializes Swiss Ephemeris (WASM) and exposes a tiny compatibility layer
// expected by astronomy-adapter.js (window.SWE + window.SWE_READY).
//
// Install (Node/Vite):
//   npx jsr add @fusionstrings/swiss-eph
//
// Then restart `npm run dev`.

import { Constants, load } from "@fusionstrings/swiss-eph/wasi";

window.SWE_READY = false;

async function initSwiss() {
  try {
    const eph = await load();

    const SWE = {
      ...Constants,

      // Compatibility names (adapter expects julday/calc_ut)
      julday: (y, m, d, hour, gregflag) => eph.swe_julday(y, m, d, hour, gregflag),

      calc_ut: (jd_ut, bodyId, flags) => {
        const out = eph.swe_calc_ut(jd_ut, bodyId, flags);
        if (out && out.error) console.warn("[SWE] swe_calc_ut:", out.error);
        return out;
      },

      // Optional: houses API (MyTimeline adapter uses houses_ex2)
      houses_ex2: (...args) => eph.swe_houses_ex2?.(...args),

      // Optional: set ephemeris path (often a no-op in wasm builds)
      swe_set_ephe_path: (p) => eph.swe_set_ephe_path?.(p),
      swe_set_ephe_path_utf8: (p) => eph.swe_set_ephe_path?.(p),

      version: () => eph.swe_version?.() ?? "",
    };

    window.SWE = SWE;
    window.SWE_READY = true;
    console.log("[SWE] ready", SWE.version());
  } catch (err) {
    console.warn("[SWE] init failed (wheel will fall back).", err);
  }
}

window.SWE_READY_PROMISE = initSwiss();
