// The four order documents as data. Everything that differs between Purchase Order, Sales
// Order, Purchase Return and Sales Return lives here; the form, grid and maths are shared.
//
// Field names are the ones each document has always stored, so saved records and the
// existing list screens keep working. Where a name is confusing (e.g. "Tax %" that the
// backend reads as vatPercent) the translation is written out in full next to it.

import { rowLine, documentTotals } from "./lineMath";
import { decimalRound } from "../../utils/format";

const num = (v) => parseFloat(v) || 0;
const CREATED_BY = "Current User";

// ---- columns ---------------------------------------------------------------------------
// kind: item | text | number  -> editable, reachable with the arrow keys
//       ro | money | remove   -> display only (remove is a button, still reachable)
const col = (key, label, kind, extra = {}) => ({ key, label, kind, ...extra });

const PURCHASE_COLUMNS = [
  col("itemId", "Item", "item", { min: "min-w-[240px]" }),
  col("description", "Description", "text", { min: "min-w-[180px]" }),
  col("brand", "Brand", "ro", { min: "min-w-[110px]" }),
  col("origin", "Origin", "ro", { min: "min-w-[110px]" }),
  col("qty", "Qty", "number", { min: "min-w-[84px]", align: "end" }),
  col("purchasePrice", "System price", "money", { min: "min-w-[120px]", align: "end" }),
  col("currentPurchasePrice", "Unit price", "number", { min: "min-w-[120px]", align: "end", money: true }),
  col("vatPercent", "VAT %", "number", { min: "min-w-[80px]", align: "end" }),
  col("total", "Net", "money", { min: "min-w-[110px]", align: "end" }),
  col("vatAmount", "VAT", "money", { min: "min-w-[100px]", align: "end" }),
  col("grandTotal", "Total", "money", { min: "min-w-[120px]", align: "end", strong: true }),
  col("_remove", "", "remove", { min: "w-12" }),
];

const SALES_COLUMNS = [
  col("itemId", "Item", "item", { min: "min-w-[240px]" }),
  col("description", "Description", "text", { min: "min-w-[180px]" }),
  col("purchasePrice", "Cost", "money", { min: "min-w-[110px]", align: "end" }),
  col("rate", "Unit price", "number", { min: "min-w-[120px]", align: "end", money: true }),
  col("qty", "Qty", "number", { min: "min-w-[84px]", align: "end" }),
  col("currentStock", "In stock", "ro", { min: "min-w-[90px]", align: "end" }),
  col("subtotal", "Net", "money", { min: "min-w-[110px]", align: "end" }),
  col("vatPercent", "VAT %", "number", { min: "min-w-[80px]", align: "end" }),
  col("vatAmount", "VAT", "money", { min: "min-w-[100px]", align: "end" }),
  col("lineTotal", "Total", "money", { min: "min-w-[120px]", align: "end", strong: true }),
  col("_remove", "", "remove", { min: "w-12" }),
];

// Sales return previously had no VAT or total columns at all, so a return could not be
// checked on screen before saving. They are restored here.
const SALES_RETURN_COLUMNS = [
  col("itemId", "Item", "item", { min: "min-w-[240px]" }),
  col("description", "Description", "text", { min: "min-w-[180px]" }),
  col("category", "Category", "ro", { min: "min-w-[120px]" }),
  col("salesPrice", "Price", "money", { min: "min-w-[110px]", align: "end" }),
  col("qty", "Qty", "number", { min: "min-w-[84px]", align: "end" }),
  col("rate", "Net", "money", { min: "min-w-[110px]", align: "end" }),
  col("taxPercent", "VAT %", "number", { min: "min-w-[80px]", align: "end" }),
  col("vatAmount", "VAT", "money", { min: "min-w-[100px]", align: "end" }),
  col("lineTotal", "Total", "money", { min: "min-w-[120px]", align: "end", strong: true }),
  col("_remove", "", "remove", { min: "w-12" }),
];

// ---- stock -> row hydration ------------------------------------------------------------
const hydratePurchase = (row, stock) => ({
  description: stock.itemName,
  brand: stock.brand || "",
  origin: stock.origin || "",
  vatPercent: String(stock.vatPercent ?? 5),
  // keep a price the user already typed; only fill an empty one from the stock record
  currentPurchasePrice:
    !row.currentPurchasePrice || num(row.currentPurchasePrice) === 0
      ? String(stock.purchasePrice || 0)
      : row.currentPurchasePrice,
  purchasePrice: stock.purchasePrice || 0,
});

const hydrateSales = (row, stock) => ({
  description: stock.itemName,
  rate: !row.rate || num(row.rate) === 0 ? String(stock.salesPrice || 0) : row.rate,
  purchasePrice: stock.purchasePrice || 0,
  currentStock: stock.currentStock ?? 0,
  vatPercent: String(stock.taxPercent ?? stock.vatPercent ?? 5),
});

