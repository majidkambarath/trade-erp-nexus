// Moving from one field to the next with the keyboard, for a person with no mouse.
//
// This is the walk only - no React, no events - so it is tested without rendering, the way
// lib/shortcuts.js is. The selector is the one kit.jsx's Modal uses for its focus trap, so
// "what can be focused" means the same thing in both places.

export const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// A field nobody can reach: switched off, taken out of the tab order, or inside something hidden.
// A field hidden by CSS alone is not detected - jsdom lays nothing out, so it could not be tested,
// and the forms this serves hide a field by not rendering it.
const reachable = (el) =>
  !el.disabled &&
  el.getAttribute("aria-disabled") !== "true" &&
  el.getAttribute("tabindex") !== "-1" &&
  !el.closest('[hidden],[aria-hidden="true"],[inert]');

export const fieldsIn = (scope) => (scope ? [...scope.querySelectorAll(FOCUSABLE)].filter(reachable) : []);

// The next field after `current` inside `scope`, or null when `current` is the last one - the caller
// then decides where to go (the order form hands over to the line grid).
export const nextField = (scope, current) => {
  const list = fieldsIn(scope);
  const at = list.indexOf(current);
  return at === -1 ? null : list[at + 1] || null;
};
