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

  const key = outstanding <= TOLERANCE ? "PAID" : paid > TOLERANCE ? "PARTIAL" : "UNPAID";
  return { key, label: PAYMENT_LABEL[key], total, paid: Math.max(0, paid), outstanding: Math.max(0, outstanding) };
}

/** True when a posted document has been settled in full. */
export const isPaid = (doc) => paymentStatus(doc)?.key === "PAID";
