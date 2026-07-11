# SkyCLAWk Cross-Analysis: Webapp vs. Godot vs. Big Desktop Apps
## What's Done, What's Planned, Pricing, and Low-Hanging Fruit

---

## 1. THREE LAYERS OF THE SKYCLAWK PROJECT

The project spans three layers, each at different stages of completion:

### Layer 1: Webapp (`/GitHub/SkyCLAWk/`)
**Status: Live, functional, public-facing**
9 modules running at zodiyuga.com:

| Module | What It Does | Status |
|--------|-------------|--------|
| **Skyclock** | Live sky clock with 4 modes (Fixed, Real-time, Precession, Yuga), 10 planets, constellations, tropical zodiac, houses, Vitruvian overlay, Gleason map, popout wheel | ✅ Complete |
| **Zodiac Wheel** | Standalone interactive wheel, BroadcastChannel sync with timeline | ✅ Complete |
| **Generational Timeline** | 28 conjunction datasets, screw renderer, era markers, historical events, US map animation | ✅ Complete |
| **Personal Timeline** | Same engine + personal life events | ✅ Complete |
| **Planting Calendar** | Biodynamic/lunar planting guidance, transits grid, elemental overlays | ✅ Complete |
| **Auspicious** | Electional calculator, SWE WASM, 17 topics, full dignities, planetary hours, fixed stars | ✅ Complete |
| **Report Engine** | Print-quality natal wheel, 19-page PDF, 60+ templates, EN/ES | ✅ Complete |
| **Cymatics** | Frequency/zodiac correspondence atlas, 16 authors, compare mode | ✅ Complete |
| **Gematria** | Septinary cipher | ✅ Complete |

### Layer 2: Godot Engine (`/Master Godot SkyCLAWk/`)
**Status: Prototype, private, not yet shipping**
Godot 4.7 project. The desktop application that will be the paid product.

**What's already built and working:**

| Component | Status | Notes |
|-----------|--------|-------|
| 2D Astro Wheel | ✅ Complete | 12 sectors, rings, ticks, Unicode planet glyphs |
| Planet Placer | ✅ Complete | Ephemeris-driven positions from JPL DE440 binary tables |
| Ephemeris Pipeline | ✅ Complete | Skyfield generator, 5 binary files (Moon 0.5h, inner 1h, outer 12h, helio 12h, stars daily) |
| Constellation Lines | ✅ Complete | HR catalog, 3D line meshes, Bullinger overlay |
| Procedural Zodiac Wheel | ✅ Complete | 3D zodiac sectors with materials |
| Gleason 1892 Map | ✅ Complete | Flat Earth base plane in 3D scene |
| Speed Controls | ✅ Complete | Pause, 1x-1000x, reverse, unit selector |
| Timeline Strip | ✅ Complete | 2D generational timeline screw, S-J conjunctions, era markers |
| HUD Panels | ✅ Complete | Elements grid, aspects triangle, planet glyph readout |
| 3D Camera | ✅ Complete | Orthographic top-down, adjustable zoom |
| 2D→3D Integration | ✅ Complete | 3D scene with 2D wheel overlay |
| Morph Transition | ✅ Complete | 2D wheel ↔ 3D tropical system, teaching pyramid |
| Astrocartography | ✅ Prototype | JPL + Gleason + closed-form torus knot ASC/DSC lines |
| Eclipse Mode | ✅ Prototype | Shadow paths on Gleason map, time slider, eclipse data JSON |
| 3D History Graph | ✅ Prototype | Category lanes, scope-depth Z, zoom visibility, camera orbit/pan/zoom, hover/selection, search, filters |
| Cymatics 3D | ✅ Prototype | Tree of Life graph, related-object layers, preset HUD, animated membrane |
| Heliocentric Starmap | ✅ Prototype | Bullinger with zodiac, zodiac overlay |
| Heaven Plane | ✅ Prototype | SubViewport render of 2D wheel onto 3D plane |
| Cymatic Membrane | ✅ Prototype | Bessel standing-wave atmospheric model (June 2026) |
| Atmosphere Gradient | ✅ Complete | Refraction layers + personal dome |
| Analemma Renderer | ✅ Complete | Procedural analemma |
| Starfield | ✅ Complete | Cleaned texture generation, stars.json, constellation lines |
| Lore VCS | ✅ Complete | 67+ revisions committed |

**What still needs to be built (from business plan v5.3):**

