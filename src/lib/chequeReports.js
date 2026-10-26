// What the cheque reports show, as words and rows. Pure: no React, no I/O. The figures come from the server
// (services/banking/chequeReportService.js); this only words and shapes them, so the screen and the CSV cannot disagree.

export const GROUPINGS = [["bucket", "How soon"], ["party", "Party"], ["bank", "Bank account"], ["month", "Month"]];
export const DIRECTIONS = [["", "Both"], ["receipt", "Cheques we hold"], ["payment", "Cheques we issued"]];
export const PERIOD_CHOICES = [["week", 4], ["week", 8], ["week", 12], ["week", 26], ["month", 3], ["month", 6], ["month", 12]];

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// How far away a cheque is, in words: "today", "in 3 days", "5 days overdue".
export function dueText(days) {
  if (days === 0) return "today";
  return days > 0 ? `in ${plural(days, "day")}` : `${plural(-days, "day")} overdue`;
}

export const periodLabel = ([unit, count]) => `${count} ${unit === "week" ? "weeks" : "months"}`;

export const STATUS_WORDS = { pending: "Pending", hold: "On hold", deposited: "At the bank" };

// The maturity report's cheques as a CSV: one row per cheque, nearest first.
export function maturityCsv(report) {
  const headers = ["Cheque", "Direction", "Party", "Due date", "Days", "Status", "Amount", "Voucher", "Bank account"];
  const rows = (report?.rows || []).map((r) => [
    r.chequeNo, r.direction === "receipt" ? "We hold" : "We issued", r.partyName, r.chequeDay, r.days, STATUS_WORDS[r.status] || r.status, r.amount, r.voucherNo, r.bankName,
  ]);
  return { headers, rows };
}

// The forward view as flat rows: the days already due first, then each period, then anything beyond the window.
export function forecastRows(f) {
  if (!f) return [];
  const line = (key, label, s, extra = {}) => ({ key, label, receipts: s.receipts.amount, payments: s.payments.amount, onHold: s.onHold.amount, net: s.net, ...extra });
  const out = [line("due", "Already due", f.due, { closing: f.afterDue, kind: "due" })];
  for (const p of f.periods) out.push(line(p.key, p.label, p, { closing: p.closing, from: p.from, to: p.to, kind: "period" }));
  out.push(line("later", "Beyond this window", f.later, { closing: f.totals.closing, kind: "later" }));
  return out;
}

export function forecastCsv(f) {
  const headers = ["Period", "Money in", "Money out", "On hold (not counted)", "Net", "Bank balance after"];
  const rows = forecastRows(f).map((r) => [r.label, r.receipts, r.payments, r.onHold, r.net, f.openingKnown ? r.closing : ""]);
  return { headers, rows };
}

// What to say above the forecast so nobody reads it as more than it is.
export function forecastNotes(f) {
  if (!f) return [];
  const notes = ["A cheque on hold is shown beside the plan, not in it: it will not be banked on its date."];
  notes.push("Cheques already due are taken off the opening balance first, as if they clear at once. A cheque we issued can be paid by the bank any day after its date.");
  if (!f.openingKnown) notes.unshift("The bank balance is the whole organisation's, so it is not shown against a single branch's cheques. The balance column starts from nothing.");
  if (f.capped) notes.push("There are more cheques than this report reads at once, so the figures are partial.");
  return notes;
}
