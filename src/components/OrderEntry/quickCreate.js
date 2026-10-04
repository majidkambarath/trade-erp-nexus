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
    ],
    payload: (v) => ({
      vendorName: text(v.vendorName),
      contactPerson: text(v.contactPerson),
      address: text(v.address),
      phone: "",
      email: "",
      paymentTerms: "",
      status: "Compliant",
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
      paymentTerms: "",
      status: "Active",
      trnNumber: null,
      salesPerson: null,
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
      { name: "category", label: "Category", required: true, select: "categories" },
      { name: "unitOfMeasure", label: "Unit of measure", required: true, select: "units" },
      { name: "origin", label: "Origin", required: true },
      { name: "brand", label: "Brand", required: true },
    ],
    // The SKU is generated from the category, exactly as the stock page does; the user is
    // not asked for it. `existingSkus` comes from the stock list already on the page.
    payload: (v, ctx = {}) => ({
      itemName: text(v.itemName),
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

// Returns the first missing required field, or null when the values are complete.
export const missingRequired = (spec, values) => {
  for (const f of spec.fields) {
    if (f.required && !text(values[f.name])) return f;
  }
  return null;
};
