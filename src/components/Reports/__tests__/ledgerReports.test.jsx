import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  generalLedger: vi.fn(), dayBook: vi.fn(), voucherImpact: vi.fn(), cashBook: vi.fn(), partyBalances: vi.fn(), accountLedger: vi.fn(), attachments: vi.fn(),
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));

import LedgerReports from "../LedgerReports";
import PartyBalances from "../PartyBalances";
import { downloadCSV } from "../../../utils/format";
import { lastMonth, monthStart, yearStart } from "../reportKit";

const at = (ui, url = "/") => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);
beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); downloadCSV.mockReset(); });

const GL = {
  groups: [
    { groupId: "g1", name: "Cash", category: "ASSET", totals: { opening: 0, debit: 5100, credit: 1510, closing: 3590 }, accounts: [{ accountId: "a1", accountCode: "CASH0001", accountName: "Cash in Hand", opening: 0, debit: 5100, credit: 1510, closing: 3590 }] },
    { groupId: "g2", name: "Accounts Payable", category: "LIABILITY", totals: { opening: 0, debit: 0, credit: 1050, closing: -1050 }, accounts: [{ accountId: "a2", accountCode: "AP0001", accountName: "Vendor - Gulf Mills", opening: 0, debit: 0, credit: 1050, closing: -1050 }] },
  ],
  totals: { opening: 0, debit: 5100, credit: 2560, closing: 2540 },
};

