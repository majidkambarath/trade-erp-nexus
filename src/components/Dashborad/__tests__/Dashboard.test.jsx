import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.setConfig({ testTimeout: 30000 });

const m = vi.hoisted(() => ({ summary: vi.fn(), analytics: vi.fn(), sales: vi.fn(), inventory: vi.fn(), reports: vi.fn() }));
vi.mock("../../../lib/dashboardApi", () => ({ dashboard: m }));
// jsdom has no layout, so a responsive chart would measure 0 x 0 and draw nothing: give it a size
vi.mock("recharts", async (orig) => {
  const actual = await orig();
  const { cloneElement } = await import("react");
  return { ...actual, ResponsiveContainer: ({ children, height }) => cloneElement(children, { width: 600, height: typeof height === "number" ? height : 56 }) };
});

import Dashboard from "../index";
import { ThemeProvider } from "../../theme-provider";
import { ago, compactAmount, dayLabel, monthYearLabel, opsRows, recentLink } from "../helpers";
import { formatDate } from "../../../utils/format";

const show = (url = "/dashboard") => render(<ThemeProvider><MemoryRouter initialEntries={[url]}><Dashboard /></MemoryRouter></ThemeProvider>);
const openTab = async (name) => {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
  await waitFor(() => expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true"));
};
const widget = (title) => screen.getByText(title, { selector: "h3, h2" }).closest("[data-slot='card']");
const href = (el) => el.getAttribute("href");
const plain = (text) => text.replace(/\u00a0/g, " "); // Intl puts a no-break space between the currency and the figure

let errors;
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(errors, "the page logs no errors or React warnings").not.toHaveBeenCalled();
  errors.mockRestore();
});

// ---------------------------------------------------------------- fixtures (the shapes the server returns)

const PERIOD = { id: "month", from: "2026-10-01", to: "2026-10-05", previousFrom: "2026-09-01", previousTo: "2026-09-05" };
const MONTHS = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

const SUMMARY = {
  currency: "AED", generatedAt: "2026-10-05T09:00:00.000Z",
  company: { name: "Test Foods LLC", emirate: "Sharjah" },
  period: PERIOD,
  headline: { revenue: 640, previousRevenue: 300, changePct: 113.33, grossProfit: 300, grossMarginPct: 46.88, netProfit: 250, invoices: 3, averageInvoice: 223.33 },
  collection: { receipts: 100, invoiced: 702, ratePct: 14.2 },
  ops: {
    activeOrders: { count: 3, total: 5 }, pendingPurchaseOrders: { count: 1, total: 1 },
    lowStock: { count: 1, total: 2 }, newCustomers: { count: 0, total: 5 },
  },
  monthly: MONTHS.map((month, i) => ({ month, revenue: [0, 0, 0, 180, 450, 300, 640, 0][i] ?? 0, purchases: 0, grossProfit: 0, netProfit: 0 })),
  peak: { month: "2026-07", revenue: 720000 },
  topProduct: { itemId: "RICE", stockId: "s1", name: "Rice", revenue: 640, previousRevenue: 300, changePct: 113.33, spark: ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((month, i) => ({ month, revenue: [0, 0, 180, 150, 300, 640, 640][i] })) },
  vat: { from: "2026-10-01", to: "2026-10-05", quarter: 4, year: 2026, hasActivity: true, outputVat: 53, recoverableVat: 5, net: 48, position: "payable", unclassifiedLines: 1, spark: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((month, i) => ({ month, outputVat: [0, 9, 22.5, 15, 30.5, 53][i] })) },
  attention: [
    { key: "draft-sales", count: 2, text: "2 sales orders are waiting for approval.", to: "/sales-order" },
    { key: "unclassified-vat", count: 1, text: "1 line in this quarter's VAT has no tax treatment.", to: "/vat-reports" },
    { key: "expired", count: 1, text: "1 batch has expired.", to: "/stock-reports?tab=expiry" },
  ],
  recent: [
    { voucherId: "v1", voucherNo: "SI-2026-0003", voucherType: "sales_order", typeLabel: "Sales invoice", date: "2026-10-05T08:00:00.000Z", party: "Bin Zayed", narration: "", amount: 30, status: "Unpaid" },
    { voucherId: "v2", voucherNo: "RV-2026-0001", voucherType: "receipt", typeLabel: "Receipt", date: "2026-10-04T20:00:00.000Z", party: "Al Noor", narration: "", amount: 100, status: "Posted" },
    { voucherId: "v3", voucherNo: "OB-2026-0001", voucherType: "opening", typeLabel: "Opening balance", date: "2026-09-01T20:00:00.000Z", party: "", narration: "Go-live", amount: 12, status: "Posted" },
  ],
};
SUMMARY.monthly = SUMMARY.monthly.map((r, i) => ({ ...r, revenue: [0, 0, 0, 0, 180, 450, 300, 640][i] }));
SUMMARY.peak = { month: "2026-10", revenue: 640 };

