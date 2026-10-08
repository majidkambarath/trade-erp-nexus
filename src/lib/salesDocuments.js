// Quotations and delivery notes: what the screens say and check, with no React in it so the rules are
// tested without rendering. The server decides everything that matters (who may do what, the VAT
// clock, what is left to deliver); these helpers only word it and catch a mistake before the request.

import { formatDate, todayInput } from "../utils/format";

const num = (v) => parseFloat(v) || 0;
const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---- labels and tabs ---------------------------------------------------------------------

// What a person's role lets them do to a quotation or a delivery note. The server says which actions the document's STATE
// allows (actions.accept, actions.dispatch...); this narrows that to what the ROLE may do, so a sales executive is not
// offered Accept or Dispatch, which belong to sales.approve. (The server refuses them either way.)
const ACTION_PERMISSION = {
  edit: "sales.edit", revise: "sales.create", delete: "sales.delete", send: "sales.send",
  accept: "sales.approve", reject: "sales.approve", convert: "sales.approve", dispatch: "sales.approve", deliver: "sales.approve", cancel: "sales.approve", invoice: "sales.approve",
};
export const allowActions = (actions, me) =>
  Object.fromEntries(Object.entries(actions || {}).map(([name, on]) => [name, Boolean(on) && (!ACTION_PERMISSION[name] || !Array.isArray(me?.grants) || me.grants.includes(ACTION_PERMISSION[name]))]));

export const STATUS_LABEL = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Converted",
  SUPERSEDED: "Superseded",
  DISPATCHED: "On the road",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
export const statusLabel = (s) => STATUS_LABEL[s] || s || "";

// [value sent to the server, label]. EXPIRED is the server's own reading of a sent offer past its date.
export const QUOTATION_TABS = [
  ["", "All"], ["DRAFT", "Draft"], ["SENT", "Sent"], ["ACCEPTED", "Accepted"],
  ["EXPIRED", "Expired"], ["CONVERTED", "Converted"], ["REJECTED", "Rejected"],
];
// UNINVOICED is delivered and waiting for an approved invoice: the 14-day clock is running.
export const DELIVERY_TABS = [
  ["", "All"], ["DRAFT", "Draft"], ["DISPATCHED", "On the road"], ["DELIVERED", "Delivered"],
  ["UNINVOICED", "Not invoiced"], ["CANCELLED", "Cancelled"],
];

// ---- quotations --------------------------------------------------------------------------

// "Valid until 5 Nov 2026 · 12 days left", "Expires today", "Expired 2 days ago". Nothing for a
// document that has already been decided: its validity no longer matters.
export function validityText(q) {
  if (!q?.validUntil) return "";
  const until = `Valid until ${formatDate(q.validUntil)}`;
  if (!["DRAFT", "SENT"].includes(q.status)) return until;
  const d = q.daysLeft;
  if (d === null || d === undefined) return until;
  if (d < 0) return `Expired ${plural(-d, "day")} ago`;
  if (d === 0) return `${until} · expires today`;
  return `${until} · ${plural(d, "day")} left`;
}

// A sent offer that runs out within a week is worth a nudge.
export const expiresSoon = (q) => q?.status === "SENT" && !q.expired && q.daysLeft !== null && q.daysLeft !== undefined && q.daysLeft <= 7;

// Where a quotation came from or went: "Revision of QT-2026-0007", "Became SO-2026-0031".
export function lineageOf(q) {
  const out = [];
  if (q?.revisionOf?.no) out.push({ text: `Revision of ${q.revisionOf.no}`, kind: "quotation", id: q.revisionOf.id });
  if (q?.supersededBy?.no) out.push({ text: `Replaced by ${q.supersededBy.no}`, kind: "quotation", id: q.supersededBy.id });
  if (q?.convertedTo?.no) {
    out.push({ text: `${q.convertedTo.kind === "delivery_note" ? "Delivered on" : "Became"} ${q.convertedTo.no}`, kind: q.convertedTo.kind, id: q.convertedTo.id });
  }
  return out;
}

// ---- delivery notes ----------------------------------------------------------------------

export const CLOCK_TONE = { within: "success", dueSoon: "warning", pastStandard: "warning", overdue: "danger" };

