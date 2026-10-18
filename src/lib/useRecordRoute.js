import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

// A document screen's "what is open" kept in the URL instead of component state (`?open=<id>&mode=edit`),
// so opening a row pushes a history entry: the browser Back button returns to the list instead of leaving
// the module, a reload reopens the same record, a link to it can be copied, and the tab can name it.
//
// This is deliberately just the id and a mode string, with no fixed vocabulary for `mode` - a screen
// that only ever shows "view" and "edit" uses those; one that also has a full-page "create" flow (no id
// yet) opens with `open(null, "create")`, which sets only the mode param. `recordId` is null whenever the
// `open` param is absent (the list is showing), whatever `mode` says.
//
//   const route = useRecordRoute();
//   route.recordId, route.recordMode        // null, null on the plain list
//   route.open(id)                          // -> ?open=<id>&mode=view (pushes history)
//   route.open(id, "edit")                  // -> ?open=<id>&mode=edit
//   route.open(null, "create")              // -> ?mode=create (no id yet)
//   route.replace(id, "view")               // same, but does not push (after a save: Back from the saved
//                                            // record should return to the list, not to the transient draft)
//   route.close()                           // -> strips both params (pushes, so Back from the list goes
//                                            // to wherever the person was before they opened anything)
//
// `title` is optional and is a plain string the caller recomputes itself (not a function keyed on id/mode:
// the record's own number is usually not known until it has loaded, so the caller derives the string from
// whatever state it already has - `q ? \`${q.quotationNo} · Quotations\` : "Quotation · Quotations"`).
// While it is non-null it sets document.title, restoring whatever Layout.jsx had set for the route once it
// goes back to null - this only overrides the title while a record is shown, not the rest of the time.
export function useRecordRoute({ param = "open", modeParam = "mode", defaultMode = "view", title } = {}) {
  const [params, setParams] = useSearchParams();
  const recordId = params.get(param) || null;
  const rawMode = params.get(modeParam) || null;
  const recordMode = recordId ? rawMode || defaultMode : rawMode;

  const navigate = useCallback(
    (nextId, nextMode, options) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextId) next.set(param, nextId);
        else next.delete(param);
        if (nextMode) next.set(modeParam, nextMode);
        else next.delete(modeParam);
        return next;
      }, options);
    },
    [setParams, param, modeParam]
  );

  // `mode` left out defaults to "view" for a real id; `open(null)` with no mode is `close()` (there is no
  // sense in which a null record is "open"), so the only way to land on `?mode=create` with no id is to
  // name that mode explicitly - `open(null, "create")`.
  const open = useCallback(
    (id, mode) => (!id && mode === undefined ? navigate(null, null) : navigate(id, mode === undefined ? defaultMode : mode)),
    [navigate, defaultMode]
  );
  const replace = useCallback(
    (id, mode) => navigate(id, !id && mode === undefined ? null : mode === undefined ? defaultMode : mode, { replace: true }),
    [navigate, defaultMode]
  );
  const close = useCallback(() => navigate(null, null), [navigate]);

  useDocumentTitle(title ?? null);

  return { recordId, recordMode, open, replace, close };
}

// Sets document.title to `title` while it is non-null, restoring whatever it was before once `title` goes
// back to null or the component unmounts. Meant for a document VIEW, which usually only knows its own
// number once its data has loaded - call this with `q ? \`${q.quotationNo} · Quotations\` : null` and the
// tab updates itself the moment the record arrives, with no coordination needed from the parent list page
// (which already has its own route via useRecordRoute, for the URL and history alone).
export function useDocumentTitle(title) {
  const prior = useRef(null);
  useEffect(() => {
    if (title == null) return undefined;
    if (prior.current == null) prior.current = document.title;
    document.title = title;
    return () => {
      if (prior.current != null) document.title = prior.current;
      prior.current = null;
    };
  }, [title]);
}
