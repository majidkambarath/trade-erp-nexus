// The four order documents as data. Everything that differs between Purchase Order, Sales
// Order, Purchase Return and Sales Return lives here; the form, grid and maths are shared.
//
// Field names are the ones each document has always stored, so saved records and the
// existing list screens keep working. Where a name is confusing (e.g. "Tax %" that the
// backend reads as vatPercent) the translation is written out in full next to it.

import { rowLine, documentTotals, chargesTotals } from "./lineMath";
import { decimalRound } from "../../utils/format";

const num = (v) => parseFloat(v) || 0;
const CREATED_BY = "Current User";

// ---- columns ---------------------------------------------------------------------------
// kind: item | text | number | select | date -> editable, reachable with the arrow keys
//       ro | money | remove                    -> display only (remove is a button, still reachable)
const col = (key, label, kind, extra = {}) => ({ key, label, kind, ...extra });

// Every document: a discount on the line, and the tax treatment. The server prices the document;
// the form only previews it.
const DISCOUNT_COL = col("discountPercent", "Disc %", "number", { min: "min-w-[80px]", align: "end" });
const TAXCODE_COL = col("taxCodeId", "Tax code", "select", { min: "min-w-[150px]" });
// Purchases record which delivery a line belongs to, so stock can be sold first-expiry-first-out.
const BATCH_COL = col("batchNumber", "Batch", "text", { min: "min-w-[110px]" });
const EXPIRY_COL = col("expiryDate", "Expiry", "date", { min: "min-w-[150px]" });
// A return against an invoice shows how much of each line can still be returned.
const MAXQTY_COL = col("maxQty", "Can return", "ro", { min: "min-w-[90px]", align: "end" });

const PURCHASE_COLUMNS = [
  col("itemId", "Item", "item", { min: "min-w-[240px]" }),
  col("description", "Description", "text", { min: "min-w-[180px]" }),
  col("brand", "Brand", "ro", { min: "min-w-[110px]" }),
  col("origin", "Origin", "ro", { min: "min-w-[110px]" }),
  BATCH_COL,
  EXPIRY_COL,
  col("qty", "Qty", "number", { min: "min-w-[84px]", align: "end" }),
  col("purchasePrice", "System price", "money", { min: "min-w-[120px]", align: "end" }),
  col("currentPurchasePrice", "Unit price", "number", { min: "min-w-[120px]", align: "end", money: true }),
  DISCOUNT_COL,
  col("total", "Net", "money", { min: "min-w-[110px]", align: "end" }),
  TAXCODE_COL,
  col("vatPercent", "VAT %", "number", { min: "min-w-[80px]", align: "end" }),
  col("vatAmount", "VAT", "money", { min: "min-w-[100px]", align: "end" }),
  col("grandTotal", "Total", "money", { min: "min-w-[120px]", align: "end", strong: true }),
  col("_remove", "", "remove", { min: "w-12" }),
];

// Returned goods keep no batch of their own on the form; the batch is whatever it was received in.
const PURCHASE_RETURN_COLUMNS = [
  ...PURCHASE_COLUMNS.filter((c) => c !== BATCH_COL && c !== EXPIRY_COL).flatMap((c) =>
    c.key === "qty" ? [c, MAXQTY_COL] : [c]
  ),
];

