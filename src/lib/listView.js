// Pure helpers behind the list platform (DataTable's sort/selection/display props, useListView,
// ListPage). No React, no DOM - everything here is a plain function over plain data, so every rule is a
// unit test and the component layer stays thin. Mirrors the house style of lib/pagination.js and
// lib/permissions.js.

// ---------------------------------------------------------------------- sort

// A header press cycles asc -> desc -> off (the list's own order), so "off" is always reachable; pressing
// a DIFFERENT column starts that column fresh at asc.
export function nextSort(current, key) {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const isDateish = (v) => typeof v === "string" && DATE_RE.test(v);

// Orders two cell values: null/undefined always sort last (whichever direction - "unknown" is not "least"),
// numbers compare numerically, ISO-ish date strings compare by instant, everything else compares as text
// with natural number collation ("Item 2" before "Item 10").
export function compareValues(a, b) {
  const aNil = a === null || a === undefined || a === "";
  const bNil = b === null || b === undefined || b === "";
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() - new Date(b).getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (isDateish(a) && isDateish(b)) return Date.parse(a) - Date.parse(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

// `sort` is `{key, dir}` or null (the list's own order: rows are returned unchanged). `columns` supplies
// `sortValue(row)` per column when the cell isn't the raw field to compare (a formatted amount, a status
// label standing in for a rank). Stable: equal rows keep their original relative order.
export function sortRows(rows, sort, columns = []) {
  if (!sort) return rows;
  const col = columns.find((c) => c.key === sort.key);
  const valueOf = col?.sortValue || ((r) => r[sort.key]);
  const dir = sort.dir === "desc" ? -1 : 1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => dir * compareValues(valueOf(a.row), valueOf(b.row)) || a.i - b.i)
    .map((x) => x.row);
}

export const ariaSort = (sort, key) => (sort?.key !== key ? "none" : sort.dir === "asc" ? "ascending" : "descending");

// The phone toolbar's sort <select>, built from whichever columns opted in.
export function sortOptions(columns = []) {
  const out = [];
  for (const c of columns) {
    if (!c.sortable) continue;
    const label = typeof c.label === "string" ? c.label : typeof c.header === "string" ? c.header : c.key;
    out.push({ value: `${c.key}:asc`, label: `${label} (A–Z / low–high)` }, { value: `${c.key}:desc`, label: `${label} (Z–A / high–low)` });
  }
  return out;
}
export const sortOptionValue = (sort) => (sort ? `${sort.key}:${sort.dir}` : "");
export function sortFromOption(value) {
  if (!value) return null;
  const i = value.lastIndexOf(":");
  return { key: value.slice(0, i), dir: value.slice(i + 1) };
}

// ---------------------------------------------------------------------- selection

const toKeySet = (keys) => new Set(keys);

export function toggleKey(keys, key) {
  const set = toKeySet(keys);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return [...set];
}

// Every key on the page already selected -> remove exactly those; otherwise add whichever page keys are
// missing (a "select all" that only ever grows the set when some of the page is already ticked, matching
// what a person expects a header checkbox to do).
export function toggleAll(keys, pageKeys) {
  const set = toKeySet(keys);
  const allPresent = pageKeys.length > 0 && pageKeys.every((k) => set.has(k));
  if (allPresent) {
    for (const k of pageKeys) set.delete(k);
  } else {
    for (const k of pageKeys) set.add(k);
  }
  return [...set];
}

export const allOnPage = (keys, pageKeys) => pageKeys.length > 0 && pageKeys.every((k) => keys.includes(k));
export const someOnPage = (keys, pageKeys) => pageKeys.some((k) => keys.includes(k));

// Drops selected keys that no longer appear in the list (after a reload, a filter change, a delete), so a
// selection never silently keeps acting on rows that have scrolled out of view or been removed. Returns
// the SAME array when nothing was dropped - a caller that feeds this straight into setState (useListView's
// dropMissingSelection, called from an effect keyed on the rows it was just given) must not see a "changed"
// reference every time it runs with nothing to drop, or the state update it causes re-triggers the very
// effect that called it, forever (found the hard way: a tight render loop that pegged a CPU core for hours
// before anyone looked at why a test "just hadn't finished").
export function keepExisting(keys, rowKeys) {
  const present = toKeySet(rowKeys);
  const next = keys.filter((k) => present.has(k));
  return next.length === keys.length ? keys : next;
}

// ---------------------------------------------------------------------- columns & density

export const DENSITIES = ["comfortable", "compact"];
// These card slots are the row's identity and its actions; hiding them would leave a row unreadable or
// unusable, so they are never offered in the column chooser even if a caller marks them `hideable`.
export const FIXED_SLOTS = new Set(["primary", "title", "actions"]);

export const hideableColumns = (columns = []) => columns.filter((c) => c.hideable && !FIXED_SLOTS.has(c.card));

export const visibleColumns = (columns = [], hidden = []) => {
  if (!hidden?.length) return columns;
  const h = toKeySet(hidden);
  return columns.filter((c) => !h.has(c.key) || FIXED_SLOTS.has(c.card) || !c.hideable);
};

// Refuses to hide the last visible hideable column - a chooser that could empty the table is a trap, not a
// feature.
export function toggleColumn(hidden, key, columns) {
  const already = hidden.includes(key);
  if (already) return hidden.filter((k) => k !== key);
  const stillVisible = hideableColumns(columns).filter((c) => !hidden.includes(c.key) && c.key !== key);
  if (!stillVisible.length) return hidden;
  return [...hidden, key];
}
