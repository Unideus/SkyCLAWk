# Cymatic Correspondence Atlas

**Status:** active prototype  
**Updated:** 2026-07-10  
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

The atlas data still comes from the generated multi-axis correspondence contract:

- frequency
- form
- color
- planet
- herbs
- derived metals
- author models and claims

The current visual prototype presents that data through a Kabbalistic Tree of Life hub:

- 10 sephiroth as the primary always-visible labels
- 22 paths with Tarot/Hebrew-letter labels restored as their own click layer
- 7 classical planetary assignments mapped to sephiroth
- 3 modern outer planets as peripheral upper-triad nodes
- path-attached correspondence nodes for frequency, color, form, planet, herb, and metal records
- right-side Images/Charts/Tables sublayer slots that populate when a sephirah is selected

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
- Zoom-to-object behavior for selected sephiroth, paths, and related nodes.
- Tree cleanup pass that hides secondary labels by default and keeps only sephiroth names visible until a click layer is engaged.
- Related object reveal: selecting a sephirah shows related path/object sublayer nodes and right-side sublayer records.
- Path label click layer: Tarot/Hebrew path labels can be selected independently from sephiroth.

## Current Visual State

The Tree hub is functional and actively being tuned.

Known state:

- Topology and click targets work.
- Sephirah, path, and related-object cards are wired.
- Default Tree view is intentionally simplified: sephiroth labels remain visible, while secondary path/object labels stay hidden until their layer is relevant.
- Path labels are restored as a separate click layer.
- Selecting a sephirah reveals related correspondence objects and populates the sublayer slots.
- The page header and lookup are above the map/data columns; navigation remains in the top-right page controls.
- The old SVG drop-shadow/blur filters and column masking bands were removed after they rendered as large black rectangles over the diagram.

## Known Issues

- Some zoom-to-object cases may still move in unintuitive directions and need camera tuning.
- Path correspondence-node distribution is derived heuristically from endpoint sephiroth, not from an explicit source-authored path mapping.
- The Images/Charts/Tables panel currently surfaces linked record chips rather than final media/chart/table assets.
- Metals are a derived browse axis, not a generated `metal.json` axis.
- Tree coordinates and label placements are web-prototype values, not final Godot scene coordinates.

## Godot Compatibility Notes

Godot should continue to read the notebook JSON files directly or the same generated data shape mirrored by `data.js`.

Recommended future graph schema for Godot:

- `nodes[]`: stable id, type, label, source axis, optional 2D/3D position hints
- `edges[]`: from, to, relationship type, source/provenance, confidence
- `tree_of_life`: sephiroth, paths, Tarot/Hebrew metadata, visual anchors
- `layers[]`: named interaction layers such as sephiroth, paths, related objects, media/images, charts, and tables
- `history_nodes[]`: Pythagoras, Plato, Boethius, Kepler, Chladni, Jenny, Cymascope, etc.

Do not bake the current web-only SVG coordinates into the core JSON until the visual model stabilizes. If Godot needs this Tree model soon, promote `TREE_OF_LIFE` from `js/main.js` into a separate JSON or generated module first, then have both web and Godot consume that shared mapping.

See also: `docs/cymatics-godot-handoff.md`.

## Next Steps

1. Tune zoom camera direction and easing for the remaining wrong-direction selections.
2. Promote `TREE_OF_LIFE` into a shared mapping file once the Tree interaction model stabilizes.
3. Add explicit graph edges in notebook data for path correspondences instead of deriving them in the renderer.
4. Replace placeholder sublayer chips with real image/chart/table assets when the asset schema exists.
5. Consider generating a first-class `metal.json` if metals become a true axis rather than a derived material bridge.