const hydrateSalesReturn = (row, stock) => ({
  description: stock.itemName,
  category: stock.category?.name || "",
  salesPrice: String(stock.salesPrice || 0),
  taxPercent: String(stock.taxPercent ?? stock.vatPercent ?? 5),
  currentStock: stock.currentStock ?? 0,
});

// ---- line payloads ---------------------------------------------------------------------
// The backend recalculates every line from `price` (calculateItems), so `price` MUST be the
// unit price the user entered. The purchase return used to send the stock record's system
// price here, which silently overrode what was typed.
const itemPayload = (V, row, stock) => {
  const qty = num(row.qty);
  const unit = num(row[V.fields.unitPrice]);
  const vatPercent = num(row[V.fields.vatPercent]);
  const line = rowLine({ qty, price: unit, vatPercent });
  return {
    itemId: row.itemId,
    itemCode: row.itemCode || stock?.itemId || stock?.itemCode || "",
    description: row.description || "",
    qty,
    price: unit,
    rate: line.lineValue,
    vatPercent,
    vatAmount: line.vatAmount,
    lineTotal: line.lineTotal, // VAT-inclusive, as the backend contract requires
    grandTotal: line.lineTotal,
    brand: row.brand || "",
    origin: row.origin || "",
  };
};

const salesReturnItem = (row) => {
  const qty = Math.abs(num(row.qty));
  const price = num(row.salesPrice);
  const vatPercent = num(row.taxPercent);
  const line = rowLine({ qty, price, vatPercent });
  return {
    itemId: row.itemId,
    description: row.description,
    qty,
    price,
    rate: line.lineValue,
    vatPercent,
    vatAmount: line.vatAmount,
    lineTotal: line.lineTotal,
    category: row.category || "",
  };
};

// ---- the four documents ----------------------------------------------------------------
const PURCHASE_STATUS = (editing) => [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending approval" },
  ...(editing ? [{ value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }] : []),
];

const SALES_STATUS = (editing) => [
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  ...(editing ? [{ value: "INVOICED", label: "Invoiced" }] : []),
];

const SALES_RETURN_STATUS = (editing) => [
  { value: "DRAFT", label: "Draft" },
  { value: "CONFIRMED", label: "Confirmed" },
  ...(editing ? [{ value: "INVOICED", label: "Invoiced" }] : []),
];

const vendorPreview = (p) => [
  ["Code", p.vendorId],
  ["Address", p.address],
  ["Phone", p.phone],
  ["Email", p.email],
  ["VAT no.", p.vatNumber],
  ["Terms", p.paymentTerms],
];

const customerPreview = (p) => [
  ["Code", p.customerId],
  ["Billing address", p.billingAddress],
  ["Phone", p.phone],
  ["Email", p.email],
  ["TRN", p.trnNumber],
  ["Terms", p.paymentTerms],
];

const purchaseFields = { unitPrice: "currentPurchasePrice", lineValue: "total", vat: "vatAmount", gross: "grandTotal", vatPercent: "vatPercent" };

const purchaseLike = (docType, extra) => ({
  docType,
  partyType: "Vendor",
  party: { idKey: "vendorId", nameKey: "vendorName", idInDoc: "vendorId", nameInDoc: "vendorName" },
  labels: { partyNoun: "Vendor", selectParty: "Select vendor", secondDate: "Delivery date", reference: "Reference" },
  fields: purchaseFields,
  columns: PURCHASE_COLUMNS,
  rowTemplate: () => ({
    itemId: "", description: "", qty: "",
    purchasePrice: 0, currentPurchasePrice: "", vatPercent: "5",
    brand: "", origin: "", total: "0.00", vatAmount: "0.00", grandTotal: "0.00",
  }),
  hydrate: hydratePurchase,
  statusOptions: PURCHASE_STATUS,
  preview: vendorPreview,
  itemPayload: (row, stock) => ({ ...itemPayload({ fields: purchaseFields }, row, stock), currentPurchasePrice: num(row.currentPurchasePrice) }),
  totals: (rows) => documentTotals(rows, (r) => num(r.currentPurchasePrice), (r) => num(r.vatPercent)),
  ...extra,
});

