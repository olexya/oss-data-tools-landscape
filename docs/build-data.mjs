#!/usr/bin/env node
// build-data.mjs — pure Node (fs only), no external deps.
// Reads the 5 landscape catalogues (../0X....md), parses every markdown table
// under each `###` section column-agnostically, and emits docs/data.json + docs/meta.json.
//
// Usage:
//   node docs/build-data.mjs "13/06/2026"
//   BUILD_DATE="13/06/2026" node docs/build-data.mjs
//
// The build date is taken from process.argv[2] or env BUILD_DATE (never Date.now()).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// Source files -> human-readable category names.
const SOURCES = [
  { file: '01.ingestion_and_transport.md', category: 'Ingestion & Transport' },
  { file: '02.storage.md',                 category: 'Storage' },
  { file: '03.query_and_processing.md',    category: 'Query & Processing' },
  { file: '04.analysis_and_output.md',     category: 'Analysis & Output' },
  { file: '05.platform_management.md',      category: 'Platform Management' },
];

// --- value helpers -----------------------------------------------------------

// Normalise a header cell into a canonical key.
function headerKey(raw) {
  const h = raw.trim().toLowerCase().replace(/\*/g, '').trim();
  const map = {
    'tool': 'tool',
    'subcategory': 'subcategory',
    'sub-category': 'subcategory',
    'creation date': 'creationDate',
    'created': 'creationDate',
    'stars': 'stars',
    'forks': 'forks',
    'contributors': 'contributors',
    'last release': 'lastRelease',
    'latest commit': 'latestCommit',
    'last commit': 'latestCommit',
    'meets criteria': 'meetsCriteria',
    'criteria': 'meetsCriteria',
    'license': 'license',
    'licence': 'license',
    'link': 'link',
    'url': 'link',
  };
  return map[h] || null; // unknown columns are ignored
}

// "625+" -> 625, "21,431" -> 21431, "N/A"/"-"/"" -> null
function toNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '' || /^(n\/a|na|-|—|\?)$/i.test(s)) return null;
  const cleaned = s.replace(/[, ]/g, '').replace(/\+$/, '');
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

// "27/07/2020" -> "2020-07-27". Returns null on N/A / unparseable.
function toISODate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '' || /^(n\/a|na|-|—|\?|tbd)$/i.test(s)) return null;
  // dd/mm/yyyy (most common in catalogues)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const dd = d.padStart(2, '0');
    const mm = mo.padStart(2, '0');
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${y}-${mm}-${dd}`;
    }
    return null;
  }
  // already ISO yyyy-mm-dd
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  // year only
  m = s.match(/^(\d{4})$/);
  if (m) return `${m[1]}-01-01`;
  return null;
}

// Normalise the "Meets Criteria" cell. Keep the raw text but expose a boolean.
function parseMeets(raw) {
  if (raw == null) return { meetsCriteria: null, meetsCriteriaRaw: null };
  const s = String(raw).trim();
  if (s === '' || /^(n\/a|na|-|—)$/i.test(s)) return { meetsCriteria: null, meetsCriteriaRaw: null };
  const lower = s.toLowerCase();
  if (lower.startsWith('yes')) return { meetsCriteria: true, meetsCriteriaRaw: s };
  if (lower.startsWith('no')) return { meetsCriteria: false, meetsCriteriaRaw: s };
  return { meetsCriteria: null, meetsCriteriaRaw: s };
}

function cellOrNull(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '' || /^(n\/a|na|-|—)$/i.test(s)) return null;
  return s;
}

// Extract a clean URL from a cell that may be bare, markdown link, or wrapped in <>.
function parseLink(raw) {
  const s = cellOrNull(raw);
  if (!s) return null;
  // [text](url)
  let m = s.match(/\]\((https?:\/\/[^)]+)\)/);
  if (m) return m[1];
  // <url>
  m = s.match(/<(https?:\/\/[^>]+)>/);
  if (m) return m[1];
  // bare url
  m = s.match(/https?:\/\/\S+/);
  if (m) return m[0];
  return s;
}

// Split a markdown table row into trimmed cells (handles leading/trailing pipes,
// ignores escaped \| inside cells).
function splitRow(line) {
  let body = line.trim();
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|')) body = body.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && body[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function isSeparatorRow(line) {
  // | --- | :--: | ---: | ...
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && /-/.test(line);
}

function isTableHeaderRow(line) {
  if (!/^\s*\|/.test(line)) return false;
  const cells = splitRow(line);
  // a header is recognised if the first cell maps to "tool"
  return cells.length >= 2 && headerKey(cells[0]) === 'tool';
}

function isTableDataRow(line) {
  return /^\s*\|/.test(line) && !isSeparatorRow(line);
}

// --- main parse --------------------------------------------------------------

function parseFile(category, text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let currentSection = null; // last `###` heading text

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track section headings (###, but not #### deeper). Trim trailing spaces.
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h && !/^####/.test(line)) {
      currentSection = h[1].trim();
      continue;
    }

    if (isTableHeaderRow(line)) {
      const header = splitRow(line).map(headerKey); // array of canonical keys (or null)
      // next non-blank line should be the separator; skip it if present
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && isSeparatorRow(lines[j])) {
        j++;
      }
      // consume data rows
      for (; j < lines.length; j++) {
        const dl = lines[j];
        if (dl.trim() === '') break;             // blank line ends the table
        if (!isTableDataRow(dl)) break;          // non-table line ends the table
        if (isTableHeaderRow(dl)) break;         // a new header ends this table
        const cells = splitRow(dl);
        const rec = buildRecord(category, currentSection, header, cells);
        if (rec) rows.push(rec);
      }
      i = j - 1; // continue after the table
      continue;
    }
  }
  return rows;
}

