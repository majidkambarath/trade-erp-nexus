// Pure rules behind the printed finance voucher: receipts, payments, journals, contras, expenses
// and notes. No React here, so what reaches the paper is tested without rendering, exactly as
// `PurchaseOrder/shared/invoiceModel.js` is for the invoice sheet beside it.
//
// The voucher used to print as a bare system-ui table written into a popup window, while the tax
// invoice printed on a designed A4 sheet: one organisation, two kinds of paper. This builds the
// voucher in the invoice's own shape - { company, title, number, party, meta, ... } - so
// `VoucherSheet.jsx` can be the invoice sheet's twin and the two cannot drift apart in tone.
//
// Named `voucherModel.js`, not `voucherSheet.js`, for the same reason `lib/shareSheet.js` is not
// `sharedDocument.js`: Windows' filesystem is case-insensitive, so a `voucherSheet.js` sitting
// beside `VoucherSheet.jsx` makes `import ... from "./VoucherSheet"` resolve to whichever the
// bundler reaches first - it returned the model, and the component rendered as undefined. The
// pairing mirrors `invoiceModel.js` beside `InvoiceSheet.jsx`.

import { companyBlock, rowsWithValue, totalInWords } from "../PurchaseOrder/shared/invoiceModel";
import { describePayment } from "../../lib/voucherForms";
import { fxLine, fxProvenance, isForeign } from "../../lib/currencyForms";
import { formatDateGB } from "../../utils/format";
import { orgCurrency } from "../../utils/orgLocale";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// "Received from" for money coming in, "Paid to" for money going out; anything else (journal,
// contra, expense, a note) keeps the plain "Party" it always had - none of them is one side of a
// cash movement in the same way.
export const partyLabelFor = (voucherType) =>
  (voucherType === "receipt" ? "Received from" : voucherType === "payment" ? "Paid to" : "Party");

// The invoices a receipt or payment settled, in the shape both the printed sheet and the screen
// read: number, date, what this voucher put against it, and the balance left after. `invoiceId` is
// POPULATED by the server (financialService.getVoucherById); a deleted invoice still shows its id.
// One function for both, so the paper and the dialog can never list different allocations. The
// date stays RAW - each end formats it with `formatDateGB` itself.
export function settledInvoiceRows(v) {
  return (v?.linkedInvoices || []).map((li) => {
    const inv = li.invoiceId && typeof li.invoiceId === "object" ? li.invoiceId : null;
    return {
      no: inv?.transactionNo || (li.invoiceId ? String(li.invoiceId) : "—"),
      date: inv?.date || null,
      amount: num(li.amount ?? li.allocatedAmount),
      balance: num(li.balance ?? li.newBalance),
    };
  });
}

// A voucher that is not posted must say so where nobody can miss it. A pending one is printed on
// purpose - that is how it goes round for signature - so the sheet physically travels while it is
// still outside the books, and a status word tucked into an 11px meta grid is not enough. An
// approved voucher gets no stamp: the footer notice already says it is posted.
const STAMP = {
  approved: null,
  pending: "Pending approval — not posted",
  draft: "Draft — not posted",
  rejected: "Rejected — not posted",
  cancelled: "Cancelled — the ledger entries were reversed",
  bounced: "Cheque returned unpaid — the voucher was reversed",
};

// Three cases, not two. A cancelled voucher and a bounced cheque WERE posted and then reversed, so
// telling their reader the voucher "becomes part of the books once it is approved" is a false
// statement on an accounting document - it was in the books, and it was taken back out.
const noticeFor = (status) => {
  if (status === "approved") {
    return "This voucher is posted to the ledger. Computer-generated; no signature is required unless a signed copy is filed.";
  }
  if (status === "cancelled" || status === "bounced") {
    return "This voucher has been reversed. Its ledger entries no longer stand and any invoices it settled were reopened.";
  }
  return "This voucher has NOT been posted to the ledger. It becomes part of the books only once it is approved.";
};

// Which copies this kind of voucher is drawn as. The first is what the dialog prints; a receipt is
// also the acknowledgement handed to the payer, so the label is recorded rather than lost.
const copiesFor = (voucherType) =>
  (voucherType === "receipt" ? ["Office copy", "Customer copy"]
    : voucherType === "payment" ? ["Office copy", "Payee copy"]
      : ["Office copy"]);

