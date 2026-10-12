// Keyboard shortcuts for the whole app, with no React in them so the rules are tested without rendering.
//
//   Ctrl+Enter        on a list: open the page's "New ..." form.   In a form or dialog: save / confirm it.
//   Ctrl+S            save the open form or dialog (the browser's own "save page" is never wanted here)
//   Ctrl+Shift+S      save, and when it is done open a new one ("save and new")
//   ?                 the list of shortcuts (not while typing)
//
// The target is found by what is on the screen, not by a registry every page must join: a button marked data-shortcut wins; else a
// primary action by its words. That is deliberate: a new screen gets the shortcuts by having a "New ..." button and a "Save" button,
// which is what a person would look for anyway. Ctrl+K (search) and Alt+N (add a line) are handled where they already were.

const NEW_RE = /^\s*\+?\s*(new|add|create)\b/i;
const SAVE_RE = /^\s*(save|update|create|post|confirm|submit|approve|apply|record)\b/i;
const PAGE_SAVE_RE = /^\s*(save|update)\b/i;

const label = (el) => (el.getAttribute("aria-label") || el.textContent || "").trim();
const usable = (el) => !el.disabled && el.getAttribute("aria-disabled") !== "true" && !el.closest('[hidden], [aria-hidden="true"], [inert]');

/** What a key press means, or null. `typing` is whether the focus is in a text field. */
export function classify(e, { typing = false } = {}) {
  const mod = e.ctrlKey || e.metaKey;
  const key = String(e.key || "");
  if (mod && key === "Enter" && !e.altKey) return "enter";
  if (mod && key.toLowerCase() === "s" && !e.altKey) return e.shiftKey ? "saveNew" : "save";
  if (!mod && !e.altKey && key === "?" && !typing) return "help";
  return null;
}

export const isTyping = (el) => {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
};

/** The dialog on top, or null. */
export function topDialog(doc = document) {
  const all = [...doc.querySelectorAll('[role="dialog"]')].filter((d) => !d.closest('[hidden], [aria-hidden="true"]'));
  return all.length ? all[all.length - 1] : null;
}

/** The button that saves what is open: in a dialog its confirm button, on a page its form's Save. */
export function findSaveTarget(doc = document) {
  const dialog = topDialog(doc);
  const scope = dialog || doc.querySelector("main") || doc;
  const buttons = [...scope.querySelectorAll("button")].filter(usable);
  const marked = buttons.find((b) => b.getAttribute("data-shortcut") === "save");
  if (marked) return marked;
  // a <button> with no type is a submit button only when it sits in a form (the browser's default type says "submit" everywhere)
  const isSubmit = (b) => b.getAttribute("type") === "submit" || (Boolean(b.form) && !["button", "reset"].includes(b.getAttribute("type")));
  const submit = buttons.filter((b) => isSubmit(b) && !/cancel|back/i.test(label(b)));
  if (submit.length) return submit[submit.length - 1];
  if (dialog) {
    const words = buttons.filter((b) => SAVE_RE.test(label(b)));
    return words.length ? words[words.length - 1] : null; // a dialog's confirm button is last, after Cancel
  }
  // on a page: only a form's own Save, never "Create invoice" on a list that happens to be on screen
  if (scope.querySelector("form")) return buttons.find((b) => PAGE_SAVE_RE.test(label(b))) || null;
  return null;
}

/** The "New ..." button of a list page, or null when a form or dialog is open (that is the save case). */
export function findNewTarget(doc = document) {
  if (topDialog(doc)) return null;
  const main = doc.querySelector("main") || doc;
  if (main.querySelector("form")) return null;
  const items = [...main.querySelectorAll("button, a")].filter(usable);
  const marked = items.find((b) => b.getAttribute("data-shortcut") === "new");
  if (marked) return marked;
  return items.find((b) => NEW_RE.test(label(b)) && !/line|row|item\b/i.test(label(b))) || null;
}

/** What Ctrl+Enter does right now: save when something is open to save, else open a new one. */
export function enterTarget(doc = document) {
  const save = topDialog(doc) || doc.querySelector("main form") ? findSaveTarget(doc) : null;
  return save ? { kind: "save", el: save } : (() => { const el = findNewTarget(doc); return el ? { kind: "new", el } : null; })();
}

export const SHORTCUT_HELP = [
  ["Ctrl + K", "Search pages"],
  ["Ctrl + Enter", "On a list: open a new one. In a form or dialog: save it"],
  ["Ctrl + S", "Save the form or dialog that is open"],
  ["Ctrl + Shift + S", "Save, then open a new one"],
  ["Alt + N", "Add a line (order forms)"],
  ["Tab / Shift + Tab", "Move to the next / previous field"],
  ["Esc", "Close the open dialog"],
  ["?", "Show this list"],
];