const ANALYTICS = {
  currency: "AED", period: PERIOD,
  weekly: ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].map((date, i) => ({ date, orders: [0, 1, 0, 0, 2, 0, 3][i], returns: [0, 0, 0, 0, 0, 0, 1][i] })),
  customerMix: { total: 640, rows: [{ key: "c1", name: "Al Noor", value: 510, sharePct: 79.7 }, { key: "c2", name: "Bin Zayed", value: 130, sharePct: 20.3 }] },
  performance: { collectionRatePct: 14.2, grossMarginPct: 46.9, stockAvailabilityPct: 100, itemsInStock: 2, activeItems: 2 },
  monthly: MONTHS.map((month, i) => ({ month, sales: [0, 0, 0, 0, 180, 450, 300, 640][i], purchases: [0, 0, 0, 0, 500, 2000, 440, 100][i], grossProfit: [0, 0, 0, 0, 30, 150, 100, 300][i] })),
  categorySales: { currentMonth: "2026-10", previousMonth: "2026-09", rows: [{ name: "Grains", current: 640, previous: 300 }] },
  categoryMonths: { months: ["2026-08", "2026-09", "2026-10"], rows: [{ name: "Grains", values: [150, 300, 640] }, { name: "Oils", values: [300, 0, 0] }] },
  cashFlow: { accounts: 2, months: MONTHS.map((month, i) => ({ month, inflow: i === 7 ? 5100 : 0, outflow: i === 7 ? 300 : 0 })) },
  kpis: [
    { key: "open-sales", label: "Open sales orders", value: 42, count: 2, to: "/sales-order" },
    { key: "open-purchases", label: "Open purchase orders", value: 105, count: 1, to: "/purchase-order" },
    { key: "receipts-week", label: "Receipts this week", value: 100, previous: 0, changePct: null, to: "/receipt-voucher" },
    { key: "payments-week", label: "Payments this week", value: 300, previous: 200, changePct: 50, to: "/payment-voucher" },
  ],
  radar: {
    categories: [{ key: "c0", name: "Grains" }, { key: "c1", name: "Oils" }],
    metrics: ["Volume", "Revenue", "Margin", "Stock value", "Customers served"].map((metric) => ({ metric, c0: 100, c1: 60 })),
    facts: [],
  },
  pipeline: [{ key: "created", label: "Created", value: 5 }, { key: "approved", label: "Approved", value: 3 }, { key: "paid-in-part", label: "Part-paid or paid", value: 1 }, { key: "paid", label: "Fully paid", value: 1 }],
  settlement: [
    { key: "paid", label: "Paid", count: 1, amount: 63 }, { key: "part-paid", label: "Part-paid", count: 0, amount: 0 },
    { key: "overdue", label: "Unpaid, overdue", count: 4, amount: 120 }, { key: "not-due", label: "Unpaid, not yet due", count: 0, amount: 0 },
  ],
  topCustomers: [{ partyId: "c1", name: "Al Noor", netRevenue: 510 }, { partyId: "c2", name: "Bin Zayed", netRevenue: 130 }],
  ageing: [{ key: "current", label: "Not yet due", receivables: 1000, payables: 2000 }, { key: "d1_30", label: "1-30 days", receivables: 500, payables: 0 }, { key: "d31_60", label: "31-60 days", receivables: 0, payables: 0 }, { key: "d61_90", label: "61-90 days", receivables: 0, payables: 0 }, { key: "d90plus", label: "Over 90 days", receivables: 47, payables: 0 }],
  topVendors: [{ partyId: "v2", name: "Delta Foods", purchases: 100, previous: 80, changePct: 25 }, { partyId: "v1", name: "Gulf Mills", purchases: 50, previous: 0, changePct: null }],
  collections: ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map((weekStart, i) => ({ weekStart, receipts: i * 10, invoiced: i * 20 })),
  treemap: [{ itemId: "RICE", name: "Rice", size: 640 }, { itemId: "OIL", name: "Oil", size: 300 }],
  categoryMargin: { averagePct: 30, rows: [{ key: "k1", name: "Oils", revenue: 300, marginPct: 40 }, { key: "k2", name: "Grains", revenue: 150, marginPct: 20 }] },
  // 20 + 45 - 25.7 = 39.3 days
  businessFlow: {
    statement: { revenue: 1000, directCosts: 700, grossProfit: 300, operatingExpenses: 80, otherIncome: 30, netProfit: 250 },
    previous: { revenue: 800, netProfit: 100, revenueChangePct: 25 },
    stages: { bought: 500, stock: 2050, sold: 1000, collected: 400, owedByCustomers: 1547, owedToVendors: 2000 },
    cycle: { from: "2026-07-08", to: "2026-10-05", days: 90, minDays: 14, enough: true, dso: 20, dpo: 25.7, dio: 45, cycleDays: 39.3, receivables: 1547, payables: 2000, stockValue: 2050, invoiced: 945, purchased: 525, cogs: 600 },
  },
  hourly: [{ hour: 8, mon: 1, tue: 0, wed: 2, thu: 0, fri: 0, weekend: 0 }, { hour: 10, mon: 0, tue: 0, wed: 0, thu: 3, fri: 0, weekend: 1 }],
};

const SALES = {
  currency: "AED", period: PERIOD,
  orders: { count: 3, previous: 2, changePct: 50 },
  averageOrder: { value: 223.33, previous: 200, changePct: 11.67 },
  approvedShare: { pct: 60, previousPct: 50, approved: 3, created: 5 },
  monthly: ANALYTICS.monthly.map(({ month, sales, purchases }) => ({ month, sales, purchases })),
  bestSellers: [{ itemId: "RICE", name: "Rice", revenue: 640, changePct: 113.33, fillPct: 100 }, { itemId: "OIL", name: "Oil", revenue: 320, changePct: null, fillPct: 50 }],
  daily: ANALYTICS.weekly,
  topCustomers: [{ partyId: "c1", name: "Al Noor", netRevenue: 510 }, { partyId: "c2", name: "Bin Zayed", netRevenue: 130 }],
};

const INVENTORY = {
  currency: "AED", period: PERIOD,
  totals: { value: 2050, items: 2, reorderItems: 1, expiring: 1, expired: 1, agreesWithLedger: true },
  categories: [{ key: "k1", name: "Oils", items: 1, value: 1240, sharePct: 60.5 }, { key: "k2", name: "Grains", items: 1, value: 810, sharePct: 39.5 }],
  mix: [{ key: "k1", name: "Oils", value: 1240, sharePct: 60.5 }, { key: "k2", name: "Grains", value: 810, sharePct: 39.5 }],
  lowStock: [{ stockId: "s1", itemName: "Rice", qty: 81, unit: "kg", reorderLevel: 500, status: "below" }],
  batches: [
    { batchId: "b1", stockId: "s2", itemName: "Oil", batchNumber: "O-OLD", qtyOnHand: 20, unit: "ltr", expiryDate: "2026-10-02T00:00:00.000Z", daysToExpiry: -3, expired: true },
    { batchId: "b2", stockId: "s2", itemName: "Oil", batchNumber: "O1", qtyOnHand: 40, unit: "ltr", expiryDate: "2026-10-15T00:00:00.000Z", daysToExpiry: 10, expired: false },
  ],
  stockValueTrend: { available: true, months: MONTHS.map((month, i) => ({ month, value: [0, 0, 0, 0, 350, 2050, 2290, 2050][i] })) },
  // 2,290 + 100 bought - 10 adjusted down - 330 sold (at cost) = 2,050
  stockFlow: { from: "2026-10-01", to: "2026-10-05", opening: 2290, purchases: 100, salesReturns: 0, adjustments: -10, purchaseReturns: 0, sales: 330, writeOffs: 0, closing: 2050 },
};

const REPORTS = {
  currency: "AED", period: PERIOD, grossProfit: 300, netProfit: 250,
  vat: { from: "2026-10-01", to: "2026-10-05", outputVat: 53, recoverableVat: 5, net: 48, position: "payable", hasActivity: true },
  valueGrowth: MONTHS.map((month, i) => ({ month, grossProfit: [0, 0, 0, 0, 30, 150, 100, 300][i], netProfit: [0, 0, 0, 0, 10, -40, 60, 250][i], revenue: 0 })),
  // 1,000 revenue - 700 cost of goods = 300 gross; + 30 other income - 80 operating expenses = 250 net
  profitFlow: { revenue: 1000, directCosts: 700, grossProfit: 300, operatingExpenses: 80, otherIncome: 30, netProfit: 250 },
  expenses: {
    total: 80,
    rows: [{ key: "g1", name: "Rent", amount: 50, sharePct: 62.5 }, { key: "g2", name: "Utilities", amount: 20, sharePct: 25 }, { key: "others", name: "Other", amount: 10, sharePct: 12.5 }],
  },
  vouchers: [{ voucherType: "receipt", amount: 100 }, { voucherType: "payment", amount: 300 }, { voucherType: "journal", amount: 5000 }, { voucherType: "contra", amount: 1000 }, { voucherType: "expense", amount: 0 }],
  ageing: ANALYTICS.ageing,
};

