import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderAs, statusFor } from "./asRole";

// Closing and reopening a month of an open year, from the Fiscal years screen: the list of months with where each stands,
// the dialog that reads what closing would do before it asks, the warnings the person ticks by name, the stock against the
// ledger, and the server's refusal. Hidden, never disabled, for someone without accounts.close.

const m = vi.hoisted(() => ({
  fiscalYears: vi.fn(), createFiscalYear: vi.fn(), closeFiscalYear: vi.fn(), reopenFiscalYear: vi.fn(), yearEnd: vi.fn(), numberSeries: vi.fn(),
  monthEnd: vi.fn(), closeMonth: vi.fn(), reopenMonth: vi.fn(),
}));
let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));

import AccountingSetup from "../AccountingSetup";

const at = () => renderAs(<MemoryRouter initialEntries={["/accounting-setup?tab=years"]}><AccountingSetup /></MemoryRouter>);

const mo = (key, label, startDay, endDay, status, over = {}) => ({ key, label, startDay, endDay, status, closedAt: null, closedBy: null, canClose: false, canReopen: false, ...over });
const MONTHS_2026 = [
  mo("2026-01", "January 2026", "2026-01-01", "2026-01-31", "closed", { closedBy: "Mariam", closedAt: "2026-02-03T08:00:00Z" }),
  mo("2026-02", "February 2026", "2026-02-01", "2026-02-28", "closed", { closedBy: "Mariam", closedAt: "2026-03-02T08:00:00Z", canReopen: true }),
  mo("2026-03", "March 2026", "2026-03-01", "2026-03-31", "open", { canClose: true }),
  mo("2026-04", "April 2026", "2026-04-01", "2026-04-30", "open"),
];
const OPEN = { _id: "y1", code: "2026", startDate: "2026-01-01T00:00:00Z", endDate: "2026-12-31T00:00:00Z", status: "open", lockedThrough: "2026-02-28", months: MONTHS_2026 };
const OLD = {
  _id: "y0", code: "2025", startDate: "2025-01-01T00:00:00Z", endDate: "2025-12-31T00:00:00Z", status: "closed",
  closing: { posted: true, profit: 400, voucherNo: "YEC-2025-0001", retainedAccountName: "Retained Earnings", nextYear: "2026" },
  months: [mo("2025-12", "December 2025", "2025-12-01", "2025-12-31", "closed", { closedBy: "Mariam" })],
};
const check = (code, level, title, detail = "") => ({ code, level, title, detail });
const STOCK_BAD = {
  available: true, reconciles: false, stockValue: 1000, ledgerBalance: 900, difference: 100, accountName: "Inventory", basis: "history", exact: false,
  asOn: "2026-03-31", note: "Worked out from the live stock movements dated up to that day, as the books stand now.",
  sources: [{ key: "purchases", label: "Purchases", stock: 800, ledger: 700, difference: 100 }],
};
const preview = (over = {}) => ({
  year: { _id: "y1", code: "2026", status: "open", startDay: "2026-01-01", endDay: "2026-12-31", lockedThrough: "2026-02-28" },
  month: MONTHS_2026[2], currency: "AED",
  checks: [check("ALL_BRANCHES", "ok", "Every branch is included"), check("EARLIER_MONTHS_CLOSED", "ok", "No earlier month is left open"), check("LEDGER_BALANCED", "ok", "Debits equal credits up to 31 Mar 2026")],
  blockers: [], warnings: [], canClose: true, reopen: { canReopen: false, blockers: [] }, stock: null, ...over,
});

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.fiscalYears.mockResolvedValue([OPEN, OLD]);
  m.numberSeries.mockResolvedValue([]);
  status = statusFor("accounts.view", "accounts.close");
});

const monthsTable = () => screen.findByRole("table", { name: "Months of 2026" });
const openMonthDialog = async (name) => {
  await at();
  const table = await monthsTable();
  fireEvent.click(within(table).getByRole("button", { name }));
};

