// Finding the control a guide step points at, on the REAL screen. Pure DOM reading: nothing here clicks,
// types or changes anything.
//
// A target is one of
//   { guide: "customer-save" }   an element carrying data-guide="customer-save" (the stable way)
//   { button: /^add customer$/i }  a button, link, tab or menu item by its visible words
//   { field: /^customer name/i }   the input of the Field whose label reads so (label[for] -> control)
//   { text: /^new customer$/i }    the smallest visible element whose text reads so (for headings, dialogs)
//   { selector: "css" }            last resort
// A matcher is a RegExp or a string (compared whole, ignoring case, spacing and the "*" of a required label).

export const norm = (s) => String(s ?? "").replace(/\s+/g, " ").replace(/\*/g, "").trim().toLowerCase();

export function matches(text, matcher) {
  if (matcher == null) return false;
  if (matcher instanceof RegExp) return matcher.test(String(text ?? "").replace(/\s+/g, " ").replace(/\*/g, "").trim());
  return norm(text) === norm(matcher);
}

// Something a person can actually see: it has a box, it is not display:none / hidden, and no ancestor says aria-hidden.
export function visible(el) {
  if (!el || !el.isConnected) return false;
  if (el.closest?.("[aria-hidden='true'], [hidden], [data-guide-overlay]")) return false; // never the guide's own card
  const rects = el.getClientRects?.();
  if (rects && rects.length === 0 && typeof window !== "undefined" && window.navigator.userAgent.indexOf("jsdom") === -1) return false;
  const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

const esc = (s) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
const nameOf = (el) => el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "";
const CLICKABLE = "button, a[href], [role='button'], [role='tab'], [role='menuitem'], [role='option']";

export function locate(rootIn, target) {
  if (!rootIn || !target) return null;
  // `within` narrows the search to the open dialog (or any container): the list behind it has fields of the same name
  let root = rootIn;
  if (target.within) {
    const scopes = [...rootIn.querySelectorAll(target.within)].filter(visible);
    root = scopes[scopes.length - 1] || null; // the last one is the one on top
    if (!root) return null;
  }
  const first = (list) => list.find(visible) || null;

  if (target.guide) return first([...root.querySelectorAll(`[data-guide="${esc(target.guide)}"]`)]);
  if (target.selector) return first([...root.querySelectorAll(target.selector)]);

  if (target.button) {
    return first([...root.querySelectorAll(CLICKABLE)].filter((el) => matches(nameOf(el), target.button)));
  }

  if (target.field) {
    const labels = [...root.querySelectorAll("label")].filter((l) => matches(l.textContent, target.field));
    for (const label of labels) {
      const byId = label.htmlFor ? root.querySelector(`#${esc(label.htmlFor)}`) : null;
      // a label tied by `for`, one that wraps its control, or (older forms) one that simply sits above it in the same block
      const control = byId || label.querySelector("input, select, textarea, button")
        || label.parentElement?.querySelector("input:not([type='hidden']), select, textarea");
      if (control && visible(control)) return control;
    }
    return null;
  }

  if (target.text) {
    // the smallest element whose OWN visible text matches: a heading, not the page that contains it
    const all = [...root.querySelectorAll("h1, h2, h3, h4, label, legend, p, span, div, li, td, th")];
    const hits = all.filter((el) => matches(el.textContent, target.text) && visible(el));
    hits.sort((a, b) => a.textContent.length - b.textContent.length);
    return hits[0] || null;
  }
  return null;
}

// Where the spotlight goes: the control's box, padded, kept inside the window.
export function spotRect(el, pad = 6) {
  const r = el.getBoundingClientRect();
  return { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

// Where the caption card goes: below the control when there is room, else above, else at the bottom edge;
// kept inside the window sideways. `view` is {width, height}. Pure, so it is tested without a browser.
export function placeCard(spot, card, view, gap = 12) {
  const clampX = (x) => Math.max(8, Math.min(x, view.width - card.width - 8));
  const left = clampX(spot.left + spot.width / 2 - card.width / 2);
  const below = spot.top + spot.height + gap;
  if (below + card.height <= view.height - 8) return { top: below, left, side: "below" };
  const above = spot.top - gap - card.height;
  if (above >= 8) return { top: above, left, side: "above" };
  return { top: Math.max(8, view.height - card.height - 8), left, side: "edge" };
}
