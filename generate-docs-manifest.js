const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.join(__dirname, "docs");
const OUT_FILE = path.join(__dirname, "docs-manifest.json");

function titleFromFilename(file) {
  return file
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function groupFromFilename(fileLower) {
  if (fileLower.startsWith("employee-")) return "employee";
  if (fileLower.startsWith("dot-")) return "dot";
  if (fileLower.startsWith("maintenance-") || fileLower.startsWith("vehicle-"))
    return "maintenance";
  return "other";
}

const allowed = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

const files = fs.existsSync(DOCS_DIR)
  ? fs.readdirSync(DOCS_DIR).filter(f =>
      allowed.has(path.extname(f).toLowerCase())
    )
  : [];

const manifest = files
  .map(file => {
    const ext = path.extname(file).toLowerCase();
    const lower = file.toLowerCase();

    const pinned =
      lower.startsWith("driver-reference.");

    return {
      title: titleFromFilename(file),
      href: `docs/${encodeURIComponent(file)}`,
      type: ext === ".pdf" ? "pdf" : "image",
      pinned,
      group: pinned ? "pinned" : groupFromFilename(lower)
    };
  })
  .sort((a, b) => (b.pinned === true) - (a.pinned === true));

fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2));
console.log(`Generated ${manifest.length} documents`);
