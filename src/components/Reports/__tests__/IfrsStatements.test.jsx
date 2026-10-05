import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ financialPosition: vi.fn(), profitOrLoss: vi.fn(), changesInEquity: vi.fn(), cashFlows: vi.fn(), notes: vi.fn() }));
vi.mock("../../../lib/ifrsApi", () => ({ ifrs: m }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));

import IfrsStatements from "../IfrsStatements";
import { downloadCSV } from "../../../utils/format";
import { CASH, EQUITY, NOTES, POSITION, PROFIT, withoutComparative } from "../../../lib/__tests__/ifrsFixtures";

const at = (url = "/") => render(<MemoryRouter initialEntries={[url]}><IfrsStatements /></MemoryRouter>);
const tableOf = (name) => screen.getByRole("table", { name });
const rowOf = (label) => screen.getByRole("rowheader", { name: label }).closest("tr");
const cells = (tr) => within(tr).getAllByRole("cell").map((c) => c.textContent);

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  downloadCSV.mockClear();
  m.financialPosition.mockImplementation(async ({ compare }) => (compare === "none" ? withoutComparative(POSITION) : POSITION));
  m.profitOrLoss.mockImplementation(async ({ compare }) => (compare === "none" ? withoutComparative(PROFIT) : PROFIT));
  m.changesInEquity.mockImplementation(async ({ compare }) => (compare === "none" ? withoutComparative(EQUITY) : EQUITY));
  m.cashFlows.mockImplementation(async ({ compare }) => (compare === "none" ? withoutComparative(CASH) : CASH));
  m.notes.mockImplementation(async ({ compare }) => (compare === "none" ? withoutComparative(NOTES) : NOTES));
});

