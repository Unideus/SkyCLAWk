# Discounted Permaculture Plan Add-On — Product Analysis

**Date:** 2026-07-02
**Prepared for:** Ian Beggs, SkyCLAWk lead
**Status:** Investigation / decision document

---

## Executive Summary

The $19 Cosmic History Report has a proven pipeline and a growing test-customer base. A permaculture plan add-on leverages existing infrastructure (the Astrology_Permaculture app, its plant registry, guild generator, and PDF renderer) to create a second revenue stream that is **high-margin, low incremental cost, and uniquely differentiated** — no competitor connects birth-chart cell-salt analysis to permaculture guild design.

This document analyzes the product, pricing, technical integration, and go-to-market path.

---

## What Already Exists

### Cosmic History Report (SkyCLAWk report-engine/)
- Full PDF pipeline: `generate_full_report.py` → 19–20 page report
- Birth data → Swiss Ephemeris → chart wheel + narrative + appendix
- 5 archetypes × 12 signs = 60 snippet templates
- English + Spanish
- Verified test cases: Cheryl, Astrid, Steve, Julian, Conor

### Permaculture Design Generator (Astrology_Permaculture/)
- Full Node.js web app with server (`server.js`, 97KB)
- Rule-based plan generator (no AI required)
- **Inputs:** address → geocoded, USDA hardiness zone, Köppen climate, frost dates, growing season, sun sign, family member signs, user-selected canopy plants
- **Outputs:** site info, climate snapshot, cell-salt deficiency analysis (from sun sign), 7-layer food forest guilds (3 guilds per plan), 14+ recommended plants with mineral mapping, 3-year implementation plan with tasks/timing/plant lists, moon planting calendar, soil recommendations
- **Existing PDF renderer:** `src/pdf/renderPlanPdfHtml.js` (43KB) — already produces plan PDFs
- **Plant database:** `master_registry.json` (138KB) + `src/data/plants_master.json` (5.5KB)
- **Saved site data:** JSON files in `sites/` — full plan schema is structured and machine-readable

### SkyCLAWk Planting Page (SkyCLAWk/planting/)
- Screw renderer with moon-phase bands
- Planting guidance modal
- Conjunction-cycle selector
- `docs/planting-cycle-mode.md` — cycle engine design doc (prototype stage, no code yet)

---

## The Product: Astro-Permaculture Plan

### What the customer gets

A **site-tailored permaculture design plan PDF** that uses the customer's natal sun sign (and optionally family members' signs) to determine cell-salt deficiencies, then recommends plants, guilds, and a 3-year implementation sequence that addresses those mineral gaps — all calibrated to their climate zone, frost dates, and property scale.

### What makes it different

| Competitor | What they do | What they don't do |
|---|---|---|
| Permaculture design consultants ($500–2000) | Site visit, custom design | No astrological/mineral layer; expensive; slow |
| Generic online plan tools | Plant lists by zone | No cell-salt matching; no guild logic; no moon calendar |
| SkyCLAWk (proposed) | Full guild design + cell-salt layer + moon calendar + 3-year plan | $29 add-on, delivered in minutes |

The **unique hook**: "Your birth chart reveals mineral deficiencies. Your permaculture plan heals them through food."

---

## Pricing Strategy

| Option | Price | Positioning |
|---|---|---|
| Cosmic History Report only | $19 | Existing product |
| Permaculture Plan only | $29 | Standalone purchase |
| **Bundle (either direction)** | **$38.50** | **$9.50 off vs. buying separately ($48)** |

### Two entry points, same bundle price, same $9.50 discount

**Coming from the report ($19 entry):**
"Add a permaculture plan for $19.50 (save $9.50)" → $38.50 total

**Coming from the plan ($29 entry):**
"Add the full Cosmic History Report for $9.50 (50% off)" → $38.50 total

### Rationale

