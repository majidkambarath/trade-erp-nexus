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
import { termDays } from "../../lib/paymentStatus";
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

// The party as the paper names them. `partyId` is POPULATED by the server (getVoucherById) with
// the handful of fields a printed voucher shows; on a LIST row it is a bare id string, so every
// field but the name is read defensively and simply goes missing rather than throwing.
//
// The NAME is the voucher's own `partyName` - the snapshot taken when it was written. The address
// and tax number are not snapshotted anywhere, so they are read live and a reprint shows today's
// address. Customer keeps them in `billingAddress` / `trnNumber`, Vendor in `address` / `trnNO`;
// both also carry `vat.trn`, which is the one kept in step by the party master service.
export function partyBlock(v = {}) {
  if (!v.partyName) return null;
  const p = v.partyId && typeof v.partyId === "object" ? v.partyId : {};
  const text = (s) => String(s ?? "").trim();
  return {
    heading: partyLabelFor(v.voucherType),
    name: v.partyName,
    address: text(p.billingAddress || p.address),
    taxId: text(p.vat?.trn || p.trnNumber || p.trnNO),
    email: text(p.email),
  };
}

// How long this party has to pay. `credit.days` is the number the master keeps, but it is derived
// from the `paymentTerms` label by the model's toJSON transform, and that transform does NOT run
// on the voucher read (the query is .lean()) - so a customer who only ever had terms set comes
// back with no `credit` at all and the label is parsed here instead. "Prepaid" and "Cash on
// Delivery" carry no number and give 0, which the meta row then drops rather than printing "0".
export function creditDaysOf(v = {}) {
  const p = v.partyId && typeof v.partyId === "object" ? v.partyId : {};
  const stored = Number(p.credit?.days);
  const days = Number.isFinite(stored) ? stored : termDays(p.paymentTerms);
  return days > 0 ? String(days) : "";
}

// The invoice numbers this voucher settled, as the one line a customer looks for first. Three at
// most: past that it stops being a reference and becomes a paragraph, and the "Against invoice"
// table further down carries every one of them with its own figures.
export function invoiceRefOf(v = {}) {
  const nos = settledInvoiceRows(v).map((r) => r.no).filter((no) => no && no !== "—");
  if (nos.length === 0) return "";
  return nos.length <= 3 ? nos.join(", ") : `${nos.slice(0, 3).join(", ")} +${nos.length - 3} more`;
}

// The body of the copy that leaves the building: what the money was for, one line each, and never
// the double-entry postings. A customer holding a receipt has no business reading "Dr Cheques in
// Hand / Cr Customer - Al Khaleej"; that is the bookkeeper's view and it stays on the office copy.
export function descriptionRows(v = {}, amount = 0) {
  const paying = v.voucherType === "payment";
  const against = paying ? "Being payment against" : "Being receipt against";
  // Each row carries the balance left on that invoice, so this ONE table can say everything the
  // separate "Against invoice" table says and the party's copy need not print the same invoice
  // numbers and figures twice. The office copy still gets both, where they differ: a ledger table
  // of accounts beside a table of allocations.
  const rows = settledInvoiceRows(v)
    .filter((r) => r.no && r.no !== "—")
    .map((r) => ({ text: `${against} ${r.no}`, amount: r.amount, balance: r.balance }));

  const onAccount = num(v.onAccountAmount);
  if (onAccount > 0) {
    // Nothing is set against an invoice, so there is no balance to leave behind: null, not 0,
    // which would read as "this invoice is now settled".
    rows.push({
      text: paying ? "Being payment on account" : "Being receipt on account",
      amount: onAccount,
      balance: null,
    });
  }
  // Nothing allocated and nothing on account - an expense, a journal, or a receipt entered before
  // it was set against anything. The sheet still needs a line, so it carries the voucher's own
  // words and its whole total rather than printing an empty table.
  if (rows.length === 0) {
    const fallback = paying ? "Being amount paid" : "Being amount received";
    rows.push({
      text: String(v.narration || v.description || "").trim() || fallback,
      amount: num(amount),
      balance: null,
    });
  }
  return rows.map((r, i) => ({ no: i + 1, ...r }));
}

// Narration and notes, under one heading. `notes` has been editable (the "Edit narration" dialog
// writes it) and invisible on paper ever since it existed; "Remarks" is both the plainer word and
// the one the printed voucher the owner compared this with uses, so both go under it.
export const remarksOf = (v = {}) =>
  [v.narration, v.notes].map((s) => String(s ?? "").trim()).filter(Boolean).join("\n");

// Which copies go OUT of the building. The builder cannot decide this for itself: `sheetMarkup`
// (PurchaseOrder/shared/documentPdf.jsx) spreads the sheet and overrides `copy` for each copy it
// draws, so the branch has to happen in the component - this keeps the one string comparison in a
// single tested place rather than loose in the JSX.
export const isPartyCopy = (copy) => copy === "Customer copy" || copy === "Payee copy";

// Who signs. The office copy carries the internal control it always did; the copy handed to the
// customer carries the two things that copy is FOR - their signature for the money, and room for
// our stamp. Asking a customer to witness "Approved by" on their own receipt is nonsense.
export const signaturesFor = (copy) =>
  (isPartyCopy(copy)
    ? ["Received by", "Company stamp"]
    : ["Prepared by", "Checked by", "Approved by"]);

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
    party: partyBlock(v),
    // Only what this voucher actually has: an empty row is left off rather than printed blank,
    // through the same helper the invoice's own meta block uses. "Payment method" names the
    // ACCOUNT and instrument the money moved through ("Cheque 455120 · Emirates NBD"), never a
    // person - which is why it is not "Received by", a label that would read as a name.
    meta: rowsWithValue([
      ["Date", v.date ? formatDateGB(v.date) : ""],
      ["Payment method", v.paymentMode ? describePayment(v) : ""],
      ["Invoice ref", invoiceRefOf(v)],
      ["Credit days", creditDaysOf(v)],
      ["Reference", v.referenceNo || ""],
    ]),
    // The rate stamped on the voucher and where it came from: its own block above the figures,
    // because on a foreign-currency voucher it is the one thing that explains every one of them.
    fx: isForeign(v) ? { line: fxLine(v), provenance: fxProvenance(v) } : null,
    entries,
    // What the party's copy shows in place of the postings. Both bodies ride on the sheet and the
    // component picks one from its `copy` prop, because that prop is only settled at markup time.
    description: descriptionRows(v, amount),
    totals,
    amount,
    words: totalInWords(amount, currency),
    remarks: remarksOf(v),
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