describe("statement of financial position", () => {
  it("shows assets, equity and liabilities with totals, and the comparative in a column on the right", async () => {
    at();
    expect(await screen.findByRole("table", { name: "Statement of financial position" })).toBeInTheDocument();
    expect(m.financialPosition).toHaveBeenCalledWith(expect.objectContaining({ compare: "prior-year", asAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));

    const heads = within(tableOf("Statement of financial position")).getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["Line item", "30/06/2025", "30/06/2024"]);
    expect(cells(rowOf("TOTAL ASSETS"))).toEqual(["12,221.00", "3,635.00"]);
    expect(cells(rowOf("TOTAL EQUITY AND LIABILITIES"))).toEqual(["12,221.00", "3,635.00"]);
    expect(cells(rowOf("Total non-current assets"))).toEqual(["1,180.00", "0.00"]);
    expect(cells(rowOf("Total liabilities"))).toEqual(["3,866.00", "535.00"]);
    expect(cells(rowOf("Profit for the period"))).toEqual(["155.00", "100.00"]);
    expect(screen.getByText(/Classification: an asset or liability is non-current/)).toBeInTheDocument();
    // the header cards repeat the totals
    expect(screen.getByText("Total assets")).toBeInTheDocument();
    expect(screen.getByText("Comparative 3,635.00")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks for one date, as at, and no start date", async () => {
    at();
    await screen.findByRole("table");
    expect(screen.getByLabelText("As at")).toBeInTheDocument();
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Comparative")).toHaveValue("prior-year");
  });

  it("asks again without the comparative when it is switched off, and the column goes", async () => {
    at();
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Comparative"), { target: { value: "none" } });
    await waitFor(() => expect(m.financialPosition).toHaveBeenLastCalledWith(expect.objectContaining({ compare: "none" })));
    await waitFor(() => expect(within(tableOf("Statement of financial position")).getAllByRole("columnheader")).toHaveLength(2));
    expect(cells(rowOf("TOTAL ASSETS"))).toEqual(["12,221.00"]);

    fireEvent.change(screen.getByLabelText("Comparative"), { target: { value: "prior-period" } });
    await waitFor(() => expect(m.financialPosition).toHaveBeenLastCalledWith(expect.objectContaining({ compare: "prior-period" })));
  });

  it("lists the accounts under each group when asked", async () => {
    at();
    await screen.findByRole("table");
    expect(screen.queryByText("Furniture & Equipment")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Show account detail"));
    expect(screen.getByText("Furniture & Equipment")).toBeInTheDocument();
    expect(screen.getByText("FA0001")).toBeInTheDocument();
    expect(cells(screen.getByText("Accumulated Depreciation").closest("tr"))).toEqual(["(20.00)", "–"]);
    expect(m.financialPosition).toHaveBeenCalledTimes(1); // laying it out differently needs no new request
  });

  it("warns when the ledger does not balance", async () => {
    m.financialPosition.mockResolvedValue({ ...POSITION, isBalanced: false, difference: 75 });
    at();
    expect(await screen.findByRole("alert")).toHaveTextContent("Assets differ from equity and liabilities by 75.00");
  });
});

describe("profit or loss", () => {
  it("shows the lines by function with costs as deductions, tax, profit and OCI", async () => {
    at("/?tab=pl");
    const t = await screen.findByRole("table", { name: /profit or loss/ });
    expect(m.profitOrLoss).toHaveBeenCalledWith(expect.objectContaining({ from: expect.stringMatching(/-01-01$/), compare: "prior-year" }));
    expect(within(t).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Line item", "01/06/2025 – 30/06/2025", "01/06/2024 – 30/06/2024"]);
    expect(cells(rowOf("Revenue"))).toEqual(["800.00", "200.00"]);
    expect(cells(rowOf("Cost of sales"))).toEqual(["(400.00)", "(100.00)"]);
    expect(cells(rowOf("Gross profit"))).toEqual(["400.00", "100.00"]);
    expect(cells(rowOf("Finance costs"))).toEqual(["(15.00)", "–"]);
    expect(cells(rowOf("Profit before tax"))).toEqual(["165.00", "100.00"]);
    expect(cells(rowOf("Profit for the period"))).toEqual(["155.00", "100.00"]);
    expect(cells(rowOf("Other comprehensive income"))).toEqual(["–", "–"]);
    expect(cells(rowOf("Total comprehensive income for the period"))).toEqual(["155.00", "100.00"]);
    // a period has a start and an end
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });

  it("uses weight 600 for subtotals and totals", async () => {
    at("/?tab=pl");
    await screen.findByRole("table");
    expect(rowOf("Gross profit").className).toMatch(/font-semibold/);
    expect(rowOf("Profit for the period").className).toMatch(/font-semibold/);
    expect(rowOf("Revenue").className).not.toMatch(/font-(bold|semibold)/);
  });

  it("asks again when the dates change", async () => {
    at("/?tab=pl");
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Last year" }));
    await waitFor(() => expect(m.profitOrLoss).toHaveBeenCalledTimes(2));
    expect(m.profitOrLoss.mock.calls[1][0]).toMatchObject({ from: expect.stringMatching(/^[0-9]{4}-01-01$/), to: expect.stringMatching(/^[0-9]{4}-12-31$/) });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "30/09/2025" } });
    await waitFor(() => expect(m.profitOrLoss).toHaveBeenLastCalledWith(expect.objectContaining({ to: "2025-09-30" })));
  });
});

