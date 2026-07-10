// Cymatic Correspondence Atlas — main.js
// Renders the 4-axis spiderweb hub, browse-by-axis tables, card detail view,
// and quick-lookup search. Consumes the data module (data.js) which is
// auto-generated from cymatics/axes/*.json at build time.

import {
  CORRESPONDENCE_DATA,
  planetForHz, planetInfo, lookupHz, lookup4d,
  solfeggioFrequencies, chladniFigures, greekModes, platonicSolids,
  allSections, allPlanets
} from './data.js';

// ── State ─────────────────────────────────────────────────────
let activeAxis = 'frequency';
let currentCard = null;
let hubSelection = null;
let hubCamera = { x: 0, y: 0, k: 1 };
let hubZoomFrame = 0;

function allHerbs() {
  return (CORRESPONDENCE_DATA.herbs && CORRESPONDENCE_DATA.herbs.all_herbs) || [];
}

function herbByName(name) {
  const needle = String(name || '').toLowerCase();
  return allHerbs().find(h => String(h.name || '').toLowerCase() === needle) || null;
}

// ── Community notes (localStorage-backed) ──────────────────────
// Notes are keyed by `card-type:card-id` and stored in localStorage
// under `cymaticsAtlas.notes.v1`. Exportable as JSON for the
// Crrow777 community-input workflow.
const NOTES_STORAGE_KEY = 'cymaticsAtlas.notes.v1';
let currentNoteCardKey = null;

function getAllNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveAllNotes(notes) {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

function getNote(cardKey) {
  const notes = getAllNotes();
  return notes[cardKey] || null;
}

function setNote(cardKey, text) {
  const notes = getAllNotes();
  if (text && text.trim()) {
    notes[cardKey] = { text: text.trim(), updated_at: new Date().toISOString() };
  } else {
    delete notes[cardKey];
  }
  saveAllNotes(notes);
}

function exportNotes() {
  const notes = getAllNotes();
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cymatics-atlas-notes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function noteCountForCard(cardType, cardId) {
  const notes = getAllNotes();
  return notes[`${cardType}:${cardId}`] ? '📝' : '';
}

// ── Field rendering helpers (handle arrays-of-objects, nested objects) ──
// renderFields(obj) — return HTML string of card-field divs for the given object.
// renderFieldsArray(obj) — same, but as an array of {label, value} for callers
// that build additional structure around the fields.
// renderValue(v) — render a single value: primitives as strings, arrays-of-objects
// as sub-tables, arrays-of-primitives as comma-joined, nested objects as
// pre-formatted JSON blocks.
function renderValue(v) {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    // Array of objects → sub-table
    if (v.every(x => x && typeof x === 'object' && !Array.isArray(x))) {
      const cols = Array.from(new Set(v.flatMap(x => Object.keys(x))));
      let table = '<table class="data-table" style="margin-top:6px"><thead><tr>';
      for (const c of cols) table += `<th>${c}</th>`;
      table += '</tr></thead><tbody>';
      for (const row of v) {
        table += '<tr>';
        for (const c of cols) {
          const cellVal = row[c];
          table += `<td>${cellVal === null || cellVal === undefined ? '—' : String(cellVal)}</td>`;
        }
        table += '</tr>';
      }
      table += '</tbody></table>';
      return table;
    }
    // Array of primitives → comma-join
    return v.join(', ');
  }
  if (typeof v === 'object') {
    // Nested object → pre-formatted JSON
    return `<pre style="margin:0;font-size:11px;color:var(--muted);white-space:pre-wrap;">${JSON.stringify(v, null, 2)}</pre>`;
  }
  return String(v);
}

function renderFields(obj) {
  let html = '';
  for (const [k, v] of Object.entries(obj)) {
    html += `<div class="card-field"><div class="card-field-label">${k}</div><div class="card-field-value">${renderValue(v)}</div></div>`;
  }
  return html;
}

function renderFieldsArray(obj) {
  const fields = [];
  for (const [k, v] of Object.entries(obj)) {
    fields.push({ label: k, value: renderValue(v) });
  }
  return fields;
}

function sectionRows(section) {
  return Array.isArray(section && section.data) ? section.data : [];
}

// ── Render the Tree of Life correspondence hub ───────────────
const TREE_OF_LIFE = {
  sephiroth: {
    kether: { number: 1, name: 'Kether', hebrew: 'כֶּתֶר', title: 'Crown', pillar: 'Middle', assignment: 'Primum Mobile / Divine Will', meaning: 'Source, unity, first motion', body: 'Crown of the head', colorName: 'White brilliance', color: '#f7f4df', textColor: '#11131a', x: 600, y: 105 },
    chokmah: { number: 2, name: 'Chokmah', hebrew: 'חָכְמָה', title: 'Wisdom', pillar: 'Mercy', assignment: 'Zodiac / Fixed Stars', meaning: 'Expansive force, generative wisdom', body: 'Left hemisphere of the brain', colorName: 'Grey', color: '#9aa0a6', textColor: '#10131a', x: 350, y: 275 },
    binah: { number: 3, name: 'Binah', hebrew: 'בִּינָה', title: 'Understanding', pillar: 'Severity', assignment: 'Saturn', meaning: 'Form, boundary, structuring intelligence', body: 'Right hemisphere of the brain', colorName: 'Black', color: '#11131a', textColor: '#edf1fb', x: 850, y: 275 },
    chesed: { number: 4, name: 'Chesed', hebrew: 'חֶסֶד', title: 'Mercy', pillar: 'Mercy', assignment: 'Jupiter', meaning: 'Expansion, order, beneficence', body: 'Left arm', colorName: 'Blue', color: '#2d68c4', textColor: '#edf1fb', x: 350, y: 540 },
    geburah: { number: 5, name: 'Geburah', hebrew: 'גְּבוּרָה', title: 'Severity', pillar: 'Severity', assignment: 'Mars', meaning: 'Force, discipline, cutting power', body: 'Right arm', colorName: 'Red', color: '#b73535', textColor: '#fff4ec', x: 850, y: 540 },
    tiphareth: { number: 6, name: 'Tiphareth', hebrew: 'תִּפְאֶרֶת', title: 'Beauty', pillar: 'Middle', assignment: 'Sun', meaning: 'Harmony, radiance, the mediating heart', body: 'Chest / heart', colorName: 'Yellow / gold', color: '#d8b546', textColor: '#17120a', x: 600, y: 710 },
    netzach: { number: 7, name: 'Netzach', hebrew: 'נֵצַח', title: 'Victory', pillar: 'Mercy', assignment: 'Venus', meaning: 'Desire, attraction, affective force', body: 'Left leg / kidney', colorName: 'Green', color: '#2f8f5b', textColor: '#effff4', x: 350, y: 965 },
    hod: { number: 8, name: 'Hod', hebrew: 'הוֹד', title: 'Splendor', pillar: 'Severity', assignment: 'Mercury', meaning: 'Language, analysis, patterning mind', body: 'Right leg / spleen', colorName: 'Orange', color: '#d9782d', textColor: '#1d1008', x: 850, y: 965 },
    yesod: { number: 9, name: 'Yesod', hebrew: 'יְסוֹד', title: 'Foundation', pillar: 'Middle', assignment: 'Moon', meaning: 'Image, rhythm, astral foundation', body: 'Genitals', colorName: 'Violet / purple', color: '#7f58c9', textColor: '#f6f0ff', x: 600, y: 1160 },
    malkuth: { number: 10, name: 'Malkuth', hebrew: 'מַלְכוּת', title: 'Kingdom', pillar: 'Middle', assignment: 'Earth / Elements', meaning: 'Manifest world, body, matter', body: 'Feet', colorName: 'Citrine, olive, russet, black', color: '#6f6536', textColor: '#fff6d9', x: 600, y: 1350 },
  },
  planetaryAssignments: {
    Saturn: 'binah',
    Jupiter: 'chesed',
    Mars: 'geburah',
    Sun: 'tiphareth',
    Venus: 'netzach',
    Mercury: 'hod',
    Moon: 'yesod',
  },
  modernPlanets: [
    { planet: 'Pluto', label: 'Pluto', x: 600, y: 36, attach: 'kether', note: 'transpersonal outer planet' },
    { planet: 'Uranus', label: 'Uranus', x: 175, y: 155, attach: 'chokmah', note: 'generational outer planet' },
    { planet: 'Neptune', label: 'Neptune', x: 1025, y: 155, attach: 'binah', note: 'generational outer planet' },
  ],
  paths: [
    { id: 'aleph', letter: 'Aleph', tarot: 'The Fool', from: 'kether', to: 'chokmah' },
    { id: 'beth', letter: 'Beth', tarot: 'The Magus', from: 'kether', to: 'binah' },
    { id: 'gimel', letter: 'Gimel', tarot: 'The High Priestess', from: 'kether', to: 'tiphareth' },
    { id: 'daleth', letter: 'Daleth', tarot: 'The Empress', from: 'chokmah', to: 'binah' },
    { id: 'he', letter: 'He', tarot: 'The Emperor', from: 'chokmah', to: 'tiphareth' },
    { id: 'vau', letter: 'Vau', tarot: 'The Hierophant', from: 'chokmah', to: 'chesed' },
    { id: 'zayin', letter: 'Zayin', tarot: 'The Lovers', from: 'binah', to: 'tiphareth' },
    { id: 'cheth', letter: 'Cheth', tarot: 'The Chariot', from: 'binah', to: 'geburah' },
    { id: 'teth', letter: 'Teth', tarot: 'Strength', from: 'chesed', to: 'geburah' },
    { id: 'yod', letter: 'Yod', tarot: 'The Hermit', from: 'chesed', to: 'tiphareth' },
    { id: 'kaph', letter: 'Kaph', tarot: 'Wheel of Fortune', from: 'chesed', to: 'netzach' },
    { id: 'lamed', letter: 'Lamed', tarot: 'Justice', from: 'geburah', to: 'tiphareth' },
    { id: 'mem', letter: 'Mem', tarot: 'The Hanged Man', from: 'geburah', to: 'hod' },
    { id: 'nun', letter: 'Nun', tarot: 'Death', from: 'tiphareth', to: 'netzach' },
    { id: 'samekh', letter: 'Samekh', tarot: 'Temperance', from: 'tiphareth', to: 'yesod' },
    { id: 'ayin', letter: 'Ayin', tarot: 'The Devil', from: 'tiphareth', to: 'hod' },
    { id: 'pe', letter: 'Pe', tarot: 'The Tower', from: 'netzach', to: 'hod' },
    { id: 'tzaddi', letter: 'Tzaddi', tarot: 'The Star', from: 'netzach', to: 'yesod' },
    { id: 'qoph', letter: 'Qoph', tarot: 'The Moon', from: 'netzach', to: 'malkuth' },
    { id: 'resh', letter: 'Resh', tarot: 'The Sun', from: 'hod', to: 'yesod' },
    { id: 'shin', letter: 'Shin', tarot: 'Judgement', from: 'hod', to: 'malkuth' },
    { id: 'tau', letter: 'Tau', tarot: 'The World', from: 'yesod', to: 'malkuth' },
  ],
};

function graphKey(type, id) {
  return `${type}:${String(id).toLowerCase()}`;
}

function sephirahById(id) {
  return TREE_OF_LIFE.sephiroth[String(id || '').toLowerCase()] || null;
}

function sephirahIdForPlanet(planet) {
  const needle = String(planet || '').toLowerCase();
  for (const [name, id] of Object.entries(TREE_OF_LIFE.planetaryAssignments)) {
    if (name.toLowerCase() === needle) return id;
  }
  return null;
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
}

function uniquePush(list, seen, item) {
  const key = graphKey(item.type, item.id);
  if (seen.has(key)) return;
  seen.add(key);
  list.push({ ...item, key });
}

function correspondencePlanet(row) {
  return firstValue(row, ['planet', 'ruler', 'planetary_ruler']);
}

function collectSephirahCorrespondences(sephirahId) {
  const sephirah = sephirahById(sephirahId);
  if (!sephirah) return { frequencies: [], colors: [], forms: [], planets: [] };

  const planetNames = [];
  for (const [planet, mappedId] of Object.entries(TREE_OF_LIFE.planetaryAssignments)) {
    if (mappedId === sephirahId) planetNames.push(planet);
  }
  if (sephirahId === 'malkuth') planetNames.push('Earth');

  const matchesPlanet = (value) => planetNames.some(p => String(value || '').toLowerCase() === p.toLowerCase());
  const out = { frequencies: [], colors: [], forms: [], planets: [] };
  const seen = new Set();

  for (const planet of planetNames) {
    const p = planetInfo(planet);
    if (p) uniquePush(out.planets, seen, { type: 'planet', id: p.planet, label: p.planet, row: p });
  }

  for (const section of allSections('frequency')) {
    for (const row of sectionRows(section)) {
      if (!row || typeof row !== 'object' || row.hz === undefined || !matchesPlanet(correspondencePlanet(row))) continue;
      uniquePush(out.frequencies, seen, { type: 'frequency', id: row.hz, label: `${row.hz} Hz`, section: section.id, row });
    }
  }

  for (const section of allSections('color')) {
    for (const row of sectionRows(section)) {
      if (!row || typeof row !== 'object' || !row.color || !matchesPlanet(correspondencePlanet(row))) continue;
      uniquePush(out.colors, seen, { type: 'color', id: row.color, label: row.color, section: section.id, row });
    }
  }

  for (const row of platonicSolids()) {
    if (matchesPlanet(correspondencePlanet(row))) uniquePush(out.forms, seen, { type: 'form', id: row.solid, label: row.solid, row });
  }
  for (const row of greekModes()) {
    if (matchesPlanet(correspondencePlanet(row))) uniquePush(out.forms, seen, { type: 'form', id: row.mode, label: `${row.mode} mode`, row });
  }
  for (const row of chladniFigures()) {
    if (matchesPlanet(correspondencePlanet(row))) uniquePush(out.forms, seen, { type: 'form', id: row.figure, label: row.figure, row });
  }

  return out;
}

function planetNamesForSephirah(sephirahId) {
  const planetNames = Object.entries(TREE_OF_LIFE.planetaryAssignments)
    .filter(([, mappedId]) => mappedId === sephirahId)
    .map(([planet]) => planet);
  if (sephirahId === 'malkuth') planetNames.push('Earth');
  return planetNames;
}

function collectSephirahSublayers(sephirahId) {
  const corr = collectSephirahCorrespondences(sephirahId);
  const planetNames = planetNamesForSephirah(sephirahId);
  const planetNameSet = new Set(planetNames.map(p => p.toLowerCase()));
  const herbs = allHerbs().filter(h => planetNameSet.has(String(h.planet || '').toLowerCase()));
  const metals = [];
  const seenMetals = new Set();
  for (const p of corr.planets) {
    const metal = p.row && p.row.metal;
    if (metal && !seenMetals.has(String(metal).toLowerCase())) {
      seenMetals.add(String(metal).toLowerCase());
      metals.push({ label: metal, type: 'metal', id: metal });
    }
  }
  for (const h of herbs) {
    const metal = h.metal;
    if (metal && !seenMetals.has(String(metal).toLowerCase())) {
      seenMetals.add(String(metal).toLowerCase());
      metals.push({ label: metal, type: 'metal', id: metal });
    }
  }

  return {
    visuals: [
      ...corr.colors.map(c => ({ label: c.label, type: 'color', id: c.id })),
      ...corr.forms.map(f => ({ label: f.label, type: 'form', id: f.id })),
    ],
    charts: [
      ...corr.planets.map(p => ({ label: p.label, type: 'planet', id: p.id })),
      ...corr.frequencies.map(f => ({ label: f.label, type: 'frequency', id: f.id })),
    ],
    tables: [
      ...metals,
      ...herbs.map(h => ({ label: h.name, type: 'herbs', id: h.name })),
    ],
  };
}

function collectTreePathNodes() {
  const bySephirah = new Map(Object.keys(TREE_OF_LIFE.sephiroth).map(id => [id, []]));
  const seen = new Set();

  for (const id of Object.keys(TREE_OF_LIFE.sephiroth)) {
    const corr = collectSephirahCorrespondences(id);
    for (const node of [...corr.frequencies, ...corr.colors, ...corr.forms]) {
      uniquePush(bySephirah.get(id), seen, { type: node.type, id: node.id, label: node.label, sephirah: id });
    }
  }

  const pathBuckets = new Map(TREE_OF_LIFE.paths.map(p => [p.id, []]));
  for (const [sephirahId, nodes] of bySephirah.entries()) {
    const touching = TREE_OF_LIFE.paths.filter(path => path.from === sephirahId || path.to === sephirahId);
    nodes.slice(0, 18).forEach((node, index) => {
      const path = touching[index % touching.length];
      if (path) pathBuckets.get(path.id).push(node);
    });
  }
  return pathBuckets;
}

function pathPoint(path, t, offset) {
  const from = TREE_OF_LIFE.sephiroth[path.from];
  const to = TREE_OF_LIFE.sephiroth[path.to];
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { x: x + (-dy / len) * offset, y: y + (dx / len) * offset };
}

function pathBasePoint(path, t) {
  const from = TREE_OF_LIFE.sephiroth[path.from];
  const to = TREE_OF_LIFE.sephiroth[path.to];
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

function closestHubNode(target, root) {
  let el = target;
  while (el && el !== root) {
    if (el.classList && el.classList.contains('hub-node')) return el;
    el = el.parentNode;
  }
  return null;
}

function closestHubEdge(target, root) {
  let el = target;
  while (el && el !== root) {
    if (el.classList && el.classList.contains('tree-path-group')) return el;
    el = el.parentNode;
  }
  return null;
}

function hubObjectKey(type, id) {
  return `${type}:${String(id)}`;
}

function hubNodeLabel(node) {
  return node.dataset.cardLabel || node.dataset.cardId;
}

function defaultHubSelection() {
  const el = document.getElementById('hub-selection');
  if (!el) return;
  el.hidden = false;
  el.innerHTML = `
    <span class="lookup-result-type planet">map</span>
    <strong>Hover or click a node</strong>
    <span class="hub-selection-hint">Click a sephirah to focus. Click the focused item again to open its card below.</span>
  `;
  updateHubActionButtons();
}

function defaultHubDataSlots() {
  const slots = document.getElementById('hub-data-slots');
  if (!slots) return;
  slots.innerHTML = `
    <div class="hub-data-slot">
      <span class="hub-data-slot-label">Images</span>
      <strong>Selected visual references</strong>
    </div>
    <div class="hub-data-slot">
      <span class="hub-data-slot-label">Charts</span>
      <strong>Frequency/color/form overlays</strong>
    </div>
    <div class="hub-data-slot">
      <span class="hub-data-slot-label">Tables</span>
      <strong>Cross-reference rows</strong>
    </div>
  `;
}

function sublayerSlotHtml(label, title, items) {
  const body = items.length
    ? `<div class="sublayer-chip-list">${items.slice(0, 18).map(item => chipHtml(item)).join('')}</div>`
    : '<p class="sublayer-empty">No linked records in this layer yet.</p>';
  return `
    <div class="hub-data-slot">
      <span class="hub-data-slot-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(title)}</strong>
      ${body}
    </div>
  `;
}

function wireSublayerSlotChips() {
  const slots = document.getElementById('hub-data-slots');
  if (!slots) return;
  slots.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      showCard(chip.dataset.cardType, chip.dataset.cardId);
    });
  });
}

