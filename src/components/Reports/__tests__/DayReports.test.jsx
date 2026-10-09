import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The daily voucher summary (a view of the day book) and the day-end cash and bank report (a tab of the ledger reports).

const m = vi.hoisted(() => ({
  generalLedger: vi.fn(), dayBook: vi.fn(), voucherImpact: vi.fn(), cashBook: vi.fn(), accountLedger: vi.fn(), attachments: vi.fn(),
  dailySummary: vi.fn(), dayEnd: vi.fn(), dayEndRegister: vi.fn(),
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));

import LedgerReports from "../LedgerReports";
import { downloadCSV, todayInput } from "../../../utils/format";
import { shiftDay } from "../../../lib/dayReports";

const at = (url) => render(<MemoryRouter initialEntries={[url]}><LedgerReports /></MemoryRouter>);
beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); downloadCSV.mockReset(); });

const TODAY = todayInput();
const YESTERDAY = shiftDay(TODAY, -1);

const SUMMARY = {
  types: [{ voucherType: "sales_order", label: "Sales invoice" }, { voucherType: "receipt", label: "Receipt" }],
  days: [
    { day: TODAY, count: 3, unbalanced: 0, byType: { sales_order: { count: 2, amount: 1500 }, receipt: { count: 1, amount: 300 } } },
    { day: YESTERDAY, count: 1, unbalanced: 1, byType: { receipt: { count: 1, amount: 100 } } },
  ],
  totals: { count: 4, unbalanced: 1, byType: { sales_order: { count: 2, amount: 1500 }, receipt: { count: 2, amount: 400 } } },
};
const DAYBOOK = { total: 0, rows: [], byType: [], page: 1, limit: 50 };

describe("where the reports are", () => {
  it("has the daily summary and the day end as tabs beside the day book, each reading only when opened", async () => {
    m.dayBook.mockResolvedValue(DAYBOOK);
    m.dailySummary.mockResolvedValue(SUMMARY);
    at("/?tab=daybook");
    expect(await screen.findByText("No vouchers")).toBeInTheDocument();
    expect(m.dailySummary).not.toHaveBeenCalled();
    expect(m.dayEnd).not.toHaveBeenCalled();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["General ledger", "Day book", "Daily summary", "Journals", "Cash and bank", "Day end"]);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Daily summary" }), { button: 0 }); // a Radix tab opens on the press
    expect(await screen.findByRole("table", { name: "Daily voucher summary" })).toBeInTheDocument();
    expect(m.dailySummary).toHaveBeenCalledWith(expect.objectContaining({ to: TODAY }));
  });

  it("can be opened straight onto the summary from an address", async () => {
    m.dailySummary.mockResolvedValue(SUMMARY);
    at("/?tab=daily");
    expect(await screen.findByRole("table", { name: "Daily voucher summary" })).toBeInTheDocument();
    expect(m.dayBook).not.toHaveBeenCalled();
  });
});

