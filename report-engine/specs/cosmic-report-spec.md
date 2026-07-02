# $19 Cosmic Report — Product Specification
## The Revenue Engine That Funds the Desktop Engine

**Date:** 2026-06-25
**Version:** 1.0
**Prepared by:** Saturn (SeaGoat Strategic Operations)

---

## What It Is

A one-time purchase PDF report generated from the user's birth chart. Delivered via email after payment. No subscription. No account required. No recurring costs.

**Price:** $19
**Target:** 5-80 sales/month in Year 1
**Revenue Goal:** $4,085 by December 2026

---

## What It Contains

| Section | Content | Status |
|---|---|---|
| **Chart Wheel** | Planet positions, house cusps, aspect lines | ✅ Built in Godot |
| **Planet Placements** | Each planet in sign and house, with short meaning | ⚠️ Needs writing |
| **Aspect List** | All major aspects with orbs | ✅ Built in Godot |
| **Your Saeculum** | What generation you were born into | ✅ Written (5 variants) |
| **Your Elemental Era** | What elemental age you were born in | ✅ Written |
| **Your Place on the Timeline** | Key historical conjunctions that shaped your generation | ✅ Written |
| **Current Sky** | Where the planets are today, relative to your birth chart | ✅ Built in Godot |

---

## What Needs to Be Built

### 1. Planet Placement Interpretations (120 entries)

10 planets × 12 signs. Each entry: 2-3 sentences. Tone: informative, not mystical.

| Planet | Signs | Example (Sun in Aries) |
|---|---|---|
| Sun | 12 | "You express yourself with directness and initiative. Your core identity is action-oriented — you lead, you begin, you ignite. The challenge is learning patience." |
| Moon | 12 | Emotional nature, instinctive responses |
| Mercury | 12 | Communication style, mental processing |
| Venus | 12 | Love style, values, aesthetics |
| Mars | 12 | Drive, anger, ambition |
| Jupiter | 12 | Expansion, luck, growth areas |
| Saturn | 12 | Discipline, challenges, life lessons |
| Uranus | 12 | Rebellion, innovation, where you break free |
| Neptune | 12 | Dreams, illusions, spiritual connection |
| Pluto | 12 | Transformation, power, deep healing |

**Total:** 120 entries × ~150 words = ~18,000 words. About 30 pages of content.

**Priority:** Start with Sun, Moon, Mercury, Venus, Mars (50 entries). Add outer planets later.

### 2. Aspect Interpretations (5 aspects × general meaning)

| Aspect | Orb | Meaning |
|---|---|---|
| Conjunction (0°) | 8° | Fusion, intensity, combined energy |
| Sextile (60°) | 6° | Opportunity, flow, natural talent |
| Square (90°) | 6° | Tension, challenge, growth through friction |
| Trine (120°) | 6° | Harmony, ease, natural gift |
| Opposition (180°) | 6° | Polarity, balance, relationship dynamic |

**Total:** 5 entries × ~100 words = ~500 words. Quick to write.

### 3. PDF Delivery Pipeline

```
User → Web App → Stripe Checkout ($19) → Success URL → Generate PDF → Email via MailerLite
```

| Component | What It Does | Effort |
|---|---|---|
| Stripe product | One-time $19 purchase. No subscription. | 1 hour |
| PDF generator | Takes birth data → renders chart wheel + text blocks → outputs PDF | 1-2 days |
| MailerLite automation | Captures email → sends free saeculum report → upsells $19 report → delivers PDF | 1 day |
| Web app CTAs | "Get your free preview report" + "Unlock the full Cosmic History Report" | 1 hour |

### 4. Free Saeculum Report (Already Written — Needs Deployment)

The content at `Company_OS/knowledge/free-saeculum-report-content.md` has 5 generation variants:

| Generation | Birth Years | SJ Conjunction | Archetype |
|---|---|---|---|
| Boomer | 1940-1961 | 1940 Taurus | Prophet |
| Gen X | 1962-1980 | 1961 Capricorn | Nomad |
| Millennial | 1981-1996 | 1981 Libra | Hero |
| Gen Z | 1997-2012 | 2000 Taurus | Artist |
| Gen Alpha | 2013-2025 | 2020 Aquarius | ? |

**Deployment:** MailerLite automation. Capture birth year → send correct variant. Simple.

---

## Revenue Projection

| Month | Free Reports | $19 Sales | Revenue | Cumulative |
|---|---|---|---|---|
| July | 50 | 5 | $95 | $95 |
| August | 100 | 10 | $190 | $285 |
| September | 200 | 20 | $380 | $665 |
| October | 400 | 40 | $760 | $1,425 |
| November | 600 | 60 | $1,140 | $2,565 |
| December | 800 | 80 | $1,520 | $4,085 |

**Conversion rate assumption:** 1% of free report recipients buy the $19 report. Conservative.

**Upside:** One podcast appearance → 50,000 visitors → 3% conversion to $19 report → $28,500 from one event.

---

## What the $19 Report Funds

| Item | Cost | Funded By |
|---|---|---|
| Swiss Ephemeris license | $600-750 | ~40 $19 sales |
| First contractor deposit | $3,000 | ~158 $19 sales |
| Year 1 operating budget | $1,200-2,400 | ~95 $19 sales |

**Total needed:** ~293 $19 sales to fund Year 1 completely. Target is 80/month by December.

---

## Immediate Action Items (Next 30 Days)

