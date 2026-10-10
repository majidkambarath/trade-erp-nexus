// Responses of /api/v1/ifrs/* for the June 2025 story the backend test tells, with the prior-year
// column (June 2024). Shared by the pure-logic tests and the screen tests.

const acct = (accountCode, accountName, amount, comparative) => ({ accountId: `id-${accountCode || accountName}`, accountCode, accountName, amount, comparative });
const group = (name, accounts, extra = {}) => ({
  groupId: `g-${name}`, name, accounts,
  amount: accounts.reduce((t, a) => t + a.amount, 0), comparative: accounts.reduce((t, a) => t + a.comparative, 0), ...extra,
});
const section = (label, groups) => ({
  label, groups, amount: groups.reduce((t, g) => t + g.amount, 0), comparative: groups.reduce((t, g) => t + g.comparative, 0),
});
const pair = (amount, comparative) => ({ amount, comparative });
const line = (key, label, amount, comparative, extra = {}) => ({ key, label, amount, comparative, ...extra });
const head = (statement, title) => ({ statement, title, entity: { name: "Harbour Trading Co LLC", trn: "100123456789012", address: "", vatRegistered: true }, currency: "AED" });

const fixedAssets = group("Fixed Assets", [acct("FA0001", "Furniture & Equipment", 1200, 0), acct("FA0002", "Accumulated Depreciation", -20, 0)]);
const currentAssets = section("Current assets", [
  group("Inventory", [acct("INV0001", "Inventory Stock", 1400, 400)]),
  group("Accounts Receivable", [acct("AR0001", "Customer - Al Noor", 1160, 210)]),
  group("Tax Receivable", [acct("TAXA0001", "Input VAT", 110, 25)]),
  group("Bank", [acct("BANK0002", "ENBD Current", 1985, 0)]),
  group("Cash", [acct("CASH0001", "Cash in Hand", 6386, 3000)]),
]);
const nonCurrentAssets = section("Non-current assets", [fixedAssets]);
const equity = section("Equity", [
  group("Equity", [acct("EQ0001", "Owner's Capital", 8000, 3000)]),
  group("Accumulated profit brought forward", [acct("", "Accumulated profit brought forward", 200, 0)], { synthetic: true }),
  group("Profit for the period", [acct("", "Profit for the period", 155, 100)], { synthetic: true }),
]);
const nonCurrentLiabilities = section("Non-current liabilities", [group("Long-term Liabilities", [acct("LTL0001", "Bank Loan", 2000, 0)])]);
const currentLiabilities = section("Current liabilities", [
  group("Accounts Payable", [acct("AP0001", "Vendor - Gulf Mills", 1800, 525)]),
  group("Tax Payable", [acct("TAXL0001", "Output VAT", 60, 10), acct("TAXL0002", "Corporate Tax Payable", 6, 0)]),
]);
const liabilities = pair(nonCurrentLiabilities.amount + currentLiabilities.amount, nonCurrentLiabilities.comparative + currentLiabilities.comparative);

export const POSITION = {
  ...head("financial-position", "Statement of financial position"),
  asAt: "2025-06-30", from: "2025-06-01", compare: "prior-year", comparative: { asAt: "2024-06-30", from: "2024-06-01" },
  assets: { nonCurrent: nonCurrentAssets, current: currentAssets, ...pair(12221, 3635) },
  equityAndLiabilities: { equity, nonCurrentLiabilities, currentLiabilities, liabilities, ...pair(12221, 3635) },
  isBalanced: true, difference: 0, comparativeIsBalanced: true, comparativeDifference: 0,
};

// The same company with three accounts on the other side of their own group (IAS 1.32): a second bank account in credit, a customer
// who paid more than was invoiced and a supplier paid ahead. Their group ids are plain strings, not ObjectIds, and every amount is
// positive: a liability is a liability, not a negative asset. 230 of supplier debits against 80 + 150 of liabilities keeps it balanced.
const sumPair = (...ps) => pair(ps.reduce((t, p) => t + p.amount, 0), ps.reduce((t, p) => t + p.comparative, 0));
const regroupedAssets = section("Current assets", [
  ...currentAssets.groups,
  group("Supplier debit balances and advances", [acct("AP0002", "Vendor - Delta Packaging", 230, 0)], { groupId: "supplier-debit-balances" }),
]);
const regroupedLiabilities = section("Current liabilities", [
  ...currentLiabilities.groups,
  group("Customer credit balances", [acct("AR0002", "Customer - Bright Mart", 80, 0)], { groupId: "customer-credit-balances" }),
  group("Bank overdrafts", [acct("BANK0003", "Mashreq Current", 150, 0)], { groupId: "bank-overdrafts" }),
]);
export const POSITION_REGROUPED = {
  ...POSITION,
  assets: { nonCurrent: nonCurrentAssets, current: regroupedAssets, ...sumPair(nonCurrentAssets, regroupedAssets) },
  equityAndLiabilities: {
    equity, nonCurrentLiabilities, currentLiabilities: regroupedLiabilities,
    liabilities: sumPair(nonCurrentLiabilities, regroupedLiabilities), ...sumPair(equity, nonCurrentLiabilities, regroupedLiabilities),
  },
};

