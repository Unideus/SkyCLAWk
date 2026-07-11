# Dev Docs Audit

**Updated:** 2026-07-10

This audit records the current developer-documentation state after the cymatics layout and atlas interaction work.

## Current Docs

- `README.md` is the current repo-level route/build/architecture overview.
- `cymatics-correspondence/README.md` is the current atlas implementation and data-contract note.
- `docs/cymatics-godot-handoff.md` is the current handoff for the Godot cymatics developer.
- `docs/skyclock-cycle-ephemeris-report.md`, `docs/planting-cycle-mode.md`, `docs/permaculture-addon-analysis.md`, and `docs/skyclawk-subscription-plan.md` are feature/product notes for their named areas.
- `report-engine/README.md` and `report-engine/specs/*.md` document the report engine. The report-engine worktree currently has unrelated local changes that were not touched by this audit.

## Historical Docs

- `MIGRATION.md` is a historical migration plan. It still describes the original consolidation path and should not be treated as the current page inventory.
- `prompts/phase1-godot-wheel.md` is a historical prompt for the Godot astro wheel phase, not the cymatics handoff.

## Cymatics Documentation State

The cymatics docs now cover:

- `/cymatics/` lab layout and atlas-backed author/correspondence data.
- `/cymatics-correspondence/` Tree of Life atlas behavior.
- Current Tree click layers: sephiroth, paths, and related correspondence objects.
- The right-side sublayer model for Images/Charts/Tables.
- Godot compatibility boundaries for `data.js`, notebook JSON, and the web-only `TREE_OF_LIFE` mapping.
- Known gaps: camera zoom tuning, explicit path edges, real media/chart/table assets, and first-class metals axis.

## Validation

Use the repo-level build before publishing docs or cymatics UI changes:

```bash
npm run build
```

As of this audit, the build passes. Existing Vite warnings about non-module script tags on legacy pages are known and unrelated to cymatics.
