// What version of the app is running, and whether the API behind it agrees.
//
// The app and the API are deployed SEPARATELY (two Render services), so a release is only really live when
// BOTH have shipped. That makes "which version am I looking at" two questions, and the answer worth showing
// in Settings: somebody checking whether a fix is live, or reporting a problem, can read both figures off
// one screen instead of guessing.
//
// The version comes from config/product.js, which is where this product already keeps it: the sign-in page
// prints it and the service worker names its cache after it. There is deliberately NO second source - a
// figure with two origins is a figure that will disagree with itself, and src/config/__tests__/product.test.js
// already pins PRODUCT_VERSION to package.json's own (it sat at 1.6.0.1 through three releases before that
// test existed, because nothing compared the two).
import { PRODUCT_VERSION } from "../config/product";

export const APP_VERSION = String(PRODUCT_VERSION || "unknown");

/**
 * How the two versions stand. `api` is what /organisation/status reported; undefined while the status is
 * still loading, or on a server too old to report one.
 *
 * -> { app, api, state: "matched" | "waiting" | "unknown" | "mismatched", note }
 */
export function buildState(api) {
  const app = APP_VERSION;
  if (api === undefined || api === null) return { app, api: null, state: "waiting", note: "Checking the server…" };
  const server = String(api);
  if (server === "unknown") return { app, api: server, state: "unknown", note: "This server does not report its version." };
  if (server === app) return { app, api: server, state: "matched", note: "The app and the server are the same version." };
  // Deliberately not called an error: during a deploy the two differ for a minute or two, quite normally.
  return { app, api: server, state: "mismatched", note: "The app and the server are different versions — if this lasts, one of the two has not finished deploying." };
}

/** One line to copy into a support message: both versions and the day. */
export const supportLine = (api, now = new Date()) =>
  `App ${APP_VERSION} · API ${api || "unknown"} · ${now.toISOString().slice(0, 10)}`;
