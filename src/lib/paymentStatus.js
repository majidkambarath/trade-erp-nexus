// Whether an invoice has been paid, read from its amounts. Pure: no React, no network.
//
// This is never a stored status. `Transaction.status` is Draft / Approved / Rejected / Cancelled; what a
// customer or vendor has settled is `paidAmount` / `outstandingAmount`, which receipts, payments and
// credit / debit notes keep up to date. Writing "PAID" into `status` once made ageing, returns and
// deletion (all of which look for APPROVED) miss the document, so the word is derived here, at the
// moment it is shown, and the document is untouched.
//
// Only a posted document has a payment state: a draft owes nothing yet. The older payment words that
// legacy code wrote into `status` (PAID / PARTIAL / UNPAID) mean "posted" here, and the amounts decide.

const POSTED = new Set(["APPROVED", "INVOICED", "PAID", "PARTIAL", "UNPAID"]);
const LEGACY_WORD = { PAID: "PAID", PARTIAL: "PARTIAL", UNPAID: "UNPAID" };
const TOLERANCE = 0.005; // the same half-fils every consumer of these amounts uses

export const PAYMENT_LABEL = { UNPAID: "Unpaid", PARTIAL: "Partly paid", PAID: "Paid" };

// A figure the server did not send is missing, not zero: "outstanding 0" would read as paid.
const amountOf = (v) => (v === undefined || v === null || v === "" ? NaN : Number(v));

/**
 * { key: "UNPAID" | "PARTIAL" | "PAID", label, total, paid, outstanding } for a posted invoice,
 * or null when there is nothing to say (a draft, a rejected or cancelled document, a nil amount,
 * or amounts that did not arrive).
 */
export function paymentStatus(doc) {
  if (!doc) return null;
  const status = String(doc.status ?? "").trim().toUpperCase();
  if (!POSTED.has(status)) return null;

  const total = amountOf(doc.totalAmount);
  let paid = amountOf(doc.paidAmount);
  let outstanding = amountOf(doc.outstandingAmount);

  if (Number.isNaN(paid) && Number.isNaN(outstanding)) {
    // no amounts: only the old word can say, and it says nothing for a plain APPROVED document
    const key = LEGACY_WORD[status];
    return key ? { key, label: PAYMENT_LABEL[key], total: Number.isNaN(total) ? null : total, paid: null, outstanding: null } : null;
  }
  if (Number.isNaN(total) || total <= TOLERANCE) return null; // a nil document has nothing to pay
  if (Number.isNaN(outstanding)) outstanding = total - paid;
  if (Number.isNaN(paid)) paid = total - outstanding;

  // Returns set against the invoice (creditedAmount) come off what is owed like a payment, but they are not a payment: an invoice
  // settled only by credit reads "Credited", one part-settled by credit alone "Partly credited"; money paid decides Paid / Partly paid.
  const creditedRaw = amountOf(doc.creditedAmount);
  const credited = Number.isNaN(creditedRaw) ? 0 : Math.max(0, creditedRaw);
  const key = outstanding <= TOLERANCE ? "PAID" : paid > TOLERANCE || credited > TOLERANCE ? "PARTIAL" : "UNPAID";
  let label = PAYMENT_LABEL[key];
  if (credited > TOLERANCE && paid <= TOLERANCE) label = key === "PAID" ? "Credited" : "Partly credited";
  return { key, label, total, paid: Math.max(0, paid), credited, outstanding: Math.max(0, outstanding) };
}

/** True when a posted document has been settled in full. */
export const isPaid = (doc) => paymentStatus(doc)?.key === "PAID";

// ---- when it falls due -----------------------------------------------------------------------------------------------
// The date stored on the document, else its date plus the days in the party's payment terms ("Net 30", "45 days"; no number
// means due on the day). This is the rule the ageing report uses (services/financial/ageingService.js), so a register, an
// overview and the ageing cannot disagree. Almost no document stores a due date (opening invoices do), hence the terms.
const DAY = 86400000;
export const termDays = (terms) => {
  const m = /(\d+)/.exec(String(terms || ""));
  return m ? Number(m[1]) : 0;
};
export function dueDateOf(doc) {
  if (!doc) return null;
  if (doc.dueDate) return new Date(doc.dueDate);
  if (!doc.date) return null;
  const terms = doc.paymentTerms ?? doc.party?.paymentTerms;
  return new Date(new Date(doc.date).getTime() + termDays(terms) * DAY);
}
/** Past due once a whole day has gone by since it fell due, and only while something is still owed. */
export function isPastDue(doc, now = Date.now()) {
  const p = paymentStatus(doc);
  const due = dueDateOf(doc);
  return Boolean(p && p.key !== "PAID" && due && Math.floor((now - due.getTime()) / DAY) > 0);
}