| Priority | Feature | Est. Effort | Who |
|----------|---------|-------------|-----|
| P1 | Swiss Ephemeris GDExtension | 1-2 weeks | Hire (C++ dev) |
| P1 | ENP Axis Toggle (full precessional math) | 1-2 weeks | Hire |
| P1 | Polished UI (glassmorphism, observatory aesthetic) | 1-2 weeks | Hire |
| P1 | 3D Yuga Spiral (2D→3D, 90° transition to Timeline Screw) | 2-3 weeks | Hire |
| P2 | Context-Aware Guide System (deterministic, no AI) | 1 week | AI/Codex |
| P2 | Licensing/Activation (Phase 1 vs Phase 2, grandfathering) | 1 week | Hire |
| P2 | Chart Editor and Print System | 2 weeks | Hire |
| P3 | Astrocartography in Engine (clickable Gleason, observer dome) | 2-3 weeks | Hire |
| P3 | Atmospheric Dome Shader | 2-3 weeks | Hire |
| P4 | Vitruvian Avatar (teaching mode, scale-shifting guide) | 2-3 weeks | Hire |

**Architecture note:** The Godot engine has a planned but NOT built astrology calculation layer:
```
EphemerisBackend (abstract Resource)
├── JSONEphemerisBackend   ← astronomy-engine pre-computed (MIT, current)
├── AstroEngineBackend     ← astronomy-engine real-time (MIT, future GDExtension)
└── SwissEphBackend         ← Swiss Ephemeris (GPL/commercial, Pro tier)
```
This is the SWE bridge the Godot dev needs to build. The webapp auspicious already has a working SWE WASM implementation to reference.

### Layer 3: Business Infrastructure (`/Company_OS/`)
**Status: Planned, partially deployed**

| Component | Status | Notes |
|-----------|--------|-------|
| Web app at zodiyuga.com | ✅ Live | Lead magnet |
| Stripe ($19 cosmic report) | ❌ Not created | 1 hour to set up |
| MailerLite (free saeculum report) | ❌ Not connected | Content written, needs wiring |
| CTAs on web app | ❌ Not added | "Free report" + "Early access" buttons |
| PDF delivery pipeline | ❌ Not built | Stripe → MailerLite → PDF email |
| YouTube channel | ❌ Not started | One demo video per month |
| Substack | ❌ Not started | Weekly long-form |
| SE license ($600-750) | ❌ Not purchased | Trust funds when ready |

---

## 2. CROSS-ANALYSIS: GODOT vs. WEBAPP vs. DESKTOP APPS

### Features in ALL THREE layers (webapp + Godot + desktop apps have):

| Feature | Webapp | Godot | Solar Fire etc. |
|---------|--------|-------|-----------------|
| Planet positions (10 bodies) | ✅ (skyclock, auspicious 7) | ✅ (binary ephemeris) | ✅ |
| Natal chart wheel | ✅ (report engine) | ✅ (2D + 3D) | ✅ |
| Zodiac ring with elements | ✅ | ✅ | ✅ |
| House system | ✅ (whole sign) | ✅ (planned: Porphyry, Whole Sign, Equal) | ✅ (20+) |
| Aspects | ✅ (auspicious, report) | ✅ (planned in architecture) | ✅ |
| Speed/time controls | ✅ (skyclock) | ✅ | ❌ |
| Constellation overlay | ✅ (skyclock) | ✅ (3D lines) | ❌ |
| Tropical/sidereal toggle | ✅ (skyclock) | ✅ (planned ENP) | ✅ |

### Features in Godot but NOT in webapp (Godot advantage):

| Feature | Godot | Webapp | Desktop Apps |
|---------|-------|--------|-------------|
| 3D Gleason map | ✅ | ❌ | ❌ |
| 3D history graph (interactive) | ✅ | ❌ | ❌ |
| Eclipse shadow paths on map | ✅ | ❌ | Partial (Solar Fire) |
| Astrocartography (3D lines on Gleason) | ✅ | ❌ | ✅ (but 2D maps) |
| Morph transition 2D→3D | ✅ | ❌ | ❌ |
| Teaching pyramid | ✅ | ❌ | ❌ |
| Cymatic membrane (Bessel) | ✅ | ❌ | ❌ |
| Cymatics 3D atlas (Tree of Life) | ✅ | ❌ | ❌ |
| Heliocentric starmap | ✅ | ❌ | Partial (Stellarium) |
| Heaven plane (wheel as 3D texture) | ✅ | ❌ | ❌ |
| Atmospheric dome / refraction | ✅ | ❌ | ❌ |
| Vitruvian avatar | Planned | ✅ (skyclock overlay) | ❌ |

