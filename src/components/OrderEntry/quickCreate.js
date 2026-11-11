import { isValidTrn, normalizeTrn, taxIdRule } from "../../lib/partyForms";
import { taxWord } from "../../lib/taxTerms";

// Create a master record from inside an order without leaving the page.
//
// Each spec names the fields the backend requires (taken from the validation on each
// management page) and builds the same payload that page sends. Keeping the rules here,
// as pure functions, means the order form and the management screens cannot disagree.

// SKU rule from StockManagement: a two-letter prefix from the category name, then the next
// number after the highest existing SKU with that prefix, zero-padded to four digits.
export const nextSku = (categoryName, existingSkus = []) => {
  const prefix = (categoryName || "")
    .substring(0, 2)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  let max = 0;
  for (const sku of existingSkus) {
    if (typeof sku !== "string" || !sku.startsWith(prefix)) continue;
    const n = parseInt(sku.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
};

const text = (v) => (v == null ? "" : String(v).trim());

// A walk-in pays on the day. Without this the payload sent "" and the server fell through to its
// own Net 30 / 30 days default, so a party quick-added from an order silently carried a month's
// credit into its first due date and ageing bucket. Editable afterwards on the master screen.
const QUICK_TERMS = "Cash";

// The tax number is asked for only when the box is ticked, and its wording follows the
// organisation's country (TRN in the UAE, GSTIN in India) through the same rule the master form
// uses - so a quick-added party is registered exactly as one added on the Customers screen.
const vatFields = () => [
  { name: "vatRegistered", get label() { return `${taxWord()} registered`; }, checkbox: true },
  {
    name: "trn",
    get label() { return taxIdRule().label; },
    when: (v) => Boolean(v.vatRegistered),
    required: (v) => Boolean(v.vatRegistered),
    get hint() { return taxIdRule().message; },
  },
];

// Sent inside `vat`, never as a top-level trnNumber/trnNO: the create services take an explicit
// whitelist and would drop an unknown key, while PartyMasterService.prepare reads `vat` and writes
// both it and the legacy field. An unticked box is exactly what was sent before.
const vatPayload = (v) =>
  v.vatRegistered
    ? { vat: { status: "registered", trn: normalizeTrn(v.trn) } }
    : { vat: { status: "unregistered", trn: "" } };

// The measure types the unit of measure screen accepts (UnitOfMeasure model enum).
export const MEASURE_TYPES = ["Weight", "Volume", "Quantity", "Packaging", "Length", "Area"];

export const QUICK_CREATE = {
  vendor: {
    title: "New vendor",
    endpoint: "/vendors/vendors",
    fields: [
      { name: "vendorName", label: "Vendor name", required: true },
      { name: "contactPerson", label: "Contact person", required: true },
      { name: "address", label: "Address", required: true, multiline: true },
      ...vatFields(),
    ],
    payload: (v) => ({
      vendorName: text(v.vendorName),
      contactPerson: text(v.contactPerson),
      address: text(v.address),
      phone: "",
      email: "",
      paymentTerms: QUICK_TERMS,
      status: "Compliant",
      ...vatPayload(v),
    }),
    // The created record has to be selectable straight away.
    labelOf: (r) => `${r.vendorId} - ${r.vendorName}`,
    idOf: (r) => r._id,
  },

  customer: {
    title: "New customer",
    endpoint: "/customers",
    fields: [
      { name: "customerName", label: "Customer name", required: true },
      { name: "contactPerson", label: "Contact person", required: true },
      { name: "billingAddress", label: "Billing address", required: true, multiline: true },
      ...vatFields(),
    ],
    // contactPerson and phone are trimmed by the backend route; they must never be undefined.
    payload: (v) => ({
      customerName: text(v.customerName),
      contactPerson: text(v.contactPerson),
      billingAddress: text(v.billingAddress),
      shippingAddress: "",
      email: "",
      phone: "",
      creditLimit: 0,
      paymentTerms: QUICK_TERMS,
      status: "Active",
      salesPerson: null,
      ...vatPayload(v),
    }),
    labelOf: (r) => `${r.customerId} - ${r.customerName}`,
    idOf: (r) => r._id,
  },

  category: {
    title: "New category",
    endpoint: "/categories/categories",
    fields: [{ name: "name", label: "Category name", required: true }],
    payload: (v) => ({ name: text(v.name), description: text(v.name), status: "Active" }),
    labelOf: (r) => r.name,
    idOf: (r) => r._id,
  },

  unit: {
    title: "New unit of measure",
    endpoint: "/uom/units",
    fields: [
      { name: "unitName", label: "Unit name", required: true },
      { name: "shortCode", label: "Short code", required: true },
      { name: "category", label: "Measure type", required: true, select: "measureTypes" },
    ],
    // The backend requires a measure type; the unit screen always saves a Base unit.
    payload: (v) => ({
      unitName: text(v.unitName),
      shortCode: text(v.shortCode),
      category: v.category,
      type: "Base",
      status: "Active",
    }),
    labelOf: (r) => `${r.unitName} (${r.shortCode})`,
    idOf: (r) => r._id,
  },

  stockItem: {
    title: "New stock item",
    endpoint: "/stock/stock",
    fields: [
      { name: "itemName", label: "Item name", required: true },
      // a service (consulting, delivery, installation) is not stocked; it can be created from an invoice line too
      { name: "itemType", label: "Item type", select: "itemTypes", noNew: true },
      { name: "category", label: "Category", required: true, select: "categories" },
      { name: "unitOfMeasure", label: "Unit of measure", required: true, select: "units" },
      // origin and brand are customs and labelling details of goods; a service has neither
      { name: "origin", label: "Origin", required: (v) => v.itemType !== "service" },
      { name: "brand", label: "Brand", required: (v) => v.itemType !== "service" },
    ],
    // The SKU is generated from the category, exactly as the stock page does; the user is
    // not asked for it. `existingSkus` comes from the stock list already on the page.
    payload: (v, ctx = {}) => ({
      itemName: text(v.itemName),
      itemType: v.itemType === "service" ? "service" : "goods",
      sku: nextSku(ctx.categoryName, ctx.existingSkus),
      categoryId: v.category,
      unitOfMeasure: v.unitOfMeasure,
      origin: text(v.origin),
      brand: text(v.brand),
      purchasePrice: 0,
      salesPrice: 0,
      currentStock: 0,
      reorderLevel: 0,
      status: "Active",
      batchNumber: "",
      expiryDate: null,
      barcodeQrCode: "",
      vendorId: null,
    }),
    labelOf: (r) => `${r.itemId} - ${r.itemName}`,
    idOf: (r) => r._id,
  },
};

// Whether a field is drawn at all: the tax number only once the box is ticked. A field that is
// not shown is never required, so a hidden one can never block the form from being submitted.
export const isShown = (field, values = {}) => (typeof field.when === "function" ? Boolean(field.when(values)) : true);

// A field is required outright, or by a rule on the other values (origin and brand are not asked of a service).
export const isRequired = (field, values = {}) =>
  isShown(field, values) && (typeof field.required === "function" ? Boolean(field.required(values)) : Boolean(field.required));

// Returns the first missing required field, or null when the values are complete.
export const missingRequired = (spec, values) => {
  for (const f of spec.fields) {
    if (isRequired(f, values) && !text(values[f.name])) return f;
  }
  return null;
};

// The one check worth making before the request: a malformed tax number is refused by the server
// with INVALID_TRN anyway, but saying so on the spot saves the round trip. Returns a message or null.
export const invalidField = (spec, values) => {
  const trn = spec.fields.find((f) => f.name === "trn");
  if (!trn || !isShown(trn, values)) return null;
  const typed = text(values.trn);
  return typed && !isValidTrn(typed) ? taxIdRule().message : null;
};