// What the server returns for a company with nothing posted yet
const NOTHING = {
  summary: {
    ...SUMMARY, company: { name: null, emirate: null },
    headline: { revenue: 0, previousRevenue: 0, changePct: null, grossProfit: 0, grossMarginPct: null, netProfit: 0, invoices: 0, averageInvoice: null },
    collection: { receipts: 0, invoiced: 0, ratePct: null },
    ops: { activeOrders: { count: 0, total: 0 }, pendingPurchaseOrders: { count: 0, total: 0 }, lowStock: { count: 0, total: 0 }, newCustomers: { count: 0, total: 0 } },
    monthly: MONTHS.map((month) => ({ month, revenue: 0, purchases: 0, grossProfit: 0, netProfit: 0 })), peak: null, topProduct: null,
    vat: { ...SUMMARY.vat, hasActivity: false, outputVat: 0, recoverableVat: 0, net: 0, position: "nil", unclassifiedLines: 0 },
    attention: [], recent: [],
  },
  analytics: {
    ...ANALYTICS,
    weekly: ANALYTICS.weekly.map((w) => ({ ...w, orders: 0, returns: 0 })),
    customerMix: { total: 0, rows: [] },
    performance: { collectionRatePct: null, grossMarginPct: null, stockAvailabilityPct: null, itemsInStock: 0, activeItems: 0 },
    monthly: ANALYTICS.monthly.map((x) => ({ ...x, sales: 0, purchases: 0, grossProfit: 0 })),
    categorySales: { currentMonth: "2026-10", previousMonth: "2026-09", rows: [] },
    categoryMonths: { months: ["2026-08", "2026-09", "2026-10"], rows: [] },
    cashFlow: { accounts: 0, months: ANALYTICS.cashFlow.months.map((x) => ({ ...x, inflow: 0, outflow: 0 })) },
    kpis: ANALYTICS.kpis.map((x) => ({ ...x, value: 0, count: x.count === undefined ? undefined : 0, previous: x.previous === undefined ? undefined : 0, changePct: x.changePct === undefined ? undefined : null })),
    radar: { categories: [], metrics: [], facts: [] },
    pipeline: ANALYTICS.pipeline.map((x) => ({ ...x, value: 0 })),
    settlement: ANALYTICS.settlement.map((x) => ({ ...x, count: 0, amount: 0 })),
    topCustomers: [], ageing: ANALYTICS.ageing.map((x) => ({ ...x, receivables: 0, payables: 0 })), topVendors: [],
    collections: ANALYTICS.collections.map((x) => ({ ...x, receipts: 0, invoiced: 0 })), treemap: [], categoryMargin: { averagePct: null, rows: [] }, hourly: [],
    businessFlow: {
      statement: { revenue: 0, directCosts: 0, grossProfit: 0, operatingExpenses: 0, otherIncome: 0, netProfit: 0 },
      previous: { revenue: 0, netProfit: 0, revenueChangePct: null },
      stages: { bought: 0, stock: 0, sold: 0, collected: 0, owedByCustomers: 0, owedToVendors: 0 },
      cycle: { from: "2026-10-05", to: "2026-10-05", days: 1, minDays: 14, enough: false, dso: null, dpo: null, dio: null, cycleDays: null, receivables: 0, payables: 0, stockValue: 0, invoiced: 0, purchased: 0, cogs: 0 },
    },
  },
  sales: {
    ...SALES, orders: { count: 0, previous: 0, changePct: null }, averageOrder: { value: null, previous: null, changePct: null },
    approvedShare: { pct: null, previousPct: null, approved: 0, created: 0 },
    monthly: SALES.monthly.map((x) => ({ ...x, sales: 0, purchases: 0 })), bestSellers: [], daily: ANALYTICS.weekly.map((w) => ({ ...w, orders: 0, returns: 0 })), topCustomers: [],
  },
  inventory: {
    ...INVENTORY, totals: { value: 0, items: 0, reorderItems: 0, expiring: 0, expired: 0, agreesWithLedger: null }, categories: [], mix: [], lowStock: [], batches: [],
    stockValueTrend: { available: false, months: INVENTORY.stockValueTrend.months.map((x) => ({ ...x, value: 0 })) },
    stockFlow: { from: "2026-10-01", to: "2026-10-05", opening: 0, purchases: 0, salesReturns: 0, adjustments: 0, purchaseReturns: 0, sales: 0, writeOffs: 0, closing: 0 },
  },
  reports: {
    ...REPORTS, grossProfit: 0, netProfit: 0, vat: { ...REPORTS.vat, outputVat: 0, recoverableVat: 0, net: 0, position: "nil", hasActivity: false },
    profitFlow: { revenue: 0, directCosts: 0, grossProfit: 0, operatingExpenses: 0, otherIncome: 0, netProfit: 0 }, expenses: { total: 0, rows: [] },
    valueGrowth: REPORTS.valueGrowth.map((x) => ({ ...x, grossProfit: 0, netProfit: 0 })), vouchers: REPORTS.vouchers.map((v) => ({ ...v, amount: 0 })), ageing: ANALYTICS.ageing.map((x) => ({ ...x, receivables: 0, payables: 0 })),
  },
};

const busy = () => {
  m.summary.mockResolvedValue(SUMMARY);
  m.analytics.mockResolvedValue(ANALYTICS);
  m.sales.mockResolvedValue(SALES);
  m.inventory.mockResolvedValue(INVENTORY);
  m.reports.mockResolvedValue(REPORTS);
};
const empty = () => {
  m.summary.mockResolvedValue(NOTHING.summary);
  m.analytics.mockResolvedValue(NOTHING.analytics);
  m.sales.mockResolvedValue(NOTHING.sales);
  m.inventory.mockResolvedValue(NOTHING.inventory);
  m.reports.mockResolvedValue(NOTHING.reports);
};
const loaded = () => screen.findByText("Collection rate");
const ready = async () => {
  await loaded();
  await screen.findByText("Weekly order pulse");
  await waitFor(() => expect(m.analytics).toHaveBeenCalled());
  await screen.findByText("Open sales orders");
};

// ---------------------------------------------------------------- the pure rules

