# Codex Prompt: Astro Wheel for Auspicious App

## Goal

Replace the current mini-chart table in `auspicious/index.html` with a full natal chart wheel rendered as inline SVG — modeled after the report engine's chart in `report-engine/scripts/generate_chart_page.py`. The wheel should render live from the chart data already returned by `auspicious/js/astro-engine.js`.

## Context

The auspicious app (`auspicious/`) is an electional astrology calculator. It currently displays chart data as a mini HTML table (`mini-chart-table`). The report engine (`report-engine/scripts/generate_chart_page.py`) generates a print-quality natal wheel as SVG → PDF. We want the same wheel design, adapted for screen (dark theme, responsive, interactive tooltips on hover).

## Chart Data Available

The `astro-engine.js` `calculateChart()` function returns a `ch` object with:
- `ch.planets` — `{ Sun: {sign, degree, house, longitude, retrograde}, Moon: {...}, ... }`
- `ch.ascendant` — `{ sign, longitude, house: 1 }`
- `ch.midheaven` — `{ sign, longitude, house: 10 }`
- `ch.ascendant_longitude` — ecliptic longitude of the ASC in degrees
- `ch.sect` — "Day" or "Night"
- `ch.is_day_chart` — boolean
- `ch.moon` — `{ phase, void_of_course, ... }`
- Planet longitudes are 0–360° tropical zodiac (0° = Aries equinox point)

Sign glyphs and planet glyphs are already defined:
```js
const GLYPHS = {
  Sun:'☉', Moon:'☽', Mercury:'☿', Venus:'♀', Mars:'♂', Jupiter:'♃', Saturn:'♄',
  Aries:'♈', Taurus:'♉', Gemini:'♊', Cancer:'♋', Leo:'♌', Virgo:'♍',
  Libra:'♎', Scorpio:'♏', Sagittarius:'♐', Capricorn:'♑', Aquarius:'♒', Pisces:'♓'
};
```

## Wheel Design (match the report engine exactly)

### Concentric Ring Structure (outside → inside)

| Ring | Radius (px, for 400px wheel) | Contents |
|------|----------------------------|----------|
| Degree ticks | r=200–210 | 360 ticks, 10°/5°/1° lengths |
| **Sign ring** | r=158–200 | 12 wedges, pastel element fills |
| **Ecliptic boundary** | r=158 | Circle, thin grey stroke |
| **House ring** | r=108–158 | 12 wedges, emanation gradient, no base fill |
| **House inner boundary** | r=108 | Circle, thin grey stroke |
| **Aspect core** | r=104 | Aspect lines between planets |
| Planet dots + glyphs | r=100–130 | Black dots at true longitude, glyphs auto-separated |

For a responsive wheel, use a `viewBox="0 0 400 400"` and scale with CSS. Center at `(200, 200)`.

### Sign Ring (outer ring)

