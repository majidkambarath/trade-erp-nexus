import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderAs, statusFor } from "./asRole";

// Closing and reopening a fiscal year through the dialog: it reads what closing would do before asking, lists every
// reason it cannot be done, makes the person tick each warning by name, says where the profit goes and what the next
// year opens with, and shows the server's refusal if the books changed under it.

const m = vi.hoisted(() => ({
  fiscalYears: vi.fn(), createFiscalYear: vi.fn(), closeFiscalYear: vi.fn(), reopenFiscalYear: vi.fn(), yearEnd: vi.fn(), numberSeries: vi.fn(),
}));
let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));

import AccountingSetup from "../AccountingSetup";

const at = () => renderAs(<MemoryRouter initialEntries={["/accounting-setup?tab=years"]}><AccountingSetup /></MemoryRouter>);

const OPEN = { _id: "y1", code: "2026", startDate: "2026-01-01T00:00:00Z", endDate: "2026-12-31T00:00:00Z", status: "open" };
const CLOSED = {
  _id: "y0", code: "2025", startDate: "2025-01-01T00:00:00Z", endDate: "2025-12-31T00:00:00Z", status: "closed",
  closing: { posted: true, profit: 400, voucherNo: "YEC-2025-0001", retainedAccountName: "Retained Earnings", nextYear: "2026" },
};
const check = (code, level, title, detail = "") => ({ code, level, title, detail });
const preview = (over = {}) => ({
  year: { _id: "y1", code: "2026", status: "open", startDay: "2026-01-01", endDay: "2026-12-31" }, currency: "AED",
  checks: [check("EARLIER_YEARS_CLOSED", "ok", "No earlier year is left open"), check("LEDGER_BALANCED", "ok", "Debits equal credits"), check("RETAINED_EARNINGS", "ok", "The profit goes to Retained Earnings")],
  blockers: [], warnings: [], canClose: true, reopen: { canReopen: false, blockers: [] },
  figures: { income: 1200, expenses: 700, profit: 500, accounts: 3, yearIncome: 1200, yearExpenses: 700, yearProfit: 500, broughtForward: 0, carriedForward: { assets: 10500, liabilities: 0, equity: 10500, balanced: true } },
  branches: [{ branchId: "main", name: "Head office", income: 1200, expenses: 700, profit: 500 }],
  retained: { accountName: "Retained Earnings" }, next: { code: "2027", exists: false, startDay: "2027-01-01", endDay: "2027-12-31" },
  willPost: true, closing: null, ...over,
});

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.fiscalYears.mockResolvedValue([OPEN, CLOSED]);
  m.numberSeries.mockResolvedValue([]);
  status = statusFor("accounts.view", "accounts.close");
});

const openDialog = async (name) => {
  await at();
  fireEvent.click(await screen.findByRole("button", { name }));
};

