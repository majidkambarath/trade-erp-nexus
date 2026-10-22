import React, { useCallback, useContext, useMemo, useRef, useState } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";
import { ConfirmDialog } from "../accounting/kit";
import { KEEP_LABEL, LEAVE_LABEL, LEAVE_TITLE, UnsavedWorkContext, blocksNavigation, leaveText } from "../../lib/unsavedWork";

// Asks before a page with something unsaved is left behind. One guard around all the pages, which
// every dirty form announces itself to (lib/unsavedWork.js useUnsavedWork), so a form does not have
// to know what might take it away: a rail link, a module tab, the browser's Back button, a button
// that navigates after doing something else, or a pasted address.
//
// Back is the one that cannot be done by hand. The browser has already moved by the time a popstate
// listener hears about it, and a non-data router has already re-rendered the new page, so the form
// is gone before anything can ask. React Router's own blocker is given the move BEFORE it happens
// and puts the address back itself when it is refused - which is why App.jsx mounts a data router.
//
// The blocker is in a child of its own because `useBlocker` throws outside a data router, and this
// provider is rendered in tests under a plain MemoryRouter. The data router's context says whether
// it can be called at all; without one the rest of the guard still works (the dialog's own question
// and the reload warning do not depend on the router).

function NavigationBlocker({ dirty, labels }) {
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => blocksNavigation(dirty, currentLocation, nextLocation),
      [dirty]
    )
  );
  if (blocker.state !== "blocked") return null;
  return (
    <ConfirmDialog
      title={LEAVE_TITLE}
      text={leaveText(labels)}
      confirmLabel={LEAVE_LABEL}
      cancelLabel={KEEP_LABEL}
      danger
      onConfirm={() => blocker.proceed()}
      onClose={() => blocker.reset()}
    />
  );
}

export default function UnsavedWorkProvider({ children }) {
  // id -> a function that names what is unsaved. A plain object in a ref plus a counter: the forms
  // register from an effect, and re-rendering this provider (and every page under it) on each
  // keystroke of a form it does not own is a cost nothing here needs.
  const entries = useRef(new Map());
  const [, bump] = useState(0);
  const register = useCallback((id, nameOf) => {
    entries.current.set(id, nameOf);
    bump((n) => n + 1);
    return () => {
      entries.current.delete(id);
      bump((n) => n + 1);
    };
  }, []);
  const value = useMemo(() => ({ register }), [register]);
  const labels = [...entries.current.values()].map((nameOf) => nameOf());
  const dirty = entries.current.size > 0;
  // A data router answers; a plain <MemoryRouter> in a test does not, and then there is no in-app
  // navigation to block anyway.
  const dataRouter = useContext(UNSAFE_DataRouterContext);

  return (
    <UnsavedWorkContext.Provider value={value}>
      {children}
      {dataRouter && <NavigationBlocker dirty={dirty} labels={labels} />}
    </UnsavedWorkContext.Provider>
  );
}
