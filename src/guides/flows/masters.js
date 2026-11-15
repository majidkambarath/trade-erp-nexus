// Flows for the people and things a business deals with: customers, vendors, items.
// A step is { id, kind, target?, optional? }. The WORDS of a step are not here: they live in
// ../i18n/<lang>.js under "<flow id>.<step id>", so a translator never touches behaviour.
//
// kinds
//   go     take the person to a page (`to`), advance when they are there
//   click  point at a control; advance when the person clicks it
//   fill   point at a field; the person types; Next when ready (never auto-advances: a first letter is not "done")
//   info   point at something to read; Next
//   done   the last card
// `optional: true` says the screen does not need it, so the card says "optional" and Skip is the obvious choice.

const dialog = "[role='dialog']";

export const addCustomer = {
  id: "add-customer",
  module: "sales",
  permission: "sales.create",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/customer-creation" },
    { id: "add", kind: "click", target: { button: /^add customer$/i } },
    { id: "name", kind: "fill", sample: "Walk Test", target: { field: /^customer name/i, within: dialog } },
    { id: "contact", kind: "fill", sample: "Test Contact", target: { field: /^contact person/i, within: dialog } },
    { id: "phone", kind: "fill", optional: true, target: { field: /^phone/i, within: dialog } },
    { id: "address", kind: "fill", sample: "Dubai, UAE", target: { field: /^billing address/i, within: dialog } },
    { id: "taxtab", kind: "click", optional: true, target: { button: /^(vat|gst|tax)/i, within: dialog } },
    { id: "vatstatus", kind: "fill", optional: true, sample: "registered", target: { field: /^(vat|gst|tax) status/i, within: dialog } },
    { id: "trn", kind: "fill", optional: true, target: { field: /^(trn|gstin|tax no)/i, within: dialog } },
    { id: "credittab", kind: "click", optional: true, target: { button: /^credit and terms/i, within: dialog } },
    { id: "terms", kind: "fill", optional: true, target: { field: /^payment terms/i, within: dialog } },
    { id: "save", kind: "click", target: { selector: "button[form='party-form']" } },
    { id: "done", kind: "done", next: "add-vendor" },
  ],
};

export const addVendor = {
  id: "add-vendor",
  module: "purchase",
  permission: "purchase.create",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/vendor-creation" },
    { id: "add", kind: "click", target: { button: /^add vendor$/i } },
    { id: "name", kind: "fill", sample: "Walk Test", target: { field: /^vendor name/i, within: dialog } },
    { id: "contact", kind: "fill", sample: "Test Contact", target: { field: /^contact person/i, within: dialog } },
    { id: "address", kind: "fill", sample: "Dubai, UAE", target: { field: /^address/i, within: dialog } },
    { id: "taxtab", kind: "click", optional: true, target: { button: /^(vat|gst|tax)/i, within: dialog } },
    { id: "vatstatus", kind: "fill", optional: true, sample: "registered", target: { field: /^(vat|gst|tax) status/i, within: dialog } },
    { id: "trn", kind: "fill", optional: true, target: { field: /^(trn|gstin|tax no)/i, within: dialog } },
    { id: "save", kind: "click", target: { selector: "button[form='party-form']" } },
    { id: "done", kind: "done", next: "add-item" },
  ],
};

export const addItem = {
  id: "add-item",
  module: "inventory",
  permission: "inventory.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/stock-item-creation" },
    { id: "add", kind: "click", target: { button: /^add stock item$/i } },
    { id: "name", kind: "fill", sample: "Walk Test", target: { selector: "[role='dialog'] [name='itemName']" } },
    { id: "category", kind: "fill", target: { field: /^category/i, within: dialog } },
    { id: "unit", kind: "info", target: { guide: "select-unitOfMeasure" } },
    { id: "cost", kind: "fill", sample: "10", target: { selector: "[role='dialog'] [name='purchasePrice']" } },
    { id: "price", kind: "fill", sample: "12", target: { selector: "[role='dialog'] [name='salesPrice']" } },
    { id: "reorder", kind: "fill", optional: true, target: { selector: "[role='dialog'] [name='reorderLevel']" } },
    { id: "save", kind: "click", target: { button: /^add item$/i, within: dialog } },
    { id: "done", kind: "done" },
  ],
};
