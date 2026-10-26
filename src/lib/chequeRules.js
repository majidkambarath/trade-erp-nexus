// The cheque register's rules as the SCREEN needs them: which tab a status lives on, what a status is called, which
// buttons make sense. A deliberate TWIN of trade ERP node/utils/chequeRules.js (the way voucherTypeForms.js twins
// utils/voucherTypes.js): there is no cross-repo import, so both repos pin the same transition list in their tests.
// The SERVER is the authority - it refuses an illegal act with its own message, which the screen shows. This module
// only keeps the screen from offering what is certain to be refused.
//
// Pure: no React, no I/O.

export const STATUSES = ["pending", "deposited", "hold", "cleared", "bounced", "cancelled"];

// The money is still in the air. These tabs are WORKLISTS: a cheque post-dated a year ahead is still to be presented,
// so they show every date, not a period.
export const LIVE = ["pending", "deposited", "hold"];

export const LABEL = { pending: "Pending", deposited: "Deposited", hold: "On hold", cleared: "Cleared", bounced: "Bounced", cancelled: "Cancelled" };
export const TONE = { pending: "warning", deposited: "info", hold: "neutral", cleared: "success", bounced: "danger", cancelled: "neutral" };

// [status filter value, label]. "" is every status.
export const TABS = [...["pending", "deposited", "hold", "cleared", "bounced", "cancelled"].map((s) => [s, LABEL[s]]), ["", "All"]];

export const isLive = (status) => LIVE.includes(status);
// A worklist tab carries no period; every other tab (and All) opens on the current month.
export const isWorklist = (status) => LIVE.includes(status);

// What the server allows, per action. Mirrors utils/chequeRules.js TABLE.
const FROM = {
  clear: ["pending", "deposited"],
  deposit: ["pending"],
  hold: ["pending"],
  resume: ["hold"],
  bounce: ["pending", "hold", "deposited", "cleared"],
  cancel: ["pending", "hold"],
};
export const ACTIONS = Object.keys(FROM);

// May this action be offered for a cheque in this state? `matured` is the server's flag (the date has come).
// Clear and deposit are shown but disabled before the date - the person sees the button and why it is waiting.
export function canDo(action, cheque) {
  if (!Object.hasOwn(FROM, action) || !cheque) return false;
  return FROM[action].includes(cheque.status);
}
export const needsMaturity = (action) => action === "clear" || action === "deposit";

export const BULK_ACTIONS = ["deposit", "clear", "hold", "resume"];
export const MAX_BULK = 200;

// Which of the ticked cheques a bulk action could apply to - the rest are left out of the count, not failed.
export const eligible = (action, rows) => rows.filter((c) => canDo(action, c));

// A bulk reply -> the sentence a person reads. Names the first failure, because "2 left alone" with no reason is useless.
export function bulkMessage(action, result) {
  const done = result?.successful?.length || 0;
  const failed = result?.failed || [];
  const verb = { deposit: "deposited", clear: "cleared", hold: "put on hold", resume: "taken off hold" }[action] || "done";
  if (!failed.length) return `${done} cheque${done === 1 ? "" : "s"} ${verb}.`;
  const why = failed[0].message ? ` First problem: ${failed[0].message}` : "";
  return `${done} ${verb}, ${failed.length} left alone.${why}`;
}