| # | Task | Owner | Est. Time |
|---|---|---|---|
| 1 | Deploy free saeculum report as MailerLite automation | Ian | 2 hours |
| 2 | Add "Get your free preview report" CTA to web app | Ian | 30 min |
| 3 | Add "Join early access for the desktop engine" CTA | Ian | 30 min |
| 4 | Create Stripe product for $19 cosmic report | Ian | 1 hour |
| 5 | Write Sun, Moon, Mercury, Venus, Mars interpretations (50 entries) | Ian | 4-6 hours |
| 6 | Write aspect interpretations (5 entries) | Ian | 1 hour |
| 7 | Build PDF delivery pipeline | Developer | 1-2 days |
| 8 | Connect MailerLite → Stripe → PDF delivery | Developer | 1 day |

**Total Ian time:** ~9-11 hours to get the funnel live with basic content.

---

## The Funnel

```
Web App (free)
    ↓
"Get your free SkyCLAWk preview report" CTA
    ↓
Enter birth year + email
    ↓
Free saeculum report delivered via MailerLite
    ↓
Email sequence (1 email per generation)
    ↓
"Unlock the full Cosmic History Report — $19"
    ↓
Stripe checkout → PDF generated → delivered via email
    ↓
"Want to see the engine that creates these reports?"
    ↓
Desktop engine waitlist → $79 Phase 1 launch
```

---

*Prepared by Saturn | SeaGoat Strategic Operations*
*© 2026 Zodi-Yuga Holdings*


---

## Pipeline Implementation Notes

The current report-engine pipeline (`report-engine/scripts/generate_full_report.py`) generates the full 19–20 page PDF independently of the Godot runtime. It is also mirrored in `Master Godot SkyCLAWk/scripts/generate_full_report.py` so both the web pipeline and the desktop/engine pipeline stay synchronized.

### Report Structure (v40+)

| Physical Page | Content |
|---------------|---------|
| 1 | Cover |
| 2 | Natal chart wheel with constellation overlay (`heaven_constellations.svg`) |
| 3 | Cosmic Snapshot card (Big 3, generation, era, key aspects) |
| 4+ | Narrative Sections 1–11 |
| Last 2–4 pages | Technical appendix: Houses, Planet Placements, Aspects, Sources |

### Footer Convention

The first narrative page is stamped **pg 3**. Snapshot and cover pages have no page numbers.

### Narrative Macro System

Reports are built from a shared archetype macro plus a sign-specific snippet:

| Archetype | Macro | Snippet |
|-----------|-------|---------|
| Hero / Millennial | `prose_millennial_macro.md` | `prose_millennial_{sign}.md` |
| Nomad / Gen X | `prose_nomad_macro_template.md` | `prose_nomad_{sign}_snippet.md` |
| Prophet / Boomer | `prose_prophet_macro_template.md` | `prose_prophet_{sign}_snippet.md` |
| Artist / Silent | `prose_artist_macro_template.md` | `prose_artist_{sign}_snippet.md` |
| Prophet GenAlpha | `prose_prophet_genalpha_macro_template.md` | `prose_prophet_genalpha_{sign}_snippet.md` |

The snippet must define `[CORE_SYNTHESIS]`, `[EXECUTIVE_SUMMARY_PERSONAL]`, `[EPOCHAL_WHAT_THIS_MEANS]`, `[NATAL_SIGNATURE]`, `[LIFETIME_PATTERN]`, and `[FINAL_ORIENTATION]`. The macro inserts `[CORE_SYNTHESIS]` directly under `1. Your Cosmic Weather` / `1. Su Clima Cósmico`.

### Language Support

- `--lang en` (default): English narrative, English appendix.
- `--lang es`: Spanish narrative, Spanish appendix (`Casa`, `Elemento`, `Cualidad`, translated aspect names and meanings).

Both use the same generator; the `houses_html` block and table labels switch per language. The `ES` dictionary is kept English-only to avoid cross-language leakage.

### Timezone Support

Valid `--tz` values: `EST`, `EDT`, `CST`, `CDT`, `MST`, `MDT`, `PST`, `PDT`, `HST`, `AKST`, `COT`, `IST`, `GMT`, `UTC`.

### Asset Requirements

- `report-engine/scripts/constellation_paths.svg` — used for chart overlay.
- `report-engine/assets/heaven_constellations.svg` — constellation artwork source.
- `report-engine/templates/planet-sign-interpretations.json` — planet-in-sign interpretation texts.

### Verified Test Cases

| Name | Birth Data | Lang | Output |
|------|------------|------|--------|
| Cheryl K Beggs | 1982-05-02 02:16 EDT, NAS Jacksonville, FL (30.22, -81.68) | en/es | v40+ |
| Astrid Restrepo | 1969-08-21 13:30 COT, Yopal, Casanare, Colombia (5.34, -72.40) | en/es | v7+ |
| Steve Malecki | 1961-04-13 09:12 CDT, Chicago, IL (41.88, -87.63) | en | current |
| Julian Beggs | 2008-03-04 22:54 EST, Watertown, NY (43.97, -75.91) | en | current |
| Conor McGregor | 1988-07-14 01:30 IST, Dublin, Ireland (53.35, -6.26) | en | current |

### Known Limitations

- Spanish reports are ~1 page longer than English due to expanded translations.
- Planet placement interpretations in Spanish are currently suppressed; a Spanish interpretation JSON is needed to restore them.
- Payment gating (`zodiyuga.com/cosmic-report`) and live API deployment are tracked separately.

