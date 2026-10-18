import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pageSession } from "./pageSession";
import { prefsFor } from "./userPrefs";
import { addView, applyView, captureView, DEFAULT_VIEW, normaliseView, removeView, renameView } from "./savedViews";
import { keepExisting, nextSort, toggleColumn as toggleColumnKey } from "./listView";
import { useOrganisation } from "../components/shell/OrganisationContext";

// The state behind one list screen: search, filters and sort (kept per TAB, in pageSession - the same rule
// every other screen's filters already follow: gone on reload, never touching durable storage, because a
// filter or a search box can hold a person's ID number), density and hidden columns (kept per PERSON, in
// userPrefs - a display choice, not business data), saved views (named bundles of the above, also per
// person), and selection (plain React state - it is never meant to survive a reload, since the rows it
// names may no longer be the same rows).
//
//   const list = useListView("customers", { columns, filters: { status: "" }, sort: null });
//   list.search, list.setSearch(v)
//   list.filters, list.setFilter(key, v), list.clearFilters()
//   list.sort, list.toggleSort(key)                 // cycles asc -> desc -> off, via lib/listView.js
//   list.density, list.setDensity(d)
//   list.hidden, list.toggleColumn(key)
//   list.selection, list.setSelection(keys), list.selectMode, list.setSelectMode(on), list.clearSelection()
//   list.active                                      // true while search/filters/sort differ from defaults
//   list.key                                          // one string of everything that changes which ROWS
//                                                      // exist (search+filters+sort) - feed this to useAsync
//   list.views, list.currentViewId, list.viewChanged
//   list.applyView(id), list.saveView(name, opts), list.renameView(id, name), list.deleteView(id)
export function useListView(name, { columns = [], filters: defaultFilters = {}, sort: defaultSort = null } = {}) {
  const { me } = useOrganisation();
  const session = useMemo(() => pageSession(name), [name]);
  const prefs = useMemo(() => prefsFor(me?.id), [me?.id]);

  const [search, setSearchState] = useState(() => session.get("search", ""));
  const [filters, setFiltersState] = useState(() => session.get("filters", defaultFilters));
  const [sort, setSortState] = useState(() => session.get("sort", defaultSort));
  const [density, setDensityState] = useState(() => prefs.get(`display.${name}.density`, "comfortable"));
  const [hidden, setHiddenState] = useState(() => prefs.get(`display.${name}.hidden`, []));
  const [rawViews, setRawViews] = useState(() => prefs.get(`views.${name}`, []));
  const [selection, setSelectionState] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [currentViewId, setCurrentViewId] = useState(() => session.get("viewId", ""));

  // `me.id` is not known on the very first render (organisation status loads asynchronously) - the three
  // useState lazy initializers above may have already run against an empty/unscoped `prefs` by the time it
  // arrives. Once the real id shows up, re-hydrate from storage under that id, exactly once.
  const hydratedFor = useRef(me?.id);
  useEffect(() => {
    if (!me?.id || hydratedFor.current === me.id) return;
    hydratedFor.current = me.id;
    setDensityState(prefs.get(`display.${name}.density`, "comfortable"));
    setHiddenState(prefs.get(`display.${name}.hidden`, []));
    setRawViews(prefs.get(`views.${name}`, []));
  }, [me?.id, name, prefs]);

  const setSearch = useCallback((v) => { setSearchState(v); session.set("search", v); }, [session]);
  const setFilter = useCallback((k, v) => {
    setFiltersState((f) => {
      const next = { ...f, [k]: v };
      session.set("filters", next);
      return next;
    });
  }, [session]);
  const clearFilters = useCallback(() => {
    setSearchState("");
    setFiltersState(defaultFilters);
    session.set("search", "");
    session.set("filters", defaultFilters);
    setCurrentViewId("");
    session.set("viewId", "");
  }, [session, defaultFilters]);
  const setSort = useCallback((next) => { setSortState(next); session.set("sort", next); }, [session]);
  const toggleSort = useCallback((key) => setSort(nextSort(sort, key)), [sort, setSort]);

  const setDensity = useCallback((d) => { setDensityState(d); prefs.set(`display.${name}.density`, d); }, [prefs, name]);
  const toggleColumn = useCallback((key) => {
    setHiddenState((h) => {
      const next = toggleColumnKey(h, key, columns);
      prefs.set(`display.${name}.hidden`, next);
      return next;
    });
  }, [prefs, name, columns]);

  const setSelection = useCallback((keys) => setSelectionState(keys), []);
  const clearSelection = useCallback(() => setSelectionState([]), []);

  // the view list itself - `rawViews` is real state (set below whenever it changes) so a save/rename/delete
  // is reflected on the very next render, not whenever something else happens to re-render the hook
  const views = useMemo(() => rawViews.map((v) => normaliseView(v, columns)).filter(Boolean), [rawViews, columns]);
  // every callback below that writes a view MUST list `prefs` (and `name`) as a dependency, not just `views` -
  // `prefs` is itself derived from `me.id`, which is not known on the very first render (see the hydration
  // effect above); a callback that captured an earlier, unscoped `prefs` in its closure would go on writing
  // to the WRONG (or no) person's storage even after the real id arrives, because useCallback only recreates
  // the function when something in its own dependency list changes - found by this file's own test suite
  // (a saved view silently failed to survive a remount) and the reason this file lists every real dependency
  // instead of reaching for an eslint-disable comment.
  const writeViews = useCallback((next) => { prefs.set(`views.${name}`, next); setRawViews(next); }, [prefs, name]);

  const goToView = useCallback((id) => {
    const view = id ? views.find((v) => v.id === id) : null;
    const applied = applyView(view, { search: "", filters: defaultFilters, sort: defaultSort, hidden: [], density });
    setSearchState(applied.search);
    setFiltersState(applied.filters);
    setSortState(applied.sort);
    setHiddenState(applied.hidden);
    setDensityState(applied.density);
    setCurrentViewId(id || "");
    session.set("search", applied.search);
    session.set("filters", applied.filters);
    session.set("sort", applied.sort);
    session.set("viewId", id || "");
    prefs.set(`display.${name}.hidden`, applied.hidden);
    prefs.set(`display.${name}.density`, applied.density);
  }, [views, session, prefs, name, defaultFilters, defaultSort, density]);

  const saveView = useCallback((viewName, { withSearch = false } = {}) => {
    const captured = captureView({ search, filters, sort, hidden, density }, { withSearch });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = addView(views.map((v) => ({ ...v })), { id, name: viewName, createdAt: new Date().toISOString(), ...captured });
    if (!result.ok) return result;
    writeViews(result.views);
    setCurrentViewId(id);
    session.set("viewId", id);
    return { ok: true, id };
  }, [search, filters, sort, hidden, density, views, writeViews, session]);

  const renameViewById = useCallback((id, newName) => {
    const result = renameView(views, id, newName);
    if (result.ok) writeViews(result.views);
    return result;
  }, [views, writeViews]);

  const deleteView = useCallback((id) => {
    writeViews(removeView(views, id));
    if (currentViewId === id) { setCurrentViewId(""); session.set("viewId", ""); }
  }, [views, currentViewId, session, writeViews]);

  const active = Boolean(search) || Object.values(filters || {}).some(Boolean) || Boolean(sort);
  const key = JSON.stringify({ search, filters, sort });

  return {
    search, setSearch,
    filters, setFilter, clearFilters,
    sort, setSort, toggleSort,
    density, setDensity,
    hidden, toggleColumn,
    selection, setSelection, selectMode, setSelectMode, clearSelection,
    dropMissingSelection: (rowKeys) => setSelectionState((keys) => keepExisting(keys, rowKeys)),
    active, key,
    views, currentViewId,
    goToView, saveView, renameView: renameViewById, deleteView,
    DEFAULT_VIEW,
  };
}
