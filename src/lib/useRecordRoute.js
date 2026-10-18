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
//   const route = useRecordRoute({ titleFor: (id, mode) => id ? `${id} · Quotations` : "New quotation · Quotations" });
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

  const open = useCallback((id, mode = defaultMode) => navigate(id, mode), [navigate, defaultMode]);
  const replace = useCallback((id, mode = defaultMode) => navigate(id, mode, { replace: true }), [navigate, defaultMode]);
  const close = useCallback(() => navigate(null, null), [navigate]);

  const priorTitle = useRef(null);
  useEffect(() => {
    if (title == null) return undefined;
    if (priorTitle.current == null) priorTitle.current = document.title;
    document.title = title;
    return () => {
      if (priorTitle.current != null) document.title = priorTitle.current;
      priorTitle.current = null;
    };
  }, [title]);

  return { recordId, recordMode, open, replace, close };
}