function buildRecord(category, section, header, cells) {
  // Map cells to canonical fields based on the header order (column-agnostic).
  const get = (key) => {
    const idx = header.indexOf(key);
    if (idx === -1 || idx >= cells.length) return null;
    return cells[idx];
  };

  const tool = cellOrNull(get('tool'));
  if (!tool) return null; // skip rows with no tool name

  const subcat = cellOrNull(get('subcategory'));
  // File 01 has no Subcategory column -> fall back to the section title.
  const sectionName = subcat || section || null;

  const meets = parseMeets(get('meetsCriteria'));

  return {
    category,
    section: sectionName,
    tool,
    creationDate: toISODate(get('creationDate')),
    stars: toNumber(get('stars')),
    forks: toNumber(get('forks')),
    contributors: toNumber(get('contributors')),
    lastRelease: toISODate(get('lastRelease')),
    latestCommit: toISODate(get('latestCommit')),
    meetsCriteria: meets.meetsCriteria,
    meetsCriteriaRaw: meets.meetsCriteriaRaw,
    license: cellOrNull(get('license')),
    link: parseLink(get('link')),
  };
}

// --- license families (kept in sync with the front-end) ----------------------

function licenseFamily(license) {
  if (!license) return 'Unknown';
  const l = license.toLowerCase();
  if (/\b(agpl)\b/.test(l)) return 'Copyleft';
  if (/\b(lgpl)\b/.test(l)) return 'Copyleft';
  if (/\bgpl\b/.test(l)) return 'Copyleft';
  if (/\b(sspl|bsl|business source|elastic|fsl|rcl|tsl|timescale)\b/.test(l)) return 'Source-available';
  if (/\b(mit|apache|bsd|isc|eupl|mpl|postgresql|zlib|unlicense)\b/.test(l)) return 'Permissive';
  return 'Unknown';
}

// --- run ---------------------------------------------------------------------

function main() {
  const buildDate = (process.argv[2] || process.env.BUILD_DATE || '').trim() || null;

  const all = [];
  for (const { file, category } of SOURCES) {
    const path = join(repoRoot, file);
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch (e) {
      console.warn(`! Could not read ${file}: ${e.message}`);
      continue;
    }
    const rows = parseFile(category, text);
    all.push(...rows);
  }

  // --- meta aggregation ---
  const byCategory = {};
  const bySection = {};      // "Category / Section" -> count
  const byLicenseFamily = {};
  const byLicense = {};
  let meetsYes = 0, meetsNo = 0, meetsUnknown = 0;

  for (const r of all) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    const skey = `${r.category} / ${r.section || '(none)'}`;
    bySection[skey] = (bySection[skey] || 0) + 1;

    const fam = licenseFamily(r.license);
    byLicenseFamily[fam] = (byLicenseFamily[fam] || 0) + 1;
    const lic = r.license || 'N/A';
    byLicense[lic] = (byLicense[lic] || 0) + 1;

    if (r.meetsCriteria === true) meetsYes++;
    else if (r.meetsCriteria === false) meetsNo++;
    else meetsUnknown++;
  }

  const meta = {
    generatedAt: buildDate,
    generatedAtISO: toISODate(buildDate),
    total: all.length,
    categories: byCategory,
    sections: bySection,
    licenseFamilies: byLicenseFamily,
    licenses: byLicense,
    meetsCriteria: { yes: meetsYes, no: meetsNo, unknown: meetsUnknown },
    sourceFiles: SOURCES.map((s) => s.file),
  };

  writeFileSync(join(__dirname, 'data.json'), JSON.stringify(all, null, 2) + '\n', 'utf8');
  writeFileSync(join(__dirname, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  // data.js : données embarquées pour fonctionner SANS serveur (ouverture directe
  // du fichier en file://) et sur GitHub Pages. Chargé via <script src="data.js">.
  const dataJs =
    '/* Généré par build-data.mjs — ne pas éditer à la main. */\n' +
    'window.__LANDSCAPE_DATA__ = ' + JSON.stringify(all) + ';\n' +
    'window.__LANDSCAPE_META__ = ' + JSON.stringify(meta) + ';\n';
  writeFileSync(join(__dirname, 'data.js'), dataJs, 'utf8');

  // --- console summary ---
  console.log(`Build date: ${buildDate || '(none provided)'}`);
  console.log(`Total entries parsed: ${all.length}`);
  console.log('By category:');
  for (const { category } of SOURCES) {
    console.log(`  ${category.padEnd(24)} ${byCategory[category] || 0}`);
  }
  console.log('Meets Criteria:', meta.meetsCriteria);
  console.log('License families:', byLicenseFamily);
  console.log('Wrote docs/data.json, docs/meta.json and docs/data.js (embedded)');
}

main();
