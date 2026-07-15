#!/usr/bin/env python3
"""Generate a SINGLE-PAGE PDF of the natal chart wheel only.

This is the standalone chart page — iterate here, then insert into
the full report's page 2 once it looks right.

Usage:
    source ~/.hermes/hermes-agent/venv/bin/activate
    python3 scripts/generate_chart_page.py \
        --year 1982 --month 5 --day 2 --hour 2 --min 16 --tz EDT \
        --lat 30.22 --lon -81.68 --name "Cheryl K. Beggs"
"""

import os, sys, math, argparse, tempfile, subprocess
import swisseph as swe
import cairosvg

# Import planet glyph SVG paths from snapshot module (path-based = no font dependency)
# Deferred: snapshot_page imports calculate_hellenistic_rulers from chart_page at module top,
# so we must do this import inside the function to avoid the circular dependency.
_PLANET_PATHS = None
_glyph_svg_path = None

def _load_planet_paths():
    global _PLANET_PATHS, _glyph_svg_path
    if _PLANET_PATHS is None:
        import importlib
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        snap = importlib.import_module('generate_snapshot_page')
        _PLANET_PATHS = snap.PLANET_PATHS
        _glyph_svg_path = snap.glyph_svg_path
    return _PLANET_PATHS

# ── Swiss Ephemeris ──────────────────────────────────────────────────────────
EPHE_PATH = '/mnt/e/Hermes Project/GitHub/Timeline_ARCHIVED/app-timeline/public/ephe'
swe.set_ephe_path(EPHE_PATH)

SWE_BODIES = {
    "Sun": swe.SUN, "Moon": swe.MOON,
    "Mercury": swe.MERCURY, "Venus": swe.VENUS, "Mars": swe.MARS,
    "Jupiter": swe.JUPITER, "Saturn": swe.SATURN,
    "Uranus": swe.URANUS, "Neptune": swe.NEPTUNE, "Pluto": swe.PLUTO,
    "N.Node": swe.MEAN_NODE,
}

GLYPHS = {"Sun":"☉","Moon":"☽","Mercury":"☿","Venus":"♀","Mars":"♂",
          "Jupiter":"♃","Saturn":"♄","Uranus":"♅","Neptune":"♆","Pluto":"♇",
          "N.Node":"☊"}

# Spanish translations for chart page labels.
# These match the ES_* dicts in generate_snapshot_page.py so the Spanish chart
# page reads naturally with the Spanish snapshot page.
ES_PLANETS = {
    "Sun": "Sol", "Moon": "Luna", "Mercury": "Mercurio", "Venus": "Venus",
    "Mars": "Marte", "Jupiter": "Júpiter", "Saturn": "Saturno",
    "Uranus": "Urano", "Neptune": "Neptuno", "Pluto": "Plutón", "N.Node": "Nodo",
}
ES_SIGNS = {"Aries":"Aries","Taurus":"Tauro","Gemini":"Géminis","Cancer":"Cáncer","Leo":"Leo","Virgo":"Virgo","Libra":"Libra","Scorpio":"Escorpio","Sagittarius":"Sagitario","Capricorn":"Capricornio","Aquarius":"Acuario","Pisces":"Piscis"}
ES_ELEMENTS = {"Fire":"Fuego","Earth":"Tierra","Air":"Aire","Water":"Agua"}
ES_QUALITIES = {"Cardinal":"Cardinal","Fixed":"Fijo","Mutable":"Mutable"}
ES_HOUSE_ABBR = "C"  # "Casa" in Spanish, vs English "H" for "House"
SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra",
         "Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]
SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"]
ELEMENTS = {"Aries":"Fire","Taurus":"Earth","Gemini":"Air","Cancer":"Water",
            "Leo":"Fire","Virgo":"Earth","Libra":"Air","Scorpio":"Water",
            "Sagittarius":"Fire","Capricorn":"Earth","Aquarius":"Air","Pisces":"Water"}
QUALITIES = {"Aries":"Cardinal","Taurus":"Fixed","Gemini":"Mutable","Cancer":"Cardinal",
             "Leo":"Fixed","Virgo":"Mutable","Libra":"Cardinal","Scorpio":"Fixed",
             "Sagittarius":"Mutable","Capricorn":"Cardinal","Aquarius":"Fixed","Pisces":"Mutable"}
# Canonical planet colors (web wheel spec — also matches galvanic-metal intuition:
# Sun=gold, Moon=silver, Mars=rust, Saturn=lead; Mercury/Venus/Jupiter/Uranus/Neptune/Pluto from web)
PLANET_COLORS = {
    "Sun": "#ffd700",      # gold (galvanic Au)
    "Moon": "#c0c0c0",     # silver (galvanic Ag)
    "Mercury": "#87ceeb",  # sky blue
    "Venus": "#ff69b4",    # pink
    "Mars": "#ff4444",     # rust red (galvanic Fe)
    "Jupiter": "#ffa500",  # orange
    "Saturn": "#8b4513",   # saddle brown (galvanic Pb)
    "Uranus": "#34d399",   # emerald
    "Neptune": "#38bdf8",  # sky
    "Pluto": "#fb7185",    # rose
    "N.Node": "#a78bfa",   # violet
}

# Print-friendly darker versions of the galvanic colors (for wheel-internal glyphs
# which are smaller and need higher contrast on paper)
WHEEL_GLYPH_COLORS = {
    "Sun":     "#b8860b",  # dark goldenrod
    "Moon":    "#222222",  # black (overrides silver for print)
    "Mercury": "#4682b4",  # steel blue
    "Venus":   "#c71585",  # medium violet red
    "Mars":    "#b22222",  # firebrick
    "Jupiter": "#cc6600",  # dark orange
    "Saturn":  "#5c2d0a",  # darker brown
    "Uranus":  "#006400",  # dark green
    "Neptune": "#000080",  # navy
    "Pluto":   "#8b0000",  # dark red
    "N.Node":  "#4b0082",  # indigo
}

ELEMENT_COLORS = {"Fire":"#d32f2f","Earth":"#2e7d32","Air":"#fbc02d","Water":"#1976d2"}

