/* Zarvia service worker.
 *
 * What it is for: the app starts instantly on a second visit and can be installed to a home
 * screen. What it must never do: serve a figure that is out of date. This is a ledger, so the
 * rule below is absolute - nothing from the API is ever read from, or written to, a cache.
 * Only the shell (the hashed build output, the fonts, the icons) is cached.
 *
 * Hand-written rather than generated: Vite already fingerprints every asset, which is what
 * makes a cache-first rule safe, and a build-time precache manifest would buy little for the
 * cost of another toolchain.
 */
// Bump with the release (src/config/product.js). Every cache name carries it, so activating a
// new worker drops the previous release's shell instead of serving it alongside.
const VERSION = "v1.0.0.1";
const SHELL = `zarvia-shell-${VERSION}`;
const ASSETS = `zarvia-assets-${VERSION}`;
const FONTS = `zarvia-fonts-${VERSION}`;
const KEEP = new Set([SHELL, ASSETS, FONTS]);

// Enough to paint something useful with no network. The hashed JS and CSS are not listed:
// their names change every build, and they are picked up by the asset rule on first use.
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/favicon-32.png"];

const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // addAll fails the whole install if any one URL 404s, which would leave the app with no
      // worker at all; each is added on its own so a missing icon cannot do that.
      .then((cache) => Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => {}))))
  );
  // The new worker still waits: the page decides when to switch, after telling the person.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("zarvia-") && !KEEP.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// The page asks for the update once the person accepts it.
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

/** Cache first: for anything whose URL changes when its content does. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") cache.put(request, response.clone());
  return response;
}

/** Serve what we have, refresh it in the background: for stable URLs that can still change. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fetching = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || fetching;
}

/** The network decides; the cached shell is the fallback when there is no network. */
async function networkFirstDocument(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL);
      cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL);
    return (await cache.match("/index.html")) || (await cache.match("/")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // A POST that posts a voucher is not something to replay from a cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // THE RULE: anything that could be business data goes straight to the network, with no
  // cache read, no cache write and no offline fallback. Cross-origin covers the API, which
  // is deployed separately; the path check covers a same-origin deployment behind a proxy.
  if (url.pathname.startsWith("/api") || url.pathname.includes("/api/v1")) return;

  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.has(url.hostname)) {
      event.respondWith(staleWhileRevalidate(request, FONTS));
    }
    // everything else cross-origin: left to the browser, untouched
    return;
  }

  // Deep links and reloads: the SPA shell, fresh when possible.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // Vite fingerprints these, so a hit is the right file by definition.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  // Icons, the manifest, anything else we publish ourselves.
  event.respondWith(staleWhileRevalidate(request, SHELL));
});