function renderHubDataSlotsForSephirah(sephirahId) {
  const slots = document.getElementById('hub-data-slots');
  const s = sephirahById(sephirahId);
  if (!slots || !s) return;
  try {
    const layers = collectSephirahSublayers(sephirahId);
    slots.innerHTML = [
      sublayerSlotHtml('Images', `${s.name} visual layer`, layers.visuals),
      sublayerSlotHtml('Charts', `${s.name} chart layer`, layers.charts),
      sublayerSlotHtml('Tables', `${s.name} table layer`, layers.tables),
    ].join('');
    wireSublayerSlotChips();
  } catch (error) {
    slots.innerHTML = sublayerSlotHtml('Sublayers', `${s.name} layer data`, []);
    console.error('Failed to render sephirah sublayers', error);
  }
}

function applyHubFocus(svg, focusType, focusId) {
  const selectedPath = focusType === 'path'
    ? TREE_OF_LIFE.paths.find(p => p.id === focusId)
    : null;
  const focusedSephirah = focusType === 'sephirah' ? focusId : '';
  svg.querySelectorAll('.hub-node').forEach(node => {
    const focused = node.dataset.cardType === focusType && node.dataset.cardId === focusId;
    const relatedToPath = selectedPath
      && node.dataset.cardType === 'sephirah'
      && (node.dataset.cardId === selectedPath.from || node.dataset.cardId === selectedPath.to);
    const relatedToSephirah = Boolean(focusedSephirah)
      && (node.dataset.sephirah === focusedSephirah || node.dataset.attach === focusedSephirah);
    node.classList.toggle('is-focused', focused);
    node.classList.toggle('is-related', Boolean(relatedToPath));
    node.classList.toggle('is-related-visible', relatedToSephirah);
    node.classList.toggle('is-dimmed', !focused && !relatedToPath && !relatedToSephirah && Boolean(focusId));
  });
  svg.querySelectorAll('.little-ball-stem, .modern-planet-link').forEach(link => {
    const relatedToSephirah = Boolean(focusedSephirah)
      && (link.dataset.sephirah === focusedSephirah || link.dataset.attach === focusedSephirah);
    link.classList.toggle('is-related-visible', relatedToSephirah);
  });
  svg.querySelectorAll('.tree-path-group').forEach(path => {
    const touches = path.dataset.from === focusId || path.dataset.to === focusId;
    const selected = focusType === 'path' && path.dataset.pathId === focusId;
    const relatedToNode = focusType !== 'path' && path.dataset.pathId === svg.querySelector(`.hub-node.is-focused[data-path-id]`)?.dataset.pathId;
    path.classList.toggle('is-focused', selected || (focusType === 'sephirah' && touches) || relatedToNode);
    path.classList.toggle('is-dimmed', Boolean(focusId) && !selected && !(focusType === 'sephirah' && touches) && !relatedToNode);
  });
}

function updateHubSelection(label, type, id, relation = '', hintText = '') {
  const el = document.getElementById('hub-selection');
  if (!el) return;
  el.hidden = false;
  el.replaceChildren();
  const badge = document.createElement('span');
  badge.className = `lookup-result-type ${type}`;
  badge.textContent = type;
  const strong = document.createElement('strong');
  strong.textContent = label;
  el.append(badge, strong);
  if (relation) {
    const rel = document.createElement('span');
    rel.textContent = relation;
    el.append(rel);
  }
  const hint = document.createElement('span');
  hint.className = 'hub-selection-hint';
  hint.textContent = hintText || (id ? 'Click to focus. Click the focused item again to open its card below.' : 'Path preview. Click to focus.');
  el.append(hint);
  updateHubActionButtons();
}

function restoreHubSelectionPanel() {
  if (!hubSelection) {
    defaultHubSelection();
    return;
  }
  updateHubSelection(
    hubSelection.label,
    hubSelection.type,
    hubSelection.id,
    hubSelection.relation || '',
    'Focused. Click again to open the card below.'
  );
}

function setHubNodeZoom(node, active) {
  node.querySelectorAll('[data-normal-r][data-zoom-r]').forEach(circle => {
    circle.setAttribute('r', active ? circle.dataset.zoomR : circle.dataset.normalR);
  });
  node.querySelectorAll('[data-normal-stroke][data-zoom-stroke]').forEach(circle => {
    circle.style.strokeWidth = active ? circle.dataset.zoomStroke : circle.dataset.normalStroke;
  });
}

function setAllHubNodeZoom(svg, activeNode = null) {
  svg.querySelectorAll('.hub-node').forEach(node => {
    setHubNodeZoom(node, node === activeNode);
  });
}

function hubViewport(svg) {
  const box = svg.viewBox.baseVal;
  return {
    x: box.x || 0,
    y: box.y || 0,
    width: box.width || 1200,
    height: box.height || 1450
  };
}

function preferredHubScale(el, type) {
  if (type === 'path') return 1.45;
  if (el.classList.contains('little-ball')) return 2.15;
  if (el.classList.contains('modern-planet')) return 1.85;
  if (el.classList.contains('sephirah')) return 1.62;
  return 1.7;
}

function hubZoomPadding(el, type) {
  if (type === 'path') return 150;
  if (el.classList.contains('little-ball')) return 130;
  if (el.classList.contains('modern-planet')) return 120;
  if (el.classList.contains('sephirah')) return 180;
  return 140;
}

function targetHubTransform(svg, el, type) {
  const viewport = hubViewport(svg);
  const hasMapPoint = el.dataset.mapX && el.dataset.mapY;
  const box = hasMapPoint
    ? {
        x: Number(el.dataset.mapX) - 76,
        y: Number(el.dataset.mapY) - 76,
        width: 152,
        height: 152
      }
    : el.getBBox();
  const padding = hubZoomPadding(el, type);
  const paddedWidth = Math.max(1, box.width + padding * 2);
  const paddedHeight = Math.max(1, box.height + padding * 2);
  const fitScale = Math.min(
    viewport.width / paddedWidth,
    viewport.height / paddedHeight
  ) * 0.92;
  const k = Math.max(1, Math.min(preferredHubScale(el, type), fitScale));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const targetX = viewport.x + viewport.width / 2;
  const targetY = viewport.y + viewport.height * 0.48;

  return {
    x: targetX - cx * k,
    y: targetY - cy * k,
    k
  };
}

function writeHubCamera(svg, transform) {
  const camera = svg.querySelector('#hub-camera');
  if (!camera) return;
  camera.setAttribute(
    'transform',
    `translate(${transform.x.toFixed(2)} ${transform.y.toFixed(2)}) scale(${transform.k.toFixed(4)})`
  );
}

function setHubCamera(svg, target, animate = true) {
  cancelAnimationFrame(hubZoomFrame);
  if (!animate) {
    hubCamera = { ...target };
    writeHubCamera(svg, hubCamera);
    return;
  }

  const start = { ...hubCamera };
  const duration = 420;
  const started = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);

  const step = now => {
    const t = Math.min(1, (now - started) / duration);
    const e = ease(t);
    hubCamera = {
      x: start.x + (target.x - start.x) * e,
      y: start.y + (target.y - start.y) * e,
      k: start.k + (target.k - start.k) * e
    };
    writeHubCamera(svg, hubCamera);
    if (t < 1) hubZoomFrame = requestAnimationFrame(step);
  };
  hubZoomFrame = requestAnimationFrame(step);
}

function resetHubView(svg) {
  hubSelection = null;
  setAllHubNodeZoom(svg, null);
  svg.querySelectorAll('.hub-node, .tree-path-group').forEach(el => {
    el.classList.remove('is-focused', 'is-dimmed', 'is-related', 'is-related-visible');
  });
  svg.querySelectorAll('.path-click-layer').forEach(el => {
    el.classList.remove('is-focused', 'is-dimmed', 'is-related');
  });
  svg.querySelectorAll('.little-ball-stem, .modern-planet-link').forEach(el => {
    el.classList.remove('is-related-visible');
  });
  setHubCamera(svg, { x: 0, y: 0, k: 1 });
  defaultHubSelection();
  defaultHubDataSlots();
}

function focusHubObject(svg, el, type, id, label, relation = '') {
  hubSelection = {
    key: hubObjectKey(type, id),
    type,
    id,
    label,
    relation
  };
  setAllHubNodeZoom(svg, el.classList.contains('hub-node') ? el : null);
  applyHubFocus(svg, type, id);
  updateHubSelection(label, type, id, relation, 'Focused. Click again to open the card below.');
  setHubCamera(svg, targetHubTransform(svg, el, type));
  if (type === 'sephirah') {
    renderHubDataSlotsForSephirah(id);
  } else if (type === 'path') {
    defaultHubDataSlots();
  }
}

