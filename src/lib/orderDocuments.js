// Orders and goods received: what the screens say and check, with no React in it so the rules are tested without
// rendering. The server decides everything that matters (which action the document's state allows, what is left to
// receive, what may be invoiced); these helpers only word it and catch a mistake before the request.

import { todayInput } from "../utils/format";

const num = (v) => parseFloat(v) || 0;
const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

// ---- who may do what ----------------------------------------------------------------------
// The server says which actions the document's STATE allows (actions.confirm, actions.receive...); this narrows that to
// what the person's ROLE may do. (The server refuses them either way.) An order belongs to sales or to purchase.
const ORDER_PERMISSION = { edit: "edit", delete: "delete", confirm: "approve", cancel: "approve", close: "approve", reopen: "approve", receive: "create", invoice: "approve" };
export function allowOrderActions(actions, me, kind) {
  const module = kind === "sales" ? "sales" : "purchase";
  return Object.fromEntries(
    Object.entries(actions || {}).map(([name, on]) => {
      const need = ORDER_PERMISSION[name] ? `${module}.${ORDER_PERMISSION[name]}` : null;
      return [name, Boolean(on) && (!need || !Array.isArray(me?.grants) || me.grants.includes(need))];
    })
  );
}

const RECEIPT_PERMISSION = { edit: "purchase.edit", delete: "purchase.delete", receive: "purchase.approve", cancel: "purchase.approve", invoice: "purchase.approve" };
export function allowReceiptActions(actions, me) {
  return Object.fromEntries(
    Object.entries(actions || {}).map(([name, on]) => [name, Boolean(on) && (!RECEIPT_PERMISSION[name] || !Array.isArray(me?.grants) || me.grants.includes(RECEIPT_PERMISSION[name]))])
  );
}

// ---- words ----------------------------------------------------------------------------------
export const ORDER_STATUS_LABEL = { DRAFT: "Draft", CONFIRMED: "Confirmed", CLOSED: "Closed", CANCELLED: "Cancelled" };
export const RECEIPT_STATUS_LABEL = { DRAFT: "Draft", RECEIVED: "Received", CANCELLED: "Cancelled" };
export const orderStatusLabel = (s) => ORDER_STATUS_LABEL[s] || s || "";
export const receiptStatusLabel = (s) => RECEIPT_STATUS_LABEL[s] || s || "";

// [value sent to the server, label]
export const ORDER_TABS = [["", "All"], ["DRAFT", "Draft"], ["CONFIRMED", "Confirmed"], ["CLOSED", "Closed"], ["CANCELLED", "Cancelled"]];
export const RECEIPT_TABS = [["", "All"], ["DRAFT", "Draft"], ["RECEIVED", "Received"], ["UNINVOICED", "Not invoiced"], ["CANCELLED", "Cancelled"]];

// What an order's progress reads as, with the tone a pill takes.
export function progressTone(label) {
  if (label === "Invoiced") return "success";
  if (/^Partly invoiced/.test(label) || /^Fully/.test(label)) return "info";
  if (/^Partly/.test(label)) return "warning";
  return "neutral";
}

// ---- invoicing received goods -------------------------------------------------------------
// Why the chosen receipts cannot go on one invoice, or null. The server checks the same and says it in its own words.
export function receiptInvoiceBlocker(receipts) {
  if (!receipts.length) return "Choose the goods received to invoice";
  if (new Set(receipts.map((r) => String(r.partyId))).size > 1) return "Goods received from different vendors cannot go on one invoice";
  const bad = receipts.find((r) => !r.actions?.invoice);
  if (bad) return `${bad.receiptNo} cannot be invoiced from here`;
  return null;
}

// ---- receiving -------------------------------------------------------------------------------
// The confirm dialog: one row per line, starting at what was expected. `received` is the person's figure as typed.
export function receiveRows(receipt) {
  return (receipt?.items || []).map((l) => ({
    lineId: l._id, description: l.description, itemCode: l.itemCode || "", expected: l.qty,
    received: String(l.receivedQty ?? l.qty), shortReason: l.shortReason || "",
    batchNumber: l.batchNumber || "", expiryDate: l.expiryDate ? String(l.expiryDate).slice(0, 10) : "",
  }));
}

export function validateReceive(rows, header) {
  const errors = {};
  if (!String(header.receivedBy || "").trim()) errors.receivedBy = "Enter the name of the person who took the goods in";
  rows.forEach((r, i) => {
    const q = Number(r.received);
    if (r.received === "" || !Number.isFinite(q) || q < 0) errors[i] = "Enter zero or more";
    else if (round3(q) > r.expected) errors[i] = `More than the ${r.expected} expected`;
    else if (round3(r.expected - q) > 0 && !String(r.shortReason || "").trim()) errors[i] = `Say why ${round3(r.expected - q)} did not arrive`;
  });
  if (rows.length && rows.every((r) => num(r.received) === 0)) errors.none = "Nothing was received. Cancel the receipt instead.";
  return Object.keys(errors).length ? errors : null;
}

export function receivePayload(rows, header) {
  return {
    receivedBy: String(header.receivedBy || "").trim(),
    receivedAt: header.receivedAt || todayInput(),
    vendorDeliveryNo: header.vendorDeliveryNo || "",
    proofNote: header.proofNote || "",
    lines: rows.map((r) => ({
      lineId: r.lineId, receivedQty: num(r.received), shortReason: round3(r.expected - num(r.received)) > 0 ? r.shortReason : "",
      batchNumber: r.batchNumber || "", expiryDate: r.expiryDate || null,
    })),
  };
}

// ---- forms -------------------------------------------------------------------------------------
export const newOrderForm = (kind) => ({
  transactionNo: "", partyId: "", partyType: kind === "sales" ? "Customer" : "Vendor", date: todayInput(), expectedDate: "",
  reference: "", terms: "", notes: "", discount: "0", charges: [],
  items: [],
});
export const newReceiptForm = () => ({
  transactionNo: "", partyId: "", partyType: "Vendor", date: todayInput(), reference: "", vendorDeliveryNo: "", vehicleNo: "", driverName: "",
  notes: "", discount: "0", charges: [], items: [],
});
