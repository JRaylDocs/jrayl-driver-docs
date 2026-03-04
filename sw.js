/**
 * sw.js — JRayl Driver Docs Service Worker
 *
 * Strategy:
 *  - App shell (HTML, CSS, logo, manifest) → Cache First
 *  - docs-manifest.json                    → Network First (always try fresh)
 *  - Individual doc files (PDF / docx)     → Cache First, falling back to network
 *
 * To force drivers to get a full refresh, bump CACHE_VERSION below.
 */

const CACHE_VERSION = "jrayl-v1";
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DOCS    = `${CACHE_VERSION}-docs`;

// Files that make up the app shell — cached on install
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./jrayl-logo.png",
  "./site.webmanifest",
  "./docs-manifest.json",
];

// ─── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(SHELL_FILES))
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

  // 1. docs-manifest.json → Network First so new docs always show up
  if (url.pathname.endsWith("docs-manifest.json")) {
    event.respondWith(networkFirstThenCache(request, CACHE_STATIC));
    return;
  }

  // 2. Doc files (PDFs / docx inside /docs/) → Cache First
  if (url.pathname.includes("/docs/")) {
    event.respondWith(cacheFirstThenNetwork(request, CACHE_DOCS));
    return;
  }

  // 3. Everything else (shell) → Cache First
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