function handleHubObjectClick(svg, el, type, id, label, relation = '') {
  if (type !== 'sephirah' && el.classList.contains('is-related-visible')) {
    showCard(type, id);
    return;
  }
  const key = hubObjectKey(type, id);
  if (hubSelection && hubSelection.key === key) {
    showCard(type, id);
    return;
  }
  focusHubObject(svg, el, type, id, label, relation);
}

function updateHubActionButtons() {
  const openButton = document.getElementById('hub-open-card');
  const resetButton = document.getElementById('hub-reset-view');
  if (openButton) openButton.disabled = !hubSelection;
  if (resetButton) resetButton.disabled = !hubSelection;
}

function wireHubActions() {
  const svg = document.getElementById('hub-svg');
  const openButton = document.getElementById('hub-open-card');
  const resetButton = document.getElementById('hub-reset-view');
  if (openButton) {
    openButton.addEventListener('click', () => {
      if (hubSelection) showCard(hubSelection.type, hubSelection.id);
    });
  }
  if (resetButton && svg) {
    resetButton.addEventListener('click', () => resetHubView(svg));
  }
  updateHubActionButtons();
}

function renderHub() {
  const svg = document.getElementById('hub-svg');
  if (!svg) return;

  const colors = {
    frequency: '#d8b56a',
    form: '#8dd1ff',
    color: '#c890d6',
    planet: '#90d59a'
  };
  const sephiroth = TREE_OF_LIFE.sephiroth;
  const pathNodes = collectTreePathNodes();
  let html = `
    <ellipse class="hub-core-ring" cx="600" cy="720" rx="510" ry="635"/>
    <line class="pillar-line mercy" x1="350" y1="215" x2="350" y2="1015"/>
    <line class="pillar-line middle" x1="600" y1="65" x2="600" y2="1385"/>
    <line class="pillar-line severity" x1="850" y1="215" x2="850" y2="1015"/>
  `;

  for (const path of TREE_OF_LIFE.paths) {
    const from = sephiroth[path.from];
    const to = sephiroth[path.to];
    html += `
      <g class="tree-path-group" data-card-type="path" data-card-id="${escapeHtml(path.id)}" data-card-label="${escapeHtml(path.tarot)}" data-path-id="${escapeHtml(path.id)}" data-from="${escapeHtml(path.from)}" data-to="${escapeHtml(path.to)}">
        <line class="tree-path-hit" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>
        <line class="tree-path" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>
      </g>
    `;
  }

  for (const path of TREE_OF_LIFE.paths) {
    const mid = pathPoint(path, 0.5, 0);
    html += `
      <g class="path-label-group path-click-layer" tabindex="0" role="button" aria-label="${escapeHtml(path.tarot)} path" transform="translate(${mid.x.toFixed(1)} ${(mid.y - 10).toFixed(1)})" data-card-type="path" data-card-id="${escapeHtml(path.id)}" data-card-label="${escapeHtml(path.tarot)}" data-path-id="${escapeHtml(path.id)}" data-from="${escapeHtml(path.from)}" data-to="${escapeHtml(path.to)}">
        <rect class="path-label-bg" x="-118" y="-36" width="236" height="60" rx="8"/>
        <text class="path-letter" x="0" y="-12">${escapeHtml(path.letter)}</text>
        <text class="path-label" x="0" y="15">${escapeHtml(path.tarot)}</text>
      </g>
    `;
  }

  for (const path of TREE_OF_LIFE.paths) {
    const nodes = (pathNodes.get(path.id) || []).slice(0, 3);
    nodes.forEach((node, index) => {
      const t = [0.28, 0.5, 0.72][index] || 0.5;
      const offset = [-76, 76, -124][index] || 76;
      const base = pathBasePoint(path, t);
      const p = pathPoint(path, t, offset);
      const r = node.type === 'frequency' ? 8 : 7;
      html += `
        <line class="little-ball-stem ${node.type}" data-sephirah="${escapeHtml(node.sephirah)}" x1="${base.x.toFixed(1)}" y1="${base.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>
        <g class="hub-node little-ball ${node.type}" tabindex="0" role="button" aria-label="${escapeHtml(node.label)}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" data-sephirah="${escapeHtml(node.sephirah)}" data-card-type="${escapeHtml(node.type)}" data-card-id="${escapeHtml(node.id)}" data-card-label="${escapeHtml(node.label)}" data-path-id="${escapeHtml(path.id)}">
          <title>${escapeHtml(node.label)} - ${escapeHtml(TREE_OF_LIFE.sephiroth[node.sephirah].name)} correspondence</title>
          <circle class="hub-hit" cx="0" cy="0" r="30"/>
          <circle class="hub-halo" cx="0" cy="0" r="${r + 10}" data-normal-r="${r + 10}" data-zoom-r="${r + 18}" fill="${colors[node.type]}"/>
          <circle class="little-ball-core" cx="0" cy="0" r="${r + 2}" data-normal-r="${r + 2}" data-zoom-r="${r + 8}" data-normal-stroke="1.5" data-zoom-stroke="2.5" fill="${colors[node.type]}" fill-opacity="0.92"/>
          <text class="little-ball-label" x="0" y="${(r + 34).toFixed(1)}">${escapeHtml(node.label)}</text>
        </g>
      `;
    });
  }

  for (const modern of TREE_OF_LIFE.modernPlanets) {
    const attach = sephiroth[modern.attach];
    const hasCard = Boolean(planetInfo(modern.planet));
    html += `
      <line class="modern-planet-link" data-attach="${escapeHtml(modern.attach)}" x1="${modern.x}" y1="${modern.y}" x2="${attach.x}" y2="${attach.y}"/>
      <g class="hub-node modern-planet planet" tabindex="0" role="button" aria-label="${escapeHtml(modern.label)}" transform="translate(${modern.x} ${modern.y})" data-attach="${escapeHtml(modern.attach)}" data-card-type="${hasCard ? 'planet' : 'path'}" data-card-id="${escapeHtml(hasCard ? modern.planet : modern.attach)}" data-card-label="${escapeHtml(modern.label)}">
        <title>${escapeHtml(modern.planet)} - ${escapeHtml(modern.note)}</title>
        <circle class="hub-hit" cx="0" cy="0" r="44"/>
        <circle class="hub-halo" cx="0" cy="0" r="42" data-normal-r="42" data-zoom-r="48" fill="${colors.planet}"/>
        <circle class="modern-planet-core" cx="0" cy="0" r="26" data-normal-r="26" data-zoom-r="31" data-normal-stroke="1.5" data-zoom-stroke="2.5" fill="${colors.planet}" fill-opacity="0.78"/>
        <text x="0" y="58">${escapeHtml(modern.label)}</text>
      </g>
    `;
  }

  for (const [id, s] of Object.entries(sephiroth)) {
    const labelSide = s.x < 600 ? 'left' : 'right';
    const labelX = s.x < 600 ? -88 : 88;
    const labelAnchor = s.x < 600 ? 'end' : 'start';
    html += `
      <g class="hub-node sephirah ${id}" tabindex="0" role="button" aria-label="${escapeHtml(s.name)}" transform="translate(${s.x} ${s.y})" data-map-x="${s.x}" data-map-y="${s.y}" data-card-type="sephirah" data-card-id="${escapeHtml(id)}" data-card-label="${escapeHtml(s.name)}" style="--sephirah-text:${escapeHtml(s.textColor)}">
        <title>${escapeHtml(s.name)} - ${escapeHtml(s.assignment)}</title>
        <circle class="hub-hit" cx="0" cy="0" r="92"/>
        <circle class="hub-halo" cx="0" cy="0" r="68" data-normal-r="68" data-zoom-r="76" fill="${escapeHtml(s.color)}"/>
        <circle class="sephirah-core" cx="0" cy="0" r="52" data-normal-r="52" data-zoom-r="58" data-normal-stroke="2.5" data-zoom-stroke="4" fill="${escapeHtml(s.color)}"/>
          <text class="sephirah-number" x="0" y="13" font-size="34">${s.number}</text>
        <g class="sephirah-label-card ${labelSide}">
          <text class="sephirah-name" x="${labelX}" y="13" text-anchor="${labelAnchor}" font-size="42">${escapeHtml(s.name)}</text>
        </g>
      </g>
    `;
  }

  svg.innerHTML = `<g id="hub-camera">${html}</g>`;
  hubSelection = null;
  hubCamera = { x: 0, y: 0, k: 1 };

  svg.onclick = (event) => {
    if (!closestHubNode(event.target, svg) && !closestHubEdge(event.target, svg)) {
      resetHubView(svg);
    }
  };

  svg.querySelectorAll('.hub-node').forEach(node => {
    node.addEventListener('pointerenter', () => {
      setHubNodeZoom(node, true);
      updateHubSelection(hubNodeLabel(node), node.dataset.cardType, node.dataset.cardId, 'preview', 'Preview. Click to focus this item.');
    });
    node.addEventListener('pointerleave', () => {
      if (!node.classList.contains('is-focused')) setHubNodeZoom(node, false);
      if (hubSelection) applyHubFocus(svg, hubSelection.type, hubSelection.id);
      restoreHubSelectionPanel();
    });
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      handleHubObjectClick(svg, node, node.dataset.cardType, node.dataset.cardId, hubNodeLabel(node));
    });
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleHubObjectClick(svg, node, node.dataset.cardType, node.dataset.cardId, hubNodeLabel(node));
    });
  });

  svg.querySelectorAll('.path-click-layer').forEach(path => {
    const pathData = TREE_OF_LIFE.paths.find(p => p.id === path.dataset.pathId);
    const from = sephiroth[path.dataset.from];
    const to = sephiroth[path.dataset.to];
    const label = `${pathData.tarot} (${pathData.letter})`;
    const relation = `${pathData.letter} path · ${from.name} to ${to.name}`;
    path.addEventListener('pointerenter', () => {
      path.classList.add('is-focused');
      updateHubSelection(label, 'path', pathData.id, relation, 'Preview. Click to focus this path.');
    });
    path.addEventListener('pointerleave', () => {
      if (!path.classList.contains('is-focused')) path.classList.remove('is-focused');
      if (hubSelection) applyHubFocus(svg, hubSelection.type, hubSelection.id);
      restoreHubSelectionPanel();
    });
    path.addEventListener('click', (event) => {
      event.stopPropagation();
      handleHubObjectClick(svg, path, 'path', pathData.id, label, relation);
    });
    path.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleHubObjectClick(svg, path, 'path', pathData.id, label, relation);
    });
  });

  defaultHubSelection();
  defaultHubDataSlots();
}

