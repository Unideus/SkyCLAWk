# Planting Cycle Mode — Developer Docs

> Prototype idea stage. Future expansion of the Planting page (`/planting/`).
> Demand-driven: not on any current sprint. This document is the design reference
> for when the feature is picked up.

## Summary

The Permaculture Plan Generator produces a site-tailored planting plan (plant
list, polyculture associations, succession schedule). **Planting Cycle Mode**
takes that plan — or a single manually-entered plant — and generates the
**complete life cycle** for each plant, then plots every phase of every plant
onto the planting timeline (the screw).

The engine pulls the data needed to plot the entire cycle: germination,
transplant, vegetative growth, flowering, fruiting, seed save, propagation,
harvest windows, and die-back/dormancy. Each phase becomes a labeled segment on
the timeline, color-coded per plant, stacked across the screw so the whole plan
reads as one integrated picture.

## Scope

### In scope (MVP)

1. **Full-plan cycle generation** — feed the Permaculture Plan Generator output
   into the engine; engine emits a cycle timeline for every plant in the plan,
   synchronized to the same date axis.
2. **Single-plant cycle generation** — any plant can be entered individually
   (by name or from the plant database) and its cycle generated and dropped into
   the active timeline alongside the rest.
3. **Phase plotting** — each phase rendered as a segment on the screw with:
   - phase label (germination, vegetative, flowering, fruiting, etc.)
   - plant color / row
   - start → end dates computed from plant data + sowing date + location/climate
4. **Integration** — single-plant cycles merge into the full-plan view; the
   combined scheme stays organized (no overlap collisions, plants grouped by
   bed / guild / zone where the plan provides it).
5. **Astro overlay sync** — existing moon-phase / planting-band overlays on the
   screw now read against real crop windows instead of generic seasonal bands.

### Out of scope (MVP)

- Auto-irrigation or hardware control.
- Yield prediction / economic modeling.
- Soil-sensor live data feeds.
- Mobile-native app (web only, same as the rest of SkyCLAWk).

## How it fits into the planting page

The Planting page already has:
- a screw renderer (`planting/js/screw-renderer.js`)
- a UI controller (`planting/js/ui-controller.js`)
- a planting guidance modal with an "Affected plants" panel that currently says
  *"Connect a Permaculture plan for crop-specific guidance."*
- a conjunction-cycle selector modal

Planting Cycle Mode adds a new engine module (`planting/js/cycle-engine.js` in
the prototype) that:
1. Accepts a plan object (JSON from the Permaculture Plan Generator) OR a
   single-plant entry.
2. Resolves each plant's phase durations against the plant database + climate
   zone + user's first/last frost dates.
3. Emits a cycle-event list: `[{ plant, phase, startDate, endDate, color, meta }]`.
4. Hands that list to the existing screw renderer as a new track layer.

No rewrite of the screw renderer is anticipated — cycle segments are just
another banded dataset rendered above/within the existing screw.

## Data the engine needs per plant

| Field | Source | Example |
|---|---|---|
| Plant name | Plan or user entry | `Tomato — San Marzano` |
| Days to maturity | Plant DB | 75 |
| Germination days | Plant DB | 6–14 |
| Transplant vs direct | Plant DB | transplant |
| Frost tolerance | Plant DB | none (tender) |
| Flowering trigger | Plant DB | day-length + heat |
| Fruit window | Plant DB | 30 days |
| Seed-save window | Plant DB | 30 days post-fruit |
| Propagation method | Plant DB | cutting / seed / division / layering |
| Sow/plant date | Plan or user | computed from frost dates + moon phase |
| Climate zone | User location | from existing location field |
| Bed / guild / zone | Plan (optional) | `Bed 3 — tomato guild` |

## Cycle phases plotted

For each plant the engine generates these segments in order:

1. **Pre-germination / stratification** — if required (cold strat, soak, scarify).
2. **Germination** — from sow date, duration from DB.
3. **Seedling / nursery** — indoor or nursery tray, ends at transplant date.
4. **Transplant / direct-sow** — single-point event on the timeline.
5. **Vegetative growth** — transplant → first flower.
6. **Flowering** — first flower → fruit set.
7. **Fruiting / harvest window** — first ripe → last harvest.
8. **Seed save** — overlaps end of harvest for open-pollinated types.
9. **Propagation** — cuttings/division/layering window (plant-dependent).
10. **Die-back / dormancy / overwinter** — for perennials and biennials.

