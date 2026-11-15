// Money: expenses, journals, transfers, notes, cheques, banks and reconciliation. See masters.js for the step kinds.
const dialog = "[role='dialog']";
const cell = (name, row) => `[role='dialog'] [aria-label='${name}, row ${row}']`;

export const recordExpense = {
  id: "record-expense",
  module: "finance",
  permission: "finance.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/expense-voucher" },
    { id: "new", kind: "click", target: { button: /^new expense$/i } },
    { id: "account", kind: "fill", sample: "Rent", target: { field: /^expense account/i, within: dialog } },
    { id: "description", kind: "fill", sample: "Walk expense", target: { field: /^description/i, within: dialog } },
    { id: "amount", kind: "fill", sample: "100", target: { field: /^amount before/i, within: dialog } },
    { id: "taxcode", kind: "info", optional: true, target: { field: /^tax code/i, within: dialog } },
    { id: "mode", kind: "info", target: { selector: "[role='dialog'] fieldset" } },
    { id: "post", kind: "click", target: { button: /^post expense$/i, within: dialog } },
    { id: "done", kind: "done" },
  ],
};

export const journalEntry = {
  id: "journal-entry",
  module: "finance",
  permission: "finance.create",
  minutes: 4,
  steps: [
    { id: "open", kind: "go", to: "/journal-voucher" },
    { id: "new", kind: "click", target: { button: /^new journal$/i } },
    { id: "narration", kind: "fill", sample: "Walk journal", target: { field: /^narration/i, within: dialog } },
    { id: "debitaccount", kind: "fill", sample: "Cash in Hand", target: { selector: cell("Account", 1) } },
    { id: "debit", kind: "fill", sample: "100", target: { selector: cell("Debit", 1) } },
    { id: "creditaccount", kind: "fill", sample: "Petty", target: { selector: cell("Account", 2) } },
    { id: "credit", kind: "info", target: { selector: cell("Credit", 2) } },
    { id: "post", kind: "click", target: { button: /^post journal$/i, within: dialog } },
    { id: "done", kind: "done" },
  ],
};

export const contraTransfer = {
  id: "contra-transfer",
  module: "finance",
  permission: "finance.create",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/contra-voucher" },
    { id: "new", kind: "click", target: { button: /^new contra$/i } },
    { id: "from", kind: "fill", sample: "Cash in Hand", target: { field: /^from$/i, within: dialog } },
    { id: "to", kind: "fill", sample: "Petty", target: { field: /^to$/i, within: dialog } },
    { id: "amount", kind: "fill", sample: "10", target: { field: /^amount/i, within: dialog } },
    { id: "post", kind: "click", target: { button: /^post contra$/i, within: dialog } },
    { id: "done", kind: "done" },
  ],
};

export const creditDebitNote = {
  id: "credit-debit-note",
  module: "finance",
  permission: "finance.create",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/debit-credit-notes" },
    { id: "new", kind: "click", target: { button: /^new (credit|debit) note$/i } },
    { id: "against", kind: "info", optional: true, target: { field: /^set against invoice/i, within: dialog } },
    { id: "account", kind: "info", target: { selector: cell("Account", 1) } },
    { id: "amount", kind: "fill", sample: "10", target: { selector: cell("Amount", 1) } },
    { id: "post", kind: "click", target: { button: /^post (credit|debit) note$/i, within: dialog } },
    { id: "done", kind: "done" },
  ],
};

export const followCheque = {
  id: "follow-cheque",
  module: "banking",
  permission: "banking.view",
  feature: "banking",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/cheques" },
    { id: "status", kind: "info", target: { selector: "[aria-label='Cheque status']" } },
    { id: "filters", kind: "info", optional: true, target: { field: /^direction/i } },
    { id: "actions", kind: "info", ifPresent: true, target: { button: /^(deposit|clear|resume)$/i } },
    { id: "done", kind: "done" },
  ],
};

export const addBank = {
  id: "add-bank",
  module: "accounts",
  permission: "accounts.manage",
  feature: "banking",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/banks" },
    { id: "new", kind: "click", target: { button: /^new bank$/i } },
    { id: "name", kind: "fill", sample: "Walk Bank", target: { field: /^bank name/i, within: dialog } },
    { id: "code", kind: "fill", sample: "WLKB", target: { field: /^code/i, within: dialog } },
    { id: "save", kind: "click", target: { button: /^add bank$/i, within: dialog } },
    { id: "done", kind: "done", next: "bank-reconciliation" },
  ],
};

export const bankReconciliation = {
  id: "bank-reconciliation",
  module: "banking",
  permission: "banking.view",
  feature: "reconciliation",
  minutes: 4,
  steps: [
    { id: "open", kind: "go", to: "/bank-reconciliation" },
    { id: "account", kind: "info", target: { field: /^bank account/i } },
    { id: "import", kind: "info", ifPresent: true, target: { button: /^import a statement$/i } },
    { id: "views", kind: "info", ifPresent: true, target: { button: /^statement lines$/i } },
    { id: "suggested", kind: "info", ifPresent: true, target: { button: /^suggested/i } },
    { id: "accept", kind: "info", ifPresent: true, target: { button: /^accept all strong matches/i } },
    { id: "finish", kind: "info", ifPresent: true, target: { text: /^finish and prove/i } },
    { id: "done", kind: "done" },
  ],
};