// ── Render the active-axis browse view ────────────────────────
function renderAxisContent(axisName) {
  const container = document.getElementById('axis-content');
  if (!container) return;

  if (axisName === 'planet') {
    renderPlanetView(container);
    return;
  }
  if (axisName === 'metal') {
    renderMetalView(container);
    return;
  }

  const sections = allSections(axisName);
  let html = '';

  for (const section of sections) {
    html += `
      <div class="axis-section">
        <h3 class="axis-section-title">${section.title}</h3>
        ${section.description ? `<p class="axis-section-description">${section.description}</p>` : ''}
    `;

    const data = section.data;
    if (Array.isArray(data) && data.length > 0) {
      // Render as a table
      const cols = Object.keys(data[0]);
      html += `<table class="data-table"><thead><tr>`;
      for (const col of cols) {
        html += `<th>${col}</th>`;
      }
      html += `</tr></thead><tbody>`;
      for (const row of data) {
        html += '<tr>';
        for (const col of cols) {
          const val = row[col];
          const display = (val === null || val === undefined) ? '—' : String(val);
          // Make Hz/planet/color cells clickable
          const isClickable = (col === 'hz' || col === 'color' || col === 'planet' || col === 'note_sol');
          if (isClickable && val) {
            const cardType = col === 'hz' ? 'frequency' : (col === 'planet' ? 'planet' : 'color');
            html += `<td class="clickable" data-card-type="${cardType}" data-card-id="${val}">${display}</td>`;
          } else {
            html += `<td>${display}</td>`;
          }
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
    } else if (data && typeof data === 'object') {
      // Render structured object as a card
      html += '<div class="card-fields">' + renderFields(data) + '</div>';
    }
    html += '</div>';
  }

  container.innerHTML = html;

  // Wire clickable cells
  container.querySelectorAll('td.clickable').forEach(td => {
    td.addEventListener('click', () => {
      showCard(td.dataset.cardType, td.dataset.cardId);
    });
  });
}

function collectMetalRows() {
  const byMetal = new Map();
  const ensure = (metal) => {
    const key = String(metal || '').trim().toLowerCase();
    if (!key) return null;
    if (!byMetal.has(key)) {
      byMetal.set(key, { metal: String(metal).trim(), planets: [], herbs: [] });
    }
    return byMetal.get(key);
  };

  for (const p of allPlanets()) {
    const row = ensure(p.metal);
    if (row) row.planets.push(p);
  }
  for (const herb of allHerbs()) {
    const row = ensure(herb.metal);
    if (row) row.herbs.push(herb);
  }

  return Array.from(byMetal.values()).sort((a, b) => a.metal.localeCompare(b.metal));
}

function renderMetalView(container) {
  const rows = collectMetalRows();
  let html = '<div class="axis-section"><h3 class="axis-section-title">Metals</h3>';
  html += '<p class="axis-section-description">Material correspondence axis derived from planet and herb metal fields.</p>';
  html += '<table class="data-table"><thead><tr><th>Metal</th><th>Planetary ruler</th><th>Hz</th><th>Color</th><th>Day</th><th>Herb records</th></tr></thead><tbody>';

  for (const row of rows) {
    const planet = row.planets[0] || null;
    const planetNames = row.planets.map(p => p.planet).join(', ');
    html += '<tr>';
    html += `<td class="clickable" data-card-type="metal" data-card-id="${escapeHtml(row.metal)}">${escapeHtml(row.metal)}</td>`;
    html += planet
      ? `<td class="clickable" data-card-type="planet" data-card-id="${escapeHtml(planet.planet)}">${escapeHtml(planetNames)}</td>`
      : `<td>${planetNames ? escapeHtml(planetNames) : '—'}</td>`;
    html += planet && planet.frequency_hz
      ? `<td class="clickable" data-card-type="frequency" data-card-id="${escapeHtml(planet.frequency_hz)}">${escapeHtml(planet.frequency_hz)} Hz</td>`
      : '<td>—</td>';
    html += planet && planet.color
      ? `<td class="clickable" data-card-type="color" data-card-id="${escapeHtml(planet.color)}">${escapeHtml(planet.color)}</td>`
      : '<td>—</td>';
    html += `<td>${escapeHtml(planet ? planet.day_of_week || '—' : '—')}</td>`;
    html += row.herbs.length
      ? `<td class="clickable" data-card-type="metal" data-card-id="${escapeHtml(row.metal)}">${row.herbs.length}</td>`
      : '<td>—</td>';
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
  container.querySelectorAll('td.clickable').forEach(td => {
    td.addEventListener('click', () => {
      showCard(td.dataset.cardType, td.dataset.cardId);
    });
  });
}

function renderPlanetView(container) {
  const planets = allPlanets();
  let html = '';
  html += '<div class="axis-section"><h3 class="axis-section-title">Classical Planets</h3>';
  html += '<table class="data-table"><thead><tr><th>Planet</th><th>Hz</th><th>Note</th><th>Color</th><th>Metal</th><th>Form</th><th>Mode</th><th>Day</th></tr></thead><tbody>';
  for (const p of planets.filter(p => CORRESPONDENCE_DATA.planet.classical_planets.includes(p))) {
    html += '<tr>';
    html += `<td class="clickable" data-card-type="planet" data-card-id="${p.planet}">${p.symbol || ''} ${p.planet}</td>`;
    html += `<td class="clickable" data-card-type="frequency" data-card-id="${p.frequency_hz}">${p.frequency_hz}</td>`;
    html += `<td>${p.note || '—'}</td>`;
    html += `<td class="clickable" data-card-type="color" data-card-id="${p.color}">${p.color || '—'}</td>`;
    html += `<td>${p.metal || '—'}</td>`;
    html += `<td>${p.form_solid || '—'}</td>`;
    html += `<td>${p.mode || '—'}</td>`;
    html += `<td>${p.day_of_week || '—'}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  // Modern outer planets
  const modern = planets.filter(p => CORRESPONDENCE_DATA.planet.modern_outer_planets.includes(p));
  if (modern.length > 0) {
    html += '<div class="axis-section"><h3 class="axis-section-title">Modern Outer Planets</h3>';
    html += '<table class="data-table"><thead><tr><th>Planet</th><th>Hz</th><th>Note</th><th>Color</th><th>Metal</th><th>Body Part</th></tr></thead><tbody>';
    for (const p of modern) {
      html += '<tr>';
      html += `<td class="clickable" data-card-type="planet" data-card-id="${p.planet}">${p.symbol || ''} ${p.planet}</td>`;
      html += `<td class="clickable" data-card-type="frequency" data-card-id="${p.frequency_hz}">${p.frequency_hz}</td>`;
      html += `<td>${p.note || '—'}</td>`;
      html += `<td>${p.color || '—'}</td>`;
      html += `<td>${p.metal || '—'}</td>`;
      html += `<td>${p.body_part || '—'}</td>`;
      html += '</tr>';
    }
    html += '</tbody></table></div>';
  }
  container.innerHTML = html;

  // Wire clicks
  container.querySelectorAll('td.clickable').forEach(td => {
    td.addEventListener('click', () => {
      showCard(td.dataset.cardType, td.dataset.cardId);
    });
  });
}

// ── Card detail view ─────────────────────────────────────────
function showCard(type, id) {
  currentCard = { type, id };
  const section = document.getElementById('card-section');
  const container = document.getElementById('card-container');
  if (!section || !container) return;

  let card = null;
  try {
    if (type === 'frequency') {
      card = buildFrequencyCard(parseFloat(id));
    } else if (type === 'planet') {
      card = buildPlanetCard(id);
    } else if (type === 'color') {
      card = buildColorCard(id);
    } else if (type === 'herbs') {
      card = buildHerbCard(id);
    } else if (type === 'metal') {
      card = buildMetalCard(id);
    } else if (type === 'form') {
      card = buildFormCard(id);
    } else if (type === 'sephirah') {
      card = buildSephirahCard(id);
    } else if (type === 'path') {
      card = buildPathCard(id);
    }
  } catch (error) {
    card = {
      html: `<h3 class="card-title">${escapeHtml(id)}</h3><p class="card-subtitle">Card render failed for ${escapeHtml(type)}. ${escapeHtml(error.message || error)}</p>`
    };
  }

  if (!card) {
    card = {
      html: `<h3 class="card-title">${escapeHtml(id)}</h3><p class="card-subtitle">No card builder found for ${escapeHtml(type)}.</p>`
    };
  }

  container.innerHTML = card.html + renderNoteSection(type, id);
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Wire chip clicks
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      showCard(chip.dataset.cardType, chip.dataset.cardId);
    });
  });
  // Wire note button
  const noteBtn = container.querySelector('.add-note-btn');
  if (noteBtn) {
    noteBtn.addEventListener('click', () => openNoteModal(type, id, card.title));
  }
}

function renderNoteSection(type, id) {
  const note = getNote(`${type}:${id}`);
  const indicator = note ? '📝 (has note)' : '';
  return `
    <div class="card-section-group">
      <h3>Community Note ${indicator}</h3>
      ${note ? `<p class="source-line" style="border-left-color: var(--gold);"><em>${escapeHtml(note.text)}</em></p>
                <p class="source-line" style="border:none; padding-left:0; font-size:11px;">Updated ${new Date(note.updated_at).toLocaleString()}</p>` : '<p class="source-line" style="border:none; padding-left:0;">No note yet. Add one to share with the community.</p>'}
      <button class="add-note-btn nav-link" style="margin-top:8px;">${note ? 'Edit Note' : '+ Add Note'}</button>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function chipHtml(c) {
  return `<span class="chip ${escapeHtml(c.type)}" data-card-type="${escapeHtml(c.type)}" data-card-id="${escapeHtml(c.id)}">${escapeHtml(c.label)}</span>`;
}

function buildSephirahCard(id) {
  const sephirahId = String(id || '').toLowerCase();
  const s = sephirahById(sephirahId);
  if (!s) return null;

  const corr = collectSephirahCorrespondences(sephirahId);
  const planetNames = Object.entries(TREE_OF_LIFE.planetaryAssignments)
    .filter(([, mappedId]) => mappedId === sephirahId)
    .map(([planet]) => planet);
  if (sephirahId === 'malkuth') planetNames.push('Earth');

  const fields = [
    { label: 'Number', value: s.number },
    { label: 'Title', value: s.title },
    { label: 'Pillar', value: s.pillar },
    { label: 'Assignment', value: s.assignment },
    { label: 'Traditional Color', value: s.colorName },
    { label: 'Body Part', value: s.body },
    { label: 'Meaning', value: s.meaning },
    { label: 'Mapped data records', value: corr.frequencies.length + corr.colors.length + corr.forms.length + corr.planets.length },
  ];

  const chips = [];
  for (const p of corr.planets) chips.push({ label: p.label, type: 'planet', id: p.id });
  for (const f of corr.frequencies) chips.push({ label: f.label, type: 'frequency', id: f.id });
  for (const c of corr.colors) chips.push({ label: c.label, type: 'color', id: c.id });
  for (const f of corr.forms) chips.push({ label: f.label, type: 'form', id: f.id });

  return {
    title: s.name,
    html: `
      <h3 class="card-title">${escapeHtml(s.name)} <span class="epistemic-status primary">sephirah ${s.number}</span></h3>
      <p class="card-subtitle">${escapeHtml(s.title)} &middot; ${escapeHtml(s.assignment)}</p>
      <div class="card-fields">
        ${fields.map(f => `<div class="card-field"><div class="card-field-label">${escapeHtml(f.label)}</div><div class="card-field-value">${escapeHtml(f.value)}</div></div>`).join('')}
      </div>
      <div class="card-section-group">
        <h3>Mapped Spheres</h3>
        <p class="source-line">${planetNames.length ? escapeHtml(planetNames.join(', ')) : 'No direct planetary record in the generated data; this sphere is held as a traditional cosmic assignment.'}</p>
      </div>
      ${chips.length ? `<div class="card-section-group"><h3>Cross-references</h3><div class="chip-container">${chips.slice(0, 48).map(chipHtml).join('')}</div></div>` : ''}
      <div class="card-section-group">
        <h3>Tree Mapping</h3>
        <p class="source-line">This card is composed at runtime from the generated correspondence data. The Tree layout is a local mapping layer; <code>data.js</code> remains the Godot-compatible data contract.</p>
      </div>
    `
  };
}

function buildPathCard(id) {
  const path = TREE_OF_LIFE.paths.find(p => p.id === String(id || '').toLowerCase());
  if (!path) return null;
  const from = sephirahById(path.from);
  const to = sephirahById(path.to);
  const pathNodes = collectTreePathNodes().get(path.id) || [];
  const fields = [
    { label: 'Tarot', value: path.tarot },
    { label: 'Hebrew Letter', value: path.letter },
    { label: 'From', value: from ? from.name : path.from },
    { label: 'To', value: to ? to.name : path.to },
    { label: 'Visible correspondence nodes', value: Math.min(pathNodes.length, 5) },
  ];
  const chips = [
    { label: from.name, type: 'sephirah', id: path.from },
    { label: to.name, type: 'sephirah', id: path.to },
    ...pathNodes.slice(0, 24).map(n => ({ label: n.label, type: n.type, id: n.id })),
  ];

  return {
    title: path.tarot,
    html: `
      <h3 class="card-title">${escapeHtml(path.tarot)} <span class="epistemic-status secondary">${escapeHtml(path.letter)}</span></h3>
      <p class="card-subtitle">${escapeHtml(from.name)} to ${escapeHtml(to.name)}</p>
      <div class="card-fields">
        ${fields.map(f => `<div class="card-field"><div class="card-field-label">${escapeHtml(f.label)}</div><div class="card-field-value">${escapeHtml(f.value)}</div></div>`).join('')}
      </div>
      <div class="card-section-group">
        <h3>Cross-references</h3>
        <div class="chip-container">${chips.map(chipHtml).join('')}</div>
      </div>
      <div class="card-section-group">
        <h3>Path Role</h3>
        <p class="source-line">Tarot labels use a Hermetic prototype mapping. Frequency, color, and form balls are distributed from the correspondence records associated with either endpoint sphere.</p>
      </div>
    `
  };
}

function buildFrequencyCard(hz) {
  const info = lookup4d(hz);
  const freqs = solfeggioFrequencies();
  const solfeggioMatch = freqs.find(r => Math.abs(r.hz - hz) < 0.5);
  const lookup = lookupHz(hz);
  const planetInfoObj = lookup.planet;

  const fields = [];
  if (info.note) fields.push({ label: 'Note', value: info.note });
  if (info.chakra) fields.push({ label: 'Chakra', value: info.chakra });
  if (info.color) fields.push({ label: 'Color', value: info.color, type: 'color' });
  if (info.pattern) fields.push({ label: 'Cymatic Pattern', value: info.pattern });
  if (info.planet) fields.push({ label: 'Planet', value: info.planet, type: 'planet' });
  if (info.form_solid) fields.push({ label: 'Form (Platonic)', value: info.form_solid, type: 'form' });
  if (info.mode) fields.push({ label: 'Mode (Greek)', value: info.mode });
  if (info.claimed_use) fields.push({ label: 'Claimed Use', value: info.claimed_use });

  const crossRefs = [];
  if (info.planet && planetInfoObj) {
    crossRefs.push({ label: `${planetInfoObj.symbol || ''} ${planetInfoObj.planet}`, type: 'planet', id: planetInfoObj.planet });
    if (planetInfoObj.color) crossRefs.push({ label: planetInfoObj.color, type: 'color', id: planetInfoObj.color });
    if (planetInfoObj.metal) crossRefs.push({ label: `Metal: ${planetInfoObj.metal}`, type: 'color', id: planetInfoObj.color });
    if (planetInfoObj.form_solid) crossRefs.push({ label: planetInfoObj.form_solid, type: 'form', id: planetInfoObj.form_solid });
  }
  if (solfeggioMatch) {
    crossRefs.push({ label: 'Solfeggio tradition', type: 'frequency', id: hz });
  }

  let epistemic = 'secondary';
  if (hz === 7.83) epistemic = 'primary'; // Schumann fundamental
  if (solfeggioMatch) epistemic = 'speculative'; // healing claims unverified

  const html = `
    <h3 class="card-title">${hz} Hz <span class="epistemic-status ${epistemic}">${epistemic}</span></h3>
    <p class="card-subtitle">${solfeggioMatch ? solfeggioMatch.claimed_use : (hz === 7.83 ? "Schumann resonance / Earth's electromagnetic fundamental" : "Frequency datum")}</p>
    <div class="card-fields">
      ${fields.map(f => `<div class="card-field"><div class="card-field-label">${f.label}</div><div class="card-field-value">${f.value}</div></div>`).join('')}
    </div>
    ${crossRefs.length > 0 ? `<div class="card-section-group"><h3>Cross-references</h3><div class="chip-container">${crossRefs.map(c => `<span class="chip ${c.type}" data-card-type="${c.type}" data-card-id="${c.id}">${c.label}</span>`).join('')}</div></div>` : ''}
    <div class="card-section-group">
      <h3>Source provenance</h3>
      <p class="source-line">From <code>axes/frequency.json</code> &mdash; sections: ${info.frequency_context ? info.frequency_context.section : 'cross-referenced'}</p>
      <p class="source-line">Source MD: <code>Company_OS/notebook/cymatics/axes/frequency.md</code></p>
      ${solfeggioMatch ? '<p class="source-line"><em>Solfeggio healing claims are unverified in peer-reviewed literature. The Hz values themselves are documented in the Solfeggio tradition.</em></p>' : ''}
    </div>
  `;
  return { html };
}

function buildPlanetCard(name) {
  const p = planetInfo(name);
  if (!p) return null;

  const fields = [
    { label: 'Symbol', value: p.symbol || '—' },
    { label: 'Day', value: p.day_of_week || '—' },
    { label: 'Metal', value: p.metal || '—' },
    { label: 'Color', value: p.color || '—', type: 'color' },
    { label: 'Hz', value: p.frequency_hz, type: 'frequency' },
    { label: 'Note', value: p.note || '—' },
    { label: 'Chakra', value: p.chakra || '—' },
    { label: 'Form (Platonic)', value: p.form_solid || '—', type: 'form' },
    { label: 'Element', value: p.element || '—' },
    { label: 'Mode (Greek)', value: p.mode || '—' },
    { label: 'Hot/Cold', value: p.hot_cold || '—' },
  ];

  const crossRefs = [];
  if (p.frequency_hz) crossRefs.push({ label: `${p.frequency_hz} Hz`, type: 'frequency', id: p.frequency_hz });
  if (p.color) crossRefs.push({ label: p.color, type: 'color', id: p.color });
  if (p.form_solid) crossRefs.push({ label: p.form_solid, type: 'form', id: p.form_solid });
  if (p.mode) crossRefs.push({ label: `${p.mode} mode`, type: 'form', id: p.mode });

  const html = `
    <h3 class="card-title">${p.symbol || ''} ${p.planet} <span class="epistemic-status primary">classical</span></h3>
    <p class="card-subtitle">${p.archetype || ''}</p>
    <div class="card-fields">
      ${fields.map(f => `<div class="card-field"><div class="card-field-label">${f.label}</div><div class="card-field-value">${f.value}</div></div>`).join('')}
    </div>
    ${crossRefs.length > 0 ? `<div class="card-section-group"><h3>Cross-references</h3><div class="chip-container">${crossRefs.map(c => `<span class="chip ${c.type}" data-card-type="${c.type}" data-card-id="${c.id}">${c.label}</span>`).join('')}</div></div>` : ''}
    <div class="card-section-group">
      <h3>Source provenance</h3>
      <p class="source-line">From <code>axes/planet.json</code></p>
      <p class="source-line">Epistemic status: ${p.epistemic_status || '—'}</p>
      ${(p.source_refs || []).map(ref => `<p class="source-line">Ref: <code>${ref}</code></p>`).join('')}
    </div>
  `;
  return { html };
}

function buildColorCard(name) {
  // Find the color across the color sections
  const sections = allSections('color');
  const matches = [];
  for (const s of sections) {
    for (const row of sectionRows(s)) {
      if (typeof row === 'object' && row.color && row.color.toLowerCase() === name.toLowerCase()) {
        matches.push({ section: s, row });
      }
    }
  }

  if (matches.length === 0) {
    return {
      html: `<h3 class="card-title">${name}</h3><p class="card-subtitle">Color found in cross-references but not in the primary color sections.</p>`
    };
  }

  const fields = [];
  const m = matches[0].row;
  if (m.wavelength_nm_low) fields.push({ label: 'Wavelength (nm)', value: `${m.wavelength_nm_low}–${m.wavelength_nm_high}` });
  if (m.frequency_thz_low) fields.push({ label: 'Frequency (THz)', value: `${m.frequency_thz_low}–${m.frequency_thz_high}` });
  if (m.note) fields.push({ label: 'Note', value: m.note });
  if (m.planet) fields.push({ label: 'Planet', value: m.planet, type: 'planet' });
  if (m.element) fields.push({ label: 'Element', value: m.element });
  if (m.hot_cold) fields.push({ label: 'Hot/Cold', value: m.hot_cold });
  if (m.frequency_hz) fields.push({ label: 'Cymascope Hz', value: m.frequency_hz, type: 'frequency' });
  if (m.pattern) fields.push({ label: 'Cymatic Pattern', value: m.pattern });

  const crossRefs = [];
  if (m.planet) crossRefs.push({ label: m.planet, type: 'planet', id: m.planet });
  if (m.frequency_hz) crossRefs.push({ label: `${m.frequency_hz} Hz`, type: 'frequency', id: m.frequency_hz });

  const html = `
    <h3 class="card-title">${name} <span class="epistemic-status secondary">correspondence</span></h3>
    <p class="card-subtitle">Found in ${matches.length} correspondence(s) across the color axis</p>
    <div class="card-fields">
      ${fields.map(f => `<div class="card-field"><div class="card-field-label">${f.label}</div><div class="card-field-value">${f.value}</div></div>`).join('')}
    </div>
    ${crossRefs.length > 0 ? `<div class="card-section-group"><h3>Cross-references</h3><div class="chip-container">${crossRefs.map(c => `<span class="chip ${c.type}" data-card-type="${c.type}" data-card-id="${c.id}">${c.label}</span>`).join('')}</div></div>` : ''}
    <div class="card-section-group">
      <h3>Source provenance</h3>
      ${matches.map(m => `<p class="source-line">In <code>${m.section.id}</code> &mdash; <em>${m.section.title}</em></p>`).join('')}
    </div>
  `;
  return { html };
}

function buildFormCard(name) {
  const solids = platonicSolids();
  const modes = greekModes();
  const figures = chladniFigures();

  let entity = null, type = null;
  for (const s of solids) {
    if (s.solid === name) { entity = s; type = 'platonic_solid'; break; }
  }
  if (!entity) for (const m of modes) {
    if (m.mode === name) { entity = m; type = 'greek_mode'; break; }
  }
  if (!entity) for (const f of figures) {
    if (f.figure === name) { entity = f; type = 'chladni_figure'; break; }
  }
  if (!entity) {
    return {
      html: `<h3 class="card-title">${name}</h3><p class="card-subtitle">Form not in the primary form sections. May be in narrative-only data.</p>`
    };
  }

  const fields = renderFieldsArray(entity);

  const crossRefs = [];
  if (entity.color) crossRefs.push({ label: entity.color, type: 'color', id: entity.color });
  if (entity.planet) crossRefs.push({ label: entity.planet, type: 'planet', id: entity.planet });

  const html = `
    <h3 class="card-title">${name} <span class="epistemic-status ${type === 'platonic_solid' ? 'primary' : 'secondary'}">${type.replace('_', ' ')}</span></h3>
    <div class="card-fields">
      ${fields.map(f => `<div class="card-field"><div class="card-field-label">${f.label}</div><div class="card-field-value">${f.value}</div></div>`).join('')}
    </div>
    ${crossRefs.length > 0 ? `<div class="card-section-group"><h3>Cross-references</h3><div class="chip-container">${crossRefs.map(c => `<span class="chip ${c.type}" data-card-type="${c.type}" data-card-id="${c.id}">${c.label}</span>`).join('')}</div></div>` : ''}
  `;
  return { html };
}

// ── Quick-lookup search ──────────────────────────────────────
function wireLookup() {
  const input = document.getElementById('lookup-input');
  const results = document.getElementById('lookup-results');
  if (!input || !results) return;

  input.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }

    const matches = [];

    // Search Hz values
    for (const s of allSections('frequency')) {
      for (const row of sectionRows(s)) {
        if (typeof row !== 'object') continue;
        if (row.hz !== undefined && (String(row.hz).includes(q) || (row.color || '').toLowerCase().includes(q) || (row.planet || '').toLowerCase().includes(q) || (row.note_sol || '').toLowerCase().includes(q))) {
          matches.push({ type: 'frequency', id: row.hz, label: `${row.hz} Hz${row.color ? ' — ' + row.color : ''}${row.planet ? ' (' + row.planet + ')' : ''}` });
        }
      }
    }

    // Search planet names
    for (const p of allPlanets()) {
      if (p.planet.toLowerCase().includes(q) || (p.archetype || '').toLowerCase().includes(q) || (p.metal || '').toLowerCase().includes(q)) {
        matches.push({ type: 'planet', id: p.planet, label: `${p.symbol || ''} ${p.planet} — ${p.frequency_hz} Hz — ${p.metal}` });
      }
    }

    // Search colors
    const colorNames = new Set();
    for (const s of allSections('color')) {
      for (const row of sectionRows(s)) {
        if (typeof row === 'object' && row.color) colorNames.add(row.color);
      }
    }
    for (const c of colorNames) {
      if (c.toLowerCase().includes(q)) {
        matches.push({ type: 'color', id: c, label: c });
      }
    }

    // Search form entities
    for (const s of platonicSolids()) {
      if (s.solid.toLowerCase().includes(q) || (s.element || '').toLowerCase().includes(q)) {
        matches.push({ type: 'form', id: s.solid, label: `${s.solid} (${s.element})` });
      }
    }
    for (const m of greekModes()) {
      if (m.mode.toLowerCase().includes(q) || (m.planet || '').toLowerCase().includes(q)) {
        matches.push({ type: 'form', id: m.mode, label: `${m.mode} mode (${m.planet})` });
      }
    }
    for (const f of chladniFigures()) {
      if (f.figure.toLowerCase().includes(q)) {
        matches.push({ type: 'form', id: f.figure, label: f.figure });
      }
    }

    const metalNames = new Set();
    for (const p of allPlanets()) if (p.metal) metalNames.add(p.metal);
    for (const h of allHerbs()) if (h.metal) metalNames.add(h.metal);
    for (const metal of metalNames) {
      if (metal.toLowerCase().includes(q)) {
        matches.push({ type: 'metal', id: metal, label: `${metal} metal` });
      }
    }

    for (const h of allHerbs()) {
      if (h.name.toLowerCase().includes(q) || (h.planet || '').toLowerCase().includes(q) || (h.metal || '').toLowerCase().includes(q) || (h.primary_use || '').toLowerCase().includes(q)) {
        matches.push({ type: 'herbs', id: h.name, label: `${h.name} (${h.planet} / ${h.metal})` });
      }
    }

    if (matches.length === 0) {
      results.innerHTML = '<div class="lookup-result">No matches found</div>';
    } else {
      results.innerHTML = matches.slice(0, 20).map(m => `
        <div class="lookup-result" data-card-type="${m.type}" data-card-id="${m.id}">
          <span class="lookup-result-type ${m.type}">${m.type}</span>
          ${m.label}
        </div>
      `).join('');
      results.querySelectorAll('.lookup-result').forEach(r => {
        r.addEventListener('click', () => {
          showCard(r.dataset.cardType, r.dataset.cardId);
          results.hidden = true;
          input.value = '';
        });
      });
    }
    results.hidden = false;
  });

  // Close results on outside click
  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.hidden = true;
    }
  });
}

