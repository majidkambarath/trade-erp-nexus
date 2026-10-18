import { useEffect } from "react";

// Warns before the browser tab closes, reloads or navigates to another site while `dirty` is true - the
// native confirmation a half-typed form deserves when the real risk (a reload, a closed tab) is not
// something any in-app dialog can catch. Pass it the same "has this changed from what is saved" flag a
// form already keeps for its own save button; it does nothing while that is false.
//
// This does not catch in-app navigation (clicking a rail link while a dialog is open stays an open
// question - see useRecordRoute.js and the stage 1a notes): browsers give no standard hook for that short
// of owning the router's navigation, which is a larger change than one dialog's safety net.
export function useBeforeUnloadGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = ""; // Chrome needs a truthy returnValue; the browser's own wording is shown, never ours
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