describe("rules", () => {
  it("opsRows: the tag and tone follow the count", () => {
    const rows = (ops) => Object.fromEntries(opsRows(ops).map((r) => [r.key, [r.value, r.tag, r.tone]]));
    const zero = { count: 0, total: 0 };
    expect(rows({ activeOrders: { count: 3, total: 5 }, pendingPurchaseOrders: { count: 1, total: 1 }, lowStock: { count: 1, total: 2 }, newCustomers: { count: 2, total: 9 } })).toEqual({
      orders: ["3/5", "Active", "ok"], pos: ["1/1", "Pending", "warn"], stock: ["1/2", "Alert", "danger"], customers: ["2/9", "New", "muted"],
    });
    expect(rows({ activeOrders: zero, pendingPurchaseOrders: { count: 0, total: 4 }, lowStock: { count: 0, total: 7 }, newCustomers: zero })).toEqual({
      orders: ["0/0", "None", "muted"], pos: ["0/4", "Clear", "ok"], stock: ["0/7", "OK", "ok"], customers: ["0/0", "None", "muted"],
    });
    expect(opsRows({ activeOrders: zero, pendingPurchaseOrders: zero, lowStock: zero, newCustomers: zero })[2]).toMatchObject({ tag: "None", tone: "muted" });
  });

  it("ago: a typed date reads by day, a moment by minutes and hours", () => {
    const now = new Date("2026-10-05T10:00:00.000Z"); // 14:00 in Dubai
    expect(ago("2026-10-05T09:58:00.000Z", now)).toBe("2 min ago");
    expect(ago("2026-10-05T09:59:50.000Z", now)).toBe("Just now");
    expect(ago("2026-10-05T07:00:00.000Z", now)).toBe("3 hours ago");
    expect(ago("2026-10-05T09:00:00.000Z", now)).toBe("1 hour ago");
    expect(ago("2026-10-04T20:00:00.000Z", now)).toBe("Today", "midnight in Dubai is a date typed without a time");
    expect(ago("2026-10-03T20:00:00.000Z", now)).toBe("Yesterday");
    expect(ago("2026-10-01T20:00:00.000Z", now)).toBe("3 days ago");
    expect(ago("2026-10-04T05:00:00.000Z", now)).toBe("Yesterday");
    expect(ago("2026-10-01T05:00:00.000Z", now)).toBe("4 days ago");
    expect(ago("2026-08-01T05:00:00.000Z", now)).toBe(formatDate("2026-08-01T05:00:00.000Z"));
    expect(ago("not a date", now)).toBe("");
  });

  it("compactAmount: plain under 1,000, one decimal to 10k, then 12k and 1.3M, signs kept", () => {
    expect([0, 400, 999, 1000, 1250, 9960, 12400, 999600, 1250000, 2500000000].map(compactAmount)).toEqual(
      ["0", "400", "999", "1k", "1.3k", "10k", "12k", "1M", "1.3M", "2.5B"]
    );
    expect([-400, -1250, -12400, -1250000, -0, 0.4, 0.005, 12.5].map(compactAmount)).toEqual(["-400", "-1.3k", "-12k", "-1.3M", "0", "0.4", "0.01", "12.5"]);
    expect([undefined, null, "abc", NaN].map(compactAmount)).toEqual(["0", "0", "0", "0"]);
    // ticks a step apart never collapse into one label, which "1k, 1k, 2k, 2k" did
    const ticks = [0, 600, 1200, 1800, 2400].map(compactAmount);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("recentLink: each voucher opens the page it lives on, anything else the day book", () => {
    expect(recentLink("sales_order")).toBe("/sales-order");
    expect(recentLink("credit_note")).toBe("/debit-credit-notes");
    expect(recentLink("opening_stock")).toBe("/ledger-reports?tab=daybook");
  });
});

// ---------------------------------------------------------------- the restored design

describe("header and tabs", () => {
  beforeEach(busy);

  it("keeps the Operations Overview header with the company's own emirate and name", async () => {
    show();
    await loaded();
    expect(screen.getByRole("heading", { level: 1, name: "Operations Overview" })).toBeInTheDocument();
    expect(screen.getByText("Sharjah, UAE")).toBeInTheDocument();
    expect(screen.getByText(/^Test Foods LLC · AED · /)).toBeInTheDocument();
  });

  it("hides the emirate badge when the company has none, and falls back to the brand name", async () => {
    m.summary.mockResolvedValue({ ...SUMMARY, company: { name: null, emirate: null } });
    m.analytics.mockResolvedValue(ANALYTICS);
    show();
    await loaded();
    expect(screen.queryByText(/, UAE$/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Your company · AED · /)).toBeInTheDocument();
  });

  it("has the four tabs, and only the Dashboard tab is fetched until another is opened", async () => {
    show();
    await ready();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Dashboard", "Sales", "Inventory", "Reports"]);
    expect(m.summary).toHaveBeenCalledTimes(1);
    expect(m.analytics).toHaveBeenCalledTimes(1);
    expect([m.sales, m.inventory, m.reports].map((f) => f.mock.calls.length)).toEqual([0, 0, 0]);
    await openTab("Sales");
    await waitFor(() => expect(m.sales).toHaveBeenCalledTimes(1));
    await openTab("Dashboard");
    await openTab("Sales");
    expect(m.sales).toHaveBeenCalledTimes(1);
  });

  it("the period control is above the tabs, so it is there whichever tab is open", async () => {
    show();
    await ready();
    const control = screen.getByRole("combobox", { name: "Period" });
    expect(control).toHaveValue("month");
    await openTab("Inventory");
    expect(screen.getByRole("combobox", { name: "Period" })).toBe(control);
  });

  it("changing the period fetches every part again for it", async () => {
    show();
    await ready();
    expect(m.summary).toHaveBeenLastCalledWith({ period: "month" });
    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "week" } });
    await waitFor(() => expect(m.summary).toHaveBeenLastCalledWith({ period: "week" }));
    expect(m.analytics).toHaveBeenLastCalledWith({ period: "week" });
    await openTab("Sales");
    await waitFor(() => expect(m.sales).toHaveBeenLastCalledWith({ period: "week" }));
  });
});

