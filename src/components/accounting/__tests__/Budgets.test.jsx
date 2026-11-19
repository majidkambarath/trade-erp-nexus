import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// Budgets: the pure helpers, the editor (add an account, spread a year's total, save), and the Budget vs actual report.
const m = vi.hoisted(() => ({
  budgets: vi.fn(), budget: vi.fn(), createBudget: vi.fn(), updateBudget: vi.fn(), removeBudget: vi.fn(), budgetReport: vi.fn(), suggestBudget: vi.fn(),
  fiscalYears: vi.fn(), postableAccounts: vi.fn(), costCentres: vi.fn(),
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));
vi.mock("../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ canAny: () => true, can: () => true }) }));
vi.mock("../../shell/Can", () => ({ default: ({ children }) => <>{children}</> }));

import { budgetPayload, lineTotal, monthLabel, spreadEvenly } from "../../../lib/budgets";
import Budgets from "../setup/Budgets";
import BudgetVsActual, { monthsInRange } from "../../Reports/BudgetVsActual";

const MONTHS = ["2026-01", "2026-02", "2026-03"].map((key) => ({ key }));
const YEAR = { _id: "y26", code: "2026", status: "open", startDate: "2026-01-01T00:00:00Z", endDate: "2026-03-31T23:59:59Z", months: MONTHS };

describe("the budget helpers", () => {
  it("spread a total to the fils, add a line up, and send numbers with blank months left out", () => {
    expect(spreadEvenly(100, MONTHS)).toEqual({ "2026-01": "33.33", "2026-02": "33.33", "2026-03": "33.34" });
    expect(lineTotal({ a: "33.33", b: "33.33", c: "33.34" })).toBe(100);
    expect(budgetPayload({ fiscalYearId: "y", costCentreId: "", lines: [{ accountId: "a", amounts: { "2026-01": "10", "2026-02": "", "2026-03": "0" } }, { accountId: "", amounts: {} }] }))
      .toEqual({ name: undefined, fiscalYearId: "y", costCentreId: null, notes: "", lines: [{ accountId: "a", amounts: { "2026-01": 10 } }] });
    expect(monthLabel("2026-04")).toBe("Apr 26");
  });

  it("the report's months are the page's range clipped to the budget's year, or nothing (the server's default) outside it", () => {
    expect(monthsInRange({ from: "2025-11-01", to: "2026-02-15" }, YEAR)).toEqual({ from: "2026-01", to: "2026-02" });
    expect(monthsInRange({ from: "2027-01-01", to: "2027-02-01" }, YEAR)).toEqual({});
  });
});

describe("the budget editor", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.budgets.mockResolvedValue([]);
    m.fiscalYears.mockResolvedValue([YEAR]);
    m.costCentres.mockResolvedValue([]);
    m.postableAccounts.mockResolvedValue([
      { _id: "inc", accountCode: "4000", accountName: "Sales", category: "INCOME" },
      { _id: "bank", accountCode: "1100", accountName: "Bank", category: "ASSET" },
    ]);
  });

  it("offers only income and expense accounts, spreads a year's total over the months and saves the plain numbers", async () => {
    m.createBudget.mockResolvedValue({ name: "Budget 2026" });
    const notify = vi.fn();
    render(<Budgets notify={notify} />);
    fireEvent.click(await screen.findByRole("button", { name: /new budget/i }));
    expect(await screen.findByText("No accounts on this budget yet")).toBeInTheDocument();
    const picker = screen.getByLabelText("Add an account");
    fireEvent.focus(picker);
    fireEvent.keyDown(picker, { key: "ArrowDown" });
    expect(await screen.findByText("4000 · Sales")).toBeInTheDocument();
    expect(screen.queryByText("1100 · Bank")).toBeNull();
    fireEvent.click(screen.getByText("4000 · Sales"));
    const total = await screen.findByLabelText("4000 · Sales, year's total");
    fireEvent.change(total, { target: { value: "1200" } });
    expect(screen.getByLabelText("4000 · Sales, Feb 26")).toHaveValue("400");
    fireEvent.change(screen.getByLabelText("4000 · Sales, Mar 26"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budget" }));
    await waitFor(() => expect(m.createBudget).toHaveBeenCalled());
    expect(m.createBudget.mock.calls[0][0]).toMatchObject({ fiscalYearId: "y26", costCentreId: null, lines: [{ accountId: "inc", amounts: { "2026-01": 400, "2026-02": 400, "2026-03": 500 } }] });
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Budget 2026 saved"));
  });
});

describe("budget vs actual", () => {
  it("shows each account's budget, actual and variance, says which way it went, and the net result", async () => {
    m.budgets.mockResolvedValue([{ _id: "b1", name: "Budget 2026", year: YEAR }]);
    m.budgetReport.mockResolvedValue({
      budget: { name: "Budget 2026", costCentre: null }, from: "2026-01", to: "2026-02", months: ["2026-01", "2026-02"],
      rows: [
        { accountId: "inc", accountCode: "4000", accountName: "Sales", category: "INCOME", budget: 2000, actual: 1800, variance: -200, used: 90, favourable: false },
        { accountId: "exp", accountCode: "6000", accountName: "Rent", category: "EXPENSE", budget: 700, actual: 400, variance: -300, used: 57, favourable: true },
      ],
      totals: { income: { budget: 2000, actual: 1800, variance: -200 }, expense: { budget: 700, actual: 400, variance: -300 }, net: { budget: 1300, actual: 1400, variance: 100 } },
    });
    render(<BudgetVsActual range={{ from: "2026-01-01", to: "2026-02-28" }} />);
    const table = await screen.findByRole("table", { name: "Budget against actual" });
    expect(m.budgetReport).toHaveBeenCalledWith("b1", { from: "2026-01", to: "2026-02" });
    const sales = within(table).getByText("Sales").closest("tr");
    expect(within(sales).getByText("worse")).toBeInTheDocument();
    const rent = within(table).getByText("Rent").closest("tr");
    expect(within(rent).getByText("better")).toBeInTheDocument();
    expect(screen.getByText("Ahead of budget")).toBeInTheDocument();
  });
});
