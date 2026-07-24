# SkyCLAWk

**Sky Conjunction Layer, Astro Wheel, and Clock** — a suite of independent visualization pages under one roof. Each page is a standalone app with its own HTML, JS, and zero cross-page bleed. Shared modules (sign glyphs, Swiss Ephemeris wrapper, astro wheel) live in `shared/`.

## Pages

| Page | Route | Description |
|---|---|---|
| **Generational** | `/` or `/generational/` | Grand conjunction saeculum timeline — historical eras mapped to Saturn-Jupiter conjunctions |
| **Personal** | `/personal/` | Individual life timeline with natal chart, lifeline, and personal events |
| **Planting** | `/planting/` | Moon-phase planting calendar with static astro wheel and permaculture plan links |
| **Skyclock** | `/skyclock/` | Cyclical yuga/zodiac/conjunction display |
| **Auspicious** | `/auspicious/` | Auspicious time calculator — score any moment for a given topic using Swiss Ephemeris |
| **Wheel** | `/wheel/` | Standalone astro wheel shell |
| **Cosmic Report** | `/cosmic-report/` | Report preview and subscription path |
| **Gematria** | `/gematria/` | Gematria lookup page |
| **Cymatics Lab** | `/cymatics/` | Cymatic frequency lab with tone, waveform, author compare mode, and atlas-backed correspondences |
| **Cymatic Correspondence Atlas** | `/cymatics-correspondence/` | Tree of Life correspondence atlas and data browser for frequency/form/color/planet/herb/metal records |

## Email Lead Magnet

The shared timeline subscription modal offers the static, non-personalized
**Your Place in the Saeculum** guide and opt-in Zodi Yuga email updates. A
successful `/subscribe` response reveals the direct PDF download at
`/downloads/your-place-in-the-saeculum.pdf`. The English and Spanish modal
paths continue to use their respective MailerLite groups; the current guide
itself is in English.

The editable source of truth is
`Company_OS/deliverables/free-saeculum-report/free-saeculum-report.html`, with
canonical copy in the adjacent Markdown file. Regenerate the PDF from that HTML;
do not edit the binary directly.

## Build

```bash
npm install
npm run build        # builds dist/ — ready for Cloudflare Pages
npm run dev          # Vite dev server on port 5173
npm run preview      # preview local build
```

## Architecture

```
SkyCLAWk/
├── generational/     # Standalone generational timeline app
├── personal/         # Standalone personal timeline app
├── planting/         # Standalone planting calendar app
├── skyclock/         # Standalone cyclical skyclock app
├── auspicious/       # Standalone auspicious time calculator (Vite + WASM)
├── wheel/            # Standalone astro wheel shell
├── cosmic-report/    # Report preview and subscription path
├── gematria/         # Gematria lookup page
├── cymatics/         # Cymatic frequency lab
├── cymatics-correspondence/ # Cymatics atlas, data generator, and generated data contract
├── shared/           # Common modules (constants, astro-wheel, swe-init, etc.)
├── public/downloads/ # Static lead magnets copied into dist/downloads/
├── css/              # Shared base styles
├── data/             # cities.json
├── images/           # President portraits and assets
├── public/ephe/      # Swiss Ephemeris .se1 files
├── vite.config.js    # Multi-entry build config
├── copy-static.js    # Post-build static asset copier
└── _redirects        # Cloudflare Pages routes
```

### Key Principles

- **No cross-page bleed.** Each page has its own `ui-controller.js`, `screw-renderer.js`, and engine files. Editing personal never affects planting.
- **Shared modules are stable data.** `shared/constants.js`, `shared/astro-wheel.js`, etc. are genuinely identical across all consumers.
- **Full page reloads between scales.** Each page is a standalone HTML document with its own `<script>` tags. Navigation uses standard `<a>` links.
- **Cymatics data boundary.** `cymatics-correspondence/js/data.js` is generated from the notebook axis JSON and is treated as the web/Godot data contract. Do not hand-edit it.
- **One build command.** `npm run build` compiles all Vite page entries to `dist/`, then `copy-static.js` copies static assets and legacy script folders.

## Cymatics Dev Notes

- `/cymatics/` is the interactive lab: plate simulation, tone/waveform controls, Solfeggio and planetary presets, author compare mode, and atlas-backed source badges.
- `/cymatics-correspondence/` is the browsable atlas: Tree of Life hub, click layers for sephiroth/path/object records, card detail view, quick lookup, and local notes export.
- Godot handoff notes live in [`docs/cymatics-godot-handoff.md`](docs/cymatics-godot-handoff.md).

## Deployment

Deploy `dist/` to Cloudflare Pages:

```bash
npm run build
# Upload dist/ to Cloudflare Pages with:
#   Build command: npm run build
#   Output directory: dist
```

The `_redirects` file handles all route mapping.

## License

MIT
