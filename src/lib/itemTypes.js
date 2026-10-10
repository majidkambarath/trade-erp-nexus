// Goods and services: the rules the item screens share, without a component in sight.
//
// A service (consulting, delivery, installation, a monthly subscription) is an item with itemType "service". It is
// sold and bought like any other line but has no quantity on hand, no reorder level, no batch or expiry, no barcode
// and no cost of goods, and it never moves stock. A missing itemType is goods, so every item that existed before
// services needs nothing. The server enforces all of this (utils/itemKinds.js); these helpers only decide what to show.
//
// Pure: no React, no network.

export const GOODS = "goods";
export const SERVICE = "service";

export const ITEM_TYPES = [
  { value: GOODS, label: "Goods", hint: "Stocked: quantity on hand, reorder level, batches and expiry" },
  { value: SERVICE, label: "Service", hint: "Not stocked: consulting, delivery, installation, subscriptions" },
];

// `item` may be a stock row, an order line's stockDetails or a form: anything with an itemType.
export const isService = (item) => item?.itemType === SERVICE;
export const isStocked = (item) => !isService(item);
export const itemTypeLabel = (item) => (isService(item) ? "Service" : "Goods");

// How an item reads in an item picker: the type is shown, so nobody sells hours by the carton.
export const pickerLabel = (s) => `${s.itemId} - ${s.itemName}${isService(s) ? " (Service)" : ""}`;

// The "in stock" figure: a service has none, so it shows a dash, never a misleading 0.
export const stockLevelText = (item) => (isService(item) ? "—" : String(item?.currentStock ?? 0));

// ---- the item list -------------------------------------------------------------------------

// "" = everything, "goods", "service".
export const matchesType = (item, filter) => !filter || (filter === SERVICE ? isService(item) : isStocked(item));

// The figures above the list: low stock and stock value are about goods; services are counted apart.
export function itemStats(items) {
  const goods = (items || []).filter(isStocked);
  return {
    totalItems: (items || []).length,
    activeItems: (items || []).filter((i) => i.status === "Active").length,
    serviceItems: (items || []).filter(isService).length,
    lowStockItems: goods.filter((i) => (Number(i.currentStock) || 0) <= (Number(i.reorderLevel) || 0)).length,
    totalValue: goods.reduce((sum, i) => sum + ((Number(i.currentStock) || 0) * (Number(i.purchasePrice) || 0) || 0), 0),
  };
}

// ---- the item form ---------------------------------------------------------------------------

export const emptyItemForm = (itemType = GOODS) => ({
  itemType,
  sku: "", itemName: "", category: "", unitOfMeasure: "", barcodeQrCode: "",
  reorderLevel: "", batchNumber: "", expiryDate: "", purchasePrice: "", salesPrice: "", currentStock: "",
  status: "Active", vendorId: "", origin: "", brand: "",
  incomeAccountId: "", expenseAccountId: "",
});

// The form for a saved item. The account ids may arrive populated or as plain ids.
export function itemFormFromStock(item, { toInputDate = (d) => String(d).slice(0, 10) } = {}) {
  const idOf = (v) => (v && typeof v === "object" ? v._id || "" : v || "");
  return {
    itemType: isService(item) ? SERVICE : GOODS,
    sku: item.sku, itemName: item.itemName,
    category: item.category?._id || "",
    unitOfMeasure: idOf(item.unitOfMeasure),
    barcodeQrCode: item.barcodeQrCode || "",
    reorderLevel: String(item.reorderLevel ?? ""),
    batchNumber: item.batchNumber || "",
    expiryDate: item.expiryDate ? toInputDate(item.expiryDate) : "",
    purchasePrice: String(item.purchasePrice ?? ""),
    salesPrice: String(item.salesPrice ?? ""),
    currentStock: String(item.currentStock ?? ""),
    status: item.status,
    vendorId: item.vendorId?._id || "",
    origin: item.origin || "", brand: item.brand || "",
    incomeAccountId: idOf(item.incomeAccountId), expenseAccountId: idOf(item.expenseAccountId),
  };
}

// Switching the type in the form. A service drops what only goods have; going back does not bring it back.
export function switchItemType(form, itemType) {
  if (itemType !== SERVICE) return { ...form, itemType: GOODS, incomeAccountId: "", expenseAccountId: "" };
  return { ...form, itemType: SERVICE, currentStock: "", reorderLevel: "", batchNumber: "", expiryDate: "", barcodeQrCode: "", origin: "", brand: "" };
}

const isNegative = (v) => v !== "" && v !== undefined && v !== null && (Number.isNaN(Number(v)) || Number(v) < 0);

// Errors by field name. Origin and brand are required of goods (customs and labelling); a service has neither.
export function validateItemForm(form) {
  const errors = {};
  const service = isService(form);
  if (!String(form.itemName || "").trim()) errors.itemName = "Item name is required";
  if (!String(form.sku || "").trim()) errors.sku = "SKU is required";
  if (!form.category) errors.category = "Category is required";
  if (!form.unitOfMeasure) errors.unitOfMeasure = service ? "Unit is required (for example hour, job, month)" : "Unit of measure is required";
  if (!service) {
    if (!String(form.origin || "").trim()) errors.origin = "Origin is required";
    if (!String(form.brand || "").trim()) errors.brand = "Brand is required";
    if (isNegative(form.reorderLevel)) errors.reorderLevel = "Reorder level must be a valid positive number";
    if (isNegative(form.currentStock)) errors.currentStock = "Current stock must be a valid positive number";
  }
  if (isNegative(form.purchasePrice)) errors.purchasePrice = "Purchase price must be a valid positive number";
  if (isNegative(form.salesPrice)) errors.salesPrice = "Sales price must be a valid positive number";
  return errors;
}

// What the item API receives. A service sends no stock fields at all (the server refuses them), only its two
// optional accounts; goods send exactly what they always did.
export function buildItemPayload(form) {
  const base = {
    itemType: isService(form) ? SERVICE : GOODS,
    sku: form.sku,
    itemName: form.itemName,
    categoryId: form.category,
    unitOfMeasure: form.unitOfMeasure,
    purchasePrice: Number(form.purchasePrice) || 0,
    salesPrice: Number(form.salesPrice) || 0,
    status: form.status,
    vendorId: form.vendorId,
  };
  if (isService(form)) {
    return { ...base, incomeAccountId: form.incomeAccountId || null, expenseAccountId: form.expenseAccountId || null };
  }
  return {
    ...base,
    barcodeQrCode: form.barcodeQrCode,
    reorderLevel: Number(form.reorderLevel) || 0,
    batchNumber: form.batchNumber,
    expiryDate: form.expiryDate,
    currentStock: Number(form.currentStock) || 0,
    origin: form.origin,
    brand: form.brand,
  };
}

// ---- the order form's rows ---------------------------------------------------------------------

// A line for a service shows no stock on hand and gets no availability warning.
export const rowIsService = (row) => row?.itemType === SERVICE;

// The item ids of a document's lines that can run short of stock (a service never does).
export const stockedItemIds = (rows) => [...new Set((rows || []).filter((r) => r.itemId && !rowIsService(r)).map((r) => String(r.itemId)))].sort();
