// The sell journey: a quotation, an order, the delivery, the invoice and the money. Each guide ends by offering the next.
// See masters.js for the step kinds. `feature` / `permission` on a step leave it out for a person or plan without it;
// `ifPresent` skips a step whose control exists only in some states; `clickIn` lets a click anywhere in a list count.

const dialog = "[role='dialog']";
const formOf = (key) => `#order-${key}`;
const firstRow = { selector: "main table tbody tr" };
const rows = "main table tbody";

const lineSteps = (form) => [
  { id: "item", kind: "fill", sample: "Basmati", target: { selector: `${form} [aria-label='Item, row 1']` } },
  { id: "qty", kind: "fill", sample: "10", target: { selector: `${form} [aria-label='Qty, row 1']` } },
  { id: "price", kind: "info", target: { selector: `${form} [aria-label='Unit price, row 1']` } },
];

export const createQuotation = {
  id: "create-quotation",
  module: "sales",
  permission: "sales.create",
  feature: "quotations",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/quotations" },
    { id: "new", kind: "click", target: { button: /^new quotation$/i } },
    { id: "customer", kind: "fill", sample: "Al Madina", target: { field: /^customer/i, within: formOf("quotation") } },
    ...lineSteps(formOf("quotation")),
    { id: "save", kind: "click", target: { selector: "button[form='order-quotation']" } },
    { id: "done", kind: "done", next: "quotation-next-step" },
  ],
};

export const quotationNextStep = {
  id: "quotation-next-step",
  module: "sales",
  permission: "sales.approve",
  feature: "quotations",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/quotations" },
    { id: "row", kind: "click", target: firstRow, clickIn: rows },
    { id: "action", kind: "click", target: { button: /^(mark as sent|accept|convert to sales order|convert to invoice)$/i } },
    { id: "done", kind: "done", next: "create-sales-order" },
  ],
};

export const createSalesOrder = {
  id: "create-sales-order",
  module: "sales",
  permission: "sales.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/sales-orders" },
    { id: "new", kind: "click", target: { button: /^new sales order$/i } },
    { id: "customer", kind: "fill", sample: "Al Madina", target: { field: /^customer/i, within: formOf("salesOrderDoc") } },
    ...lineSteps(formOf("salesOrderDoc")),
    { id: "save", kind: "click", target: { selector: "button[form='order-salesOrderDoc']" } },
    { id: "done", kind: "done", next: "deliver-and-invoice" },
  ],
};

export const deliverAndInvoice = {
  id: "deliver-and-invoice",
  module: "sales",
  permission: "sales.approve",
  minutes: 5,
  steps: [
    { id: "open", kind: "go", to: "/sales-orders" },
    { id: "row", kind: "click", target: firstRow, clickIn: rows },
    { id: "confirm", kind: "click", ifPresent: true, target: { button: /^confirm order$/i } },
    { id: "confirmok", kind: "click", ifPresent: true, target: { button: /^confirm order$/i, within: dialog } },
    { id: "delivery", kind: "click", feature: "deliveryNotes", permission: "sales.approve", target: { button: /^create delivery note$/i } },
    { id: "dnsave", kind: "click", feature: "deliveryNotes", permission: "sales.approve", target: { button: /^(save|update) delivery note$/i } },
    { id: "dispatch", kind: "click", feature: "deliveryNotes", permission: "sales.approve", target: { button: /^dispatch$/i } },
    { id: "dispatchok", kind: "click", feature: "deliveryNotes", permission: "sales.approve", target: { button: /^dispatch$/i, within: dialog } },
    { id: "deliver", kind: "click", feature: "deliveryNotes", permission: "sales.approve", target: { button: /^mark delivered$/i } },
    { id: "receivedby", kind: "fill", feature: "deliveryNotes", permission: "sales.approve", sample: "Khalid", target: { field: /^received by/i, within: dialog } },
    { id: "deliverok", kind: "click", feature: "deliveryNotes", permission: "sales.approve", target: { button: /^mark delivered$/i, within: dialog } },
    { id: "invoice", kind: "click", target: { button: /^create invoice$/i } },
    { id: "invoiceok", kind: "click", target: { button: /^create (and approve |draft )?invoice$/i, within: dialog } },
    { id: "done", kind: "done", next: "receive-payment" },
  ],
};

export const receivePayment = {
  id: "receive-payment",
  module: "finance",
  permission: "finance.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/receipt-voucher" },
    { id: "new", kind: "click", target: { button: /^new receipt$/i } },
    { id: "customer", kind: "fill", sample: "Al Madina", target: { field: /^customer/i, within: dialog } },
    { id: "amount", kind: "fill", sample: "100", target: { field: /^amount received/i, within: dialog } },
    { id: "mode", kind: "info", target: { selector: "[role='dialog'] fieldset" } },
    { id: "invoices", kind: "info", optional: true, target: { selector: "[role='dialog'] [aria-label='Open invoices']" } },
    { id: "post", kind: "click", target: { button: /^post receipt$/i, within: dialog } },
    { id: "done", kind: "done" },
  ],
};
