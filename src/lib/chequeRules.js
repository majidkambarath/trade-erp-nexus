// The cheque register's rules as the SCREEN needs them: which tab a status lives on, what a status is called, which
// buttons make sense. A deliberate TWIN of trade ERP node/utils/chequeRules.js (the way voucherTypeForms.js twins
// utils/voucherTypes.js): there is no cross-repo import, so both repos pin the same transition list in their tests.
// The SERVER is the authority - it refuses an illegal act with its own message, which the screen shows. This module
// only keeps the screen from offering what is certain to be refused.
//
// Pure: no React, no I/O.

export const STATUSES = ["pending", "deposited", "hold", "cleared", "bounced", "returned", "cancelled"];

// The order of the tabs: the live ones first (they are worklists), then how a cheque ended.
const TAB_ORDER = ["pending", "deposited", "hold", "cleared", "bounced", "returned", "cancelled"];

// The money is still in the air. These tabs are WORKLISTS: a cheque post-dated a year ahead is still to be presented,
// so they show every date, not a period.
export const LIVE = ["pending", "deposited", "hold"];

export const LABEL = { pending: "Pending", deposited: "Deposited", hold: "On hold", cleared: "Cleared", bounced: "Bounced", returned: "Handed back", cancelled: "Cancelled" };
export const TONE = { pending: "warning", deposited: "info", hold: "neutral", cleared: "success", bounced: "danger", returned: "neutral", cancelled: "neutral" };

// [status filter value, label]. "" is every status.
export const TABS = [...STATUSES.slice().sort((a, b) => TAB_ORDER.indexOf(a) - TAB_ORDER.indexOf(b)).map((s) => [s, LABEL[s]]), ["", "All"]];

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
  return: ["pending", "hold"],
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

// ---- a cheque the bank sent back ----
// The same list as the server's utils/chequeDishonour.js RETURN_REASONS (both pin the codes in their tests).
// These record WHY, nothing more: no legal consequence is implied, or computed, anywhere.
export const RETURN_REASONS = [
  { code: "insufficient_funds", label: "Insufficient funds" },
  { code: "account_closed", label: "Account closed" },
  { code: "signature_mismatch", label: "Signature differs" },
  { code: "stop_payment", label: "Payment stopped by the drawer" },
  { code: "amount_mismatch", label: "Amount in words and figures differ" },
  { code: "post_dated", label: "Presented before its date" },
  { code: "stale", label: "Stale or out of date" },
  { code: "technical", label: "Technical (damaged, not cleared in time, wrong bank)" },
  { code: "other", label: "Other" },
];

export const emptyBounce = () => ({
  reasonCode: "", reason: "", memoDate: "", memoRef: "", certificateRef: "", partialAmount: "",
  feeOn: false, feeAmount: "", feeTaxCodeId: "",
  backOn: false, backAmount: "", backAccountId: "", backNote: "",
});

// Choosing from the list words the reason for the person, unless they have already written their own.
export function chooseReason(form, code) {
  const label = RETURN_REASONS.find((r) => r.code === code)?.label || "";
  const wasListed = RETURN_REASONS.some((r) => r.label === form.reason);
  const reason = !form.reason.trim() || wasListed ? (code === "other" ? "" : label) : form.reason;
  return { ...form, reasonCode: code, reason };
}

const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const positive = (v) => { const n = num(v); return n !== null && Number.isFinite(n) && n > 0; };

// What is wrong with the form, field by field - the server checks it all again; this only saves a round trip.
// { amount } is the cheque's, `customer` whether it may be charged back, `today` a YYYY-MM-DD day.
export function bounceErrors(form, { amount = 0, customer = false, today = "" } = {}) {
  const e = {};
  if (!form.reason.trim()) e.reason = "Say why the cheque was returned";
  if (form.reason.length > 250) e.reason = "The reason can be at most 250 characters";
  if (form.memoDate && today && form.memoDate > today) e.memoDate = "The bank's memo cannot be dated in the future";
  if (num(form.partialAmount) !== null) {
    if (!positive(form.partialAmount)) e.partialAmount = "Enter the amount the bank paid, as a number above zero";
    else if (amount > 0 && Number(form.partialAmount) >= amount) e.partialAmount = "The part paid must be less than the cheque; if it was paid in full, it did not bounce";
  }
  if (form.feeOn && !positive(form.feeAmount)) e.feeAmount = "Enter the bank's charge";
  if (form.backOn) {
    if (!customer) e.backOn = "Only a customer's cheque can be charged back";
    if (!positive(form.backAmount)) e.backAmount = "Enter what to charge the customer";
    if (!form.backAccountId) e.backAccountId = "Choose the account the recovered charge is credited to";
  }
  return e;
}

// The request: only what the person filled in, so a plain bounce is still exactly { reason }.
export function bounceBody(form) {
  const body = { reason: form.reason.trim() };
  if (form.reasonCode) body.reasonCode = form.reasonCode;
  if (form.memoDate) body.memoDate = form.memoDate;
  if (form.memoRef.trim()) body.memoRef = form.memoRef.trim();
  if (form.certificateRef.trim()) body.certificateRef = form.certificateRef.trim();
  if (num(form.partialAmount) !== null) body.partialAmount = Number(form.partialAmount);
  if (form.feeOn) body.bankCharge = { amount: Number(form.feeAmount), ...(form.feeTaxCodeId ? { taxCodeId: form.feeTaxCodeId } : {}) };
  if (form.backOn) body.recharge = { amount: Number(form.backAmount), accountId: form.backAccountId, ...(form.backNote.trim() ? { description: form.backNote.trim() } : {}) };
  return body;
}

export const returnErrors = (form) => (form.reason.trim() ? {} : { reason: "Say why the cheque is being handed back" });

// What a bounced cheque cost, in words, for the register: "Bank charge EV-2026-0007 · charged back DN-2026-0003".
export function chargesNote(cheque) {
  const c = cheque?.charges;
  if (!c) return "";
  return [c.expenseVoucherNo && `Bank charge ${c.expenseVoucherNo}`, c.rechargeVoucherNo && `charged back ${c.rechargeVoucherNo}`].filter(Boolean).join(" · ");
}
