// What version of the app is running, and whether the API behind it agrees.
//
// The app and the API are deployed SEPARATELY (two Render services), so a release is only really live when
// BOTH have shipped. That makes "which version am I looking at" two questions, and the answer worth showing
// in Settings: somebody checking whether a fix is live, or reporting a problem, can read both figures off
// one screen instead of guessing.
//
// The version is imported from package.json rather than injected through a build-time global, so the same
// value is read by the bundler, by a test and by a developer reading the file - and a named import means
// only the version string survives into the bundle, not the whole manifest.
import { version } from "../../package.json";

export const APP_VERSION = String(version || "unknown");

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