- Fixed bundle price of $38.50 regardless of entry point — simple, fair, no confusion.
- The discount is always $9.50 off the companion product. From the plan side that's a clean 50% off the $19 report. From the report side it's 32.8% off the $29 plan.
- $38.50 is still impulse territory for a two-PDF personalized bundle, and $9.50 under the $48 separate-purchase cost.
- Both standalone price floors ($19 report, $29 plan) are protected — the bundle only exists as an add-on to one or the other.

### Revenue projection

| Scenario | Monthly volume | Avg revenue/sale | Monthly revenue |
|---|---|---|---|
| Report only (current target) | 80 | $19 | $1,520 |
| 20% report-side attach at $19.50 | 80 reports + 16 bundles | $19 + $19.50×0.2 | $1,832 |
| 40% report-side attach at $19.50 | 80 reports + 32 bundles | $19 + $19.50×0.4 | $2,144 |
| 10 plan-led bundles at $38.50 | 10 bundles | $38.50 | $385 |
| Combined (40% report-attach + 10 plan-led) | 80 reports + 32 + 10 | blended | $2,529 |

Even modest attach rates from both directions add ~66% to monthly revenue at no additional customer acquisition cost.

---

## Technical Integration

### Architecture: two pipelines, one checkout

```
User enters birth data → $19 Report (SkyCLAWk report-engine)
                    ↓
    "Add a permaculture plan for $20?"
                    ↓
User enters site address + property scale → Permaculture Plan (Astlogy_Permaculture app)
                    ↓
    Two PDFs delivered via email (or merged)
```

### What needs to be built

| Component | Effort | Status |
|---|---|---|
| **Checkout upsell UI** | 2–3 hrs | New — Stripe checkout with add-on toggle |
| **Permaculture plan API endpoint** | 3–4 hrs | Wrap existing `server.js` plan generation into a headless API call |
| **Plan PDF generation** | Already built | `renderPlanPdfHtml.js` exists and works |
| **Birth-chart → cell-salt bridge** | 1–2 hrs | Extract sun sign from report pipeline, pass to permaculture app's cell-salt module |
| **Email delivery for plan PDF** | 1 hr | Reuse MailerLite/SMTP path from report pipeline |
| **Merged PDF option** | 1 hr | PyMuPDF merge: report.pdf + plan.pdf → bundle.pdf |

**Total effort: ~8–11 hours** (similar to the original report pipeline build).

### Data flow

```
Birth data (name, date, time, lat, lon)
    ↓
report-engine → sun sign → cell-salt deficiencies
    ↓
permaculture app ← address → geocode → climate zone
    ↓
plan generator: cell salts + climate + scale → guilds + plants + 3yr plan + moon calendar
    ↓
renderPlanPdfHtml → plan PDF
    ↓
PyMuPDF merge (optional) → deliver
```

### Key technical note

The permaculture app already uses the sun sign as a primary input for cell-salt analysis. The integration is **not** a new feature — it's connecting two existing pipelines through a shared data point (sun sign). The cell-salt mapping is already in `biodynamic_map.json` (15KB) and `tissue_salt_plant_relationships.json` (52KB).

---

## Plan PDF Content (existing → what the customer sees)

Based on the actual `renderPlanPdfHtml.js` output and saved site schema:

1. **Site Information** — address, scale, USDA zone, Köppen climate
2. **Climate & Frost Snapshot** — hardiness zone, avg min temp, growing season days, frost dates
3. **Cell-Salt Analysis** — deficient salts derived from sun sign, with function descriptions
4. **7-Layer Food Forest Guilds** — 3 guilds, each with:
   - Canopy tree (tier A/anchor)
   - Low tree / sub-canopy
   - Shrub layer
   - Herbaceous / forb layer
   - Ground cover
   - Vine / climber layer
   - Root / rhizome layer
   - Each plant tagged with selection reason (cell-salt match, zone/climate fit, user choice)