describe("the Dashboard tab with real figures", () => {
  beforeEach(busy);

  it("collection rate replaces the rank: receipts against invoices, with the amounts behind it", async () => {
    show();
    await ready();
    const card = screen.getByText("Collection rate").closest("[data-slot='card']");
    expect(card).toHaveTextContent("14.2%");
    expect(within(card).getByText("Receipts vs invoices this month")).toBeInTheDocument();
    expect(card).toHaveTextContent("AED 100.00 received of AED 702.00 invoiced");
    expect(within(card).getByRole("progressbar", { name: "Collection rate" })).toBeInTheDocument();
  });

  it("ops status shows the real counts with their tone, each linking to its page", async () => {
    show();
    await ready();
    const card = widget("Ops status");
    const rows = within(card).getAllByRole("link");
    expect(rows.map((r) => [r.textContent, href(r)])).toEqual([
      ["Active orders3/5Active", "/sales-order"],
      ["Pending POs1/1Pending", "/purchase-order"],
      ["Low stock SKUs1/2Alert", "/stock-reports?tab=reorder"],
      ["New customers0/5None", "/customer-creation"],
    ]);
  });

  it("the header figures are this period's sales value, margin and average order", async () => {
    show();
    await ready();
    const row = screen.getByText("Sales value").closest(".grid");
    expect(row).toHaveTextContent("AED 640.00");
    expect(row).toHaveTextContent("46.9%");
    expect(row).toHaveTextContent("AED 223.33");
    expect(screen.getByText("Live sales growth")).toBeInTheDocument();
    expect(screen.getByText("Peak Oct · AED 640.00")).toBeInTheDocument();
  });

  it("the three header figures cannot run into each other in the narrow centre column: they start smaller at xl and never size to their content", async () => {
    show();
    await ready();
    // the period control is above the tabs (it follows every tab), so it is no longer in this card at all
    const row = screen.getByText("Sales value").closest(".grid");
    expect(row.parentElement).not.toContainElement(screen.getByRole("combobox", { name: "Period" }));
    for (const label of ["Sales value", "Avg. margin", "Avg. order"]) {
      const figure = screen.getByText(label).nextElementSibling;
      expect(figure).toHaveClass("xl:text-2xl", "2xl:text-3xl");
      expect(figure.parentElement).toHaveClass("min-w-0");
    }
  });

  it("top product is the real best seller, Hot only while it is growing", async () => {
    const { unmount } = show();
    await ready();
    let card = screen.getByText("Top product").closest("[data-slot='card']");
    expect(within(card).getByRole("link", { name: "Rice" })).toHaveAttribute("href", "/stock-detail/s1");
    expect(card).toHaveTextContent("AED 640.00 · +113.3%");
    expect(within(card).getByText("Hot")).toBeInTheDocument();
    unmount();

    m.summary.mockResolvedValue({ ...SUMMARY, topProduct: { ...SUMMARY.topProduct, changePct: -12.5 } });
    show();
    await ready();
    card = screen.getByText("Top product").closest("[data-slot='card']");
    expect(card).toHaveTextContent("AED 640.00 · -12.5%");
    expect(within(card).queryByText("Hot")).not.toBeInTheDocument();
  });

  it("VAT this quarter says payable or refundable and never a due date", async () => {
    const { unmount } = show();
    await ready();
    let card = screen.getByRole("link", { name: "VAT this quarter" }).closest("[data-slot='card']");
    expect(href(screen.getByRole("link", { name: "VAT this quarter" }))).toBe("/vat-reports");
    expect(card).toHaveTextContent("Payable");
    expect(card).toHaveTextContent("AED 48.00");
    expect(card).toHaveTextContent("Output AED 53.00 · Input AED 5.00");
    expect(card).toHaveTextContent("1 line has no tax treatment");
    expect(card).not.toHaveTextContent(/due/i);
    unmount();

    m.summary.mockResolvedValue({ ...SUMMARY, vat: { ...SUMMARY.vat, net: -20, position: "refundable", unclassifiedLines: 0 } });
    show();
    await ready();
    card = screen.getByRole("link", { name: "VAT this quarter" }).closest("[data-slot='card']");
    expect(card).toHaveTextContent("Refundable");
    expect(card).toHaveTextContent("AED 20.00");
  });

  it("the beige card lists what needs attention, each item a link", async () => {
    show();
    await ready();
    const card = screen.getByText("Needs attention").closest("[data-slot='card']");
    expect(within(card).getByRole("heading", { level: 3 })).toHaveTextContent("3 things to look at");
    expect(within(card).getAllByRole("link").map((a) => [a.textContent, href(a)])).toEqual([
      ["2 sales orders are waiting for approval.", "/sales-order"],
      ["1 line in this quarter's VAT has no tax treatment.", "/vat-reports"],
      ["1 batch has expired.", "/stock-reports?tab=expiry"],
    ]);
    expect(card.className).toContain("bg-brand-soft");
  });

  it("recent activity lists the latest vouchers with when, a status and a link", async () => {
    show();
    await ready();
    const card = screen.getByText("Recent activity").closest("[data-slot='card']");
    const links = within(card).getAllByRole("link");
    expect(links.map(href)).toEqual(["/ledger-reports?tab=daybook", "/sales-order", "/receipt-voucher", "/ledger-reports?tab=daybook"]);
    expect(links[1]).toHaveTextContent("Sales invoice SI-2026-0003 · Bin Zayed");
    expect(links[1]).toHaveTextContent("Unpaid");
    expect(links[2]).toHaveTextContent("Posted");
    expect(links[3]).toHaveTextContent("Opening balance OB-2026-0001 · Go-live");
    expect(within(card).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/ledger-reports?tab=daybook");
    expect(links[1].textContent).toMatch(/(Just now|min ago|hours? ago|Today|Yesterday|days ago|\d{2}\/\d{2}\/\d{4})/);
  });

  it("keeps the quick actions", async () => {
    show();
    await ready();
    expect(["Sales Order", "Purchase Order", "Stock Items", "VAT Reports"].every((n) => screen.getByRole("button", { name: n }))).toBe(true);
  });

  it("draws the charts from the series, with their real titles", async () => {
    show();
    await ready();
    for (const t of ["Weekly order pulse", "Customer mix", "Performance", "Sales vs purchase vs profit", "Category sales", "Category performance by month", "Cash inflow vs outflow", "Category health radar", "Order pipeline", "Invoice settlement", "Top customers", "Receivables vs payables ageing", "Top vendors", "Collections vs invoicing", "SKU revenue map", "Documents created by hour"]) {
      expect(screen.getByText(t, { selector: "h3" }), t).toBeInTheDocument();
    }
    expect(widget("Weekly order pulse").querySelector(".recharts-bar-rectangle")).not.toBeNull();
    expect(widget("Sales vs purchase vs profit").querySelector(".recharts-bar-rectangle")).not.toBeNull();
    expect(widget("Documents created by hour").querySelector(".recharts-bar-rectangle")).not.toBeNull();
    expect(widget("Category sales")).toHaveTextContent("This month vs last month");
  });

  it("customer mix, performance, settlement, vendors and the pipeline carry the real numbers", async () => {
    show();
    await ready();
    expect(widget("Customer mix")).toHaveTextContent("Al Noor79.7%");
    expect(widget("Customer mix")).toHaveTextContent("Bin Zayed20.3%");
    expect(widget("Performance")).toHaveTextContent("Collection rate 14.2%");
    expect(widget("Performance")).toHaveTextContent("Gross margin 46.9%");
    expect(widget("Performance")).toHaveTextContent("Stock availability 100.0%");
    expect(widget("Performance")).toHaveTextContent("Collection rate · gross margin · stock availability");
    expect(widget("Invoice settlement")).toHaveTextContent("Paid 1");
    expect(widget("Invoice settlement")).toHaveTextContent("Unpaid, overdue 4");
    expect(widget("Top vendors")).toHaveTextContent("Delta Foods");
    expect(widget("Top vendors")).toHaveTextContent("AED 100.00 · +25.0%");
    expect(widget("Top vendors")).toHaveTextContent("Gulf Mills");
    expect(widget("Order pipeline")).toHaveTextContent("Draft → approved → part-paid or paid → fully paid");
  });

  it("four KPI tiles: open orders, and receipts and payments this week against last", async () => {
    show();
    await ready();
    const tiles = ["Open sales orders", "Open purchase orders", "Receipts this week", "Payments this week"].map((label) => screen.getByText(label).closest("a"));
    expect(tiles.map(href)).toEqual(["/sales-order", "/purchase-order", "/receipt-voucher", "/payment-voucher"]);
    expect(tiles[0]).toHaveTextContent("AED 42.00");
    expect(tiles[0]).toHaveTextContent("2 orders waiting for approval");
    expect(tiles[1]).toHaveTextContent("1 order waiting for approval");
    expect(tiles[2]).toHaveTextContent("Nothing to compare with last week");
    expect(tiles[3]).toHaveTextContent("+50.0% vs the same days last week");
  });
});

describe("the other tabs", () => {
  beforeEach(busy);

  it("Sales: orders, average order, best sellers with growth, and the charts", async () => {
    show();
    await ready();
    await openTab("Sales");
    await screen.findByText("Best sellers");
    const tiles = screen.getByText("Orders this month").closest("[data-slot='card']");
    expect(tiles).toHaveTextContent("3");
    expect(tiles).toHaveTextContent("+50.0% on the month before");
    expect(screen.getByText("Avg. order").closest("[data-slot='card']")).toHaveTextContent("AED 223.33");
    expect(screen.getByText("Orders approved").closest("[data-slot='card']")).toHaveTextContent("60.0%");
    expect(screen.getByText("Orders approved").closest("[data-slot='card']")).toHaveTextContent("+10.0 points on the month before");
    const best = widget("Best sellers");
    expect(best).toHaveTextContent("1. Rice+113.3%");
    expect(best).toHaveTextContent("AED 640.00");
    expect(best).toHaveTextContent("2. Oil");
    expect(within(best).getAllByRole("progressbar").map((p) => p.getAttribute("aria-label"))).toEqual(["Rice against the best seller", "Oil against the best seller"]);
    for (const t of ["Sales vs Purchase", "Daily order trend", "Sales by customer"]) expect(screen.getByText(t)).toBeInTheDocument();
    expect(widget("Sales vs Purchase").querySelector(".recharts-bar-rectangle")).not.toBeNull();
  });

  it("Inventory: stock by category, alerts that link to the item and the batch, and the ledger's stock value", async () => {
    show();
    await ready();
    await openTab("Inventory");
    await screen.findByText("Stock alerts");
    expect(within(widget("Inventory mix").parentElement).getAllByText("Oils").length).toBeGreaterThanOrEqual(1);
    const oils = screen.getAllByText("Oils").map((e) => e.closest("[data-slot='card']")).find((c) => c.textContent.includes("SKU"));
    expect(oils).toHaveTextContent("1 SKU · 60.5% · AED 1,240.00");
    expect(widget("Inventory mix")).toHaveTextContent("AED 2,050.00");
    const alerts = widget("Stock alerts");
    expect(within(alerts).getAllByRole("link").map(href)).toEqual(["/stock-detail/s1", "/batches", "/batches"]);
    expect(alerts).toHaveTextContent("RiceBelow reorder level · level 500");
    expect(alerts).toHaveTextContent("Batch O-OLD · expired");
    expect(alerts).toHaveTextContent("Batch O1 · expires");
    expect(widget("Stock value trend")).toHaveTextContent("Month-end balance of the Inventory account");
    expect(screen.queryByText(/demo series/i)).not.toBeInTheDocument();
  });

  it("Reports: gross and net profit, VAT, voucher totals, ageing and the VAT snapshot", async () => {
    show();
    await ready();
    await openTab("Reports");
    await screen.findByText("Value growth");
    // "Gross profit" and "Net profit" are also the names of steps in the profit flow chart: the tile is the one in a link
    const tile = (label) => screen.getAllByText(label).map((el) => el.closest("a")).find(Boolean);
    expect(href(tile("Gross profit"))).toBe("/financial-statements?tab=pl");
    expect(tile("Gross profit")).toHaveTextContent("AED 300.00");
    expect(screen.getByText("VAT payable").closest("a")).toHaveTextContent("AED 48.00");
    expect(tile("Net profit")).toHaveTextContent("AED 250.00");
    expect(screen.getByText("Journal").closest("a")).toHaveTextContent("AED 5,000.00");
    expect(screen.getByText("Expense").closest("a")).toHaveTextContent("None posted");
    expect(widget("VAT snapshot")).toHaveTextContent("Output VATAED 53.00");
    expect(widget("VAT snapshot")).toHaveTextContent("Net payableAED 48.00");
    expect(widget("Receivables vs payables ageing")).toBeInTheDocument();
  });

  it("Reports: the profit flow walks from revenue to net profit, and the expense rows add up to the total", async () => {
    show();
    await ready();
    await openTab("Reports");
    await screen.findByText("Profit flow");
    const flow = widget("Profit flow");
    const label = plain(flow.querySelector("[role='img']").getAttribute("aria-label"));
    expect(label).toBe(
      "Revenue AED 1,000.00; Cost of goods sold minus AED 700.00; Gross profit AED 300.00; Operating expenses minus AED 80.00; Other income plus AED 30.00; Net profit AED 250.00",
    );
    expect(flow.querySelectorAll(".recharts-bar-rectangle").length).toBe(6);
    const spend = widget("Where the expenses go");
    expect(spend).toHaveTextContent("AED 80.00");
    for (const name of ["Rent", "Utilities", "Other"]) expect(within(spend).getByText(name)).toBeInTheDocument();
    expect(widget("Net profit by month").querySelectorAll(".recharts-bar-rectangle").length).toBe(8);
    expect(widget("Net profit by month")).toHaveTextContent("Loss");
  });

  it("Inventory: the stock flow goes from opening to closing value, out-going steps as minus", async () => {
    show();
    await ready();
    await openTab("Inventory");
    await screen.findByText("Stock flow");
    const flow = widget("Stock flow");
    expect(plain(flow.querySelector("[role='img']").getAttribute("aria-label"))).toBe(
      "Opening stock AED 2,290.00; Purchases plus AED 100.00; Sales returns AED 0.00; Adjustments minus AED 10.00; Purchase returns AED 0.00; Sales (at cost) minus AED 330.00; Write-offs AED 0.00; Closing stock AED 2,050.00",
    );
    expect(flow).toHaveTextContent("Opening to closing stock value");
  });

  it("Dashboard: the business flow, from buying to cash, with the statement and the cash cycle", async () => {
    show();
    await ready();
    const section = screen.getByText("From buying to cash").closest("section");
    expect(within(section).getByText("Bought").closest("a")).toHaveAttribute("href", "/purchase-order");
    expect(within(section).getByText("Sold").closest("a")).toHaveTextContent("+25.0% on the period before");
    expect(within(section).getByText("Customers still owe you").closest("a")).toHaveTextContent("AED 1,547");
    expect(widget("Where the revenue went").querySelectorAll("[data-node]")).toHaveLength(6);
    expect(widget("Cash cycle")).toHaveTextContent("39.3 days");
    expect(widget("Cash cycle")).toHaveTextContent("Your cash is tied up for 39.3 days");
  });

  it("Dashboard: margin by category, with the company's margin as the line", async () => {
    show();
    await ready();
    const card = widget("Margin by category");
    expect(card).toHaveTextContent("dashed line is all categories, 30.0%");
    for (const name of ["Oils", "Grains"]) expect(within(card).getByText(name)).toBeInTheDocument();
    expect(card.querySelectorAll(".recharts-bar-rectangle").length).toBe(2);
  });
});

describe("with nothing posted yet", () => {
  beforeEach(empty);

  it("every widget of the Dashboard tab says what is missing in its own space", async () => {
    show();
    await ready();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3); // collection rate, margin, average order
    expect(screen.getByText("No sales posted in the last 8 months")).toBeInTheDocument();
    expect(screen.getByText("No VAT transactions this quarter")).toBeInTheDocument();
    expect(screen.getByText("Nothing needs attention")).toBeInTheDocument();
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByText("No sales invoiced this month")).toBeInTheDocument();
    for (const t of ["No orders or returns in the last 7 days", "No sales or purchases posted in the last 8 months", "No category sales this month or last", "No category sales in the last 3 months", "No cash or bank account set up", "No sales orders this month", "No sales invoices this month", "No receipts or invoices in the last 6 weeks", "No documents created in the last 4 weeks", "Nothing to measure yet", "Nothing owed to you or by you", "No purchases this month"]) {
      expect(screen.getByText(t), t).toBeInTheDocument();
    }
    expect(screen.getAllByText("No sales this month").length).toBeGreaterThanOrEqual(3); // top product, customer mix, top customers
    expect(screen.getByText("No item sales this month")).toBeInTheDocument();
    expect(screen.getByText(/No sales or purchases yet/)).toBeInTheDocument();
    expect(screen.getByText("No revenue posted this month")).toBeInTheDocument();
    expect(screen.getByText(/needs at least 14 days of sales to measure/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN|undefined|Infinity/)).not.toBeInTheDocument();
    expect(widget("Customer mix").querySelector("svg")).toBeNull();
  });

  it("the Sales, Inventory and Reports tabs do the same", async () => {
    show();
    await ready();
    await openTab("Sales");
    await screen.findByText("Best sellers");
    expect(screen.getByText("No item sales this month")).toBeInTheDocument();
    expect(screen.getByText("No approved sales orders in the last 7 days")).toBeInTheDocument();
    expect(screen.getAllByText("No sales this month").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Orders approved").closest("[data-slot='card']")).toHaveTextContent("—");
    await openTab("Inventory");
    await screen.findByText("Stock alerts");
    expect(screen.getAllByText("No stock on hand yet").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("No stock alerts")).toBeInTheDocument();
    expect(screen.getByText("The Inventory account is not set up")).toBeInTheDocument();
    await openTab("Reports");
    await screen.findByText("Value growth");
    expect(screen.getByText("No gross profit posted in the last 8 months")).toBeInTheDocument();
    expect(screen.getByText("No VAT transactions this quarter")).toBeInTheDocument();
    expect(screen.getAllByText("None posted")).toHaveLength(5);
    for (const t of ["No revenue or costs posted this month", "No operating expenses this month", "No profit or loss posted in the last 8 months"]) {
      expect(screen.getByText(t), t).toBeInTheDocument();
    }
    await openTab("Inventory");
    await screen.findByText("Stock alerts");
    expect(screen.getByText("No stock movement in this period")).toBeInTheDocument();
  });
});

