/**
 * generate-manifest.js
 *
 * Run this script any time you add or remove files from the docs/ subfolders.
 * It rebuilds docs-manifest.json automatically.
 *
 * NEW in this version:
 *   - dateAdded   : recorded the first time a file is seen; persisted in
 *                   docs-dates.json so re-runs never overwrite it.
 *   - dateModified: read from the file's last-modified time on disk.
 *
 * Usage:
 *   node generate-manifest.js
 */

const fs   = require("fs");
const path = require("path");

// ─── Folder → group mapping ───────────────────────────────────────────────────
const FOLDER_MAP = {
  "programs":        "programs",
  "reference":       "reference",
  "updates":         "updates",
  "employee":        "employee",
  "dot":             "dot",
  "dot/maintenance": "maintenance",  // nested under DOT → Trailer Registration
  "other":           "other",
};

const DOCS_DIR    = path.join(__dirname, "docs");
const MANIFEST    = path.join(__dirname, "docs-manifest.json");
const DATES_STORE = path.join(__dirname, "docs-dates.json");

// ─── Load persisted dateAdded records ────────────────────────────────────────
// Keys are the file's href (e.g. "docs/dot/form.pdf") so they survive renames
// of parent folders without resetting dates.
let storedDates = {};
if (fs.existsSync(DATES_STORE)) {
  try { storedDates = JSON.parse(fs.readFileSync(DATES_STORE, "utf8")); }
  catch { storedDates = {}; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileNameToTitle(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function detectType(filename) {
  return /\.pdf$/i.test(filename) ? "pdf" : "doc";
}

function toISODate(date) {
  return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const manifest = [];
const today    = toISODate(new Date());

for (const [folder, group] of Object.entries(FOLDER_MAP)) {
  const folderPath = path.join(DOCS_DIR, folder);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`  📁 Created missing folder: docs/${folder}/`);
    continue;
  }

  const files = fs.readdirSync(folderPath).filter(f => {
    if (f.startsWith(".")) return false;
    return fs.statSync(path.join(folderPath, f)).isFile();
  });

  for (const file of files) {
    const href         = `docs/${folder}/${file}`;
    const stat         = fs.statSync(path.join(DOCS_DIR, folder, file));
    const dateModified = toISODate(stat.mtime);

    // Only assign dateAdded once — never overwrite an existing value
    if (!storedDates[href]) {
      storedDates[href] = today;
    }
    const dateAdded = storedDates[href];

    manifest.push({
      group,
      title: fileNameToTitle(file),
      href,
      type:  detectType(file),
      dateAdded,
      dateModified,
    });
  }

  console.log(`  ✅ ${group.padEnd(12)} → ${files.length} file(s)`);
}

// Persist updated dateAdded records (prune stale entries for deleted files)
const activeHrefs = new Set(manifest.map(d => d.href));
for (const key of Object.keys(storedDates)) {
  if (!activeHrefs.has(key)) delete storedDates[key];
}

fs.writeFileSync(DATES_STORE, JSON.stringify(storedDates, null, 2));
fs.writeFileSync(MANIFEST,    JSON.stringify(manifest,    null, 2));
console.log(`\n✨ docs-manifest.json written with ${manifest.length} total entries.`);
console.log(`📅 docs-dates.json updated.\n`);