const SALES_COLUMNS = [
  col("itemId", "Item", "item", { min: "min-w-[240px]" }),
  col("description", "Description", "text", { min: "min-w-[180px]" }),
  col("purchasePrice", "Cost", "money", { min: "min-w-[110px]", align: "end" }),
  col("rate", "Unit price", "number", { min: "min-w-[120px]", align: "end", money: true }),
  col("qty", "Qty", "number", { min: "min-w-[84px]", align: "end" }),
  col("currentStock", "In stock", "ro", { min: "min-w-[90px]", align: "end" }),
  DISCOUNT_COL,
  col("subtotal", "Net", "money", { min: "min-w-[110px]", align: "end" }),
  TAXCODE_COL,
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
  MAXQTY_COL,
  DISCOUNT_COL,
  col("rate", "Net", "money", { min: "min-w-[110px]", align: "end" }),
  TAXCODE_COL,
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

// Recompute the three display totals of a row from its own inputs. Field names come from the
// variant, so the same code serves purchase ("total") and sales ("subtotal") lines.
export const recalcRow = (V, row) => {
  const F = V.fields;
  const l = rowLine({ qty: row.qty, price: row[F.unitPrice], vatPercent: row[F.vatPercent], discountPercent: row.discountPercent });
  return {
    ...row,
    [F.lineValue]: l.lineValue.toFixed(2),
    [F.vat]: l.vatAmount.toFixed(2),
    [F.gross]: l.lineTotal.toFixed(2),
  };
};

// ---- line payloads ---------------------------------------------------------------------
// The fields every line sends beyond price, quantity and VAT. Empty values are omitted so a line
// that does not use them is identical to what it always was.
const extras = (row) => {
  const out = {};
  const discount = num(row.discountPercent);
  if (discount > 0) out.discountPercent = Math.min(100, discount);
  if (row.taxCodeId) out.taxCodeId = row.taxCodeId;
  if (row.batchNumber) out.batchNumber = String(row.batchNumber).trim();
  if (row.expiryDate) out.expiryDate = row.expiryDate;
  if (row.returnOfLineId) out.returnOfLineId = row.returnOfLineId;
  return out;
};

// The backend recalculates every line from `price` (calculateItems), so `price` MUST be the
// unit price the user entered. The purchase return used to send the stock record's system
// price here, which silently overrode what was typed.
const itemPayload = (V, row, stock) => {
  const qty = num(row.qty);
  const unit = num(row[V.fields.unitPrice]);
  const vatPercent = num(row[V.fields.vatPercent]);
  const line = rowLine({ qty, price: unit, vatPercent, discountPercent: row.discountPercent });
  return {
    ...(row.lineId ? { _id: row.lineId } : {}),
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
    ...extras(row),
  };
};

const salesReturnItem = (row) => {
  const qty = Math.abs(num(row.qty));
  const price = num(row.salesPrice);
  const vatPercent = num(row.taxPercent);
  const line = rowLine({ qty, price, vatPercent, discountPercent: row.discountPercent });
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
    ...extras(row),
  };
};

// ---- saved line -> form row ------------------------------------------------------------
// Editing a saved document rebuilds its rows from the stored line. The unit price is the stored
// `price`: older records only have `rate`, which is the line VALUE, so it is divided by quantity.
// Doing this in one place (rather than in each page) is what keeps a discount, a tax code or a
// batch from being lost the moment a document is opened for editing.
const unitOf = (i) => {
  if (i.price != null && i.price !== "") return num(i.price);
  return num(i.qty) ? num(i.rate) / num(i.qty) : 0;
};
const savedBase = (i) => ({
  // the stored line's own id, sent back on save so a delivery note raised against the line stays attached to it
  lineId: i._id || "",
  itemId: i.itemId?._id || i.itemId,
  itemCode: i.itemCode || "",
  description: i.description || "",
  qty: String(i.qty ?? ""),
  discountPercent: i.discountPercent ? String(i.discountPercent) : "",
  taxCodeId: i.taxCodeId || "",
  batchNumber: i.batchNumber || "",
  expiryDate: i.expiryDate ? String(i.expiryDate).slice(0, 10) : "",
  returnOfLineId: i.returnOfLineId || "",
  maxQty: "",
  brand: i.brand || "",
  origin: i.origin || "",
});