describe("the list of months", () => {
  it("opens on the year being worked on, says where each month stands, and offers only the next close and the latest reopen", async () => {
    await at();
    const table = await monthsTable();
    expect(within(table).getByText("January 2026")).toBeInTheDocument();
    expect(within(table).getByText("Mariam, 03/02/2026")).toBeInTheDocument();
    const march = within(table).getByText("March 2026").closest("tr");
    expect(within(march).getByText("Open")).toBeInTheDocument();
    expect(within(march).getByRole("button", { name: "Close month" })).toBeInTheDocument();
    expect(within(within(table).getByText("February 2026").closest("tr")).getByRole("button", { name: "Reopen month" })).toBeInTheDocument();
    expect(within(table).getAllByRole("button", { name: "Close month" })).toHaveLength(1);
    expect(within(table).getAllByRole("button", { name: "Reopen month" })).toHaveLength(1);
    expect(within(within(table).getByText("January 2026").closest("tr")).queryByRole("button")).toBeNull();
    expect(within(within(table).getByText("April 2026").closest("tr")).queryByRole("button")).toBeNull();
  });

  it("says in the year's own row how far its months are closed", async () => {
    await at();
    const years = await screen.findByRole("table", { name: "Fiscal years" });
    expect(within(years).getByText(/Months closed\. Posting is closed up to 28\/02\/2026/)).toBeInTheDocument();
  });

  it("shows another year's months when it is chosen, and offers no buttons in a closed year", async () => {
    await at();
    await monthsTable();
    fireEvent.change(screen.getByRole("combobox", { name: "Year" }), { target: { value: "y0" } });
    const table = await screen.findByRole("table", { name: "Months of 2025" });
    expect(within(table).getByText("December 2025")).toBeInTheDocument();
    expect(within(table).queryByRole("button")).toBeNull();
  });

  it("draws nothing for a server that sent no months", async () => {
    m.fiscalYears.mockResolvedValue([{ ...OPEN, months: undefined }]);
    await at();
    await screen.findByRole("table", { name: "Fiscal years" });
    expect(screen.queryByText("Month end")).toBeNull();
  });
});

