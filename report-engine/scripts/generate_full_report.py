#!/usr/bin/env python3
"""Generate a full $19 Cosmic History Report as a proper multi-page PDF.

Usage:
    source ~/.hermes/hermes-agent/venv/bin/activate
    python3 scripts/generate_full_report.py --year 1982 --month 5 --day 2 --hour 2 --min 16 --tz EDT --lat 30.22 --lon -81.68 --location "NAS Jacksonville, Florida" --name "Cheryl K. Beggs"
"""

import os, sys, math, argparse, json, re, tempfile, base64
from html import escape as html_escape
from pathlib import Path
import swisseph as swe
from weasyprint import HTML
import cairosvg
import fitz  # PyMuPDF for PDF merging

# Import the standalone chart page generator
CHART_PAGE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CHART_PAGE_DIR)
from generate_chart_page import build_wheel_svg as build_chart_svg
from generate_chart_page import calculate_hellenistic_rulers
from generate_chart_page import PLANET_COLORS
import generate_snapshot_page as snapshot_gen

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(PROJECT, "report-engine", "output")
TEMPLATE_DIR = Path(os.path.join(PROJECT, "report-engine", "templates"))
ASSETS_DIR = os.path.join(PROJECT, "report-engine", "assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Swiss Ephemeris setup ───────────────────────────────────────────────────
EPHE_PATH = os.path.join(PROJECT, 'public', 'ephe')
swe.set_ephe_path(EPHE_PATH)

SWE_BODIES = {
    "Sun": swe.SUN, "Moon": swe.MOON,
    "Mercury": swe.MERCURY, "Venus": swe.VENUS, "Mars": swe.MARS,
    "Jupiter": swe.JUPITER, "Saturn": swe.SATURN,
    "Uranus": swe.URANUS, "Neptune": swe.NEPTUNE, "Pluto": swe.PLUTO,
    "N.Node": swe.MEAN_NODE,
}

GLYPHS = {"Sun":"☉","Moon":"☽","Mercury":"☿","Venus":"♀","Mars":"♂","Jupiter":"♃","Saturn":"♄","Uranus":"♅","Neptune":"♆","Pluto":"♇","N.Node":"☊"}
SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]
SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"]
ELEMENTS = {"Aries":"Fire","Taurus":"Earth","Gemini":"Air","Cancer":"Water","Leo":"Fire","Virgo":"Earth","Libra":"Air","Scorpio":"Water","Sagittarius":"Fire","Capricorn":"Earth","Aquarius":"Air","Pisces":"Water"}
QUALITIES = {"Aries":"Cardinal","Taurus":"Fixed","Gemini":"Mutable","Cancer":"Cardinal","Leo":"Fixed","Virgo":"Mutable","Libra":"Cardinal","Scorpio":"Fixed","Sagittarius":"Mutable","Capricorn":"Cardinal","Aquarius":"Fixed","Pisces":"Mutable"}

# Element colors (matching webapp astro-wheel.js)
ELEMENT_COLORS = {"Fire":"#d32f2f","Earth":"#2e7d32","Air":"#fbc02d","Water":"#1976d2"}

QUALITIES = {"Aries":"Cardinal","Taurus":"Fixed","Gemini":"Mutable","Cancer":"Cardinal","Leo":"Fixed","Virgo":"Mutable","Libra":"Cardinal","Scorpio":"Fixed","Sagittarius":"Mutable","Capricorn":"Cardinal","Aquarius":"Fixed","Pisces":"Mutable"}

ASPECT_GLYPHS = {"Conjunction":"☌","Sextile":"⚹","Square":"□","Trine":"△","Opposition":"☍"}

def aspect_glyph_html(aspect, color, size=17):
    """Render aspect marks as paths so PDF output never depends on font coverage."""
    glyph = snapshot_gen.aspect_glyph_svg(aspect, color, size)
    if not glyph:
        return html_escape(ASPECT_GLYPHS.get(aspect, ""))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 {size} {size}" aria-label="{html_escape(aspect)}" '
        f'style="display:inline-block;vertical-align:-3px;">{glyph}</svg>'
    )

# ── Saeculum data ───────────────────────────────────────────────────────────
# Boundaries are exact conjunction Julian Days — a birth moment before the
# conjunction belongs to the prior generation, after it belongs to the next.
SAECULUM_BOUNDARIES = [
    # (jd_boundary, saeculum_data)  — boundary = FIRST exact conjunction of the cycle
    (2425167.50, {"name":"Builder","archetype":"Prophet","conj_year":1928,"conj_sign":"Leo","conj_element":"Fire","turning":"Crisis"}),  # S/J conj 1928 Leo
    (2429849.56, {"name":"Boomer","archetype":"Prophet","conj_year":1940,"conj_sign":"Taurus","conj_element":"Earth","turning":"Crisis"}),  # S/J conj 1940 Taurus
    (2437349.50, {"name":"Gen X","archetype":"Nomad","conj_year":1961,"conj_sign":"Capricorn","conj_element":"Earth","turning":"High"}),  # S/J conj 1961 Capricorn
    (2444605.39, {"name":"Millennial","archetype":"Hero","conj_year":1981,"conj_sign":"Libra","conj_element":"Air","turning":"Awakening"}),  # S/J conj 1981 Libra
    (2451693.17, {"name":"Gen Z","archetype":"Artist","conj_year":2000,"conj_sign":"Taurus","conj_element":"Earth","turning":"Unraveling"}),  # S/J conj 2000 Taurus
    (2459205.26, {"name":"Gen Alpha","archetype":"Prophet_GenAlpha","conj_year":2020,"conj_sign":"Aquarius","conj_element":"Air","turning":"Crisis"}),  # S/J conj 2020 Aquarius
    # Pre-1928 generations (Greatest 1901, Missionary 1820, Lost 1840, Gilded 1860, Progressive 1880)
    # are not modeled — too far back to be useful for current recipients.
]

# ── Load planet interpretations ─────────────────────────────────────────────
INTERPRETATIONS = {}
interp_path = os.path.normpath(os.path.join(PROJECT, "report-engine", "templates", "planet-sign-interpretations.json"))
if os.path.exists(interp_path):
    with open(interp_path, 'r', encoding='utf-8') as f:
        INTERPRETATIONS = json.load(f)

# ── Helpers ─────────────────────────────────────────────────────────────────

