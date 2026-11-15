// Stock: a movement or count adjustment, a write-off, categories and units. See masters.js for the step kinds.
const dialog = "[role='dialog']";

export const recordMovement = {
  id: "record-movement",
  module: "inventory",
  permission: "inventory.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/inventory" },
    { id: "new", kind: "click", target: { button: /^record movement$/i } },
    { id: "item", kind: "fill", sample: "Basmati", target: { field: /^stock item/i, within: dialog } },
    { id: "qty", kind: "fill", sample: "1", target: { field: /^quantity/i, within: dialog } },
    { id: "event", kind: "fill", sample: "Stock Adjustment", target: { selector: "[role='dialog'] [name='eventType']" } },
    { id: "reference", kind: "fill", sample: "ADJ-1", target: { field: /^reference number/i, within: dialog } },
    { id: "save", kind: "click", target: { button: /^record movement$/i, within: dialog } },
    { id: "done", kind: "done", next: "write-off-stock" },
  ],
};

export const writeOffStock = {
  id: "write-off-stock",
  module: "inventory",
  permission: "inventory.adjust",
  feature: "batches",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/batches" },
    { id: "row", kind: "click", target: { button: /^write off$/i }, clickIn: "main table tbody" },
    { id: "qty", kind: "fill", sample: "1", target: { field: /^quantity/i, within: dialog } },
    { id: "reason", kind: "fill", target: { field: /^reason/i, within: dialog } },
    { id: "save", kind: "click", target: { selector: "button[form='writeoff-form']" } },
    { id: "done", kind: "done" },
  ],
};

export const addCategory = {
  id: "add-category",
  module: "inventory",
  permission: "inventory.create",
  minutes: 1,
  steps: [
    { id: "open", kind: "go", to: "/category-management" },
    { id: "new", kind: "click", target: { button: /^add category$/i } },
    { id: "name", kind: "fill", sample: "Walk Category", target: { selector: "[role='dialog'] [name='name']" } },
    { id: "save", kind: "click", target: { button: /^create category$/i } },
    { id: "done", kind: "done" },
  ],
};

export const addUnit = {
  id: "add-unit",
  module: "inventory",
  permission: "inventory.create",
  minutes: 1,
  steps: [
    { id: "open", kind: "go", to: "/unit-setup" },
    { id: "new", kind: "click", target: { button: /^add unit$/i } },
    { id: "name", kind: "fill", sample: "Walk Unit", target: { field: /^unit name/i, within: dialog } },
    { id: "code", kind: "fill", sample: "WLK", target: { field: /^short code/i, within: dialog } },
    { id: "save", kind: "click", target: { button: /^create unit$/i } },
    { id: "done", kind: "done" },
  ],
};
