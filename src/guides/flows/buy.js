// The buy journey: a purchase order, receiving the goods, the supplier's invoice, paying it, a direct purchase invoice
// and the two returns. See masters.js and sell.js for the step kinds.

const dialog = "[role='dialog']";
const form = (key) => `#order-${key}`;
const firstRow = { selector: "main table tbody tr" };
const rows = "main table tbody";
const line = (f) => [
  { id: "item", kind: "fill", sample: "Basmati", target: { selector: `${f} [aria-label='Item, row 1']` } },
  { id: "qty", kind: "fill", sample: "10", target: { selector: `${f} [aria-label='Qty, row 1']` } },
  { id: "price", kind: "info", target: { selector: `${f} [aria-label='Unit price, row 1']` } },
];

export const createPurchaseOrder = {
  id: "create-purchase-order",
  module: "purchase",
  permission: "purchase.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/purchase-orders" },
    { id: "new", kind: "click", target: { button: /^new purchase order$/i } },
    { id: "vendor", kind: "fill", sample: "Gulf", target: { field: /^vendor/i, within: form("purchaseOrderDoc") } },
    ...line(form("purchaseOrderDoc")),
    { id: "save", kind: "click", target: { selector: "button[form='order-purchaseOrderDoc']" } },
    { id: "done", kind: "done", next: "receive-and-bill-goods" },
  ],
};

export const receiveAndBillGoods = {
  id: "receive-and-bill-goods",
  module: "purchase",
  permission: "purchase.approve",
  minutes: 5,
  steps: [
    { id: "open", kind: "go", to: "/purchase-orders" },
    { id: "row", kind: "click", target: firstRow, clickIn: rows },
    { id: "confirm", kind: "click", ifPresent: true, target: { button: /^confirm order$/i } },
    { id: "confirmok", kind: "click", ifPresent: true, target: { button: /^confirm order$/i, within: dialog } },
    { id: "receive", kind: "click", target: { button: /^receive goods$/i } },
    { id: "quantities", kind: "info", target: { text: /^quantities for this goods receipt/i } },
    { id: "save", kind: "click", target: { button: /^save goods receipt$/i } },
    { id: "received", kind: "click", target: { button: /^confirm goods received$/i } },
    { id: "receivedby", kind: "fill", sample: "Storekeeper", target: { field: /^received by/i, within: dialog } },
    { id: "receivedok", kind: "click", target: { button: /^confirm goods received$/i, within: dialog } },
    { id: "invoice", kind: "click", target: { button: /^create purchase invoice$/i } },
    { id: "vendorinvoice", kind: "fill", optional: true, sample: "VINV-1001", target: { field: /^vendor.s invoice/i, within: dialog } },
    { id: "invoiceok", kind: "click", target: { button: /^create (and approve |draft )?invoice$/i, within: dialog } },
    { id: "done", kind: "done", next: "pay-supplier" },
  ],
};

export const paySupplier = {
  id: "pay-supplier",
  module: "finance",
  permission: "finance.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/payment-voucher" },
    { id: "new", kind: "click", target: { button: /^new payment$/i } },
    { id: "vendor", kind: "fill", sample: "Gulf", target: { field: /^vendor/i, within: dialog } },
    { id: "amount", kind: "fill", sample: "100", target: { field: /^amount paid/i, within: dialog } },
    { id: "mode", kind: "info", target: { selector: "[role='dialog'] fieldset" } },
    { id: "invoices", kind: "info", optional: true, target: { selector: "[role='dialog'] [aria-label='Open invoices']" } },
    { id: "post", kind: "click", target: { button: /^post payment$/i, within: dialog } },
    { id: "done", kind: "done" },
  ],
};

export const directPurchaseInvoice = {
  id: "direct-purchase-invoice",
  module: "purchase",
  permission: "purchase.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/purchase-order" },
    { id: "new", kind: "click", target: { button: /^new purchase invoice$/i } },
    { id: "vendor", kind: "fill", sample: "Gulf", target: { field: /^vendor/i, within: form("purchase") } },
    ...line(form("purchase")),
    { id: "status", kind: "info", target: { field: /^status/i, within: form("purchase") } },
    { id: "save", kind: "click", target: { selector: "button[form='order-purchase']" } },
    { id: "approve", kind: "click", ifPresent: true, permission: "purchase.approve", target: { selector: "main table tbody tr [title='Approve'], main table tbody tr [aria-label='Approve']" } },
    { id: "done", kind: "done" },
  ],
};

export const salesReturn = {
  id: "sales-return",
  module: "sales",
  permission: "sales.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/sales-return" },
    { id: "new", kind: "click", target: { button: /^new sales return$/i } },
    { id: "customer", kind: "fill", sample: "Al Madina", target: { field: /^customer/i, within: form("salesReturn") } },
    { id: "against", kind: "fill", sample: "SO", target: { field: /^return against sales invoice/i, within: form("salesReturn") } },
    { id: "lines", kind: "info", target: { selector: `${form("salesReturn")} [aria-label='Qty, row 1']` } },
    { id: "save", kind: "click", target: { selector: "button[form='order-salesReturn']" } },
    { id: "done", kind: "done" },
  ],
};

export const purchaseReturn = {
  id: "purchase-return",
  module: "purchase",
  permission: "purchase.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/purchase-return" },
    { id: "new", kind: "click", target: { button: /^new purchase return$/i } },
    { id: "vendor", kind: "fill", sample: "Gulf", target: { field: /^vendor/i, within: form("purchaseReturn") } },
    { id: "against", kind: "fill", sample: "PO", target: { field: /^return against purchase order/i, within: form("purchaseReturn") } },
    { id: "lines", kind: "info", target: { selector: `${form("purchaseReturn")} [aria-label='Qty, row 1']` } },
    { id: "reference", kind: "fill", sample: "VR-1", target: { field: /^vendor reference/i, within: form("purchaseReturn") } },
    { id: "save", kind: "click", target: { selector: "button[form='order-purchaseReturn']" } },
    { id: "done", kind: "done" },
  ],
};