const lines = (accounts) => ({ accounts, amount: accounts.reduce((t, a) => t + a.amount, 0), comparative: accounts.reduce((t, a) => t + a.comparative, 0) });
export const PROFIT = {
  ...head("profit-or-loss", "Statement of profit or loss and other comprehensive income"),
  from: "2025-06-01", to: "2025-06-30", compare: "prior-year", comparative: { from: "2024-06-01", to: "2024-06-30" }, basis: "by function",
  revenue: lines([acct("SAL0001", "Sales Revenue", 800, 200)]),
  costOfSales: lines([acct("COGS0001", "Cost of Goods Sold", 400, 100)]),
  grossProfit: pair(400, 100),
  otherIncome: lines([]),
  operatingExpenses: lines([acct("OPEX0005", "Rent Expense", 200, 0)]),
  depreciationAndAmortisation: lines([acct("OPEX0010", "Depreciation Expense", 20, 0)]),
  operatingProfit: pair(180, 100),
  financeCosts: lines([acct("OPEX0008", "Bank Charges", 15, 0)]),
  profitBeforeTax: pair(165, 100),
  incomeTaxExpense: lines([acct("OPEX0011", "Corporate Tax Expense", 10, 0)]),
  profitForPeriod: pair(155, 100),
  otherComprehensiveIncome: pair(0, 0),
  totalComprehensiveIncome: pair(155, 100),
};

// The same month with 50 of sales discounts: the server lists the discount account inside revenue as a negative line, so revenue
// and every subtotal under it are net of it (IFRS 15.47).
export const PROFIT_WITH_DISCOUNTS = {
  ...PROFIT,
  revenue: lines([acct("SAL0001", "Sales Revenue", 800, 200), acct("DSC0001", "Sales Discount", -50, 0)]),
  grossProfit: pair(350, 100), operatingProfit: pair(130, 100), profitBeforeTax: pair(115, 100),
  profitForPeriod: pair(105, 100), totalComprehensiveIncome: pair(105, 100),
};

const eqRow = (key, label, kind, share, retained, other = 0) => ({ key, label, kind, values: { share_capital: share, retained_earnings: retained, other_equity: other, total: share + retained + other } });
const eqBlock = (from, to, rows, extra = {}) => ({ from, to, rows, equityPerPosition: rows.at(-1).values.total, difference: 0, reconciles: true, ...extra });
export const EQUITY = {
  ...head("changes-in-equity", "Statement of changes in equity"),
  from: "2025-06-01", to: "2025-06-30", compare: "prior-year",
  columns: [
    { key: "share_capital", label: "Share capital" }, { key: "retained_earnings", label: "Retained earnings" },
    { key: "other_equity", label: "Other equity and reserves" }, { key: "total", label: "Total equity" },
  ],
  current: eqBlock("2025-06-01", "2025-06-30", [
    eqRow("opening", "Balance at start of period", "balance", 3000, 200),
    eqRow("profit", "Profit for the period", "movement", 0, 155),
    eqRow("oci", "Other comprehensive income", "movement", 0, 0),
    eqRow("comprehensive", "Total comprehensive income for the period", "subtotal", 0, 155),
    eqRow("introduced", "Capital introduced and other increases", "movement", 5000, 0),
    eqRow("reduced", "Drawings, dividends and other decreases", "movement", 0, 0),
    eqRow("closing", "Balance at end of period", "balance", 8000, 355),
  ]),
  comparative: eqBlock("2024-06-01", "2024-06-30", [
    eqRow("opening", "Balance at start of period", "balance", 0, 0),
    eqRow("profit", "Profit for the period", "movement", 0, 100),
    eqRow("oci", "Other comprehensive income", "movement", 0, 0),
    eqRow("comprehensive", "Total comprehensive income for the period", "subtotal", 0, 100),
    eqRow("introduced", "Capital introduced and other increases", "movement", 3000, 0),
    eqRow("reduced", "Drawings, dividends and other decreases", "movement", 0, 0),
    eqRow("closing", "Balance at end of period", "balance", 3000, 100),
  ]),
  reconciles: true,
};

