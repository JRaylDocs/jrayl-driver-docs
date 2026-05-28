/**
 * sw.js — JRayl Driver Docs Service Worker
 *
 * Strategy:
 *  - App shell (HTML, CSS, logo)                  → Cache First
 *  - docs-manifest.json + docs-previews.json      → Network First (always fresh)
 *  - Individual doc files + preview PNGs (/docs/) → Cache First, fall back to network
 *
 * To force a full refresh on all tablets, bump CACHE_VERSION below.
 */

const CACHE_VERSION = "jrayl-v5";              // ← bump this to force all tablets to refresh
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DOCS    = `${CACHE_VERSION}-docs`;

// App shell — cached immediately on install
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./jrayl-logo.png",
  "./site.webmanifest",
];

// JSON data files that must always be tried fresh from the network first
const NETWORK_FIRST = ["docs-manifest.json", "docs-previews.json"];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      // 1. Cache the app shell (each file individually so one failure won't abort)
      const staticCache = await caches.open(CACHE_STATIC);
      await Promise.allSettled(SHELL_FILES.map(f => staticCache.add(f)));

      // 2. Pre-cache every doc AND every preview image in the background
      try {
        const res  = await fetch("./docs-manifest.json", { cache: "no-store" });
        const docs  = await res.json();
        const docCache = await caches.open(CACHE_DOCS);

        // Original document files
        await Promise.allSettled(
          docs.map(async doc => {
            try {
              const r = await fetch(doc.href);
              if (r.ok) await docCache.put(doc.href, r);
            } catch {}
          })
        );

        // Preview PNGs from docs-previews.json
        try {
          const pRes = await fetch("./docs-previews.json", { cache: "no-store" });
          const pMap = await pRes.json();
          const allPngs = Object.values(pMap).flat();
          await Promise.allSettled(
            allPngs.map(async src => {
              try {
                const r = await fetch(src);
                if (r.ok) await docCache.put(src, r);
              } catch {}
            })
          );
        } catch {}
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

  // JSON data files → Network First so new docs/previews always appear
  if (NETWORK_FIRST.some(name => url.pathname.endsWith(name))) {
    event.respondWith(networkFirstThenCache(request, CACHE_STATIC));
    return;
  }

  // Doc files and preview images → Cache First (pre-cached on install)
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
