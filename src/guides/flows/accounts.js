// Accounts: the chart, an account's ledger, the set-up tabs, closing a month and the go-live position.
// The set-up, close and opening-balance guides point and read; they never post anything on their own.
const dialog = "[role='dialog']";
const tabs = "[role='tablist']";

export const addAccount = {
  id: "add-account",
  module: "accounts",
  permission: "accounts.manage",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/chart-of-accounts" },
    { id: "new", kind: "click", target: { button: /^new account$/i } },
    { id: "group", kind: "fill", sample: "Operating", target: { field: /^group/i, within: dialog } },
    { id: "name", kind: "fill", sample: "Walk Account", target: { field: /^account name/i, within: dialog } },
    { id: "save", kind: "click", target: { selector: "button[form='account-form']" } },
    { id: "done", kind: "done", next: "read-account-ledger" },
  ],
};

export const readAccountLedger = {
  id: "read-account-ledger",
  module: "accounts",
  permission: "accounts.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/chart-of-accounts" },
    { id: "search", kind: "info", target: { selector: "[aria-label='Search accounts']" } },
    { id: "ledger", kind: "click", target: { button: /^ledger of /i } },
    { id: "dates", kind: "info", ifPresent: true, target: { field: /^from$/i, within: dialog } },
    { id: "done", kind: "done" },
  ],
};

export const accountingSetupTour = {
  id: "accounting-setup-tour",
  module: "accounts",
  permission: "accounts.view",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/accounting-setup" },
    { id: "posting", kind: "info", target: { button: /^posting accounts$/i } },
    { id: "years", kind: "click", target: { button: /^fiscal years$/i } },
    { id: "tax", kind: "click", target: { button: /^tax codes$/i } },
    { id: "numbering", kind: "click", target: { button: /^numbering$/i } },
    { id: "audit", kind: "click", target: { button: /^audit log$/i } },
    { id: "done", kind: "done", next: "close-month" },
  ],
};

export const closeMonth = {
  id: "close-month",
  module: "accounts",
  permission: "accounts.close",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/accounting-setup" },
    { id: "years", kind: "click", target: { button: /^fiscal years$/i } },
    { id: "panel", kind: "info", ifPresent: true, target: { text: /^month end/i } },
    { id: "checklist", kind: "info", ifPresent: true, target: { button: /^(checklist|close month)$/i } },
    { id: "year", kind: "info", ifPresent: true, target: { button: /^close year$/i } },
    { id: "done", kind: "done" },
  ],
};

export const openingBalancesTour = {
  id: "opening-balances-tour",
  module: "accounts",
  permission: "accounts.manage",
  minutes: 4,
  steps: [
    { id: "open", kind: "go", to: "/opening-balances" },
    { id: "golive", kind: "info", target: { button: /go-live date/i, within: tabs } },
    { id: "accounts", kind: "click", target: { button: /accounts$/i, within: tabs } },
    { id: "customers", kind: "click", target: { button: /customers$/i, within: tabs } },
    { id: "vendors", kind: "click", target: { button: /vendors$/i, within: tabs } },
    { id: "stock", kind: "click", target: { button: /stock$/i, within: tabs } },
    { id: "review", kind: "click", target: { button: /review$/i, within: tabs } },
    { id: "done", kind: "done" },
  ],
};