describe("axes and points", () => {
  const ticks = (card) => [...card.querySelectorAll(".recharts-yAxis .recharts-cartesian-axis-tick-value")].map((t) => t.textContent);

  it("Value growth marks every month, this month's point included, and its axis reads in plain amounts", async () => {
    const growth = REPORTS.valueGrowth.map((x, i) => ({ ...x, grossProfit: i === 7 ? 400 : 0 }));
    busy();
    m.reports.mockResolvedValue({ ...REPORTS, grossProfit: 400, valueGrowth: growth });
    show();
    await ready();
    await openTab("Reports");
    await screen.findByText("Value growth");
    const card = widget("Value growth");
    // the points are drawn once the chart has finished animating in
    await waitFor(() => expect(card.querySelectorAll(".recharts-area-dots .recharts-dot")).toHaveLength(8), { timeout: 5000 });
    expect(ticks(card)).toEqual(["0", "100", "200", "300", "400"]);
    expect(card.querySelector(".recharts-xAxis")).toHaveTextContent("Oct");
  });

  it("Stock value trend gives each tick its own label", async () => {
    busy();
    show();
    await ready();
    await openTab("Inventory");
    await screen.findByText("Stock value trend");
    const labels = ticks(widget("Stock value trend"));
    expect(labels.length).toBeGreaterThan(2);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("1.2k");
    expect(labels.every((l) => !/^\d+k$/.test(l) || Number(l.slice(0, -1)) >= 1)).toBe(true);
  });

  it("no amount axis anywhere reads 0k, and small amounts stay plain", async () => {
    busy();
    m.analytics.mockResolvedValue({ ...ANALYTICS, ageing: ANALYTICS.ageing.map((b) => ({ ...b, receivables: b.receivables / 10, payables: b.payables / 10 })) });
    show();
    await ready();
    const everyTick = () => [...document.querySelectorAll(".recharts-cartesian-axis-tick-value")].map((t) => t.textContent);
    expect(everyTick().filter((t) => /^-?0k$|\.0k$/.test(t))).toEqual([]);
    for (const tab of ["Sales", "Inventory", "Reports"]) {
      await openTab(tab);
      await waitFor(() => expect(everyTick().length).toBeGreaterThan(0));
      expect(everyTick().filter((t) => /^-?0k$|\.0k$/.test(t)), tab).toEqual([]);
    }
    const ageing = widget("Receivables vs payables ageing");
    expect(ticks(ageing).every((t) => !t.endsWith("k") || Number.parseFloat(t) >= 1)).toBe(true);
  });
});

