/**
 * JRayl Docs — Analytics Collector
 * Google Apps Script
 */

const SHEET_ID = "1Lhuur8S-_jJvGCHHgHt62eT20uuiS9QMyrRuu6jvUr0";

function doGet(e) {
  try {
    const p     = e.parameter;
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getOrCreateSheet(ss, "Doc Opens");

    sheet.appendRow([
      formatTimestamp(p.timestamp),
      p.title     || "Unknown",
      p.group     || "Unknown",
      p.href      || "Unknown",
      p.device    || "Unknown",
      p.timestamp || "",
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

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss      = SpreadsheetApp.openById(SHEET_ID);
    const sheet   = getOrCreateSheet(ss, "Doc Opens");

    sheet.appendRow([
      formatTimestamp(payload.timestamp),
      payload.title     || "Unknown",
      payload.group     || "Unknown",
      payload.href      || "Unknown",
      payload.device    || "Unknown",
      payload.timestamp || "",
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

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(["Timestamp", "Document", "Section", "File Path", "Device", "Raw Timestamp"]);
    const header = sheet.getRange(1, 1, 1, 6);
    header.setFontWeight("bold");
    header.setBackground("#000000");
    header.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 240);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 280);
    sheet.setColumnWidth(5, 100);
  }
  return sheet;
}

function formatTimestamp(iso) {
  if (!iso) return new Date().toLocaleString();
  const d = new Date(iso);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm:ss");
}
