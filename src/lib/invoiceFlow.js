// The step from "delivered / received" to "invoice approved" in one click. Pure apart from the call it is handed.
//
// An invoice made from an order, a delivery note or a goods receipt starts as a DRAFT, and only approving it moves stock and
// posts the books. The goods were already checked at the order and at the delivery, so asking for a second click was only
// friction: the dialogs offer "Create and approve" (the default) beside "Create draft only". An approval is still judged by the
// organisation's rules (a person's limit, a separate approver, a second approver above an amount), so the invoice can come out
// as a draft with the reason, and nothing is bypassed.
import { applyAfterSave } from "./processTransaction";

/**
 * Runs an invoice-making call and, when `body.approveNow` is set, approves the invoice it made.
 * `call(payload)` gets the body without `approveNow`; `pick(result)` names the invoice in what it returned.
 * The approval never throws: the invoice exists either way, and `approval` says what came of it.
 */
export async function createThenApprove(call, body, pick) {
  const { approveNow, ...payload } = body || {};
  const result = await call(payload);
  const invoice = pick(result);
  if (!approveNow || !invoice?._id) return { ...result, approval: null };
  return { ...result, approval: await applyAfterSave(invoice._id, "approve") };
}

/** The sentence the toast says: what was made, from what, and where the approval stands. */
export function invoiceNote(no, from, approval) {
  const made = `${no} created${from ? ` from ${from}` : ""}`;
  if (!approval) return `${made}. Approve it to post it to the books.`;
  if (approval.done) return `${made} and approved`;
  if (approval.awaitingSecond) return `${made}. Your approval is recorded; a second person must approve it before it posts.`;
  if (approval.cancelled) return `${made} as a draft. Approve it when you are ready.`;
  return `${made} as a draft, not approved: ${approval.message || "the approval was refused"}`;
}

/** Wording of the confirm button for the two choices. */
export const invoiceConfirmLabel = (approveNow) => (approveNow ? "Create and approve invoice" : "Create draft invoice");

// ---- where a document stands ---------------------------------------------------------------------------------------
// One line for an order: Ordered -> Confirmed -> Delivered / Received -> Invoiced -> Approved -> Paid. Each step is
// done | current | todo, and the person is told the single next thing to press. Built from what the server sent for the order
// (status, progress.lines, invoices), so the screen holds no copy of the rules.

const TOL = 0.005;

export function orderSteps(order) {
  if (!order) return { steps: [], next: null };
  const sales = order.kind === "sales";
  const got = sales ? "Delivered" : "Received";
  const lines = Object.values(order.progress?.lines || {});
  const ordered = lines.reduce((t, l) => t + (Number(l.ordered) || 0), 0);
  const received = lines.reduce((t, l) => t + (Number(l.received) || 0), 0);
  const invoices = order.invoices || [];
  const approved = invoices.filter((i) => String(i.status).toUpperCase() === "APPROVED");
  const draft = invoices.filter((i) => String(i.status).toUpperCase() === "DRAFT");
  const settled = approved.length > 0 && approved.every((i) => (Number(i.outstandingAmount) || 0) <= TOL);

  const confirmed = ["CONFIRMED", "CLOSED"].includes(order.status);
  const cancelled = order.status === "CANCELLED";
  const gotSome = received > TOL;
  const gotAll = ordered > TOL && received >= ordered - TOL;
  const invoicedSome = invoices.length > 0;
  const allApproved = invoicedSome && draft.length === 0;

  const flags = [
    { key: "confirmed", label: "Confirmed", done: confirmed },
    { key: "got", label: gotAll ? got : gotSome ? `Partly ${got.toLowerCase()}` : got, done: gotAll, part: gotSome && !gotAll },
    { key: "invoiced", label: "Invoiced", done: invoicedSome },
    { key: "approved", label: "Approved", done: allApproved, part: approved.length > 0 && draft.length > 0 },
    { key: "paid", label: "Paid", done: settled && allApproved, part: approved.some((i) => (Number(i.paidAmount) || 0) > TOL) && !settled },
  ];
  // the first step that is not done is the current one
  let current = flags.findIndex((s) => !s.done);
  if (cancelled) current = -1;
  const steps = flags.map((s, i) => ({ ...s, state: s.done ? "done" : i === current ? "current" : "todo" }));

  let next = null;
  if (!cancelled) {
    if (order.status === "DRAFT") next = { key: "confirm", text: "Confirm the order" };
    else if (draft.length) next = { key: "approve", text: draft.length === 1 ? `Approve ${draft[0].no}` : `Approve ${draft.length} draft invoices` };
    else if (!gotAll && order.status === "CONFIRMED") next = { key: "receive", text: sales ? "Deliver the goods" : "Receive the goods" };
    if (!next && order.status === "CONFIRMED" && order.actions?.invoice) next = { key: "invoice", text: "Create the invoice" };
    if (!next && approved.length && !settled) next = { key: "pay", text: sales ? "Receive payment" : "Make payment" };
  }
  return { steps, next, cancelled };
}