describe("loading and failing", () => {
  it("shows skeletons, not figures, while a part loads", async () => {
    m.summary.mockReturnValue(new Promise(() => {}));
    m.analytics.mockReturnValue(new Promise(() => {}));
    const { container } = show();
    expect(screen.getByRole("heading", { level: 1, name: "Operations Overview" })).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(10);
    expect(screen.queryByText("Nothing needs attention")).not.toBeInTheDocument();
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();
    expect(screen.queryAllByText(/AED [\d,]+\.\d\d/)).toHaveLength(0);
  });

  it("says what went wrong and tries again when asked", async () => {
    busy();
    m.summary.mockReset();
    m.summary.mockRejectedValueOnce(new Error("The server is not answering")).mockResolvedValueOnce(SUMMARY);
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("The server is not answering");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await loaded();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(m.summary).toHaveBeenCalledTimes(2);
  });

  it("a chart that failed to load says so in its own card instead of staying blank", async () => {
    busy();
    m.analytics.mockRejectedValue(new Error("Charts are down"));
    show();
    await loaded();
    expect(await screen.findByText("Charts are down")).toBeInTheDocument();
    expect(widget("Weekly order pulse")).toHaveTextContent("This could not be loaded.");
    expect(screen.getByText("Collection rate")).toBeInTheDocument();
  });

  it("the refresh button asks every open part again", async () => {
    busy();
    show();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Refresh the figures" }));
    await waitFor(() => expect(m.summary).toHaveBeenCalledTimes(2));
    expect(m.analytics).toHaveBeenCalledTimes(2);
    expect(m.sales).not.toHaveBeenCalled();
  });
});

describe("no dummy content", () => {
  it("shows none of the old sample text or numbers", async () => {
    busy();
    show();
    await ready();
    for (const tab of ["Sales", "Inventory", "Reports"]) {
      await openTab(tab);
      await waitFor(() => expect(m[tab === "Reports" ? "reports" : tab.toLowerCase()]).toHaveBeenCalled());
    }
    await screen.findByText("Value growth");
    const text = document.body.textContent;
    for (const dummy of [/portfolio rank/i, /team hub/i, /collaborate on market analysis/i, /demo series/i, /demo data/i, /client showcase/i, /UAE fleet/i, /emirate sales/i, /Al Quoz/, /JAFZA/, /ICAD/, /Jebel Ali/, /Sharjah Industrial/, /channel mix/i, /branch vs target/i, /Basmati/, /Al Maya/, /Lulu/, /Carrefour/, /delivery sla/i, /warehouse capacity/i, /goal progress/i, /funnel/i, /inquir/i]) {
      expect(text, String(dummy)).not.toMatch(dummy);
    }
  });
});

// ---------------------------------------------------------------- the period filter (src/lib/dashboardPeriod.js)

