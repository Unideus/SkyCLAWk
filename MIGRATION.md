# SkyCLAWk Migration Plan

> Historical note, 2026-07-10: this file documents the original consolidation plan. It is not the current route or page inventory. Use `README.md` for the current app list and build notes.

## Overview

Consolidate 4 projects (Timeline/app-timeline, Timeline/auspicious, Timeline/skyclock, Timeline/planting)
and a dozen crossed-boundary files into 6 independent page-apps under one `SkyCLAWk/` roof.
Each page is a standalone HTML+JS app with zero cross-page bleed.
Shared modules live in `shared/` and are immutable data or stable utilities.

## Directory Structure

```
SkyCLAWk/
├── skyclock/
│   ├── index.html
│   └── js/
│       ├── skyclock-engine.js   ← copied from Timeline/skyclock/js/skyclock-engine.js
│       ├── astro-wheel.js       ← copied from Timeline/skyclock/js/astro-wheel.js (cyclical wheel)
│       ├── heaven-data.js       ← copied from Timeline/skyclock/js/heaven-data.js
│       └── main.js              ← copied from Timeline/skyclock/js/main.js
├── generational/
│   ├── index.html
│   └── js/
│       ├── time-engine.js       ← from app-timeline/js/time-engine.js (generational constants)
│       ├── screw-renderer.js    ← from app-timeline/js/screw-renderer.js
│       ├── events-renderer.js   ← from app-timeline/js/events-renderer.js
│       ├── generation-model.js  ← from app-timeline/js/generation-model.js
│       ├── history-engine.js    ← from app-timeline/js/history-engine.js
│       ├── history-bridge.js    ← from app-timeline/js/history-bridge.js
│       ├── conjunction-selector.js ← from app-timeline/js/conjunction-selector.js
│       ├── planetary-cycles.js  ← from app-timeline/js/planetary-cycles.js
│       ├── ui-controller.js     ← from app-timeline/js/ui-controller.js (generational section)
│       ├── monarchs-data.js     ← from app-timeline/js/monarchs-data.js
│       ├── _era_markers.js      ← from app-timeline/js/_era_markers.js
│       ├── _historical_events.js ← from app-timeline/js/_historical_events.js
│       ├── conjunction_data files ← 11 sets from app-timeline/js/
│       └── render-river-3d.js   ← from app-timeline/js/render-river-3d.js
├── personal/
│   ├── index.html
│   └── js/
│       ├── personal-life.js     ← from app-timeline/js/personal-life.js
│       ├── time-engine.js       ← from app-timeline/js/time-engine.js (personal scale)
│       ├── screw-renderer.js    ← from app-timeline/js/screw-renderer.js (personal scale)
│       ├── planetary-cycles.js  ← from app-timeline/js/planetary-cycles.js
│       └── ui-controller.js     ← from app-timeline/js/ui-controller.js (personal section)
├── planting/
│   ├── index.html
│   └── js/
│       ├── planting.js          ← from app-timeline/planting/planting.js
│       ├── screw-renderer.js    ← from app-timeline/planting/screw-renderer.js
│       ├── astro-wheel.js       ← from app-timeline/js/astro-wheel-planting.js (static fork)
│       ├── constants.js         ← from app-timeline/planting/constants.js
│       ├── conjunction-selector.js ← from app-timeline/planting/conjunction-selector.js
│       └── ui-controller.js     ← from app-timeline/planting/ui-controller.js
├── auspicious/
│   ├── index.html               ← from Timeline/auspicious/index.html
│   ├── js/
│   │   ├── main.js              ← from Timeline/auspicious/js/main.js
│   │   ├── astro-engine.js      ← from Timeline/auspicious/js/astro-engine.js
│   │   └── rules-engine.js      ← from Timeline/auspicious/js/rules-engine.js
│   └── package.json             ← from Timeline/auspicious/package.json
├── shared/
│   ├── constants.js             ← from app-timeline/js/constants.js (glyphs, signs, colors)
│   ├── astro-wheel.js           ← from app-timeline/js/astro-wheel.js (main wheel, 8 HUD)
│   ├── astronomy-adapter.js     ← from app-timeline/js/astronomy-adapter.js
│   ├── swe-init.js              ← from app-timeline/js/swe-init.js
│   └── heaven-data.js           ← from app-timeline/js/heaven-data.js
├── css/
│   ├── timeline.css
│   └── astro-hud.css
├── data/
│   └── cities.json
├── images/                      ← president portraits, logos, etc.
├── public/
│   └── ephe/                    ← Swiss Ephemeris .se1 files
├── package.json
├── vite.config.js
├── MIGRATION.md                 ← this file
├── README.md
├── LICENSE
└── _redirects
```

## Page Independence Rules

1. No page JS file is loaded by another page's HTML.
2. Generational and personal each have their own time-engine, screw-renderer, and ui-controller.
3. Only shared/ files are cross-page imports (constants, astro-wheel, swe-init).
4. Planting's astro-wheel is in planting/js/ (static fork).
5. Auspicious keeps its own Vite config (WASM+top-level-await).

## Route Mapping

| Route           | Page         | File                          |
|-----------------|--------------|-------------------------------|
| /               | Generational | generational/index.html       |
| /personal/      | Personal     | personal/index.html           |
| /skyclock/      | Skyclock     | skyclock/index.html           |
| /planting/      | Planting     | planting/index.html           |
| /auspicious/    | Auspicious   | auspicious/index.html         |

## Build

Single Vite multi-page build. One `npm run build` outputs the configured page entries + shared assets to dist. See `vite.config.js` and `README.md` for the current page list.

## Migration Steps

1. Create directory structure ✓
2. Copy shared modules (constants, astro-wheel, swe-init, astronomy-adapter, heaven-data)
3. Set up package.json + vite.config.js with multi-entry build
4. Migrate generational page (strip personal/planting logic from ui-controller)
5. Migrate personal page (own ui-controller, own index.html)
6. Migrate planting page (from app-timeline/planting/ as-is, update paths)
7. Migrate skyclock page (from Timeline/skyclock/ as-is, update paths)
8. Migrate auspicious page (from Timeline/auspicious/ as-is, update paths)
9. Update all <script src="..."> paths in each index.html
10. Create _redirects for Cloudflare
11. Build and verify -- check all pages load without console errors
12. Archive old Timeline repo