export const VARIANTS = {
  purchase: purchaseLike("purchase_order", {
    key: "purchase",
    noun: "Purchase order",
    title: { create: "Create purchase order", edit: "Edit purchase order", save: "Save PO", saveEdit: "Update PO", items: "Purchase items" },
    labels: { doc: "PO number", partyNoun: "Vendor", selectParty: "Select vendor", secondDate: "Delivery date", reference: "Reference" },
    referenceRequired: false,
    hasSecondDate: true,
    priority: false,
    sourceDocument: null,
    discount: false,
    numberMode: false,
    payloadHeader: (f) => ({ vendorReference: f.vendorReference || "", terms: f.terms || "", priority: f.priority || "Medium" }),
    totalAmount: (t) => t.total,
  }),

  purchaseReturn: purchaseLike("purchase_return", {
    key: "purchaseReturn",
    noun: "Purchase return",
    title: { create: "Create purchase return", edit: "Edit purchase return", save: "Save return", saveEdit: "Update return", items: "Returned items" },
    labels: { doc: "Return number", partyNoun: "Vendor", selectParty: "Select vendor", secondDate: "Return date", reference: "Vendor reference" },
    referenceRequired: true,
    hasSecondDate: true,
    priority: false,
    // Returns are usually raised against an approved purchase order; picking one prefills it.
    sourceDocument: { label: "Return against purchase order", fetchStatus: "APPROVED" },
    discount: false,
    numberMode: false,
    payloadHeader: (f) => ({ vendorReference: f.vendorReference || "", terms: f.terms || "", priority: f.priority || "Medium" }),
    totalAmount: (t) => t.total,
  }),

  sales: {
    key: "sales",
    noun: "Sales order",
    docType: "sales_order",
    partyType: "Customer",
    party: { idKey: "customerId", nameKey: "customerName", idInDoc: "customerId", nameInDoc: "customerName" },
    labels: { doc: "SO number", partyNoun: "Customer", selectParty: "Select customer", secondDate: "Delivery date", reference: "LPO no." },
    title: { create: "Create sales order", edit: "Edit sales order", save: "Save SO", saveEdit: "Update SO", items: "Sales items" },
    fields: { unitPrice: "rate", lineValue: "subtotal", vat: "vatAmount", gross: "lineTotal", vatPercent: "vatPercent" },
    columns: SALES_COLUMNS,
    rowTemplate: () => ({
      itemId: "", description: "", qty: "", rate: "", purchasePrice: 0, currentStock: 0,
      vatPercent: "5", subtotal: "0.00", vatAmount: "0.00", lineTotal: "0.00",
    }),
    hydrate: hydrateSales,
    statusOptions: SALES_STATUS,
    preview: customerPreview,
    itemPayload: (row, stock) => ({ ...itemPayload({ fields: { unitPrice: "rate", vatPercent: "vatPercent" } }, row, stock), salesPrice: num(row.rate) }),
    totals: (rows) => documentTotals(rows, (r) => num(r.rate), (r) => num(r.vatPercent)),
    referenceRequired: false,
    hasSecondDate: true,
    priority: false,
    sourceDocument: null,
    discount: true,
    numberMode: true,
    // The sales page has always sent these two reference numbers under short backend keys.
    payloadHeader: (f) => ({ lpono: f.refNo || "", docno: f.docNo || "", discount: num(f.discount) }),
    totalAmount: (t, f) => decimalRound(Math.max(0, num(t.total) - num(f.discount))),
  },

  salesReturn: {
    key: "salesReturn",
    noun: "Sales return",
    docType: "sales_return",
    partyType: "Customer",
    party: { idKey: "customerId", nameKey: "customerName", idInDoc: "customerId", nameInDoc: "customerName" },
    labels: { doc: "Return number", partyNoun: "Customer", selectParty: "Select customer", secondDate: "Return date", reference: null },
    title: { create: "Create sales return", edit: "Edit sales return", save: "Save return", saveEdit: "Update return", items: "Returned items" },
    fields: { unitPrice: "salesPrice", lineValue: "rate", vat: "vatAmount", gross: "lineTotal", vatPercent: "taxPercent" },
    columns: SALES_RETURN_COLUMNS,
    rowTemplate: () => ({
      itemId: "", description: "", category: "", salesPrice: "0", qty: "",
      rate: "0.00", taxPercent: "5", vatAmount: "0.00", lineTotal: "0.00", currentStock: 0,
    }),
    hydrate: hydrateSalesReturn,
    statusOptions: SALES_RETURN_STATUS,
    preview: customerPreview,
    itemPayload: (row) => salesReturnItem(row),
    totals: (rows) => documentTotals(rows, (r) => num(r.salesPrice), (r) => num(r.taxPercent)),
    referenceRequired: false,
    hasSecondDate: true,
    priority: true,
    sourceDocument: null,
    discount: false,
    numberMode: false,
    payloadHeader: (f) => ({ terms: f.terms || "", priority: f.priority || "Medium" }),
    totalAmount: (t) => t.total,
  },
};

// Per-document payload: the one place a saved record's top-level shape is decided.
export const buildPayload = (V, f, rows, stockById, { linkedRef } = {}) => {
  const items = rows
    .filter((r) => r.itemId && num(r.qty) > 0)
    .map((r) => V.itemPayload(r, stockById.get(String(r.itemId))));
  const totals = V.totals(rows);
  const payload = {
    transactionNo: f.transactionNo,
    type: V.docType,
    partyType: V.partyType,
    partyId: f.partyId,
    date: f.date,
    deliveryDate: f.deliveryDate,
    status: f.status,
    notes: f.notes || "",
    createdBy: CREATED_BY,
    totalAmount: num(V.totalAmount(totals, f)),
    items,
    ...V.payloadHeader(f),
  };
  if (linkedRef !== undefined) payload.linkedRef = linkedRef || null;
  return payload;
};

export { salesReturnItem, itemPayload };