// The 14-day tax invoice window, in words. `clock` is what the server sent for a delivered note.
export function clockText(clock) {
  if (!clock) return "";
  const { clock: state, daysToStandard: d, summaryDue } = clock;
  if (state === "within") return `${plural(d, "day")} left to invoice`;
  if (state === "dueSoon") return d === 0 ? "Invoice due today" : `Invoice due in ${plural(d, "day")}`;
  if (state === "pastStandard") return `14 days passed. A summary invoice is still in time until ${formatDate(summaryDue)}`;
  return "Invoice overdue";
}

// What an invoice from a note is waiting on, for the status column.
export function invoiceText(note) {
  if (note.invoiceStatus === "INVOICED") return note.invoice?.no ? `Invoiced on ${note.invoice.no}` : "Invoiced";
  if (note.invoiceStatus === "DRAFT") return note.invoice?.no ? `Draft invoice ${note.invoice.no}` : "Draft invoice";
  return note.status === "DELIVERED" ? "Not invoiced" : "";
}

// ---- confirming a delivery ---------------------------------------------------------------

// The form starts as "everything arrived": most deliveries do, so only the exceptions are typed.
export function deliverForm(note, today = todayInput()) {
  return {
    receivedBy: "",
    deliveredAt: today,
    proofNote: "",
    lines: (note.items || []).map((l) => ({
      lineId: l._id,
      description: l.description,
      qty: l.qty,
      deliveredQty: String(l.qty),
      shortReason: "",
    })),
  };
}

export const shortBy = (line) => round3(num(line.qty) - num(line.deliveredQty));
export const shortLines = (form) => form.lines.filter((l) => shortBy(l) > 0);

// Same checks as the server (utils/salesDocuments.js settleDelivery), so the person is told
// beside the field instead of by a failed request.
export function validateDeliver(form, { today = todayInput(), noteDate } = {}) {
  const errors = { lines: {} };
  if (!String(form.receivedBy || "").trim()) errors.receivedBy = "Enter who received the goods";
  if (!form.deliveredAt) errors.deliveredAt = "Enter the delivery date";
  else if (form.deliveredAt > today) errors.deliveredAt = "The delivery date cannot be in the future";
  else if (noteDate && form.deliveredAt < noteDate) errors.deliveredAt = "The goods cannot arrive before the note's date";

  form.lines.forEach((l, i) => {
    const got = l.deliveredQty === "" ? NaN : Number(l.deliveredQty);
    if (!Number.isFinite(got) || got < 0) errors.lines[i] = "Enter zero or more";
    else if (round3(got) > num(l.qty)) errors.lines[i] = `At most ${l.qty} was sent`;
    else if (shortBy(l) > 0 && !String(l.shortReason || "").trim()) errors.lines[i] = `Say why ${shortBy(l)} was not delivered`;
  });
  if (!Object.keys(errors.lines).length && form.lines.every((l) => num(l.deliveredQty) === 0)) {
    errors.nothing = "Nothing was delivered. Cancel the delivery note instead.";
  }
  const bad = errors.receivedBy || errors.deliveredAt || errors.nothing || Object.keys(errors.lines).length;
  return bad ? errors : null;
}

export const deliverPayload = (form) => ({
  receivedBy: form.receivedBy.trim(),
  deliveredAt: form.deliveredAt,
  proofNote: form.proofNote.trim(),
  lines: form.lines.map((l) => ({ lineId: l.lineId, deliveredQty: num(l.deliveredQty), shortReason: shortBy(l) > 0 ? l.shortReason.trim() : "" })),
});

// ---- a note against a sales order --------------------------------------------------------

