/**
 * sw.js — JRayl Driver Docs Service Worker
 *
 * Strategy:
 *  - App shell (HTML, CSS, logo, manifest) → Cache First
 *  - docs-manifest.json                    → Network First (always try fresh)
 *  - Individual doc files (PDF / docx)     → Cache First, falling back to network
 *
 * Background pre-caching:
 *  On install the SW fetches docs-manifest.json and pre-caches every
 *  document listed in it — drivers don't need to open each file first.
 *
 * To force a full refresh on all tablets, bump CACHE_VERSION.
 */

const CACHE_VERSION = "jrayl-v1";
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DOCS    = `${CACHE_VERSION}-docs`;

// App shell — cached immediately on install
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./jrayl-logo.png",
  "./site.webmanifest",
  "./docs-manifest.json",
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      // 1. Cache the app shell
      const staticCache = await caches.open(CACHE_STATIC);
      await staticCache.addAll(SHELL_FILES);

      // 2. Fetch the manifest and pre-cache every doc in the background
      try {
        const res  = await fetch("./docs-manifest.json", { cache: "no-store" });
        const docs = await res.json();
        const docCache = await caches.open(CACHE_DOCS);

        // Cache each file individually — if one fails, keep going
        await Promise.allSettled(
          docs.map(async doc => {
            try {
              const docRes = await fetch(doc.href);
              if (docRes.ok) await docCache.put(doc.href, docRes);
            } catch {
              // File unavailable — skip silently
            }
          })
        );
      } catch {
        // Manifest unavailable — shell-only cache is fine
      }
    })()
  );
  self.skipWaiting();
});

// ─── Activate: remove old caches ─────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DOCS)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // docs-manifest.json → Network First so new docs always appear
  if (url.pathname.endsWith("docs-manifest.json")) {
    event.respondWith(networkFirstThenCache(request, CACHE_STATIC));
    return;
  }

  // Doc files → Cache First (pre-cached on install)
  if (url.pathname.includes("/docs/")) {
    event.respondWith(cacheFirstThenNetwork(request, CACHE_DOCS));
    return;
  }

  // Everything else (shell) → Cache First
  event.respondWith(cacheFirstThenNetwork(request, CACHE_STATIC));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function networkFirstThenCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline — content unavailable", { status: 503 });
  }
}

async function cacheFirstThenNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline — content unavailable", { status: 503 });
  }
}