Not every plant hits every phase. The engine skips phases the plant DB marks
N/A for that species/cultivar.

## Peripheral features a gardener/permaculturist would expect

These are the obvious adjacents — things a permaculturist would ask for the
moment the cycle view exists. Captured here so the prototype can anticipate
them rather than retrofit.

### High-value, low-cost to prototype

- **Succession scheduling** — when one crop finishes, the next crop for that
  bed auto-fills the freed window (e.g. garlic → beans → late lettuce). The
  cycle engine should flag empty windows in the plan and suggest a fill from
  the plant DB.
- **Companion / guild overlay** — plants in the same guild are visually grouped
  on the screw and their beneficial/predatory relationships listed in the
  guidance modal. The plan already has guild data; this just surfaces it.
- **Frost-date anchoring** — every phase date is back-calculated from the
  user's last-spring-frost and first-fall-frost dates (already a planting-page
  input). This is the single most important real-world anchor for the whole
  cycle.
- **Moon-phase / astro alignment** — the planting page already has lunar bands.
  Cycle mode should let the user snap sow/transplant dates to a favorable moon
  window and show the delta if they don't.
- **Climate-zone correction** — days-to-maturity in seed catalogs assume ideal
  conditions; the engine should apply a zone-based modifier (cool zones =
  longer, hot zones = shorter for cool-season crops) so the plotted cycle
  matches reality.
- **Perennial / tree timeline** — perennials and tree crops don't have a single
  annual cycle; they have year-on-year bud-break, fruiting, and dormancy. The
  engine should handle multi-year cycles, not force everything into one season.
- **Cover crops / green manure** — a cycle type that's not harvest-oriented
  (e.g. winter rye, clover) but still occupies a bed window and needs to plot.

### Medium-value, planning-stage relevant

- **N-fixing / nutrient-accumulator flag** — perennials and cover crops that
  build soil should be tagged so the succession engine can place them
  intelligently after heavy feeders.
- **Pollinator bloom calendar** — overlay showing when flowering crops and
  insectary plants bloom, so the gardener can see pollinator forage coverage
  across the season. A permaculture staple.
- **Water need band** — each plant phase has a relative water demand; the screw
  can show a drought-stress band so the gardener sees when demand peaks across
  the whole plan simultaneously.
- **Harvest density** — show weeks where harvest volume is concentrated so the
  gardener can see glut windows and plan preservation / storage.
- **Indoor-start vs direct-sow separation** — visually distinguish nursery
  phase (indoor) from in-ground phases on the screw. Matters a lot in practice.

### Nice-to-have / future

- **Pest/disease window tags** — e.g. squash-vine-borer window, tomato-blight
  window — plotted as risk bands the cycle passes through.
- **Seed-saving isolation distances** — flag when two cross-pollinating
  varieties of the same species flower simultaneously within isolation range.
- **Grafting windows** — for grafted trees/tomatoes, the grafting-compatible
  phase window on both rootstock and scion.
- **Chicken/animal integration** — when to run poultry through a bed post-
  harvest (pest cleanup, manuring). Permaculture-specific.
- **Chop-and-drop / mulch cycles** — for dynamic accumulators and support
  species, the cut-and-mulch schedule is as important as the harvest schedule.

## Open questions (prototype stage)

- Plant database: build a minimal SkyCLAWk-local JSON, or pull from an existing
  open dataset (e.g. OpenFarm)? Decision affects time-to-prototype heavily.
- Does the Permaculture Plan Generator output a schema we can consume directly,
  or do we need a converter layer?
- Should cycle segments be interactive (click a phase → guidance modal with
  plant-specific advice for that phase) or static display only for MVP?
- Multi-year view: does the screw need a year-toggle, or do perennials just
  wrap/repeat on the existing axis?

## Status

Idea stage. No code yet. This document is the reference for when the feature is
picked up — demand-driven, not scheduled.