const purchaseRowFromSaved = (i) => ({
  ...savedBase(i),
  currentPurchasePrice: String(unitOf(i)),
  purchasePrice: i.purchasePrice ?? 0,
  vatPercent: String(i.vatPercent ?? 5),
  total: "0.00", vatAmount: "0.00", grandTotal: "0.00",
});
const salesRowFromSaved = (i) => ({
  ...savedBase(i),
  rate: String(unitOf(i)),
  purchasePrice: i.purchasePrice ?? 0,
  currentStock: i.currentStock ?? 0,
  vatPercent: String(i.vatPercent ?? 5),
  subtotal: "0.00", vatAmount: "0.00", lineTotal: "0.00",
});
const salesReturnRowFromSaved = (i) => ({
  ...savedBase(i),
  category: i.category || "",
  salesPrice: String(unitOf(i)),
  taxPercent: String(i.vatPercent ?? 5),
  currentStock: i.currentStock ?? 0,
  rate: "0.00", vatAmount: "0.00", lineTotal: "0.00",
});

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
    discountPercent: "", taxCodeId: "", batchNumber: "", expiryDate: "", returnOfLineId: "", maxQty: "",
    brand: "", origin: "", total: "0.00", vatAmount: "0.00", grandTotal: "0.00",
  }),
  hydrate: hydratePurchase,
  statusOptions: PURCHASE_STATUS,
  preview: vendorPreview,
  itemPayload: (row, stock) => ({ ...itemPayload({ fields: purchaseFields }, row, stock), currentPurchasePrice: num(row.currentPurchasePrice) }),
  totals: (rows) => documentTotals(rows, (r) => num(r.currentPurchasePrice), (r) => num(r.vatPercent)),
  rowFromSaved: purchaseRowFromSaved,
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
    columns: PURCHASE_RETURN_COLUMNS,
    referenceRequired: true,
    hasSecondDate: true,
    priority: false,
    // A return is raised against an approved purchase order. Choosing one fills in the lines with
    // what can still be returned, and the server will not accept more than that.
    sourceDocument: { label: "Return against purchase order", fetchStatus: "APPROVED", docType: "purchase_order" },
    // price and VAT for a line prefilled from the original
    fromReturnLine: (l) => ({ currentPurchasePrice: String(l.price ?? 0), vatPercent: String(l.vatPercent ?? 5), purchasePrice: l.price ?? 0 }),
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
      vatPercent: "5", discountPercent: "", taxCodeId: "", returnOfLineId: "", maxQty: "",
      subtotal: "0.00", vatAmount: "0.00", lineTotal: "0.00",
    }),
    hydrate: hydrateSales,
    statusOptions: SALES_STATUS,
    preview: customerPreview,
    itemPayload: (row, stock) => ({ ...itemPayload({ fields: { unitPrice: "rate", vatPercent: "vatPercent" } }, row, stock), salesPrice: num(row.rate) }),
    totals: (rows) => documentTotals(rows, (r) => num(r.rate), (r) => num(r.vatPercent)),
    rowFromSaved: salesRowFromSaved,
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
      discountPercent: "", taxCodeId: "", returnOfLineId: "", maxQty: "",
      rate: "0.00", taxPercent: "5", vatAmount: "0.00", lineTotal: "0.00", currentStock: 0,
    }),
    hydrate: hydrateSalesReturn,
    statusOptions: SALES_RETURN_STATUS,
    preview: customerPreview,
    itemPayload: (row) => salesReturnItem(row),
    totals: (rows) => documentTotals(rows, (r) => num(r.salesPrice), (r) => num(r.taxPercent)),
    rowFromSaved: salesReturnRowFromSaved,
    referenceRequired: false,
    hasSecondDate: true,
    priority: true,
    sourceDocument: { label: "Return against sales invoice", fetchStatus: "APPROVED", docType: "sales_order" },
    fromReturnLine: (l) => ({ salesPrice: String(l.price ?? 0), taxPercent: String(l.vatPercent ?? 5) }),
    discount: false,
    numberMode: false,
    payloadHeader: (f) => ({ terms: f.terms || "", priority: f.priority || "Medium" }),
    totalAmount: (t) => t.total,
  },
};

// A form row for a line prefilled from the document being returned (see /accounting/returnable).
export const rowFromReturnLine = (V, line) =>
  recalcRow(V, {
    ...V.rowTemplate(),
    itemId: line.itemId,
    itemCode: line.itemCode || "",
    description: line.description || "",
    qty: String(line.remainingQty),
    maxQty: String(line.remainingQty),
    returnOfLineId: line.lineId,
    discountPercent: line.discountPercent ? String(line.discountPercent) : "",
    ...V.fromReturnLine(line),
  });

// Header charges as the form keeps them -> as the server takes them.
export const chargesPayload = (charges = []) =>
  charges
    .filter((c) => num(c.amount) > 0)
    .map((c) => ({ code: c.code || undefined, description: (c.description || "").trim() || "Charge", amount: num(c.amount), vatPercent: num(c.vatPercent) }));

// Per-document payload: the one place a saved record's top-level shape is decided.
export const buildPayload = (V, f, rows, stockById, { linkedRef, charges } = {}) => {
  // A document that is not a Transaction (a quotation, a delivery note) shapes its own payload.
  if (V.buildPayload) return V.buildPayload(V, f, rows, stockById, { linkedRef, charges });
  const items = rows
    .filter((r) => r.itemId && num(r.qty) > 0)
    .map((r) => V.itemPayload(r, stockById.get(String(r.itemId))));
  const totals = V.totals(rows);
  const headerCharges = chargesPayload(charges ?? f.charges);
  const chargesTotal = chargesTotals(headerCharges).total;
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
    // lines (after discounts) + their VAT - document discount + charges with their VAT
    totalAmount: decimalRound(num(V.totalAmount(totals, f)) + chargesTotal),
    items,
    ...V.payloadHeader(f),
  };
  if (headerCharges.length) payload.charges = headerCharges;
  if (linkedRef !== undefined) payload.linkedRef = linkedRef || null;
  // A return names the document it returns; the server checks quantities and values against it.
  if (V.sourceDocument && linkedRef) payload.returnOf = { transactionId: linkedRef };
  return payload;
};

