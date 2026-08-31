/**
 * generate-previews.mjs
 *
 * Converts every PDF in the docs/ subfolders into PNG images that display
 * inline in the website viewer. This exists because the AirDroid lockdown
 * browser intercepts PDFs and forces a download, but shows PNGs inline.
 *
 * Two kinds of folders are handled differently:
 *
 *   • BROWSE folders (handbook, benefits, DOT, etc.) — a handful of PDFs each.
 *     These are wiped and rebuilt every run (simple, guarantees clean state).
 *
 *   • The trailers/ folder — potentially THOUSANDS of one-page registrations.
 *     These are built INCREMENTALLY: a PDF is only re-rendered when it is new
 *     or its contents changed (tracked by a content hash). Unchanged trailers
 *     are skipped, and previews for deleted/renewed trailers are pruned. This
 *     keeps each run fast and stops the repo from re-committing every image.
 *
 * Output:
 *   • PNGs under  docs/<folder>/_previews/
 *   • docs-previews.json at the project root, mapping each PDF's href to its
 *     list of preview image paths (used by index.html to show the pages).
 *
 * Run after adding/changing PDFs:
 *   node generate-previews.mjs
 *
 * One-time setup:
 *   npm install pdf-to-img@6.1.0
 */

import fs     from "fs";
import path   from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { pdf } from "pdf-to-img";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Small browse folders — wipe & rebuild each run (proven, low volume).
const BROWSE_FOLDERS = [
  "programs",
  "reference",
  "updates",
  "employee",
  "dot",
  "dot/maintenance",
  "other",
];

// High-volume folder — incremental, hash-tracked.
const TRAILER_FOLDER = "trailers";

const DOCS_DIR = path.join(__dirname, "docs");
const OUT_JSON = path.join(__dirname, "docs-previews.json");
const SCALE    = 2.0; // matches the browse docs; keeps the scanned slips legible.

const previews = {};
let removedCount = 0;

// ── Helper: render one PDF to PNGs in a preview dir, return the href paths ────
async function renderPdf(pdfPath, previewDir, folder, file) {
  const baseName = file.replace(/\.pdf$/i, "");
  const pages    = [];
  const doc      = await pdf(pdfPath, { scale: SCALE });
  let pageNum = 1;
  for await (const image of doc) {
    const pngName = `${baseName}-${pageNum}.png`;
    fs.writeFileSync(path.join(previewDir, pngName), image);
    pages.push(`docs/${folder}/_previews/${pngName}`);
    pageNum++;
  }
  return pages;
}

function sha1(buf) {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

// ── BROWSE folders: wipe & rebuild (unchanged from the original behavior) ─────
for (const folder of BROWSE_FOLDERS) {
  const folderPath = path.join(DOCS_DIR, folder);
  if (!fs.existsSync(folderPath)) continue;

  const pdfs = fs.readdirSync(folderPath).filter(f =>
    /\.pdf$/i.test(f) && fs.statSync(path.join(folderPath, f)).isFile());

  const previewDir = path.join(folderPath, "_previews");

  if (fs.existsSync(previewDir)) {
    for (const old of fs.readdirSync(previewDir)) {
      if (/\.png$/i.test(old)) { fs.unlinkSync(path.join(previewDir, old)); removedCount++; }
    }
  }

  if (pdfs.length === 0) {
    if (fs.existsSync(previewDir) && fs.readdirSync(previewDir).length === 0) fs.rmdirSync(previewDir);
    continue;
  }

  if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

  for (const file of pdfs) {
    const href = `docs/${folder}/${file}`;
    try {
      const pages = await renderPdf(path.join(folderPath, file), previewDir, folder, file);
      previews[href] = pages;
      console.log(`  🖼  ${href}  →  ${pages.length} page(s)`);
    } catch (err) {
      console.error(`  ⚠️  Failed on ${href}: ${err.message}`);
    }
  }
}

// ── TRAILERS folder: incremental, hash-tracked ────────────────────────────────
let tRendered = 0, tSkipped = 0, tPruned = 0;
const trailerPath = path.join(DOCS_DIR, TRAILER_FOLDER);

if (fs.existsSync(trailerPath)) {
  const previewDir   = path.join(trailerPath, "_previews");
  const manifestFile = path.join(previewDir, ".preview-manifest.json");
  if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

  // Load the hash manifest from the last run (persisted in the repo).
  let oldManifest = {};
  if (fs.existsSync(manifestFile)) {
    try { oldManifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")); }
    catch { oldManifest = {}; }
  }

  const pdfs = fs.readdirSync(trailerPath).filter(f =>
    /\.pdf$/i.test(f) && fs.statSync(path.join(trailerPath, f)).isFile());

  const newManifest = {};
  const keepPngs    = new Set(); // basenames of PNGs that should survive

  for (const file of pdfs) {
    const href = `docs/${TRAILER_FOLDER}/${file}`;
    const hash = sha1(fs.readFileSync(path.join(trailerPath, file)));
    const prev = oldManifest[file];

    const canReuse = prev && prev.hash === hash &&
      Array.isArray(prev.pages) &&
      prev.pages.every(p => fs.existsSync(path.join(__dirname, p)));

    let pages;
    if (canReuse) {
      pages = prev.pages;
      tSkipped++;
    } else {
      // Remove any stale pages from a previous version of this exact filename.
      if (prev && Array.isArray(prev.pages)) {
        for (const p of prev.pages) {
          const abs = path.join(__dirname, p);
          if (fs.existsSync(abs)) fs.unlinkSync(abs);
        }
      }
      try {
        pages = await renderPdf(path.join(trailerPath, file), previewDir, TRAILER_FOLDER, file);
        tRendered++;
      } catch (err) {
        console.error(`  ⚠️  Failed on ${href}: ${err.message}`);
        continue;
      }
    }

    newManifest[file]  = { hash, pages };
    previews[href]     = pages;
    pages.forEach(p => keepPngs.add(path.basename(p)));
  }

  // Prune orphan PNGs — previews whose trailer PDF was deleted or renewed
  // (a renewal changes the filename, so the old file's PNG is now an orphan).
  for (const png of fs.readdirSync(previewDir)) {
    if (/\.png$/i.test(png) && !keepPngs.has(png)) {
      fs.unlinkSync(path.join(previewDir, png));
      tPruned++;
    }
  }

  fs.writeFileSync(manifestFile, JSON.stringify(newManifest, null, 2));
  console.log(`  🚚 trailers → ${tRendered} rendered, ${tSkipped} unchanged (skipped), ${tPruned} pruned`);
}

fs.writeFileSync(OUT_JSON, JSON.stringify(previews, null, 2));
console.log(`\n🧹 Cleared ${removedCount} old browse preview(s) before rebuild.`);
console.log(`✨ docs-previews.json written with ${Object.keys(previews).length} PDF(s).`);
