// Reports: where to choose the period, how to read the main figures, how to export. Every step points and explains;
// none of these guides changes anything. See masters.js for the step kinds.

export const readProfitAndLoss = {
  id: "read-profit-and-loss",
  module: "reports",
  permission: "reports.financial",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/financial-statements" },
    { id: "pl", kind: "click", target: { button: /^profit and loss$/i } },
    { id: "period", kind: "info", target: { field: /^from$/i } },
    { id: "quick", kind: "info", ifPresent: true, target: { button: /^this month$/i } },
    { id: "csv", kind: "info", ifPresent: true, target: { button: /^csv$/i } },
    { id: "bs", kind: "click", target: { button: /^balance sheet$/i } },
    { id: "asat", kind: "info", target: { field: /^as at/i } },
    { id: "done", kind: "done", next: "read-ageing" },
  ],
};

export const readAgeing = {
  id: "read-ageing",
  module: "reports",
  permission: "reports.financial",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/ageing" },
    { id: "kind", kind: "info", target: { selector: "[aria-label='Ageing type']" } },
    { id: "asat", kind: "info", target: { field: /^as at/i } },
    { id: "export", kind: "info", ifPresent: true, target: { button: /^export csv$/i } },
    { id: "done", kind: "done", next: "customer-statement" },
  ],
};

export const customerStatement = {
  id: "customer-statement",
  module: "reports",
  permission: "reports.financial",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/statement" },
    { id: "of", kind: "info", target: { field: /^statement of/i } },
    { id: "party", kind: "fill", sample: "Al Madina", target: { field: /^(customer|vendor|account)$/i } },
    { id: "dates", kind: "info", target: { field: /^from$/i } },
    { id: "pdf", kind: "info", ifPresent: true, target: { button: /^download pdf$/i } },
    { id: "done", kind: "done" },
  ],
};

export const readStockReports = {
  id: "read-stock-reports",
  module: "reports",
  permission: "reports.view",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/stock-reports" },
    { id: "valuation", kind: "info", target: { button: /^valuation$/i } },
    { id: "asat", kind: "info", ifPresent: true, target: { field: /^as at/i } },
    { id: "reorder", kind: "click", target: { button: /^reorder$/i } },
    { id: "export", kind: "info", ifPresent: true, target: { button: /^export csv$/i } },
    { id: "done", kind: "done" },
  ],
};

export const readVatReturn = {
  id: "read-vat-return",
  module: "reports",
  permission: "reports.financial",
  feature: "vatReturn",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/vat-reports" },
    { id: "quarter", kind: "info", target: { button: /^last quarter$/i } },
    { id: "draft", kind: "info", ifPresent: true, target: { button: /^save as draft$/i } },
    { id: "saved", kind: "click", target: { button: /^saved returns$/i } },
    { id: "finalise", kind: "info", ifPresent: true, target: { button: /^(finalise|mark filed)$/i } },
    { id: "done", kind: "done" },
  ],
};

export const readLedgerAndDayBook = {
  id: "read-ledger-and-day-book",
  module: "reports",
  permission: "reports.financial",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/ledger-reports" },
    { id: "daybook", kind: "click", target: { button: /^day book$/i } },
    { id: "summary", kind: "click", target: { button: /^daily summary$/i } },
    { id: "cashbook", kind: "click", target: { button: /^cash and bank$/i } },
    { id: "dayend", kind: "click", target: { button: /^day end$/i } },
    { id: "done", kind: "done" },
  ],
};

export const readPartyBalances = {
  id: "read-party-balances",
  module: "reports",
  permission: "reports.financial",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/party-balances" },
    { id: "asat", kind: "info", target: { field: /^as at/i } },
    { id: "zero", kind: "info", ifPresent: true, target: { field: /^include zero balances/i } },
    { id: "csv", kind: "info", ifPresent: true, target: { button: /^csv$/i } },
    { id: "done", kind: "done" },
  ],
};

export const readTradeAnalysis = {
  id: "read-trade-analysis",
  module: "reports",
  permission: "reports.view",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/trade-reports" },
    { id: "views", kind: "info", target: { button: /^by item$/i } },
    { id: "month", kind: "info", ifPresent: true, target: { field: /^month$/i } },
    { id: "csv", kind: "info", ifPresent: true, target: { button: /^csv/i } },
    { id: "done", kind: "done" },
  ],
};

export const readDashboard = {
  id: "read-dashboard",
  module: "reports",
  permission: "reports.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/dashboard" },
    { id: "period", kind: "info", target: { field: /^period$/i } },
    { id: "tabs", kind: "info", target: { button: /^inventory$/i, within: "main [role='tablist']" } },
    { id: "approvals", kind: "click", ifPresent: true, target: { button: /^approvals/i } },
    { id: "waiting", kind: "info", ifPresent: true, target: { text: /^waiting for you/i } },
    { id: "done", kind: "done" },
  ],
};

// The approvals list: every order and voucher waiting for a decision. A tour: it points and reads, it approves nothing.
export const approvalsTour = {
  id: "approvals-tour",
  module: "reports",
  permission: ["sales.approve", "purchase.approve", "finance.approve"],
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/approvals" },
    { id: "foryou", kind: "info", target: { text: /^waiting for you/i } },
    { id: "row", kind: "info", ifPresent: true, target: { button: /^open /i } },
    { id: "approve", kind: "info", ifPresent: true, target: { button: /^approve /i } },
    { id: "others", kind: "info", ifPresent: true, target: { text: /^waiting, but not for you/i } },
    { id: "done", kind: "done" },
  ],
};