describe("the period filter", () => {
  // Only the date is faked, so waitFor and the timers behave as they do everywhere else. "Today" is Saturday 10 Oct 2026, in Q4.
  const setToday = (iso = "2026-10-10T08:00:00Z") => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  };
  afterEach(() => vi.useRealTimers());
  beforeEach(busy);

  const pick = (label, value) => fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } });
  const lastAsked = (fn) => fn.mock.calls[fn.mock.calls.length - 1][0];
  // the line under the control, in the person's own date format
  const scopeLine = () => screen.getByRole("region", { name: "Dashboard period" }).textContent;
  // every part that was asked for has answered (the refresh icon stops spinning), so no update is left to land after the test
  const settled = () => waitFor(() => expect(document.querySelector(".animate-spin")).toBeNull());

  it("This year is 1 January to today, sent as from / to to every part, and the line says so in words", async () => {
    setToday();
    show();
    await ready();
    pick("Period", "year");
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ from: "2026-01-01", to: "2026-10-10" }));
    expect(lastAsked(m.analytics)).toEqual({ from: "2026-01-01", to: "2026-10-10" });
    await openTab("Sales");
    await waitFor(() => expect(lastAsked(m.sales)).toEqual({ from: "2026-01-01", to: "2026-10-10" }));
    await openTab("Inventory");
    await waitFor(() => expect(lastAsked(m.inventory)).toEqual({ from: "2026-01-01", to: "2026-10-10" }));
    await openTab("Reports");
    await waitFor(() => expect(lastAsked(m.reports)).toEqual({ from: "2026-01-01", to: "2026-10-10" }));
    expect(scopeLine()).toContain("This year (to date)");
    expect(scopeLine()).toContain(`${formatDate("2026-01-01")} – ${formatDate("2026-10-10")}`);
    await settled();
  });

  it("a specific quarter opens on the last complete one, and Q1 of the same year is one change away", async () => {
    setToday();
    show();
    await ready();
    pick("Period", "quarterOf");
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ from: "2026-07-01", to: "2026-09-30" }));
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveValue("2026");
    expect(screen.getByRole("combobox", { name: "Quarter" })).toHaveValue("3");
    pick("Quarter", "1");
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ from: "2026-01-01", to: "2026-03-31" }));
    pick("Year", "2025");
    pick("Quarter", "4");
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ from: "2025-10-01", to: "2025-12-31" }));
    expect(scopeLine()).toContain("Q4 2025");
    await settled();
  });

  it("never offers a quarter or a month that has not started", async () => {
    setToday("2026-05-02T08:00:00Z"); // second quarter, fifth month
    show();
    await ready();
    pick("Period", "quarterOf");
    expect([...screen.getByRole("combobox", { name: "Quarter" }).options].map((o) => o.value)).toEqual(["1", "2"]);
    pick("Year", "2025");
    expect([...screen.getByRole("combobox", { name: "Quarter" }).options].map((o) => o.value)).toEqual(["1", "2", "3", "4"]);
    pick("Period", "monthOf");
    pick("Year", "2026");
    expect([...screen.getByRole("combobox", { name: "Month" }).options].map((o) => o.textContent)).toEqual(["January", "February", "March", "April", "May"]);
    await settled();
  });

  it("a specific month is asked for as month=YYYY-MM and a previous year as its whole 1 Jan to 31 Dec", async () => {
    setToday();
    show();
    await ready();
    pick("Period", "monthOf");
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ month: "2026-09" }));
    pick("Month", "2");
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ month: "2026-02" }));
    pick("Period", "yearOf");
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ from: "2025-01-01", to: "2025-12-31" }));
    // a previous year offers no current year
    expect([...screen.getByRole("combobox", { name: "Year" }).options].map((o) => o.value)).not.toContain("2026");
    await settled();
  });

  it("a custom range asks for exactly those days, and a range that ends before it starts is explained and not asked for", async () => {
    setToday();
    show();
    await ready();
    pick("Period", "custom");
    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    fireEvent.change(from, { target: { value: "2026-03-05" } });
    fireEvent.change(to, { target: { value: "2026-04-20" } });
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ from: "2026-03-05", to: "2026-04-20" }));
    const calls = m.summary.mock.calls.length;
    fireEvent.change(to, { target: { value: "2026-03-01" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("The period ends before it starts.");
    expect(screen.getByRole("alert")).toHaveTextContent("Still showing Custom range");
    expect(m.summary).toHaveBeenCalledTimes(calls); // nothing was asked for
    expect(lastAsked(m.summary)).toEqual({ from: "2026-03-05", to: "2026-04-20" });
    await settled();
  });

  it("an end date in the future is held at today, and the line says the period has not ended", async () => {
    setToday();
    show();
    await ready();
    pick("Period", "custom");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-12-31" } });
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ from: "2026-09-01", to: "2026-10-10" }));
    expect(scopeLine()).toContain("has not ended yet");
    await settled();
  });

  it("every tab words its figures for the period: a past quarter reads 'in Q3 2026', 'the period before' and '8 months to September 2026'", async () => {
    setToday();
    show();
    await ready();
    pick("Period", "quarterOf");
    await waitFor(() => expect(lastAsked(m.summary)).toEqual({ from: "2026-07-01", to: "2026-09-30" }));
    // Dashboard tab
    await waitFor(() => expect(screen.getByText("Receipts vs invoices in Q3 2026")).toBeInTheDocument());
    expect(screen.getByText(`Weekly, 6 weeks to ${formatDate("2026-09-30")} · AED`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "VAT Q3 2026" })).toBeInTheDocument();
    expect(await screen.findByText(`Receipts, week to ${dayLabel("2026-09-30")}`)).toBeInTheDocument();
    expect(screen.getByText("Sales invoices of Q3 2026 · by how far they are paid (where they stand today)")).toBeInTheDocument();
    expect(screen.getByText(`${monthYearLabel("2026-09")} vs ${monthYearLabel("2026-08")} · AED`)).toBeInTheDocument();
    // Sales
    await openTab("Sales");
    await screen.findByText("Best sellers");
    expect(screen.getByText("Orders in Q3 2026")).toBeInTheDocument();
    expect(screen.getByText("Orders in Q3 2026").closest("[data-slot='card']")).toHaveTextContent("+50.0% on the period before");
    expect(screen.getByText("Monthly AED · 8 months to September 2026")).toBeInTheDocument();
    // Inventory: the value is as at the quarter's end, the alerts are today's
    await openTab("Inventory");
    await screen.findByText("Stock alerts");
    expect(screen.getByText(/Stock value is as at/)).toHaveTextContent(`Stock value is as at ${formatDate("2026-09-30")}`);
    expect(screen.getByText(/Stock value is as at/)).toHaveTextContent("Stock alerts are always today's position.");
    expect(widget("Stock alerts")).toHaveTextContent("as of today");
    // Reports
    await openTab("Reports");
    await screen.findByText("Value growth");
    expect(screen.getByText(`Q3 2026, ${formatDate("2026-10-01")} to ${formatDate("2026-10-05")}`)).toBeInTheDocument();
    expect(screen.getByText("Vouchers posted in Q3 2026")).toBeInTheDocument();
    await settled();
  });

  it("the default period keeps every sentence exactly as it was: 'this month', 'last 8 months', 'the month before'", async () => {
    setToday();
    show();
    await ready();
    expect(screen.getByText("Receipts vs invoices this month")).toBeInTheDocument();
    expect(widget("Sales vs purchase vs profit")).toHaveTextContent("Last 8 months");
    expect(widget("Category sales")).toHaveTextContent("This month vs last month");
    expect(screen.getByRole("link", { name: "VAT this quarter" })).toBeInTheDocument();
    expect(scopeLine()).toContain("This month");
  });
});
