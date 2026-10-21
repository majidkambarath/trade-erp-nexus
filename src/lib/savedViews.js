// A saved view is a named, restorable bundle of a list's filters, sort, column choices and density -
// pure logic over plain objects; lib/userPrefs.js is where a list of these actually lives, and
// components/lists/SavedViews.jsx is the picker built on top. See lib/listView.js for the sort/column
// helpers a view's `filters`/`sort`/`hidden`/`density` feed into.

import { DENSITIES } from "./listView";

export const DEFAULT_VIEW = { id: "", name: "All" }; // the screen's own defaults; always present, never removable

/**
 * What a view captures from a list's current state. The free-text search is remembered only when asked
 * (`withSearch`): it is the one field in the app someone might type an id or a phone number into, the same
 * reason lib/pageSession.js never keeps it durably. A period is stored as its PRESET, never the resolved
 * dates - a view saved as "This month" must still mean this month when it is opened again in December, not
 * a frozen range from whenever it was saved (`withPeriod` opts a screen with a period control in at all).
 */
export function captureView(state, { withSearch = false, withPeriod = false } = {}) {
  const view = {
    filters: { ...(state.filters || {}) },
    sort: state.sort ? { ...state.sort } : null,
    hidden: [...(state.hidden || [])],
    density: DENSITIES.includes(state.density) ? state.density : "comfortable",
  };
  if (withSearch && state.search) view.search = state.search;
  if (withPeriod && state.period) {
    view.period = state.period.preset === "custom" ? { preset: "custom", from: state.period.from, to: state.period.to } : { preset: state.period.preset };
  }
  return view;
}

/**
 * A captured view applied back onto a screen's state. `filters`/`sort`/`hidden`/`density` are taken from the
 * view AS IS, never merged with `defaults` - captureView and normaliseView both always produce a definite
 * value for these four (including `null` for "no sort" or `{}` for "no filters"), so falling back to
 * `defaults` with `??` would silently un-clear a sort or a filter the view had deliberately cleared. Only
 * `search` and `period` are genuinely optional on a view (omitted whenever `withSearch`/`withPeriod` were
 * not asked for at capture time), so those two alone fall back to the screen's own defaults.
 */
export function applyView(view, defaults = {}) {
  if (!view) return { ...defaults };
  return {
    search: "search" in view ? view.search : (defaults.search ?? ""),
    filters: view.filters || {},
    sort: view.sort ?? null,
    hidden: view.hidden || [],
    density: view.density || "comfortable",
    period: "period" in view ? view.period : defaults.period,
  };
}

/**
 * A view read back from storage must survive: an older release's shape, a column that no longer exists (it
 * is simply dropped from `hidden` rather than failing the whole view), an unknown period preset (falls back
 * to no period, the same defensive stance usePeriodFilter.js takes for its own restore), a density outside
 * the known set, or outright junk. Returns null for anything that isn't a usable object at all.
 */
export function normaliseView(raw, columns = []) {
  if (!raw || typeof raw !== "object" || typeof raw.name !== "string" || !raw.name.trim()) return null;
  const known = new Set(columns.map((c) => c.key));
  const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter((k) => known.has(k)) : [];
  const sort = raw.sort && typeof raw.sort === "object" && known.has(raw.sort.key) && (raw.sort.dir === "asc" || raw.sort.dir === "desc") ? { key: raw.sort.key, dir: raw.sort.dir } : null;
  const density = DENSITIES.includes(raw.density) ? raw.density : "comfortable";
  const view = {
    id: typeof raw.id === "string" ? raw.id : "",
    name: raw.name.trim(),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    filters: raw.filters && typeof raw.filters === "object" ? { ...raw.filters } : {},
    sort,
    hidden,
    density,
  };
  if (typeof raw.search === "string" && raw.search) view.search = raw.search;
  if (raw.period && typeof raw.period === "object" && typeof raw.period.preset === "string") {
    view.period = raw.period.preset === "custom" ? { preset: "custom", from: raw.period.from, to: raw.period.to } : { preset: raw.period.preset };
  }
  return view;
}

/** Whether the live state still matches a view - drives the "changed" indicator in the picker. */
export function viewMatches(view, state) {
  if (!view) return !state.search && !Object.values(state.filters || {}).some(Boolean) && !state.sort;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return (
    (view.search || "") === (state.search || "") &&
    same(view.filters || {}, state.filters || {}) &&
    same(view.sort || null, state.sort || null) &&
    same([...(view.hidden || [])].sort(), [...(state.hidden || [])].sort()) &&
    (view.density || "comfortable") === (state.density || "comfortable")
  );
}

export function renameView(views, id, name) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, code: "EMPTY_NAME" };
  if (views.some((v) => v.id !== id && v.name.toLowerCase() === trimmed.toLowerCase())) return { ok: false, code: "DUPLICATE_NAME" };
  return { ok: true, views: views.map((v) => (v.id === id ? { ...v, name: trimmed } : v)) };
}

export const removeView = (views, id) => views.filter((v) => v.id !== id);

export function addView(views, view) {
  if (views.some((v) => v.name.toLowerCase() === view.name.trim().toLowerCase())) return { ok: false, code: "DUPLICATE_NAME" };
  return { ok: true, views: [...views, view] };
}