describe("closing a year", () => {
  it("reads what closing would do first, and shows the checks, where the profit goes and what the next year opens with", async () => {
    m.yearEnd.mockResolvedValue(preview());
    await openDialog(/Close year/);
    const dialog = await screen.findByRole("dialog", { name: "Close 2026?" });
    expect(m.yearEnd).toHaveBeenCalledWith("y1");

    const checks = await within(dialog).findByRole("list", { name: "Checks before closing" });
    expect(within(checks).getByText("No earlier year is left open")).toBeInTheDocument();
    expect(within(checks).getByText("Debits equal credits")).toBeInTheDocument();

    const figures = within(dialog).getByRole("region", { name: "What closing does" });
    expect(within(figures).getByText("Moved to Retained Earnings")).toBeInTheDocument();
    expect(figures).toHaveTextContent("AED 1,200.00");
    expect(figures).toHaveTextContent("AED 700.00");
    expect(figures).toHaveTextContent("Profit");
    expect(figures).toHaveTextContent("AED 500.00");

    const next = within(dialog).getByRole("region", { name: "What the next year opens with" });
    expect(next).toHaveTextContent("2027 opens with");
    expect(next).toHaveTextContent("In balance");
    expect(next).toHaveTextContent("AED 10,500.00");
    expect(next).toHaveTextContent(/2027 \(.+ to .+\) is created for you/);
    expect(within(dialog).getByText(/can be created, approved, edited, deleted or reversed/)).toBeInTheDocument();

    expect(m.closeFiscalYear).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Close year" })).toBeEnabled();
  });

  it("closes with what was ticked, and says where the profit went", async () => {
    m.yearEnd.mockResolvedValue(preview());
    m.closeFiscalYear.mockResolvedValue({ currency: "AED", closing: { posted: true, profit: 500, retainedAccountName: "Retained Earnings", voucherNo: "YEC-2026-0001" } });
    await openDialog(/Close year/);
    const dialog = await screen.findByRole("dialog", { name: "Close 2026?" });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Close year" }));
    await waitFor(() => expect(m.closeFiscalYear).toHaveBeenCalledWith("y1", { acknowledge: [] }));
    expect(await screen.findByText("2026 closed. Profit of AED 500.00 moved to Retained Earnings.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(m.fiscalYears).toHaveBeenCalledTimes(2); // the list is read again
  });

  it("makes the person tick each warning by name before Close year can be pressed", async () => {
    m.yearEnd.mockResolvedValue(preview({
      checks: [check("YEAR_NOT_ENDED", "warning", "2026 runs until 31 Dec 2026", "Closing now locks the days that are left."), check("BANK_NOT_RECONCILED", "warning", "1 bank account is not reconciled", "ENBD (never reconciled)")],
      warnings: [check("YEAR_NOT_ENDED", "warning", "2026 runs until 31 Dec 2026"), check("BANK_NOT_RECONCILED", "warning", "1 bank account is not reconciled")],
    }));
    m.closeFiscalYear.mockResolvedValue({ closing: { posted: false } });
    await openDialog(/Close year/);
    const dialog = await screen.findByRole("dialog", { name: "Close 2026?" });
    const button = await within(dialog).findByRole("button", { name: "Close year" });
    expect(button).toBeDisabled();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Tick the 2 warnings above");

    const [first, second] = within(dialog).getAllByRole("checkbox");
    fireEvent.click(first);
    expect(button).toBeDisabled();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Tick the warning above");
    fireEvent.click(second);
    expect(button).toBeEnabled();
    expect(within(dialog).queryByRole("status")).toBeNull();

    fireEvent.click(button);
    await waitFor(() => expect(m.closeFiscalYear).toHaveBeenCalledWith("y1", { acknowledge: ["BANK_NOT_RECONCILED", "YEAR_NOT_ENDED"] }));
  });

  it("gives every reason a year cannot be closed, and offers no way round them", async () => {
    m.yearEnd.mockResolvedValue(preview({
      checks: [
        check("EARLIER_YEAR_OPEN", "blocker", "Close 2025 first", "Years are closed oldest first."),
        check("UNFINISHED_DOCUMENTS", "blocker", "3 documents dated in 2026 are not approved", "Approve, reject or delete them."),
        check("YEAR_NOT_ENDED", "warning", "2026 runs until 31 Dec 2026"),
      ],
      blockers: [check("EARLIER_YEAR_OPEN", "blocker", "Close 2025 first"), check("UNFINISHED_DOCUMENTS", "blocker", "3 documents dated in 2026 are not approved")],
      warnings: [check("YEAR_NOT_ENDED", "warning", "2026 runs until 31 Dec 2026")], canClose: false,
    }));
    await openDialog(/Close year/);
    const dialog = await screen.findByRole("dialog", { name: "Close 2026?" });
    expect(await within(dialog).findByText("Close 2025 first")).toBeInTheDocument();
    expect(within(dialog).getByText("3 documents dated in 2026 are not approved")).toBeInTheDocument();
    const button = within(dialog).getByRole("button", { name: "Close year" });
    fireEvent.click(within(dialog).getByRole("checkbox")); // ticking the warning does not unlock it
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(m.closeFiscalYear).not.toHaveBeenCalled();
  });

  it("says when there is nothing to carry over, and when an older profit was never closed", async () => {
    m.yearEnd.mockResolvedValue(preview({ figures: { ...preview().figures, income: 0, expenses: 0, profit: 0, accounts: 0 }, willPost: false }));
    await openDialog(/Close year/);
    const empty = await screen.findByRole("region", { name: "What closing does" });
    expect(empty).toHaveTextContent("no income or expense to carry over");
  });

  it("explains profit from a year that was only ever locked", async () => {
    m.yearEnd.mockResolvedValue(preview({ figures: { ...preview().figures, profit: 600, broughtForward: 100 } }));
    await openDialog(/Close year/);
    const figures = await screen.findByRole("region", { name: "What closing does" });
    expect(figures).toHaveTextContent(/AED 100\.00 of this was earned before 2026 and never closed to equity/);
  });

  it("lists the branches when there is more than one, each with its own result", async () => {
    m.yearEnd.mockResolvedValue(preview({ branches: [{ branchId: "main", name: "Head office", profit: 550 }, { branchId: "shj", name: "Sharjah", profit: -50 }] }));
    await openDialog(/Close year/);
    const list = await screen.findByRole("list", { name: "By branch" });
    expect(list).toHaveTextContent("Head office");
    expect(list).toHaveTextContent("Profit of AED 550.00");
    expect(list).toHaveTextContent("Sharjah");
    expect(list).toHaveTextContent("Loss of AED 50.00");
  });

  it("shows the server's refusal, keeps the dialog open and reads the year again", async () => {
    m.yearEnd.mockResolvedValue(preview());
    m.closeFiscalYear.mockRejectedValue(Object.assign(new Error("3 documents dated in 2026 are not approved"), { code: "YEAR_CLOSE_BLOCKED" }));
    await openDialog(/Close year/);
    const dialog = await screen.findByRole("dialog", { name: "Close 2026?" });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Close year" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("3 documents dated in 2026 are not approved");
    expect(screen.getByRole("dialog", { name: "Close 2026?" })).toBeInTheDocument();
    await waitFor(() => expect(m.yearEnd).toHaveBeenCalledTimes(2));
  });
});

describe("reopening a year", () => {
  it("says the closing entry is reversed and what stays on record", async () => {
    m.yearEnd.mockResolvedValue(preview({
      year: { _id: "y0", code: "2025", status: "closed" }, canClose: false, reopen: { canReopen: true, blockers: [] }, closing: CLOSED.closing,
    }));
    m.reopenFiscalYear.mockResolvedValue({});
    await openDialog(/Reopen/);
    const dialog = await screen.findByRole("dialog", { name: "Reopen 2025?" });
    expect(await within(dialog).findByText("YEC-2025-0001")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Profit of AED 400.00 moved to Retained Earnings");
    expect(dialog).toHaveTextContent("reversed");
    expect(dialog).toHaveTextContent("The entry and its reversal stay on record");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reopen year" }));
    await waitFor(() => expect(m.reopenFiscalYear).toHaveBeenCalledWith("y0"));
    expect(await screen.findByText("2025 reopened")).toBeInTheDocument();
  });

  it("will not reopen a year while a later one is closed", async () => {
    m.yearEnd.mockResolvedValue(preview({
      year: { _id: "y0", code: "2025", status: "closed" }, canClose: false, closing: CLOSED.closing,
      reopen: { canReopen: false, blockers: [check("LATER_YEAR_CLOSED", "blocker", "Reopen 2026 first", "Years are reopened newest first.")] },
    }));
    await openDialog(/Reopen/);
    const dialog = await screen.findByRole("dialog", { name: "Reopen 2025?" });
    expect(await within(dialog).findByText("Reopen 2026 first")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reopen year" })).toBeDisabled();
  });

  it("says a year that was only locked has no entry to reverse", async () => {
    m.fiscalYears.mockResolvedValue([{ ...CLOSED, closing: undefined }]);
    m.yearEnd.mockResolvedValue(preview({ year: { _id: "y0", code: "2025", status: "closed" }, canClose: false, closing: null, reopen: { canReopen: true, blockers: [] } }));
    await openDialog(/Reopen/);
    const dialog = await screen.findByRole("dialog", { name: "Reopen 2025?" });
    expect(await within(dialog).findByText(/no closing entry to reverse/)).toBeInTheDocument();
  });
});

describe("the list of years", () => {
  it("says how each closed year was closed", async () => {
    m.fiscalYears.mockResolvedValue([OPEN, CLOSED, { ...CLOSED, _id: "y9", code: "2024", closing: undefined }]);
    await at();
    const table = await screen.findByRole("table", { name: "Fiscal years" });
    expect(within(table).getByText("Profit of AED 400.00 moved to Retained Earnings (YEC-2025-0001)")).toBeInTheDocument();
    expect(within(table).getByText(/Locked only\. It was closed before year-end closing existed/)).toBeInTheDocument();
  });
});
