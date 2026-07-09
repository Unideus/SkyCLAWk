#!/usr/bin/env python3
"""Generate a full $19 Cosmic History Report as a proper multi-page PDF.

Usage:
    source ~/.hermes/hermes-agent/venv/bin/activate
    python3 scripts/generate_full_report.py --year 1982 --month 5 --day 2 --hour 2 --min 16 --tz EDT --lat 30.22 --lon -81.68 --location "NAS Jacksonville, Florida" --name "Cheryl K. Beggs"
"""

import os, sys, math, argparse, json, re, tempfile
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
    "sr_desc": "Saturno regresa a su posición natal a los {age} años: un hito estructural que marca el final de un capítulo y el comienzo del siguiente. Revise lo construido, libere lo que ya no sirve y comprométase con el próximo ciclo de responsabilidad.",
    "sr_first": "Primer", "sr_second": "Segundo",
    "uranus_opp": "Oposición de Urano",
    "uo_desc": "Urano en tránsito se opone a su posición natal a los {age} años: el despertar clásico de la mediana edad. Los patrones establecidos son desafiados, las viejas identidades se rompen y comienza una nueva fase de libertad y experimentación. Esta es la señal de 'no se conforme' del reloj cósmico.",
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
        ("Conjunción Saturno–Júpiter (♄☌♃):", "Un marcador de tiempo civilizacional de aproximadamente 20 años usado aquí como metrónomo generacional para señalar cambios socioeconómicos. Cada conjunción ocurre en un signo zodiacal específico, y el elemento de ese signo (Tierra, Aire, Fuego o Agua) determina el carácter elemental de la era."),
        ("Saeculum:", "Un ritmo histórico de aproximadamente 80 años que se mueve a través de cuatro estaciones generacionales: Primavera (Alto), Verano (Despertar), Otoño (Desenredo) e Invierno (Crisis), mapeando el aliento de la confianza institucional y cultural."),
        ("Era Elemental:", "Un período de aproximadamente 200 años en el que las conjunciones Saturno-Júpiter enfatizan consistentemente un elemento (Tierra, Aire, Fuego o Agua), estableciendo el tema estructural mayor de la civilización global. La Era de Tierra se extendió desde principios del siglo XIX hasta 2020; la Era de Aire comienza en 2020 y se extiende hasta aproximadamente 2219."),
        ("Onda de Yuga:", "El ciclo de conciencia de 26.000 años usado en este modelo para mapear el ascenso y descenso civilizacional relativo a la densidad y percepción energética. El Kali Yuga (Edad de Hierro) representa la conciencia material más densa; el Dvapara Yuga (Edad de Bronce) marca la ascensión hacia la percepción energética e informacional."),
        ("Era de Tierra:", "La era elemental que se extendió desde principios del siglo XIX hasta 2020. Abarca las conjunciones Saturno-Júpiter de 1842 en Capricornio, 1861 en Capricornio, 1881 en Tauro, 1901 en Sagitario, 1921 en Virgo, 1940 en Tauro, 1961 en Capricornio y 2000 en Tauro. Caracterizada por producción industrial en masa, poder centralizado del Estado-nación, infraestructura basada en combustibles fósiles, expansión suburbana, burocracia en papel y propiedad física como forma dominante de riqueza. La conjunción terminal de la Era de Tierra en 2000 en Tauro sirvió como su alineación final de despedida."),
        ("Era de Aire:", "La era elemental actual, fijada por la conjunción Saturno-Júpiter de 2020 en Acuario. Caracterizada por datos, redes, protocolos, poder distribuido, infraestructura invisible y coordinación a distancia. Se extiende hasta aproximadamente el año 2219."),
        ("Era de Agua:", "La era elemental que sigue a la Era de Aire, comenzando cuando las conjunciones Saturno-Júpiter se agrupan en signos de Agua. Las eras de Agua no han dominado el período moderno, pero históricamente coinciden con el surgimiento de movimientos emocionales masivos, psicología profunda, expansión oceánica y submarina, la emergencia de material colectivo largamente enterrado, y la disolución de las estructuras duras de la era anterior. La firma de una era de Agua es la saturación de la vida pública con sentimiento — lo que la era anterior endureció, esta era lo disuelve, y lo que la era anterior ignoró, esta era lo nombra."),
        ("Era de Fuego:", "La era elemental que sigue a la Era de Agua, comenzando con la primera conjunción Saturno-Júpiter en un signo de Fuego. Las eras de Fuego históricas coinciden con expansión civilizacional, liderazgo carismático, fervor doctrinal e ideológico, grandes movilizaciones religiosas y militares, y la ignición visible de nuevas épocas culturales. La firma de una era de Fuego es una nueva carta mítica — una historia fundacional fresca que la era anterior no pudo proveer."),
        ("Tornillo de Línea de Tiempo:", "La metáfora 3D de Zodiyuga SkyClock para ciclos anidados. En lugar de representar una columna física vertical, conceptualiza el tiempo girando como un hélice continua, combinando órbitas cíclicas con avance temporal hacia adelante."),
        ("NCP (Polo Celeste Norte):", "El punto de referencia de Polaris — el punto en el cielo norte alrededor del cual las estrellas parecen rotar desde nuestra perspectiva a nivel del suelo. En el modelo espacial de Zodiyuga SkyClock, el NCP se trata como uno de dos puntos de referencia celeste desplazados en un plano celeste plano, separado del ENP por aproximadamente 23.4°."),
        ("ENP (Polo Norte Eclíptico):", "El punto de referencia del Corazón de Draco — la referencia celeste profunda sostenida en la constelación Draco. En el modelo espacial de Zodiyuga SkyClock, el ENP es el segundo de dos puntos de referencia desplazados en el mismo plano celeste plano. La relación angular entre NCP y ENP genera la metáfora del tornillo de línea de tiempo usada en todo este informe."),
        ("Precesión:", "En términos astronómicos estándar, la precesión se describe como un desplazamiento axial de 26.000 años del eje de rotación de la Tierra, cambiando gradualmente la alineación entre el zodíaco tropical (estacional) y el zodíaco sidéreo (basado en estrellas). En el marco de Zodiyuga SkyClock, esto se procesa puramente como el mecanismo de tiempo geométrico que impulsa la onda de Yuga: a medida que la relación angular entre los puntos de referencia celestes evoluciona, la densidad colectiva de percepción sube y baja."),
        ("Retorno de Saturno:", "El momento en que Saturno en tránsito regresa a la posición zodiacal exacta que ocupaba al nacer, ocurriendo aproximadamente cada 29.5 años. El Primer Retorno de Saturno (alrededor de los 29-30 años) marca el final de la juventud y el comienzo de la adultez madura. El Segundo (alrededor de los 58-60 años) marca la transición de la mediana edad al rol de anciano."),
        ("Oposición de Urano:", "El momento en que Urano en tránsito alcanza el punto exactamente opuesto a su posición natal, ocurriendo alrededor de los 42 años (la mitad de la órbita de 84 años de Urano). Es el despertar clásico de la mediana edad — un desafío a los patrones establecidos y una invitación a experimentar."),
        ("Giro (Fase del Saeculum):", "Una de cuatro fases estacionales dentro del ciclo del saeculum: Primavera (Alto) — confianza cívica y expansión institucional; Verano (Despertar) — individualismo y cuestionamiento cultural; Otoño (Desenredo) — decadencia institucional y fractura; Invierno (Crisis) — colapso estructural y reconstrucción."),
        ("Arquetipo (Generacional):", "El tipo de personalidad recurrente asignado a cada generación por su posición en el saeculum: Profeta (Boomers, Gen Alpha), Nómada (Gen X), Héroe (Millennials), Artista (Gen Z). Cada arquetipo juega un rol distinto en el giro que madura."),
        ("Era de Aire:", "La era elemental actual, bloqueada por la conjunción Saturno-Júpiter de 2020 en Acuario. Caracterizada por datos, redes, protocolos, poder distribuido, infraestructura invisible y coordinación a distancia. Se extiende hasta aproximadamente 2219."),
    ],
    "th_house": "House",
    "planet_placements": "Planet Placements",
    "th_house": "House",
    "th_planet": "Planet", "th_position": "Position", "th_element": "Element", "th_quality": "Quality",
    "ascendant": "Ascendant", "midheaven": "Midheaven",
    "aspects_title": "Strongest Major Aspects by Orb",
    "th_planets": "Planets", "th_aspect": "Aspect", "th_orb": "Orb",
        "houses": [],
    "footer1": "Generated by Zodiyuga SkyClock using the Swiss Ephemeris (DE440) | zodiyuga.com",
    "footer2": "This report is calibrated strictly for educational, structural, and research integration.",
    "page_of": "Page {n} of {total}",
    "moon_para": "\nYour Moon in {moon} shapes the inner emotional weather beneath the Sun identity. Where the Sun is how you shine, the Moon is how you feel. This placement gives you {interp}. The Moon sign is the private instrument through which you process the macro-weather described above - it colors how you receive, digest, and respond to the structural pressures of your era.\n",
    "narrative_not_found": "<h2>1. Your Cosmic Snapshot</h2><p>Prose template not found for {arch} / {sun}.</p>",
    "chart_house_system": "Signo Completo",
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
    # Fall back to English if Spanish file doesn't exist
    if not macro_path.exists() and suffix:
        macro_path = TEMPLATE_DIR / macro_path.name.replace(suffix, "")
        if snippet_path:
            snippet_path = TEMPLATE_DIR / snippet_path.name.replace(suffix, "")
    if not macro_path.exists():
        return None
    if snippet_path and not snippet_path.exists():
        return None
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
        moon_para = ES["moon_para"].format(moon=moon_sign, interp=moon_interp)
    else:
        moon_interp = MOON_SIGN_INTERPRETATIONS.get(moon_sign, "emotional depth and inner rhythm")
        moon_para = f"\nYour Moon in {moon_sign} shapes the inner emotional weather beneath the Sun's identity. Where the Sun is how you shine, the Moon is how you feel. This placement gives you {moon_interp}. The Moon sign is the private instrument through which you process the macro-weather described above — it colors how you receive, digest, and respond to the structural pressures of your era.\n"
    macro = macro.replace("[MOON_SIGN]", moon_para)
    # Inject ASC sign paragraph
    if asc_sign:
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
    prose = re.sub(r'^(Practice:.*)$', r'<p><strong>\1</strong></p>', prose, flags=re.MULTILINE)
    prose = re.sub(r'^(Reason:.*)$', r'<p><em>\1</em></p>', prose, flags=re.MULTILINE)
    paragraphs = re.split(r'\n\n+', prose.strip())
    result = []
    for p in paragraphs:
        p = p.strip()
        if not p: continue
        if p.startswith('<h2') or p.startswith('<h3') or p.startswith('<p'):
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
    if lang == "es":
        _meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
        prepared_date = f"{now.day:02d} de {_meses[now.month-1]} de {now.year}"
    else:
        prepared_date = now.strftime("%B %d, %Y")
    current_year = now.year
    age_now = current_year - year
    # Determine which markers are past, present, or future relative to now
    def time_status(marker_year):
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
        life_rows = ""
        for phase, age_range, stage_key in life_phases:
            age_start = int(age_range.split("–")[0])
            c = conj_for_age_block(year, age_start)
            c_year, c_sign, c_elem, c_turn = c
            yrs = f"{year + age_start}–{year + age_start + 20}"
            weather = f"{c_year} {c_sign} / {c_turn}"
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

    # Planet glyphs for marker column
    G = {"Saturn":"♄","Jupiter":"♃","Uranus":"♅","Neptune":"♆","Pluto":"♇"}
    ELEMENT_HEX = {"Fire":"#fdecec","Earth":"#d0e8d0","Air":"#d0e0f5","Water":"#d0dcef"}  # light tints for marker row background
    ELEMENT_FG  = {"Fire":"#c62828","Earth":"#2e7d32","Air":"#1565c0","Water":"#1976d2"}  # darker tones for sign glyph

    # Saturn-Jupiter conjunction marker data — the 7 modern conjunctions used as the structural
    # backbone of this report. Each entry is the year/sign/turning + a one-line era description
    # used for the row's "How to use" cell. The 1921 Virgo entry is the actual predecessor of
    # the 1940 conjunction; included for completeness but the 1928 Leo entry is intentionally
    # omitted (it is not an actual S/J conjunction — that boundary is a known data issue).
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
    anchor_row_html = (
        f'<tr style="background-color:{anchor_bg};page-break-inside:avoid;font-weight:bold;">'
        f'<td style="white-space:nowrap;">{anchor_year}</td>'
        f'<td style="white-space:nowrap;text-align:center;">—</td>'
        f'<td>'
        f'<span class="astroglyph" style="font-size:16px;color:{anchor_fg};">♄☌♃</span> '
        f'in {anchor_sign_glyph} {anchor_sign} — <span style="font-style:italic;">{anchor_turn}, {anchor_elem}</span>'
        f'</td>'
        f'<td>'
        f'<strong>Generational anchor</strong> — {anchor_desc}'
        f'</td>'
        f'</tr>'
    )

    # Birth row — uses actual birth year and age 0 (NOT the anchor year)
    conj_sign_str = saec['conj_sign']
    birth_imprint_text = f"Birth imprint — {anchor_turn} turning — {anchor_desc}"
    birth_row = (
        year,  # actual birth year (e.g., 1975 for Ian)
        0,     # age 0
        f'<span class="astroglyph">Birth</span> {conj_sign_str}',
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
            markers_list.append((
                sr_year,
                f'{sr_num} <span class="astroglyph">♄</span> {sr_label}',
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
            markers_list.append((
                uo_year,
                f'<span class="astroglyph">♅</span> {uo_label}',
                age_at_uo,
                uo_desc
            ))

    # Saturn-Neptune conjunction — ♄♆ conjunction glyph
    sn_result = find_saturn_neptune_conjunction(jd, swe)
    if sn_result:
        sn_jd, sn_year, sn_sign = sn_result
        age_at_sn = sn_year - year
        if lang == "es":
            sn_desc = ES["sn_desc"].format(age=age_at_sn, sign=sn_sign)
        else:
            sn_desc = f"At age {age_at_sn}, Saturn and Neptune meet in {sn_sign}: a rare alignment that fuses structural reality with visionary imagination. This is the era when old illusions dissolve and new dreams must be built on solid ground. The practical and the meaningful converge — whatever you have been building either aligns with your deeper purpose or falls away. This is the time to align what works with what matters."
        markers_list.append((
            sn_year,
            f'<span class="astroglyph">♄☌♆</span> in {sn_sign}',
            age_at_sn,
            sn_desc
        ))

    # Note: collective S-J conjunction era descriptions are already covered by the
    # Life Timeline table above. The Markers table below shows only personal
    # transits (Saturn Return, Uranus Opposition, Saturn-Neptune conjunction,
    # Uranus-Saturn conjunction) and a "Now" anchor row for the reader's present.
    # Uranus-Saturn conjunction (different cycle, not a S-J conjunction)
    us_text = ES["us_marker"] if lang == "es" else "Uranus-Saturn conjunction: Midlife restructuring of language, education, localized infrastructure, and your immediate practical communication frameworks."
    markers_list.append((
        2032, f'<span class="astroglyph">♅☌♄</span> in Gemini',
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
        sj_marker_html = (
            f'<span class="astroglyph" style="font-size:16px;color:{ELEMENT_FG.get(elem, "#222")};">♄☌♃</span> '
            f'in {sign_glyph} {cs} — <span style="font-style:italic;">{turn}, {elem}</span>'
        )
        markers_list.append((cy, sj_marker_html, sj_age, f"{turn} turning — {desc}"))

    # Sort chronologically by year
    markers_list.sort(key=lambda x: x[0])

    # Build a "Now" row showing today's date and current age
    import datetime as _dt
    _now = _dt.datetime.now()
    _now_age = _now.year - year
    _now_date_str = _now.strftime("%B %d, %Y")
    _now_year_str = _now.strftime("%Y")

    marker_rows = ""
    # Insert the anchor row at the top, then the birth row, then the rest of the markers
    marker_rows = anchor_row_html
    # Birth row goes right after the anchor row
    by, ba, bm, bh = birth_row
    marker_rows += f'<tr style="background-color:#ffffff;page-break-inside:avoid;"><td style="white-space:nowrap;"><strong>{by}</strong></td><td style="white-space:nowrap;text-align:center;"><strong>{ba}</strong></td><td>{bm}</td><td>{bh}</td></tr>'

    prev_status = None
    for yr, marker, age, how in markers_list:
        status = time_status(yr)
        # Insert a red divider row between past and future markers
        if prev_status == "past" and status != "past":
            marker_rows += '<tr><td colspan="4" style="border:none;border-top:2px solid #d44a4a;padding:2px 0;"></td></tr>'
            # Insert the "Now" row directly under the red line, with light yellow background
            marker_rows += f'<tr style="background-color:#fff8e1;page-break-inside:avoid;"><td style="white-space:nowrap;"><strong>{_now_year_str}</strong></td><td style="white-space:nowrap;text-align:center;"><strong>{_now_age}</strong></td><td><strong>Now</strong></td><td><strong>Now — {_now_date_str}</strong> — current position on the timeline. The markers above are past, below are future.</td></tr>'
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
            <td>H10</td>
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
        aspect_rows += f"""
        <tr style="background-color:{row_bg};">
            <td style="font-size:16px;text-align:center;" class="astroglyph">
                <span style="color:{p1_color};">{p1['glyph']}</span>
                <span style="color:{aspect_color};font-weight:bold;"> {glyph} </span>
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
        prose = prose.replace("[TIMELINE_IMAGE]", f'<div style="text-align:center; margin:16px 0;"><img src="file://{ASSETS_DIR}/sj_timeline_graphic.jpg" style="max-width:100%; height:auto;" alt="Saturn-Jupiter Timeline"></div>')
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

    house_sys_label = ES["chart_house_system"] if lang == "es" else "Whole Sign"
    chart_title_label = "Carta Natal" if lang == "es" else "Natal Chart"
    chart_svg = build_chart_svg(planets, asc, mc, recipient_name, birth_date, birth_time, birth_location, house_sys_label, jd=jd, chart_title=chart_title_label, lang=lang)

    # Convert chart SVG to a single-page PDF via cairosvg
    chart_pdf_path = os.path.join(tempfile.gettempdir(), f"chart_page_{year}{month:02d}{day:02d}.pdf")
    cairosvg.svg2pdf(bytestring=chart_svg.encode('utf-8'), write_to=chart_pdf_path, scale=2)
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
        cheat_aspects += f"<span style='font-size:18px;' class='astroglyph'>{p1['glyph']}{glyph}{p2['glyph']}</span> <span style='font-size:9pt;color:#555;'>{name} {orb:.1f}°</span><br>"

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
        ("House 1 — The Helm & Structural Interface", "Life Domain: The Localized Complexion; the physical engine and primary interface through which the natal wave meets the world.", "This sector governs unmediated action, baseline vitality, and the orientation of the self-system. Planets filtering through the 1st House condition the native's primary operational stance and establish the visible baseline of their life path."),
        ("House 2 — Resource Velocity & Sustenance Protocol", "Life Domain: Asset Allocation; the material assets, physical security mechanics, and personal liquid infrastructure.", "This sector governs survival metrics, revenue mechanics, and the acquisition of capital or physical tools. It dictates how energy is consolidated, values are quantified, and material stability is generated to support the structural engine of the 1st House."),
        ("House 3 — Localized Networks & Infrastructure", "Life Domain: Immediate Exchange; local logistics, short-range data routing, and immediate communication protocols.", "This sector governs technical processing, early educational conditioning, siblings, and localized transport infrastructure. It maps how the native gathers, translates, and formats immediate data streams before scaling them into macro frameworks."),
        ("House 4 — The Private Matrix & Bedrock Foundation", "Life Domain: The Subterranean Root; ancestral anchors, private security baselines, and domestic physical architecture.", "Grounding at the bottom of the chart, this sector dictates the private foundation, home life, and early parental landscape. It represents the quiet, interior laboratory where the native comports with history and builds the deep emotional reserves required to sustain external public pressure."),
        ("House 5 — Generative Projection & Creative Output", "Life Domain: Creative Risk; expressive fluidity, speculative ventures, and individual vital output.", "This sector governs children, creative authorship, pleasure dynamics, and tactical speculation. It represents the specific arena where raw individual intelligence projects itself outward to leave a distinct, non-standardized mark on the environment."),
        ("House 6 — Systematic Operation & Functional Protocol", "Life Domain: Maintenance Mechanics; daily labor, somatic conditioning, and functional optimization.", "This sector governs the unglamorous, iterative processing loops required to keep a system functional - day-to-day work, physical health protocols, routines, and service tasks. It maps where the native manages friction, handles service roles, and refines mechanical skills."),
        ("House 7 — Relational Equilibrium & The External Interface", "Life Domain: The Relational Intersect; contractual partnerships, serious alliances, and open mirrors.", "Situated directly opposite the Ascendant, this sector maps the primary arena of the Other. It governs the strategic negotiations, legal boundaries, and interpersonal dynamics that challenge individual autonomy and force systemic balance."),
        ("House 8 — Systemic Processing & Structural Composting", "Life Domain: Shared Resource Dynamics; institutional entanglements, shared liabilities, and transformational crisis.", "This sector manages complex financial systems, legacies, taxes, and deep psychological or physical transformations. It acts as the system's recycling plant - where old forms are chemically or financially decomposed to clear space for systemic upgrades."),
        ("House 9 — Civilizational Paradigms & Higher Architecture", "Life Domain: Macro Expansion; epistemological frameworks, higher learning, law, and long-range exploration.", "This sector handles the structural code of civilization - legal systems, universities, philosophies, and global travel infrastructure. Planets here dictate how the native interacts with abstract mental models, synthesizes macro data, and conceptualizes worldviews."),
        ("House 10 — The Midheaven Apex & Public Sovereignty", "Life Domain: Public Architecture; professional trajectory, social status, and executive authority.", "The highest point of visible authority in the system. This sector governs professional reputation, leadership responsibilities, and visible legacy. It reveals how the native assumes a sovereign role within institutional hierarchies or public systems."),
        ("House 11 — Distributed Networks & Systemic Alliances", "Life Domain: Collective Protocols; alliance tracking, peer groups, ideological networks, and collaborative structures.", "This sector governs social movements, business associations, and distributed horizontal networks. It maps how the native coordinates with like-minded collectives to build alternative infrastructure and prospective civilizational agendas."),
        ("House 12 — The Institutional Vault & Invisible Currents", "Life Domain: Unconscious Processing; systemic blind spots, institutional containment, and foundational isolation.", "The back-stage processing space. This sector handles matters hidden from public view - prisons, hospitals, deep subconscious patterns, and karmic or ancestral currents. It represents the final frontier of the cycle where individual identity dissolves back into the collective sea."),
    ]
    spanish_houses = [
        ("Casa I — El Timón y la Interfaz Estructural", "Dominio Vital: El Cutis Localizado; el motor físico y la interfaz primaria a través de la cual la onda natal encuentra el mundo.", "Este sector rige la acción inmediata, la vitalidad basal y la orientación del sistema del yo. Los planetas que filtran a través de la Casa I condicionan la postura operativa primaria del nativo y establecen la línea de base visible de su sendero vital."),
        ("Casa II — Velocidad de Recursos y Protocolo de Sustento", "Dominio Vital: Asignación de Activos; los activos materiales, las mecánicas de seguridad física y la infraestructura líquida personal.", "Este sector rige las métricas de supervivencia, las mecánicas de ingreso y la adquisición de capital o herramientas físicas. Dicta cómo se consolida la energía, se cuantifican los valores y se genera estabilidad material para sostener el motor estructural de la Casa I."),
        ("Casa III — Redes Localizadas e Infraestructura", "Dominio Vital: Intercambio Inmediato; la logística local, el enrutamiento de datos de corto alcance y los protocolos de comunicación inmediata.", "Este sector rige el procesamiento técnico, el condicionamiento educativo temprano, los hermanos y la infraestructura de transporte localizado. Mapea cómo el nativo recopila, traduce y formatea flujos de datos inmediatos antes de escalarlos a marcos macro."),
        ("Casa IV — La Matriz Privada y el Cimiento Basal", "Dominio Vital: La Raíz Subterránea; anclajes ancestrales, líneas de base de seguridad privada y la arquitectura física doméstica.", "Arraigado en el fondo de la carta, este sector dicta la base privada, la vida hogareña y el paisaje parental temprano. Representa el laboratorio interior y silencioso donde el nativo se comporta con la historia y construye las reservas emocionales profundas requeridas para sostener la presión pública externa."),
        ("Casa V — Proyección Generativa y Producción Creativa", "Dominio Vital: Riesgo Creativo; fluidez expresiva, empresas especulativas y la producción vital individual.", "Este sector rige los hijos, la autoría creativa, las dinámicas de placer y la especulación táctica. Representa la arena específica donde la inteligencia individual cruda se proyecta hacia afuera para dejar una marca distintiva y no estandarizada en el entorno."),
        ("Casa VI — Operación Sistemática y Protocolo Funcional", "Dominio Vital: Mecánicas de Mantenimiento; el trabajo diario, el condicionamiento somático y la optimización funcional.", "Este sector rige los circuitos iterativos poco glamorosos requeridos para mantener un sistema funcional: trabajo cotidiano, protocolos de salud física, rutinas y tareas de servicio. Mapea dónde el nativo gestiona la fricción, desempeña roles de servicio y refina habilidades mecánicas."),
        ("Casa VII — Equilibrio Relacional y la Interfaz Externa", "Dominio Vital: La Intersección Relacional; asociaciones contractuales, alianzas serias y espejos abiertos.", "Situado directamente opuesto al Ascendente, este sector mapea la arena primaria del Otro. Rige las negociaciones estratégicas, los límites legales y las dinámicas interpersonales que desafían la autonomía individual y fuerzan el equilibrio sistémico."),
        ("Casa VIII — Procesamiento Sistemático y Compostaje Estructural", "Dominio Vital: Dinámicas de Recursos Compartidos; enredos institucionales, pasivos compartidos y crisis transformacionales.", "Este sector gestiona sistemas financieros complejos, legados, impuestos y transformaciones psicológicas o físicas profundas. Actúa como la planta de reciclaje del sistema, donde las formas viejas se descomponen química o financieramente para limpiar espacio para actualizaciones sistémicas."),
        ("Casa IX — Paradigmas Civilizacionales y Arquitectura Superior", "Dominio Vital: Expansión Macro; marcos epistemológicos, aprendizaje superior, ley y exploración de largo alcance.", "Este sector maneja el código estructural de la civilización: sistemas legales, universidades, filosofías e infraestructura de viajes globales. Los planetas aquí dictan cómo el nativo interactúa con modelos mentales abstractos, sintetiza datos macro y conceptualiza cosmovisiones."),
        ("Casa X — El Apice del Medio Cielo y la Soberanía Pública", "Dominio Vital: Arquitectura Pública; trayectoria profesional, estatus social y autoridad ejecutiva.", "El punto más alto de autoridad visible en el sistema. Este sector rige la reputación profesional, las responsabilidades de liderazgo y el legado visible. Revela cómo el nativo asume un rol soberano dentro de jerarquías institucionales o sistemas públicos."),
        ("Casa XI — Redes Distribuidas y Alianzas Sistémicas", "Dominio Vital: Protocolos Colectivos; seguimiento de alianzas, grupos de pares, redes ideológicas y estructuras colaborativas.", "Este sector rige movimientos sociales, asociaciones comerciales y redes horizontales distribuidas. Mapea cómo el nativo se coordina con colectivos afines para construir infraestructura alternativa y agendas civilizacionales prospectivas."),
        ("Casa XII — La Bóveda Institucional y las Corrientes Invisibles", "Dominio Vital: Procesamiento Inconsciente; puntos ciegos sistémicos, contención institucional y aislamiento fundamental.", "El espacio de procesamiento entre bastidores. Este sector maneja asuntos ocultos a la vista pública: prisiones, hospitales, patrones subconscientes profundos y corrientes kármicas o ancestrales. Representa la frontera final del ciclo donde la identidad individual se disuelve de nuevo en el mar colectivo."),
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

<h2 style="page-break-before:always;">El Motor de Casas del SkyClock Zodiyuga</h2>
<p>Las doce casas son los compartimentos estructurales de la carta natal — cada una una arena sistémica donde la energía planetaria es enrutada y condicionada. Este apéndice mapea la función arquitectónica de cada casa en el marco Zodiyuga SkyClock.</p>
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


<h2 style="page-break-before:always;">The Zodiyuga SkyClock House Engine</h2>
<p>The twelve houses are the structural compartments of the natal chart — each one a systemic arena where planetary energy is routed and conditioned. This appendix maps the architectural function of each house in the Zodiyuga SkyClock framework.</p>
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
    parser.add_argument("--tz", default="EDT", choices=["EST","EDT","CST","CDT","MST","MDT","PST","PDT","HST","AKST","COT","IST","GMT","UTC"])
    parser.add_argument("--lang", default="en", choices=["en","es"], help="Output language")
    parser.add_argument("--solar-chart", action="store_true", help="Force noon birth time and align ASC to 0° Aries (solar chart / 'sun-sign chart' default for unknown birth time)")
    args = parser.parse_args()

    tz_offsets = {"EST":5,"EDT":4,"CST":6,"CDT":5,"MST":7,"MDT":6,"PST":8,"PDT":7,"AKST":9,"HST":10,"COT":5,"IST":1,"GMT":0,"UTC":0}
    tz_offset = tz_offsets[args.tz]

    # If --solar-chart is set, force noon and align the chart to Aries ASC at 9 o'clock
    if args.solar_chart:
        args.hour = 12
        args.min = 0

    months_en = ['January','February','March','April','May','June','July','August','September','October','November','December']
    months_es = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    months = months_es if args.lang == "es" else months_en
    birth_date = f"{months[args.month-1]} {args.day}, {args.year}"
    birth_time = f"{args.hour}:{args.min:02d} {args.tz}"

    print(f"Generating report for {birth_date} at {birth_time}, {args.location}")
    if args.solar_chart:
        print(f"  [solar-chart mode: noon, ASC aligned to 0° Aries]")
    print(f"UTC offset: -{tz_offset} hours")

    html, chart_pdf_path = generate_html(birth_date, birth_time, args.location, args.lat, args.lon,
                        args.year, args.month, args.day, args.hour, args.min, tz_offset,
                        args.tz, recipient_name=args.name, lang=args.lang, solar_chart=args.solar_chart)

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
        args.tz, recipient_name=args.name, lang=args.lang, solar_chart=args.solar_chart
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