// Rows of the "against an order" form from what the server says is left. The quantity to put on this
// note starts as everything remaining, because that is the usual case; a line with nothing left stays
// visible (so the order reads whole) but cannot be edited.
// Editing a saved note passes `own` ({ sourceLineId: qty }): what the note already holds is counted as
// pending by the server, so it is added back as available to this note, and is where the quantity starts.
export function orderRows(prefill, own = null) {
  return (prefill?.lines || []).map((l) => {
    const mine = own ? Number(own[String(l.sourceLineId)]) || 0 : 0;
    const remaining = round3(l.remaining + mine);
    return {
      sourceLineId: l.sourceLineId,
      itemCode: l.itemCode || l.stockDetails?.itemId || "",
      description: l.description,
      unit: l.stockDetails?.unit || "",
      ordered: l.ordered,
      delivered: l.delivered,
      pending: round3(l.pending - mine),
      remaining,
      qty: own ? (mine > 0 ? String(mine) : "") : remaining > 0 ? String(remaining) : "",
    };
  });
}

export function validateOrderRows(rows) {
  const errors = {};
  rows.forEach((r, i) => {
    if (r.qty === "" || r.qty === undefined) return;
    const q = Number(r.qty);
    if (!Number.isFinite(q) || q < 0) errors[i] = "Enter zero or more";
    else if (round3(q) > r.remaining) errors[i] = `Only ${r.remaining} is left on the order`;
  });
  if (!rows.some((r) => num(r.qty) > 0)) errors.none = "Enter a quantity for at least one line";
  return Object.keys(errors).length ? errors : null;
}

export function orderPayload(orderId, rows, header) {
  return {
    sourceTransactionId: orderId,
    date: header.date,
    reference: header.reference || "",
    deliveryAddress: header.deliveryAddress || "",
    contactPerson: header.contactPerson || "",
    contactPhone: header.contactPhone || "",
    vehicleNo: header.vehicleNo || "",
    driverName: header.driverName || "",
    driverPhone: header.driverPhone || "",
    notes: header.notes || "",
    items: rows.filter((r) => num(r.qty) > 0).map((r) => ({ sourceLineId: r.sourceLineId, qty: num(r.qty) })),
  };
}

// ---- stock promised on notes ------------------------------------------------------------

// A note moves nothing, so until its invoice is approved the goods are still on hand in the books and
// could be promised twice. `availability` is { onHand, committed, available } for the item.
export function availabilityWarning(description, qty, availability) {
  if (!availability || !(num(qty) > 0)) return null;
  const wanted = num(qty);
  if (wanted <= availability.available) return null;
  const left = Math.max(0, availability.available);
  const promised = availability.committed > 0 ? `, ${availability.committed} already promised on other delivery notes` : "";
  return `${description || "Item"}: ${wanted} asked, ${left} available (${availability.onHand} on hand${promised})`;
}

// ---- consolidating notes into one invoice -----------------------------------------------

// Notes can go on one invoice when they are delivered, not invoiced, not tied to an order, and for one customer.
export function invoiceBlocker(notes) {
  if (!notes.length) return "Choose the delivery notes to invoice";
  if (new Set(notes.map((n) => String(n.partyId))).size > 1) return "These notes are for different customers. Invoice one customer at a time.";
  const unfit = notes.find((n) => !n.actions?.invoice);
  if (unfit) return `${unfit.deliveryNoteNo} cannot be invoiced from here${unfit.source?.kind === "sales_order" ? `: approve ${unfit.source.no} instead` : ""}`;
  return null;
}

// ---- dates -------------------------------------------------------------------------------

export const DEFAULT_VALIDITY_DAYS = 30; // matches the server's default

// "2026-10-06" + 30 days = "2026-11-05". Calendar arithmetic on the day itself, so the result is the
// same whatever time zone the browser is in (a Date built from local time would drift across a boundary).
export function addDaysToInput(ymd, days) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

// What a new quotation starts as.
export const newQuotationForm = (today = todayInput()) => ({
  transactionNo: "", partyId: "", partyType: "Customer", date: today, validUntil: addDaysToInput(today, DEFAULT_VALIDITY_DAYS),
  reference: "", terms: "", notes: "", discount: "0", charges: [], items: [],
});

// What a new delivery note starts as. The address, contact and LPO are filled from the customer on the server.
export const newDeliveryNoteForm = (today = todayInput()) => ({
  transactionNo: "", partyId: "", partyType: "Customer", date: today, reference: "", notes: "", discount: "0", charges: [], items: [],
  deliveryAddress: "", contactPerson: "", contactPhone: "", vehicleNo: "", driverName: "", driverPhone: "",
});