export const CASH = {
  ...head("cash-flows", "Statement of cash flows"),
  method: "indirect", from: "2025-06-01", to: "2025-06-30", compare: "prior-year", comparative: { from: "2024-06-01", to: "2024-06-30" },
  operating: {
    label: "Cash flows from operating activities",
    profitBeforeTax: line("profitBeforeTax", "Profit before tax", 165, 100),
    adjustments: {
      label: "Adjustments for",
      lines: [
        line("depreciation", "Depreciation and amortisation", 20, 0),
        line("financeCosts", "Finance costs", 15, 0),
        line("disposal", "Loss / (gain) on disposal of non-current assets", 0, 0, { optional: true }),
      ],
      amount: 35, comparative: 0,
    },
    beforeWorkingCapital: line("beforeWorkingCapital", "Operating cash flow before working capital changes", 200, 100),
    workingCapital: {
      label: "Changes in working capital",
      lines: [
        line("inventory", "(Increase) / decrease in inventories", -600, -400),
        line("receivables", "(Increase) / decrease in trade and other receivables", -800, -235),
        line("payables", "Increase / (decrease) in trade and other payables", 790, 535),
        line("otherCurrentAssets", "(Increase) / decrease in other current assets", 0, 0, { optional: true }),
        line("otherCurrentLiabilities", "Increase / (decrease) in other current liabilities", 0, 0, { optional: true }),
      ],
      amount: -610, comparative: -100,
    },
    cashGenerated: line("cashGenerated", "Cash generated from operations", -410, 0),
    interestPaid: line("interestPaid", "Interest and finance charges paid", -15, 0),
    incomeTaxPaid: line("incomeTaxPaid", "Income tax paid", -4, 0),
    net: line("operating", "Net cash from / (used in) operating activities", -429, 0),
  },
  // gross lines (IAS 7.21): what was bought and, when there is any, what disposals brought in; money drawn, repaid, put in and taken out
  investing: {
    label: "Cash flows from investing activities",
    lines: [
      line("assetPurchases", "Purchase of property, plant and equipment", -1200, 0),
      line("assetDisposals", "Proceeds from disposal of non-current assets", 0, 0, { optional: true }),
    ],
    net: line("investing", "Net cash from / (used in) investing activities", -1200, 0),
  },
  financing: {
    label: "Cash flows from financing activities",
    lines: [
      line("borrowingsDrawn", "Proceeds from borrowings", 2000, 0, { optional: true }),
      line("borrowingsRepaid", "Repayment of borrowings", 0, 0, { optional: true }),
      line("capitalIntroduced", "Capital introduced by the owners", 5000, 3000, { optional: true }),
      line("drawingsAndDividends", "Drawings and dividends paid", 0, 0, { optional: true }),
    ],
    net: line("financing", "Net cash from / (used in) financing activities", 7000, 3000),
  },
  other: line("other", "Other movements (not classified above)", 0, 0, { optional: true }),
  netIncrease: line("netIncrease", "Net increase / (decrease) in cash and cash equivalents", 5371, 3000),
  openingCash: line("openingCash", "Cash and cash equivalents at start of period", 3000, 0),
  closingCash: line("closingCash", "Cash and cash equivalents at end of period", 8371, 3000),
  closingPerLedger: line("closingPerLedger", "Cash and bank balance per general ledger", 8371, 3000),
  cashAccounts: 4, reconciles: true, difference: 0, comparativeReconciles: true, comparativeDifference: 0,
};

