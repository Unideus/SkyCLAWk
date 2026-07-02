# $19 Cosmic Report — Option B Outline (Full Guide)

## Document Spec
- Target length: 20–30 pages
- Format: Print-ready PDF, clean white background, readable body text
- Tone: Observatory instrument. Grounded, informative, not mystical.
- Visuals: Chart wheel, timeline screw, element-era badge, saeculum strip

---

## Page-by-Page Structure

### 1. Cover
- Recipient name
- Birth date, time, location
- Generation + elemental era badges
- Chart wheel image (Godot render or 2D SVG)
- "SkyCLAWk Cosmic History Report"
- zodiyuga.com branding

### 2. The Big Picture: Where You Are on the Timeline
- One-paragraph executive summary of the reader's saeculum position
- Element shift context (Earth → Air, 2020)
- Their generation's archetype and birth turning
- Pluto cycle note if relevant

### 3. Your Saeculum: The Conjunction That Made Your Generation
- Full generation-specific content from `free-saeculum-report-content.md`
- Birth-year conjunction date, sign, element
- Archetype and turning
- Childhood → Coming of Age → Midlife → Elder trajectory
- Reference to the Timeline Screw

### 4. Elemental Era: The 180-Year Weather You Were Born Into
- Which elemental era the reader was born in (Fire, Earth, Air, Water)
- Historical parallel era
- What that element emphasizes (e.g., Earth = material, infrastructure; Air = information, networks)
- How it contrasts with the current Air era shift

### 5. The Four Turnings in Your Lifetime
- Small diagram or table
- Crisis → High → Awakening → Unraveling
- Which turnings the reader has already lived through and which are ahead
- Their active agency window (usually 2–3 turnings)

### 6. Your Chart Wheel
- Large chart wheel image
- Planet glyph positions
- House cusps (when available)
- Aspect lines
- Optional: QR code linking to web app

### 7–11. Your Planets in Signs (one page per planet, inner five)
- Sun in [Sign]
- Moon in [Sign]
- Mercury in [Sign]
- Venus in [Sign]
- Mars in [Sign]
- Each page: glyph, sign name, interpretation paragraph, pressure point

### 12–16. Outer Planets in Signs (one page per planet)
- Jupiter in [Sign] — expansion, opportunity, growth
- Saturn in [Sign] — discipline, challenge, structure
- Uranus in [Sign] — rebellion, innovation, disruption
- Neptune in [Sign] — dreams, illusions, spiritual connection
- Pluto in [Sign] — transformation, power, deep healing
- Note: outer planets stay in signs for years; these interpret the generational layer

### 17. Your Major Aspects
- Conjunction, Sextile, Square, Trine, Opposition
- List of actual aspects in the reader's chart
- 1–2 sentence meaning per aspect pair
- Orb notation

### 18. House Overview (if available)
- Brief intro to the 12 houses
- Which house each inner planet occupies
- 1 sentence per placement
- If houses not available: placeholder note about desktop engine full chart

### 19. Current Sky: Now vs. Your Birth Chart
- Positions of planets today
- Which planets are retrograde
- Key transits affecting the reader's chart
- Highlight any conjunctions, squares, or oppositions to birth planets

### 20. Next 12 Months: Watch Points
- Upcoming conjunctions, retrogrades, eclipses
- Which areas of life are activated
- Practical framing (not predictions — "watch this pressure point")

### 21. Your Place on the Timeline Screw
- Small graphic or text diagram
- Personal saeculum position mapped onto the 7-layer screw concept
- One paragraph connecting micro (birth chart) to macro (turnings)

### 22. Closing + CTA
- Recap of the report's purpose
- CTA: "See the engine that builds these reports"
- Desktop engine waitlist link ($79 Phase 1)
- Optional: share with someone born in a different generation

---

## Appendices (optional, future)

### Appendix A: Glossary
- Saeculum, turning, conjunction, element shift, archetype

### Appendix B: Methodology Note
- Data sources (Swiss Ephemeris / JPL DE440)
- Projection used (Gleason AE)
- House system note

### Appendix C: Full Aspect Grid
- Table of all planets and their aspect relationships

---

## Content Status

| Section | Status | Source File |
|---|---|---|
| Cover | Needs template | `scripts/generate_full_report.py` |
| Big Picture | Needs writing | This doc |
| Saeculum | ✅ Written | `free-saeculum-report-content.md` |
| Elemental Era | ✅ Written | `free-saeculum-report-content.md` intro |
| Four Turnings | ✅ Written | `free-saeculum-report-content.md` |
| Chart Wheel | ✅ Built in Godot | `generate_full_report.py` |
| Inner Planets | ✅ Written | `knowledge/planet-sign-interpretations.md` (60 entries) |
| Outer Planets | ✅ Written | `knowledge/planet-sign-interpretations.md` (120 entries total) |
| Aspects | ❌ Partial | 5 generic meanings written; need per-pair logic |
| Houses | ⚠️ Pending data | Need house calculation in Godot or web app |
| Current Sky | ✅ Built in Godot | `generate_full_report.py` |
| Next 12 Months | ⚠️ Needs logic | Transit calculation |
| Timeline Screw | ✅ Conceptual | `TIME-SCALE-REFERENCE.md` |
| Closing CTA | ✅ Written | `cosmic-report-spec.md` |

---

## Next Decisions Needed

1. **House system** — Do we include house placements now, or mark them as "available in desktop engine"?
2. **Outer planet interpretations** — Write 60 entries (5 outer planets × 12 signs)? Or use shorter generational blurbs?
3. **Aspect logic** — Generate actual aspect list from chart data, or use a fixed set of "major life themes"?
4. **Length target** — Hard cap at 30 pages, or let it breathe?
5. **Chart wheel source** — Use the existing Godot render, or build a cleaner SVG wheel for the PDF?

Once these are answered, the PDF generator can be updated to assemble the full report.
