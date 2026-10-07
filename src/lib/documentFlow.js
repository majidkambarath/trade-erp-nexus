// A customer's deals (quotation -> order -> delivery -> invoice) as the profile shows them: a stepper for
// each deal, what to do next, and which deals need someone. No React here, so the rules are tested without
// rendering. The server joins the documents (utils/documentFlow.js on the backend); this decides how a deal
// reads and what the next step is.

import { clockText, statusLabel } from "./salesDocuments";
import { formatDate, formatNumber } from "../utils/format";
import { statusTone } from "./status";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const STAGE_LABEL = { quoted: "Quoted", ordered: "Ordered", delivering: "Delivering", delivered: "Delivered", invoiced: "Invoiced", lost: "Lost", lapsed: "Expired" };
export const STAGE_TONE = { quoted: "info", ordered: "info", delivering: "info", delivered: "warning", invoiced: "success", lost: "danger", lapsed: "neutral" };

// ---- where each document lives -------------------------------------------------------------
export const quotationTo = (q) => `/quotations?open=${q._id}`;
export const orderTo = (o) => `/sales-order?search=${encodeURIComponent(o.transactionNo)}`;
export const noteTo = (n) => `/delivery-notes?open=${n._id}`;
export const INVOICE_QUEUE = "/delivery-notes?status=UNINVOICED";

// ---- the documents of a deal, as a step shows them -----------------------------------------
const quoteDoc = (q) => {
  const shown = q.expired ? "EXPIRED" : q.status;
  const open = q.status === "SENT" && !q.expired && q.daysLeft != null;
  return { kind: "quotation", no: q.quotationNo, status: statusLabel(shown), tone: statusTone(shown), to: quotationTo(q), meta: open ? `valid ${plural(q.daysLeft, "more day")}` : `valid until ${formatDate(q.validUntil)}` };
};
const orderDoc = (o, status) => ({
  kind: "order", no: o.transactionNo, status: status || (o.status === "APPROVED" ? "Approved" : "Draft"), tone: o.status === "APPROVED" ? "success" : "neutral",
  to: orderTo(o), meta: `AED ${formatNumber(o.totalAmount, 2)}`,
});
const noteDoc = (n) => ({
  kind: "note", no: n.deliveryNoteNo, status: statusLabel(n.status), tone: statusTone(n.status), to: noteTo(n),
  meta: n.status === "DELIVERED" ? `delivered ${formatDate(n.deliveredAt)}` : `AED ${formatNumber(n.totalAmount, 2)}`,
});
const invoiceDoc = (o) => {
  const owed = Number(o.outstandingAmount) || 0;
  return { kind: "invoice", no: o.transactionNo, status: "Invoiced", tone: "success", to: orderTo(o), meta: owed > 0.004 ? `AED ${formatNumber(owed, 2)} outstanding` : "paid" };
};

const delivered = (n) => n.status === "DELIVERED";

// ---- closing an order short ----------------------------------------------------------------
// The customer took part of an order and will never take the rest. The server decides whether that can be
// done (utils/closeShort.js) and says why not; these only decide whether to OFFER it: goods were delivered
// against the order's own lines, all of them are signed for, some of the order is still to come, and it has
// not been closed already.
export const canCloseShort = (c) =>
  Boolean(
    c.order && ["DRAFT", "APPROVED"].includes(c.order.status) && c.mode === "order_first" && !c.closeShort &&
    c.delivery && c.delivery.started && !c.delivery.complete && (c.notes || []).length > 0 && c.notes.every(delivered)
  );
// Undoing it: a cut-down draft can be put back until it is approved; an invoiced order until a sales return exists.
export const canReopenShort = (c) =>
  Boolean(c.order && c.closeShort && (c.closeShort.trimmed ? c.order.status === "DRAFT" : !(c.closeShort.returns || []).length));

// "4 x Rice, 2 x Oil", and "+1 more" past two lines: what an order still has to send.
const qtyText = (q) => String(Math.round(Number(q) * 1000) / 1000);
export function leftText(remaining = []) {
  const shown = remaining.slice(0, 2).map((r) => `${qtyText(r.qty)} x ${r.description || "item"}`).join(", ");
  return remaining.length > 2 ? `${shown} +${remaining.length - 2} more` : shown;
}
// Some of the order has gone out and some has not: signed-for notes do not make that a finished delivery.
const partDelivered = (c) => Boolean(c.delivery && c.delivery.started && !c.delivery.complete);