const ageing = (buckets, total, overdue, notSet) => ({
  basis: "Open invoices dated up to the date, aged from their due date, as they stood at the end of that day.",
  buckets: [
    { key: "current", label: "Not yet due", amount: buckets[0] }, { key: "d1_30", label: "1-30 days", amount: buckets[1] },
    { key: "d31_60", label: "31-60 days", amount: buckets[2] }, { key: "d61_90", label: "61-90 days", amount: buckets[3] },
    { key: "d90plus", label: "Over 90 days", amount: buckets[4] },
  ],
  total, overdue, notSetAgainstInvoices: notSet,
});
export const NOTES = {
  ...head("notes", "Notes to the financial statements"),
  asAt: "2025-06-30", from: "2025-06-01", compare: "prior-year", comparative: { asAt: "2024-06-30", from: "2024-06-01" },
  disclaimer: "Basic notes generated from the general ledger. They are not a complete set of IFRS disclosures and should be reviewed with your accountant.",
  policies: [
    { key: "entity", title: "Reporting entity", text: "Harbour Trading Co LLC (TRN 100123456789012) trades in food products in the United Arab Emirates." },
    { key: "basis", title: "Basis of preparation", text: "The statements are prepared in accordance with IFRS. The functional and presentation currency is the UAE dirham (AED)." },
    { key: "inventory", title: "Inventories", text: "Inventories are stated at the lower of cost and net realisable value, using the weighted average cost." },
    { key: "revenue", title: "Revenue recognition", text: "Revenue is recognised when control passes to the customer (IFRS 15)." },
    { key: "vat", title: "Value added tax", text: "Revenue, expenses and assets are recognised net of VAT." },
    { key: "classification", title: "Current and non-current classification", text: "An asset or liability is non-current when its account group is named as fixed or long-term." },
  ],
  tables: {
    tradeReceivables: {
      title: "Trade and other receivables",
      rows: [
        line("trade", "Trade receivables (customers)", 1160, 210),
        line("other", "Advances to vendors and other receivables", 0, 0, { optional: true }),
        line("supplierDebits", "Supplier accounts in debit (presented with receivables)", 0, 0, { optional: true }),
      ],
      total: pair(1160, 210), ageing: ageing([740, 210, 0, 0, 210], 1160, 420, 0),
    },
    inventory: { title: "Inventories", accounts: [acct("INV0001", "Inventory Stock", 1400, 400)], total: pair(1400, 400), basis: "Weighted average cost" },
    cash: {
      title: "Cash and cash equivalents",
      accounts: [
        { accountId: "c1", accountCode: "CASH0001", accountName: "Cash in Hand", kind: "cash", net: 6386, comparativeNet: 3000 },
        { accountId: "c2", accountCode: "BANK0002", accountName: "ENBD Current", kind: "bank", net: -150, comparativeNet: 0 },
      ],
      total: { amount: 6236, comparative: 3000, net: 6236, comparativeNet: 3000 },
      // the same 6,236 as two lines of the statement of financial position (IAS 7.45): the bank in credit is a liability
      presentedAs: [
        line("cashAssets", "Cash and bank balances (current assets)", 6386, 3000),
        line("bankOverdrafts", "Bank overdrafts (current liabilities)", 150, 0, { negate: true, optional: true }),
      ],
    },
    tradePayables: {
      title: "Trade and other payables",
      rows: [
        line("trade", "Trade payables (vendors)", 1800, 525),
        line("other", "Advances from customers and other payables", 0, 0, { optional: true }),
        line("customerCredits", "Customer accounts in credit (presented with payables)", 0, 0, { optional: true }),
      ],
      total: pair(1800, 525), ageing: ageing([750, 525, 0, 0, 525], 1800, 1050, 0),
    },
    vat: {
      title: "Value added tax",
      rows: [line("output", "Output VAT payable", 60, 10), line("input", "Input VAT recoverable", 110, 25)],
      net: pair(-50, -15),
    },
  },
};

// The notes of the same regrouped company: 230 of supplier accounts in debit joins the receivables and 80 of customer accounts in
// credit the payables, so the ageing ties to the NET of the customer (vendor) accounts, not to the trade line above it.
export const NOTES_REGROUPED = (() => {
  const n = structuredClone(NOTES);
  const { tradeReceivables: r, tradePayables: p } = n.tables;
  r.rows[2] = { ...r.rows[2], amount: 230, comparative: 0 };
  r.total = pair(1160 + 230, 210);
  r.ageing = ageing([740, 210, 0, 0, 210], 1160, 420, -80);
  p.rows[2] = { ...p.rows[2], amount: 80, comparative: 0 };
  p.total = pair(1800 + 80, 525);
  p.ageing = ageing([750, 525, 0, 0, 525], 1800, 1050, -230);
  return n;
})();

// The same response with the comparative column switched off, as the API returns for compare=none.
export function withoutComparative(value) {
  if (Array.isArray(value)) return value.map(withoutComparative);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k.startsWith("comparative") ? null : withoutComparative(v)]));
  }
  return value;
}
