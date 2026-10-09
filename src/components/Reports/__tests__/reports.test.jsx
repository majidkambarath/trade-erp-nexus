import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  ageing: vi.fn(), statement: vi.fn(), trialBalance: vi.fn(), profitLossDetail: vi.fn(), cashFlow: vi.fn(), balanceSheet: vi.fn(),
  accountLedger: vi.fn(), attachments: vi.fn(), axiosGet: vi.fn(),
}));
vi.mock("../../../lib/accountingApi", () => ({
  accounting: { ageing: m.ageing, statement: m.statement, trialBalance: m.trialBalance, profitLossDetail: m.profitLossDetail, cashFlow: m.cashFlow, balanceSheet: m.balanceSheet, accountLedger: m.accountLedger, attachments: m.attachments },
}));
vi.mock("../../../axios/axios", () => ({ default: { get: m.axiosGet } }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));

import AgeingReport from "../AgeingReport";
import StatementOfAccount from "../StatementOfAccount";
import FinancialStatements from "../FinancialStatements";
import { downloadCSV } from "../../../utils/format";

const at = (ui, url = "/") => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

const BUCKETS = [{ key: "current", label: "Not yet due" }, { key: "d1_30", label: "1-30 days" }, { key: "d31_60", label: "31-60 days" }, { key: "d61_90", label: "61-90 days" }, { key: "d90plus", label: "Over 90 days" }];
const AGEING = {
  type: "receivable", buckets: BUCKETS, overdue: 900,
  totals: { current: 100, d1_30: 200, d31_60: 300, d61_90: 0, d90plus: 400, total: 1000 },
  rows: [{
    partyId: "c1", partyName: "Aged Mart", paymentTerms: "Net 30", total: 1000,
    buckets: { current: 100, d1_30: 200, d31_60: 300, d61_90: 0, d90plus: 400 },
    invoices: [{ transactionId: "t1", transactionNo: "SO-2026-0001", date: "2026-05-01", dueDate: "2026-05-31", daysPastDue: 126, total: 400, outstanding: 400 }],
  }],
};

describe("ageing", () => {
  it("shows buckets that sum to the total, and the overdue share", async () => {
    m.ageing.mockResolvedValue(AGEING);
    at(<AgeingReport />);
    expect(await screen.findByText("Aged Mart")).toBeInTheDocument();
    expect(screen.getByText("90% of the total")).toBeInTheDocument();
    const row = screen.getByText("Aged Mart").closest("tr");
    for (const v of ["100.00", "200.00", "300.00", "400.00", "1,000.00"]) expect(within(row).getByText(v)).toBeInTheDocument();
    expect(within(row).getByText("–")).toBeInTheDocument(); // the empty bucket
    expect(m.ageing).toHaveBeenCalledWith(expect.objectContaining({ type: "receivable" }));
  });

  it("expands a party to its invoices and links to the statement", async () => {
    m.ageing.mockResolvedValue(AGEING);
    at(<AgeingReport />);
    fireEvent.click(await screen.findByRole("button", { name: "Show invoices of Aged Mart" }));
    expect(screen.getByText("SO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("126")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open statement of account" })).toHaveAttribute("href", "/statement?partyType=Customer&partyId=c1");
  });

  it("switches to payables and re-queries", async () => {
    m.ageing.mockResolvedValue(AGEING);
    at(<AgeingReport />);
    await screen.findByText("Aged Mart");
    fireEvent.click(screen.getByRole("tab", { name: "Payables" }));
    await waitFor(() => expect(m.ageing).toHaveBeenLastCalledWith(expect.objectContaining({ type: "payable" })));
  });

  it("exports the table, and says plainly when nothing is owed", async () => {
    m.ageing.mockResolvedValue(AGEING);
    at(<AgeingReport />);
    await screen.findByText("Aged Mart");
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    const [name, heads, rows] = downloadCSV.mock.calls[0];
    expect(name).toMatch(/^ageing-receivable-/);
    expect(heads).toEqual(["Party", "Terms", "Not yet due", "1-30 days", "31-60 days", "61-90 days", "Over 90 days", "Total"]);
    expect(rows.at(-1)).toEqual(["Total", "", 100, 200, 300, 0, 400, 1000]);

    m.ageing.mockResolvedValue({ ...AGEING, rows: [], overdue: 0, totals: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 } });
    fireEvent.click(screen.getByRole("tab", { name: "Payables" }));
    expect(await screen.findByText("Nothing outstanding")).toBeInTheDocument();
  });

  it("reports a failure with a retry", async () => {
    m.ageing.mockRejectedValueOnce(new Error("boom"));
    at(<AgeingReport />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    m.ageing.mockResolvedValue(AGEING);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Aged Mart")).toBeInTheDocument();
  });
});

