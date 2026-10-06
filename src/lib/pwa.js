// Installing the app, and keeping an installed copy up to date.
//
// Three browsers, three behaviours, and the UI has to read the same in all of them:
//   Chrome, Edge, Samsung, Android  fire beforeinstallprompt; we hold it and fire it back on a tap
//   Safari (iOS and macOS)          no API at all; the person uses Share > Add to Home Screen
//   Firefox                         no install; the app still runs and still caches
// `installState()` collapses that into one of: "ready", "manual", "insecure", "installed",
// "unsupported".
//
// "insecure" is the one that catches people out. A browser only allows a service worker, and
// only offers an install, on a secure origin - https, or localhost. Opening the dev server by
// its LAN address (http://192.168.x.x:5173) to try it on a phone is therefore a page that can
// never install, and saying so beats a menu item that does nothing.

const isBrowser = typeof window !== "undefined";

/** The event Chromium fires before offering an install, kept for a later tap. */
let deferred = null;
const listeners = new Set();

const announce = () => listeners.forEach((fn) => fn());

if (isBrowser) {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Chromium shows its own mini-infobar unless this is prevented; we want the offer to sit
    // in the account menu instead of appearing over the page unannounced.
    e.preventDefault();
    deferred = e;
    announce();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    announce();
  });
}

/** Subscribe to install-availability changes. Returns an unsubscribe. */
export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Already running as an installed app? */
export function isStandalone() {
  if (!isBrowser) return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    // iOS Safari's own flag, which predates display-mode
    window.navigator.standalone === true
  );
}

export function isIOS() {
  if (!isBrowser) return false;
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/** https, or localhost. Anything else cannot install, whatever the browser. */
export function isSecure() {
  if (!isBrowser) return false;
  if (window.isSecureContext !== undefined) return window.isSecureContext;
  const { protocol, hostname } = window.location;
  return protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
}

export function installState() {
  if (!isBrowser) return "unsupported";
  if (isStandalone()) return "installed";
  if (deferred) return "ready";
  // Safari can install but will not say so, so the offer is shown with instructions instead.
  // It adds to the Home Screen over plain http too, which is why this comes first.
  if (isIOS()) return "manual";
  // A browser that could install, on an address where nothing can.
  if (!isSecure()) return "insecure";
  return "unsupported";
}

/**
 * Show the browser's install dialog. Resolves "accepted", "dismissed", or "unavailable" when
 * there was no stored prompt (the event can only be used once).
 */
export async function promptInstall() {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null;
  announce();
  event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

/**
 * Register the worker and watch for a new one.
 *
 * `onUpdate(apply)` is called when a new version is installed and waiting; `apply()` tells it
 * to take over and reloads. The app never swaps itself out underneath someone who is halfway
 * through entering a voucher - the person chooses when.
 */
export function registerServiceWorker({ onUpdate } = {}) {
  if (!isBrowser || !("serviceWorker" in navigator)) return;
  // The dev server has no built assets to cache, and a stale worker there is pure confusion.
  if (!import.meta.env.PROD) return;
  // Registering on an insecure origin only logs an error nobody can act on.
  if (!isSecure()) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      const offer = (worker) => {
        if (!worker) return;
        // A worker that installs with no controller is the first one: nothing to update to.
        if (!navigator.serviceWorker.controller) return;
        onUpdate?.(() => {
          worker.postMessage("skip-waiting");
        });
      };

      if (registration.waiting) offer(registration.waiting);

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") offer(worker);
        });
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });

      // Catch a version published while the app was left open.
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    } catch {
      // No worker: the app works exactly as it did before, just without the cache.
    }
  });
}