// ── Axis tabs ─────────────────────────────────────────────────
function wireAxisTabs() {
  const tabs = document.querySelectorAll('.axis-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeAxis = tab.dataset.axis;
      renderAxisContent(activeAxis);
    });
  });
}

// ── About modal ───────────────────────────────────────────────
function wireAboutModal() {
  const link = document.getElementById('open-about-link');
  const modal = document.getElementById('about-modal');
  const close = document.getElementById('about-close');
  if (!link || !modal || !close) return;

  link.addEventListener('click', (e) => {
    e.preventDefault();
    modal.hidden = false;
  });
  close.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });
}

// ── Notes modal ────────────────────────────────────────────────
function openNoteModal(cardType, cardId, cardTitle) {
  const modal = document.getElementById('note-modal');
  const titleEl = document.getElementById('note-modal-title');
  const labelEl = document.getElementById('note-modal-card-label');
  const textarea = document.getElementById('note-textarea');
  if (!modal || !textarea) return;
  currentNoteCardKey = `${cardType}:${cardId}`;
  titleEl.textContent = `Note for ${cardTitle || cardId}`;
  labelEl.textContent = `Card key: ${currentNoteCardKey}`;
  const existing = getNote(currentNoteCardKey);
  textarea.value = existing ? existing.text : '';
  modal.hidden = false;
  setTimeout(() => textarea.focus(), 50);
}

