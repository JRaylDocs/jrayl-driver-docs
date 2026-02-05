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

  // 1) DRIVER PROGRAMS (top section)
  if (fileLower.startsWith("team-")) return "team";

  // 2) DRIVER REFERENCE
  if (fileLower.startsWith("reference-")) return "reference";

  // 3) JRAYL UPDATES
  if (fileLower.startsWith("updates-")) return "updates";
  if (fileLower.startsWith("jrayl-update-")) return "updates";

  // 4) EMPLOYEE DOCS
  if (fileLower.startsWith("employee-")) return "employee";

  // 5) DOT COMPLIANCE (main)
  if (fileLower.startsWith("dot-")) return "dot";

  // 6) TRAILER REGISTRATION (nested under DOT)
  if (fileLower.startsWith("maintenance-") || fileLower.startsWith("vehicle-"))
    return "maintenance";

  // 7) EVERYTHING ELSE → PEOPLE PORTAL
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

    return {
      title: titleFromFilename(file),
      href: `docs/${encodeURIComponent(file)}`,
      type: ext === ".pdf" ? "pdf" : "image",
      group: groupFromFilename(lower)
    };
  })
  // Sort: group first, then title
  .sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.title.localeCompare(b.title);
  });

fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2));
console.log(`Generated ${manifest.length} documents`);