- 12 wedges, each 30°, starting from Aries at left (9 o'clock position, 180° in SVG coords)
- **Angle convention**: SVG angle = `rad(longitude + 180)` — the Ascendant (whatever sign it is) points left. The wheel rotates so the ASC is always at the 9 o'clock position.
- **Pastel fills by element**:
  - Fire (`#d32f2f`): `#f5d0d0`
  - Earth (`#2e7d32`): `#d0e8d0`
  - Air (`#fbc02d`): `#f5ecd0`
  - Water (`#1976d2`): `#d0dcef`
- **Sign glyphs**: 16px, black `#000`, centered in each wedge at `r = (200 + 158) / 2`

### House Ring (inner ring — the fractal of the sign ring)

- 12 wedges, each 30°, same angle convention as sign ring
- **Aries is always House 1 at the Ascendant** — natural zodiac fixed to anatomy (imago dei). The wedge positions rotate with the actual ascendant, but the sign assignment is always natural zodiac: H1=Aries, H2=Taurus, H3=Gemini, etc.
- **No base fill** (`fill="none"`) — the emanation gradient is the only visual
- **Emanation**: radial gradient per house, focal point at the 15th degree of the wedge at `r = 108 + 9 = 117`. Gradient: 50%-lighter element color at 0.45 opacity → fading to transparent at edges.
  - 50%-lighter colors: Fire `#e99797`, Earth `#97b697`, Air `#fddc96`, Water `#9ba5e6`
- **House sign glyphs**: gold `#b08d5a`, 12px (14px for Cancer, Leo, Capricorn, Aquarius), at the 20th degree of each wedge, at `r = 117`
- **House numbers**: `#333`, 9px bold, at the 10th degree, at `r = 117`
- **Feather edges**: clipped to house ring only (no bleed into sign ring). Double-stroke: 8px wide at 35% opacity + 3px narrow at 60% opacity, white, `stroke-linecap="round"`. Applied to all 4 edges of each wedge (two cusp lines + inner arc + outer arc).
- **Cusp lines**: `#888`, 0.8px, full opacity, extending from sign ring through house ring

### Planet Rendering

- **Planet dots**: small black circles (`r=2`) at true ecliptic longitude, placed at `r = 100` (inner aspect ring)
- **Planet glyphs**: SVG path-based glyphs (use Unicode as fallback), placed at `r ≈ 130` with auto-separation to prevent overlap. Galvanic/print-friendly colors per planet.
- **Leader lines**: thin grey `#444`, 1.2px, from dot to glyph
- **No white halo** behind planet glyphs (the house ring center is clear since glyphs are at the inner edge)

### Aspect Lines

- Draw lines between planets that form major aspects:
  - Conjunction (0°), Opposition (180°), Square (90°), Trine (120°), Sextile (60°)
- Aspect lines drawn inside `r = 104` (aspect core)
- Line color: subtle grey or blue, thin (0.5px), low opacity

### Degree Ticks

- 360 ticks around the outside of the sign ring
- Every 10°: 5px long, 0.8px wide, `#555`
- Every 5°: 3px long, 0.5px wide, `#777`
- Every 1°: 1.5px long, 0.3px wide, `#999`

### Top-right Note

In the top-right corner of the wheel container (not inside the SVG), add:
```
The Cosmic Blueprint
The houses are the cosmic pattern
manifest in the body — Aries at the
head, Pisces at the feet.
```
- Title: 10px bold, `#1a3a5c` (or gold `#b08d5a` for dark theme)
- Body: 8px, `#666` (or `rgba(164,173,190,0.7)` for dark theme)
- Right-aligned

## Dark Theme Adaptation

The report engine uses a white background (print). The auspicious app uses `--bg: #0f0f1a`. Adapt:
- Sign ring pastel fills stay the same (they're light enough to read on dark)
- House ring emanation: same gradients, may need slightly higher opacity to read on dark
- Sign glyphs: change from `#000` to `#e0e0e0` or `#edf1fb`
- House sign glyphs: stay gold `#b08d5a`
- House numbers: change from `#333` to `#888` or `#aaa`
- Cusp lines: change from `#888` to `#555` or `#666`
- Planet dots: change from black to white `#fff`
- Degree ticks: lighten slightly
- Background circle: `#0f0f1a` or transparent

## Interaction

- **Hover on planet glyph**: show tooltip with planet name, sign, degree, house, dignity score (reuse existing tooltip system in the app)
- **Hover on house wedge**: show tooltip with house number, sign, and body correspondence (Aries=Head, Taurus=Neck, etc.)
- **Hover on sign wedge**: show tooltip with sign name and element
- **Click planet glyph**: open existing planet modal (`openPlanetModal()`)

## Technical Requirements

1. **Single function**: `renderAstroWheel(ch, data)` that returns an SVG string
2. **Insert into DOM**: Replace the `miniChart` div with a `<div class="astro-wheel">` containing the SVG
3. **Responsive**: Use `viewBox` + `width: 100%` + `max-width: 400px` — scales on mobile
4. **No external dependencies**: Pure SVG generation in JS, no D3 or charting library
5. **Clip path for house ring feather**: Use `<clipPath>` to prevent feather bleed into sign ring
6. **Radial gradients**: Define per-house `<radialGradient>` in `<defs>` with `gradientUnits="userSpaceOnUse"` for precise focal point control

## Files to Modify

- `auspicious/index.html` — Add `renderAstroWheel()` function, replace mini-chart with wheel, add CSS for `.astro-wheel`
- Do NOT modify `auspicious/js/astro-engine.js` or `auspicious/js/main.js` — the data is already there

## Reference

The exact Python implementation to port is in:
`report-engine/scripts/generate_chart_page.py` lines 298–460 (wheel rendering) and 672–730 (planet rendering).

Key constants from the Python:
```
rSignOuter = 200, rEcliptic = 158, rHouseInner = 108
cx = 200, cy = 200 (for 400px viewBox)
ang(lon) = math.radians(lon + 180)  # ASC at 9 o'clock
pt(r, a) = (cx + r*cos(a), cy + r*sin(a))
```

Element colors:
```
Fire: #d32f2f, Earth: #2e7d32, Air: #fbc02d, Water: #1976d2
Pastels: Fire #f5d0d0, Earth #d0e8d0, Air #f5ecd0, Water #d0dcef
50%-lighter: Fire #e99797, Earth #97b697, Air #fddc96, Water #9ba5e6
```

Sign→Element mapping:
```
Aries=Fire, Taurus=Earth, Gemini=Air, Cancer=Water,
Leo=Fire, Virgo=Earth, Libra=Air, Scorpio=Water,
Sagittarius=Fire, Capricorn=Earth, Aquarius=Air, Pisces=Water
```

Body correspondences (for tooltips):
```
Aries=Head, Taurus=Neck, Gemini=Arms, Cancer=Chest, Leo=Heart,
Virgo=Intestines, Libra=Hips, Scorpio=Groin, Sagittarius=Thighs,
Capricorn=Knees, Aquarius=Calves, Pisces=Feet
```