describe("daily voucher summary", () => {
  it("shows each day with how many vouchers of each kind and what they came to, and the totals", async () => {
    m.dailySummary.mockResolvedValue(SUMMARY);
    at("/?tab=daily");
    const table = await screen.findByRole("table", { name: "Daily voucher summary" });
    expect(within(table).getByRole("columnheader", { name: "Sales invoice" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Receipt" })).toBeInTheDocument();

    const today = within(table).getAllByRole("button", { name: /Open the vouchers of/ })[0].closest("tr"); // newest day first
    expect(today).toHaveTextContent("1,500.00");
    expect(today).toHaveTextContent("2 vouchers");
    expect(today).toHaveTextContent("300.00");
    expect(today).toHaveTextContent("1 voucher");

    const total = table.querySelector("tfoot tr");
    expect(total).toHaveTextContent("Total");
    expect(total).toHaveTextContent("4"); // vouchers
    expect(total).toHaveTextContent("400.00"); // receipts of both days
  });

  it("flags a day with vouchers that do not balance, and counts them in the cards", async () => {
    m.dailySummary.mockResolvedValue(SUMMARY);
    at("/?tab=daily");
    const table = await screen.findByRole("table", { name: "Daily voucher summary" });
    expect(within(table).getByText("1 out of balance")).toBeInTheDocument();
    expect(screen.getByText("Out of balance")).toBeInTheDocument();
    expect(screen.getByText("check these in the day book")).toBeInTheDocument();
    expect(screen.getByText("Busiest day")).toBeInTheDocument();
    expect(screen.getByText("3 vouchers")).toBeInTheDocument();
  });

  it("opens a day's vouchers in the day book", async () => {
    m.dailySummary.mockResolvedValue(SUMMARY);
    m.dayBook.mockResolvedValue(DAYBOOK);
    at("/?tab=daily");
    const table = await screen.findByRole("table", { name: "Daily voucher summary" });
    const buttons = within(table).getAllByRole("button", { name: /Open the vouchers of/ });
    fireEvent.click(buttons[1]); // yesterday
    await waitFor(() => expect(m.dayBook).toHaveBeenCalledWith(expect.objectContaining({ from: YESTERDAY, to: YESTERDAY })));
    expect(screen.queryByRole("table", { name: "Daily voucher summary" })).toBeNull();
  });

  it("exports the matrix", async () => {
    m.dailySummary.mockResolvedValue(SUMMARY);
    at("/?tab=daily");
    await screen.findByRole("table", { name: "Daily voucher summary" });
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV).toHaveBeenCalledTimes(1);
    const [name, headers, rows] = downloadCSV.mock.calls[0];
    expect(name).toMatch(/^daily-voucher-summary-.*\.csv$/);
    expect(headers).toContain("Sales invoice (amount)");
    expect(rows).toHaveLength(3); // two days and the total

  });

  it("says plainly when nothing was posted", async () => {
    m.dailySummary.mockResolvedValue({ types: [], days: [], totals: { count: 0, unbalanced: 0, byType: {} } });
    at("/?tab=daily");
    expect(await screen.findByText("Nothing was posted in this period.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CSV/ })).toBeDisabled();
  });

  it("reports a failure with a way to try again", async () => {
    m.dailySummary.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(SUMMARY);
    at("/?tab=daily");
    expect(await screen.findByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("table", { name: "Daily voucher summary" })).toBeInTheDocument();
  });
});

describe("day end: cash and bank", () => {
  const REPORT = (over = {}) => ({
    date: TODAY,
    accounts: [
      { accountId: "a1", accountCode: "CASH0001", accountName: "Cash in Hand", kind: "cash", opening: 5000, receipts: 100, payments: 1300, closing: 3800, vouchers: 3 },
      { accountId: "a2", accountCode: "BANK0001", accountName: "ENBD Current", kind: "bank", opening: 0, receipts: 1000, payments: 0, closing: 1000, vouchers: 1 },
    ],
    totals: {
      cash: { opening: 5000, receipts: 100, payments: 1300, closing: 3800 },
      bank: { opening: 0, receipts: 1000, payments: 0, closing: 1000 },
      all: { opening: 5000, receipts: 1100, payments: 1300, closing: 4800 },
    },
    sources: [
      { voucherType: "receipt", label: "Received from customers", inflow: 100, outflow: 0, net: 100, count: 1 },
      { voucherType: "payment", label: "Paid to vendors", inflow: 0, outflow: 300, net: -300, count: 1 },
    ],
    moneyIn: 100, moneyOut: 300, movedBetweenAccounts: 1000, hadActivity: true, closingPerLedger: 4800, reconciles: true, ...over,
  });
  const REGISTER = {
    from: shiftDay(TODAY, -13), to: TODAY, opening: { cash: 5000, bank: 0, all: 5000 },
    days: [
      { day: YESTERDAY, cash: { in: 100, out: 1300, closing: 3800 }, bank: { in: 1000, out: 0, closing: 1000 }, closing: 4800 },
      { day: TODAY, cash: { in: 100, out: 210, closing: 3690 }, bank: { in: 0, out: 100, closing: 900 }, closing: 4590 },
    ],
    closing: { cash: 3690, bank: 900, all: 4590 },
  };

  it("shows each account at the end of the day, with cash, bank and the whole, and that it agrees with the ledger", async () => {
    m.dayEnd.mockResolvedValue(REPORT());
    m.dayEndRegister.mockResolvedValue(REGISTER);
    at("/?tab=dayend");
    const table = await screen.findByRole("table", { name: "Cash and bank at day end" });
    expect(m.dayEnd).toHaveBeenCalledWith({ date: TODAY });
    const cash = within(table).getByText("Cash in Hand").closest("tr");
    expect(cash).toHaveTextContent("5,000.00");
    expect(cash).toHaveTextContent("3,800.00");
    expect(within(table).getByText("ENBD Current").closest("tr")).toHaveTextContent("1,000.00");
    const foot = table.querySelector("tfoot");
    expect(foot).toHaveTextContent("Total cash");
    expect(foot).toHaveTextContent("Total bank");
    expect(foot).toHaveTextContent("Total cash and bank");
    expect(foot).toHaveTextContent("4,800.00");
    expect(screen.getByText("Agrees with the ledger")).toBeInTheDocument();
    expect(screen.getByLabelText("Day")).toBeInTheDocument(); // the date field says Day, not As at
  });

  it("says where the money came from and went to, and what moved between the accounts", async () => {
    m.dayEnd.mockResolvedValue(REPORT());
    m.dayEndRegister.mockResolvedValue(REGISTER);
    at("/?tab=dayend");
    const sources = await screen.findByRole("table", { name: "Money in and out by source" });
    expect(within(sources).getByText("Received from customers").closest("tr")).toHaveTextContent("100.00");
    expect(within(sources).getByText("Paid to vendors").closest("tr")).toHaveTextContent("300.00");
    expect(screen.getByText(/Moved between your own cash and bank accounts:/)).toHaveTextContent("1,000.00");
  });

  it("warns when the day does not agree with the ledger", async () => {
    m.dayEnd.mockResolvedValue(REPORT({ reconciles: false }));
    m.dayEndRegister.mockResolvedValue(REGISTER);
    at("/?tab=dayend");
    expect(await screen.findByText("Does not agree with the ledger")).toBeInTheDocument();
  });

  it("says a quiet day is quiet", async () => {
    m.dayEnd.mockResolvedValue(REPORT({ hadActivity: false, sources: [], moneyIn: 0, moneyOut: 0, movedBetweenAccounts: 0 }));
    m.dayEndRegister.mockResolvedValue({ ...REGISTER, days: [] });
    at("/?tab=dayend");
    expect(await screen.findByText("A quiet day")).toBeInTheDocument();
    expect(await screen.findByText("No cash or bank account moved in these days.")).toBeInTheDocument();
  });

  it("steps to the day before and after, and back to today", async () => {
    m.dayEnd.mockResolvedValue(REPORT());
    m.dayEndRegister.mockResolvedValue(REGISTER);
    at("/?tab=dayend");
    await screen.findByRole("table", { name: "Cash and bank at day end" });
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Previous day/ }));
    await waitFor(() => expect(m.dayEnd).toHaveBeenLastCalledWith({ date: YESTERDAY }));
    expect(m.dayEndRegister).toHaveBeenLastCalledWith({ from: shiftDay(YESTERDAY, -13), to: YESTERDAY });
    expect(screen.getByRole("button", { name: "Today" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Next day/ }));
    await waitFor(() => expect(m.dayEnd).toHaveBeenLastCalledWith({ date: TODAY }));
    fireEvent.click(screen.getByRole("button", { name: /Previous day/ }));
    await waitFor(() => expect(m.dayEnd).toHaveBeenLastCalledWith({ date: YESTERDAY }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(m.dayEnd).toHaveBeenLastCalledWith({ date: TODAY }));
  });

  it("lists the last two weeks day by day, and opens a day from the list", async () => {
    m.dayEnd.mockResolvedValue(REPORT());
    m.dayEndRegister.mockResolvedValue(REGISTER);
    at("/?tab=dayend");
    const reg = await screen.findByRole("table", { name: "Cash and bank day by day" });
    expect(m.dayEndRegister).toHaveBeenCalledWith({ from: shiftDay(TODAY, -13), to: TODAY });
    expect(within(reg).getByText("Brought forward").closest("tr")).toHaveTextContent("5,000.00");
    const rows = reg.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3); // brought forward and two days
    expect(rows[1]).toHaveTextContent("4,800.00");
    expect(rows[2]).toHaveTextContent("4,590.00");

    fireEvent.click(within(reg).getAllByRole("button", { name: /Day end of/ })[0]); // yesterday
    await waitFor(() => expect(m.dayEnd).toHaveBeenLastCalledWith({ date: YESTERDAY }));
  });

  it("opens the day's vouchers in the day book", async () => {
    m.dayEnd.mockResolvedValue(REPORT());
    m.dayEndRegister.mockResolvedValue(REGISTER);
    m.dayBook.mockResolvedValue(DAYBOOK);
    at("/?tab=dayend");
    await screen.findByRole("table", { name: "Cash and bank at day end" });
    fireEvent.click(screen.getByRole("button", { name: "Open this day's vouchers" }));
    await waitFor(() => expect(m.dayBook).toHaveBeenCalledWith(expect.objectContaining({ from: TODAY, to: TODAY })));
  });

  it("opens an account's ledger, and exports both tables", async () => {
    m.dayEnd.mockResolvedValue(REPORT());
    m.dayEndRegister.mockResolvedValue(REGISTER);
    m.accountLedger.mockResolvedValue({ opening: 0, closing: 3800, totals: { debit: 100, credit: 1300 }, rows: [] });
    at("/?tab=dayend");
    await screen.findByRole("table", { name: "Cash and bank at day end" });
    fireEvent.click(screen.getByRole("button", { name: "Ledger of Cash in Hand" }));
    expect(await screen.findByRole("dialog", { name: /CASH0001/ })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    const csv = screen.getAllByRole("button", { name: /CSV/ });
    expect(csv).toHaveLength(2);
    fireEvent.click(csv[0]);
    expect(downloadCSV.mock.calls[0][0]).toBe(`day-end-${TODAY}.csv`);
    expect(downloadCSV.mock.calls[0][2].at(-1)[1]).toBe("Total cash and bank");
    fireEvent.click(csv[1]);
    expect(downloadCSV.mock.calls[1][0]).toMatch(/^day-end-register-/);
    expect(downloadCSV.mock.calls[1][2][0][0]).toBe("Brought forward");
  });

  it("reports a failure with a way to try again", async () => {
    m.dayEnd.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(REPORT());
    m.dayEndRegister.mockResolvedValue(REGISTER);
    at("/?tab=dayend");
    expect(await screen.findByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("table", { name: "Cash and bank at day end" })).toBeInTheDocument();
  });
});