### Features in webapp but NOT in Godot (webapp advantage):

| Feature | Webapp | Godot | Desktop Apps |
|---------|--------|-------|-------------|
| Electional scoring engine (17 topics) | ✅ | ❌ | Partial (Solar Fire) |
| Essential dignities (5-tier) | ✅ | Planned | ✅ |
| Planetary hours | ✅ | Planned | ✅ |
| Void of course Moon | ✅ | ❌ | ✅ |
| Moon phases | ✅ | ❌ | ✅ |
| Day/Night sect | ✅ | ❌ | ✅ |
| Fixed star conjunctions | ✅ | ✅ (star data) | ✅ |
| PDF report generation (19 pages) | ✅ | ❌ | ✅ |
| EN + ES localization | ✅ | ❌ | Partial |
| Cymatics correspondence (16 authors) | ✅ | ✅ (3D) | ❌ |
| Gematria | ✅ | ❌ | ❌ |
| Planting calendar | ✅ | ❌ | ❌ |
| Swiss Ephemeris (live WASM) | ✅ | ❌ (binary tables) | ✅ |
| City autocomplete + geocoding | ✅ | ❌ | ✅ (ACS atlas) |

### Features in desktop apps but in NEITHER layer:

| Feature | Webapp | Godot | Priority |
|---------|--------|-------|----------|
| Transit-to-natal bi-wheel | ❌ | ❌ | High — most expected feature |
| Solar/lunar/planetary returns | ❌ | ❌ | High |
| Synastry (two-chart compatibility) | ❌ | ❌ | High |
| Progressed chart | ❌ | ❌ | Medium |
| Composite/Davison chart | ❌ | ❌ | Medium |
| Additional house systems (Placidus, Koch, etc.) | ❌ (whole sign only) | Planned | Low — easy to add |
| Sidereal ayanamsas (Lahiri, etc.) | ❌ | Planned | Low |
| Chiron + Nodes + Lilith | ❌ | ❌ | Trivial |
| Asteroids (Ceres, Pallas, etc.) | ❌ | ❌ | Low |
| Arabic Parts (Lots) | ❌ | Planned (arch) | Low — pure formula |
| Midpoint trees | ❌ | ❌ | Medium |
| Harmonic charts | ❌ | ❌ | Medium |
| Chart database (save/load/search) | ❌ | ❌ | Low — localStorage |
| Solar Arc directions | ❌ | ❌ | Medium |
| Profections | ❌ | ❌ | Trivial — pure math |
| Report writer (custom text editor) | ❌ | ❌ | Low priority |
| Vedic / Jyotish module | ❌ | ❌ | Low |

---

## 3. PRICING & REVENUE STRATEGY (from Business Plan v5.3)

### Product Pricing

| Product | Price | Status | Target |
|---------|-------|--------|--------|
| Web app (zodiyuga.com) | Free | ✅ Live | Lead magnet, email capture |
| $19 Cosmic Report PDF | $19 | ❌ Not wired | Primary revenue driver |
| SkyCLAWk Desktop Phase 1 | $79 | Prototype | Early adopters, grandfathered for life |
| SkyCLAWk Desktop Phase 2 | $149 | Planned | Working professionals |

### Partner Editions (70/30 split)

| Partner | Edition | Timeline |
|--------|---------|----------|
| Marty Leeds | Gnostic Academy Edition | Phase 1 |
| Chris Brennan | Astrology Podcast Edition | Phase 2+ |
| Crrow777 | Crrow777 Edition | Phase 2+ |

### Revenue Tracks

1. **Revenue (Web Funnel):** Free web app → Email capture (free saeculum report) → $19 report → Funds everything
2. **Content (Audience):** YouTube → Substack → Podcast appearances → Drives interest to web app + waitlist
3. **Prototype (Product):** Build prototype → Document → Hand off to developer → Desktop engine ships

### Revenue Projection (Conservative)

| Month | Free Reports | $19 Sales | Revenue | Cumulative |
|-------|-------------|-----------|---------|-----------|
| July | 50 | 5 | $95 | $95 |
| August | 100 | 10 | $190 | $285 |
| September | 200 | 20 | $380 | $665 |
| October | 400 | 40 | $760 | $1,425 |
| November | 600 | 60 | $1,140 | $2,565 |
| December | 800 | 80 | $1,520 | $4,085 |

