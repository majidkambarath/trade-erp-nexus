// How the guides are grouped in the Guide me panel, in the order a new client should learn them.
// The order inside a group is the order of FLOWS. A flow not named here is shown under "other" so it is never lost.
export const GROUPS = [
  { id: "settings", ids: ["set-up-company", "tax-identity-tour", "credit-and-approvals-tour", "invoice-bank-details", "preferences-tour", "security-tour", "sending-setup-tour", "branches-tour", "add-colleague", "roles-tour"] },
  { id: "start", ids: ["add-customer", "add-vendor", "add-item", "add-service-item", "add-category", "add-unit"] },
  { id: "sell", ids: ["create-quotation", "quotation-next-step", "create-sales-order", "deliver-and-invoice", "send-invoice", "receive-payment", "quick-sales-invoice", "sales-return"] },
  { id: "buy", ids: ["create-purchase-order", "receive-and-bill-goods", "pay-supplier", "direct-purchase-invoice", "purchase-return"] },
  { id: "stock", ids: ["record-movement", "write-off-stock"] },
  { id: "money", ids: ["record-expense", "journal-entry", "contra-transfer", "credit-debit-note", "follow-cheque", "add-bank", "bank-reconciliation"] },
  { id: "accounts", ids: ["add-account", "read-account-ledger", "accounting-setup-tour", "opening-balances-tour", "close-month"] },
  { id: "reports", ids: ["read-profit-and-loss", "read-ageing", "customer-statement", "read-stock-reports", "read-vat-return", "read-ledger-and-day-book", "read-party-balances", "read-trade-analysis", "read-dashboard", "approvals-tour"] },
  { id: "garage", ids: ["garage-board-tour", "add-vehicle", "new-job-card", "garage-estimate-approval", "garage-do-the-work", "garage-invoice-release", "garage-insurance-claim", "garage-standard-job", "garage-bay", "garage-reports-tour"] },
];

export const groupOf = (flowId) => GROUPS.find((g) => g.ids.includes(flowId))?.id || "other";

// Split the flows the person may run into their groups, dropping empty ones.
export function grouped(flows) {
  const byId = new Map(flows.map((f) => [f.id, f]));
  const out = GROUPS.map((g) => ({ id: g.id, flows: g.ids.map((i) => byId.get(i)).filter(Boolean) }));
  const known = new Set(GROUPS.flatMap((g) => g.ids));
  const rest = flows.filter((f) => !known.has(f.id));
  if (rest.length) out.push({ id: "other", flows: rest });
  const shown = out.filter((g) => g.flows.length);
  // An organisation that bought the Garage module is a workshop: its own guides come first, in the order the work
  // happens (vehicle in, estimate, work, invoice, claim), then the general ones.
  const garage = shown.find((g) => g.id === "garage");
  return garage ? [garage, ...shown.filter((g) => g !== garage)] : shown;
}
