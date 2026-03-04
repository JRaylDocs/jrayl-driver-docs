/**
 * generate-manifest.js
 * 
 * Run this script any time you add or remove files from the docs/ subfolders.
 * It will scan each folder and rebuild docs-manifest.json automatically.
 * 
 * Usage:
 *   node generate-manifest.js
 */

const fs   = require("fs");
const path = require("path");

// ─── Folder → group mapping ───────────────────────────────────────────────────
// Key   = path relative to /docs
// Value = group name used by the HTML (must match what's in index.html)
const FOLDER_MAP = {
  "programs":            "programs",
  "reference":           "reference",
  "updates":             "updates",
  "employee":            "employee",
  "dot":                 "dot",
  "dot/maintenance":     "maintenance",   // nested under DOT → Trailer Registration
  "other":               "other",
};

const DOCS_DIR      = path.join(__dirname, "docs");
const MANIFEST_PATH = path.join(__dirname, "docs-manifest.json");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Turn a raw filename into a readable title.
 *  e.g. "driver-handbook_2024.pdf" → "Driver Handbook 2024"
 */
function fileNameToTitle(filename) {
  return filename
    .replace(/\.[^.]+$/, "")           // strip extension
    .replace(/[-_]+/g, " ")            // dashes/underscores → spaces
    .replace(/\b\w/g, c => c.toUpperCase()); // title-case
}

/** Detect type from extension */
function detectType(filename) {
  return /\.pdf$/i.test(filename) ? "pdf" : "doc";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const manifest = [];

for (const [folder, group] of Object.entries(FOLDER_MAP)) {
  const folderPath = path.join(DOCS_DIR, folder);

  // Create the folder if it doesn't exist yet
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`  📁 Created missing folder: docs/${folder}/`);
    continue; // nothing to index yet
  }

  const files = fs.readdirSync(folderPath).filter(f => {
    // Skip hidden files and directories
    if (f.startsWith(".")) return false;
    const stat = fs.statSync(path.join(folderPath, f));
    return stat.isFile();
  });

  for (const file of files) {
    manifest.push({
      group,
      title: fileNameToTitle(file),
      href:  `docs/${folder}/${file}`,
      type:  detectType(file),
    });
  }

  console.log(`  ✅ ${group.padEnd(12)} → ${files.length} file(s)`);
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`\n✨ docs-manifest.json written with ${manifest.length} total entries.\n`);





