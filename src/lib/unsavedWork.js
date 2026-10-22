import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useBeforeUnloadGuard } from "./useBeforeUnloadGuard";

// What happens when somebody is about to lose something they typed. Three ways out of a half-filled
// form, and each needs its own answer:
//
//   closing the dialog   (Escape, the X) -> our own question, asked inside the dialog: see Modal in kit.jsx
//   leaving the page     (a rail link, Back, a button that navigates) -> our own question: see shell/UnsavedWorkProvider
//   closing the tab      (reload, Ctrl+W, the address bar) -> the browser's question, wording and all: useBeforeUnloadGuard
//
// Only the third is the browser's to word. The first two are ours, so they say what will be lost and
// name the form, and "Keep editing" is the safe default on every one of them.
//
// This file is the pure half: the wording, the rule for when a move is stopped, and the registry
// context the forms announce themselves on. It renders nothing, so kit.jsx can read it without
// reaching into the shell.

export const DISCARD_TITLE = "Discard your changes?";
export const DISCARD_TEXT = "What you have typed in this form has not been saved yet.";
export const DISCARD_LABEL = "Discard and close";
export const LEAVE_TITLE = "Leave without saving?";
export const LEAVE_LABEL = "Leave and lose it";
export const KEEP_LABEL = "Keep editing";

/**
 * The sentence under "Leave without saving?". It names what is unsaved where the form said what it
 * was ("the customer you were adding"), because a person who has three things open needs to know
 * which one they are about to lose.
 */
export function leaveText(labels = []) {
  const named = labels.filter(Boolean);
  if (named.length === 1) return `Your changes to ${named[0]} have not been saved. Leaving this page loses them.`;
  if (named.length > 1) return `Changes in ${named.length} open forms have not been saved. Leaving this page loses them.`;
  return "You have changes that have not been saved. Leaving this page loses them.";
}

/**
 * Is this move away worth stopping? Only a change of PAGE is. A changed query string on the same
 * page is how this app opens a document, a tab or a deep link (`?open=`, `?tab=`, `?search=`) and is
 * very often the form's own doing, so stopping it would block the very save the person asked for.
 */
export function blocksNavigation(dirty, current, next) {
  if (!dirty) return false;
  if (!current?.pathname || !next?.pathname) return true; // nothing to compare: play safe and ask
  return current.pathname !== next.pathname;
}

// ---------- the registry ----------

// Every form with something unsaved announces itself here while it is dirty, so the one guard around
// the pages can answer for all of them. The default is a working no-op: a dialog rendered on its own
// in a test, or outside the shell, still warns on a reload (the hook below does that itself) and
// simply has nobody to tell about in-app navigation.
const NOTHING = { register: () => () => {}, labels: [] };
export const UnsavedWorkContext = createContext(NOTHING);

/**
 * "This form has something unsaved." Call it with the flag a form already keeps for its own save
 * button, and the name of what is being edited for the question to use.
 *
 * It does two things while that flag is true: warns before the tab is reloaded or closed, and tells
 * the guard around the pages, which asks before any in-app navigation takes the form away.
 */
export function useUnsavedWork(dirty, label = "") {
  const { register } = useContext(UnsavedWorkContext);
  const id = useId();
  // the label is read at the moment the question is asked, so a form may rename itself without
  // re-registering (and without making the effect below run on every keystroke)
  const name = useRef(label);
  name.current = label;
  useBeforeUnloadGuard(dirty);
  useEffect(() => {
    if (!dirty) return undefined;
    return register(id, () => name.current);
  }, [dirty, id, register]);
}

/**
 * "Has the person put anything into this?" for a form that keeps no baseline of its own - which is
 * most of them: a form holding its state in a dozen useStates, or one whose fields are filled in
 * asynchronously after it opens (a document number allocated by the server, a party prefilled from
 * the address), has no honest moment at which to take a snapshot, and a snapshot taken too early
 * reads as unsaved work on a form nobody has touched. Watching for the first keystroke instead is
 * never wrong in that direction.
 *
 * Returns [typed, watch, forget]. Spread `watch` on the element the fields sit inside; input and
 * change events from them bubble to it. React raises neither when it sets a controlled value
 * itself, so what arrives came from the person at the keyboard. `forget()` starts it clean again,
 * for a form still on the screen after its work has been saved or thrown away - without it, one
 * saved document would leave the page warning about unsaved work for as long as it stayed open.
 *
 * What it cannot see: choosing from a SearchSelect without typing, and a Radix switch or checkbox
 * (both are buttons, so neither raises an input or change event). A form where that is the whole of
 * the editing should work out its own answer.
 */
export function useTypedIn(enabled = true) {
  const [typed, setTyped] = useState(false);
  const forget = useCallback(() => setTyped(false), []);
  const notice = (e) => {
    if (!enabled || typed) return;
    const el = e.target;
    if (!el?.matches?.("input, textarea, select")) return;
    // a box that finds something rather than changing it: searching a list and pressing Escape has
    // never lost anybody anything
    if (el.type === "search" || el.closest("[data-transient]")) return;
    setTyped(true);
  };
  return [enabled && typed, { onInput: notice, onChange: notice }, forget];
}