# ── Hellenistic rulership data ───────────────────────────────────────────────
DOMICILE = {
    "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
    "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
    "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter",
}
EXALTATION = {
    "Aries": "Sun", "Taurus": "Moon", "Gemini": None, "Cancer": "Jupiter",
    "Leo": None, "Virgo": "Mercury", "Libra": "Saturn", "Scorpio": None,
    "Sagittarius": None, "Capricorn": "Mars", "Aquarius": None, "Pisces": "Venus",
}
TRIPLICITY = {
    "Fire": ("Sun", "Jupiter", "Saturn"),
    "Earth": ("Venus", "Moon", "Mars"),
    "Air": ("Saturn", "Mercury", "Jupiter"),
    "Water": ("Venus", "Mars", "Moon"),
}
EGYPTIAN_BOUNDS = {
    "Aries": [(6,"Jupiter"),(12,"Venus"),(20,"Mercury"),(25,"Mars"),(30,"Saturn")],
    "Taurus": [(8,"Venus"),(14,"Mercury"),(22,"Jupiter"),(27,"Saturn"),(30,"Mars")],
    "Gemini": [(6,"Mercury"),(12,"Jupiter"),(17,"Venus"),(24,"Mars"),(30,"Saturn")],
    "Cancer": [(7,"Mars"),(13,"Venus"),(19,"Mercury"),(26,"Jupiter"),(30,"Saturn")],
    "Leo": [(6,"Jupiter"),(11,"Venus"),(18,"Saturn"),(24,"Mercury"),(30,"Mars")],
    "Virgo": [(7,"Mercury"),(17,"Venus"),(21,"Jupiter"),(28,"Mars"),(30,"Saturn")],
    "Libra": [(6,"Saturn"),(14,"Mercury"),(21,"Jupiter"),(28,"Venus"),(30,"Mars")],
    "Scorpio": [(7,"Mars"),(11,"Venus"),(19,"Mercury"),(24,"Jupiter"),(30,"Saturn")],
    "Sagittarius": [(12,"Jupiter"),(17,"Venus"),(21,"Mercury"),(26,"Saturn"),(30,"Mars")],
    "Capricorn": [(7,"Mercury"),(14,"Jupiter"),(22,"Venus"),(26,"Saturn"),(30,"Mars")],
    "Aquarius": [(7,"Mercury"),(13,"Venus"),(20,"Jupiter"),(25,"Mars"),(30,"Saturn")],
    "Pisces": [(12,"Venus"),(16,"Jupiter"),(19,"Mercury"),(28,"Mars"),(30,"Saturn")],
}
DECAN_RULERS = ["Mars","Sun","Venus","Mercury","Moon","Saturn","Jupiter"] * 5 + ["Mars"]
TRADITIONAL_PLANETS = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"]

def get_bound_lord(sign, deg):
    for end_deg, ruler in EGYPTIAN_BOUNDS[sign]:
        if deg < end_deg:
            return ruler
    return EGYPTIAN_BOUNDS[sign][-1][1]

