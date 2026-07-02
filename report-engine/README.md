# SkyCLAWk Report Engine

Self-contained PDF generator for the Zodiyuga Cosmic History Report.

## Quick start

```bash
cd report-engine/scripts
python3 generate_full_report.py   --year 1982 --month 5 --day 2 --hour 2 --min 16   --tz EDT --lat 30.22 --lon -81.68   --location "NAS Jacksonville, Florida"   --name "Cheryl K Beggs"   --lang en   --output ../output/cosmic_history_report_cheryl.pdf
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

## Templates

Shared macros in `templates/prose_*_macro_template*.md`. Sign snippets in `templates/prose_*_{sign}_snippet*.md`. Snippet keys: `CORE_SYNTHESIS`, `EXECUTIVE_SUMMARY_PERSONAL`, `EPOCHAL_WHAT_THIS_MEANS`, `NATAL_SIGNATURE`, `LIFETIME_PATTERN`, `FINAL_ORIENTATION`.

## Sync

Keep `Master Godot SkyCLAWk/scripts/generate_full_report.py` identical to this folder's copy.
