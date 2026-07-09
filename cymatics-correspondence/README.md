# Cymatic Correspondence Atlas

**Status:** active prototype
**Updated:** 2026-07-08
**Local URL:** `/cymatics-correspondence/`

This static webapp is the browser prototype for the cymatics correspondence data contract generated from:

`/mnt/e/Hermes Project/Company_OS/notebook/cymatics/axes/*.json`

The generated browser module is:

`cymatics-correspondence/js/data.js`

Do not hand-edit `data.js`; regenerate it with:

```bash
python3 cymatics-correspondence/build_correspondence_data.py
```

## Current Model

The first web prototype used a 4-axis spiderweb model:

- frequency
- form
- color
- planet

The current visual prototype pivots the main hub to a Kabbalistic Tree of Life layout:

- 10 sephiroth
- 22 paths with Tarot/Hebrew-letter labels
- 7 classical planetary assignments
- 3 modern outer planets as peripheral upper-triad nodes
- path-attached correspondence nodes for frequency, color, and form records

The Tree mapping is currently a local JavaScript layer in `js/main.js`. It does not change the generated data contract used by Godot.

## Implemented

- Static atlas shell and card detail view.
- Generated `data.js` contract from notebook axis JSON.
- Browse tabs for Frequency, Form, Color, Planet, Metals, and Herbs.
- Quick lookup across frequency, planet, color, form, metal, and herbs.
- LocalStorage-backed community notes with JSON export.
- Tree of Life hub renderer using SVG.
- Sephirah cards composed from mapped planet/frequency/color/form records.
- Path cards showing Tarot/Hebrew-letter path metadata and riding correspondences.
- Metals browse axis derived from planet and herb `metal` fields.

## Current Visual State

The Tree hub is functional but visually experimental.

Known state:

- Topology and click targets work.
- Path/sephirah/card data is wired.
- Large sephirah labels were attempted outside the orbs.
- SVG drop-shadow/blur filters and column masking bands were removed after they rendered as large black rectangles over the diagram.
- The Tree visual design is paused pending a cleaner layout pass.

The current priority is to keep the data and interactions stable while avoiding further churn on the Tree styling.

## Known Issues

- Tree typography/layout is not final.
- Some labels may still overlap paths or each other at smaller viewport widths.
- Path correspondence-node distribution is derived heuristically from endpoint sephiroth, not from an explicit source-authored path mapping.
- The right-side Images/Charts/Tables panel is scaffolded but not populated yet.
- Metals are a derived browse axis, not a generated `metal.json` axis.

## Godot Compatibility Notes

Godot should continue to read the notebook JSON files directly or the same generated data shape mirrored by `data.js`.

Recommended future graph schema for Godot:

- `nodes[]`: stable id, type, label, source axis, optional 2D/3D position hints
- `edges[]`: from, to, relationship type, source/provenance, confidence
- `tree_of_life`: sephiroth, paths, Tarot/Hebrew metadata, visual anchors
- `history_nodes[]`: Pythagoras, Plato, Boethius, Kepler, Chladni, Jenny, Cymascope, etc.

Do not bake the current web-only SVG coordinates into the core JSON until the visual model stabilizes.

## Next Steps

1. Leave the Tree styling paused until a clean visual direction is chosen.
2. Populate the right-side data panel with selected records from the clicked sephirah/path.
3. Consider promoting `TREE_OF_LIFE` into a separate mapping module once stable.
4. Consider generating a first-class `metal.json` if metals become a true axis rather than a derived material bridge.
5. Add explicit graph edges in the notebook data for path correspondences instead of deriving them in the renderer.