def sign_from_lon(lon):
    return SIGNS[int(lon % 360) // 30]

def degree_in_sign(lon):
    return (lon % 360) % 30


def build_generational_screw_svg(recipient_name, birth_year, birth_date="", birth_time="",
                                  birth_location="", display_year=2026, display_date="", lang="en"):
    """Build a print-native cohort screw from 1940 through the report year."""
    width, height = 1000, 356
    left, right = 0, 960
    plot_top, plot_bottom = 48, 238
    phase_height = (plot_bottom - plot_top) / 4.0
    timeline_start = 1940
    timeline_end = 2040
    now_year = max(2020, min(int(display_year), timeline_end))
    def year_x_raw(value):
        return left + (value - timeline_start) / (timeline_end - timeline_start) * (right - left)

    def year_x(value):
        return year_x_raw(value)

    now_x = year_x(now_year)

    # Match SkyCLAWk's canonical screw: each conjunction boundary rises from
    # the lower axis to the top exactly four conjunctions later.
    boundary_top_years = {
        1861: 1940, 1881: 1961, 1901: 1981, 1921: 2000,
        1940: 2020, 1961: 2040, 1981: 2060, 2000: 2080,
        2020: 2100, 2040: 2120,
    }

    def life_y_at_screen(screen_x, birth_boundary):
        start_x = year_x_raw(birth_boundary)
        top_x = year_x_raw(boundary_top_years[birth_boundary])
        denominator = top_x - start_x
        if abs(denominator) < 0.001:
            return plot_top
        progress = (screen_x - start_x) / denominator
        return plot_bottom + (plot_top - plot_bottom) * progress

    def life_y(at_year, birth_boundary):
        return life_y_at_screen(year_x_raw(at_year), birth_boundary)

    is_es = lang == "es"
    events = [
        (1940, "Taurus", "Earth", "Crisis"),
        (1961, "Capricorn", "Earth", "High"),
        (1981, "Libra", "Air", "Awakening"),
        (2000, "Taurus", "Earth", "Unraveling"),
        (2020, "Aquarius", "Air", "Crisis"),
        (2040, "Libra", "Air", "High"),
    ]
    cohorts = [
        (1861, 1881, "Missionary", "#efd0d0"),
        (1881, 1901, "Lost", "#cfe4cf"),
        (1901, 1921, "G.I.", "#e3d8a6"),
        (1921, 1940, "Silent", "#cad8ea"),
        (1940, 1961, "Boomer", "#efd0d0"),
        (1961, 1981, "Gen X", "#cfe4cf"),
        (1981, 2000, "Millennial", "#e3d8a6"),
        (2000, 2020, "Gen Z", "#cad8ea"),
        (2020, 2040, "Gen Alpha", "#efd0d0"),
    ]
    stages = (
        [("Nómada", "Mayor"), ("Héroe", "Mediana edad"),
         ("Artista", "Adulto joven"), ("Profeta", "Infancia")]
        if is_es else
        [("Nomad", "Elder"), ("Hero", "Midlife"),
         ("Artist", "Young Adult"), ("Prophet", "Childhood")]
    )
    if is_es:
        sign_names = {"Taurus": "Tauro", "Capricorn": "Capricornio", "Libra": "Libra", "Aquarius": "Acuario"}
        element_names = {"Earth": "Tierra", "Air": "Aire"}
        turning_names = {"Crisis": "Crisis", "High": "Alto", "Awakening": "Despertar", "Unraveling": "Desenredo"}
        born_word = "NACIMIENTO"
        wave_label = "SAECULUM"
        wave_title = "SAECULUM · UN CICLO DE 80 AÑOS"
    else:
        sign_names = {}
        element_names = {}
        turning_names = {}
        born_word = "BORN"
        wave_label = "SAECULUM"
        wave_title = "SAECULUM · ONE 80-YEAR CYCLE"

    # Each cohort is the region between two parallel lifetime trajectories.
    # One 20-year horizontal span rises exactly one archetypal life-stage row.
    diagonal_parts = []
    for start, end, label, color in cohorts:
        y_ls = life_y_at_screen(left, start)
        y_le = life_y_at_screen(left, end)
        y_rs = life_y_at_screen(right, start)
        y_re = life_y_at_screen(right, end)
        diagonal_parts.append(
            f'<polygon points="{left},{y_ls:.1f} {left},{y_le:.1f} '
            f'{right},{y_re:.1f} {right},{y_rs:.1f}" '
            f'fill="{color}" fill-opacity="0.90" stroke="#ffffff" stroke-width="3"/>'
        )

    grid_parts = []
    event_parts = []
    visible_events = [event for event in events if event[0] <= timeline_end]
    def sign_icon(cx, cy, sign, element):
        # True DejaVu Sans zodiac outlines, embedded as paths so PDF rendering
        # never substitutes or drops the astrological characters.
        zodiac_paths = {
            "Taurus": ("M917 860Q770 860 667 756.5Q564 653 564 506Q564 359 667 256Q770 153 917 153Q1064 153 1167.5 256Q1271 359 1271 506Q1271 653 1168.5 756.5Q1066 860 917 860ZM917 1010Q1048 1015 1124 1076Q1210 1142 1258.5 1232Q1307 1322 1387.5 1409Q1468 1496 1653 1496V1388Q1530 1388 1446.5 1232Q1363 1076 1232 968Q1211 949 1188 934Q1234 904 1277 863Q1423 714 1423 504Q1423 295 1275.5 147.5Q1128 0 917 0Q709 0 561 147.5Q413 295 413 504Q413 714 561 863Q602 905 650 935Q626 949 605 968Q476 1076 390.5 1232Q305 1388 183 1388V1496Q368 1496 461 1409Q554 1322 590 1232Q626 1142 711 1076Q788 1015 917 1010Z", (183, 0, 1653, 1496)),
            "Capricorn": ("M851 1496Q958 1496 998.5 1063Q1039 630 1064 634Q1173 855 1368 855Q1489 855 1565.5 760Q1642 665 1642 562Q1642 417 1570.5 331.5Q1499 246 1357 246Q1202 246 1080 379Q1036 219 973 111.5Q910 4 772 0H604V118L758 119Q880 123 985 499Q935 515 903 909.5Q871 1304 813 1304Q777 1304 700 1070.5Q623 837 623 642V613L465 611Q465 864 394.5 1112Q324 1360 192 1366V1463Q339 1463 419.5 1352Q500 1241 540 966Q586 1167 631 1255Q672 1346 733 1421Q794 1496 851 1496ZM1137 510Q1230 365 1360 365Q1521 365 1530 562Q1523 719 1364 738Q1212 738 1137 510Z", (192, 0, 1642, 1496)),
            "Libra": ("M171 259H1665V107H171ZM728 506H171V658H525Q458 762 458 893Q458 1078 586.5 1207.5Q715 1337 900 1337Q1086 1337 1215.5 1207.5Q1345 1078 1345 893Q1345 762 1277 658H1665V506H1072V658H1071Q1089 671 1106 688Q1192 773 1192 894Q1192 1016 1107 1101Q1022 1186 900 1186Q778 1186 693 1101Q608 1016 608 894Q608 773 693 688Q709 671 728 658Z", (171, 107, 1665, 1337)),
            "Aquarius": ("M176 413Q501 684 616 684Q661 684 674 644Q698 573 754 573Q810 573 896 644Q982 715 1038 715Q1092 715 1116 644Q1142 573 1199 573Q1256 573 1342 644Q1385 680 1426 680Q1550 680 1659 364L1565 313Q1502 498 1407 498Q1356 498 1296 445Q1210 369 1154 369Q1098 369 1073 444Q1045 522 986 522Q931 522 848 455Q761 384 706 384Q650 384 625 456Q601 526 547 526Q492 526 363 419.5Q234 313 229 313L176 411ZM176 884Q500 1153 616 1153Q660 1153 674 1114Q698 1044 754 1044Q809 1044 895 1114Q982 1186 1037 1186Q1092 1186 1115 1114Q1142 1044 1198 1044Q1255 1044 1341 1114Q1384 1149 1425 1149Q1550 1149 1659 834L1565 784Q1502 969 1407 969Q1356 969 1296 915Q1209 838 1154 838Q1098 838 1072 914Q1045 992 986 992Q931 992 847 924Q761 853 705 853Q650 853 625 925Q601 997 546 997Q491 997 362.5 890.5Q234 784 229 784L176 881Z", (176, 313, 1659, 1186)),
        }
        path, (x_min, y_min, x_max, y_max) = zodiac_paths[sign]
        glyph_scale = 18.0 / max(x_max - x_min, y_max - y_min)
        mid_x, mid_y = (x_min + x_max) / 2.0, (y_min + y_max) / 2.0
        glyph_color = "#4f8060" if element == "Earth" else "#b18424"
        return (
            f'<path d="{path}" fill="{glyph_color}" transform="translate({cx},{cy}) '
            f'scale({glyph_scale:.7f},{-glyph_scale:.7f}) translate({-mid_x:.1f},{-mid_y:.1f})"/>'
        )

    def element_icon(cx, cy, element):
        size = 7.2
        color = "#4f8060" if element == "Earth" else "#b18424"
        if element == "Earth":
            points = f"{cx-size},{cy-size+1} {cx+size},{cy-size+1} {cx},{cy+size}"
            bar_y = cy - 1.2
        else:
            points = f"{cx},{cy-size} {cx-size},{cy+size-1} {cx+size},{cy+size-1}"
            bar_y = cy + 1.2
        return (
            f'<polygon points="{points}" fill="none" stroke="{color}" stroke-width="1.8"/>'
            f'<line x1="{cx-4.8}" y1="{bar_y}" x2="{cx+4.8}" y2="{bar_y}" stroke="{color}" stroke-width="1.6"/>'
        )

    for index, (event_year, sign, element, _turning) in enumerate(visible_events):
        x = year_x(event_year)
        if index == 0:
            anchor, text_x, glyph_center = "start", x + 2, x + 24
        elif index == len(visible_events) - 1:
            anchor, text_x, glyph_center = "end", x - 2, x - 24
        else:
            anchor, text_x, glyph_center = "middle", x, x
        grid_parts.append(
            f'<line x1="{x:.1f}" y1="{plot_top}" x2="{x:.1f}" y2="264" '
            f'stroke="#53687a" stroke-width="1" stroke-opacity="0.48"/>'
        )
        event_parts.append(
            f'<text x="{text_x:.1f}" y="15" text-anchor="{anchor}" class="event-year">{event_year}</text>'
            f'{sign_icon(glyph_center - 12, 34, sign, element)}'
            f'{element_icon(glyph_center + 12, 34, element)}'
        )

    cohort_parts = []
    for start, end, label, color in cohorts:
        if start < 1940:
            continue
        if start > timeline_end:
            continue
        x1, x2 = year_x(start), year_x(end)
        cohort_parts.append(
            f'<rect x="{x1:.1f}" y="238" width="{x2 - x1:.1f}" height="26" fill="{color}" fill-opacity="0.35"/>'
            f'<text x="{(x1 + x2) / 2:.1f}" y="256" text-anchor="middle" class="cohort">{label}</text>'
        )

    # Scroll and wrap archetypes exactly as the SkyCLAWk label panel does.
    cohort_archetypes = {
        "Missionary": "Prophet", "Lost": "Nomad", "G.I.": "Hero", "Silent": "Artist",
        "Boomer": "Prophet", "Gen X": "Nomad", "Millennial": "Hero",
        "Gen Z": "Artist", "Gen Alpha": "Prophet",
    }
    stage_parts = []
    stage_label_parts = []
    stage_gradient_parts = []
    panel_x = now_x
    # The SVG has a 40-unit print margin beyond the screw. Use most of it for
    # the life-stage lane, where Spanish labels in particular need more room.
    panel_right = width - 8
    stage_split_x = panel_x + (panel_right - panel_x) * .55
    for start, end, label, color in cohorts:
        if not (start <= now_year <= boundary_top_years[end]):
            continue
        y0 = life_y(now_year, start)
        y1 = life_y(now_year, end)
        row_top = max(plot_top, min(y0, y1))
        row_bottom = min(plot_bottom, max(y0, y1))
        row_height = row_bottom - row_top
        if row_height <= 0:
            continue
        archetype = cohort_archetypes[label]
        if is_es:
            archetype = {"Prophet": "Profeta", "Nomad": "Nómada", "Hero": "Héroe", "Artist": "Artista"}.get(archetype, archetype)
        gradient_id = f"archetype-{start}"
        stage_gradient_parts.append(
            f'<linearGradient id="{gradient_id}" x1="0" y1="0" x2="1" y2="0">'
            f'<stop offset="0%" stop-color="{color}" stop-opacity="0.78"/>'
            f'<stop offset="54%" stop-color="{color}" stop-opacity="0.52"/>'
            f'<stop offset="72%" stop-color="#fffdf8" stop-opacity="0.88"/>'
            f'<stop offset="100%" stop-color="#fffdf8"/>'
            f'</linearGradient>'
        )
        show_archetype = row_height >= 13 and not (label == "Gen Alpha" and row_bottom >= plot_bottom - .1)
        stage_parts.append(
            f'<rect x="{panel_x:.1f}" y="{row_top:.1f}" width="{panel_right-panel_x:.1f}" height="{row_height:.1f}" fill="#fffdf8"/>'
            f'<rect x="{panel_x:.1f}" y="{row_top:.1f}" width="{panel_right-panel_x:.1f}" height="{row_height:.1f}" fill="url(#{gradient_id})"/>'
            f'<line x1="{panel_x:.1f}" y1="{row_top:.1f}" x2="{stage_split_x:.1f}" y2="{row_top:.1f}" stroke="#aab6bf" stroke-width="1"/>'
        )
        if show_archetype:
            stage_label_parts.append(
                f'<text x="{panel_x + 10:.1f}" y="{row_top + row_height * .64:.1f}" '
                f'class="stage-name">{archetype}</text>'
            )

    # Age lanes remain fixed while the archetypes scroll behind them.
    age_lane_parts = []
    age_labels = (
        [("Vejez", "60–80"), ("Mediana edad", "40–60"),
         ("Adulto joven", "20–40"), ("Infancia", "0–20")]
        if is_es else
        [("Elder", "60–80"), ("Midlife", "40–60"),
         ("Young Adult", "20–40"), ("Childhood", "0–20")]
    )
    for index, (life_stage, age_range) in enumerate(age_labels):
        y = plot_top + index * phase_height
        age_lane_parts.append(
            f'<line x1="{stage_split_x:.1f}" y1="{y:.1f}" x2="{panel_right:.1f}" y2="{y:.1f}" stroke="#aab6bf" stroke-width="1"/>'
            f'<text x="{panel_right - 8:.1f}" y="{y + phase_height * .40:.1f}" text-anchor="end" class="stage-age">{life_stage}</text>'
            f'<text x="{panel_right - 8:.1f}" y="{y + phase_height * .70:.1f}" text-anchor="end" class="stage-range">{age_range}</text>'
        )
    age_lane_parts.append(
        f'<line x1="{stage_split_x:.1f}" y1="{plot_bottom}" x2="{panel_right:.1f}" y2="{plot_bottom}" stroke="#aab6bf" stroke-width="1"/>'
    )
    stage_boundaries = [plot_top, plot_bottom]

    # The recipient follows an individual diagonal trajectory inside their cohort.
    birth_x = year_x(birth_year)
    natal_boundaries = [1940, 1961, 1981, 2000, 2020, 2040]
    natal_start, natal_end = natal_boundaries[0], natal_boundaries[1]
    for candidate_start, candidate_end in zip(natal_boundaries, natal_boundaries[1:]):
        if candidate_start <= birth_year <= candidate_end:
            natal_start, natal_end = candidate_start, candidate_end
            break
    natal_fraction = max(0.0, min(1.0, (birth_year - natal_start) / (natal_end - natal_start)))
    birth_end_y = life_y(now_year, natal_start) + natal_fraction * (
        life_y(now_year, natal_end) - life_y(now_year, natal_start)
    )
    full_name = html_escape((recipient_name.strip() or ("TÚ" if is_es else "You")).upper())
    natal_line = html_escape(" · ".join(part for part in (birth_date, birth_time, birth_location) if part))
    line_dx = now_x - birth_x
    line_dy = birth_end_y - plot_bottom
    age_tick_parts = []
    age_word = "EDAD" if is_es else "AGE"
    if abs(line_dx) > .001:
        for event_year, _sign, _element, _turning in visible_events:
            if not (birth_year < event_year <= now_year):
                continue
            tick_x = year_x(event_year)
            progress = (tick_x - birth_x) / line_dx
            tick_y = plot_bottom + line_dy * progress
            age_at_conjunction = event_year - birth_year
            age_tick_parts.append(
                f'<line x1="{tick_x-7:.1f}" y1="{tick_y:.1f}" x2="{tick_x+7:.1f}" y2="{tick_y:.1f}" '
                f'stroke="#b7443e" stroke-width="3"/>'
                f'<rect x="{tick_x-52:.1f}" y="{tick_y-17:.1f}" width="45" height="14" rx="2" '
                f'fill="#ffffff" fill-opacity="0.86"/>'
                f'<text x="{tick_x-49:.1f}" y="{tick_y-5:.1f}" class="age-tick">'
                f'{age_word} {age_at_conjunction}</text>'
            )
    natal_when = html_escape(" · ".join(part for part in (birth_date, birth_time) if part))
    natal_where = html_escape(birth_location)
    current_date_label = html_escape((display_date or str(now_year)).upper())
    legend_width = min(370, max(
        240,
        len(current_date_label) * 9.0 + 28,
        len(full_name) * 9.0 + 28,
        len(natal_when) * 7.1 + 28,
        len(natal_where) * 7.1 + 28,
    ))

    # Exact seasonal 80-year sine wave: Crisis/Winter is the trough, High/Spring
    # the rising midpoint, Awakening/Summer the crest, and Unraveling/Autumn
    # the falling midpoint.
    wave_colors = ["#b7443e", "#4f8060", "#a8842f", "#416f91", "#b7443e"]
    wave_parts = []
    wave_label_parts = []
    # Exact 20-year quarters make the 80-year saeculum visually legible even
    # though the dated conjunction markers above retain their precise years.
    wave_breaks = [1940, 1960, 1980, 2000, 2020, timeline_end]
    wave_breaks = sorted(set(year for year in wave_breaks if year <= timeline_end))

    def wave_y(value):
        return 292 + 19 * math.cos(2 * math.pi * (value - 1940) / 80.0)

    for index in range(len(wave_breaks) - 1):
        start_year, end_year = wave_breaks[index], wave_breaks[index + 1]
        sample_count = max(4, int((end_year - start_year) * 2))
        samples = [start_year + (end_year - start_year) * n / sample_count for n in range(sample_count + 1)]
        path = " ".join(
            ("M" if n == 0 else "L") + f" {year_x(sample_year):.1f},{wave_y(sample_year):.2f}"
            for n, sample_year in enumerate(samples)
        )
        color = wave_colors[index]
        wave_parts.append(
            f'<path d="{path}" fill="none" stroke="{color}" stroke-width="3"/>'
        )
        phase = turning_names.get(events[index][3], events[index][3]).upper()
        phase_y = wave_y((start_year + end_year) / 2) + (14 if index in (1, 2) else -12)
        wave_label_parts.append(
            f'<text x="{year_x((start_year+end_year)/2):.1f}" y="{phase_y:.1f}" text-anchor="middle" '
            f'class="wave-phase" fill="{color}">{phase}</text>'
        )

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="Generational screw and saeculum wave from 1940 to 2040">
<style>
  text {{ font-family: "DejaVu Sans", Arial, sans-serif; fill:#203b55; }}
  .cohort {{ font-size:14px; font-weight:700; }}
  .event-year {{ font-size:15px; font-weight:700; }}
  .sign-glyph {{ font-family:"DejaVu Sans", sans-serif; font-size:18px; font-weight:400; fill:#203b55; }}
  .now-label {{ font-size:9px; font-weight:700; letter-spacing:1px; fill:#203b55; }}
  .stage-name {{ font-size:15px; font-weight:700; }}
  .stage-age {{ font-size:7.5px; font-weight:700; fill:#66727d; }}
  .stage-range {{ font-size:8px; fill:#66727d; }}
  .age-tick {{ font-size:9px; font-weight:700; fill:#b7443e; }}
  .wave-title {{ font-size:11px; font-weight:800; letter-spacing:1.2px; fill:#203b55; }}
  .wave-phase {{ font-size:9px; font-weight:700; letter-spacing:1px; }}
</style>
<defs>
  <clipPath id="screw-clip"><rect x="{left}" y="{plot_top}" width="{right-left}" height="{plot_bottom-plot_top}"/></clipPath>
  {''.join(stage_gradient_parts)}
</defs>
<rect width="1000" height="{height}" fill="#ffffff"/>
<g clip-path="url(#screw-clip)">
  <rect x="{left}" y="{plot_top}" width="{right-left}" height="{plot_bottom-plot_top}" fill="#f8f7f3"/>
  {''.join(diagonal_parts)}
</g>
<rect x="{left}" y="{plot_top}" width="{right-left}" height="{plot_bottom-plot_top}" fill="none" stroke="#8fa0ad" stroke-width="1.2"/>
{''.join(grid_parts)}
{''.join(stage_parts)}
{''.join(age_lane_parts)}
<rect x="{panel_x:.1f}" y="{stage_boundaries[0]:.1f}" width="{panel_right-panel_x:.1f}" height="{stage_boundaries[-1]-stage_boundaries[0]:.1f}" fill="none" stroke="#8fa0ad" stroke-width="1.2"/>
<g clip-path="url(#screw-clip)">
  <line x1="{birth_x:.1f}" y1="{plot_bottom}" x2="{now_x:.1f}" y2="{birth_end_y:.1f}" stroke="#b7443e" stroke-width="3.5"/>
  {''.join(age_tick_parts)}
</g>
{''.join(stage_label_parts)}
{''.join(cohort_parts)}
<rect x="{left}" y="238" width="{right-left}" height="26" fill="none" stroke="#aab6bf" stroke-width="1"/>
<g>
  <rect x="{left+10}" y="{plot_top+10}" width="{legend_width:.1f}" height="108" rx="4" fill="#ffffff" fill-opacity="0.94" stroke="#aab6bf" stroke-width="1"/>
  <text x="{left+22}" y="{plot_top+30}" style="font-size:12pt;font-weight:700;fill:#203b55;">{current_date_label}</text>
  <text x="{left+22}" y="{plot_top+51}" style="font-size:12pt;font-weight:700;letter-spacing:.5px;fill:#203b55;">{full_name}</text>
  <text x="{left+22}" y="{plot_top+70}" style="font-size:11pt;fill:#203b55;">{natal_when}</text>
  <text x="{left+22}" y="{plot_top+88}" style="font-size:11pt;fill:#203b55;">{natal_where}</text>
  <line x1="{left+22}" y1="{plot_top+101}" x2="{left+58}" y2="{plot_top+101}" stroke="#b7443e" stroke-width="4"/>
  <text x="{left+68}" y="{plot_top+105}" style="font-size:10pt;font-weight:700;fill:#b7443e;">{"TU LÍNEA DE VIDA" if is_es else "YOUR LIFELINE"}</text>
</g>
{''.join(event_parts)}
{''.join(wave_parts)}
{''.join(wave_label_parts)}
<path d="M {year_x(1940):.1f},318 v 7 H {year_x(2020):.1f} v -7" fill="none" stroke="#203b55" stroke-width="1.5"/>
<text x="{(year_x(1940)+year_x(2020))/2:.1f}" y="344" text-anchor="middle" class="wave-title">{wave_title}</text>
</svg>'''

def get_saeculum(jd):
    """Determine saeculum from birth Julian Day. The conjunction is a precise
    moment — a birth before it belongs to the prior generation, after it to
    the next."""
    current = {"name":"Unknown","archetype":"","conj_year":0,"conj_sign":"","conj_element":"","turning":""}
    for jd_boundary, data in SAECULUM_BOUNDARIES:
        if jd < jd_boundary:
            return current
        current = data
    return current

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
            "element": ELEMENTS[sign],
            "quality": QUALITIES[sign],
            "interpretation": INTERPRETATIONS.get(name, {}).get(sign, ""),
        })
    return results

def get_aspects(planets):
    aspects = []
    # N.Node is not aspected in traditional practice
    aspect_planets = [p for p in planets if p["name"] != "N.Node"]
    aspect_targets = {"Conjunction":0,"Sextile":60,"Square":90,"Trine":120,"Opposition":180}
    for i, p1 in enumerate(aspect_planets):
        for j, p2 in enumerate(aspect_planets):
            if j <= i: continue
            d = abs(p1["lon_num"] - p2["lon_num"])
            if d > 180: d = 360 - d
            for name, target in aspect_targets.items():
                orb = abs(d - target)
                if orb <= 6:
                    glyph = ASPECT_GLYPHS.get(name, "")
                    meaning = {"Conjunction":"Fusion, intensity, combined energy","Sextile":"Opportunity, flow, natural talent","Square":"Tension, challenge, growth through friction","Trine":"Harmony, ease, natural gift","Opposition":"Polarity, balance, relationship dynamic"}[name]
                    aspects.append((p1,p2,d,name,orb,target,meaning,glyph))
    aspects.sort(key=lambda x: x[4])
    return aspects

def parse_snippet(text):
    blocks = {}
    current_key = None
    current_content = []
    for line in text.strip().split('\n'):
        if line.startswith('[') and line.endswith(']') and line.count('[') == 1:
            if current_key:
                blocks[current_key] = '\n'.join(current_content).strip()
            current_key = line[1:-1]
            current_content = []
        else:
            current_content.append(line)
    if current_key:
        blocks[current_key] = '\n'.join(current_content).strip()
    return blocks

def find_saturn_returns(natal_saturn_lon, natal_jd, swe):
    """Find the first and second Saturn returns (when transiting Saturn
    returns to natal longitude). Returns list of (jd, year) tuples."""
    returns = []
    saturn_period = 29.457  # years
    # Search around first return (~29.5 years) and second (~59 years)
    for target_years in [saturn_period, saturn_period * 2]:
        # Search a 2-year window around the expected return
        jd_start = natal_jd + (target_years - 1.0) * 365.25
        jd_end = natal_jd + (target_years + 1.0) * 365.25
        # Step by 10 days initially, then refine
        step = 10.0
        best_jd = None
        best_diff = float('inf')
        jd = jd_start
        while jd < jd_end:
            res, _ = swe.calc_ut(jd, swe.SATURN, swe.FLG_SWIEPH)
            trans_lon = res[0] % 360
            diff = abs(trans_lon - natal_saturn_lon)
            if diff > 180:
                diff = 360 - diff
            if diff < best_diff:
                best_diff = diff
                best_jd = jd
            jd += step
        # Refine around best_jd with finer step
        if best_jd:
            jd = best_jd - 30
            best_diff = float('inf')
            while jd < best_jd + 30:
                res, _ = swe.calc_ut(jd, swe.SATURN, swe.FLG_SWIEPH)
                trans_lon = res[0] % 360
                diff = abs(trans_lon - natal_saturn_lon)
                if diff > 180:
                    diff = 360 - diff
                if diff < best_diff:
                    best_diff = diff
                    best_jd = jd
                jd += 1.0
        if best_jd and best_diff < 2.0:  # within 2 degrees
            year = swe.revjul(best_jd)[0]
            returns.append((best_jd, year))
    return returns


def find_uranus_opposition(natal_uranus_lon, natal_jd, swe):
    """Find the Uranus opposition (when transiting Uranus opposes natal
    Uranus, ~age 42). Returns (jd, year) or None."""
    target_years = 42.0  # ~half of Uranus 84-year cycle
    jd_start = natal_jd + (target_years - 1.5) * 365.25
    jd_end = natal_jd + (target_years + 1.5) * 365.25
    target_lon = (natal_uranus_lon + 180) % 360
    step = 10.0
    best_jd = None
    best_diff = float('inf')
    jd = jd_start
    while jd < jd_end:
        res, _ = swe.calc_ut(jd, swe.URANUS, swe.FLG_SWIEPH)
        trans_lon = res[0] % 360
        diff = abs(trans_lon - target_lon)
        if diff > 180:
            diff = 360 - diff
        if diff < best_diff:
            best_diff = diff
            best_jd = jd
        jd += step
    # Refine
    if best_jd:
        jd = best_jd - 30
        best_diff = float('inf')
        while jd < best_jd + 30:
            res, _ = swe.calc_ut(jd, swe.URANUS, swe.FLG_SWIEPH)
            trans_lon = res[0] % 360
            diff = abs(trans_lon - target_lon)
            if diff > 180:
                diff = 360 - diff
            if diff < best_diff:
                best_diff = diff
                best_jd = jd
            jd += 1.0
    if best_jd and best_diff < 3.0:
        year = swe.revjul(best_jd)[0]
        return (best_jd, year)
    return None


def find_saturn_neptune_conjunction(natal_jd, swe, start_year_offset=20, search_years=60):
    """Find the next Saturn-Neptune conjunction after birth within the
    search window. Returns (jd, year, sign) or None."""
    jd_start = natal_jd + start_year_offset * 365.25
    jd_end = natal_jd + (start_year_offset + search_years) * 365.25
    step = 7.0  # Saturn-Neptune conjunctions are slow
    best_jd = None
    best_diff = float('inf')
    jd = jd_start
    while jd < jd_end:
        res_s, _ = swe.calc_ut(jd, swe.SATURN, swe.FLG_SWIEPH)
        res_n, _ = swe.calc_ut(jd, swe.NEPTUNE, swe.FLG_SWIEPH)
        s_lon = res_s[0] % 360
        n_lon = res_n[0] % 360
        diff = abs(s_lon - n_lon)
        if diff > 180:
            diff = 360 - diff
        if diff < best_diff:
            best_diff = diff
            best_jd = jd
        jd += step
    # Refine
    if best_jd:
        jd = best_jd - 30
        best_diff = float('inf')
        while jd < best_jd + 30:
            res_s, _ = swe.calc_ut(jd, swe.SATURN, swe.FLG_SWIEPH)
            res_n, _ = swe.calc_ut(jd, swe.NEPTUNE, swe.FLG_SWIEPH)
            s_lon = res_s[0] % 360
            n_lon = res_n[0] % 360
            diff = abs(s_lon - n_lon)
            if diff > 180:
                diff = 360 - diff
            if diff < best_diff:
                best_diff = diff
                best_jd = jd
            jd += 1.0
    if best_jd and best_diff < 2.0:
        year = swe.revjul(best_jd)[0]
        res_s, _ = swe.calc_ut(best_jd, swe.SATURN, swe.FLG_SWIEPH)
        sign_idx = int(res_s[0] % 360) // 30
        sign = SIGNS[sign_idx]
        return (best_jd, year, sign)
    return None


MOON_SIGN_INTERPRETATIONS = {
    "Aries": "emotional immediacy, courage, and a need for honest confrontation",
    "Taurus": "emotional steadiness, sensory grounding, and a need for tangible security",
    "Gemini": "emotional processing through language, curiosity, and varied connections",
    "Cancer": "emotional depth, protective nurturing, and a need for belonging",
    "Leo": "emotional warmth, creative self-expression, and a need for recognition",
    "Virgo": "emotional order, practical care, and a need to be useful",
    "Libra": "emotional balance, relational harmony, and a need for partnership",
    "Scorpio": "emotional intensity, transformative depth, and a need for truth",
    "Sagittarius": "emotional freedom, philosophical searching, and a need for meaning",
    "Capricorn": "emotional self-reliance, structural integrity, and a need for competence",
    "Aquarius": "emotional objectivity, community awareness, and a need for freedom",
    "Pisces": "emotional sensitivity, compassionate absorption, and a need for transcendence",
}


ASC_SIGN_INTERPRETATIONS = {
    "Aries": "a pioneering, direct, and action-oriented approach to life. You meet the world head-first, with courage and initiative, and your first instinct is to lead rather than follow",
    "Taurus": "a steady, grounded, and sensory approach to life. You meet the world through patience and presence, building security through tangible results and unwavering endurance",
    "Gemini": "a curious, communicative, and adaptable approach to life. You meet the world through language and connection, gathering information and translating across multiple perspectives",
    "Cancer": "a protective, emotional, and nurturing approach to life. You meet the world through care and belonging, creating safe containers for yourself and those within your sphere",
    "Leo": "a warm, expressive, and creative approach to life. You meet the world with confidence and natural authority, shining through creative self-expression and generous leadership",
    "Virgo": "a precise, analytical, and service-oriented approach to life. You meet the world through skill and discernment, locating the hidden flaw and bringing systematic order to chaos",
    "Libra": "a balanced, relational, and aesthetic approach to life. You meet the world through partnership and harmony, mediating opposing forces and designing fair exchanges",
    "Scorpio": "an intense, strategic, and transformative approach to life. You meet the world through depth and probing intelligence, uncovering what is hidden and wielding power with precision",
    "Sagittarius": "an expansive, philosophical, and freedom-seeking approach to life. You meet the world through exploration and meaning-making, pursuing truth across vast horizons",
    "Capricorn": "a disciplined, structural, and ambitious approach to life. You meet the world through responsibility and long-range planning, building enduring systems through patient mastery",
    "Aquarius": "an independent, innovative, and community-minded approach to life. You meet the world through principled detachment and forward-thinking, reforming systems for collective benefit",
    "Pisces": "a sensitive, imaginative, and boundary-dissolving approach to life. You meet the world through empathy and creative surrender, attuning to currents that others cannot perceive",
}

# Spanish versions of the ASC interpretations — keep the same meaning
# but phrased in a voice that flows naturally in Spanish, using the
# informal "tu" pronoun to match the rest of the report.
ASC_SIGN_INTERPRETATIONS_ES = {
    "Aries": "un enfoque pionero, directo y orientado a la acción. Enfrentas el mundo de frente, con coraje e iniciativa, y tu primer instinto es liderar en vez de seguir",
    "Taurus": "un enfoque estable, conectado y sensorial de la vida. Conoces el mundo a través de la paciencia y la presencia, construyendo seguridad con resultados tangibles y resistencia inquebrantable",
    "Gemini": "un enfoque curioso, comunicativo y adaptable. Conoces el mundo a través del lenguaje y la conexión, reuniendo información y traduciendo entre múltiples perspectivas",
    "Cancer": "un enfoque protector, emocional y nutriente. Conoces el mundo a través del cuidado y el sentido de pertenencia, creando contenedores seguros para ti y para quienes te rodean",
    "Leo": "un enfoque cálido, expresivo y creativo. Conoces el mundo con confianza y autoridad natural, brillando a través de la autoexpresión creativa y el liderazgo generoso",
    "Virgo": "un enfoque preciso, analítico y orientado al servicio. Conoces el mundo a través de la habilidad y el discernimiento, ubicando la falla oculta y llevando orden sistemático al caos",
    "Libra": "un enfoque equilibrado, relacional y estético. Conoces el mundo a través de la alianza y la armonía, mediando fuerzas opuestas y diseñando intercambios justos",
    "Scorpio": "un enfoque intenso, estratégico y transformador. Conoces el mundo a través de la profundidad y la inteligencia investigadora, descubriendo lo oculto y ejerciendo el poder con precisión",
    "Sagittarius": "un enfoque expansivo, filosófico y buscador de libertad. Conoces el mundo a través de la exploración y la construcción de sentido, persiguiendo la verdad a lo largo de horizontes vastos",
    "Capricorn": "un enfoque disciplinado, estructural y ambicioso. Conoces el mundo a través de la responsabilidad y la planificación de largo plazo, construyendo sistemas duraderos con dominio paciente",
    "Aquarius": "un enfoque independiente, innovador y orientado a la comunidad. Conoces el mundo a través del desapego con principios y el pensamiento adelantado, reformando sistemas para el beneficio colectivo",
    "Pisces": "un enfoque sensible, imaginativo y disolvedor de fronteras. Conoces el mundo a través de la empatía y la entrega creativa, sintonizando corrientes que otros no pueden percibir",
}


# ── Language strings ──────────────────────────────────────────────────────────
LANG = "en"

MOON_SIGN_INTERPRETATIONS_ES = {
    "Aries": "inmediatez emocional, valentía y necesidad de confrontación honesta",
    "Taurus": "estabilidad emocional, anclaje sensorial y necesidad de seguridad tangible",
    "Gemini": "procesamiento emocional a través del lenguaje, curiosidad y conexiones variadas",
    "Cancer": "profundidad emocional, cuidado protector y necesidad de pertenencia",
    "Leo": "calidez emocional, autoexpresión creativa y necesidad de reconocimiento",
    "Virgo": "orden emocional, cuidado práctico y necesidad de ser útil",
    "Libra": "equilibrio emocional, armonía relacional y necesidad de pareja",
    "Scorpio": "intensidad emocional, profundidad transformadora y necesidad de verdad",
    "Sagittarius": "libertad emocional, búsqueda filosófica y necesidad de significado",
    "Capricorn": "autosuficiencia emocional, integridad estructural y necesidad de competencia",
    "Aquarius": "objetividad emocional, conciencia comunitaria y necesidad de libertad",
    "Pisces": "sensibilidad emocional, absorción compasiva y necesidad de trascendencia",
}

ES = {
    "cover_title": "Informe de Historia Cósmica",
    "cover_subtitle": "Un informe de historia cósmica que muestra dónde se sitúa su carta natal dentro de ciclos generacionales, elementales y civilizacionales de onda larga.",
    "cover_generated": "Generado por Zodiyuga SkyClock usando el Efemérides Suizo (DE440) · zodiyuga.com",
    "cover_sun": "Sol en {sun} · Luna en {moon} · {asc} Ascendente · {gen} / Arquetipo {arch}",
    "s1_title": "1. Su Instantánea Cósmica",
    "s1_intro": "Esta sección provee un tablero claro y exhaustivo de su firma de tiempo y asignación de desarrollo central dentro del modelo Zodiyuga SkyClock.",
    "s1_heading": "1. Su Clima Cósmico",
    "birth_anchor": "Ancla de Nacimiento",
    "core_natal": "Firma Natal Central",
    "generation": "Generación",
    "birth_turning": "Giro de Nacimiento",
    "sj_anchor": "Ancla Saturno-Júpiter",
    "elemental_era": "Era Elemental",
    "yuga_position": "Posición Yúgica",
    "yuga_pre2020": "Campo de presión de cierre de la Edad de Hierro, cruzando luego al Dvapara ascendente/Edad de Bronce después de 2020",
    "yuga_post2020": "Primera generación ascendente de Bronce",
    "era_pre2000": "Era de Tierra cerrándose; Era de Aire comenzando a sembrarse",
    "era_post2000": "Era de Aire establecida",
    "sj_intro": "Saturno y Júpiter se encuentran aproximadamente cada 20 años, estableciendo un tono social y generacional distintivo. En períodos más largos, estos encuentros se agrupan por elemento, produciendo eras civilizacionales de aproximadamente 200 años. Para este informe, las conjunciones de 20 años son los engranajes cortos; las eras elementales son el tren de engranajes mayor.",
    "sj_birth_air": "Su nacimiento se sitúa inmediatamente después de la conjunción de {year} {sign} {elem}. Esta fue la primera gran señal de Aire dentro de una civilización que aún operaba bajo supuestos de la Era de Tierra: masa industrial, propiedad, extracción de recursos, jerarquía burocrática e infraestructura física.",
    "sj_birth_earth": "Su nacimiento se sitúa inmediatamente después de la conjunción de {year} {sign} {elem}, que ancló la era de {elem_lower} que moldeó el mundo que usted habitó.",
    "sj_what": "Qué significa esto para usted",
    "sj_arc": "Su arco vital se mueve desde la semilla de Aire de {year}, a través de la prueba final de Tierra de 2000, hasta el bloqueo de Aire de 2020. Eso la hace una generación puente: formada por el viejo mundo material, madurada en su ruptura y necesitada para la construcción del nuevo mundo en red.",
    "th_year": "Año", "th_sign": "Signo", "th_element": "Elemento", "th_turning": "Giro", "th_meaning": "Significado",
    "sj_data": [
        (1940, "Tauro", "Tierra", "Crisis", "Segunda Guerra Mundial, Gran Depresión y la plantilla de reconstrucción del orden de posguerra."),
        (1961, "Capricornio", "Tierra", "Alto", "Suburbios, carrera espacial, consenso de Guerra Fría y confianza institucional."),
        (1981, "Libra", "Aire", "Despertar", "Primera señal de Aire tras una secuencia de Tierra de 160 años; computación personal, redes tempranas, cuestionamiento cultural."),
        (2000, "Tauro", "Tierra", "Desenredo", "Conjunción final de Tierra por 600 años; burbuja punto-com, 11-S, hiperfinanciarización y límites materiales expuestos."),
        (2020, "Acuario", "Aire", "Crisis", "Bloqueo de Era de Aire; choque pandémico, reinicio institucional y dependencia de red inevitable."),
        (2040, "Libra", "Aire", "Alto", "Alto de Aire proyectado: estructuras cívicas reconstruidas para un mundo en red."),
    ],
    "th_life_phase": "Fase Vital", "th_age": "Edad", "th_years": "Años", "th_conj_turn": "Conjunción / Giro", "th_personal_meaning": "Significado Personal",
    "phase_childhood": "Infancia / Juventud",
    "phase_early_adult": "Adultez Temprana",
    "phase_midlife": "Mediana Edad",
    "phase_elder": "Vejez",
    "meaning_childhood": "Formada por el clima cultural del giro de esta conjunción — el estado de ánimo institucional, el rol del arquetipo generacional y las oportunidades estructurales disponibles durante sus años formativos.",
    "meaning_early_adult": "Llegando a la mayoría de edad bajo el giro de esta conjunción — los retos de construir independencia, carrera y familia dentro del clima estructural que esta conjunción estableció.",
    "meaning_midlife": "Fase de liderazgo maduro — el giro de la conjunción define las presiones estructurales y oportunidades para sus décadas más productivas.",
    "meaning_elder": "Rol de mentor, arquitecto de sistemas y constructor anciano — el giro de la conjunción da forma al clima cultural de sus años de vejez y al legado que deja.",
    "th_marker_year": "Año", "th_marker": "Marcador", "th_how": "Cómo usarlo",
    "birth_imprint": "Imprenta de nacimiento: La conjunción Saturno-Júpiter que definió su campo generacional y estableció el tono de la era que entered.",
    "saturn_return": "Retorno de Saturno",
    "sr_desc": "Saturno regresa a tu posición natal a los {age} años: un hito estructural que marca el final de un capítulo y el comienzo del siguiente. Revisa lo construido, libera lo que ya no sirve y comprométete con el próximo ciclo de responsabilidad.",
    "sr_first": "Primer", "sr_second": "Segundo",
    "uranus_opp": "Oposición de Urano",
    "uo_desc": "Urano en tránsito se opone a tu posición natal a los {age} años: el despertar clásico de la mediana edad. Los patrones establecidos son desafiados, las viejas identidades se rompen y comienza una nueva fase de libertad y experimentación. Esta es la señal de 'no te conformes' del reloj cósmico.",
    "sn_desc": "A los {age} años, Saturno y Neptuno se encuentran en {sign}: una alineación rara que fusiona la realidad estructural con la imaginación visionaria. Las viejas ilusiones se disuelven; los nuevos sueños deben construirse sobre tierra firme. Un tiempo para alinear lo práctico con lo significativo.",
    "sj_marker_data": [
        (1940, "Tauro", "Crisis", "Segunda Guerra Mundial, Gran Depresión y la plantilla de reconstrucción del orden de posguerra."),
        (1961, "Capricornio", "Alto", "Suburbios, carrera espacial, consenso de Guerra Fría y confianza institucional."),
        (1981, "Libra", "Despertar", "Primera señal de Aire tras una secuencia de Tierra de 160 años; computación personal, redes tempranas, cuestionamiento cultural."),
        (2000, "Tauro", "Desenredo", "Conjunción final de Tierra por 600 años; burbuja punto-com, 11-S, hiperfinanciarización y límites materiales expuestos."),
        (2020, "Acuario", "Crisis", "Bloqueo de Era de Aire; choque pandémico, reinicio institucional y dependencia de red inevitable."),
        (2040, "Libra", "Alto", "Alto de Aire proyectado: estructuras cívicas reconstruidas para un mundo en red."),
        (2060, "Acuario", "Despertar", "Despertar de Aire proyectado: cuestionamiento cultural renovado dentro del paradigma en red."),
    ],
    "us_marker": "Conjunción Urano-Saturno: Reestructuración a mitad de vida del lenguaje, la educación, la infraestructura localizada y sus marcos de comunicación práctica inmediatos.",
    "how_revisit": "Cómo revisar estos marcadores",
    "appendix_title": "12. Apéndice",
    "appendix_intro": "El apéndice mantiene el material técnico disponible sin forzar al lector a decodificarlo antes de recibir el valor principal del informe.",
    "outer_planets": "Metrónomos de Planetas Exteriores",
    "outer_planets_intro": "Mientras Saturno y Júpiter establecen el tempo socioeconómico, los planetas exteriores lentos describen alineaciones de fondo profundas. Estas frecuencias de fondo dan forma al paisaje psicológico y estructural profundo sobre escalas evolutivas vastas, operando mucho más allá de las tendencias culturales de corto plazo.",
    "us_cycle": "El ciclo Urano-Saturno, reiniciando aproximadamente cada 45 años, gobierna el ritmo del avance institucional y la reforma estructural. La conjunción precedente de 1942 en Tauro ancló las estructuras industriales pesadas del orden de posguerra — producción en masa, burocracia centralizada y el complejo militar-industrial que definió el clima de la era. La conjunción de 1988 en Sagitario coincidió con el final de la Guerra Fría y la era de globalización de la información, abriendo grietas en ese mundo centralizado. La próxima conjunción de 2032 en Géminis apunta hacia una reestructuración del lenguaje, la educación, la comunicación local y la vida cívica en red.",
    "un_cycle": "El ciclo Urano-Neptuno, que abarca aproximadamente 172 años, impulsa la conciencia de masas y la imaginación colectiva. La conjunción precedente en 1821 en Capricornio coincidió con la aceleración de la Revolución Industrial — la era mecánica que construyó la infraestructura física de la Era de Tierra. La conjunción de 1993 en Capricornio se alineó directamente con el nacimiento comercial de la World Wide Web y los mercados digitales globalizados, desplazando la imaginación colectiva de lo mecánico a lo digital.",
    "np_cycle": "El ritmo Neptuno-Plutón es aún más vasto, moviéndose en una escala aproximada de 492 años que mapea los sistemas operativos míticos de las civilizaciones. La conjunción precedente de 1892 en Géminis ancló el mundo moderno de medios masivos industriales — el clima de periódicos, ferrocarriles, telégrafos y alfabetización masiva que usted actualmente ve desmoronarse. Ese sistema no verá su próximo reinicio total hasta el siglo XXIV. La presencia de Plutón en Acuario ahora señala una demolición y reconstrucción de dos décadas de infraestructura tecnológica, sistemas colectivos y distribución de poder — el próximo clima formándose bajo la superficie de la crisis actual.",
    "glossary_title": "Glosario Ampliado",
    "glossary": [
        ("Metrónomo (♄☌♃):", "Una referencia de tiempo repetitiva que establece el tempo para un sistema más grande. En este modelo, la conjunción Saturno–Júpiter (♄☌♃) funciona como el metrónomo maestro — un reloj celeste predecible que marca cuándo una onda generacional termina y la siguiente comienza. Así como un metrónomo musical no determina qué notas se tocan sino que establece el ritmo que siguen, el metrónomo ♄☌♃ no determina el destino individual sino que establece el tempo estructural que cada generación sigue."),
        ("Retorno de Saturno:", "El momento en que Saturno en tránsito regresa a la posición zodiacal exacta que ocupaba al nacer, ocurriendo aproximadamente cada 29.5 años. El Primer Retorno de Saturno (alrededor de los 29-30 años) marca el final de la juventud y el comienzo de la adultez madura. El Segundo (alrededor de los 58-60 años) marca la transición de la mediana edad al rol de anciano."),
        ("Oposición de Urano:", "El momento en que Urano en tránsito alcanza el punto exactamente opuesto a su posición natal, ocurriendo alrededor de los 42 años (la mitad de la órbita de 84 años de Urano). Es el despertar clásico de la mediana edad — un desafío a los patrones establecidos y una invitación a experimentar."),
        ("Conjunción Saturno–Júpiter (♄☌♃):", "Un marcador de tiempo civilizacional de aproximadamente 20 años usado aquí como metrónomo generacional para señalar cambios socioeconómicos. Cada conjunción ocurre en un signo zodiacal específico, y el elemento de ese signo (Tierra, Aire, Fuego o Agua) determina el carácter elemental de la era."),
        ("Saeculum:", "Un ritmo histórico de aproximadamente 80 años que se mueve a través de cuatro estaciones generacionales: Primavera (Alto), Verano (Despertar), Otoño (Desenredo) e Invierno (Crisis), mapeando el aliento de la confianza institucional y cultural."),
        ("Giro (Fase del Saeculum):", "Una de cuatro fases estacionales dentro del ciclo del saeculum: Primavera (Alto) — confianza cívica y expansión institucional; Verano (Despertar) — individualismo y cuestionamiento cultural; Otoño (Desenredo) — decadencia institucional y fractura; Invierno (Crisis) — colapso estructural y reconstrucción."),
        ("Arquetipo (Generacional):", "El tipo de personalidad recurrente asignado a cada generación por su posición en el saeculum: Profeta (Boomers, Gen Alpha), Nómada (Gen X), Héroe (Millennials), Artista (Gen Z). Cada arquetipo juega un rol distinto en el giro que madura."),
        ("Era Elemental:", "Un período de aproximadamente 200 años en el que las conjunciones Saturno-Júpiter enfatizan consistentemente un elemento (Tierra, Aire, Fuego o Agua), estableciendo el tema estructural mayor de la civilización global. La Era de Tierra se extendió desde principios del siglo XIX hasta 2020; la Era de Aire comienza en 2020 y se extiende hasta aproximadamente 2219."),
        ("Era de Tierra:", "La era elemental que se extendió desde principios del siglo XIX hasta 2020. Abarca las conjunciones Saturno-Júpiter de 1842 en Capricornio, 1861 en Capricornio, 1881 en Tauro, 1901 en Sagitario, 1921 en Virgo, 1940 en Tauro, 1961 en Capricornio y 2000 en Tauro. Caracterizada por producción industrial en masa, poder centralizado del Estado-nación, infraestructura basada en combustibles fósiles, expansión suburbana, burocracia en papel y propiedad física como forma dominante de riqueza. La conjunción terminal de la Era de Tierra en 2000 en Tauro sirvió como su alineación final de despedida."),
        ("Era de Aire:", "La era elemental actual, fijada por la conjunción Saturno-Júpiter de 2020 en Acuario. Caracterizada por datos, redes, protocolos, poder distribuido, infraestructura invisible y coordinación a distancia. Se extiende hasta aproximadamente 2219."),
        ("Era de Agua:", "La era elemental que sigue a la Era de Aire, comenzando cuando las conjunciones Saturno-Júpiter se agrupan en signos de Agua. Las eras de Agua no han dominado el período moderno, pero históricamente coinciden con el surgimiento de movimientos emocionales masivos, psicología profunda, expansión oceánica y submarina, la emergencia de material colectivo largamente enterrado, y la disolución de las estructuras duras de la era anterior. La firma de una era de Agua es la saturación de la vida pública con sentimiento — lo que la era anterior endureció, esta era lo disuelve, y lo que la era anterior ignoró, esta era lo nombra."),
        ("Era de Fuego:", "La era elemental que sigue a la Era de Agua, comenzando con la primera conjunción Saturno-Júpiter en un signo de Fuego. Las eras de Fuego históricas coinciden con expansión civilizacional, liderazgo carismático, fervor doctrinal e ideológico, grandes movilizaciones religiosas y militares, y la ignición visible de nuevas épocas culturales. La firma de una era de Fuego es una nueva carta mítica — una historia fundacional fresca que la era anterior no pudo proveer."),
        ("Precesión:", "En términos astronómicos estándar, la precesión se describe como un desplazamiento axial de 26.000 años del eje de rotación de la Tierra, cambiando gradualmente la alineación entre el zodíaco tropical (estacional) y el zodíaco sidéreo (basado en estrellas). En el marco de Zodiyuga SkyClock, esto se procesa puramente como el mecanismo de tiempo geométrico que impulsa la onda de Yuga: a medida que la relación angular entre los puntos de referencia celestes evoluciona, la densidad colectiva de percepción sube y baja."),
        ("Onda de Yuga:", "El ciclo de conciencia de 26.000 años usado en este modelo para mapear el ascenso y descenso civilizacional relativo a la densidad y percepción energética. El Kali Yuga (Edad de Hierro) representa la conciencia material más densa; el Dvapara Yuga (Edad de Bronce) marca la ascensión hacia la percepción energética e informacional."),
        ("Las Estaciones, los Signos y la Eclíptica:", "La eclíptica es el camino aparente que el Sol traza a través del cielo en el curso de un año. Los doce signos del zodíaco son segmentos de 30 grados de este círculo, nombrados según las constelaciones que alguna vez se alinearon con ellos. Debido a que el zodíaco tropical está anclado a las estaciones, el signo Aries siempre comienza en el equinoccio de primavera — independientemente de dónde se encuentren actualmente las estrellas. Cada signo pertenece a uno de cuatro elementos (Fuego, Tierra, Aire, Agua) y a una de tres cualidades (Cardinal, Fija, Mutable), dando a cada signo un carácter distinto que colorea cualquier planeta que pase por él."),
    ],
    "th_house": "House",
    "planet_placements": "Planet Placements",
    "th_house": "House",
    "th_planet": "Planet", "th_position": "Position", "th_element": "Element", "th_quality": "Quality",
    "ascendant": "Ascendant", "midheaven": "Midheaven",
    "aspects_title": "Strongest Major Aspects by Orb",
    "th_planets": "Planets", "th_aspect": "Aspect", "th_orb": "Orb",
        "houses": [],
    "footer1": "Generado por Zodiyuga SkyClock con las Efemérides Suizas (DE440) | zodiyuga.com",
    "footer2": "Este informe está calibrado exclusivamente para fines educativos, estructurales y de investigación.",
    "page_of": "Page {n} of {total}",
    "moon_para": "\nYour Moon in {moon} shapes the inner emotional weather beneath the Sun identity. Where the Sun is how you shine, the Moon is how you feel. This placement gives you {interp}. The Moon sign is the private instrument through which you process the macro-weather described above - it colors how you receive, digest, and respond to the structural pressures of your era.\n",
    "moon_para_es": "\nTu Luna en {moon} da forma al clima emocional interno bajo la identidad solar. Donde el Sol es cómo brillas, la Luna es cómo sientes. Esta posición te da {interp}. El signo lunar es el instrumento privado a través del cual procesas el macroclima descrito arriba — colorea cómo recibes, digieres y respondes a las presiones estructurales de tu era.\n",
    "asc_para_es": "\nTu Ascendente en {asc} es la lente a través de la cual todo esto entra en tu vida. Si el Sol es tu identidad central y la Luna es tu clima interno, el Ascendente es la puerta — la forma en que el mundo te ve por primera vez y la forma en que tú lo conoces. Te da {interp}. Esta es la primera línea de tu carta, la interfaz donde los patrones cósmicos se convierten en experiencia personal. Cada planeta de tu carta se filtra a través de este signo ascendente antes de llegar al resto de tu vida.\n",
    "narrative_not_found": "<h2>1. Your Cosmic Snapshot</h2><p>Prose template not found for {arch} / {sun}.</p>",
    "chart_house_system": "Casas de signo entero",
}

ES_PLANET_NAMES = {
    "Sun": "Sol", "Moon": "Luna", "Mercury": "Mercurio", "Venus": "Venus",
    "Mars": "Marte", "Jupiter": "Júpiter", "Saturn": "Saturno",
    "Uranus": "Urano", "Neptune": "Neptuno", "Pluto": "Plutón",
    "N.Node": "N.Nodo",
}
ES_ASPECT_MEANINGS = {
    "Conjunction": "Fusión, intensidad, energía combinada",
    "Sextile": "Oportunidad, flujo, talento natural",
    "Square": "Tensión, desafío, crecimiento a través de la fricción",
    "Trine": "Armonía, facilidad, don natural",
    "Opposition": "Polaridad, equilibrio, dinámica relacional",
}
ES_SIGNS = {"Aries":"Aries","Taurus":"Tauro","Gemini":"Géminis","Cancer":"Cáncer","Leo":"Leo","Virgo":"Virgo",
            "Libra":"Libra","Scorpio":"Escorpio","Sagittarius":"Sagitario","Capricorn":"Capricornio",
            "Aquarius":"Acuario","Pisces":"Piscis"}
ES_ELEMENTS = {"Fire":"Fuego","Earth":"Tierra","Air":"Aire","Water":"Agua"}
ES_QUALITIES = {"Cardinal":"Cardinal","Fixed":"Fijo","Mutable":"Mutable"}
ES_GEN_NAMES = {"Builder":"Constructor","Boomer":"Boomer","Gen X":"Gen X","Millennial":"Millennial","Gen Z":"Gen Z","Gen Alpha":"Gen Alpha","Unknown":"Desconocida"}
ES_ARCH_NAMES = {"Prophet":"Profeta","Nomad":"Nómada","Hero":"Héroe","Artist":"Artista","Prophet_GenAlpha":"Profeta","Unknown":"Desconocido"}
ES_TURNING_NAMES = {"High":"Alto","Awakening":"Despertar","Unraveling":"Desenredo","Crisis":"Crisis","Unknown":"Desconocido"}

def T(key, **kw):
    """Get string for current LANG."""
    if LANG == "es" and key in ES:
        s = ES[key]
        if isinstance(s, str) and kw:
            return s.format(**kw)
        return s
    return None  # fall through to English defaults


def load_narrative(archetype, sun_sign, moon_sign=None, asc_sign=None, lang="en"):
    sign_slug = sun_sign.lower()
    archetype_lower = archetype.lower()
    suffix = "_es" if lang == "es" else ""
    # Map archetype to prose prefix
    if archetype_lower == "hero":
        prose_prefix = "millennial"
        # v25-style full report: shared macro template + sign-specific snippet
        macro_path = TEMPLATE_DIR / f"prose_millennial_macro{suffix}.md"
        snippet_path = TEMPLATE_DIR / f"prose_millennial_{sign_slug}{suffix}.md"
    elif archetype_lower == "nomad":
        prose_prefix = "nomad"
        macro_path = TEMPLATE_DIR / f"prose_nomad_macro_template{suffix}.md"
        snippet_path = TEMPLATE_DIR / f"prose_nomad_{sign_slug}_snippet{suffix}.md"
    elif archetype_lower == "artist":
        prose_prefix = "artist"
        macro_path = TEMPLATE_DIR / f"prose_artist_macro_template{suffix}.md"
        snippet_path = TEMPLATE_DIR / f"prose_artist_{sign_slug}_snippet{suffix}.md"
    elif archetype_lower == "prophet":
        macro_path = TEMPLATE_DIR / f"prose_prophet_macro_template{suffix}.md"
        snippet_path = TEMPLATE_DIR / f"prose_prophet_{sign_slug}_snippet{suffix}.md"
    elif archetype_lower == "prophet_genalpha":
        macro_path = TEMPLATE_DIR / f"prose_prophet_genalpha_macro_template{suffix}.md"
        snippet_path = TEMPLATE_DIR / f"prose_prophet_genalpha_{sign_slug}_snippet{suffix}.md"
    else:
        return None
    # Fall back to English if Spanish file doesn't exist (macro and snippet independently)
    if suffix:
        if not macro_path.exists():
            macro_path = TEMPLATE_DIR / macro_path.name.replace(suffix, "")
        if snippet_path and not snippet_path.exists():
            snippet_path = TEMPLATE_DIR / snippet_path.name.replace(suffix, "")
    if not macro_path.exists():
        return None
    if snippet_path and not snippet_path.exists():
        snippet_path = None  # Graceful: skip snippet substitution rather than fail entirely
    # For Hero archetype, the macro file is the complete narrative; no snippet substitution needed.
    macro = macro_path.read_text(encoding='utf-8')
    if snippet_path:
        snippet = snippet_path.read_text(encoding='utf-8')
        blocks = parse_snippet(snippet)
        for key, value in blocks.items():
            macro = macro.replace(f"[{key}]", value)
    # Inject Moon sign paragraph
    if lang == "es":
        moon_interp = MOON_SIGN_INTERPRETATIONS_ES.get(moon_sign, "profundidad emocional y ritmo interno")
        moon_para = ES["moon_para_es"].format(moon=moon_sign, interp=moon_interp)
    else:
        moon_interp = MOON_SIGN_INTERPRETATIONS.get(moon_sign, "emotional depth and inner rhythm")
        moon_para = f"\nYour Moon in {moon_sign} shapes the inner emotional weather beneath the Sun's identity. Where the Sun is how you shine, the Moon is how you feel. This placement gives you {moon_interp}. The Moon sign is the private instrument through which you process the macro-weather described above — it colors how you receive, digest, and respond to the structural pressures of your era.\n"
    macro = macro.replace("[MOON_SIGN]", moon_para)
    # Inject ASC sign paragraph
    if asc_sign:
        if lang == "es":
            asc_interp = ASC_SIGN_INTERPRETATIONS_ES.get(asc_sign, "una firma personal distintiva y una forma propia de conocer el mundo")
            # Translate the asc sign name to Spanish for the paragraph
            asc_sign_disp = ES_SIGNS.get(asc_sign, asc_sign)
            asc_para = ES["asc_para_es"].format(asc=asc_sign_disp, interp=asc_interp)
        else:
            asc_interp = ASC_SIGN_INTERPRETATIONS.get(asc_sign, "a distinct personal signature and way of meeting the world")
            asc_para = f"\nYour Ascendant in {asc_sign} is the lens through which all of this enters your life. If the Sun is your core identity and the Moon is your inner weather, the Ascendant is the doorway — the way the world first sees you and the way you first meet it. It gives you {asc_interp}. This is the front line of your chart, the interface where cosmic patterns become personal experience. Every planet in your chart is filtered through this rising sign before it reaches the rest of your life.\n"
        macro = macro.replace("[ASC_SIGN]", asc_para)
        macro = macro.replace("{asc_sign}", asc_sign)
    else:
        macro = macro.replace("[ASC_SIGN]", "")
    return macro

def prose_to_html(prose):
    prose = re.sub(r'\r\n?', '\n', prose)
    # Section 8 gets a page break to avoid mid-table splits
    # prose = prose.replace('8. Your Life Timeline', '<div style="page-break-before:always;"></div>\n8. Your Life Timeline')
    prose = re.sub(r'^(\d{1,2})\. (.+)$', r'<h2>\1. \2</h2>', prose, flags=re.MULTILINE)
    sub_headings = [
        "What this means for you", "Your Generational Role",
        "Epochal Border-Scout Status", "Your Core Assignment",
        "Pattern to watch", "How to revisit these markers",
        "Plain-language takeaway",
    ]
    for sh in sub_headings:
        prose = re.sub(r'^' + re.escape(sh) + r'$', r'<h3>' + sh + r'</h3>', prose, flags=re.MULTILINE)
    # Bold label lines (Practice/Práctica, Reason/Razón, Plain-language/Conclusión)
    # These get their own paragraph with the label wrapped in <strong> so the
    # rendering matches the English template's "Practice: ... / Reason: ..."
    # structure: each label on its own line, then the explanation on the next.
    prose = re.sub(r'^(Practice:.*)$', r'<p><strong>\1</strong></p>', prose, flags=re.MULTILINE)
    prose = re.sub(r'^(Reason:.*)$', r'<p><em>\1</em></p>', prose, flags=re.MULTILINE)
    prose = re.sub(r'^(Pr[áa]ctica:.*)$', r'<p><strong>\1</strong></p>', prose, flags=re.MULTILINE)
    prose = re.sub(r'^(Raz[oó]n:.*)$', r'<p><em>\1</em></p>', prose, flags=re.MULTILINE)
    paragraphs = re.split(r'\n\n+', prose.strip())
    result = []
    for p in paragraphs:
        p = p.strip()
        if not p: continue
        if p.startswith(('<h2', '<h3', '<p', '<div', '<table', '<svg')):
            result.append(p)
        else:
            result.append(f'<p>{p}</p>')
    return '\n'.join(result)

# ── Wheel SVG (v6 redesign — boxes around perimeter, AC/MC in boxes, aspects to angles) ──

def build_wheel_svg(planets, asc, mc):
    """v22 tweaks: thicker wheel, perfect centering, aspect line buffer."""
    W, H = 1000, 1200  # Full page size (8.5×11")
    cx, cy = W/2, 450   # PERFECT center (cx = 500, cy = 450)
    WHEEL_R = 400       # THICKER wheel (220 → 400)
    BOX_W, BOX_H = 120, 40  # Slightly larger boxes
    BOX_GAP = 10        # More spacing between boxes

    def ang(lon_deg):
        return math.radians(180 - (lon_deg - asc))

    def pt(r, a):
        return (cx + math.cos(a) * r, cy + math.sin(a) * r)

    # Build angle pseudo-planets
    dsc = (asc + 180) % 360
    ic = (mc + 180) % 360
    angles = [
        {"name":"AC","glyph":"AC","lon_num":asc,"sign":sign_from_lon(asc),"deg":int(asc%30),"min":int(((asc%30)-int(asc%30))*60),"element":ELEMENTS[sign_from_lon(asc)],"quality":QUALITIES[sign_from_lon(asc)],"color":"#c0392b","kind":"angle"},
        {"name":"MC","glyph":"MC","lon_num":mc,"sign":sign_from_lon(mc),"deg":int(mc%30),"min":int(((mc%30)-int(mc%30))*60),"element":ELEMENTS[sign_from_lon(mc)],"quality":QUALITIES[sign_from_lon(mc)],"color":"#2980b9","kind":"angle"},
        {"name":"DC","glyph":"DC","lon_num":dsc,"sign":sign_from_lon(dsc),"deg":int(dsc%30),"min":int(((dsc%30)-int(dsc%30))*60),"element":ELEMENTS[sign_from_lon(dsc)],"quality":QUALITIES[sign_from_lon(dsc)],"color":"#c0392b","kind":"angle"},
        {"name":"IC","glyph":"IC","lon_num":ic,"sign":sign_from_lon(ic),"deg":int(ic%30),"min":int(((ic%30)-int(ic%30))*60),"element":ELEMENTS[sign_from_lon(ic)],"quality":QUALITIES[sign_from_lon(ic)],"color":"#2980b9","kind":"angle"},
    ]

    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    svg += f'<rect width="100%" height="100%" fill="white"/>'

    # ── Sign wedges ──
    rSignOuter = WHEEL_R
    rSignInner = WHEEL_R - 40
    for i in range(12):
        a0 = ang(i * 30)
        a1 = ang((i + 1) * 30)
        x0, y0 = pt(rSignOuter, a0)
        x1, y1 = pt(rSignOuter, a1)
        x2, y2 = pt(rSignInner, a1)
        x3, y3 = pt(rSignInner, a0)
        large = 1 if (a1 - a0) > math.pi else 0
        fill = ELEMENT_COLORS[ELEMENTS[SIGNS[i]]]
        svg += f'<path d="M {x0:.1f} {y0:.1f} A {rSignOuter} {rSignOuter} 0 {large} 0 {x1:.1f} {y1:.1f} L {x2:.1f} {y2:.1f} A {rSignInner} {rSignInner} 0 {large} 1 {x3:.1f} {y3:.1f} Z" fill="{fill}" opacity="0.15"/>'

    for i in range(12):
        mid = ang(i * 30 + 15)
        tx, ty = pt((rSignOuter + rSignInner) / 2, mid)
        svg += f'<text x="{tx:.0f}" y="{ty:.0f}" font-size="16" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#111">{SIGN_GLYPHS[i]}</text>'

    svg += f'<circle cx="{cx}" cy="{cy}" r="{rSignOuter}" fill="none" stroke="rgba(0,0,0,.20)" stroke-width="1.5"/>'
    svg += f'<circle cx="{cx}" cy="{cy}" r="{rSignInner}" fill="rgba(0,0,0,.03)" stroke="rgba(0,0,0,.12)" stroke-width="1"/>'

    # ── Ecliptic ring (outer tropical ring) ──
    rEcliptic = rSignOuter  # Ecliptic is the outer ring
    svg += f'<circle cx="{cx}" cy="{cy}" r="{rEcliptic}" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/>'

    # ── Tiny degree ticks pointing outward ──
    rTicksInner = rEcliptic  # Align with ecliptic
    rTicksOuter = rEcliptic + 6  # Small outward extension
    
    # Major ticks (10°) and minor ticks (5°, 1°) - no labels, tiny
    for deg in range(360):
        a = ang(deg)
        if deg % 10 == 0:
            rOuter, sw, op = rTicksOuter, 0.5, 0.25
        elif deg % 5 == 0:
            rOuter, sw, op = rTicksOuter - 1, 0.3, 0.15
        else:
            rOuter, sw, op = rTicksOuter - 2, 0.15, 0.1
        x1, y1 = pt(rTicksInner, a)
        x2, y2 = pt(rOuter, a)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="rgba(0,0,0,{op})" stroke-width="{sw}" stroke-linecap="round"/>'

    # ── House cusp lines ──
    asc_sign_idx = int(asc // 30)
    rCuspOuter = rEcliptic + 4
    rCuspInner = rSignInner - 5
    for h in range(12):
        cusp_lon = ((asc_sign_idx + h) % 12) * 30
        a = ang(cusp_lon)
        x1, y1 = pt(rCuspOuter, a)
        x2, y2 = pt(rCuspInner, a)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="rgba(0,0,0,.30)" stroke-width="0.6" stroke-linecap="round"/>'
        mid_lon = cusp_lon + 15
        lx, ly = pt(rCuspOuter + 8, ang(mid_lon))
        svg += f'<text x="{lx:.0f}" y="{ly:.0f}" font-size="7" text-anchor="middle" dominant-baseline="central" fill="#555" font-family="DejaVu Sans, sans-serif">{h+1}</text>'

    # ── Aspect lines: planet-to-planet only, 2x weight ──
    aspect_defs = [(0, 5), (180, 6), (90, 5), (120, 5), (60, 4)]
    def angle_diff(a, b):
        d = abs(a - b) % 360
        return d if d <= 180 else 360 - d

    rAspect = rSignInner - 25  # MORE INSIDE the wheel for aspect lines (10 → 25)
    rAspectMarkerInner = rAspect - 5  # Longer lines start here
    rAspectMarkerOuter = rAspect      # Lines end here
    # Draw aspect markers (longer lines at planet positions) - red for major, blue for minor
    for p in planets:
        a = ang(p["lon_num"])
        x1, y1 = pt(rAspectMarkerInner, a)  # Inner point of marker
        x2, y2 = pt(rAspectMarkerOuter, a)  # Outer point of marker
        # Use red for major aspects (0, 90, 180), blue for minor (60, 120)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="rgba(200,30,30,0.7)" stroke-width="2" stroke-linecap="round"/>'
    
    # Draw aspect lines between planets (from inside of markers)
    for i in range(len(planets)):  # Only planets, no angles
        for j in range(i + 1, len(planets)):
            A = planets[i]
            B = planets[j]
            d = angle_diff(A["lon_num"], B["lon_num"])
            for adeg, aorb in aspect_defs:
                if abs(d - adeg) <= aorb:
                    sw = 2.0  # All aspects 2x
                    if adeg in (0, 90, 180):
                        color = f"rgba(200,30,30,{0.4})"
                    else:
                        color = f"rgba(30,100,200,{0.35})"
                    x1, y1 = pt(rAspectMarkerInner, ang(A["lon_num"]))  # From inside marker
                    x2, y2 = pt(rAspectMarkerInner, ang(B["lon_num"]))  # From inside marker
                    svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>'
                    break

    # ── Planet dots on ecliptic (black) ──
    for p in planets:
        a = ang(p["lon_num"])
        px, py = pt(rEcliptic, a)  # Planet dot on ecliptic
        svg += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="2.5" fill="black"/>'

    # ── Planets with leaders to ecliptic ring ──
    rPlanets = rEcliptic + 25  # Planet glyphs outside ecliptic
    for p in planets:
        a = ang(p["lon_num"])
        # Leader line from ecliptic to just before planet glyph
        ex, ey = pt(rEcliptic, a)  # Ecliptic point
        px, py = pt(rPlanets - 8, a)   # Stop 8px before glyph
        svg += f'<line x1="{ex:.1f}" y1="{ey:.1f}" x2="{px:.1f}" y2="{py:.1f}" stroke="rgba(0,0,0,.3)" stroke-width="0.8" stroke-linecap="round"/>'
        # Planet glyph in black
        px_glyph, py_glyph = pt(rPlanets, a)  # Glyph position
        svg += f'<text x="{px_glyph:.1f}" y="{py_glyph:.1f}" font-size="20" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="black">{p["glyph"]}</text>'

    # ── Angle lines touching ecliptic ring ──
    rAnglesInner = rEcliptic  # Touch the ecliptic
    rAnglesOuter = rEcliptic + 30
    for a in angles:
        aa = ang(a["lon_num"])
        x1, y1 = pt(rAnglesInner, aa)
        x2, y2 = pt(rAnglesOuter, aa)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{a["color"]}" stroke-width="1.5" stroke-linecap="round"/>'
        # Angle label at end of line
        lx, ly = pt(rAnglesOuter + 15, aa)
        svg += f'<text x="{lx:.0f}" y="{ly:.0f}" font-size="9" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="{a["color"]}">{a["glyph"]}</text>'

    # ── Colored boxes below wheel ──
    BOXES_Y = cy + WHEEL_R + 80  # Position below wheel
    N_PLANETS = len(planets)
    
    # Calculate house positions for each planet
    asc_sign_idx = int(asc // 30)
    planet_houses = {}
    for p in planets:
        sign_idx = int(p["lon_num"] // 30)
        house = ((sign_idx - asc_sign_idx) % 12) + 1
        planet_houses[p["name"]] = house
    
    # Planet boxes in two rows
    for idx, p in enumerate(planets):
        row = idx // 6  # First 6 in top row, next 6 in bottom row
        col = idx % 6
        box_x = cx - (6 * BOX_W / 2) + (col * BOX_W) + (col * BOX_GAP)
        box_y = BOXES_Y + (row * (BOX_H + BOX_GAP))
        bx = box_x + BOX_W/2
        by = box_y + BOX_H/2

        border_color = ELEMENT_COLORS[p["element"]]
        svg += f'<rect x="{box_x:.0f}" y="{box_y:.0f}" width="{BOX_W}" height="{BOX_H}" rx="4" fill="white" stroke="{border_color}" stroke-width="1.5" opacity="0.95"/>'

        deg_str = f'{p["glyph"]} {p["sign"]} {p["deg"]}°{p["min"]:02d}\''
        house_num = planet_houses[p["name"]]
        svg += f'<text x="{bx:.0f}" y="{by - 4:.0f}" font-size="9" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#222">{deg_str}</text>'
        svg += f'<text x="{bx:.0f}" y="{by + 9:.0f}" font-size="7" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#888">H{house_num} · {p["element"]} · {p["quality"]}</text>'

    # Angle boxes below planet boxes
    ANGLE_BOX_Y = BOXES_Y + 2 * (BOX_H + BOX_GAP) + 20
    angle_positions = {"AC": 0, "MC": 1, "DC": 4, "IC": 5}  # Spread across both rows
    for a in angles:
        col = angle_positions[a["name"]]
        row = 0 if a["name"] in ["AC", "MC"] else 1
        box_x = cx - (6 * BOX_W / 2) + (col * BOX_W) + (col * BOX_GAP)
        box_y = ANGLE_BOX_Y + (row * (BOX_H + BOX_GAP))
        bx = box_x + BOX_W/2
        by = box_y + BOX_H/2

        svg += f'<rect x="{box_x:.0f}" y="{box_y:.0f}" width="{BOX_W}" height="{BOX_H}" rx="4" fill="white" stroke="{a["color"]}" stroke-width="2" opacity="0.95"/>'

        deg_str = f'{a["glyph"]} {a["sign"]} {a["deg"]}°{a["min"]:02d}\''
        svg += f'<text x="{bx:.0f}" y="{by - 4:.0f}" font-size="9" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#222">{deg_str}</text>'
        svg += f'<text x="{bx:.0f}" y="{by + 9:.0f}" font-size="7" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, sans-serif" fill="#888">{a["element"]} · {a["quality"]}</text>'

    svg += '</svg>'
    return svg

    # ── Degree ticks ──
    rTick1 = rEcliptic - 3
    rTick5 = rEcliptic - 5
    rTick10 = rEcliptic - 7
    for deg in range(360):
        a = ang(deg)
        if deg % 10 == 0:
            rInner, sw, op = rTick10, 0.6, 0.40
        elif deg % 5 == 0:
            rInner, sw, op = rTick5, 0.4, 0.25
        else:
            rInner, sw, op = rTick1, 0.2, 0.12
        x1, y1 = pt(rEcliptic, a)
        x2, y2 = pt(rInner, a)
        svg += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="rgba(0,0,0,{op})" stroke-width="{sw}" stroke-linecap="round"/>'

    svg += '</svg>'
    return svg

# ── Main HTML generation ────────────────────────────────────────────────────

def generate_html(birth_date, birth_time, birth_location, lat, lon, year, month, day, hour, minute, tz_offset, tz_label, recipient_name="", lang="en", solar_chart=False):
    """Returns (html, chart_pdf_path)."""
    global LANG
    LANG = lang
    utc_hour_frac = (hour + tz_offset) + minute / 60.0
    jd = swe.julday(year, month, day, utc_hour_frac)

    planets = get_planet_data(jd)
    aspects = get_aspects(planets)
    saec = get_saeculum(jd)

    cusps, ascmc = swe.houses(jd, lat, lon, b'W')
    asc = ascmc[0]
    mc = ascmc[1]
    asc_sign = sign_from_lon(asc)
    mc_sign = sign_from_lon(mc)

    # If --solar-chart, rotate the house cusps so ASC = 0° Aries
    # (the standard "solar chart" / "sun-sign chart" convention for unknown birth time)
    if solar_chart:
        rotation = (360.0 - asc) % 360.0
        cusps = [(c + rotation) % 360.0 for c in cusps]
        asc = 0.0
        mc = (mc + rotation) % 360.0
        asc_sign = "Aries"  # force 0° Aries
        mc_sign = sign_from_lon(mc)

    sun = next((p for p in planets if p['name'] == 'Sun'), None)
    moon = next((p for p in planets if p['name'] == 'Moon'), None)
    sun_sign = sun['sign'] if sun else 'Unknown'
    moon_sign = moon['sign'] if moon else 'Unknown'

    # ── Date prepared + past/future awareness ──
    import datetime as _dt
    now = _dt.datetime.now()
    now_utc = _dt.datetime.now(_dt.timezone.utc)
    current_jd = swe.julday(
        now_utc.year, now_utc.month, now_utc.day,
        now_utc.hour + now_utc.minute / 60.0 + now_utc.second / 3600.0,
    )
    if lang == "es":
        _meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
        prepared_date = f"{now.day:02d} de {_meses[now.month-1]} de {now.year}"
    else:
        prepared_date = now.strftime("%B %d, %Y")
    current_year = now.year
    age_now = current_year - year
    # Determine which markers are past, present, or future relative to now
    def time_status(marker_year, marker_jd=None):
        if marker_jd is not None:
            if marker_jd < current_jd:
                return "past"
            if marker_jd > current_jd:
                return "future"
            return "present"
        if marker_year < current_year:
            return "past"
        elif marker_year > current_year:
            return "future"
        else:
            return "present"

    # ── Section 1: Dashboard table ──
    if lang == "es":
        yuga_label = ES["yuga_pre2020"] if year < 2020 else ES["yuga_post2020"]
        era_label = ES["era_pre2000"] if year < 2000 else ES["era_post2000"]
        dashboard_rows = f"""
        <tr><th>{ES['birth_anchor']}</th><td>{birth_date}, {birth_time}, {birth_location}</td></tr>
        <tr><th>{ES['core_natal']}</th><td>Sol {ES_SIGNS.get(sun_sign,sun_sign)}, Luna {ES_SIGNS.get(moon_sign,moon_sign)}, {ES_SIGNS.get(asc_sign,asc_sign)} Ascendente</td></tr>
        <tr><th>{ES['generation']}</th><td>{ES_GEN_NAMES.get(saec['name'],saec['name'])} / Arquetipo {ES_ARCH_NAMES.get(saec['archetype'],saec['archetype'])}</td></tr>
        <tr><th>{ES['birth_turning']}</th><td>{ES_TURNING_NAMES.get(saec['turning'],saec['turning'])}</td></tr>
        <tr><th>{ES['sj_anchor']}</th><td>Conjunción {saec['conj_year']} en {ES_SIGNS.get(saec['conj_sign'],saec['conj_sign'])}</td></tr>
        <tr><th>{ES['elemental_era']}</th><td>{era_label}</td></tr>
        <tr><th>{ES['yuga_position']}</th><td>{yuga_label}</td></tr>
        """
    else:
        yuga_label = "Closing Iron Age pressure field, later crossing into ascending Dvapara/Bronze Age after 2020" if year < 2020 else "First ascending Bronze generation"
        era_label = "Earth Era closing; Air Era beginning to seed itself" if year < 2000 else "Air Era established"
        dashboard_rows = f"""
        <tr><th>Birth Anchor</th><td>{birth_date}, {birth_time}, {birth_location}</td></tr>
        <tr><th>Core Natal Signature</th><td>{sun_sign} Sun, {moon_sign} Moon, {asc_sign} Rising</td></tr>
        <tr><th>Generation</th><td>{saec['name']} / {saec['archetype']} Archetype</td></tr>
        <tr><th>Birth Turning</th><td>{saec['turning']}</td></tr>
        <tr><th>Saturn-Jupiter Anchor</th><td>{saec['conj_year']} conjunction in {saec['conj_sign']}</td></tr>
        <tr><th>Elemental Era</th><td>{era_label}</td></tr>
        <tr><th>Yuga Position</th><td>{yuga_label}</td></tr>
        """

    # ── Section 4: SJ Timeline table ──
    sj_data = ES["sj_data"] if lang == "es" else [
        (1940, "Taurus", "Earth", "Crisis", "World War II, Great Depression, and the reconstruction template for the post-war order."),
        (1961, "Capricorn", "Earth", "High", "Suburbs, space race, Cold War consensus, and institutional confidence."),
        (1981, "Libra", "Air", "Awakening", "First Air signal after a 160-year long Earth sequence; personal computing, early networks, cultural questioning."),
        (2000, "Taurus", "Earth", "Unraveling", "Final Earth conjunction for 600 years; dot-com bubble, 9/11, hyper-financialization, and exposed material limits."),
        (2020, "Aquarius", "Air", "Crisis", "Air Era lock-in; pandemic shock, institutional reset, and unavoidable network dependency."),
        (2040, "Libra", "Air", "High", "Projected Air High: Rebuilt civic structures for a networked world."),
    ]
    sj_rows = ""
    for yr, sgn, el, turn, meaning in sj_data:
        sj_rows += f"<tr><td>{yr}</td><td>{sgn}</td><td>{el}</td><td>{turn}</td><td>{meaning}</td></tr>"

    if lang == "es":
        sj_section = f"""
        <p>{ES['sj_intro']}</p>
        <p>{ES['sj_birth_air' if saec['conj_element'] == 'Air' and saec['conj_year'] < 2020 else 'sj_birth_earth'].format(year=saec['conj_year'], sign=ES_SIGNS.get(saec['conj_sign'], saec['conj_sign']), elem=ES_ELEMENTS.get(saec['conj_element'], saec['conj_element']), elem_lower=ES_ELEMENTS.get(saec['conj_element'], saec['conj_element']).lower())}</p>
        <h3>{ES['sj_what']}</h3>
        <p>{ES['sj_arc'].format(year=saec['conj_year'])}</p>
        <table>
        <thead>
        <tr><th>{ES['th_year']}</th><th>{ES['th_sign']}</th><th>{ES['th_element']}</th><th>{ES['th_turning']}</th><th>{ES['th_meaning']}</th></tr>
        </thead>
        <tbody>
        {sj_rows}
        </tbody>
        </table>
        """
    else:
        # Build dynamic life arc text based on the birth conjunction element and year
        conj_elem = saec['conj_element']
        conj_yr = saec['conj_year']
        conj_sign = saec['conj_sign']
        if conj_elem == "Earth" and conj_yr < 2020:
            # Born in an Earth-era conjunction before the Air Era lock-in
            era_role = "formed by the old material world, matured in its breakdown, and needed for the construction of the new networked one"
            if conj_yr <= 1961:
                arc_text = f"Your life arc moves from the {conj_yr} Earth conjunction that framed your birth, through the 1981 Air signal and the final 2000 Earth test, into the 2020 Air lock-in. That makes you a bridge generation: {era_role}."
            elif conj_yr == 1981:
                arc_text = f"Your life arc moves from the 1981 Air signal that opened your generation, through the final 2000 Earth test, into the 2020 Air lock-in. That makes you a threshold generation: born at the first crack in the material order, maturing as it collapses, and needed to build the networked replacement."
            elif conj_yr == 2000:
                arc_text = f"Your life arc moves from the 2000 Earth conjunction that framed your birth — the last Earth conjunction for centuries — through the 2020 Air lock-in, into the Air Era unfolding ahead. You are the final generation shaped by the material world's closing chapter, positioned to inherit its wreckage and build what comes next."
            else:
                arc_text = f"Your life arc moves from the {conj_yr} {conj_elem} conjunction that framed your birth, through the 2020 Air lock-in, into the Air Era unfolding ahead."
        elif conj_elem == "Air":
            if conj_yr == 2020:
                arc_text = f"Your life arc begins at the 2020 Air lock-in itself — the hinge point where the Earth Era ended and the Air Era began. You are a native of the new paradigm, not a refugee from the old one. Your task is not to unlearn the material world but to articulate the moral framework for the networked one."
            else:
                arc_text = f"Your life arc unfolds entirely inside the Air Era, beginning with the {conj_yr} {conj_sign} Air conjunction. You are a native of the networked paradigm."
        else:
            arc_text = f"Your life arc moves from the {conj_yr} {conj_elem} conjunction that framed your birth into the unfolding Air Era."
        sj_section = f"""
        <p>Saturn and Jupiter meet about every 20 years, setting a distinct social and generational tone. Over longer spans, these meetings cluster by element, producing roughly 200-year civilizational eras. For this report, the 20-year conjunctions are the short gears; the elemental eras are the larger gear train.</p>
        <p>{"Su nacimiento se sitúa inmediatamente después de la conjunción de " + str(conj_yr) + " " + ES_SIGNS.get(saec["conj_sign"], saec["conj_sign"]) + " " + ES_ELEMENTS.get(conj_elem, conj_elem).lower() + "." if lang == "es" else "Your birth sits immediately after the " + str(conj_yr) + " " + saec["conj_sign"] + " " + conj_elem + " conjunction."}{" Esta fue la primera gran señal de Aire dentro de una civilización que aún operaba bajo supuestos de la Era de Tierra: masa industrial, propiedad, extracción de recursos, jerarquía burocrática e infraestructura física." if lang == "es" and conj_elem == "Air" and conj_yr < 2020 else "" if lang == "es" else " " + ("This was the first major Air signal inside a civilization still operating through Earth-era assumptions: industrial mass, property, resource extraction, bureaucratic hierarchy, and physical infrastructure." if conj_elem == "Air" and conj_yr < 2020 else "This conjunction anchored the " + conj_elem.lower() + " era that shaped the world you entered.")}</p>
        <h3>{"Qué significa esto para ti" if lang == "es" else "What this means for you"}</h3>
        <p>{arc_text}</p>
        <table>
        <thead>
        <tr><th>{"Año" if lang == "es" else "Year"}</th><th>{"Signo" if lang == "es" else "Sign"}</th><th>{"Elemento" if lang == "es" else "Element"}</th><th>{"Giro" if lang == "es" else "Turning"}</th><th>{"Significado" if lang == "es" else "Meaning"}</th></tr>
        </thead>
        <tbody>
        {sj_rows}
        </tbody>
        </table>
        """

    # ── Section 8: Life Timeline table (merged life phases + key markers) ──
    # Life phases locked to 20-year conjunction cycle, not vague age ranges
    # Find the conjunctions that bracket each 20-year life phase
    sj_conjunctions = [
        (1940, "Taurus", "Earth", "Crisis"),
        (1961, "Capricorn", "Earth", "High"),
        (1981, "Libra", "Air", "Awakening"),
        (2000, "Taurus", "Earth", "Unraveling"),
        (2020, "Aquarius", "Air", "Crisis"),
        (2040, "Libra", "Air", "High"),
        (2060, "Aquarius", "Air", "Awakening"),
    ]
    
    # Determine which conjunction frames each 20-year life phase
    def conj_for_age_block(birth_yr, age_start):
        target = birth_yr + age_start
        # Find nearest conjunction at or before target
        best = sj_conjunctions[0]
        for c in sj_conjunctions:
            if c[0] <= target:
                best = c
        return best

    if lang == "es":
        life_phases = [
            (ES["phase_childhood"], "0–20", "childhood"),
            (ES["phase_early_adult"], "20–40", "early_adult"),
            (ES["phase_midlife"], "40–60", "midlife"),
            (ES["phase_elder"], "60–80", "elder"),
        ]
        meaning_map_es = {
            "childhood": ES["meaning_childhood"],
            "early_adult": ES["meaning_early_adult"],
            "midlife": ES["meaning_midlife"],
            "elder": ES["meaning_elder"],
        }
        # ES turning names match the EN turning names; translate here.
        ES_TURN_NAMES = {
            "High": "Alto", "Awakening": "Despertar",
            "Unraveling": "Desenredo", "Crisis": "Crisis",
        }
        life_rows = ""
        for phase, age_range, stage_key in life_phases:
            age_start = int(age_range.split("–")[0])
            c = conj_for_age_block(year, age_start)
            c_year, c_sign, c_elem, c_turn = c
            yrs = f"{year + age_start}–{year + age_start + 20}"
            # Conjunction / Turning column: drop the year, show sign + turning only
            # (mirrors the English version's `weather = f"{c_sign} / {c_turn}"`)
            weather = f"{c_sign} / {ES_TURN_NAMES.get(c_turn, c_turn)}"
            life_rows += f'<tr><td><strong>{phase}</strong></td><td style="white-space:nowrap;">{age_range}</td><td style="white-space:nowrap;">{yrs}</td><td>{weather}</td><td>{meaning_map_es[stage_key]}</td></tr>'
        life_section = f"""
        <table>
        <thead>
        <tr><th>{ES['th_life_phase']}</th><th>{ES['th_age']}</th><th>{ES['th_years']}</th><th>{ES['th_conj_turn']}</th><th>{ES['th_personal_meaning']}</th></tr>
        </thead>
        <tbody>
        {life_rows}
        </tbody>
        </table>
        """
    else:
        life_rows = ""
        for phase, age_range, life_stage in [
            ("Childhood / Youth", "0–20", "Childhood / Youth"),
            ("Early Adulthood", "20–40", "Early Adulthood"),
            ("Midlife", "40–60", "Midlife"),
            ("Elder Years", "60–80", "Elder Role"),
        ]:
            age_start = int(age_range.split("–")[0])
            c = conj_for_age_block(year, age_start)
            c_year, c_sign, c_elem, c_turn = c
            yrs = f"{year + age_start}–{year + age_start + 20}"
            # Conjunction / Turning column: drop the year, show sign + turning only
            weather = f"{c_sign} / {c_turn}"
            meaning_map = {
                "Childhood / Youth": "The world you were born into was shaped by this conjunction's turning. The institutions, cultural mood, and generational archetype role it set became the default assumptions of your formative years — the 'normal' you grew up inside, which later turns would challenge you to outgrow.",
                "Early Adulthood": "You came of age under this conjunction's turning. The challenges of building independence, career, and family were all framed by the structural climate it established — what was rewarded, what was punished, what was possible. Your earliest adult decisions were shaped by its rules.",
                "Midlife": "Your most productive decades unfold under this conjunction's turning. It defines what the world needs from your generation right now — not the abstract structural pressures, but the specific challenge of matching your accumulated skill to the era's demand. This is where your career meets your calling.",
                "Elder Role": "Your elder years coincide with this conjunction's turning. The question shifts from what you build to what you hand off — the legacy, the mentorship, the wisdom earned by surviving previous turns. The cultural weather of your elder years will be shaped by this conjunction's mood.",
            }
            life_rows += f'<tr><td><strong>{phase}</strong></td><td style="white-space:nowrap;">{age_range}</td><td style="white-space:nowrap;">{yrs}</td><td>{weather}</td><td>{meaning_map[life_stage]}</td></tr>'
        life_section = f"""
        <table>
        <thead>
        <tr><th>Life Phase</th><th>Age</th><th>Years</th><th>Conjunction / Turning</th><th>Personal Meaning</th></tr>
        </thead>
        <tbody>
        {life_rows}
        </tbody>
        </table>
        """

    # ── Compute Saturn Returns for key markers ──
    natal_saturn = next((p for p in planets if p['name'] == 'Saturn'), None)
    natal_uranus = next((p for p in planets if p['name'] == 'Uranus'), None)
    
    # Build markers as a list of (year, marker_html, description) tuples, then sort chronologically
    # Marker column uses planet glyphs + context
    markers_list = []
    marker_jds = {}

    # Planet glyphs for marker column
    G = {"Saturn":"♄","Jupiter":"♃","Uranus":"♅","Neptune":"♆","Pluto":"♇"}
    ELEMENT_HEX = {"Fire":"#fdecec","Earth":"#d0e8d0","Air":"#d0e0f5","Water":"#d0dcef"}  # light tints for marker row background
    ELEMENT_FG  = {"Fire":"#c62828","Earth":"#2e7d32","Air":"#1565c0","Water":"#1976d2"}  # darker tones for sign glyph

    # Saturn-Jupiter conjunction marker data — the 7 modern conjunctions used as the structural
    # backbone of this report. Each entry is the year/sign/turning + a one-line era description
    # used for the row's "How to use" cell. The 1921 Virgo entry is the actual predecessor of
    # the 1940 conjunction; included for completeness but the 1928 Leo entry is intentionally
    # omitted (it is not an actual S-J conjunction — that boundary is a known data issue).
    SJ_MARKER_DATA = [
        (1921, "Virgo",    "Crisis",     "Earth", "Pre-modern conjunction preceding the 1940 sequence. Last pre-industrial alignment in the Earth era's opening sequence."),
        (1940, "Taurus",   "Crisis",     "Earth", "The crisis that built the world you were born into. World War II, Great Depression, and the reconstruction template that defined the post-war order. This is the structural foundation your childhood stood on — understanding it reveals why the institutions of your youth were built the way they were."),
        (1961, "Capricorn","High",       "Earth", "The civic high that framed your formative years. Suburbs, space race, Cold War consensus, and institutional confidence. This is the cultural weather you were raised in — its strengths gave you security, its blind spots gave you the contradictions you would later navigate."),
        (1981, "Libra",    "Awakening",  "Air",   "The cultural awakening of your early adulthood. First Air signal after a 160-year Earth sequence — personal computing, early networks, cultural questioning. This conjunction marked the shift from the centralized world of your youth to the decentralized one you would build your career in."),
        (2000, "Taurus",   "Unraveling", "Earth", "The unraveling of midlife. Final Earth conjunction for 600 years — dot-com bubble, 9/11, hyper-financialization, and exposed material limits. This is when the old systems started failing visibly. Your task here was to identify what was dying and position yourself for what was coming."),
        (2020, "Aquarius", "Crisis",     "Air",   "The crisis turning that locks in the Air Era. Pandemic shock, institutional reset, and unavoidable network dependency. This is the pivot point — the structures you relied on were tested, and the new paradigm became unavoidable. Review what held and what broke."),
        (2040, "Libra",    "High",       "Air",   "Projected Air High — the rebuilt civic structures of a networked world. This is the era your mature leadership helps shape. The question: what did you build that will be part of this new foundation?"),
        (2060, "Aquarius", "Awakening",  "Air",   "Projected Air Awakening — renewed cultural questioning inside the networked paradigm. Your elder years coincide with this turning. The question: what wisdom do you carry forward, and what do you release?"),
    ]
    # Spanish translations of the S-J marker descriptions, keyed by (year, sign).
    # When lang="es", we look up the ES version; otherwise we use the English desc.
    SJ_MARKER_DATA_ES = {
        (1921, "Virgo"):    "Conjunción pre-moderna que precede la secuencia de 1940. Última alineación pre-industrial en la secuencia de apertura de la Era de Tierra.",
        (1940, "Taurus"):   "La crisis que construyó el mundo en el que naciste. Segunda Guerra Mundial, Gran Depresión y la plantilla de reconstrucción que definió el orden de posguerra. Esta es la base estructural sobre la que se sostuvo tu infancia — entenderla revela por qué las instituciones de tu juventud se construyeron como se construyeron.",
        (1961, "Capricorn"):"El alto cívico que enmarcó tus años formativos. Suburbios, carrera espacial, consenso de Guerra Fría y confianza institucional. Este es el clima cultural en el que te criaste — sus fortalezas te dieron seguridad, sus puntos ciegos te dieron las contradicciones que luego tendrías que navegar.",
        (1981, "Libra"):    "El despertar cultural de tu adultez temprana. Primera señal de Aire después de una secuencia de 160 años de Tierra — computación personal, redes tempranas, cuestionamiento cultural. Esta conjunción marcó el cambio del mundo centralizado de tu juventud al descentralizado en el que construirías tu carrera.",
        (2000, "Taurus"):   "El desenredo de la mediana edad. Conjunción final de Tierra en 600 años — burbuja puntocom, 11-S, hiper-financiarización y límites materiales expuestos. Este es cuando los sistemas viejos comenzaron a fallar visiblemente. Tu tarea aquí fue identificar qué estaba muriendo y posicionarte para lo que venía.",
        (2020, "Aquarius"): "El giro de crisis que bloquea la Era de Aire. Choque pandémico, reinicio institucional y dependencia de red inevitable. Este es el punto de pivote — las estructuras en las que confiabas fueron puestas a prueba y el nuevo paradigma se volvió ineludible. Revisa qué se sostuvo y qué se rompió.",
        (2040, "Libra"):    "Alto de Aire proyectado — las estructuras cívicas reconstruidas de un mundo en red. Esta es la era que tu liderazgo maduro ayuda a dar forma. La pregunta: ¿qué construiste que será parte de esta nueva base?",
        (2060, "Aquarius"): "Despertar de Aire proyectado — cuestionamiento cultural renovado dentro del paradigma en red. Tus años de vejez coinciden con este giro. La pregunta: ¿qué sabiduría llevas adelante y qué liberas?",
    }

    # ── Anchor row: the S/J conjunction that anchors the recipient's generation
    #    Inserted FIRST (above the birth row and all other markers) and styled
    #    distinctly — colored to the element, full sign + planet glyphs, exact
    #    degree. This is the "your generational anchor" row.
    # Find the anchor conjunction (the closest one at-or-before birth)
    anchor_entry = None
    for cy, cs, turn, elem, desc in SJ_MARKER_DATA:
        if cy <= saec['conj_year']:
            anchor_entry = (cy, cs, turn, elem, desc)
    if anchor_entry is None:
        anchor_entry = SJ_MARKER_DATA[0]
    anchor_year, anchor_sign, anchor_turn, anchor_elem, anchor_desc = anchor_entry
    # Look up the Spanish description for the anchor (if applicable)
    anchor_desc_disp = SJ_MARKER_DATA_ES.get((anchor_year, anchor_sign), anchor_desc) if lang == "es" else anchor_desc
    # Compute the exact degree of the conjunction via bisection on the year window
    # (kept for potential future use but the anchor row no longer shows the degree —
    #  it now matches the rest of the marker column for visual consistency)
    a_jd_start = swe.julday(anchor_year, 1, 1, 0)
    a_jd_end   = swe.julday(anchor_year + 1, 1, 1, 0)
    a_best_jd  = a_jd_start
    a_best_orb = 360.0
    for d in range(int(a_jd_start), int(a_jd_end) + 1):
        sat, _ = swe.calc_ut(d, swe.SATURN, swe.FLG_SWIEPH)
        jup, _ = swe.calc_ut(d, swe.JUPITER, swe.FLG_SWIEPH)
        diff = (sat[0] - jup[0] + 180) % 360 - 180
        if abs(diff) < abs(a_best_orb):
            a_best_orb = diff
            a_best_jd = d
    # Refine via bisection
    lo, hi = a_best_jd - 1, a_best_jd + 1
    for _ in range(50):
        mid = (lo + hi) / 2
        sat, _ = swe.calc_ut(mid, swe.SATURN, swe.FLG_SWIEPH)
        jup, _ = swe.calc_ut(mid, swe.JUPITER, swe.FLG_SWIEPH)
        diff = (sat[0] - jup[0] + 180) % 360 - 180
        sat_lo, _ = swe.calc_ut(lo, swe.SATURN, swe.FLG_SWIEPH)
        jup_lo, _ = swe.calc_ut(lo, swe.JUPITER, swe.FLG_SWIEPH)
        diff_lo = ((sat_lo[0] - jup_lo[0]) % 360 + 180) % 360 - 180
        if abs(diff_lo) < abs(diff):
            hi = mid
        else:
            lo = mid
    anchor_sign_glyph = SIGN_GLYPHS[SIGNS.index(anchor_sign)]
    anchor_bg = ELEMENT_HEX.get(anchor_elem, "#f8f8f8")
    anchor_fg = ELEMENT_FG.get(anchor_elem, "#222")
    # Anchor row matches the rest of the marker column exactly — same format
    # as the other S-J conjunction rows: ♄☌♃ in ♉ Taurus — High turning, Earth
    # Uses the same 16px glyphs and same italic style. The element-tinted
    # background and bold weight make this row visually distinct as the anchor.
    # Spanish: turn name + element translated, anchor label translated.
    ES_TURN_NAMES_ANCHOR = {
        "High": "Alto", "Awakening": "Despertar",
        "Unraveling": "Desenredo", "Crisis": "Crisis",
    }
    ES_ELEMENTS_ANCHOR = {
        "Fire": "Fuego", "Earth": "Tierra", "Air": "Aire", "Water": "Agua",
    }
    ES_SIGNS_ANCHOR = {
        "Aries": "Aries", "Taurus": "Tauro", "Gemini": "Géminis",
        "Cancer": "Cáncer", "Leo": "Leo", "Virgo": "Virgo",
        "Libra": "Libra", "Scorpio": "Escorpio", "Sagittarius": "Sagitario",
        "Capricorn": "Capricornio", "Aquarius": "Acuario", "Pisces": "Piscis",
    }
    if lang == "es":
        anchor_turn_disp = ES_TURN_NAMES_ANCHOR.get(anchor_turn, anchor_turn)
        anchor_elem_disp = ES_ELEMENTS_ANCHOR.get(anchor_elem, anchor_elem)
        anchor_sign_disp = ES_SIGNS_ANCHOR.get(anchor_sign, anchor_sign)
        anchor_desc_label = "Ancla Generacional"
    else:
        anchor_turn_disp = anchor_turn
        anchor_elem_disp = anchor_elem
        anchor_sign_disp = anchor_sign
        anchor_desc_label = "Generational anchor"
    anchor_row_html = (
        f'<tr style="background-color:{anchor_bg};page-break-inside:avoid;font-weight:bold;">'
        f'<td style="white-space:nowrap;">{anchor_year}</td>'
        f'<td style="white-space:nowrap;text-align:center;">—</td>'
        f'<td>'
        f'<span class="astroglyph" style="font-size:16px;color:{anchor_fg};">♄☌♃</span> '
        f'{"en" if lang == "es" else "in"} {anchor_sign_glyph} {anchor_sign_disp} — <span style="font-style:italic;">{anchor_turn_disp}, {anchor_elem_disp}</span>'
        f'</td>'
        f'<td>'
        f'<strong>{anchor_desc_label}</strong> — {anchor_desc_disp}'
        f'</td>'
        f'</tr>'
    )

    # Birth row — uses actual birth year and age 0 (NOT the anchor year)
    if lang == "es":
        conj_sign_str_disp = ES_SIGNS_ANCHOR.get(saec['conj_sign'], saec['conj_sign'])
        birth_label = "Nacimiento"
        birth_turn_disp = ES_TURN_NAMES_ANCHOR.get(anchor_turn, anchor_turn)
        birth_imprint_text = f"Impronta de Nacimiento — giro {birth_turn_disp} — {anchor_desc_disp}"
        birth_marker_html = f'<span class="astroglyph">Birth</span> {conj_sign_str_disp}'  # "Birth" is the rendering label, kept as-is per existing style
        # Wait — the marker column uses the "Birth" word. Translate:
        birth_marker_html = f'<span class="astroglyph">Nacimiento</span> {conj_sign_str_disp}'
    else:
        conj_sign_str_disp = saec['conj_sign']
        birth_label = "Birth"
        birth_turn_disp = anchor_turn
        birth_imprint_text = f"Birth imprint — {anchor_turn} turning — {anchor_desc}"
        birth_marker_html = f'<span class="astroglyph">Birth</span> {conj_sign_str_disp}'
    birth_row = (
        year,  # actual birth year (e.g., 1975 for Ian)
        0,     # age 0
        birth_marker_html,
        birth_imprint_text
    )

    # Saturn Returns — ♄ return glyph
    if natal_saturn:
        sr_results = find_saturn_returns(natal_saturn['lon_num'], jd, swe)
        for sr_jd, sr_year in sr_results:
            age_at_return = sr_year - year
            if lang == "es":
                sr_num = ES["sr_first"] if age_at_return < 40 else ES["sr_second"]
                sr_label = ES["saturn_return"]
                sr_desc = ES["sr_desc"].format(age=age_at_return)
            else:
                sr_num = "First" if age_at_return < 40 else "Second"
                sr_label = "Return"
                # Action-oriented "How to use" — tied to the actual life stage
                if age_at_return < 35:
                    sr_desc = f"At age {age_at_return}, the structural commitments you made in your 20s come up for review. Career path, relationship patterns, financial obligations. The question: which of these still serves the person you are now, and which need to be renegotiated or released?"
                else:
                    sr_desc = f"At age {age_at_return}, the structures you built in your first Saturn Return face their first real stress test. The question is no longer 'what am I building?' but 'what of what I built is worth keeping, and what needs to be released so the next phase has room to grow?'"
            marker_label = f'{sr_num} <span class="astroglyph">♄</span> {sr_label}'
            marker_jds[marker_label] = sr_jd
            markers_list.append((
                sr_year,
                marker_label,
                age_at_return,
                sr_desc
            ))

    # Uranus opposition — ♅ opposition glyph
    if natal_uranus:
        uo_result = find_uranus_opposition(natal_uranus['lon_num'], jd, swe)
        if uo_result:
            uo_jd, uo_year = uo_result
            age_at_uo = uo_year - year
            if lang == "es":
                uo_label = ES["uranus_opp"]
                uo_desc = ES["uo_desc"].format(age=age_at_uo)
            else:
                uo_label = "Opposition"
                uo_desc = f"At age {age_at_uo}, the cosmic clock fires its 'do not settle' signal. Patterns that looked permanent in your 30s start feeling like costumes. The question: which of your current identities, relationships, and daily structures are still yours — and which were inherited from the version of you that needed them then? This is the midlife permission slip to experiment with what is actually true now."
            marker_label = f'<span class="astroglyph">♅</span> {uo_label}'
            marker_jds[marker_label] = uo_jd
            markers_list.append((
                uo_year,
                marker_label,
                age_at_uo,
                uo_desc
            ))

    # Saturn-Neptune conjunction — ♄♆ conjunction glyph
    sn_result = find_saturn_neptune_conjunction(jd, swe)
    if sn_result:
        sn_jd, sn_year, sn_sign = sn_result
        age_at_sn = sn_year - year
        sn_y, sn_m, sn_d, _ = swe.revjul(sn_jd)
        sn_date = _dt.date(sn_y, sn_m, sn_d)
        if lang == "es":
            sn_date_text = f"{sn_d} de {_meses[sn_m - 1]} de {sn_y}"
            sn_desc = f"El {sn_date_text}, a los {age_at_sn} años, Saturno y Neptuno se encontraron en {ES_SIGNS.get(sn_sign, sn_sign)}. Esta alineación unió la realidad estructural con la imaginación visionaria: una invitación a distinguir las ilusiones vencidas de los sueños que pueden construirse sobre bases firmes."
            sn_marker_label = f'<span class="astroglyph">♄☌♆</span> en {ES_SIGNS.get(sn_sign, sn_sign)}'
        else:
            sn_date_text = sn_date.strftime("%B %d, %Y")
            sn_desc = f"On {sn_date_text}, at age {age_at_sn}, Saturn and Neptune met in {sn_sign}. This rare alignment joined structural reality with visionary imagination: an invitation to distinguish expired illusions from dreams that can be built on solid ground."
            sn_marker_label = f'<span class="astroglyph">♄☌♆</span> in {sn_sign}'
        marker_jds[sn_marker_label] = sn_jd
        markers_list.append((
            sn_year,
            sn_marker_label,
            age_at_sn,
            sn_desc
        ))

    # Note: collective S-J conjunction era descriptions are already covered by the
    # Life Timeline table above. The Markers table below shows only personal
    # transits (Saturn Return, Uranus Opposition, Saturn-Neptune conjunction,
    # Uranus-Saturn conjunction) and a "Now" anchor row for the reader's present.
    # Uranus-Saturn conjunction (different cycle, not a S-J conjunction)
    us_text = ES["us_marker"] if lang == "es" else "Uranus-Saturn conjunction: Midlife restructuring of language, education, localized infrastructure, and your immediate practical communication frameworks."
    if lang == "es":
        us_marker_label = '<span class="astroglyph">♅☌♄</span> en Géminis'
    else:
        us_marker_label = '<span class="astroglyph">♅☌♄</span> in Gemini'
    markers_list.append((
        2032, us_marker_label,
        2032 - year,
        us_text
    ))

    # ── S-J conjunction markers (all except the anchor year) ──
    # Each S-J conjunction in the modern era gets its own row, with the element
    # color tint of its sign and a one-line era description. The anchor year
    # itself is rendered as a separate, special row above (see anchor_row_html).
    for cy, cs, turn, elem, desc in SJ_MARKER_DATA:
        if cy == anchor_year:
            continue  # already shown as the anchor row
        # Skip pre-birth conjunctions (those before the recipient's life start)
        if cy < year:
            continue
        sign_glyph = SIGN_GLYPHS[SIGNS.index(cs)]
        bg = ELEMENT_HEX.get(elem, "#f8f8f8")
        # Each S-J row is colored to its element, with the sign glyph in the foreground
        sj_age = cy - year
        # Translate turn name + sign + element for Spanish
        if lang == "es":
            turn_disp = ES_TURN_NAMES_ANCHOR.get(turn, turn)
            sign_disp = ES_SIGNS_ANCHOR.get(cs, cs)
            elem_disp = ES_ELEMENTS_ANCHOR.get(elem, elem)
            desc_disp = SJ_MARKER_DATA_ES.get((cy, cs), desc)
        else:
            turn_disp = turn
            sign_disp = cs
            elem_disp = elem
            desc_disp = desc
        sj_marker_html = (
            f'<span class="astroglyph" style="font-size:16px;color:{ELEMENT_FG.get(elem, "#222")};">♄☌♃</span> '
            f'{"en" if lang == "es" else "in"} {sign_glyph} {sign_disp} — <span style="font-style:italic;">{turn_disp}, {elem_disp}</span>'
        )
        markers_list.append((cy, sj_marker_html, sj_age, f"{turn_disp} turning — {desc_disp}" if lang != "es" else f"giro {turn_disp} — {desc_disp}"))

    # Sort exact personal transits by Julian date; year-only collective markers
    # fall at the start of their stated year.
    markers_list.sort(key=lambda x: marker_jds.get(x[1], swe.julday(int(x[0]), 1, 1, 0)))

    # Build a "Now" row showing today's date and current age
    import datetime as _dt
    _now = _dt.datetime.now()
    _now_age = _now.year - year
    # Format the date in the appropriate language
    if lang == "es":
        _now_date_str = _now.strftime("%d de %B de %Y").replace(
            _now.strftime("%B"), ["enero","febrero","marzo","abril","mayo","junio",
                                  "julio","agosto","septiembre","octubre","noviembre","diciembre"][_now.month-1]
        )
    else:
        _now_date_str = _now.strftime("%B %d, %Y")
    _now_year_str = _now.strftime("%Y")

    marker_rows = ""
    # Insert the anchor row at the top, then the birth row, then the rest of the markers
    marker_rows = anchor_row_html
    # Birth row goes right after the anchor row
    by, ba, bm, bh = birth_row
    marker_rows += f'<tr style="background-color:#ffffff;page-break-inside:avoid;"><td style="white-space:nowrap;"><strong>{by}</strong></td><td style="white-space:nowrap;text-align:center;"><strong>{ba}</strong></td><td>{bm}</td><td>{bh}</td></tr>'

    if lang == "es":
        now_marker_label = "Ahora"
        now_desc_text = f"Ahora — {_now_date_str} — posición actual en la línea de tiempo. Los marcadores arriba son pasados, abajo son futuros."
    else:
        now_marker_label = "Now"
        now_desc_text = f"Now — {_now_date_str} — current position on the timeline. The markers above are past, below are future."

    prev_status = None
    for yr, marker, age, how in markers_list:
        status = time_status(yr, marker_jds.get(marker))
        # Insert a red divider row between past and future markers
        if prev_status == "past" and status != "past":
            marker_rows += '<tr><td colspan="4" style="border:none;border-top:2px solid #d44a4a;padding:2px 0;"></td></tr>'
            # Insert the "Now" row directly under the red line, with light yellow background
            marker_rows += f'<tr style="background-color:#fff8e1;page-break-inside:avoid;"><td style="white-space:nowrap;"><strong>{_now_year_str}</strong></td><td style="white-space:nowrap;text-align:center;"><strong>{_now_age}</strong></td><td><strong>{now_marker_label}</strong></td><td><strong>{now_desc_text}</strong></td></tr>'
        prev_status = status
        marker_rows += f'<tr style="page-break-inside:avoid;"><td style="white-space:nowrap;">{yr}</td><td style="white-space:nowrap;text-align:center;">{age}</td><td>{marker}</td><td>{how}</td></tr>'

    if lang == "es":
        markers_section = f"""
    <table>
    <thead>
    <tr><th>{ES['th_marker_year']}</th><th>Edad</th><th>{ES['th_marker']}</th><th>{ES['th_how']}</th></tr>
    </thead>
    <tbody>
    {marker_rows}
    </tbody>
    </table>
    <p style="font-size:9px;color:#888;margin-top:4px;">La línea roja separa los marcadores pasados de los futuros.</p>
    """
    else:
        markers_section = f"""
    <table>
    <thead>
    <tr><th>Year</th><th>Age</th><th>Marker</th><th>How to use it</th></tr>
    </thead>
    <tbody>
    {marker_rows}
    </tbody>
    </table>
    <p style="font-size:9px;color:#888;margin-top:4px;">The red line separates past markers from future ones.</p>
    """

    # ── Appendix: Planet Placements table ──
    # Calculate whole-sign house for each planet
    asc_sign_idx = int(asc // 30)
    planet_houses = {}
    for p in planets:
        sign_idx = int(p["lon_num"] // 30)
        planet_houses[p["name"]] = ((sign_idx - asc_sign_idx) % 12) + 1

    planet_rows = ""
    for p in planets:
        p_name = ES_PLANET_NAMES.get(p['name'], p['name']) if lang == "es" else p['name']
        p_sign = ES_SIGNS.get(p['sign'], p['sign']) if lang == "es" else p['sign']
        p_elem = ES_ELEMENTS.get(p['element'], p['element']) if lang == "es" else p['element']
        p_qual = ES_QUALITIES.get(p['quality'], p['quality']) if lang == "es" else p['quality']
        h_num = planet_houses.get(p['name'], '')
        h_label = f"Casa {h_num}" if lang == "es" else f"House {h_num}"
        interp = p.get('interpretation', '') if lang != 'es' else ''
        if lang == 'es' and not interp:
            # Try Spanish interpretations
            es_interp_path = os.path.normpath(os.path.join(PROJECT, "report-engine", "templates", "planet-sign-interpretations_es.json"))
            if os.path.exists(es_interp_path):
                with open(es_interp_path, 'r', encoding='utf-8') as es_f:
                    es_interps = json.load(es_f)
                interp = es_interps.get(p['name'], {}).get(p['sign'], '')
        planet_rows += f"""
        <tr>
            <td style="font-size:14px;text-align:center;" class="astroglyph">{p['glyph']}</td>
            <td><strong>{p_name}</strong></td>
            <td>{p_sign} {p['deg']}°{p['min']:02d}'</td>
            <td>{h_label}</td>
            <td>{p_elem}</td>
            <td>{p_qual}</td>
        </tr>
        {"<tr><td></td><td colspan='5' style='font-size:9px;color:#555;padding:1px 4px 4px 4px;border-top:none;'>" + interp + "</td></tr>" if interp else ""}"""

    asc_deg = int(degree_in_sign(asc))
    asc_min = int((degree_in_sign(asc) % 1) * 60)
    mc_deg = int(degree_in_sign(mc))
    mc_min = int((degree_in_sign(mc) % 1) * 60)
    mc_house = ((int(mc // 30) - asc_sign_idx) % 12) + 1
    planet_rows += f"""
        <tr>
            <td style="font-size:14px;text-align:center;font-weight:bold;color:#e74c3c;" class="astroglyph">AC</td>
            <td><strong>{ES['ascendant'] if lang == 'es' else 'Ascendant'}</strong></td>
            <td>{asc_sign} {asc_deg}°{asc_min:02d}'</td>
            <td>H1</td>
            <td>{ELEMENTS[asc_sign]}</td>
            <td>{QUALITIES[asc_sign]}</td>
        </tr>
        <tr>
            <td style="font-size:14px;text-align:center;font-weight:bold;color:#3498db;" class="astroglyph">MC</td>
            <td><strong>{ES['midheaven'] if lang == 'es' else 'Midheaven'}</strong></td>
            <td>{mc_sign} {mc_deg}°{mc_min:02d}'</td>
            <td>H{mc_house}</td>
            <td>{ELEMENTS[mc_sign]}</td>
            <td>{QUALITIES[mc_sign]}</td>
        </tr>"""

    # ── Appendix: Aspects table ──
    # Color coding: hard aspects (Conjunction, Square, Opposition) get red tones;
    # soft aspects (Sextile, Trine) get blue tones. Aspect glyph is red/blue.
    # Planet glyphs are kept BLACK for legibility — the row background tints and
    # aspect symbol carry the hard/soft distinction, and the planet identity is
    # already known from the planet name cell.
    HARD_ASPECTS = {"Conjunction", "Square", "Opposition"}
    HARD_ROW_BG  = "#fdecec"   # light red background
    SOFT_ROW_BG  = "#e6f0fa"   # light blue background
    HARD_GLYPH   = "#c62828"   # red aspect symbol
    SOFT_GLYPH   = "#1565c0"   # blue aspect symbol
    PLANET_FG    = "#222222"   # black for all planet glyphs
    aspect_rows = ""
    for p1, p2, d, name, orb, target, meaning, glyph in aspects[:10]:
        p1_name = ES_PLANET_NAMES.get(p1['name'], p1['name']) if lang == "es" else p1['name']
        p2_name = ES_PLANET_NAMES.get(p2['name'], p2['name']) if lang == "es" else p2['name']
        asp_name_es = {"Conjunction":"Conjunción","Sextile":"Sextil","Square":"Cuadratura","Trine":"Trígono","Opposition":"Oposición"}.get(name, name)
        asp_name = asp_name_es if lang == "es" else name
        asp_meaning = ES_ASPECT_MEANINGS.get(name, meaning) if lang == "es" else meaning
        # Pick row color and aspect glyph color by aspect family
        is_hard = name in HARD_ASPECTS
        row_bg = HARD_ROW_BG if is_hard else SOFT_ROW_BG
        aspect_color = HARD_GLYPH if is_hard else SOFT_GLYPH
        # Planet glyphs are always black (matches box-row treatment, prints cleanly)
        p1_color = PLANET_FG
        p2_color = PLANET_FG
        aspect_mark = aspect_glyph_html(name, aspect_color, 17)
        aspect_rows += f"""
        <tr style="background-color:{row_bg};">
            <td style="font-size:16px;text-align:center;" class="astroglyph">
                <span style="color:{p1_color};">{p1['glyph']}</span>
                <span style="display:inline-block;margin:0 3px;">{aspect_mark}</span>
                <span style="color:{p2_color};">{p2['glyph']}</span>
            </td>
            <td>{p1_name} {asp_name} {p2_name}</td>
            <td>{orb:.1f}°</td>
            <td>{asp_meaning}</td>
        </tr>"""

    # ── Load narrative prose ──
    prose = load_narrative(saec['archetype'], sun_sign, moon_sign, asc_sign, lang=lang)
    if prose:
        prose = prose.replace("[SECTION_4_TABLE]", sj_section)
        timeline_svg = build_generational_screw_svg(
            recipient_name, year,
            birth_date=birth_date,
            birth_time=birth_time,
            birth_location=birth_location,
            display_year=current_year,
            display_date=prepared_date,
            lang=lang,
        )
        timeline_svg_uri = base64.b64encode(timeline_svg.encode("utf-8")).decode("ascii")
        prose = prose.replace(
            "[TIMELINE_IMAGE]",
            f'<div style="text-align:center; margin:14px 0 12px;">'
            f'<img src="data:image/svg+xml;base64,{timeline_svg_uri}" '
            f'alt="Generational screw and saeculum timeline" '
            f'style="display:block; width:100%; height:auto;"/></div>'
        )
        prose = prose.replace("[LIFE_TIMELINE_TABLE]", life_section)
        prose = prose.replace("[KEY_MARKERS_TABLE]", markers_section)
        # The Hero narrative files already contain "1. The Macro Weather" etc., so do
        # not prepend another Section 1 heading. Just normalize spacing.
        narrative_html = prose_to_html(prose)
    else:
        narrative_html = ES["narrative_not_found"].format(arch=saec['archetype'], sun=sun_sign) if lang == "es" else f"<h2>1. Your Cosmic Weather</h2><p>Report prose template not found for {saec['archetype']} / {sun_sign}.</p>"

    # ── Build chart page SVG using the standalone chart generator ──
    sun_lon = next((p["lon_num"] for p in planets if p["name"] == "Sun"), 0)
    moon_lon = next((p["lon_num"] for p in planets if p["name"] == "Moon"), 0)
    chart_ruler, master, predominator, is_day = calculate_hellenistic_rulers(planets, asc, sun_lon, moon_lon)
    rulers = {"chart_ruler": chart_ruler, "master": master, "predominator": predominator, "is_day": is_day}

    house_sys_label = ES["chart_house_system"] if lang == "es" else "Whole Houses"
    chart_title_label = "Carta Natal" if lang == "es" else "Natal Chart"
    chart_svg = build_chart_svg(planets, asc, mc, recipient_name, birth_date, birth_time, birth_location, house_sys_label, jd=jd, chart_title=chart_title_label, lang=lang)

    # Convert chart SVG to a single-page PDF via cairosvg
    chart_pdf_path = os.path.join(tempfile.gettempdir(), f"chart_page_{year}{month:02d}{day:02d}.pdf")
    # CairoSVG interprets the SVG's unitless dimensions as 96-DPI CSS pixels.
    # A 612×792 viewBox therefore needs a 96/72 scale to produce an actual
    # 612×792-point US Letter PDF page. scale=2 created a 918×1188 page that
    # printer drivers cropped instead of fitting.
    cairosvg.svg2pdf(bytestring=chart_svg.encode('utf-8'), write_to=chart_pdf_path, scale=96 / 72)
    print(f"[report] Chart page PDF: {chart_pdf_path} ({os.path.getsize(chart_pdf_path)//1024} KB)")

    # ── Build TL;DR / Cosmic Cheat Sheet ──
    # A visually striking, scannable one-pager designed to be screenshotted and shared.
    sun_glyph = next((p['glyph'] for p in planets if p['name'] == 'Sun'), '☉')
    moon_glyph = next((p['glyph'] for p in planets if p['name'] == 'Moon'), '☽')
    sun_sign_glyph = SIGN_GLYPHS[SIGNS.index(sun_sign)] if sun_sign in SIGNS else ''
    moon_sign_glyph = SIGN_GLYPHS[SIGNS.index(moon_sign)] if moon_sign in SIGNS else ''
    asc_sign_glyph = SIGN_GLYPHS[SIGNS.index(asc_sign)] if asc_sign in SIGNS else ''
    sun_elem_color = ELEMENT_COLORS.get(ELEMENTS.get(sun_sign, ''), '#333')
    moon_elem_color = ELEMENT_COLORS.get(ELEMENTS.get(moon_sign, ''), '#333')
    asc_elem_color = ELEMENT_COLORS.get(ELEMENTS.get(asc_sign, ''), '#333')

    # Top 3 aspects for the cheat sheet
    cheat_aspects = ""
    for p1, p2, d, name, orb, target, meaning, glyph in aspects[:3]:
        aspect_mark = aspect_glyph_html(name, '#c62828' if name in HARD_ASPECTS else '#1565c0', 17)
        cheat_aspects += f"<span style='font-size:18px;' class='astroglyph'>{p1['glyph']}</span>{aspect_mark}<span style='font-size:18px;' class='astroglyph'>{p2['glyph']}</span> <span style='font-size:9pt;color:#555;'>{name} {orb:.1f}°</span><br>"

    if lang == "es":
        cheat_sheet = f"""
<div style="page-break-before:always; page-break-after:always; border:3px solid #1a3a5c; border-radius:12px; padding:28px; margin:0; background:linear-gradient(135deg,#f8fbff 0%,#eef4fa 100%);">
<div style="text-align:center; margin-bottom:20px;">
<div style="font-size:11pt; letter-spacing:3px; color:#1a3a5c; text-transform:uppercase; font-weight:bold;">Hoja de Referencia Cósmica</div>
<div style="font-size:8pt; color:#888; margin-top:4px;">{recipient_name} · {birth_date}</div>
</div>
<table style="border:none; width:100%; margin:0;">
<tr style="border:none;">
<td style="border:none; text-align:center; width:33%; padding:14px 8px;">
<div style="font-size:28px; color:{sun_elem_color};" class="astroglyph">{sun_glyph}</div>
<div style="font-size:22px; color:{sun_elem_color}; margin-top:4px;" class="astroglyph">{sun_sign_glyph}</div>
<div style="font-size:10pt; font-weight:bold; color:#1a3a5c; margin-top:6px;">Sol en {ES_SIGNS.get(sun_sign, sun_sign)}</div>
<div style="font-size:8pt; color:#666;">{ES_ELEMENTS.get(ELEMENTS.get(sun_sign,''), ELEMENTS.get(sun_sign,''))} · {ES_QUALITIES.get(QUALITIES.get(sun_sign,''), QUALITIES.get(sun_sign,''))}</div>
</td>
<td style="border:none; text-align:center; width:33%; padding:14px 8px;">
<div style="font-size:28px; color:{moon_elem_color};" class="astroglyph">{moon_glyph}</div>
<div style="font-size:22px; color:{moon_elem_color}; margin-top:4px;" class="astroglyph">{moon_sign_glyph}</div>
<div style="font-size:10pt; font-weight:bold; color:#1a3a5c; margin-top:6px;">Luna en {ES_SIGNS.get(moon_sign, moon_sign)}</div>
<div style="font-size:8pt; color:#666;">{ES_ELEMENTS.get(ELEMENTS.get(moon_sign,''), ELEMENTS.get(moon_sign,''))} · {ES_QUALITIES.get(QUALITIES.get(moon_sign,''), QUALITIES.get(moon_sign,''))}</div>
</td>
<td style="border:none; text-align:center; width:33%; padding:14px 8px;">
<div style="font-size:22px; color:{asc_elem_color};" class="astroglyph">AC</div>
<div style="font-size:22px; color:{asc_elem_color}; margin-top:4px;" class="astroglyph">{asc_sign_glyph}</div>
<div style="font-size:10pt; font-weight:bold; color:#1a3a5c; margin-top:6px;">{ES_SIGNS.get(asc_sign, asc_sign)} Ascendente</div>
<div style="font-size:8pt; color:#666;">{ES_ELEMENTS.get(ELEMENTS.get(asc_sign,''), ELEMENTS.get(asc_sign,''))} · {ES_QUALITIES.get(QUALITIES.get(asc_sign,''), QUALITIES.get(asc_sign,''))}</div>
</td>
</tr>
</table>
<div style="border-top:2px solid rgba(26,58,92,0.15); margin:16px 0; padding-top:14px;">
<table style="border:none; width:100%; margin:0; font-size:9.5pt;">
<tr style="border:none;">
<td style="border:none; width:50%; padding:6px 10px;"><strong>Generación:</strong> {ES_GEN_NAMES.get(saec['name'],saec['name'])} / {ES_ARCH_NAMES.get(saec['archetype'],saec['archetype'])}</td>
<td style="border:none; width:50%; padding:6px 10px;"><strong>Giro de nacimiento:</strong> {ES_TURNING_NAMES.get(saec['turning'],saec['turning'])}</td>
</tr>
<tr style="border:none;">
<td style="border:none; padding:6px 10px;"><strong>Ancla S-J:</strong> {saec['conj_year']} {ES_SIGNS.get(saec['conj_sign'],saec['conj_sign'])} {ES_ELEMENTS.get(saec['conj_element'],saec['conj_element'])}</td>
<td style="border:none; padding:6px 10px;"><strong>Posición de Yuga:</strong> {yuga_label}</td>
</tr>
<tr style="border:none;">
<td style="border:none; padding:6px 10px;"><strong>Era Elemental:</strong> {era_label}</td>
<td style="border:none; padding:6px 10px;"><strong>Señor de la Carta:</strong> {chart_ruler}</td>
</tr>
</table>
</div>
<div style="border-top:2px solid rgba(26,58,92,0.15); margin:14px 0; padding-top:12px;">
<div style="font-size:9pt; font-weight:bold; color:#1a3a5c; margin-bottom:8px;">Aspectos Clave</div>
<div style="text-align:center; line-height:2.2;">{cheat_aspects}</div>
</div>
<div style="border-top:2px solid rgba(26,58,92,0.15); margin:14px 0; padding-top:10px; text-align:center;">
<div style="font-size:8pt; color:#888;">Zodiyuga SkyClock · zodiyuga.com</div>
</div>
</div>
"""
    else:
        cheat_sheet = f"""
<div style="page-break-before:always; page-break-after:always; border:3px solid #1a3a5c; border-radius:12px; padding:28px; margin:0; background:linear-gradient(135deg,#f8fbff 0%,#eef4fa 100%);">
<div style="text-align:center; margin-bottom:20px;">
<div style="font-size:11pt; letter-spacing:3px; color:#1a3a5c; text-transform:uppercase; font-weight:bold;">Cosmic Cheat Sheet</div>
<div style="font-size:8pt; color:#888; margin-top:4px;">{recipient_name} &middot; {birth_date}</div>
</div>
<table style="border:none; width:100%; margin:0;">
<tr style="border:none;">
<td style="border:none; text-align:center; width:33%; padding:14px 8px;">
<div style="font-size:28px; color:{sun_elem_color};" class="astroglyph">{sun_glyph}</div>
<div style="font-size:22px; color:{sun_elem_color}; margin-top:4px;" class="astroglyph">{sun_sign_glyph}</div>
<div style="font-size:10pt; font-weight:bold; color:#1a3a5c; margin-top:6px;">Sun in {sun_sign}</div>
<div style="font-size:8pt; color:#666;">{ELEMENTS.get(sun_sign,'')} &middot; {QUALITIES.get(sun_sign,'')}</div>
</td>
<td style="border:none; text-align:center; width:33%; padding:14px 8px;">
<div style="font-size:28px; color:{moon_elem_color};" class="astroglyph">{moon_glyph}</div>
<div style="font-size:22px; color:{moon_elem_color}; margin-top:4px;" class="astroglyph">{moon_sign_glyph}</div>
<div style="font-size:10pt; font-weight:bold; color:#1a3a5c; margin-top:6px;">Moon in {moon_sign}</div>
<div style="font-size:8pt; color:#666;">{ELEMENTS.get(moon_sign,'')} &middot; {QUALITIES.get(moon_sign,'')}</div>
</td>
<td style="border:none; text-align:center; width:33%; padding:14px 8px;">
<div style="font-size:22px; color:{asc_elem_color};" class="astroglyph">AC</div>
<div style="font-size:22px; color:{asc_elem_color}; margin-top:4px;" class="astroglyph">{asc_sign_glyph}</div>
<div style="font-size:10pt; font-weight:bold; color:#1a3a5c; margin-top:6px;">{asc_sign} Rising</div>
<div style="font-size:8pt; color:#666;">{ELEMENTS.get(asc_sign,'')} &middot; {QUALITIES.get(asc_sign,'')}</div>
</td>
</tr>
</table>
<div style="border-top:2px solid rgba(26,58,92,0.15); margin:16px 0; padding-top:14px;">
<table style="border:none; width:100%; margin:0; font-size:9.5pt;">
<tr style="border:none;">
<td style="border:none; width:50%; padding:6px 10px;"><strong>Generation:</strong> {saec['name']} / {saec['archetype']}</td>
<td style="border:none; width:50%; padding:6px 10px;"><strong>Birth Turning:</strong> {saec['turning']}</td>
</tr>
<tr style="border:none;">
<td style="border:none; padding:6px 10px;"><strong>S-J Anchor:</strong> {saec['conj_year']} {saec['conj_sign']} {saec['conj_element']}</td>
<td style="border:none; padding:6px 10px;"><strong>Yuga Position:</strong> {yuga_label}</td>
</tr>
<tr style="border:none;">
<td style="border:none; padding:6px 10px;"><strong>Elemental Era:</strong> {era_label}</td>
<td style="border:none; padding:6px 10px;"><strong>Chart Ruler:</strong> {chart_ruler}</td>
</tr>
</table>
</div>
<div style="border-top:2px solid rgba(26,58,92,0.15); margin:14px 0; padding-top:12px;">
<div style="font-size:9pt; font-weight:bold; color:#1a3a5c; margin-bottom:8px;">Key Aspects</div>
<div style="text-align:center; line-height:2.2;">{cheat_aspects}</div>
</div>
<div style="border-top:2px solid rgba(26,58,92,0.15); margin:14px 0; padding-top:10px; text-align:center;">
<div style="font-size:8pt; color:#888;">Zodiyuga SkyClock &middot; zodiyuga.com</div>
</div>
</div>
"""

    # ── Language-specific houses HTML ──
    english_houses = [
        ("House 1 — The Helm", "Body, character, life, appearance, and manner.", "The rising sign establishes the first house and orients every other place. Planets here describe the native's embodied condition and direct way of meeting life."),
        ("House 2 — Livelihood and Possessions", "Income, possessions, sustenance, and material support.", "This place describes the resources that support life and the native's practical relationship to acquiring, preserving, and using them."),
        ("House 3 — The Goddess", "Siblings and relatives, communication, local journeys, and religious practice.", "Traditionally the Moon's place of joy, the third concerns the familiar routes, kinship ties, messages, and everyday devotions that connect one life to its near surroundings."),
        ("House 4 — The Subterraneous Place", "Parents, home, land, ancestry, foundations, and endings.", "This place describes roots: family inheritance, dwelling, immovable property, and the foundations from which life arises and to which matters eventually return."),
        ("House 5 — Good Fortune", "Children, pleasure, creativity, gifts, and generative activity.", "Traditionally Venus's place of joy, the fifth concerns enjoyment, fertility, artistic expression, and what the native brings forth or receives with delight."),
        ("House 6 — Bad Fortune", "Illness and injury, labor, service, subordinates, and hardship.", "Traditionally Mars's place of joy, the sixth describes bodily strain, necessary work, and difficult conditions that require skill, endurance, and practical care."),
        ("House 7 — The Setting Place", "Marriage, partners, contracts, alliances, and open opponents.", "Opposite the Ascendant, the seventh describes consequential encounters with others: those who join the native, bargain with them, or meet them in direct contest."),
        ("House 8 — The Idle Place", "Death, inheritance, debt, others' resources, and anxiety around loss.", "The eighth concerns what comes through others or remains beyond direct control, including inheritances, liabilities, mortality, and the management of shared obligations."),
        ("House 9 — God", "Religion, divination, higher learning, teaching, and long journeys.", "Traditionally the Sun's place of joy, the ninth concerns encounters with meaning at a distance: sacred practice, prophecy, philosophy, advanced study, and travel abroad."),
        ("House 10 — Praxis", "Action, reputation, public responsibilities, profession, and authority.", "The tenth describes visible action in the world and the responsibilities for which a person becomes known. In whole-sign houses the Midheaven is shown separately and may fall outside the tenth house."),
        ("House 11 — Good Spirit", "Friends, allies, patronage, communities, hopes, and benefits.", "Traditionally Jupiter's place of joy, the eleventh describes support from friends and benefactors, collaborative networks, and hopes that can be advanced through alliance."),
        ("House 12 — Bad Spirit", "Enemies, confinement, suffering, isolation, and large animals.", "Traditionally Saturn's place of joy, the twelfth concerns hidden opposition and conditions that limit agency, calling for patience, boundaries, and sober recognition."),
    ]
    spanish_houses = [
        ("Casa I — El Timón", "Cuerpo, carácter, vida, apariencia y manera de actuar.", "El signo ascendente establece la primera casa y orienta todos los demás lugares. Los planetas aquí describen la condición corporal y la forma directa de afrontar la vida."),
        ("Casa II — Sustento y Posesiones", "Ingresos, posesiones, sustento y apoyo material.", "Este lugar describe los recursos que sostienen la vida y la relación práctica con su adquisición, conservación y uso."),
        ("Casa III — La Diosa", "Hermanos y parientes, comunicación, viajes cercanos y práctica religiosa.", "Tradicionalmente el lugar de gozo de la Luna, la tercera concierne las rutas familiares, los vínculos de parentesco, los mensajes y las devociones cotidianas."),
        ("Casa IV — El Lugar Subterráneo", "Padres, hogar, tierra, ascendencia, cimientos y finales.", "Este lugar describe las raíces: herencia familiar, vivienda, bienes inmuebles y los fundamentos de los que surge la vida y a los que finalmente regresan los asuntos."),
        ("Casa V — Buena Fortuna", "Hijos, placer, creatividad, dones y actividad generativa.", "Tradicionalmente el lugar de gozo de Venus, la quinta concierne el disfrute, la fertilidad, la expresión artística y aquello que se crea o se recibe con deleite."),
        ("Casa VI — Mala Fortuna", "Enfermedad y lesión, trabajo, servicio, subordinados y dificultad.", "Tradicionalmente el lugar de gozo de Marte, la sexta describe el esfuerzo corporal, el trabajo necesario y las condiciones difíciles que exigen destreza, resistencia y cuidado práctico."),
        ("Casa VII — El Lugar del Ocaso", "Matrimonio, parejas, contratos, alianzas y oponentes abiertos.", "Opuesta al Ascendente, la séptima describe encuentros decisivos con otros: quienes se unen, negocian o entran en contienda directa con la persona."),
        ("Casa VIII — El Lugar Inactivo", "Muerte, herencia, deuda, recursos ajenos y ansiedad ante la pérdida.", "La octava concierne lo que llega a través de otros o queda fuera del control directo, incluidas herencias, obligaciones, mortalidad y recursos compartidos."),
        ("Casa IX — Dios", "Religión, adivinación, aprendizaje superior, enseñanza y viajes lejanos.", "Tradicionalmente el lugar de gozo del Sol, la novena concierne los encuentros con el sentido a distancia: práctica sagrada, profecía, filosofía, estudios avanzados y viajes al extranjero."),
        ("Casa X — Praxis", "Acción, reputación, responsabilidades públicas, profesión y autoridad.", "La décima describe la acción visible en el mundo y las responsabilidades por las que una persona llega a ser conocida. En casas de signo entero, el Medio Cielo se muestra por separado y puede caer fuera de la casa décima."),
        ("Casa XI — Buen Espíritu", "Amigos, aliados, patronazgo, comunidades, esperanzas y beneficios.", "Tradicionalmente el lugar de gozo de Júpiter, la undécima describe el apoyo de amistades y benefactores, las redes colaborativas y las esperanzas promovidas mediante alianzas."),
        ("Casa XII — Mal Espíritu", "Enemigos, confinamiento, sufrimiento, aislamiento y animales grandes.", "Tradicionalmente el lugar de gozo de Saturno, la duodécima concierne la oposición oculta y las condiciones que limitan la acción, exigiendo paciencia, límites y reconocimiento sobrio."),
    ]
    houses_html = ''.join(f'<p><strong>{t}</strong><br><em>{a}</em><br>{d}</p>' for t, a, d in (spanish_houses if lang == 'es' else english_houses))

    # ── Assemble HTML ──
    if lang == "es":
        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
@font-face {{ font-family: 'AstroGlyphs'; src: url('file:///usr/share/fonts/truetype/dejavu/DejaVuSans.ttf') format('truetype'); }}
@page {{ size: letter; margin: 0.6in; }}
@page cover {{ @bottom-center {{ content: ""; }} }}
@page body {{ @bottom-center {{ content: ""; }} }}
body {{ background:#ffffff; color:#222; font-family:Georgia,"DejaVu Serif","Noto Serif",serif; font-size:10.5pt; line-height:1.55; }}
.astroglyph {{ font-family:"AstroGlyphs","DejaVu Sans","Noto Sans Symbols",sans-serif; }}
h1 {{ font-size:16pt; color:#1a3a5c; text-align:center; margin-top:40px; }}
h2 {{ font-size:12pt; color:#1a3a5c; border-bottom:1px solid rgba(26,58,92,0.2); padding-bottom:4px; margin-top:24px; }}
h3 {{ font-size:11pt; color:#2a5a8c; margin-top:18px; }}
table {{ border-collapse:collapse; width:100%; margin:12px 0; font-size:9.5pt; }}
th, td {{ border:1px solid rgba(26,58,92,0.25); padding:5px 8px; text-align:left; }}
th {{ background:#e8eef5; color:#1a3a5c; font-weight:normal; }}
thead {{ display: table-header-group; }}
tr {{ page-break-inside: avoid; }}
.cover {{ text-align:center; padding-top:120px; page: cover; page-break-after: always; }}
.cover h1 {{ font-size:26pt; }}
.cover p {{ color:#444; font-size:11pt; }}
.wheel {{ text-align:center; margin:8px 0; }}
.footer {{ text-align:center; color:#555; font-size:8.5pt; margin-top:40px; border-top:1px solid #999; padding-top:10px; }}
.page-break {{ page-break-before:always; }}
.dashboard-table th {{ width:30%; }}
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
<h1>{ES['cover_title']}</h1>
<p style="font-size:13px;color:#666;margin-top:8px;">{ES['cover_subtitle']}</p>
{f'<p style="font-size:26px;color:#1a3a5c;margin-top:20px;font-weight:bold;">{recipient_name}</p>' if recipient_name else ''}
<p style="font-size:20px;color:#1a3a5c;margin-top:20px;">{birth_date}</p>
<p style="font-size:14px;">{birth_time}</p>
<p style="font-size:14px;">{birth_location}</p>

<!-- Generation / Archetype as element-colored header -->
<p style="font-size:32px;font-weight:bold;letter-spacing:2px;margin-top:34px;color:{ELEMENT_COLORS.get(saec['conj_element'], '#1a3a5c')};text-transform:uppercase;">{ES_GEN_NAMES.get(saec['name'],saec['name'])} <span style="font-size:18px;opacity:0.7;">/</span> Arquetipo {ES_ARCH_NAMES.get(saec['archetype'],saec['archetype'])}</p>

<!-- Sun / Moon / Rising as a larger secondary line -->
<p style="font-size:17px;color:#333;margin-top:10px;font-weight:500;" class="astroglyph">Sol en {ES_SIGNS.get(sun_sign,sun_sign)} &middot; Luna en {ES_SIGNS.get(moon_sign,moon_sign)} &middot; {ES_SIGNS.get(asc_sign,asc_sign)} Ascendente</p>

<!-- "Generated by" line as a small footer -->
<p style="font-size:9px;color:#888;position:absolute;bottom:24px;left:0;right:0;text-align:center;">{ES['cover_generated']}<br/>Fecha de preparación: {prepared_date}</p>
</div>

{narrative_html}

<!-- APPENDIX -->
<h1 style="page-break-before:always;">12. Apéndice</h1>
<p>El apéndice mantiene el material técnico disponible sin forzar al lector a decodificarlo antes de recibir el valor principal del informe.</p>

<h2>{ES['outer_planets']}</h2>
<p>{ES['outer_planets_intro']}</p>
<p>{ES['us_cycle']}</p>
<p>{ES['un_cycle']}</p>
<p>{ES['np_cycle']}</p>

<h2 style="page-break-before:always;">{ES['glossary_title']}</h2>
{''.join(f'<p><strong>{t}</strong> {d}</p>' for t, d in ES['glossary'])}

<h2 style="page-break-before:always;">Casas de signo entero</h2>
<p>Este informe emplea casas de signo entero, una técnica de la astrología helenística: el signo ascendente completo es la Casa I y cada signo siguiente forma la casa siguiente. Los temas que siguen conservan los significados tradicionales y se aplican de manera interpretativa, no determinista. El Medio Cielo se calcula y muestra por separado porque puede caer en la Casa IX, X u XI.</p>
{houses_html}

<h2 style="page-break-before:always;">Posiciones Planetarias</h2>
<table>
<tr><th></th><th>Planeta</th><th>Posición</th><th>Casa</th><th>Elemento</th><th>Cualidad</th></tr>
{planet_rows}
</table>

<h2 style="page-break-before:always;">Aspectos Mayores Más Fuertes por Orbe</h2>
<table>
<tr><th>Planetas</th><th>Aspecto</th><th>Orbe</th><th>{ES['th_meaning']}</th></tr>
{aspect_rows}
</table>

</div>

<h2 style="page-break-before:always;">Fuentes y Lecturas Adicionales</h2>
<p style="font-size:9.5pt;color:#555;">
<strong>Motor Astronómico:</strong> Efemérides Suizas (DE440/JPL) — el estándar de posiciones planetarias. Datos astronómicos derivados de las efemérides planetarias de NASA/JPL.<br><br>
<strong>Astrología Helenística — Fuentes Primarias:</strong><br>
• <em>Tetrabiblos</em> — Claudio Ptolomeo (siglo II d.C.). El texto fundacional de la astrología técnica: dignidades de signos, doctrina de aspectos, significados de casas.<br>
• <em>Antologías</em> — Vettius Valens (siglo II d.C.). El tratado astrológico helenístico superviviente más extenso: sistemas de señores del tiempo, lotes, métodos de análisis natal.<br>
• <em>Carmen Astrologicum</em> — Dorotheo de Sidón (siglo I d.C.). El texto fuente para el sistema de dignidades basado en signos utilizado en este informe.<br><br>
<strong>Astrología Helenística — Becas Modernas:</strong><br>
• <em>Hellenistic Astrology: The Study of Fate and Value</em> — Chris Brennan (2017). La síntesis moderna definitiva de la técnica helenística.<br><br>
<strong>Marco Generacional y Cíclico:</strong><br>
• <em>Generations: The History of America's Future, 1584 to 2069</em> — William Strauss &amp; Neil Howe (1991). El marco de saeculum y arquetipos adaptado en este informe.<br>
• <em>The Fourth Turning</em> — William Strauss &amp; Neil Howe (1997). El modelo estacional de giros aplicado al metrónomo Saturno-Júpiter.<br><br>
<strong>Ciclo Védico / Yuga:</strong><br>
• <em>The Holy Science</em> — Sri Yukteswar Giri (1894). El modelo de ciclo Yuga utilizado en la sección de conciencia de onda larga.<br><br>
<strong>Crédito de Efemérides Suizas:</strong> Posiciones de asteroides y cometas calculadas por Astrodienst AG, Zürich, Suiza. Datos de efemérides planetarias del Jet Propulsion Laboratory, California Institute of Technology, bajo contrato con NASA.
</p>

<div class="footer">
<p>{ES['footer1']}</p>
<p>{ES['footer2']}</p>
</div>

</body>
</html>"""
    else:
        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
@font-face {{ font-family: 'AstroGlyphs'; src: url('file:///usr/share/fonts/truetype/dejavu/DejaVuSans.ttf') format('truetype'); }}
@page {{ size: letter; margin: 0.6in; }}
@page cover {{ @bottom-center {{ content: ""; }} }}
@page body {{ @bottom-center {{ content: ""; }} }}
body {{ background:#ffffff; color:#222; font-family:Georgia,"DejaVu Serif","Noto Serif",serif; font-size:10.5pt; line-height:1.55; }}
.astroglyph {{ font-family:"AstroGlyphs","DejaVu Sans","Noto Sans Symbols",sans-serif; }}
h1 {{ font-size:16pt; color:#1a3a5c; text-align:center; margin-top:40px; }}
h2 {{ font-size:12pt; color:#1a3a5c; border-bottom:1px solid rgba(26,58,92,0.2); padding-bottom:4px; margin-top:24px; }}
h3 {{ font-size:11pt; color:#2a5a8c; margin-top:18px; }}
table {{ border-collapse:collapse; width:100%; margin:12px 0; font-size:9.5pt; }}
th, td {{ border:1px solid rgba(26,58,92,0.25); padding:5px 8px; text-align:left; }}
th {{ background:#e8eef5; color:#1a3a5c; font-weight:normal; }}
thead {{ display: table-header-group; }}
tr {{ page-break-inside: avoid; }}
.cover {{ text-align:center; padding-top:120px; page: cover; page-break-after: always; }}
.cover h1 {{ font-size:26pt; }}
.cover p {{ color:#444; font-size:11pt; }}
.wheel {{ text-align:center; margin:8px 0; }}
.footer {{ text-align:center; color:#555; font-size:8.5pt; margin-top:40px; border-top:1px solid #999; padding-top:10px; }}
.page-break {{ page-break-before:always; }}
.dashboard-table th {{ width:30%; }}
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
<h1>Cosmic History Report</h1>
<p style="font-size:13px;color:#666;margin-top:8px;">A cosmic history report showing where your natal chart sits inside generational, elemental, and long-wave civilizational cycles.</p>
{f'<p style="font-size:26px;color:#1a3a5c;margin-top:20px;font-weight:bold;">{recipient_name}</p>' if recipient_name else ''}
<p style="font-size:20px;color:#1a3a5c;margin-top:20px;">{birth_date}</p>
<p style="font-size:14px;">{birth_time}</p>
<p style="font-size:14px;">{birth_location}</p>

<!-- Generation / Archetype as element-colored header -->
<p style="font-size:32px;font-weight:bold;letter-spacing:2px;margin-top:34px;color:{ELEMENT_COLORS.get(saec['conj_element'], '#1a3a5c')};text-transform:uppercase;">{saec['name']} <span style="font-size:18px;opacity:0.7;">/</span> {saec['archetype']} Archetype</p>

<!-- Sun / Moon / Rising as a larger secondary line -->
<p style="font-size:17px;color:#333;margin-top:10px;font-weight:500;" class="astroglyph">Sun in {sun_sign} &middot; Moon in {moon_sign} &middot; {asc_sign} Rising</p>

<!-- "Generated by" line as a small footer -->
<p style="font-size:9px;color:#888;position:absolute;bottom:24px;left:0;right:0;text-align:center;">Generated by Zodiyuga SkyClock using the Swiss Ephemeris (DE440) &middot; zodiyuga.com<br/>Date prepared: {prepared_date}</p>
</div>

{narrative_html}

<!-- APPENDIX -->
<h1 style="page-break-before:always;">12. Appendix</h1>
<p>The appendix keeps the technical material available without forcing the reader to decode it before receiving the report's main value.</p>

<h2>Outer Planet Metronomes</h2>
<p>While Saturn and Jupiter set the socioeconomic tempo, the slow outer planets describe deep background alignments. These background frequencies shape the deep psychological and structural landscape over vast evolutionary scales, operating far beyond short-term cultural trends.</p>

<p>The Uranus-Saturn cycle, resetting roughly every 45 years, governs the rhythm of institutional breakthrough and structural reform. The preceding 1942 conjunction in Taurus anchored the heavy industrial structures of the post-war order — mass production, centralized bureaucracy, and the military-industrial complex that defined the era's climate. The 1988 conjunction in Sagittarius coincided with the end of the Cold War and the globalizing information age, cracking open that centralized world. The upcoming 2032 conjunction in Gemini points toward a restructuring of language, education, local communication, and networked civic life.</p>

<p>The Uranus-Neptune cycle, spanning approximately 172 years, drives mass consciousness and collective imagination. The preceding conjunction in 1821 in Capricorn coincided with the Industrial Revolution's acceleration — the mechanical age that built the physical infrastructure of the Earth Era. The 1993 conjunction in Capricorn aligned directly with the commercial birth of the World Wide Web and globalized digital markets, shifting the collective imagination from mechanical to digital.</p>

<p>The Neptune-Pluto rhythm is even vaster, moving on an approximate 492-year scale that maps the mythic operating systems of civilizations. The preceding 1892 conjunction in Gemini anchored the modern industrial-mass-media world — the climate of newspapers, railroads, telegraphs, and mass literacy that you are currently witnessing decay. That system will not see its next total reset until the 24th century. Pluto's presence in Aquarius now signals a two-decade demolition and rebuilding of technological infrastructure, collective systems, and power distribution — the next climate forming beneath the surface of the current crisis.</p>

<h2 style="page-break-before:always;">Expanded Glossary</h2>
<p><strong>Metronome (♄☌♃):</strong> A repeating timing reference that sets the tempo for a larger system. In this model, the Saturn–Jupiter conjunction (♄☌♃) functions as the master metronome — a predictable celestial clock that marks when one generational wave ends and the next begins. Just as a musical metronome does not determine what notes are played but sets the rhythm they follow, the ♄☌♃ metronome does not determine individual destiny but sets the structural tempo every generation moves to.</p>
<p><strong>Saturn Return:</strong> The moment transiting Saturn returns to the exact zodiacal position it occupied at birth, occurring approximately every 29.5 years. The First Saturn Return (around age 29-30) marks the end of youth and the beginning of mature adulthood. The Second (around age 58-60) marks the transition from midlife to elder role.</p>
<p><strong>Uranus Opposition:</strong> The moment transiting Uranus reaches the point exactly opposite its natal position, occurring around age 42 (half of Uranus's 84-year orbit). It is the classic midlife awakening — a challenge to established patterns and an invitation to experiment.</p>
<p><strong>Saturn–Jupiter Conjunction (♄☌♃):</strong> An approximately 20-year celestial timing marker — the master metronome of civilizational change. Each conjunction occurs in a specific zodiac sign, and the element of that sign (Earth, Air, Fire, or Water) determines the elemental character of the era that follows.</p>
<p><strong>Saeculum:</strong> An approximately 80-year historical rhythm moving through four generational seasons: Spring (High), Summer (Awakening), Fall (Unraveling), and Winter (Crisis), mapping the breath of institutional and cultural confidence.</p>
<p><strong>Turning (Saeculum Phase):</strong> One of four seasonal phases within the saeculum cycle: Spring (High) — civic confidence and institutional expansion; Summer (Awakening) — individualism and cultural questioning; Fall (Unraveling) — institutional decay and fracturing; Winter (Crisis) — structural collapse and rebuilding.</p>
<p><strong>Archetype (Generational):</strong> The recurring personality type assigned to each generation by its position in the saeculum: Prophet (Boomers, Gen Alpha), Nomad (Gen X), Hero (Millennials), Artist (Gen Z). Each archetype plays a distinct role in the turning it matures through.</p>
<p><strong>Elemental Era:</strong> A roughly 200-year period in which Saturn-Jupiter conjunctions consistently emphasize one element (Earth, Air, Fire, or Water), setting the grand structural theme of global civilization. The Earth Era ran from the early 19th century to 2020; the Air Era begins in 2020 and runs until approximately 2219.</p>
<p><strong>Earth Era:</strong> The elemental era that ran from the early 19th century to 2020. Spans the Saturn-Jupiter conjunctions of 1842 in Capricorn, 1861 in Capricorn, 1881 in Taurus, 1901 in Sagittarius, 1921 in Virgo, 1940 in Taurus, 1961 in Capricorn, and 2000 in Taurus. Characterized by industrial mass production, centralized nation-state power, fossil-fueled infrastructure, suburban expansion, paper bureaucracy, and physical property as the dominant form of wealth. The Earth Era's terminal conjunction in 2000 in Taurus served as its final, parting alignment.</p>
<p><strong>Air Era:</strong> The current elemental era, locked in by the 2020 Saturn-Jupiter conjunction in Aquarius. Characterized by data, networks, protocols, distributed power, invisible infrastructure, and coordination across distance. Runs until approximately 2219.</p>
<p><strong>Water Era:</strong> The elemental era that follows the Air Era, beginning when Saturn-Jupiter conjunctions cluster in Water signs. Water eras have not dominated the modern period, but historically they coincide with the rise of mass emotional movements, depth psychology, oceanic and submarine expansion, the surfacing of long-buried collective material, and the dissolution of the previous era's hard structures. The signature of a Water era is the saturation of public life with feeling — what the previous era hardened, this era dissolves, and what the previous era ignored, this era names.</p>
<p><strong>Fire Era:</strong> The elemental era that follows the Water Era, beginning with the first Saturn-Jupiter conjunction in a Fire sign. Historical Fire eras coincide with civilizational expansion, charismatic leadership, doctrinal and ideological fervor, major religious and military mobilizations, and the visible ignition of new cultural epochs. The signature of a Fire era is a new mythic charter — a fresh founding story that the previous era could not supply.</p>
<p><strong>Precession:</strong> In standard astronomical terms, precession is described as a 26,000-year axial shift of the Earth's rotational axis, gradually changing the alignment between the tropical zodiac (seasonal) and the sidereal zodiac (star-based). In the Zodiyuga SkyClock framework, this is processed purely as the geometric timing mechanism driving the Yuga wave: as the angular relationship between the celestial reference points evolves, the collective density of perception rises and falls.</p>
<p><strong>Yuga Wave:</strong> The 26,000-year consciousness cycle used in this model to map civilizational ascent and descent relative to density and energetic perception. The Kali Yuga (Iron Age) represents the densest material consciousness; Dvapara Yuga (Bronze Age) marks the ascent into energetic and informational perception.</p>
<p><strong>The Seasons, Signs, and the Ecliptic:</strong> The ecliptic is the apparent path the Sun traces through the sky over the course of a year. The twelve signs of the zodiac are 30-degree segments of this circle, named after the constellations that once aligned with them. Because the tropical zodiac is anchored to the seasons, the sign Aries always begins at the spring equinox — regardless of where the stars currently sit. Each sign belongs to one of four elements (Fire, Earth, Air, Water) and one of three qualities (Cardinal, Fixed, Mutable), giving every sign a distinct character that colors any planet passing through it.</p>


<h2 style="page-break-before:always;">Hellenistic Houses of Antiquity</h2>
<p>This report uses whole-sign houses, a technique of Hellenistic astrology: the entire rising sign is House 1, and each following sign forms the next house. The topics below preserve traditional house meanings and are applied interpretively, not deterministically. The Midheaven is calculated and shown separately because it can fall in House 9, 10, or 11.</p>
{houses_html}

<h2 style="page-break-before:always;">Planet Placements</h2>
<table>
<tr><th></th><th>Planet</th><th>Position</th><th>House</th><th>Element</th><th>Quality</th></tr>
{planet_rows}
</table>

<h2 style="page-break-before:always;">Strongest Major Aspects by Orb</h2>
<table>
<tr><th>Planets</th><th>Aspect</th><th>Orb</th><th>Meaning</th></tr>
{aspect_rows}
</table>


<h2 style="page-break-before:always;">Sources &amp; Further Reading</h2>
<p style="font-size:9.5pt;color:#555;">
<strong>Astronomical Engine:</strong> Swiss Ephemeris (DE440/JPL) — the planetary position standard. Astronomical data derived from NASA/JPL planetary ephemerides.<br><br>
<strong>Hellenistic Astrology — Primary Sources:</strong><br>
• <em>Tetrabiblos</em> — Claudius Ptolemy (2nd century CE). The foundational text of technical astrology: sign dignities, aspect doctrine, house meanings.<br>
• <em>Anthologies</em> — Vettius Valens (2nd century CE). The most extensive surviving Hellenistic astrological treatise: time-lord systems, lots, natal analysis methods.<br>
• <em>Carmen Astrologicum</em> — Dorotheus of Sidon (1st century CE). The source text for sign-based rulership and the dignity system used in this report.<br><br>
<strong>Hellenistic Astrology — Modern Scholarship:</strong><br>
• <em>Hellenistic Astrology: The Study of Fate and Value</em> — Chris Brennan (2017). The definitive modern synthesis of Hellenistic technique.<br><br>
<strong>Generational &amp; Cyclical Framework:</strong><br>
• <em>Generations: The History of America's Future, 1584 to 2069</em> — William Strauss &amp; Neil Howe (1991). The saeculum and archetype framework adapted in this report.<br>
• <em>The Fourth Turning</em> — William Strauss &amp; Neil Howe (1997). The seasonal turning model applied to the Saturn-Jupiter metronome.<br><br>
<strong>Vedic / Yuga Cycle:</strong><br>
• <em>The Holy Science</em> — Sri Yukteswar Giri (1894). The Yuga cycle model used in the long-wave consciousness section.<br><br>
<strong>Swiss Ephemeris Credit:</strong> Asteroid and comet positions computed by Astrodienst AG, Zürich, Switzerland. Planetary ephemeris data from the Jet Propulsion Laboratory, California Institute of Technology, under contract with NASA.
</p>

<div class="footer">
<p>Generated by Zodiyuga SkyClock using the Swiss Ephemeris (DE440) | zodiyuga.com</p>
<p>This report is calibrated strictly for educational, structural, and research integration.</p>
</div>

</body>
</html>"""
    return html, chart_pdf_path

def main():
    parser = argparse.ArgumentParser(description="Generate a full $19 Cosmic History Report")
    parser.add_argument("--year", type=int, default=1982)
    parser.add_argument("--month", type=int, default=5)
    parser.add_argument("--day", type=int, default=2)
    parser.add_argument("--hour", type=int, default=12, help="Birth hour (24h). Defaults to 12 (noon) for solar charts when no time is given.")
    parser.add_argument("--min", type=int, default=0, help="Birth minute. Defaults to 0 (noon) for solar charts when no time is given.")
    parser.add_argument("--lat", type=float, default=30.22)
    parser.add_argument("--lon", type=float, default=-81.68)
    parser.add_argument("--location", default="NAS Jacksonville, Florida")
    parser.add_argument("--name", default="", help="Recipient name on cover")
    parser.add_argument("--output", default="cosmic_history_report.pdf")
    parser.add_argument("--tz", default="EDT", choices=["EST","EDT","CST","CDT","MST","MDT","PST","PDT","HST","AKST","COT","IST","GMT","UTC"], help="Legacy timezone abbreviation")
    parser.add_argument("--utc-offset", type=float, default=None, help="Hours added to local time to obtain UTC; supports worldwide and fractional offsets")
    parser.add_argument("--tz-label", default="", help="Resolved timezone label shown in the report")
    parser.add_argument("--lang", default="en", choices=["en","es"], help="Output language")
    parser.add_argument("--solar-chart", action="store_true", help="Force noon birth time and align ASC to 0° Aries (solar chart / 'sun-sign chart' default for unknown birth time)")
    args = parser.parse_args()

    tz_offsets = {"EST":5,"EDT":4,"CST":6,"CDT":5,"MST":7,"MDT":6,"PST":8,"PDT":7,"AKST":9,"HST":10,"COT":5,"IST":1,"GMT":0,"UTC":0}
    tz_offset = args.utc_offset if args.utc_offset is not None else tz_offsets[args.tz]
    tz_label = args.tz_label or args.tz

    # If --solar-chart is set, force noon and align the chart to Aries ASC at 9 o'clock
    if args.solar_chart:
        args.hour = 12
        args.min = 0

    months_en = ['January','February','March','April','May','June','July','August','September','October','November','December']
    months_es = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    months = months_es if args.lang == "es" else months_en
    birth_date = f"{months[args.month-1]} {args.day}, {args.year}"
    birth_time = f"{args.hour}:{args.min:02d} {tz_label}"

    print(f"Generating report for {birth_date} at {birth_time}, {args.location}")
    if args.solar_chart:
        print(f"  [solar-chart mode: noon, ASC aligned to 0° Aries]")
    print(f"UTC conversion offset: {tz_offset:+g} hours")

    html, chart_pdf_path = generate_html(birth_date, birth_time, args.location, args.lat, args.lon,
                        args.year, args.month, args.day, args.hour, args.min, tz_offset,
                        tz_label, recipient_name=args.name, lang=args.lang, solar_chart=args.solar_chart)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    outpath = os.path.join(OUTPUT_DIR, args.output)

    # Generate the report body (cover + narrative + appendix, no chart or snapshot)
    report_pdf_path = os.path.join(tempfile.gettempdir(), f"report_body_{args.year}{args.month:02d}{args.day:02d}.pdf")
    HTML(string=html).write_pdf(report_pdf_path)
    print(f"[report] Body PDF: {report_pdf_path} ({os.path.getsize(report_pdf_path)//1024} KB)")

    # Generate the new visual snapshot page
    snapshot_html = snapshot_gen.build_snapshot_html(
        birth_date, birth_time, args.location, args.lat, args.lon,
        args.year, args.month, args.day, args.hour, args.min, tz_offset,
        tz_label, recipient_name=args.name, lang=args.lang, solar_chart=args.solar_chart
    )
    snapshot_pdf_path = os.path.join(tempfile.gettempdir(), f"snapshot_page_{args.year}{args.month:02d}{args.day:02d}.pdf")
    HTML(string=snapshot_html).write_pdf(snapshot_pdf_path)
    print(f"[report] Snapshot PDF: {snapshot_pdf_path} ({os.path.getsize(snapshot_pdf_path)//1024} KB)")

    # Merge: cover (p1) + chart (p2) + snapshot (p3) + rest of body (narrative p4+)
    final_doc = fitz.open()
    body_doc = fitz.open(report_pdf_path)
    chart_doc = fitz.open(chart_pdf_path)
    snapshot_doc = fitz.open(snapshot_pdf_path)

    # Insert cover (page 0 from body)
    final_doc.insert_pdf(body_doc, from_page=0, to_page=0)
    # Insert chart page
    final_doc.insert_pdf(chart_doc)
    # Insert snapshot page
    final_doc.insert_pdf(snapshot_doc)
    # Insert rest of body (page 1 onward = narrative + appendix)
    final_doc.insert_pdf(body_doc, from_page=1)

    final_doc.save(outpath)
    final_doc.close()
    body_doc.close()
    chart_doc.close()
    snapshot_doc.close()

    # Stamp page numbers continuously through the whole document.
    # Cover (p1), chart (p2), and snapshot (p3) get no footer, but they are counted.
    # Section 1 starts on physical page 4 and is numbered "Page 4 of N".
    final = fitz.open(outpath)
    total = final.page_count
    for i in range(total):
        page = final[i]
        rect = page.rect
        if i < 3:
            # Front matter pages remain unnumbered
            continue
        text = ES["page_of"].format(n=i + 1, total=total) if args.lang == "es" else f"Page {i + 1} of {total}"
        fontsize = 7.5
        text_width = fitz.get_text_length(text, fontsize=fontsize, fontname="helv")
        x = (rect.width - text_width) / 2
        y = rect.height - 20
        page.insert_text((x, y), text, fontsize=fontsize, fontname="helv", color=(0.33, 0.33, 0.33))
    final.saveIncr()
    final.close()

    print(f"PDF: {outpath} ({os.path.getsize(outpath)//1024} KB, {total} pages)")

if __name__ == "__main__":
    main()
