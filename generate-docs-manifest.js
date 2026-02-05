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

  // DRIVER PROGRAMS (no strict prefix needed)
  if (
    fileLower.includes("team") ||
    fileLower.includes("program")
  ) {
    return "team";
  }

  // DRIVER REFERENCE
  if (fileLower.includes("reference")) {
    return "reference";
  }

  // JRAYL UPDATES
  if (fileLower.includes("update")) {
    return "updates";
  }

  // EMPLOYEE DOCS
  if (fileLower.includes("employee")) {
    return "employee";
  }

  // DOT COMPLIANCE (main)
  if (fileLower.includes("dot")) {
    return "dot";
  }

  // TRAILER REGISTRATION (nested under DOT)
  if (
    fileLower.includes("maintenance") ||
    fileLower.includes("vehicle") ||
    fileLower.includes("trailer") ||
    fileLower.includes("permit")
  ) {
    return "maintenance";
  }

  // EVERYTHING ELSE → PEOPLE PORTAL
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
  .sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.title.localeCompare(b.title);
  });

fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2));
console.log(`Generated ${manifest.length} documents`);