5. **Recommended Plants** — 14+ plants with mineral mappings
6. **3-Year Implementation Plan**
   - Year 0: Canopy & infrastructure (soil testing, tree planting, water, cover crops)
   - Year 1: Sub-canopy, herbaceous & vines (salt-linked support plants, mineral cyclers)
   - Year 2: Ground cover, roots & first harvests
7. **Moon Planting Calendar** — waxing/waning/new/full moon guidance
8. **Optional: natal chart overlay** — connect planting timing to personal astrological timing

---

## Go-to-Market Path

### Phase 1: Bundle at checkout (2 weeks)

1. Add "Add permaculture plan (+$20)" toggle to the existing Stripe checkout
2. If selected, show address + property scale input after payment
3. Run permaculture plan generator server-side
4. Deliver both PDFs via email

**Funnel update:**
```
Web App (free)
    ↓
Free saeculum report
    ↓
$19 Cosmic History Report
    ↓  ← "Add a permaculture plan for $19.50 (save $9.50)"
$38.50 Bundle (report + plan)

   OR

$29 Permaculture Plan
    ↓  ← "Add the Cosmic History Report for $9.50 (50% off)"
$38.50 Bundle (plan + report)
    ↓
Email: both PDFs
    ↓
"Your plan is calibrated to your chart's cell-salt profile"
```

### Phase 2: Standalone permaculture plan (4 weeks)

- Sell the permaculture plan as a $29 standalone product
- Landing page: "Enter your birth chart + site address → get a food forest plan designed for your mineral profile"
- Cross-sell back to the report ("Add the full cosmic history report for $15")

### Phase 3: Planting Cycle Mode integration (future)

- When `planting-cycle-mode.md` is implemented, the plan PDF can include a visual cycle timeline
- The screw renderer on the planting page becomes a live companion to the static PDF
- Plus subscribers get interactive plan editing; one-time buyers get the PDF snapshot

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cell-salt → plant mapping is pseudo-scientific | Frame as "traditional/mineral-based" not "medical." Plants genuinely contain minerals; the mapping is a selection heuristic, not a diagnosis. The permaculture app already handles this framing. |
| Permaculture app is a separate Node.js server | Run it as a headless API behind the same Cloudflare worker or as a VPS-side process. The app already supports VPS deployment. |
| Customer enters bad address → geocode fails | Open-Meteo + Nominatim geocoding is already in the app. Add validation and a manual zone-entry fallback. |
| Plan PDF quality is lower than report PDF | The permaculture app already has a 43KB PDF renderer. Audit it for visual consistency with the report-engine PDFs (fonts, colors, page structure). |
| Bundle cannibalizes standalone report sales | Unlikely — the report is the discovery product. The plan is the depth product. They serve different intents. |

---

## Competitive Position

No product in the market connects astrology (natal chart → cell-salt deficiency) to permaculture (food forest plan → mineral remediation). This is **SkyCLAWk's defensible niche**:

- Astrology apps don't do permaculture
- Permaculture tools don't do astrology
- The cell-salt bridge is the moat

The planting page on SkyCLAWk already has moon-phase bands and astro overlays. The permaculture app already has the guild generator. The only missing link is the checkout upsell and the email delivery pipeline.

---

## Recommendation

**Build it.** The technical lift is ~8–11 hours. The infrastructure already exists. The differentiation is real. The pricing is right. Start with the checkout bundle ($39), then spin out the standalone plan product once the funnel is proven.

### Immediate next steps

1. Audit `renderPlanPdfHtml.js` output quality against the report-engine PDF standard
2. Add headless API endpoint to permaculture app (`POST /api/generate-plan` → returns plan JSON + triggers PDF)
3. Add Stripe line-item for the add-on
4. Add address/scale input form to the post-checkout success page
5. Test end-to-end with Ian's own chart + site data (already in `sites/ian-1-1777740011988.json`)
6. Ship