// ---- quotation and delivery note -------------------------------------------------------
// Neither is a Transaction: each has its own endpoint, and the SERVER prices it (the same code that
// prices the invoice it can become), so the payload carries inputs only - no totals, no status, no type.
// They reuse the sales order's grid and maths, and they are added here, after the helpers they use.

// A line as an input: what was asked for, never what the form worked out. `price` is the unit price.
const pricedLineInput = (row) => {
  const out = {
    itemId: row.itemId,
    itemCode: row.itemCode || "",
    description: row.description || "",
    qty: num(row.qty),
    price: num(row.rate),
    vatPercent: num(row.vatPercent),
  };
  const discount = num(row.discountPercent);
  if (discount > 0) out.discountPercent = Math.min(100, discount);
  if (row.taxCodeId) out.taxCodeId = row.taxCodeId;
  return out;
};

// `charges` is always sent, even empty, so removing the last charge on an edit actually removes it.
const pricedPayload = (header) => (V, f, rows, _stock, { charges } = {}) => ({
  partyId: f.partyId,
  date: f.date,
  items: rows.filter((r) => r.itemId && num(r.qty) > 0).map(pricedLineInput),
  charges: chargesPayload(charges ?? f.charges),
  discount: num(f.discount),
  notes: f.notes || "",
  ...header(f),
});

// A saved line carries its stock details alongside it (the server joins them), and that is where "in stock" is.
const withStock = (i) => ({ ...salesRowFromSaved(i), currentStock: i.stockDetails?.currentStock ?? i.currentStock ?? 0 });

const customerSide = {
  partyType: "Customer",
  party: { idKey: "customerId", nameKey: "customerName", idInDoc: "customerId", nameInDoc: "customerName" },
  preview: customerPreview,
  fields: { unitPrice: "rate", lineValue: "subtotal", vat: "vatAmount", gross: "lineTotal", vatPercent: "vatPercent" },
  columns: SALES_COLUMNS,
  rowTemplate: () => VARIANTS.sales.rowTemplate(),
  hydrate: hydrateSales,
  totals: (rows) => documentTotals(rows, (r) => num(r.rate), (r) => num(r.vatPercent)),
  rowFromSaved: withStock,
  totalAmount: (t, f) => decimalRound(Math.max(0, num(t.total) - num(f.discount))),
  discount: true,
  numberMode: false,
  referenceRequired: false,
  priority: false,
  sourceDocument: null,
  attachments: false,
  statusOptions: null,
};

// An offer. Valid until a date, with terms that print on it; the number is assigned on save.
VARIANTS.quotation = {
  ...customerSide,
  key: "quotation",
  noun: "Quotation",
  endpoint: "/quotations",
  numberField: "quotationNo",
  labels: { doc: "Quotation no.", partyNoun: "Customer", selectParty: "Select customer", secondDate: "Valid until", reference: "Customer reference" },
  title: { create: "Create quotation", edit: "Edit quotation", save: "Save quotation", saveEdit: "Update quotation", items: "Quoted items" },
  referenceKey: "reference",
  hasSecondDate: true,
  secondDateKey: "validUntil",
  secondDateRequired: true,
  terms: true,
  buildPayload: pricedPayload((f) => ({ validUntil: f.validUntil, reference: f.reference || "", terms: f.terms || "" })),
};

// The goods go first and are invoiced after. Who carries them and where to is on the note.
const DELIVERY_FIELDS = [
  { key: "deliveryAddress", label: "Delivery address", type: "textarea", span: 2 },
  { key: "contactPerson", label: "Contact person" },
  { key: "contactPhone", label: "Contact phone" },
  { key: "vehicleNo", label: "Vehicle" },
  { key: "driverName", label: "Driver" },
  { key: "driverPhone", label: "Driver phone" },
];

VARIANTS.deliveryNote = {
  ...customerSide,
  key: "deliveryNote",
  noun: "Delivery note",
  endpoint: "/delivery-notes",
  numberField: "deliveryNoteNo",
  labels: { doc: "Delivery note no.", partyNoun: "Customer", selectParty: "Select customer", secondDate: null, reference: "Customer LPO" },
  title: { create: "Create delivery note", edit: "Edit delivery note", save: "Save delivery note", saveEdit: "Update delivery note", items: "Items to deliver" },
  referenceKey: "reference",
  hasSecondDate: false,
  terms: false,
  extraFields: DELIVERY_FIELDS,
  // The note moves no stock, so ask the server what is really free before promising it.
  checkAvailability: true,
  buildPayload: pricedPayload((f) => ({
    reference: f.reference || "",
    ...Object.fromEntries(DELIVERY_FIELDS.map((d) => [d.key, f[d.key] || ""])),
  })),
};

export { salesReturnItem, itemPayload, DELIVERY_FIELDS };