def get_decan_lord(sign, deg):
    sign_idx = SIGNS.index(sign)
    global_decan = sign_idx * 3 + int(deg // 10)
    return DECAN_RULERS[global_decan % 36]

def is_day_birth(jd_ut, lat, lon):
    """Determine sect by the Sun's actual physical altitude at birth.

    Day sect = Sun is above the horizon at the moment of birth (i.e., between
    local sunrise and sunset). This is the physical definition; the chart-based
    "above horizon" (= Sun in upper half of wheel) is not the same thing, because
    a 2 AM birth in May at 30°N has the Sun well below the horizon even though
    the Sun's longitude may happen to fall in the wheel's upper half.

    Computed via Swiss Ephemeris: sun altitude = swe.azalt(jd, ECL2HOR, geopos).
    """
    geopos = [lon, lat, 0]
    try:
        sun, _ = swe.calc_ut(jd_ut, swe.SUN)
        res = swe.azalt(jd_ut, swe.ECL2HOR, geopos, 0, 0, [sun[0], 0, 1])
        altitude = res[1]  # +ve = above horizon
        return altitude > 0
    except Exception:
        # Fallback: rough UTC-hour check
        year, month, day, hour_frac = swe.revjul(jd_ut)
        return 6.0 <= hour_frac <= 18.0

def calculate_hellenistic_rulers(planets, asc, sun_lon, moon_lon, jd_ut=None, lat=0, lon=0):
    """Returns (chart_ruler, master_of_nativity, predominator, is_day)."""
    asc_sign = sign_from_lon(asc)
    chart_ruler = DOMICILE[asc_sign]  # Kurios = domicile lord of Ascendant

    is_day = is_day_birth(jd_ut, lat, lon) if jd_ut is not None else False
    lot_fortune = (asc + moon_lon - sun_lon) % 360 if is_day else (asc + sun_lon - moon_lon) % 360

    # Traditional planet positions only
    positions = {p["name"]: p["lon_num"] for p in planets if p["name"] in TRADITIONAL_PLANETS}

    # Predominator: most dignity connections to Sun, Moon, Asc, Lot of Fortune
    scores = {p: 0 for p in TRADITIONAL_PLANETS}
    for point_lon in [sun_lon, moon_lon, asc, lot_fortune]:
        sign = sign_from_lon(point_lon)
        deg = degree_in_sign(point_lon)
        element = ELEMENTS[sign]
        scores[DOMICILE[sign]] += 5
        exalt = EXALTATION[sign]
        if exalt:
            scores[exalt] += 4
        trip = TRIPLICITY[element][0] if is_day else TRIPLICITY[element][1]
        scores[trip] += 3
        scores[get_bound_lord(sign, deg)] += 2
        scores[get_decan_lord(sign, deg)] += 1

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_score = ranked[0][1]
    candidates = [p for p, s in ranked if s == top_score]
    if len(candidates) == 1:
        predominator = candidates[0]
    else:
        sect_light = "Sun" if is_day else "Moon"
        if sect_light in candidates:
            predominator = sect_light
        else:
            predominator = candidates[0]

    # Master of Nativity = bound lord of the Predominator
    pred_sign = sign_from_lon(positions[predominator])
    pred_deg = degree_in_sign(positions[predominator])
    master = get_bound_lord(pred_sign, pred_deg)

    return chart_ruler, master, predominator, is_day

OUTPUT_DIR = '/mnt/e/Hermes Project/Company_OS/deliverables/cosmic-history-report'

# ── Helpers ──────────────────────────────────────────────────────────────────

def sign_from_lon(lon):
    return SIGNS[int(lon % 360) // 30]

def degree_in_sign(lon):
    return (lon % 360) % 30

def get_planet_data(jd):
    results = []
    for name, body_id in SWE_BODIES.items():
        result, ret = swe.calc_ut(jd, body_id, swe.FLG_SWIEPH)
        ld = result[0] % 360
        si = int(ld // 30)
        d, m = int(ld % 30), int((ld % 30 - int(ld % 30)) * 60)
        sign = SIGNS[si]
        results.append({
            "name": name, "glyph": GLYPHS.get(name, "?"),
            "lon": f"{ld:.1f}", "lon_num": ld,
            "sign": sign, "sign_glyph": SIGN_GLYPHS[si],
            "deg": d, "min": m,
            "element": ELEMENTS[sign], "quality": QUALITIES[sign],
        })
    return results

# Bodies that should NOT be included in aspect calculations
NON_ASPECT_BODIES = {"N.Node"}

# ── Chart wheel SVG ──────────────────────────────────────────────────────────
# Page is US Letter portrait: 8.5"×11" = 612×792 pt at 72dpi.
# We build the SVG at 612×792 (1:1 with PDF points) so there's NO scaling,
# NO aspect-ratio mismatch, and NO off-center pushing.

def build_wheel_svg(planets, asc, mc, recipient_name="", birth_date="", birth_time="", birth_location="", house_system="Whole Houses", rulers=None, jd=None, chart_title="Natal Chart", lang="en"):
    W, H = 612, 792          # US Letter in points (72dpi)
    MARGIN = 18              # 0.25" printer-safe margin on all sides
    cx, cy = W / 2, 280      # Wheel centered on page, kept high
    WHEEL_R = 200            # Wheel radius (20% smaller from 250)
    BOX_W, BOX_H = 120, 52     # Bigger boxes for larger text
    BOX_GAP = 8

    # Language helpers — when lang="es", translate planet/sign/element/quality
    # labels. When lang="en", use the English values directly.
    # Note: variable names are prefixed with `t_` (for "translate") to avoid
    # shadowing the planet loop variable `pname` below.
    is_es = (lang == "es")
    house_abbr = ES_HOUSE_ABBR if is_es else "H"
    t_planet = lambda n: ES_PLANETS.get(n, n) if is_es else n
    t_sign = lambda s: ES_SIGNS.get(s, s) if is_es else s
    t_elem = lambda e: ES_ELEMENTS.get(e, e) if is_es else e
    t_qual = lambda q: ES_QUALITIES.get(q, q) if is_es else q

    def ang(lon_deg):
        return math.radians(180 - (lon_deg - asc))

    def pt(r, a):
        return (cx + math.cos(a) * r, cy + math.sin(a) * r)

    # Angle pseudo-planets (AC, MC, DC, IC — all drawn on wheel, only AC/MC get boxes)
    dsc = (asc + 180) % 360
    ic = (mc + 180) % 360
    angles = [
        {"name":"AC","lon_num":asc,"sign":sign_from_lon(asc),
         "deg":int(asc%30),"min":int(((asc%30)-int(asc%30))*60),
         "element":ELEMENTS[sign_from_lon(asc)],"quality":QUALITIES[sign_from_lon(asc)],
         "color":"#c0392b","has_box":True},
        {"name":"MC","lon_num":mc,"sign":sign_from_lon(mc),
         "deg":int(mc%30),"min":int(((mc%30)-int(mc%30))*60),
         "element":ELEMENTS[sign_from_lon(mc)],"quality":QUALITIES[sign_from_lon(mc)],
         "color":"#2980b9","has_box":True},
        {"name":"DC","lon_num":dsc,"sign":sign_from_lon(dsc),
         "deg":int(dsc%30),"min":int(((dsc%30)-int(dsc%30))*60),
         "element":ELEMENTS[sign_from_lon(dsc)],"quality":QUALITIES[sign_from_lon(dsc)],
         "color":"#c0392b","has_box":False},
        {"name":"IC","lon_num":ic,"sign":sign_from_lon(ic),
         "deg":int(ic%30),"min":int(((ic%30)-int(ic%30))*60),
         "element":ELEMENTS[sign_from_lon(ic)],"quality":QUALITIES[sign_from_lon(ic)],
         "color":"#2980b9","has_box":False},
    ]

    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    svg += '<rect width="100%" height="100%" fill="white"/>'

    # ── Header: left-aligned natal info ──
    hx = MARGIN + 4
    hy = 30
    svg += f'<text x="{hx}" y="{hy}" font-size="13" font-weight="bold" font-family="DejaVu Sans, sans-serif" fill="#1a3a5c">{chart_title}</text>'
    if recipient_name:
        svg += f'<text x="{hx}" y="{hy + 16}" font-size="10" font-family="DejaVu Sans, sans-serif" fill="#333">{recipient_name}</text>'
    if birth_date:
        svg += f'<text x="{hx}" y="{hy + 30}" font-size="8" font-family="DejaVu Sans, sans-serif" fill="#666">{birth_date} &#183; {birth_time}</text>'
    if birth_location:
        svg += f'<text x="{hx}" y="{hy + 42}" font-size="8" font-family="DejaVu Sans, sans-serif" fill="#666">{birth_location}</text>'
    if house_system:
        svg += f'<text x="{hx}" y="{hy + 54}" font-size="8" font-family="DejaVu Sans, sans-serif" fill="#666">{house_system}</text>'

    # ── Top-right: Cosmic Blueprint note ──
    # Title at 10px (same as recipient name), body at 8px (same as birth info)
    nx = W - MARGIN - 4
    blueprint = (
        ("El Plano Cósmico", "Las casas son el patrón cósmico", "manifestado en el cuerpo — Aries en", "la cabeza, Piscis en los pies.")
        if is_es else
        ("The Cosmic Blueprint", "The houses are the cosmic pattern", "manifest in the body — Aries at the", "head, Pisces at the feet.")
    )
    svg += f'<text x="{nx}" y="34" font-size="10" font-weight="bold" text-anchor="end" font-family="DejaVu Sans, sans-serif" fill="#1a3a5c">{blueprint[0]}</text>'
    svg += f'<text x="{nx}" y="48" font-size="8" text-anchor="end" font-family="DejaVu Sans, sans-serif" fill="#666">{blueprint[1]}</text>'
    svg += f'<text x="{nx}" y="58" font-size="8" text-anchor="end" font-family="DejaVu Sans, sans-serif" fill="#666">{blueprint[2]}</text>'
    svg += f'<text x="{nx}" y="68" font-size="8" text-anchor="end" font-family="DejaVu Sans, sans-serif" fill="#666">{blueprint[3]}</text>'

    # ── Layout: two concentric rings + aspect core ──
    # Outer: tropical signs ring (pastel by element)
    # Ecliptic: boundary circle between signs and houses
    # Inner: houses ring (light gray, planet glyphs live here)
    # Core: aspect lines inside houses ring
    rSignOuter  = WHEEL_R          # 200 — outer edge of sign ring
    rEcliptic   = WHEEL_R - 42     # 158 — ecliptic boundary
    rHouseInner = WHEEL_R - 92     # 108 — inner edge of house ring
    rAspect     = rHouseInner - 4 # 104 — aspect ring
    rTickInner  = rAspect - 4     # 100 — inner tip of tick (half-length)
    rTickOuter  = rHouseInner     # 108 — outer tip touches house inner circle

    # ── Sign wedges (colored ring) ──
    for i in range(12):
        a0 = ang(i * 30)
        a1 = ang((i + 1) * 30)
        x0, y0 = pt(rSignOuter, a0)
        x1, y1 = pt(rSignOuter, a1)
        x2, y2 = pt(rEcliptic, a1)
        x3, y3 = pt(rEcliptic, a0)
        large = 1 if (a1 - a0) > math.pi else 0
        PASTEL = {"#d32f2f":"#f5d0d0","#2e7d32":"#d0e8d0","#fbc02d":"#f5ecd0","#1976d2":"#d0dcef"}
        fill = PASTEL[ELEMENT_COLORS[ELEMENTS[SIGNS[i]]]]
        svg += f'<path d="M {x0:.1f} {y0:.1f} A {rSignOuter} {rSignOuter} 0 {large} 0 {x1:.1f} {y1:.1f} L {x2:.1f} {y2:.1f} A {rEcliptic} {rEcliptic} 0 {large} 1 {x3:.1f} {y3:.1f} Z" fill="{fill}"/>'

    # ── House wedges (light emanating from the sign glyph, Aries always H1) ──
    # The house ring is the personal/internal fractal of the cosmic sign ring.
    # Aries is always House 1 at the Ascendant (the head), Taurus=H2, etc. —
    # fixed to the body, not to the sky.
    #
    # Each house wedge is near-white with a radial gradient emanating from the
    # sign glyph at center, in the element color — like light radiating from
    # the sign itself. The feather edges are soft and rounded.
    asc_sign_idx = int(asc // 30)
    # Element colors for the glyph + emanation
    ELEM_RAW = ELEMENT_COLORS  # {"Fire":"#d32f2f", "Earth":"#2e7d32", "Air":"#fbc02d", "Water":"#1976d2"}
    # Radial gradient defs — one per house, focal point at the glyph center
    rGlyph = (rEcliptic + rHouseInner) / 2  # radius where glyph sits
    svg += '<defs>'
    for h in range(12):
        cusp_lon = ((asc_sign_idx + h) % 12) * 30
        # Emanation focal point at the 15th degree (midpoint between number and glyph)
        eman_ang = ang(cusp_lon + 15)
        rEmanLabel = rHouseInner + 9  # same radius as the house labels
        # Emanation center in absolute SVG coords
        fx = cx + math.cos(eman_ang) * rEmanLabel
        fy = cy + math.sin(eman_ang) * rEmanLabel
        elem_color = ELEM_RAW[ELEMENTS[SIGNS[h]]]
        # 50% lighter version of the element color (mix with white)
        def lighten(hex_color, pct):
            r = int(hex_color[1:3], 16)
            g = int(hex_color[3:5], 16)
            b = int(hex_color[5:7], 16)
            r = int(r + (255 - r) * pct)
            g = int(g + (255 - g) * pct)
            b = int(b + (255 - b) * pct)
            return f"#{r:02x}{g:02x}{b:02x}"
        light_color = lighten(elem_color, 0.5)
        gid = f"emanH{h}"
        # Radial gradient: 50%-lighter element color at glyph center → near-white at edges
        # fx/fy in userSpaceOnUse so the focal point is the actual glyph position
        svg += f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="{fx:.1f}" cy="{fy:.1f}" r="55">'
        svg += f'<stop offset="0%" stop-color="{light_color}" stop-opacity="0.45"/>'
        svg += f'<stop offset="30%" stop-color="{light_color}" stop-opacity="0.2"/>'
        svg += f'<stop offset="60%" stop-color="{light_color}" stop-opacity="0.06"/>'
        svg += '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>'
        svg += '</radialGradient>'
    # Clip path: house ring only (between rEcliptic and rHouseInner) — prevents
    # feather bleed into the tropical sign ring
    svg += '<clipPath id="houseRingClip"><path d="M '
    # Outer circle (rEcliptic) clockwise
    ce0x, ce0y = pt(rEcliptic, 0)
    ce1x, ce1y = pt(rEcliptic, math.radians(360))
    svg += f'{ce0x:.1f} {ce0y:.1f} A {rEcliptic} {rEcliptic} 0 1 0 {ce1x:.1f} {ce1y:.1f} A {rEcliptic} {rEcliptic} 0 1 0 {ce0x:.1f} {ce0y:.1f} Z'
    # Inner circle (rHouseInner) — subtract by reverse winding
    ci0x, ci0y = pt(rHouseInner, 0)
    ci1x, ci1y = pt(rHouseInner, math.radians(360))
    svg += f' M {ci0x:.1f} {ci0y:.1f} A {rHouseInner} {rHouseInner} 0 1 1 {ci1x:.1f} {ci1y:.1f} A {rHouseInner} {rHouseInner} 0 1 1 {ci0x:.1f} {ci0y:.1f} Z'
    svg += '"/></clipPath>'
    svg += '</defs>'
    for h in range(12):
        cusp_lon = ((asc_sign_idx + h) % 12) * 30
        a0 = ang(cusp_lon)
        a1 = ang(cusp_lon + 30)
        x0, y0 = pt(rEcliptic, a0)
        x1, y1 = pt(rEcliptic, a1)
        x2, y2 = pt(rHouseInner, a1)
        x3, y3 = pt(rHouseInner, a0)
        large = 1 if (a1 - a0) > math.pi else 0
        wedge_path = f'M {x0:.1f} {y0:.1f} A {rEcliptic} {rEcliptic} 0 {large} 0 {x1:.1f} {y1:.1f} L {x2:.1f} {y2:.1f} A {rHouseInner} {rHouseInner} 0 {large} 1 {x3:.1f} {y3:.1f} Z'
        # No base fill — emanation gradient only, no grey background
        svg += f'<path d="{wedge_path}" fill="none"/>'
        # Light emanation overlay — radial gradient from emanation center
        svg += f'<path d="{wedge_path}" fill="url(#emanH{h})"/>'
        # Feather strokes clipped to house ring — no bleed into sign ring
        svg += '<g clip-path="url(#houseRingClip)">'
        # Soft rounded feather on cusp lines — double stroke for blur-like softness
        for ca in [a0, a1]:
            cx1, cy1 = pt(rEcliptic, ca)
            cx2, cy2 = pt(rHouseInner, ca)
            # Wide soft outer glow
            svg += f'<line x1="{cx1:.1f}" y1="{cy1:.1f}" x2="{cx2:.1f}" y2="{cy2:.1f}" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.35"/>'
            # Narrower inner glow
            svg += f'<line x1="{cx1:.1f}" y1="{cy1:.1f}" x2="{cx2:.1f}" y2="{cy2:.1f}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>'
        # Soft rounded feather on outer ring arc (ecliptic edge)
        svg += f'<path d="M {x0:.1f} {y0:.1f} A {rEcliptic} {rEcliptic} 0 {large} 0 {x1:.1f} {y1:.1f}" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.3"/>'
        svg += f'<path d="M {x0:.1f} {y0:.1f} A {rEcliptic} {rEcliptic} 0 {large} 0 {x1:.1f} {y1:.1f}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>'
        # Soft rounded feather on inner ring arc (house-inner edge)
        svg += f'<path d="M {x3:.1f} {y3:.1f} A {rHouseInner} {rHouseInner} 0 {large} 1 {x2:.1f} {y2:.1f}" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.3"/>'
        svg += f'<path d="M {x3:.1f} {y3:.1f} A {rHouseInner} {rHouseInner} 0 {large} 1 {x2:.1f} {y2:.1f}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>'
        svg += '</g>'

    # ── Sign glyphs in sign ring ──
    for i in range(12):
        mid = ang(i * 30 + 15)
        tx, ty = pt((rSignOuter + rEcliptic) / 2, mid)
        svg += f'<text x="{tx:.0f}" y="{ty:.0f}" font-size="16" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#000">{SIGN_GLYPHS[i]}</text>'

    # ── House ring: sign glyph + house number near inner edge, offset within wedge ──
    # Natural zodiac: Aries always H1 at AC, Taurus H2, etc. — fixed to anatomy.
    # Both glyphs sit at the same radius (near inner edge) but at different
    # degrees within the 30° wedge: house number at the 10th degree, sign glyph
    # at the 20th degree. This keeps the center of the house ring clear for planets.
    rHouseLabel = rHouseInner + 9
    for h in range(12):
        cusp_lon = ((asc_sign_idx + h) % 12) * 30
        # 50%-lighter element color for the glyph (matches the emanation light)
        def _lighten(hex_color, pct):
            r = int(hex_color[1:3], 16)
            g = int(hex_color[3:5], 16)
            b = int(hex_color[5:7], 16)
            r = int(r + (255 - r) * pct)
            g = int(g + (255 - g) * pct)
            b = int(b + (255 - b) * pct)
            return f"#{r:02x}{g:02x}{b:02x}"
        light_elem = _lighten(ELEMENT_COLORS[ELEMENTS[SIGNS[h]]], 0.5)
        # House number at the 10th degree of the sign
        num_ang = ang(cusp_lon + 10)
        nx, ny = pt(rHouseLabel, num_ang)
        svg += f'<text x="{nx:.0f}" y="{ny:.0f}" font-size="9" font-weight="bold" text-anchor="middle" dominant-baseline="central" fill="#333" font-family="DejaVu Sans, sans-serif">{h + 1}</text>'
        # Sign glyph at the 20th degree of the sign
        # Capricorn(9), Aquarius(10), Cancer(3), Leo(4) are slightly bigger for readability
        glyph_size = 14 if h in (3, 4, 9, 10) else 12
        glyph_ang = ang(cusp_lon + 20)
        gx, gy = pt(rHouseLabel, glyph_ang)
        svg += f'<text x="{gx:.0f}" y="{gy:.0f}" font-size="{glyph_size}" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#b08d5a">{SIGN_GLYPHS[h]}</text>'

    # ── Ring boundary circles ──
    svg += f'<circle cx="{cx}" cy="{cy}" r="{rSignOuter}" fill="none" stroke="#666666" stroke-width="1"/>'
    svg += f'<circle cx="{cx}" cy="{cy}" r="{rEcliptic}" fill="none" stroke="#666666" stroke-width="1.2"/>'
    svg += f'<circle cx="{cx}" cy="{cy}" r="{rHouseInner}" fill="none" stroke="#666666" stroke-width="1"/>'

    # ── Constellation overlay (on top of signs, scaled to ecliptic) ──
    constellation_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'constellation_paths.svg')
    if os.path.exists(constellation_path):
        with open(constellation_path, 'r') as f:
            const_paths = f.read().strip()
        const_scale = rEcliptic / 251.0
        tx = cx - 297.5 * const_scale
        ty = cy - 369.7 * const_scale
        precession_deg = 0
        if jd is not None:
            years = (jd - 2451545.0) / 365.2422
            precession_deg = -1 * (years * 50.29 / 3600)
        star_rot = 3.0 + precession_deg + asc
        svg += f'<g transform="rotate({star_rot:.3f} {cx} {cy}) translate({tx:.2f} {ty:.2f}) scale({const_scale:.4f})" opacity="0.9">'
        svg += const_paths
        svg += '</g>'

    # ── Degree ticks (outward from outer edge) ──
    for deg in range(360):
        a = ang(deg)
        if deg % 10 == 0:
            rO, sw, color = rSignOuter + 5, 0.8, "#555555"
        elif deg % 5 == 0:
            rO, sw, color = rSignOuter + 3, 0.5, "#777777"
        else:
            rO, sw, color = rSignOuter + 1.5, 0.3, "#999999"
        x1, y1 = pt(rSignOuter, a)
        x2, y2 = pt(rO, a)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>'

    # ── Degree ticks on the ecliptic (inward from ecliptic) ──
    for deg in range(360):
        a = ang(deg)
        if deg % 10 == 0:
            rI, sw, color = rEcliptic - 5, 0.8, "#555555"
        elif deg % 5 == 0:
            rI, sw, color = rEcliptic - 3, 0.5, "#777777"
        else:
            rI, sw, color = rEcliptic - 1.5, 0.3, "#999999"
        x1, y1 = pt(rEcliptic, a)
        x2, y2 = pt(rI, a)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>'

    # ── House cusp lines (extend from sign ring through house ring) ──
    # Bold and clearly visible — restored from the lightened version
    for h in range(12):
        cusp_lon = ((asc_sign_idx + h) % 12) * 30
        a = ang(cusp_lon)
        x1, y1 = pt(rSignOuter + 3, a)
        x2, y2 = pt(rHouseInner, a)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#888888" stroke-width="0.8" stroke-linecap="round"/>'

    # ── Aspect lines (inside house ring) ──
    aspect_defs = [(0, 5), (180, 6), (90, 5), (120, 5), (60, 4)]
    def angle_diff(a, b):
        d = abs(a - b) % 360
        return d if d <= 180 else 360 - d

    # Short aspect markers (tick marks) at each planet's position on the aspect ring
    for p in planets:
        if p["name"] in NON_ASPECT_BODIES:
            continue
        a = ang(p["lon_num"])
        x1, y1 = pt(rTickInner, a)
        x2, y2 = pt(rTickOuter, a)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#777" stroke-width="1.2" stroke-linecap="round"/>'

    # Aspect lines between planets (with color-coded glyph at midpoint, white halo behind glyph)
    aspect_glyphs = {60: "⚹", 90: "□", 120: "△", 180: "☍"}  # no conjunction glyph
    aspect_planets = [p for p in planets if p["name"] not in NON_ASPECT_BODIES]

    # First pass: draw all aspect lines and collect glyph positions for auto-separation
    aspect_glyph_data = []  # (mx, my, angle_from_center, glyph, color)
    for i in range(len(aspect_planets)):
        for j in range(i + 1, len(aspect_planets)):
            A, B = aspect_planets[i], aspect_planets[j]
            d = angle_diff(A["lon_num"], B["lon_num"])
            for adeg, aorb in aspect_defs:
                if abs(d - adeg) <= aorb:
                    sw = 1.5
                    if adeg in (0, 90, 180):
                        color = "#d44a4a"
                    else:
                        color = "#5a7ac0"
                    aA = ang(A["lon_num"])
                    aB = ang(B["lon_num"])
                    # Lines touch the inside tip of each tick mark
                    x1, y1 = pt(rTickInner, aA)
                    x2, y2 = pt(rTickInner, aB)
                    svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>'
                    # Glyph at midpoint
                    mx = (x1 + x2) / 2
                    my = (y1 + y2) / 2
                    glyph = aspect_glyphs.get(adeg, "")
                    if glyph:
                        # Angle from chart center to midpoint — used for separation direction
                        mid_angle = math.atan2(my - cy, mx - cx)
                        aspect_glyph_data.append({
                            "mx": mx, "my": my, "angle": mid_angle,
                            "glyph": glyph, "color": color,
                        })
                    break

    # Auto-separate aspect glyphs: push apart along their angular direction
    # if their pixel positions are too close
    GLYPH_R = 8  # white halo radius
    MIN_GAP = GLYPH_R * 2 + 2  # minimum distance between glyph centers

    if len(aspect_glyph_data) > 1:
        for _ in range(15):
            moved = False
            for i in range(len(aspect_glyph_data) - 1):
                for j in range(i + 1, len(aspect_glyph_data)):
                    gi = aspect_glyph_data[i]
                    gj = aspect_glyph_data[j]
                    dx = gj["mx"] - gi["mx"]
                    dy = gj["my"] - gi["my"]
                    dist = math.hypot(dx, dy)
                    if dist < MIN_GAP and dist > 0.01:
                        push = (MIN_GAP - dist) / 2
                        ux, uy = dx / dist, dy / dist
                        gi["mx"] -= ux * push
                        gi["my"] -= uy * push
                        gj["mx"] += ux * push
                        gj["my"] += uy * push
                        moved = True
                    elif dist < 0.01:
                        # Overlapping — push apart perpendicular to their average angle
                        avg_ang = (gi["angle"] + gj["angle"]) / 2
                        gi["mx"] -= math.cos(avg_ang + math.pi/2) * MIN_GAP / 2
                        gi["my"] -= math.sin(avg_ang + math.pi/2) * MIN_GAP / 2
                        gj["mx"] += math.cos(avg_ang + math.pi/2) * MIN_GAP / 2
                        gj["my"] += math.sin(avg_ang + math.pi/2) * MIN_GAP / 2
                        moved = True
            if not moved:
                break

    # Render aspect glyphs (after separation)
    for g in aspect_glyph_data:
        svg += f'<circle cx="{g["mx"]:.1f}" cy="{g["my"]:.1f}" r="{GLYPH_R}" fill="white" stroke="none"/>'
        svg += f'<text x="{g["mx"]:.1f}" y="{g["my"]:.1f}" text-anchor="middle" dominant-baseline="central" font-family="FreeSerif" font-size="13" fill="{g["color"]}" font-weight="bold">{g["glyph"]}</text>'

    # ── Planet dots and glyphs inside the house ring ──
    # Auto-separation applies to PLANETS ONLY. Angles (AC, MC, etc.) are rendered
    # separately as ticks + labels at the ecliptic and are NOT included in the
    # separation logic — they have their own fixed positions and should not
    # influence planet spacing.
    # Planets sit between ecliptic and house inner edge
    rPlanetDot = rEcliptic
    rPlanetGlyph = rEcliptic - 24
    GLYPH_FONT_PX = 13
    GLYPH_MIN_GAP_PX = 14  # ↑ from 11 — just enough room for glyph to be fully visible
    MIN_SEP_DEG = max(0.8, min(8.0, ((GLYPH_FONT_PX + GLYPH_MIN_GAP_PX) / rPlanetGlyph) * (180 / math.pi)))

    # Planets AND angles both go into the separation list, but angles
    # are fixed (their position is the actual chart structure — AC, MC,
    # DC, IC are real ecliptic points, not glyphs to be packed). Planets
    # get pushed around their own cluster; angles stay anchored.
    # Auto-separation only matters between planets.
    all_items = []
    for p in planets:
        all_items.append({"key": "planet_" + p["name"], "lon": p["lon_num"], "type": "planet", "ref": p, "fixed": False})
    for a in angles:
        all_items.append({"key": "angle_" + a["name"], "lon": a["lon_num"], "type": "angle", "ref": a, "fixed": True})

    # Compute seam (opposite centroid)
    sx, sy = 0, 0
    for item in all_items:
        a_rad = math.radians(item["lon"])
        sx += math.cos(a_rad)
        sy += math.sin(a_rad)
    if all_items:
        mean_ang = math.degrees(math.atan2(sy, sx)) % 360
        seam = (mean_ang + 180) % 360
    else:
        seam = 0

    # Sort by shifted longitude (seam at 0)
    for item in all_items:
        item["lon_shift"] = ((item["lon"] % 360) - seam + 360) % 360
    all_items.sort(key=lambda x: x["lon_shift"])

    # Iterative separation
    offsets = [0.0] * len(all_items)
    for _ in range(10):
        for i in range(len(all_items) - 1):
            a_pos = all_items[i]["lon_shift"] + offsets[i]
            b_pos = all_items[i + 1]["lon_shift"] + offsets[i + 1]
            d = b_pos - a_pos
            if d < MIN_SEP_DEG:
                push = (MIN_SEP_DEG - d) / 2
                a_fixed = all_items[i]["fixed"]
                b_fixed = all_items[i + 1]["fixed"]
                if a_fixed and b_fixed:
                    pass
                elif a_fixed:
                    offsets[i + 1] += push * 2
                elif b_fixed:
                    offsets[i] -= push * 2
                else:
                    offsets[i] -= push
                    offsets[i + 1] += push
        if len(all_items) > 1:
            a_pos = all_items[-1]["lon_shift"] + offsets[-1]
            b_pos = (all_items[0]["lon_shift"] + 360) + offsets[0]
            d = b_pos - a_pos
            if d < MIN_SEP_DEG:
                push = (MIN_SEP_DEG - d) / 2
                a_fixed = all_items[-1]["fixed"]
                b_fixed = all_items[0]["fixed"]
                if a_fixed and b_fixed:
                    pass
                elif a_fixed:
                    offsets[0] += push * 2
                elif b_fixed:
                    offsets[-1] -= push * 2
                else:
                    offsets[-1] -= push
                    offsets[0] += push

    # Clamp
    for i in range(len(all_items)):
        if all_items[i]["fixed"]:
            offsets[i] = 0
        else:
            offsets[i] = max(-18, min(18, offsets[i]))
        all_items[i]["offset"] = offsets[i]

    # Render planet glyphs and angle markers inside house ring
    for item in all_items:
        adjusted_lon = item["lon"] + item["offset"]
        if item["type"] == "planet":
            p = item["ref"]
            a_dot = ang(p["lon_num"])
            a_glyph = ang(adjusted_lon)
            dx, dy = pt(rPlanetDot, a_dot)
            gx, gy = pt(rPlanetGlyph, a_glyph)
            # Leader from dot to glyph — touches BOTH, adapts to auto-separation distance.
            # When auto-separation pushes the glyph radially outward (e.g., from rPlanetGlyph
            # to rPlanetGlyph + 18px), the leader stretches with it. When glyphs overlap and
            # get separated tangentially, the leader is a straight line from dot to glyph.
            vx, vy = gx - dx, gy - dy
            vlen = math.hypot(vx, vy) or 1
            ux, uy = vx / vlen, vy / vlen
            # Start at the dot edge (3px out — dot radius is 2), end at the glyph edge
            # (half the visual glyph size out from glyph center along the unit vector)
            glyph_half_w = 12 if p["name"] == "Pluto" else 14  # visual half-width in px
            lx1, ly1 = dx + ux * 3, dy + uy * 3
            lx2, ly2 = gx - ux * glyph_half_w, gy - uy * glyph_half_w
            svg += f'<line x1="{lx1:.1f}" y1="{ly1:.1f}" x2="{lx2:.1f}" y2="{ly2:.1f}" stroke="#444444" stroke-width="1.2" stroke-linecap="round"/>'
            svg += f'<circle cx="{dx:.1f}" cy="{dy:.1f}" r="2" fill="black"/>'
            # Wheel-internal planet glyph: PRINT-FRIENDLY DARK colors, 30% larger
            # Uses darker variants of galvanic palette for higher contrast on paper
            # Moon: black (matches box-row treatment)
            wheel_glyph_color = WHEEL_GLYPH_COLORS.get(p["name"], "#222")
            # Pluto 20% smaller than other planets
            glyph_size_px = 18 if p["name"] == "Pluto" else 22
            planet_paths = _load_planet_paths()
            if planet_paths and p["name"] in planet_paths:
                info = planet_paths[p["name"]]
                xMin, yMin, xMax, yMax = info["bbox"]
                w_g, h_g = xMax - xMin, yMax - yMin
                scale = glyph_size_px / max(w_g, h_g) if max(w_g, h_g) > 0 else 1
                # Center the path at (gx, gy). Path is in font's Y-up coords; flip Y for SVG.
                tx = gx - (xMin + w_g/2) * scale
                ty = gy + (yMax - h_g/2) * scale
                # NO white halo / no drop shadow — glyph sits on its own against the wheel background.
                # The galvanic color is the only visual treatment; the auto-separation gap is wide
                # enough to prevent overlap.
                svg += f'<g transform="translate({tx:.2f},{ty:.2f}) scale({scale:.4f},-{scale:.4f})"><path d="{info["d"]}" fill="{wheel_glyph_color}"/></g>'
            else:
                # Fallback to text if path missing
                svg += f'<text x="{gx:.1f}" y="{gy:.1f}" font-size="17" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="{wheel_glyph_color}">{p["glyph"]}</text>'
        elif item["type"] == "angle":
            a = item["ref"]
            aa = ang(a["lon_num"])
            # Tick on ecliptic (same size as aspect ticks: 4px each side)
            x1, y1 = pt(rEcliptic - 4, aa)
            x2, y2 = pt(rEcliptic + 4, aa)
            svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{a["color"]}" stroke-width="1.5" stroke-linecap="round"/>'
            # Angle label just outside ecliptic — bold and colored
            lx, ly = pt(rEcliptic + 14, aa)
            svg += f'<text x="{lx:.0f}" y="{ly:.0f}" font-size="9" font-weight="bold" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="{a["color"]}">{a["name"]}</text>'

    # ── Planet + Angle info boxes ──
    # AC and MC go above the top planet row, flanking the wheel
    # Planets in 3 rows by tradition: inner (Sun-Venus), outer visible (Mars-Saturn), invisible (Uranus-Node)
    BOX_W2, BOX_H2 = 105, 52
    BOXES_Y = cy + WHEEL_R + 15
    asc_sign_idx = int(asc // 30)
    planet_houses = {}
    for p in planets:
        sign_idx = int(p["lon_num"] // 30)
        house = ((sign_idx - asc_sign_idx) % 12) + 1
        planet_houses[p["name"]] = house

    boxed_angles = [a for a in angles if a.get("has_box")]

    # Separate AC and MC from planets
    ac_angle = next((a for a in boxed_angles if a["name"] == "AC"), None)
    mc_angle = next((a for a in boxed_angles if a["name"] == "MC"), None)

    # Planet rows by traditional grouping
    planet_names_order = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "N.Node"]
    planet_map = {p["name"]: p for p in planets}

    row_configs = [
        ["Sun", "Moon", "Mercury", "Venus"],       # inner/personal — 4 boxes
        ["Mars", "Jupiter", "Saturn"],              # outer visible — 3 boxes
        ["Uranus", "Neptune", "Pluto", "N.Node"],   # invisible/modern — 4 boxes
    ]

    # ── AC and MC boxes above the top row, flanking the wheel ──
    ANGLE_BOX_W = BOX_W  # 120
    ANGLE_BOX_H = BOX_H  # 52
    ANGLE_GAP = 8
    angle_y = BOXES_Y - ANGLE_BOX_H - ANGLE_GAP  # above the top planet row

    # AC on the left, MC on the right — mirrored
    # Position them just outside the wheel's horizontal extent, shifted slightly inward
    wheel_edge_left = cx - WHEEL_R
    wheel_edge_right = cx + WHEEL_R

    for angle_obj, side in [(ac_angle, "left"), (mc_angle, "right")]:
        if angle_obj is None:
            continue
        if side == "left":
            # AC: left of center, shifted a bit farther left than the planet row would be
            ax = wheel_edge_left - ANGLE_BOX_W - ANGLE_GAP + 20  # shift left of wheel edge
            # Clamp to margin
            ax = max(MARGIN, ax)
        else:
            # MC: right of center, mirrored
            ax = wheel_edge_right + ANGLE_GAP - 20  # shift right of wheel edge
            ax = min(W - MARGIN - ANGLE_BOX_W, ax)

        # MC box: border color = actual MC sign's element (was hardcoded #2980b9)
        mc_color = ELEMENT_COLORS[angle_obj["element"]]
        svg += f'<rect x="{ax:.0f}" y="{angle_y:.0f}" width="{ANGLE_BOX_W}" height="{ANGLE_BOX_H}" rx="3" fill="white" stroke="{mc_color}" stroke-width="1.5"/>'
        abx = ax + ANGLE_BOX_W / 2
        aby = angle_y + ANGLE_BOX_H / 2
        # In whole-sign houses the AC belongs to House 1, while the MC can fall
        # in the 9th, 10th, or 11th house depending on latitude and season.
        angle_house = 1 if angle_obj["name"] == "AC" else ((int(mc // 30) - asc_sign_idx) % 12) + 1
        deg_str = f'{t_sign(angle_obj["sign"])} {angle_obj["deg"]}&#176;{angle_obj["min"]:02d}&#39;'
        svg += f'<text x="{abx:.0f}" y="{aby - 8:.0f}" font-size="22" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#222">{angle_obj["name"]}</text>'
        svg += f'<text x="{abx:.0f}" y="{aby + 8:.0f}" font-size="9" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#444">{deg_str}</text>'
        svg += f'<text x="{abx:.0f}" y="{aby + 18:.0f}" font-size="7" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#333">{house_abbr}{angle_house} &#183; {t_elem(angle_obj["element"])} &#183; {t_qual(angle_obj["quality"])}</text>'

    # ── Planet rows ──
    for row_idx, names in enumerate(row_configs):
        # Only count planets that actually exist in planet_map for width/centering
        present_names = [n for n in names if n in planet_map]
        n = len(present_names)
        bw = BOX_W  # all rows use 120px boxes now
        row_w = n * bw + max(0, n - 1) * BOX_GAP
        row_x_start = cx - row_w / 2
        box_y = BOXES_Y + row_idx * (BOX_H + BOX_GAP)
        for col_idx, pname in enumerate(present_names):
            p = planet_map[pname]
            house_num = planet_houses.get(pname, 0)
            box_x = row_x_start + col_idx * (bw + BOX_GAP)
            bx = box_x + bw / 2
            by = box_y + BOX_H / 2
            border_color = ELEMENT_COLORS[p["element"]]
            PASTEL = {"#d32f2f":"#f5d0d0","#2e7d32":"#d0e8d0","#fbc02d":"#f5ecd0","#1976d2":"#d0dcef"}
            box_fill = PASTEL.get(border_color, "#f8f8f8")
            svg += f'<rect x="{box_x:.0f}" y="{box_y:.0f}" width="{bw}" height="{BOX_H}" rx="3" fill="{box_fill}" stroke="{border_color}" stroke-width="1"/>'
            # Line 1: glyph + planet name (centered as a pair in the box)
            # Manually compute widths so the combined visual is centered (text-anchor="middle"
            # would shift the visual center right because the glyph is much wider than the name).
            # Tuned widths for DejaVu Sans rendering at this scale.
            glyph_w = 22  # visual width of one glyph character at font-size 22
            gap_w = 5     # gap between glyph and name
            # Use the translated name for width calc so the box centers properly
            # for both English (Sun) and Spanish (Mercurio, Júpiter, etc.)
            name_w = len(t_planet(p["name"])) * 6  # approximate width of name at font-size 9
            pair_w = glyph_w + gap_w + name_w
            pair_x = box_x + (bw - pair_w) / 2  # left edge of the pair
            glyph_x = pair_x + glyph_w / 2      # center of the glyph
            name_x = pair_x + glyph_w + gap_w   # left edge of the name (text-anchor=start)
            svg += f'<text x="{glyph_x:.0f}" y="{by - 8:.0f}" font-size="22" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#222">{p["glyph"]}</text>'
            svg += f'<text x="{name_x:.0f}" y="{by - 8:.0f}" font-size="9" text-anchor="start" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#222"><tspan font-weight="bold">{t_planet(p["name"])}</tspan></text>'
            # Line 2: sign (e.g., "Gemini" / "Géminis")
            svg += f'<text x="{box_x + bw/2:.0f}" y="{by + 6:.0f}" font-size="9" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#444">{t_sign(p["sign"])} {p["deg"]}&#176;{p["min"]:02d}&#39;</text>'
            # Line 3: house
            svg += f'<text x="{box_x + bw/2:.0f}" y="{by + 20:.0f}" font-size="7" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#333">{house_abbr}{house_num} &#183; {t_elem(p["element"])} &#183; {t_qual(p["quality"])}</text>'

    # ── Disclaimer at bottom of chart page (2 lines) — moved down 2 spaces
    disclaimer_y = BOXES_Y + 3 * (BOX_H + BOX_GAP) + 8 + 30
    if is_es:
        disclaimer_1 = "Esta carta es el mapa de coordenadas personales que usa el informe."
        disclaimer_2 = "Ubica esta carta dentro del marco más amplio del ciclo Zodiyuga SkyClock, no es una lectura natal completa."
    else:
        disclaimer_1 = "This chart is the personal coordinate map used by the report."
        disclaimer_2 = "It locates this chart inside the larger Zodiyuga SkyClock cycle framework, not a full natal reading."
    svg += f'<text x="{cx}" y="{disclaimer_y}" font-size="11" text-anchor="middle" font-family="DejaVu Sans, sans-serif" fill="#666">{disclaimer_1}</text>'
    svg += f'<text x="{cx}" y="{disclaimer_y + 15}" font-size="11" text-anchor="middle" font-family="DejaVu Sans, sans-serif" fill="#666">{disclaimer_2}</text>'

    svg += '</svg>'
    return svg

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate standalone natal chart page PDF")
    parser.add_argument("--year", type=int, default=1982)
    parser.add_argument("--month", type=int, default=5)
    parser.add_argument("--day", type=int, default=2)
    parser.add_argument("--hour", type=int, default=2)
    parser.add_argument("--min", type=int, default=16)
    parser.add_argument("--lat", type=float, default=30.22)
    parser.add_argument("--lon", type=float, default=-81.68)
    parser.add_argument("--name", default="")
    parser.add_argument("--location", default="NAS Jacksonville, Florida")
    parser.add_argument("--tz", default="EDT", choices=["EST","EDT","CST","CDT","MST","MDT","PST","PDT","HST","AKST"])
    parser.add_argument("--output", default="chart_page.pdf")
    args = parser.parse_args()

    tz_offsets = {"EST":5,"EDT":4,"CST":6,"CDT":5,"MST":7,"MDT":6,"PST":8,"PDT":7,"AKST":9,"HST":10}
    tz_offset = tz_offsets[args.tz]
    utc_hour_frac = (args.hour + tz_offset) + args.min / 60.0
    jd = swe.julday(args.year, args.month, args.day, utc_hour_frac)

    planets = get_planet_data(jd)
    cusps, ascmc = swe.houses(jd, args.lat, args.lon, b'W')
    asc = ascmc[0]
    mc = ascmc[1]

    print(f"Ascendant: {sign_from_lon(asc)} {asc % 30:.2f}° ({asc:.2f}°)")
    print(f"MC:         {sign_from_lon(mc)} {mc % 30:.2f}° ({mc:.2f}°)")
    print()
    for p in planets:
        print(f"  {p['name']:8s} {p['sign']:12s} {p['deg']:2d}°{p['min']:02d}'  ({p['lon_num']:.2f}°)")

    # Calculate Hellenistic rulers
    sun_lon = next(p["lon_num"] for p in planets if p["name"] == "Sun")
    moon_lon = next(p["lon_num"] for p in planets if p["name"] == "Moon")
    chart_ruler, master, predominator, is_day = calculate_hellenistic_rulers(planets, asc, sun_lon, moon_lon, jd_ut=jd, lat=args.lat, lon=args.lon)
    rulers = {"chart_ruler": chart_ruler, "master": master, "predominator": predominator, "is_day": is_day}
    print(f"\nChart Ruler (Kurios): {chart_ruler}")
    print(f"Master of Nativity (Oikodespotes): {master}")
    print(f"Predominator (Epikratetor): {predominator}")
    print(f"Sect: {'Day' if is_day else 'Night'}")

    # Birth info for header
    months = ["January","February","March","April","May","June","July","August","September","October","November","December"]
    birth_date = f"{months[args.month-1]} {args.day}, {args.year}"
    birth_time = f"{args.hour}:{args.min:02d} {args.tz}"
    birth_location = args.location

    # Build SVG → PDF directly (cairosvg, no PNG intermediate, no WeasyPrint)
    svg = build_wheel_svg(planets, asc, mc, args.name, birth_date, birth_time, birth_location, "Whole Houses", rulers, jd)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    outpath = os.path.join(OUTPUT_DIR, args.output)

    # Unitless SVG dimensions are 96-DPI CSS pixels. Scale by 96/72 so the
    # 612×792 viewBox becomes a true 612×792-point US Letter PDF page.
    cairosvg.svg2pdf(bytestring=svg.encode('utf-8'), write_to=outpath, scale=96 / 72)

    print(f"\nPDF: {outpath} ({os.path.getsize(outpath)//1024} KB)")

if __name__ == "__main__":
    main()
