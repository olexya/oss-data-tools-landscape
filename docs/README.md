# OSS Data Tools Landscape — Interactive Site

A static, dependency-free single-page app to **browse, search, filter and sort** every
solution in the landscape catalogues. It works **with no server** — open `index.html`
directly in a browser — and is also published with GitHub Pages.

## What it does

- Reads the five Markdown catalogues at the repository root
 (`01.ingestion_and_transport.md` … `05.platform_management.md`).
- Generates `data.json` (one object per tool), `meta.json` (totals/aggregates), and
 `data.js` (the same data embedded as `window.__LANDSCAPE_DATA__` / `__LANDSCAPE_META__`).
- `index.html` loads the embedded `data.js` first (so it works under `file://`), and
 falls back to `fetch('data.json')` when served over HTTP. It renders an interactive UI:
 - **Search** by tool name.
 - **Filters**: category, section (auto-narrowed to the chosen category), license family,
 and *Meets Criteria* (yes / no / unknown).
 - **Sort** by stars, contributors, forks, creation date, last commit, or name (asc/desc).
 - **Visual cues**: colored left-border + pill per license family
 (Permissive / Copyleft / Source-available / Unknown), top-vs-flop star highlighting,
 a *Meets Criteria* badge, and faded cards/rows for tools whose last commit is stale.
 - **Card grid** and a **sortable table** view, with a live "showing N of M" counter.

### License families

| Family | Matched licenses |
|---|---|
| **Permissive** | MIT, Apache-2.0, BSD, ISC, EUPL, MPL, PostgreSQL (+ zlib, Unlicense) |
| **Copyleft** | GPL, LGPL, AGPL |
| **Source-available** | SSPL, BSL / Business Source, Elastic, FSL, RCL, TSL / Timescale |
| **Unknown / N/A** | anything else, or no `License` value |

The catalogues include a `License` column (SPDX). The parser is **column-agnostic**: it
reads each table's header row and maps columns by name, so column order or presence can
change without breaking the build.

## No server needed (open directly)

Just open `docs/index.html` in a browser. The data is embedded in `data.js` (loaded via a
`<script>` tag, which works under the `file://` protocol), so the full report renders with
no local server. Serving over HTTP also works (the app then fetches `data.json`).

## Regenerate the data locally

From the repository root:

```bash
node docs/build-data.mjs "13/06/2026"
```

- The argument is the build/generation date in `dd/mm/yyyy` (shown in the site header).
 You can also pass it via the `BUILD_DATE` environment variable. If omitted, the date is
 left blank — never hard-coded to "now".
- This writes `docs/data.json`, `docs/meta.json` **and** `docs/data.js`. The script uses
 only Node's built-in `fs` module — **no `npm install` needed** (Node 18+).

The console prints the number of entries parsed per category for a sanity check.

## Enable GitHub Pages

1. Push these files to the default branch.
2. In the repository: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. The workflow `.github/workflows/build-site.yml` runs on every push that touches a
 catalogue (or on manual **Run workflow** / `workflow_dispatch`). It regenerates the data
 against the current catalogues and deploys the `docs/` folder.

The site URL appears in the workflow run summary and under Settings → Pages once deployed.

## Files

| File | Purpose |
|---|---|
| `docs/build-data.mjs` | Pure-Node parser → `data.json` + `meta.json` + `data.js` |
| `docs/index.html` | Self-contained HTML/CSS/JS single-page app |
| `docs/data.js` | Embedded dataset (lets the page work with no server) |
| `docs/data.json` | Generated tool dataset (HTTP / Pages fallback) |
| `docs/meta.json` | Generated aggregates / build date |
| `.github/workflows/build-site.yml` | CI: regenerate data and deploy to Pages |