describe("changes in equity", () => {
  it("has a column per kind of equity, the opening and closing balances, and the comparative period below", async () => {
    at("/?tab=equity");
    const current = await screen.findByRole("table", { name: "Current period: 01/06/2025 – 30/06/2025" });
    expect(within(current).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Line item", "Share capital", "Retained earnings", "Total equity"]);
    expect(cells(within(current).getByRole("rowheader", { name: "Balance at start of period" }).closest("tr"))).toEqual(["3,000.00", "200.00", "3,200.00"]);
    expect(cells(within(current).getByRole("rowheader", { name: "Capital introduced and other increases" }).closest("tr"))).toEqual(["5,000.00", "–", "5,000.00"]);
    expect(cells(within(current).getByRole("rowheader", { name: "Balance at end of period" }).closest("tr"))).toEqual(["8,000.00", "355.00", "8,355.00"]);
    const comparative = screen.getByRole("table", { name: "Comparative period: 01/06/2024 – 30/06/2024" });
    expect(cells(within(comparative).getByRole("rowheader", { name: "Balance at end of period" }).closest("tr"))).toEqual(["3,000.00", "100.00", "3,100.00"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when closing equity is not the equity of the statement of financial position", async () => {
    const bad = structuredClone(EQUITY);
    bad.current.reconciles = false;
    bad.current.difference = 12.5;
    m.changesInEquity.mockResolvedValue(bad);
    at("/?tab=equity");
    expect(await screen.findByRole("alert")).toHaveTextContent("Closing equity differs from the equity in the statement of financial position by 12.50");
  });
});

describe("cash flows", () => {
  it("shows operating, investing and financing with the closing cash", async () => {
    at("/?tab=cash");
    await screen.findByRole("table", { name: "Statement of cash flows" });
    expect(cells(rowOf("Profit before tax"))).toEqual(["165.00", "100.00"]);
    expect(cells(rowOf("Cash generated from operations"))).toEqual(["(410.00)", "0.00"]);
    expect(cells(rowOf("Net cash from / (used in) operating activities"))).toEqual(["(429.00)", "0.00"]);
    expect(cells(rowOf("Net cash from / (used in) investing activities"))).toEqual(["(1,200.00)", "0.00"]);
    expect(cells(rowOf("Net cash from / (used in) financing activities"))).toEqual(["7,000.00", "3,000.00"]);
    expect(cells(rowOf("Net increase / (decrease) in cash and cash equivalents"))).toEqual(["5,371.00", "3,000.00"]);
    expect(cells(rowOf("Cash and cash equivalents at start of period"))).toEqual(["3,000.00", "–"]);
    expect(cells(rowOf("Cash and cash equivalents at end of period"))).toEqual(["8,371.00", "3,000.00"]);
    // lines with nothing in them are left out
    expect(screen.queryByText("Other movements (not classified above)")).not.toBeInTheDocument();
    expect(screen.queryByText(/Loss \/ \(gain\) on disposal/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/Indirect method/)).toBeInTheDocument();
  });

  it("warns that the statement does not reconcile to the ledger, and shows what is unexplained", async () => {
    const odd = structuredClone(CASH);
    odd.reconciles = false;
    odd.difference = -75;
    odd.other.amount = -500;
    m.cashFlows.mockResolvedValue(odd);
    at("/?tab=cash");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The statement does not reconcile to the ledger");
    expect(alert).toHaveTextContent("75.00");
    expect(cells(rowOf("Other movements (not classified above)"))[0]).toBe("(500.00)");
  });

  it("warns about the comparative period on its own", async () => {
    m.cashFlows.mockResolvedValue({ ...CASH, comparativeReconciles: false, comparativeDifference: 10 });
    at("/?tab=cash");
    expect(await screen.findByRole("alert")).toHaveTextContent("The comparative does not reconcile to the ledger");
  });
});

describe("notes", () => {
  it("shows the policies, the note tables from the ledger, and what is not built yet", async () => {
    at("/?tab=notes");
    expect(await screen.findByText("1. Reporting entity")).toBeInTheDocument();
    expect(m.notes).toHaveBeenCalledWith(expect.objectContaining({ compare: "prior-year", asAt: expect.any(String) }));
    expect(screen.getByText("2. Basis of preparation")).toBeInTheDocument();
    expect(screen.getAllByText(/weighted average cost/).length).toBeGreaterThanOrEqual(1);
    const receivables = screen.getByRole("table", { name: "7. Trade and other receivables" });
    expect(cells(within(receivables).getByRole("rowheader", { name: "Trade receivables (customers)" }).closest("tr"))).toEqual(["1,160.00", "210.00"]);
    const ageing = screen.getByRole("table", { name: "Ageing of trade receivables at 30/06/2025" });
    expect(cells(within(ageing).getByRole("rowheader", { name: "Over 90 days" }).closest("tr"))).toEqual(["210.00"]);
    // cash shows its side
    const cash = screen.getByRole("table", { name: "9. Cash and cash equivalents" });
    expect(cells(within(cash).getByRole("rowheader", { name: /ENBD Current/ }).closest("tr"))[0]).toBe("150.00Cr");
    expect(cells(within(cash).getByRole("rowheader", { name: /Cash in Hand/ }).closest("tr"))[0]).toBe("6,386.00Dr");
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();
    expect(screen.getByText(/not a complete set of IFRS disclosures/)).toBeInTheDocument();
    expect(screen.getByLabelText("As at")).toBeInTheDocument();
  });
});

describe("tabs", () => {
  it("moves between the five statements and asks for each when it is opened", async () => {
    at();
    await screen.findByRole("table", { name: "Statement of financial position" });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Financial position", "Profit or loss", "Changes in equity", "Cash flows", "Notes"]);
    expect(screen.getByRole("tab", { name: "Financial position" })).toHaveAttribute("aria-selected", "true");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Cash flows" }), { button: 0 });
    expect(await screen.findByRole("table", { name: "Statement of cash flows" })).toBeInTheDocument();
    expect(m.cashFlows).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("table", { name: "Statement of financial position" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cash flows" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the comparative choice when the tab changes", async () => {
    at();
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Comparative"), { target: { value: "none" } });
    await waitFor(() => expect(m.financialPosition).toHaveBeenLastCalledWith(expect.objectContaining({ compare: "none" })));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Profit or loss" }), { button: 0 });
    await waitFor(() => expect(m.profitOrLoss).toHaveBeenCalledWith(expect.objectContaining({ compare: "none" })));
  });

  it("falls back to the first statement for an unknown tab in the address", async () => {
    at("/?tab=trial");
    expect(await screen.findByRole("table", { name: "Statement of financial position" })).toBeInTheDocument();
  });
});

describe("export and print", () => {
  it("exports the statement as CSV", async () => {
    at();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV).toHaveBeenCalledOnce();
    const [name, heads, rows] = downloadCSV.mock.calls[0];
    expect(name).toBe("ifrs-financial-position-2025-06-30.csv");
    expect(heads).toEqual(["Line item", "30/06/2025", "30/06/2024"]);
    expect(rows).toContainEqual(["TOTAL ASSETS", 12221, 3635]);
    expect(rows).toContainEqual(["TOTAL EQUITY AND LIABILITIES", 12221, 3635]);
  });

  it("exports the profit statement with deductions negative", async () => {
    at("/?tab=pl");
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    const [name, , rows] = downloadCSV.mock.calls[0];
    expect(name).toBe("ifrs-profit-or-loss-2025-06-30.csv");
    expect(rows).toContainEqual(["Cost of sales", -400, -100]);
  });

  it("prints in a new window with the company, the statement, the period and AED", async () => {
    const write = vi.fn();
    window.open.mockReturnValueOnce({ document: { write, close: vi.fn() } });
    at("/?tab=pl");
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    expect(window.open).toHaveBeenCalled();
    const html = write.mock.calls[0][0];
    expect(html).toContain("Harbour Trading Co LLC");
    expect(html).toContain("Statement of profit or loss and other comprehensive income");
    expect(html).toContain("For the period 01/06/2025 – 30/06/2025");
    expect(html).toContain("Amounts in AED");
    expect(html).toContain("(400.00)");
  });

  it("says when the browser blocked the print window", async () => {
    window.open.mockReturnValueOnce(null);
    at();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    expect(await screen.findByText(/Allow pop-ups/)).toBeInTheDocument();
  });
});

describe("failure", () => {
  it("reports an error with a way to try again", async () => {
    m.financialPosition.mockRejectedValueOnce(new Error("boom"));
    at();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Statement of financial position" })).toBeInTheDocument();
  });
});