**Target:** $4,085 by end of Year 1. Funds SE license ($600-750) + first contractor deposit ($3K).
**Upside:** One podcast appearance → 50K visitors → 3% conversion → $28,500 from one event.

### Developer Cost Estimate

| Task | Cost |
|------|------|
| SE license | $600-750 (Trust purchases) |
| SE GDExtension dev | 1-2 weeks contractor |
| ENP Axis Toggle | 1-2 weeks |
| Polished UI | 1-2 weeks |
| 3D Yuga Spiral | 2-3 weeks |
| **Total contractor** | ~$2K-8K depending on experience |

---

## 4. LOW-HANGING FRUIT — What You Can Build NOW

### Tier A: Content & Business (No code needed — from business plan)
*These are listed as "Easy: AI/Codex Can Handle These" in v5.3*

1. **Planet placement interpretations** (120 entries) — 10 planets × 12 signs, 2-3 sentences each. AI writes, you edit. 4-6 hours.
2. **Aspect interpretations** (5 entries) — Conjunction, sextile, square, trine, opposition. 1 hour.
3. **Free saeculum report** — MailerLite automation. Content written, just needs connection. 2 hours.
4. **CTAs on web app** — "Get your free preview report" + "Join early access." 1 hour.
5. **Stripe product for $19 report** — One-time purchase. 1 hour.
6. **First YouTube video script** — Web app walkthrough. 2-3 hours.
7. **First Substack post** — "The Two Axes of Time." 2-3 hours.
8. **Developer handoff docs** — Already partially done. 4-6 hours.

**Total Ian time: ~20-25 hours. Doable in 2-3 weeks.**

### Tier B: Webapp Features (Codex/Aider can handle — no Godot needed)

1. **Chiron + Nodes + Lilith** — SWE already returns them in auspicious. Add IDs. Hours.
2. **Additional house systems** — Dropdown: Placidus, Koch, Equal, Regiomontanus. SWE supports all. 1 day.
3. **Sidereal zodiac toggle** — SWE `swe_set_sid_mode()`. 1 day.
4. **Arabic Parts** — Lot of Fortune, Spirit, Eros, etc. Pure formula. 1 day.
5. **Profections** — Annual sign rotation. Pure math. Hours.
6. **Chart save/load** — localStorage. 1 day.
7. **Aspect interpretations** — Text strings per aspect pair. 1 day.
8. **Natal chart wheel for auspicious** — Codex prompt already written. 1-2 days.
9. **Transit bi-wheel** — Natal + transit with aspect lines. 3-5 days.
10. **Synastry** — Two saved charts, aspects between. 3-5 days.
11. **Solar Return** — Find Sun return, cast chart. 2-3 days.

### Tier C: Godot Features (Codex/Aider can handle — no SWE GDExtension needed)

These can be done with the existing binary ephemeris (Skyfield/JPL DE440), before the SWE bridge is built:

1. **Context-Aware Guide System** — Deterministic help. No AI. 1 week.
2. **Planet placement interpretations** — Same 120 entries, wired into Godot HUD. 1 day.
3. **Aspect interpretations** — Same 5 entries, wired into Godot. 1 day.
4. **Licensing/Activation** — Phase 1 vs Phase 2 logic. 1 week.
5. **Additional house systems** — The binary ephemeris + existing `houses.gd` architecture supports it.
6. **Arabic Parts** — Same formula-based Lots. No SWE needed.
7. **Profections** — Pure math.
8. **Chart save/load** — File I/O in Godot.

### Tier D: Must Hire Developer (from business plan)
1. **Swiss Ephemeris GDExtension** — C++ integration with Godot. $600-750 license + 1-2 weeks dev.
2. **ENP Axis Toggle** — Full precessional math. 1-2 weeks.
3. **Polished UI** — Glassmorphism. 1-2 weeks.
4. **3D Yuga Spiral** — 2D→3D transition. 2-3 weeks.
5. **PDF delivery pipeline** — Stripe → MailerLite → PDF email. 1-2 days.
6. **Chart editor and print system** — 2 weeks.
7. **Astrocartography engine integration** — Clickable Gleason. 2-3 weeks.

---

## 5. UPDATED GODOT DEVELOPER JOB SPEC

### What Changed From The Original Spec

The original spec assumed the Godot project was empty. It's not — there's a substantial prototype. The dev is not building from scratch. They're integrating SWE into an existing engine with 20+ working scripts, 10+ scenes, binary ephemeris data, and a clear architecture.