function closeNoteModal() {
  const modal = document.getElementById('note-modal');
  if (modal) modal.hidden = true;
  currentNoteCardKey = null;
}

function wireNotes() {
  const modal = document.getElementById('note-modal');
  const close = document.getElementById('note-close');
  const cancel = document.getElementById('note-cancel');
  const save = document.getElementById('note-save');
  const del = document.getElementById('note-delete');
  const exportBtn = document.getElementById('export-notes-button');
  if (!modal || !close || !save) return;

  close.addEventListener('click', closeNoteModal);
  cancel.addEventListener('click', closeNoteModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeNoteModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeNoteModal();
  });
  save.addEventListener('click', () => {
    if (!currentNoteCardKey) return;
    const textarea = document.getElementById('note-textarea');
    setNote(currentNoteCardKey, textarea.value);
    closeNoteModal();
    // Re-render the current card to show the new note
    if (currentCard) showCard(currentCard.type, currentCard.id);
  });
  del.addEventListener('click', () => {
    if (!currentNoteCardKey) return;
    if (confirm('Delete this note?')) {
      setNote(currentNoteCardKey, '');
      closeNoteModal();
      if (currentCard) showCard(currentCard.type, currentCard.id);
    }
  });
  if (exportBtn) {
    exportBtn.addEventListener('click', exportNotes);
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHub();
  wireHubActions();
  renderAxisContent(activeAxis);
  wireLookup();
  wireAxisTabs();
  wireAboutModal();
  wireNotes();
});