// One voucher as a printable sheet. `profile` is the organisation's one letterhead
// (useCompanyProfile), the same block the tax invoice carries, so a voucher and an invoice from
// the same organisation print under one heading.
//
// `copy` is a prop at markup time and `copies` rides beside the sheet, as every other document
// does (orderDocs/documents.js): one sheet can be drawn as several copies. `title` is kept as it
// was written - the band uppercases it in CSS - which leaves it readable in a test and reusable
// for the file name. `currency` is read at CALL time, never defaulted to a hardcoded "AED": it is
// a live binding that follows the organisation (utils/format.js), as `totalInWords` already is.
export function voucherSheet(v = {}, { title = "Voucher", profile = {}, currency = orgCurrency(), copy } = {}) {
  const entries = (v.entries || []).map((e, i) => ({
    no: i + 1,
    account: e.accountName || "",
    description: e.description || "",
    debit: num(e.debitAmount),
    credit: num(e.creditAmount),
  }));
  const totals = entries.reduce(
    (t, e) => ({ debit: t.debit + e.debit, credit: t.credit + e.credit }),
    { debit: 0, credit: 0 },
  );
  // A voucher with no stored total (an older row) is worth what it posted: the two sides are equal
  // on anything that balanced, so either is the figure - take the larger so a half-written one
  // still prints something rather than nothing.
  const amount = num(v.totalAmount) || Math.max(totals.debit, totals.credit);
  const copies = copiesFor(v.voucherType);

  return {
    // Which page this is drawn on, read by `sheetComponent` in PurchaseOrder/shared/documentPdf.jsx
    // exactly as a delivery note's `layout: "delivery"` is. It is what lets the voucher reuse the
    // whole document screen - preview, copy switch, Print, Download PDF - rather than own a second
    // copy of it. Before there was a preview the registration was deliberately left out; now the
    // voucher has its own page, the reason not to register it is gone.
    layout: "voucher",
    title,
    copy: copy || copies[0],
    copies,
    company: companyBlock(profile),
    number: { label: "Voucher no.", value: v.voucherNo || "" },
    party: v.partyName ? { heading: partyLabelFor(v.voucherType), name: v.partyName } : null,
    // Only what this voucher actually has: an empty row is left off rather than printed blank,
    // through the same helper the invoice's own meta block uses. "Paid by" whatever the type,
    // because that is the word the dialog uses and `describePayment` names the ACCOUNT the money
    // moved through ("Cash - Cash in Hand"), never a person - "Received by" would read as a name.
    meta: rowsWithValue([
      ["Date", v.date ? formatDateGB(v.date) : ""],
      ["Paid by", v.paymentMode ? describePayment(v) : ""],
      ["Reference", v.referenceNo || ""],
    ]),
    // The rate stamped on the voucher and where it came from: its own block above the figures,
    // because on a foreign-currency voucher it is the one thing that explains every one of them.
    fx: isForeign(v) ? { line: fxLine(v), provenance: fxProvenance(v) } : null,
    entries,
    totals,
    amount,
    words: totalInWords(amount, currency),
    narration: v.narration || "",
    invoices: settledInvoiceRows(v),
    onAccount: num(v.onAccountAmount),
    currency,
    // null when it is posted. One key, not a `posted` boolean beside it: two fields that must
    // always agree are one field too many. Read with `in`, NOT `??`: an approved voucher's entry
    // IS null, so `??` fell through to the fallback and stamped "not posted" on a posted voucher.
    // A status nobody has seen before is treated as unposted - the safe way round on paper.
    stamp: v.status in STAMP ? STAMP[v.status] : "Not posted to the ledger",
    notice: noticeFor(v.status),
  };
}

// What the file is called when it is downloaded, in the convention every other document uses
// (invoiceDocuments.js, orderDocs/documents.js): "Payment-voucher_PV-2026-0070".
export const voucherFileName = (v, title) =>
  `${String(title || "Voucher").replace(/\s+/g, "-")}_${v?.voucherNo || "draft"}`;

// --- the voucher's own page ------------------------------------------------------------------

// Where a voucher is read as a document, one entry per finance screen. The route is the LIST's own
// path with the id after it (`/receipt-voucher/RV1`), so it prefix-matches that screen's navigation
// tab and needs no new entry in `config/navigation.js` - `isPathActive` already treats a nested
// detail route as belonging to its tab, which is also what `navigation.test.js` requires.
//
// `voucherType` has NO enum on the server (it is commented out in financialModels.js, and
// CLAUDE.md says to validate in the service layer rather than trust it), and other services write
// values of their own - `opening`, `closing`, `opening_stock` - that have no finance screen at all.
// So this is a lookup with a null fallback, never a template: a voucher whose type has no page
// simply is not offered one, and keeps printing from the dialog.
export const VOUCHER_PAGES = {
  receipt: { path: "/receipt-voucher", title: "Receipt voucher" },
  payment: { path: "/payment-voucher", title: "Payment voucher" },
  journal: { path: "/journal-voucher", title: "Journal voucher" },
  contra: { path: "/contra-voucher", title: "Contra voucher" },
  expense: { path: "/expense-voucher", title: "Expense voucher" },
  // Both notes share one screen, which picks the tab it opens on from `?type=`.
  credit_note: { path: "/debit-credit-notes", title: "Credit note", query: "?type=credit_note" },
  debit_note: { path: "/debit-credit-notes", title: "Debit note", query: "?type=debit_note" },
};

/** The document page for a voucher, or null for a kind that has no finance screen. */
export const voucherPage = (v) => VOUCHER_PAGES[v?.voucherType] || null;

/** Address of a voucher's own document page, or null when it has none (so the caller hides the link). */
export function voucherPagePath(v) {
  const page = voucherPage(v);
  const id = v?._id || v?.id;
  return page && id ? `${page.path}/${id}` : null;
}

/** Where "Back to list" goes from a voucher's document page: its own screen, on the right tab. */
export const voucherListPath = (v) => {
  const page = voucherPage(v);
  return page ? `${page.path}${page.query || ""}` : "/receipt-voucher";
};

// Tone and label for a voucher's status, shared by the list pill, the dialog and the document
// page's header so one voucher cannot read "Posted" on one screen and "Approved" on the next.
// `approved` deliberately READS as "Posted": what matters to a bookkeeper is that it reached the
// ledger, not that somebody pressed Approve. The tone names are `Pill`'s; `lib/status.js`
// normalises the key's case for the page header, so both ends colour it the same.
export const VOUCHER_STATUS = {
  approved: ["success", "Posted"],
  pending: ["warning", "Pending"],
  draft: ["warning", "Draft"],
  rejected: ["danger", "Rejected"],
  bounced: ["danger", "Bounced"],
  cancelled: ["neutral", "Cancelled"],
};

/** What a voucher's status is called on screen; the raw value for one nobody has named. */
export const voucherStatusLabel = (status) => VOUCHER_STATUS[status]?.[1] || status || "";