### Revised Deliverables

**1. SWE GDExtension (primary task)**
- Compile Swiss Ephemeris C library as a Godot GDExtension (C++)
- Replace the current JSONEphemerisBackend with SwissEphBackend
- The architecture already has the abstract `EphemerisBackend` interface defined
- Must compute: planet positions (Sun–Pluto, Chiron, Nodes, Lilith), house cusps (Placidus, Koch, Equal, Whole Sign, Regiomontanus), Ascendant/MC/Vertex/Part of Fortune, fixed stars, eclipse timing
- Reference: `auspicious/js/astro-engine.js` (working JS SWE WASM — all calculation logic)
- Reference: `report-engine/scripts/generate_chart_page.py` (working Python SWE)
- The Trust purchases the SE license ($600-750)

**2. ENP Axis Toggle**
- Full precessional math. Switch between NCP (daily/annual) and ENP (Great Year/Yuga) axes
- The engine already has both axes positioned (NCP at origin, ENP offset at `(0, 0, -0.376)`)
- The 4 perspectives are designed (Fixed, Generational, Precessional, Yuga) — webapp skyclock already implements them
- Reference: `skyclock/js/skyclock-engine.js` and `skyclock/js/main.js` (4-mode implementation)

**3. 3D Yuga Spiral**
- 2D spiral → 3D. 90° transition animation to Timeline Screw
- The Timeline Screw already exists in Godot (`scripts/timeline_strip.gd`)
- The yuga spiral exists in webapp (`skyclock` toggle-yuga)
- This is the transition between them in 3D

**4. Polished UI**
- Glassmorphism theme. Observatory-grade aesthetic.
- The existing HUD is functional but utilitarian
- Reference: webapp `skyclock/index.html` dark theme + `cosmic-report/index.html` gold/panel aesthetic

### What Already Works (dev doesn't need to build)
- 2D wheel rendering (`scripts/astro_wheel.gd`)
- Planet placement from ephemeris (`ephemeris/planet_placer.gd`)
- Time controls (`ephemeris/planet_time_controller.gd`)
- Timeline strip/screw (`scripts/timeline_strip.gd`)
- 3D history graph (`scripts/history/`)
- Astrocartography (`scripts/astrocartography_*.gd`)
- Eclipse mode (`scripts/eclipse_*.gd`)
- Cymatics 3D (`scripts/cymatics/`)
- Morph transition 2D↔3D (`scripts/morph_transition.gd`)
- Heaven plane (`scripts/heaven_plane.gd`)
- Constellation lines (`scripts/constellation_lines.gd`)
- Analemma (`scripts/analemma_renderer.gd`)
- Atmosphere/dome (`scripts/atmosphere_gradient.gd`)
- Starfield (texture generation, stars.json)
- Binary ephemeris (5 files, ~750MB, JPL DE440)
- 67+ Lore VCS revisions

### Scope & Timeline (revised)
- **MVP** (SWE GDExtension + ENP axis + UI polish): 4-6 weeks
- **Full** (3D Yuga spiral + chart editor + remaining P3/P4): 2-4 months additional
- **Budget**: $2K-8K for MVP. Trust funds SE license separately.

### Where to Find the Dev
- Godot Discord / Reddit r/godot (search for GDExtension C++ experience)
- Upwork / Fiverr (search "Godot GDExtension C++")
- Indie game dev forums
- Astrology software community (Skyscript, Astro.com forum)
- GitHub: contributors to Astrolog, OpenAstro, Swiss Ephemeris wrappers
- Nous Research Discord
- Chris Brennan's Astrology Podcast community (mentioned in partner editions)

### What Makes This Attractive to a Dev
- **Not greenfield** — 20+ working scripts, clear architecture, documented scene tree
- **Working reference implementations** — JS (auspicious) + Python (report engine) + webapp (skyclock 4-mode)
- **Complete design spec** — ARCHITECTURE.md, GLOSSARY.md, TIME-SCALE-REFERENCE.md, CODEX-TASK.md, multiple task specs
- **Binary ephemeris already generated** — 750MB of JPL DE440 data ready to use
- **The visual language is established** — gold/panel dark theme, element pastels, zodiac glyphs
- **Unique features no other software has** — yuga cycles, two-axis model, cymatics, generational timeline screw, eclipse paths on Gleason map
- **Creative freedom on 3D visualization** — the showpiece
- **Open-core model** — core engine open source, Pro features proprietary (dev gets portfolio credit)