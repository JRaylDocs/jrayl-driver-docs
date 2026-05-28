/**
 * generate-previews.mjs
 *
 * Converts every PDF in the docs/ subfolders into PNG images that can be
 * displayed inline in the website viewer. This exists because the AirDroid
 * lockdown browser intercepts PDFs and forces a download prompt, but shows
 * PNG images inline without any problem.
 *
 * Output:
 *   - PNGs saved to  docs/<folder>/_previews/<name>-<page>.png
 *   - docs-previews.json at the project root, mapping each PDF's href to
 *     its list of preview image paths.
 *
 * Run this whenever you add or change PDFs (same as generate-manifest.js):
 *   node generate-previews.mjs
 *
 * One-time setup (run once in the project folder):
 *   npm install pdf-to-img@6.1.0
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pdf } from "pdf-to-img";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Same folder map as generate-manifest.js ────────────────────────────────
const FOLDERS = [
  "programs",
  "reference",
  "updates",
  "employee",
  "dot",
  "dot/maintenance",
  "other",
];

const DOCS_DIR = path.join(__dirname, "docs");
const OUT_JSON = path.join(__dirname, "docs-previews.json");
const SCALE    = 2.0; // higher = sharper images, larger files. 2.0 is a good balance.

const previews = {};
let removedCount = 0;

for (const folder of FOLDERS) {
  const folderPath = path.join(DOCS_DIR, folder);
  if (!fs.existsSync(folderPath)) continue;

  const pdfs = fs.readdirSync(folderPath).filter(f => /\.pdf$/i.test(f) &&
    fs.statSync(path.join(folderPath, f)).isFile());

  const previewDir = path.join(folderPath, "_previews");

  // ── CLEANUP ────────────────────────────────────────────────────────────────
  // Wipe the _previews folder and rebuild from scratch every run. This way,
  // deleting or replacing a PDF can never leave orphaned PNGs behind, and a PDF
  // that loses pages (e.g. 24 → 20) won't keep the extra stale page images.
  if (fs.existsSync(previewDir)) {
    for (const old of fs.readdirSync(previewDir)) {
      if (/\.png$/i.test(old)) {
        fs.unlinkSync(path.join(previewDir, old));
        removedCount++;
      }
    }
  }

  if (pdfs.length === 0) {
    // No PDFs here anymore — remove the now-empty _previews folder if present
    if (fs.existsSync(previewDir) && fs.readdirSync(previewDir).length === 0) {
      fs.rmdirSync(previewDir);
    }
    continue;
  }

  if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

  for (const file of pdfs) {
    const pdfPath  = path.join(folderPath, file);
    const href     = `docs/${folder}/${file}`;
    const baseName = file.replace(/\.pdf$/i, "");
    const pages    = [];

    try {
      const doc = await pdf(pdfPath, { scale: SCALE });
      let pageNum = 1;
      for await (const image of doc) {
        const pngName = `${baseName}-${pageNum}.png`;
        fs.writeFileSync(path.join(previewDir, pngName), image);
        pages.push(`docs/${folder}/_previews/${pngName}`);
        pageNum++;
      }
      previews[href] = pages;
      console.log(`  🖼  ${href}  →  ${pages.length} page(s)`);
    } catch (err) {
      console.error(`  ⚠️  Failed on ${href}: ${err.message}`);
    }
  }
}

fs.writeFileSync(OUT_JSON, JSON.stringify(previews, null, 2));
console.log(`\n🧹 Cleared ${removedCount} old preview image(s) before rebuild.`);
console.log(`✨ docs-previews.json written with ${Object.keys(previews).length} PDF(s).`);
console.log(`📁 PNG previews saved under each docs/<folder>/_previews/ folder.\n`);
