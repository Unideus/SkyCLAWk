# SkyCLAWk Report Engine

Self-contained PDF generator for the Zodiyuga Cosmic History Report.

## Quick start

```bash
cd report-engine/scripts
python3 generate_full_report.py   --year 1982 --month 6 --day 1 --hour 12 --min 0   --tz UTC --lat 51.5074 --lon -0.1278   --location "London, United Kingdom"   --name "Synthetic Reference"   --lang en   --output ../output/cosmic_history_report_reference.pdf
```

## Report structure

- Cover
- Natal chart wheel with constellation overlay
- Cosmic Snapshot card
- Narrative Sections 1–11
- Technical appendix: Houses, Planet Placements, Aspects, Sources

## Language

- `--lang en` (default)
- `--lang es`

## Timezones

EST, EDT, CST, CDT, MST, MDT, PST, PDT, HST, AKST, COT, IST, GMT, UTC.

## Tests

Run the focused astronomy regressions from the repository root with the same
Python environment used by the renderer:

```bash
python3 -m unittest discover -s report-engine/tests -p 'test_*.py' -v
```

The suite verifies the exact cross-year Saturn-Jupiter triple-pass sequence and
its English and Spanish snapshot text.

## Templates

Shared macros in `templates/prose_*_macro_template*.md`. Sign snippets in `templates/prose_*_{sign}_snippet*.md`. Snippet keys: `CORE_SYNTHESIS`, `EXECUTIVE_SUMMARY_PERSONAL`, `EPOCHAL_WHAT_THIS_MEANS`, `NATAL_SIGNATURE`, `LIFETIME_PATTERN`, `FINAL_ORIENTATION`.

## Sync

Keep `Master Godot SkyCLAWk/scripts/generate_full_report.py` identical to this folder's copy.
