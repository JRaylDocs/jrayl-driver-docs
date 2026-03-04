# JRayl Docs — Analytics Setup Guide

## What you'll end up with
A Google Sheet that logs every time a driver opens a document:
| Timestamp | Document | Section | File Path | Device |
|---|---|---|---|---|
| 03/04/2026 08:14 | Driver Handbook | programs | docs/programs/... | Tablet |

---

## Step 1 — Create the Google Sheet

1. Go to **sheets.google.com** and create a new blank spreadsheet
2. Name it something like **JRayl Docs Analytics**
3. Leave it open — you'll come back to it in Step 3

---

## Step 2 — Open Apps Script

1. In your Google Sheet click **Extensions → Apps Script**
2. A new tab opens with a code editor
3. Delete everything in the editor (the default `function myFunction` block)
4. Open the file **analytics-collector.gs** from this folder
5. Copy the entire contents and paste it into the Apps Script editor
6. Click the 💾 **Save** icon (or Ctrl+S)

---

## Step 3 — Deploy as a Web App

1. Click **Deploy → New deployment**
2. Click the ⚙️ gear icon next to "Select type" and choose **Web app**
3. Fill in the settings:
   - Description: `JRayl Docs Analytics`
   - Execute as: **Me**
   - Who has access: **Anyone** ← important, this is what allows the tablets to send data
4. Click **Deploy**
5. Google will ask you to authorize — click through and allow it
6. You'll see a **Web app URL** — copy it, it looks like:
   `https://script.google.com/macros/s/XXXXXXXXXX/exec`

---

## Step 4 — Paste the URL into index.html

Open `index.html` and find this line near the top of the `<script>` block:

```javascript
const ANALYTICS_URL = "YOUR_APPS_SCRIPT_URL_HERE";
```

Replace it with your actual URL:

```javascript
const ANALYTICS_URL = "https://script.google.com/macros/s/XXXXXXXXXX/exec";
```

Save and deploy to Netlify as normal.

---

## Step 5 — Test it

1. Open your live site on a tablet or browser
2. Open any document
3. Go back to your Google Sheet
4. Within a few seconds you should see a new row appear in the **Doc Opens** tab

If nothing appears after 30 seconds, double-check that "Who has access" is set to **Anyone** in the deployment settings.

---

## Re-deploying after code changes

If you ever update `analytics-collector.gs`:
- Go back to Apps Script
- Click **Deploy → Manage deployments**
- Click the pencil ✏️ edit icon
- Change version to **New version**
- Click **Deploy**

The URL stays the same — no need to update `index.html` again.

---

## Reading the data

The sheet auto-sorts by time of entry. To find your most-opened docs:
1. Select all data
2. Click **Insert → Pivot table**
3. Rows: **Document**, Values: **Document** (count)
4. Sort descending — most popular docs rise to the top