describe("closing a month", () => {
  it("reads what closing would do first, and closes with what was ticked", async () => {
    m.monthEnd.mockResolvedValue(preview({
      checks: [...preview().checks, check("STOCK_NOT_RECONCILED", "warning", "Stock differs from the Inventory ledger by AED 100.00", "Largest: Purchases")],
      warnings: [check("STOCK_NOT_RECONCILED", "warning", "Stock differs from the Inventory ledger by AED 100.00")],
      stock: STOCK_BAD,
    }));
    m.closeMonth.mockResolvedValue({ year: { lockedThrough: "2026-03-31" }, closedNow: true });
    await openMonthDialog("Close month");
    const dialog = await screen.findByRole("dialog", { name: "Close March 2026?" });
    expect(m.monthEnd).toHaveBeenCalledWith("y1", "2026-03");
    const checks = await within(dialog).findByRole("list", { name: "Checks before closing" });
    expect(within(checks).getByText("Debits equal credits up to 31 Mar 2026")).toBeInTheDocument();
    expect(within(dialog).getByText(/Closing a month posts nothing and moves no profit/)).toBeInTheDocument();

    const stock = within(dialog).getByRole("region", { name: "Stock against the ledger" });
    expect(stock).toHaveTextContent("Differs");
    expect(stock).toHaveTextContent("AED 1,000.00");
    expect(stock).toHaveTextContent("AED 900.00");
    expect(stock).toHaveTextContent("stock is higher");
    expect(within(stock).getByRole("list", { name: "Where the difference comes from" })).toHaveTextContent("Purchases");
    expect(stock).toHaveTextContent("as the books stand now");

    const button = within(dialog).getByRole("button", { name: "Close month" });
    expect(button).toBeDisabled();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Tick the warning above to close the month.");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(m.closeMonth).toHaveBeenCalledWith("y1", "2026-03", { acknowledge: ["STOCK_NOT_RECONCILED"] }));
    expect(await screen.findByText(/^March 2026 closed\. Posting is closed up to 31\/03\/2026\.$/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(m.fiscalYears).toHaveBeenCalledTimes(2); // the list is read again
  });

  it("closes at once when there is nothing to tick", async () => {
    m.monthEnd.mockResolvedValue(preview());
    m.closeMonth.mockResolvedValue({ year: { lockedThrough: "2026-03-31" } });
    await openMonthDialog("Close month");
    const dialog = await screen.findByRole("dialog", { name: "Close March 2026?" });
    expect(within(dialog).queryByRole("region", { name: "Stock against the ledger" })).toBeNull();
    fireEvent.click(await within(dialog).findByRole("button", { name: "Close month" }));
    await waitFor(() => expect(m.closeMonth).toHaveBeenCalledWith("y1", "2026-03", { acknowledge: [] }));
  });

  it("gives every reason a month cannot be closed, and ticking a warning does not unlock it", async () => {
    m.monthEnd.mockResolvedValue(preview({
      checks: [
        check("UNFINISHED_DOCUMENTS", "blocker", "2 documents dated in March 2026 are not approved", "Approve, reject or delete them."),
        check("MONTH_NOT_ENDED", "warning", "March 2026 has not ended"),
      ],
      blockers: [check("UNFINISHED_DOCUMENTS", "blocker", "2 documents dated in March 2026 are not approved")],
      warnings: [check("MONTH_NOT_ENDED", "warning", "March 2026 has not ended")], canClose: false,
    }));
    await openMonthDialog("Close month");
    const dialog = await screen.findByRole("dialog", { name: "Close March 2026?" });
    expect(await within(dialog).findByText("2 documents dated in March 2026 are not approved")).toBeInTheDocument();
    const button = within(dialog).getByRole("button", { name: "Close month" });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(m.closeMonth).not.toHaveBeenCalled();
  });

  it("shows the server's refusal, keeps the dialog open and reads the month again", async () => {
    m.monthEnd.mockResolvedValue(preview());
    m.closeMonth.mockRejectedValue(Object.assign(new Error("2 documents dated in March 2026 are not approved"), { code: "MONTH_CLOSE_BLOCKED" }));
    await openMonthDialog("Close month");
    const dialog = await screen.findByRole("dialog", { name: "Close March 2026?" });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Close month" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("2 documents dated in March 2026 are not approved");
    expect(screen.getByRole("dialog", { name: "Close March 2026?" })).toBeInTheDocument();
    await waitFor(() => expect(m.monthEnd).toHaveBeenCalledTimes(2));
  });
});

describe("reopening a month", () => {
  it("reopens the latest closed month and says where the lock now stands", async () => {
    m.monthEnd.mockResolvedValue(preview({ month: MONTHS_2026[1], canClose: false, reopen: { canReopen: true, blockers: [] } }));
    m.reopenMonth.mockResolvedValue({ year: { lockedThrough: "2026-01-31" }, reopenedNow: true });
    await openMonthDialog("Reopen month");
    const dialog = await screen.findByRole("dialog", { name: "Reopen February 2026?" });
    expect(m.monthEnd).toHaveBeenCalledWith("y1", "2026-02");
    expect(await within(dialog).findByText("February 2026 can be reopened")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Documents dated in this month can be changed again");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reopen month" }));
    await waitFor(() => expect(m.reopenMonth).toHaveBeenCalledWith("y1", "2026-02"));
    expect(await screen.findByText(/^February 2026 reopened\. Posting is closed up to 31\/01\/2026\.$/)).toBeInTheDocument();
  });

  it("will not reopen a month while a later one is closed", async () => {
    m.monthEnd.mockResolvedValue(preview({
      month: MONTHS_2026[1], canClose: false,
      reopen: { canReopen: false, blockers: [check("LATER_YEAR_LOCKED", "blocker", "Reopen the months of 2027 first", "A later year was closed on the figures of this one.")] },
    }));
    await openMonthDialog("Reopen month");
    const dialog = await screen.findByRole("dialog", { name: "Reopen February 2026?" });
    expect(await within(dialog).findByText("Reopen the months of 2027 first")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reopen month" })).toBeDisabled();
  });
});

describe("closing the year asks the same stock question", () => {
  it("shows the stock against the ledger and makes the person tick the difference", async () => {
    m.yearEnd.mockResolvedValue({
      year: { _id: "y1", code: "2026", status: "open", startDay: "2026-01-01", endDay: "2026-12-31" }, currency: "AED",
      checks: [check("STOCK_NOT_RECONCILED", "warning", "Stock differs from the Inventory ledger by AED 100.00", "At 31 Dec 2026 the stock is worth AED 1,000.00")],
      blockers: [], warnings: [check("STOCK_NOT_RECONCILED", "warning", "Stock differs from the Inventory ledger by AED 100.00")], canClose: true, reopen: { canReopen: false, blockers: [] },
      figures: { income: 0, expenses: 0, profit: 0, accounts: 0, carriedForward: { assets: 0, liabilities: 0, equity: 0, balanced: true } },
      branches: [], retained: { accountName: "Retained Earnings" }, next: { code: "2027", exists: false, startDay: "2027-01-01", endDay: "2027-12-31" }, willPost: false, closing: null,
      stock: { ...STOCK_BAD, basis: "today", exact: false, asOn: "2026-12-31", note: "Worked out from every live stock movement up to now." },
    });
    m.closeFiscalYear.mockResolvedValue({ closing: { posted: false } });
    await at();
    fireEvent.click(await screen.findByRole("button", { name: /Close year/ }));
    const dialog = await screen.findByRole("dialog", { name: "Close 2026?" });
    expect(await within(dialog).findByRole("region", { name: "Stock against the ledger" })).toHaveTextContent("AED 1,000.00");
    const button = within(dialog).getByRole("button", { name: "Close year" });
    expect(button).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(button);
    await waitFor(() => expect(m.closeFiscalYear).toHaveBeenCalledWith("y1", { acknowledge: ["STOCK_NOT_RECONCILED"] }));
  });
});

describe("who may close a month", () => {
  it("shows the months to someone who can only look, with no buttons and no Action column", async () => {
    status = statusFor("accounts.view");
    await at();
    const table = await monthsTable();
    expect(within(table).getByText("March 2026")).toBeInTheDocument();
    expect(within(table).queryByRole("button")).toBeNull();
    expect(within(table).queryByRole("columnheader", { name: "Action" })).toBeNull();
  });

  it("offers the buttons to accounts.close", async () => {
    await at();
    const table = await monthsTable();
    expect(within(table).getByRole("button", { name: "Close month" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Action" })).toBeInTheDocument();
  });
});