describe("statement of account", () => {
  const STATEMENT = {
    party: { _id: "c1", name: "Aged Mart", type: "Customer" }, opening: 105, closing: 315, totals: { debit: 210, credit: 0 },
    rows: [{ _id: "e1", date: "2026-09-20", voucherNo: "SO-2026-0002", voucherType: "sales_order", debit: 210, credit: 0, balance: 315 }],
  };
  beforeEach(() => m.axiosGet.mockResolvedValue({ data: { data: [{ _id: "c1", customerName: "Aged Mart" }, { _id: "c2", customerName: "Beta Foods" }] } }));

  it("asks for a party first", async () => {
    at(<StatementOfAccount />);
    expect(await screen.findByText("Choose a customer")).toBeInTheDocument();
    expect(m.statement).not.toHaveBeenCalled();
  });

  it("loads the statement for the party in the URL and shows opening, movement and closing", async () => {
    m.statement.mockResolvedValue(STATEMENT);
    at(<StatementOfAccount />, "/statement?partyType=Customer&partyId=c1");
    expect(await screen.findByText("SO-2026-0002")).toBeInTheDocument();
    expect(m.statement).toHaveBeenCalledWith({ partyId: "c1", partyType: "Customer", from: undefined, to: undefined });
    expect(screen.getByText("Sales invoice")).toBeInTheDocument();
    expect(screen.getAllByText("315.00").length).toBeGreaterThanOrEqual(2); // balance column and closing card
    expect(screen.getByText("owes you this amount")).toBeInTheDocument();
  });

  it("uses the vendor wording and endpoint for a vendor", async () => {
    m.axiosGet.mockResolvedValue({ data: { data: [{ _id: "v1", vendorName: "Mill" }] } });
    m.statement.mockResolvedValue({ ...STATEMENT, party: { _id: "v1", name: "Mill", type: "Vendor" } });
    at(<StatementOfAccount />, "/statement?partyType=Vendor&partyId=v1");
    expect(await screen.findByText("you owe this amount")).toBeInTheDocument();
    expect(m.axiosGet).toHaveBeenCalledWith("/vendors/vendors");
  });

  it("re-queries when the dates change", async () => {
    m.statement.mockResolvedValue(STATEMENT);
    at(<StatementOfAccount />, "/statement?partyType=Customer&partyId=c1");
    await screen.findByText("SO-2026-0002");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    await waitFor(() => expect(m.statement).toHaveBeenLastCalledWith(expect.objectContaining({ from: "2026-09-01" })));
  });
});