describe("report helpers", () => {
  it("work out month and year starts, and last month across a year end", () => {
    expect(monthStart("2026-10-04")).toBe("2026-10-01");
    expect(yearStart("2026-10-04")).toBe("2026-01-01");
    expect(lastMonth("2026-10-04")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(lastMonth("2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(lastMonth("2026-03-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("general ledger", () => {
  it("lists accounts by group with Dr / Cr balances and opens an account's ledger", async () => {
    m.generalLedger.mockResolvedValue(GL);
    m.accountLedger.mockResolvedValue({ opening: 0, closing: 3590, totals: { debit: 5100, credit: 1510 }, rows: [] });
    at(<LedgerReports />);
    expect(await screen.findByText("Vendor - Gulf Mills")).toBeInTheDocument();
    const row = screen.getByText("Cash in Hand").closest("tr");
    expect(within(row).getByText("3,590.00")).toBeInTheDocument();
    expect(within(screen.getByText("Vendor - Gulf Mills").closest("tr")).getByText("Cr")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ledger of Cash in Hand" }));
    expect(await screen.findByRole("dialog", { name: /CASH0001/ })).toBeInTheDocument();
  });

  it("leaves a closed year's closing entry out, and shows the books after it when asked", async () => {
    m.generalLedger.mockResolvedValue(GL);
    at(<LedgerReports />);
    await screen.findByText("Cash in Hand");
    expect(m.generalLedger).toHaveBeenLastCalledWith(expect.objectContaining({ includeClosing: undefined }));
    fireEvent.click(screen.getByLabelText("Include year-end closing entries"));
    await waitFor(() => expect(m.generalLedger).toHaveBeenLastCalledWith(expect.objectContaining({ includeClosing: true })));
    fireEvent.click(screen.getByLabelText("Include year-end closing entries"));
    await waitFor(() => expect(m.generalLedger).toHaveBeenLastCalledWith(expect.objectContaining({ includeClosing: undefined })));
  });

  it("filters by category, can collapse to groups only, and exports", async () => {
    m.generalLedger.mockResolvedValue(GL);
    at(<LedgerReports />);
    await screen.findByText("Cash in Hand");
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "ASSET" } });
    await waitFor(() => expect(m.generalLedger).toHaveBeenLastCalledWith(expect.objectContaining({ category: "ASSET" })));
    fireEvent.click(screen.getByLabelText("Groups only"));
    expect(screen.queryByText("Cash in Hand")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV).toHaveBeenCalledTimes(1);
    expect(downloadCSV.mock.calls[0][2][0][0]).toBe("Cash");
  });

  it("says plainly when nothing was posted", async () => {
    m.generalLedger.mockResolvedValue({ groups: [], totals: { opening: 0, debit: 0, credit: 0, closing: 0 } });
    at(<LedgerReports />);
    expect(await screen.findByText("No postings")).toBeInTheDocument();
  });

  it("reports a failure with a way to retry", async () => {
    m.generalLedger.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(GL);
    at(<LedgerReports />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Cash in Hand")).toBeInTheDocument();
  });
});

describe("day book", () => {
  const DB = (over = {}) => ({
    total: 2, page: 1, limit: 50,
    byType: [{ voucherType: "sales_order", label: "Sales invoice", amount: 210, count: 1 }, { voucherType: "receipt", label: "Receipt", amount: 100, count: 1 }],
    rows: [
      { voucherId: "v1", date: "2026-10-04T08:00:00Z", voucherNo: "SO-2026-0001", voucherType: "sales_order", typeLabel: "Sales invoice", party: "Al Noor", narration: "sales order SO-2026-0001", amount: 210, balanced: true },
      { voucherId: "v2", date: "2026-10-04T09:00:00Z", voucherNo: "RV-2026-0001", voucherType: "receipt", typeLabel: "Receipt", party: "Al Noor", narration: "", amount: 100, balanced: true },
    ], ...over,
  });

  it("lists vouchers with party and amount, and opens the postings of one", async () => {
    m.dayBook.mockResolvedValue(DB());
    m.voucherImpact.mockResolvedValue({
      voucherNo: "SO-2026-0001", balanced: true, totals: { debit: 210, credit: 210 },
      lines: [{ accountId: "a", accountCode: "AR0001", accountName: "Customer - Al Noor", debit: 210, credit: 0 }, { accountId: "b", accountCode: "SAL0001", accountName: "Sales Revenue", debit: 0, credit: 200 }, { accountId: "c", accountCode: "TAXL0001", accountName: "Output VAT", debit: 0, credit: 10 }],
    });
    at(<LedgerReports />, "/?tab=daybook");
    expect(await screen.findByText("SO-2026-0001")).toBeInTheDocument();
    expect(screen.getAllByText("Al Noor")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Open SO-2026-0001" }));
    const dialog = await screen.findByRole("dialog", { name: /SO-2026-0001/ });
    expect(await within(dialog).findByText("Output VAT")).toBeInTheDocument();
    expect(within(dialog).getByText("Debits equal credits")).toBeInTheDocument();
    expect(m.voucherImpact).toHaveBeenCalledWith("v1");
  });

  it("searches after a pause and filters by type", async () => {
    m.dayBook.mockResolvedValue(DB());
    at(<LedgerReports />, "/?tab=daybook");
    await screen.findByText("SO-2026-0001");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "noor" } });
    await waitFor(() => expect(m.dayBook).toHaveBeenLastCalledWith(expect.objectContaining({ search: "noor", page: 1 })));
    const picker = screen.getByLabelText("Voucher type");
    fireEvent.change(picker, { target: { value: "rece" } });
    fireEvent.keyDown(picker, { key: "Enter" });
    await waitFor(() => expect(m.dayBook).toHaveBeenLastCalledWith(expect.objectContaining({ type: "receipt" })));
  });

  it("pages through a long book", async () => {
    m.dayBook.mockResolvedValue(DB({ total: 120 }));
    at(<LedgerReports />, "/?tab=daybook");
    expect(await screen.findByText("Page 1 of 3 · 120 vouchers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(m.dayBook).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});

describe("journals", () => {
  it("shows each journal with its lines and whether it balances", async () => {
    m.dayBook.mockResolvedValue({
      total: 1, page: 1, limit: 20, byType: [],
      rows: [{ voucherId: "j1", date: "2026-10-04T08:00:00Z", voucherNo: "JV-2026-0001", voucherType: "journal", typeLabel: "Journal", narration: "Month-end accrual", amount: 1000, balanced: true,
        lines: [{ accountId: "r", accountCode: "OPEX0006", accountName: "Rent Expense", debit: 1000, credit: 0 }, { accountId: "c", accountCode: "CASH0001", accountName: "Cash in Hand", debit: 0, credit: 1000 }] }],
    });
    at(<LedgerReports />, "/?tab=journals");
    expect(await screen.findByText("Month-end accrual")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("Rent Expense")).toBeInTheDocument();
    expect(m.dayBook).toHaveBeenCalledWith(expect.objectContaining({ type: "journal", includeLines: true }));
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV.mock.calls[0][2]).toHaveLength(2);
  });
});

describe("cash and bank book", () => {
  const BOOK = {
    rows: [
      { accountId: "a1", accountCode: "CASH0001", accountName: "Cash in Hand", kind: "cash", opening: 0, receipts: 5100, payments: 1510, closing: 3590 },
      { accountId: "a2", accountCode: "BANK0002", accountName: "ENBD Current", kind: "bank", opening: 0, receipts: 1000, payments: 0, closing: 1000 },
    ],
    totals: { cash: { opening: 0, receipts: 5100, payments: 1510, closing: 3590 }, bank: { opening: 0, receipts: 1000, payments: 0, closing: 1000 }, all: { opening: 0, receipts: 6100, payments: 1510, closing: 4590 } },
  };
  it("shows each account's opening, in, out and closing, and filters by kind", async () => {
    m.cashBook.mockResolvedValue(BOOK);
    at(<LedgerReports />, "/?tab=cash");
    expect(await screen.findByText("ENBD Current")).toBeInTheDocument();
    expect(within(screen.getByText("Cash in Hand").closest("tr")).getByText("3,590.00")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "bank" } });
    await waitFor(() => expect(m.cashBook).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "bank" })));
  });
});

describe("party balances", () => {
  const CUSTOMERS = {
    type: "customer", rows: [
      { partyId: "c1", partyCode: "CUS001", partyName: "Al Noor Mart", paymentTerms: "Net 30", balance: 450, creditLimit: 500, available: 50, utilisation: 90, status: "near", overdue: 120 },
      { partyId: "c2", partyCode: "CUS002", partyName: "Big Buyer", paymentTerms: "Net 15", balance: 900, creditLimit: 500, available: -400, utilisation: 180, status: "over", overdue: 0 },
      { partyId: "c3", partyCode: "CUS003", partyName: "Cash Customer", paymentTerms: "", balance: 40, creditLimit: 0, available: null, utilisation: null, status: "no-limit", overdue: 0 },
    ],
    totals: { owed: 1390, advances: 0, net: 1390, overdue: 120, overLimit: 1, nearLimit: 1 },
  };

  it("shows balances as Dr, credit use with a label (not just colour), overdue, and a link to the account", async () => {
    m.partyBalances.mockResolvedValue(CUSTOMERS);
    at(<PartyBalances />);
    expect(await screen.findByText("Al Noor Mart")).toBeInTheDocument();
    expect(within(screen.getByText("Al Noor Mart").closest("tr")).getByText("Near limit")).toBeInTheDocument();
    expect(within(screen.getByText("Big Buyer").closest("tr")).getByText("Over limit")).toBeInTheDocument();
    expect(within(screen.getByText("Cash Customer").closest("tr")).getByText("No limit set")).toBeInTheDocument();
    expect(within(screen.getByText("Al Noor Mart").closest("tr")).getAllByText("Dr").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open account of Al Noor Mart" })).toHaveAttribute("href", "/credit-accounts/customer/c1");
    expect(m.partyBalances).toHaveBeenCalledWith(expect.objectContaining({ type: "customer", asOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
  });

  it("narrows to customers over their limit, or with overdue invoices, and searches", async () => {
    m.partyBalances.mockResolvedValue(CUSTOMERS);
    at(<PartyBalances />);
    await screen.findByText("Al Noor Mart");
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "over" } });
    expect(screen.queryByText("Al Noor Mart")).toBeNull();
    expect(screen.getByText("Big Buyer")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "overdue" } });
    expect(screen.getByText("Al Noor Mart")).toBeInTheDocument();
    expect(screen.queryByText("Big Buyer")).toBeNull();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "cash" } });
    expect(screen.getByText("Cash Customer")).toBeInTheDocument();
    expect(screen.queryByText("Big Buyer")).toBeNull();
  });

  it("vendors: what we owe reads as Cr, and the credit columns are absent", async () => {
    m.partyBalances.mockResolvedValue({ type: "vendor", rows: [{ partyId: "v1", partyCode: "VEN001", partyName: "Gulf Mills", paymentTerms: "Net 30", balance: 750, overdue: 0 }], totals: { owed: 750, advances: 0, net: 750, overdue: 0 } });
    at(<PartyBalances />, "/?tab=vendors");
    const row = (await screen.findByText("Gulf Mills")).closest("tr");
    expect(within(row).getByText("Cr")).toBeInTheDocument();
    expect(screen.queryByText("Credit limit")).toBeNull();
    expect(screen.getByRole("link", { name: "Open account of Gulf Mills" })).toHaveAttribute("href", "/debit-accounts/vendor/v1");
    expect(m.partyBalances).toHaveBeenCalledWith(expect.objectContaining({ type: "vendor" }));
  });

  it("includes zero balances when asked, and exports what is shown", async () => {
    m.partyBalances.mockResolvedValue(CUSTOMERS);
    at(<PartyBalances />);
    await screen.findByText("Al Noor Mart");
    fireEvent.click(screen.getByLabelText("Include zero balances"));
    await waitFor(() => expect(m.partyBalances).toHaveBeenLastCalledWith(expect.objectContaining({ includeZero: true })));
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV.mock.calls[0][2]).toHaveLength(3);
  });
});
