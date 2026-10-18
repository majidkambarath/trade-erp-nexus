// A small per-person key/value store for display preferences and saved views, kept in `localStorage` -
// the same place `utils/format.js` already keeps the date/time format preference. One person's account is
// unique across the whole installation (`Admin.email`/`id` is global, not per-organisation - CLAUDE.md
// "Organisations, branches and the tenant scope"), so scoping by the person's own id is already safe: there
// is no other organisation's data that `me.id` could collide with.
//
// There is no backend preferences endpoint yet. `read`/`write` below are the ONLY two functions that touch
// storage - when that endpoint exists, swapping them for a GET/PUT call (hydrated once at sign-in) is the
// whole migration; everything above them is unaffected. The wanted shape for that endpoint:
//
//   GET  /profile/preferences  -> { display: {...}, views: { "<scope>": [ {id, name, createdAt, state} ] } }
//   PUT  /profile/preferences     same body, last-write-wins, server-validated, roughly a 32 KB cap
//
// Two buckets, because they carry different kinds of risk:
//   display  density, hidden columns, page size - no business data, never cleared
//   views    named saved views - may hold a chosen customer or status, but the free-text SEARCH box is the
//            one field in the whole app where someone might type an id or a phone number (the same reason
//            lib/pageSession.js never persists durably), so a view only remembers the typed search when the
//            person explicitly asks it to (see lib/savedViews.js captureView's `withSearch`).

const KEY = (userId) => `zarvia.prefs.${userId}`;

function read(userId) {
  if (!userId) return { display: {}, views: {} };
  try {
    const raw = window.localStorage.getItem(KEY(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { display: {}, views: {} };
    return { display: parsed.display && typeof parsed.display === "object" ? parsed.display : {}, views: parsed.views && typeof parsed.views === "object" ? parsed.views : {} };
  } catch {
    return { display: {}, views: {} }; // private mode, blocked storage, or corrupt JSON - degrade to in-memory
  }
}

function write(userId, data) {
  if (!userId) return;
  try {
    window.localStorage.setItem(KEY(userId), JSON.stringify(data));
  } catch {
    // storage full or blocked: the preference simply doesn't persist this time, nothing to surface to the
    // person over a density toggle
  }
}

/** A small store scoped to one person: `get(path, fallback)` / `set(path, value)` under "display" or "views". */
export function prefsFor(userId) {
  const dotted = (obj, path) => path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
  return {
    get(path, fallback) {
      const data = read(userId);
      const value = dotted(data, path);
      return value === undefined ? fallback : value;
    },
    set(path, value) {
      const data = read(userId);
      const [bucket, ...rest] = path.split(".");
      const key = rest.join(".");
      const next = { ...data, [bucket]: { ...(data[bucket] || {}) } };
      if (rest.length) next[bucket][key] = value;
      else next[bucket] = value;
      write(userId, next);
    },
  };
}

export function clearPrefsFor(userId) {
  if (!userId) return;
  try {
    window.localStorage.removeItem(KEY(userId));
  } catch {
    // nothing to do - there was nothing readable to begin with
  }
}
