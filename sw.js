/**
 * sw.js — JRayl Driver Docs Service Worker
 *
 * Strategy:
 *  - App shell (HTML, CSS, logo)                  → Cache First
 *  - docs-manifest.json + docs-previews.json      → Network First (always fresh)
 *  - Doc files + preview PNGs (/docs/)            → Cache First, cached ON DEMAND
 *
 * IMPORTANT: We intentionally do NOT pre-cache every document/preview on install.
 * With hundreds of preview images, bulk pre-caching made the install hang and
 * the worker loop on the tablets. Instead, each file is cached the first time
 * it's actually opened — fast install, no loop. Files a driver has opened once
 * are then available offline.
 *
 * To force a full refresh on all tablets, bump CACHE_VERSION below.
 */

const CACHE_VERSION = "jrayl-v7";              // ← bump this to force all tablets to refresh
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DOCS    = `${CACHE_VERSION}-docs`;

// App shell — cached immediately on install (small, fast)
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./jrayl-logo.png",
  "./site.webmanifest",
];

// JSON data files that must always be tried fresh from the network first
const NETWORK_FIRST = ["docs-manifest.json", "docs-previews.json"];

// ─── Install: cache only the small app shell (NO bulk doc pre-caching) ────────
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(CACHE_STATIC);
      // Add each individually so one failure can't abort the whole install
      await Promise.allSettled(SHELL_FILES.map(f => staticCache.add(f)));
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

  // JSON data files → Network First so new docs/previews always appear
  if (NETWORK_FIRST.some(name => url.pathname.endsWith(name))) {
    event.respondWith(networkFirstThenCache(request, CACHE_STATIC));
    return;
  }

  // Doc files and preview images → Cache First, cached on first open
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