// A step is `done`, `doing` (in hand now), `stopped` (the deal ended here), `todo` (still to come) or
// `none` (this deal never had one). The first step still to be done is marked `current`.
export function dealSteps(c) {
  const q = c.quotation;
  const o = c.order;
  const notes = c.notes || [];
  const invoiced = o?.status === "APPROVED";
  const goodsFirst = c.mode === "delivery_first";
  const steps = [];

  const quoteState = !q ? "none" : q.status === "REJECTED" || q.expired ? "stopped" : ["ACCEPTED", "CONVERTED"].includes(q.status) ? "done" : "doing";
  steps.push({ key: "quotation", label: "Quotation", state: quoteState, docs: q ? [quoteDoc(q)] : [], hint: q ? "" : "No quotation" });

  if (!goodsFirst) {
    const orderHint = q && q.status === "ACCEPTED" ? "Accepted: convert it to a sales order" : q && quoteState === "doing" ? "Not ordered yet" : "";
    steps.push({ key: "order", label: "Sales order", state: o ? "done" : quoteState === "stopped" ? "none" : "todo", docs: o ? [orderDoc(o)] : [], hint: o ? "" : orderHint });
  }

  const deliveryHint = c.closeShort
    ? `Closed short: ${leftText(c.closeShort.left)} will not be delivered`
    : o && !notes.length ? "Nothing delivered yet" : partDelivered(c) ? `Still to deliver: ${leftText(c.delivery.remaining)}` : "";
  steps.push({
    key: "delivery", label: "Delivery",
    state: !notes.length ? (quoteState === "stopped" && !o ? "none" : "todo") : notes.every(delivered) && !partDelivered(c) ? "done" : "doing",
    docs: notes.map(noteDoc), hint: deliveryHint,
  });

  let invoiceHint = "";
  if (!invoiced) {
    if (o && goodsFirst) invoiceHint = "Draft invoice: approve it to book the sale";
    else if (o) invoiceHint = "Approve the order to invoice";
    else if (c.invoiceClock) invoiceHint = clockText(c.invoiceClock);
  }
  steps.push({
    key: "invoice", label: "Invoice",
    state: invoiced ? "done" : o && goodsFirst ? "doing" : quoteState === "stopped" && !o && !notes.length ? "none" : "todo",
    docs: invoiced ? [invoiceDoc(o)] : o && goodsFirst ? [orderDoc(o, "Draft invoice")] : [], hint: invoiceHint,
  });

  const current = steps.find((s) => s.state === "doing") || steps.find((s) => s.state === "todo");
  return steps.map((s) => ({ ...s, current: s === current && c.stage !== "invoiced" && c.stage !== "lost" && c.stage !== "lapsed" }));
}

// The one thing to do about a deal, and where to do it. `waiting` means the move is the customer's.
export function nextAction(c) {
  const q = c.quotation;
  const o = c.order;
  const notes = c.notes || [];
  const out = notes.filter((n) => !delivered(n));
  if (out.length) {
    const n = out[0];
    return n.status === "DRAFT"
      ? { label: "Dispatch the delivery", why: `${n.deliveryNoteNo} has not left the warehouse`, to: noteTo(n) }
      : { label: "Confirm the delivery", why: `${n.deliveryNoteNo} is on the road: record who signed for it`, to: noteTo(n) };
  }
  // part of the order has gone out: the rest is the next delivery, whether or not it has been invoiced
  if (o && partDelivered(c)) {
    return { label: "Deliver the rest", why: `Still to deliver: ${leftText(c.delivery.remaining)}`, to: `/delivery-notes?order=${o._id}` };
  }
  // an invoiced order closed short billed goods that never left: a sales return puts the books right
  if (o && c.closeShort?.creditDue) {
    const cs = c.closeShort;
    const draft = (cs.returns || []).find((r) => r.status === "DRAFT");
    return draft
      ? { label: "Approve the sales return", why: `${draft.transactionNo} is still a draft: approving it puts the undelivered goods back in stock and credits the customer`, to: "/sales-return" }
      : { label: "Raise a sales return", why: `${leftText(cs.left)} was invoiced but never delivered (about AED ${formatNumber(cs.valueShort, 2)} with VAT). A sales return puts it back in stock and credits the customer`, to: "/sales-return" };
  }
  if (o) {
    if (o.status === "APPROVED") return null;
    return c.mode === "delivery_first"
      ? { label: "Approve the invoice", why: "Approving books the sale and takes the goods out of stock", to: orderTo(o) }
      : { label: notes.length ? "Approve the order to invoice it" : "Approve the order", why: "Approving books the sale and takes the goods out of stock", to: orderTo(o) };
  }
  if (notes.length) {
    return { label: "Create the invoice", why: c.invoiceClock ? clockText(c.invoiceClock) : "Delivered and not invoiced yet", to: INVOICE_QUEUE };
  }
  if (!q) return null;
  if (q.status === "DRAFT") return { label: "Finish and send", why: "This offer has not gone to the customer", to: quotationTo(q) };
  if (q.status === "SENT") {
    return q.expired
      ? { label: "Revise the offer", why: `It ran out on ${formatDate(q.validUntil)}`, to: quotationTo(q) }
      : { label: "Record the answer", why: "Waiting for the customer", to: quotationTo(q), waiting: true };
  }
  if (q.status === "ACCEPTED") return { label: "Convert to a sales order", why: "The customer said yes", to: quotationTo(q) };
  return null;
}

// Where a deal sits in the list: needs someone, is in hand, or is finished.
export function dealGroup(c) {
  if (c.stage === "lost" || c.stage === "lapsed") return "done";
  const next = nextAction(c);
  if (next && !next.waiting) return "action";
  if (c.stage === "invoiced" && !next) return "done";
  return "progress";
}

export const FLOW_FILTERS = [["action", "Needs action"], ["progress", "In progress"], ["done", "Done"], ["all", "All"]];

export function flowCounts(chains) {
  const counts = { action: 0, progress: 0, done: 0, all: chains.length };
  for (const c of chains) counts[dealGroup(c)] += 1;
  return counts;
}

export const filterDeals = (chains, filter) => (filter === "all" ? chains : chains.filter((c) => dealGroup(c) === filter));

// Open on what needs doing when there is something, otherwise on everything.
export const defaultFilter = (counts) => (counts.action > 0 ? "action" : "all");

// What heads a deal: its invoice or order if it has one, else its offer, else its first note.
export function dealTitle(c) {
  if (c.order) return { no: c.order.transactionNo, kind: c.order.status === "APPROVED" ? "Tax invoice" : c.mode === "delivery_first" ? "Draft invoice" : "Sales order" };
  if (c.quotation) return { no: c.quotation.quotationNo, kind: "Quotation" };
  return { no: c.notes[0]?.deliveryNoteNo || "", kind: "Delivery note" };
}
