# Cymatics Godot Handoff

**Updated:** 2026-07-10  
**Web routes:** `/cymatics/`, `/cymatics-correspondence/`  
**Primary data contract:** `cymatics-correspondence/js/data.js`

This document summarizes the current cymatics web prototype for the Godot developer. The browser pages are UI prototypes and data-contract probes; the Godot app should use the data and interaction lessons, not copy DOM/SVG implementation details directly.

## Source of Truth

The generated web module is:

`cymatics-correspondence/js/data.js`

It is generated from:

`/mnt/e/Hermes Project/Company_OS/notebook/cymatics/axes/*.json`

Regenerate with:

```bash
python3 cymatics-correspondence/build_correspondence_data.py
```

Do not hand-edit `data.js`. Godot should either read the notebook JSON directly or consume a generated export with the same shape.

## Browser Pages

`/cymatics/` is the frequency lab:

- Plate visualization for square and round modes.
- Frequency slider, cents detune, harmonics, tone on/off, volume, and waveform display.
- Solfeggio presets, plate/reference/cycle toggles, geometry overlays, and planetary presets.
- Compact top layout: fixed mode buttons, status text to the right, main readout/audio stack, and a right-side preset rail.
- Provenance/Corrections is a collapsible control inside the preset rail, not a full-width section.
- Author model support is loaded from `cymatics-correspondence/js/data.js` via `AUTHOR_MODELS`, `authorModels`, `claimsForHz`, and `lookup4d`.
- Compare mode can show author-model claims for the active frequency.

`/cymatics-correspondence/` is the atlas:

- Tree of Life SVG hub with 10 sephiroth and 22 paths.
- Sephiroth are the primary always-visible labels.
- Secondary object/path labels are hidden until the relevant click layer is active.
- Path labels are restored as a separate clickable Tarot/Hebrew-letter layer.
- Selecting a sephirah reveals related correspondence objects and populates the right-side Images/Charts/Tables sublayer slots.
- Cards are composed at runtime from generated correspondence records.
- Notes are localStorage-backed and exportable as JSON for review workflows.

## Current Tree Mapping

The Tree mapping currently lives in `cymatics-correspondence/js/main.js` as `TREE_OF_LIFE`.

It includes:

- `sephiroth`: id, number, name, Hebrew label, title, pillar, planetary/cosmological assignment, meaning, body, color, and web coordinates.
- `planetaryAssignments`: classical planet to sephirah mapping.
- `modernPlanets`: Pluto, Uranus, and Neptune as peripheral upper-triad nodes.
- `paths`: 22 path records with id, Hebrew-letter name, Tarot label, `from`, and `to`.

For Godot, promote this to a shared JSON or generated module before building a production scene. Do not copy the current SVG coordinates as canonical world coordinates; treat them as web layout hints.

## Recommended Godot Graph Shape

Use stable graph primitives rather than web-specific elements:

```json
{
  "nodes": [
    {
      "id": "tiphareth",
      "type": "sephirah",
      "label": "Tiphareth",
      "axis": "tree_of_life",
      "metadata": {}
    }
  ],
  "edges": [
    {
      "id": "samekh",
      "type": "path",
      "from": "tiphareth",
      "to": "yesod",
      "label": "Temperance",
      "metadata": {
        "hebrew_letter": "Samekh"
      }
    }
  ],
  "layers": [
    "sephiroth",
    "paths",
    "related_objects",
    "images",
    "charts",
    "tables"
  ]
}
```

Keep provenance/confidence on edges and records when possible. The web prototype currently derives many path-attached nodes from endpoint sephiroth; Godot should prefer explicit source-authored edges once available.

## Interaction Lessons

- Start with a decluttered default view. Show sephiroth labels first; reveal path/object labels through click layers.
- Selection should be a two-step interaction: first click focuses/zooms and reveals related objects, second click opens the detail card or equivalent panel.
- Related objects should not appear globally. They should be scoped to the selected sephirah or path.
- Keep visual layers independently toggleable: sephiroth, path labels, related objects, media/images, charts, tables.
- Camera movement needs careful tuning. Some web zoom cases still move in the wrong direction; Godot should treat focus movement as its own camera-controller task, not as a port of the SVG math.

## Data Notes

- Solfeggio and planetary frequencies are correspondence traditions, not experimentally verified plate resonances. Preserve epistemic status in UI.
- Metals are currently derived from planet and herb records; there is no first-class `metal.json` axis yet.
- Author models and claims are present in the generated data and power the web compare mode.
- The Images/Charts/Tables panel currently shows linked record chips, not final media assets.

## Open Godot Tasks

1. Define a shared Tree/graph JSON schema and move `TREE_OF_LIFE` out of `js/main.js`.
2. Build a Godot scene graph from nodes, edges, and layers instead of SVG paths.
3. Implement layer toggles and scoped reveal behavior for selected sephiroth/path nodes.
4. Implement a camera focus controller with deterministic target framing and no wrong-direction jumps.
5. Preserve provenance labels and correspondence-vs-physics disclaimers in detail panels.
6. Decide whether metals become a generated first-class axis.
7. Replace placeholder Images/Charts/Tables layer records with real media/chart/table asset schemas.

## Validation Used On Web

Recent web changes were validated with:

```bash
npm run build
```

The build currently passes. Vite still prints pre-existing warnings for legacy non-module script tags on several other pages; these are not cymatics failures.