describe("financial statements", () => {
  const TB = {
    trialBalance: [
      { _id: "a1", accountCode: "BANK0001", accountName: "Bank", category: "ASSET", openingBalance: 0, totalDebits: 500, totalCredits: 100, closingDebit: 400, closingCredit: 0 },
      { _id: "a2", accountCode: "SAL0001", accountName: "Sales Revenue", category: "INCOME", openingBalance: 0, totalDebits: 0, totalCredits: 400, closingDebit: 0, closingCredit: 400 },
    ],
    summary: { totalDebits: 500, totalCredits: 500, closingDebit: 400, closingCredit: 400, isBalanced: true },
  };

  it("trial balance: totals, balanced badge and a ledger drill-down", async () => {
    m.trialBalance.mockResolvedValue(TB);
    m.accountLedger.mockResolvedValue({ opening: 0, closing: 400, totals: { debit: 500, credit: 100 }, rows: [] });
    at(<FinancialStatements />);
    expect(await screen.findByText("Debits equal credits")).toBeInTheDocument();
    expect(screen.getByText("In balance")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bank$/ }));
    expect(await screen.findByRole("dialog", { name: /BANK0001/ })).toBeInTheDocument();
  });

  it("trial balance: leaves the closing entry out unless asked", async () => {
    m.trialBalance.mockResolvedValue(TB);
    at(<FinancialStatements />);
    await screen.findByText("Debits equal credits");
    expect(m.trialBalance).toHaveBeenLastCalledWith(expect.objectContaining({ includeClosing: undefined }));
    fireEvent.click(screen.getByLabelText("Include year-end closing entries"));
    await waitFor(() => expect(m.trialBalance).toHaveBeenLastCalledWith(expect.objectContaining({ includeClosing: true })));
  });

  it("flags an out-of-balance ledger", async () => {
    m.trialBalance.mockResolvedValue({ ...TB, summary: { ...TB.summary, closingCredit: 350, isBalanced: false } });
    at(<FinancialStatements />);
    expect(await screen.findByText("Out of balance")).toBeInTheDocument();
    expect(screen.getByText("Difference 50.00")).toBeInTheDocument();
  });

  const PL = (over = {}) => ({
    revenue: { groups: [{ groupId: "g1", name: "Sales Income", total: 400, accounts: [{ accountId: "i", accountCode: "SAL0001", accountName: "Sales Revenue", amount: 400 }] }], total: 400 },
    directCosts: { groups: [{ groupId: "g2", name: "Cost of Goods Sold", total: 100, accounts: [{ accountId: "c", accountCode: "COGS0001", accountName: "Cost of Goods Sold", amount: 100 }] }], total: 100 },
    grossProfit: 300, grossMargin: 75,
    otherIncome: { groups: [], total: 0 },
    operatingExpenses: { groups: [{ groupId: "g3", name: "Operating Expenses", total: 150, accounts: [{ accountId: "e", accountCode: "OPEX0001", accountName: "Rent", amount: 150 }] }], total: 150 },
    netProfit: 150, ...over,
  });

  it("profit and loss reads as a statement: revenue, cost of sales, gross profit with its margin, then net profit", async () => {
    m.profitLossDetail.mockResolvedValue(PL());
    at(<FinancialStatements />, "/?tab=pl");
    expect(await screen.findByText("Gross profit", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("75.0% of revenue")).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Net profit", { selector: "td" })).toBeInTheDocument();
    expect(m.profitLossDetail).toHaveBeenCalledWith(expect.objectContaining({ from: expect.stringMatching(/^\d{4}-01-01$/), to: expect.any(String) }));
    const exported = downloadCSV.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV.mock.calls.length).toBe(exported + 1);
    expect(downloadCSV.mock.calls.at(-1)[0]).toMatch(/^profit-and-loss-/);
  });

  it("profit and loss shows a loss as a loss, and re-queries when the dates change", async () => {
    m.profitLossDetail.mockResolvedValue(PL());
    at(<FinancialStatements />, "/?tab=pl");
    await screen.findByText("Rent");
    m.profitLossDetail.mockResolvedValue(PL({ revenue: { groups: [], total: 0 }, directCosts: { groups: [], total: 0 }, grossProfit: 0, grossMargin: null, operatingExpenses: { groups: [{ groupId: "g3", name: "Opex", total: 90, accounts: [{ accountId: "e", accountCode: "OPEX0001", accountName: "Rent", amount: 90 }] }], total: 90 }, netProfit: -90 }));
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-31" } });
    expect(await screen.findByText("Net loss", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("No revenue yet")).toBeInTheDocument();
  });

  it("the quick ranges move both dates", async () => {
    m.profitLossDetail.mockResolvedValue(PL());
    at(<FinancialStatements />, "/?tab=pl");
    await screen.findByText("Rent");
    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    await waitFor(() => expect(m.profitLossDetail).toHaveBeenLastCalledWith(expect.objectContaining({ from: expect.stringMatching(/-01$/) })));
  });

  it("cash flow: opening, money in and out by source, closing, and whether it agrees with the ledgers", async () => {
    const flow = {
      opening: 1000, totalIn: 600, totalOut: 250, net: 350, closing: 1350, closingPerLedger: 1350, reconciles: true, accounts: 2,
      lines: [{ voucherType: "receipt", label: "Received from customers", inflow: 600, outflow: 0, net: 600, count: 3 }, { voucherType: "payment", label: "Paid to vendors", inflow: 0, outflow: 250, net: -250, count: 2 }],
    };
    m.cashFlow.mockResolvedValue(flow);
    at(<FinancialStatements />, "/?tab=cash");
    expect(await screen.findByText("Received from customers")).toBeInTheDocument();
    expect(screen.getByText("Agrees with the cash and bank ledgers")).toBeInTheDocument();
    expect(screen.getByText("Paid to vendors")).toBeInTheDocument();
    m.cashFlow.mockResolvedValue({ ...flow, closingPerLedger: 1300, reconciles: false });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-02-01" } });
    expect(await screen.findByText("Differs from the ledgers by 50.00")).toBeInTheDocument();
  });

  it("balance sheet shows profit within equity and whether it balances", async () => {
    m.balanceSheet.mockResolvedValue({
      assets: [{ _id: "a", accountCode: "BANK0001", accountName: "Bank", amount: 400 }], liabilities: [], equity: [], profitToDate: 400,
      totalAssets: 400, totalLiabilities: 0, totalEquity: 400, totalLiabilitiesAndEquity: 400, isBalanced: true,
    });
    at(<FinancialStatements />, "/?tab=bs");
    expect(await screen.findByText("Assets equal liabilities plus equity")).toBeInTheDocument();
    expect(screen.getByText("Profit to date")).toBeInTheDocument();
    expect(screen.getByLabelText("As at")).toBeInTheDocument();
  });
});
