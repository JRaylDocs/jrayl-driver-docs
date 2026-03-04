/**
 * JRayl Docs — Analytics Collector
 * Google Apps Script — paste this into script.google.com
 *
 * Each time a driver opens a document the app sends a silent ping here.
 * This script writes one row per open to a Google Sheet.
 *
 * Columns written:
 *   Timestamp | Document Title | Section | File Path | Device
 */

// ─── Entry point ──────────────────────────────────────────────────────────────
// Google Apps Script calls doPost() for every incoming POST request.

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

const ss = SpreadsheetApp.openById("1Lhuur8S-_jJvGCHHgHt62eT20uuiS9QMyrRuu6jvUr0");
    const sheet = getOrCreateSheet(ss, "Doc Opens");

    // Write the row
    sheet.appendRow([
      formatTimestamp(payload.timestamp),  // A — readable local time
      payload.title      || "Unknown",     // B — document title
      payload.group      || "Unknown",     // C — section (programs, dot, etc.)
      payload.href       || "Unknown",     // D — file path
      parseDevice(payload.userAgent),      // E — Tablet / Desktop / Mobile
      payload.timestamp  || "",            // F — raw ISO timestamp (for sorting)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get the sheet by name, or create it with headers if it doesn't exist */
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(["Timestamp", "Document", "Section", "File Path", "Device", "Raw Timestamp"]);

    // Style the header row
    const header = sheet.getRange(1, 1, 1, 6);
    header.setFontWeight("bold");
    header.setBackground("#000000");
    header.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160); // Timestamp
    sheet.setColumnWidth(2, 240); // Document
    sheet.setColumnWidth(3, 120); // Section
    sheet.setColumnWidth(4, 280); // File Path
    sheet.setColumnWidth(5, 100); // Device
  }

  return sheet;
}

/** Convert ISO timestamp to a readable local time string */
function formatTimestamp(iso) {
  if (!iso) return new Date().toLocaleString();
  const d = new Date(iso);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm:ss");
}

/** Guess device type from user agent string */
function parseDevice(ua) {
  if (!ua) return "Unknown";
  ua = ua.toLowerCase();
  if (ua.includes("tablet") || ua.includes("ipad"))  return "Tablet";
  if (ua.includes("mobile") || ua.includes("android")) return "Mobile";
  return "Desktop";
}