// ── Material card builders ───────────────────────────────────
function buildMetalCard(name) {
  const planets = allPlanets().filter(p => (p.metal || '').toLowerCase() === String(name).toLowerCase());
  const herbs = allHerbs().filter(h => (h.metal || '').toLowerCase() === String(name).toLowerCase());
  const planet = planets[0];

  const fields = [
    { label: 'Domain', value: 'Material correspondence' },
    { label: 'Planetary ruler', value: planets.map(p => p.planet).join(', ') || '—' },
    { label: 'Herb links', value: herbs.length ? `${herbs.length} herb records` : '—' },
  ];
  if (planet && planet.frequency_hz) fields.push({ label: 'Planetary Hz', value: `${planet.frequency_hz} Hz` });
  if (planet && planet.color) fields.push({ label: 'Color bridge', value: planet.color });

  const crossRefs = [];
  for (const p of planets) {
    crossRefs.push({ label: p.planet, type: 'planet', id: p.planet });
    if (p.frequency_hz) crossRefs.push({ label: `${p.frequency_hz} Hz`, type: 'frequency', id: p.frequency_hz });
    if (p.color) crossRefs.push({ label: p.color, type: 'color', id: p.color });
  }
  for (const herb of herbs.slice(0, 12)) {
    crossRefs.push({ label: herb.name, type: 'herbs', id: herb.name });
  }

  return {
    html: `
      <h3 class="card-title">${escapeHtml(name)} <span class="epistemic-status secondary">material</span></h3>
      <p class="card-subtitle">Metal as material receiver of planetary correspondence</p>
      <div class="card-fields">
        ${fields.map(f => `<div class="card-field"><div class="card-field-label">${escapeHtml(f.label)}</div><div class="card-field-value">${escapeHtml(f.value)}</div></div>`).join('')}
      </div>
      ${crossRefs.length > 0 ? `<div class="card-section-group"><h3>Cross-references</h3><div class="chip-container">${crossRefs.map(c => `<span class="chip ${c.type}" data-card-type="${c.type}" data-card-id="${escapeHtml(c.id)}">${escapeHtml(c.label)}</span>`).join('')}</div></div>` : ''}
      <div class="card-section-group">
        <h3>Graph Role</h3>
        <p class="source-line">Material node generated from planet/herb metal fields. The planet card remains the source authority for the bridge.</p>
      </div>
    `
  };
}

// ── Herb card builder ─────────────────────────────────────────
function buildHerbCard(name) {
  const herb = herbByName(name);
  if (!herb) {
    return { html: `<h3 class="card-title">${escapeHtml(name)}</h3><p class="card-subtitle">Herb not found in the herbs dataset.</p>` };
  }
  const fields = [
    { label: 'Planet', value: herb.planet, type: 'planet' },
    { label: 'Metal', value: herb.metal },
    { label: 'Vibrational', value: herb.light_dark_vibrational || '—' },
    { label: 'Primary Use', value: herb.primary_use || '—' },
  ];
  if (herb.grieve_excerpt && !herb.grieve_excerpt.startsWith('(')) {
    // First paragraph from Grieve
    const exc = herb.grieve_excerpt.replace(/^Description\.\s*/, '').slice(0, 350);
    fields.push({ label: 'Grieve 1931', value: exc + (herb.grieve_excerpt.length > 350 ? '…' : '') });
  }
  const crossRefs = [
    { label: herb.planet, type: 'planet', id: herb.planet },
    { label: herb.metal, type: 'planet', id: herb.planet },  // metals cross to their planet
  ];
  // Solfeggio Hz for the planet
  const planetHz = (CORRESPONDENCE_DATA.planet.classical_planets.find(p => p.planet === herb.planet) || {}).frequency_hz;
  if (planetHz) crossRefs.push({ label: `${planetHz} Hz`, type: 'frequency', id: planetHz });

  const html = `
    <h3 class="card-title">${escapeHtml(herb.name)} <span class="epistemic-status ${herb.source_grieve ? 'primary' : 'secondary'}">${herb.source_grieve ? 'primary' : 'curated'}</span></h3>
    <p class="card-subtitle">${escapeHtml(herb.planet)} herb &middot; ${escapeHtml(herb.metal)} metal &middot; ${escapeHtml(herb.light_dark_vibrational || 'unknown')} vibrational</p>
    <div class="card-fields">
      ${fields.map(f => `<div class="card-field"><div class="card-field-label">${escapeHtml(f.label)}</div><div class="card-field-value">${escapeHtml(String(f.value))}</div></div>`).join('')}
    </div>
    ${crossRefs.length > 0 ? `<div class="card-section-group"><h3>Cross-references</h3><div class="chip-container">${crossRefs.map(c => `<span class="chip ${c.type}" data-card-type="${c.type}" data-card-id="${escapeHtml(c.id)}">${escapeHtml(c.label)}</span>`).join('')}</div></div>` : ''}
    <div class="card-section-group">
      <h3>Source provenance</h3>
      <p class="source-line">Planet/metal: <code>${escapeHtml(herb.source_planet_metal || 'unknown')}</code></p>
      ${herb.source_grieve ? `<p class="source-line">Descriptive: <code>${escapeHtml(herb.source_grieve)}</code></p>` : '<p class="source-line"><em>No Grieve excerpt for this herb — planet/metal is curated from Culpeper 1653 tradition.</em></p>'}
      <p class="source-line">Source dossier: <code>cymatics/sources/grieve_modern_herbal.md</code></p>
      <p class="source-line">Source MD: <code>cymatics/axes/herbs.md</code></p>
    </div>
  `;
  return { html };
}
