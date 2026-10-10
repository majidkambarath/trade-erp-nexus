import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ financialPosition: vi.fn(), profitOrLoss: vi.fn(), changesInEquity: vi.fn(), cashFlows: vi.fn(), notes: vi.fn() }));
vi.mock("../../../lib/ifrsApi", () => ({ ifrs: m }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));

import IfrsStatements from "../IfrsStatements";
import { downloadCSV } from "../../../utils/format";
import { CASH, EQUITY, NOTES, NOTES_REGROUPED, POSITION, POSITION_REGROUPED, PROFIT, PROFIT_WITH_DISCOUNTS, withoutComparative } from "../../../lib/__tests__/ifrsFixtures";

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

  it("shows a bank overdraft, customer credits and supplier debits on their own side, as positive amounts", async () => {
    m.financialPosition.mockResolvedValue(POSITION_REGROUPED);
    at();
    await screen.findByRole("table", { name: "Statement of financial position" });
    expect(cells(rowOf("Bank overdrafts"))).toEqual(["150.00", "–"]);
    expect(cells(rowOf("Customer credit balances"))).toEqual(["80.00", "–"]);
    expect(cells(rowOf("Supplier debit balances and advances"))).toEqual(["230.00", "–"]);
    expect(cells(rowOf("Total current liabilities"))).toEqual(["2,096.00", "535.00"]);
    expect(cells(rowOf("TOTAL ASSETS"))).toEqual(["12,451.00", "3,635.00"]);
    expect(cells(rowOf("TOTAL EQUITY AND LIABILITIES"))).toEqual(["12,451.00", "3,635.00"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // the overdraft is in the current liabilities, under their heading and before their total
    const labels = within(tableOf("Statement of financial position")).getAllByRole("rowheader").map((h) => h.textContent);
    expect(labels.indexOf("Current liabilities")).toBeLessThan(labels.indexOf("Bank overdrafts"));
    expect(labels.indexOf("Bank overdrafts")).toBeLessThan(labels.indexOf("Total current liabilities"));
    expect(screen.getByText(/a bank account in credit as a bank overdraft/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show account detail"));
    expect(cells(screen.getByText("Mashreq Current").closest("tr"))).toEqual(["150.00", "–"]);
    expect(screen.getByText("BANK0003")).toBeInTheDocument();
  });

  it("exports the regrouped statement with positive amounts", async () => {
    m.financialPosition.mockResolvedValue(POSITION_REGROUPED);
    at();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    const rows = downloadCSV.mock.calls[0][2];
    expect(rows).toContainEqual(["    Bank overdrafts", 150, 0]);
    expect(rows).toContainEqual(["    Customer credit balances", 80, 0]);
    expect(rows).toContainEqual(["    Supplier debit balances and advances", 230, 0]);
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

  it("takes sales discounts off revenue and shows the discount line as a deduction, in the statement, the CSV and the print", async () => {
    m.profitOrLoss.mockResolvedValue(PROFIT_WITH_DISCOUNTS);
    const write = vi.fn();
    window.open.mockReturnValueOnce({ document: { write, close: vi.fn() } });
    at("/?tab=pl");
    await screen.findByRole("table", { name: /profit or loss/ });
    expect(cells(rowOf("Revenue"))).toEqual(["750.00", "200.00"]);
    expect(cells(rowOf("Gross profit"))).toEqual(["350.00", "100.00"]);
    expect(screen.queryByText("Sales Discount")).not.toBeInTheDocument(); // by function: the lines are under "Show account detail"

    fireEvent.click(screen.getByLabelText("Show account detail"));
    expect(cells(screen.getByText("Sales Discount").closest("tr"))).toEqual(["(50.00)", "–"]);
    expect(screen.getByText("Sales Revenue").closest("tr")).toHaveTextContent("800.00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    expect(downloadCSV.mock.calls[0][2]).toContainEqual(["  DSC0001 Sales Discount", -50, 0]);
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    expect(write.mock.calls[0][0]).toContain("(50.00)");
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

  it("draws the gross investing and financing lines the server sends, hides the nil optional ones, and names what was drawn and repaid", async () => {
    at("/?tab=cash");
    await screen.findByRole("table", { name: "Statement of cash flows" });
    expect(cells(rowOf("Purchase of property, plant and equipment"))).toEqual(["(1,200.00)", "–"]);
    expect(cells(rowOf("Proceeds from borrowings"))).toEqual(["2,000.00", "–"]);
    expect(cells(rowOf("Capital introduced by the owners"))).toEqual(["5,000.00", "3,000.00"]);
    expect(cells(rowOf("Interest and finance charges paid"))).toEqual(["(15.00)", "–"]);
    for (const nil of ["Proceeds from disposal of non-current assets", "Repayment of borrowings", "Drawings and dividends paid"]) expect(screen.queryByText(nil)).not.toBeInTheDocument();

    const busy = structuredClone(CASH);
    busy.investing.lines[1].amount = 300;
    busy.financing.lines[1].amount = -500;
    busy.financing.lines[3].amount = -100;
    m.cashFlows.mockResolvedValue(busy);
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "30/06/2025" } });
    expect(await screen.findByText("Repayment of borrowings")).toBeInTheDocument();
    expect(cells(rowOf("Proceeds from disposal of non-current assets"))[0]).toBe("300.00");
    expect(cells(rowOf("Repayment of borrowings"))[0]).toBe("(500.00)");
    expect(cells(rowOf("Drawings and dividends paid"))[0]).toBe("(100.00)");
  });

  it("explains in the footnote that cash includes bank overdrafts, which the position shows as a liability", async () => {
    at("/?tab=cash");
    await screen.findByRole("table", { name: "Statement of cash flows" });
    const note = screen.getByText(/Indirect method/);
    expect(note).toHaveTextContent(/including bank overdrafts repayable on demand \(IAS 7\.8\)/);
    expect(note).toHaveTextContent(/shows an overdraft as a liability/);
  });

  it("exports the gross lines in the CSV and prints them", async () => {
    const write = vi.fn();
    window.open.mockReturnValueOnce({ document: { write, close: vi.fn() } });
    at("/?tab=cash");
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    const rows = downloadCSV.mock.calls[0][2];
    expect(rows).toContainEqual(["  Purchase of property, plant and equipment", -1200, 0]);
    expect(rows).toContainEqual(["  Capital introduced by the owners", 5000, 3000]);
    fireEvent.click(screen.getByRole("button", { name: /Print/ }));
    expect(write.mock.calls[0][0]).toContain("Purchase of property, plant and equipment");
    expect(write.mock.calls[0][0]).not.toContain("Repayment of borrowings");
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

  it("presents cash as the two lines of the statement of financial position, the overdraft as a deduction", async () => {
    at("/?tab=notes");
    const presented = await screen.findByRole("table", { name: "Presented in the statement of financial position as" });
    expect(within(presented).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Line item", "30/06/2025", "30/06/2024"]);
    expect(cells(within(presented).getByRole("rowheader", { name: "Cash and bank balances (current assets)" }).closest("tr"))).toEqual(["6,386.00", "3,000.00"]);
    expect(cells(within(presented).getByRole("rowheader", { name: "Bank overdrafts (current liabilities)" }).closest("tr"))).toEqual(["(150.00)", "–"]);
    expect(cells(within(presented).getByRole("rowheader", { name: "Total cash and cash equivalents" }).closest("tr"))).toEqual(["6,236.00", "3,000.00"]);
    // it follows the cash note, before the payables
    const names = screen.getAllByRole("table").map((t) => t.querySelector("caption")?.textContent);
    expect(names.indexOf("Presented in the statement of financial position as")).toBe(names.indexOf("9. Cash and cash equivalents") + 1);
  });

  it("draws no presentation when the server sent none", async () => {
    const none = structuredClone(NOTES);
    delete none.tables.cash.presentedAs;
    m.notes.mockResolvedValue(none);
    at("/?tab=notes");
    await screen.findByRole("table", { name: "9. Cash and cash equivalents" });
    expect(screen.queryByRole("table", { name: "Presented in the statement of financial position as" })).not.toBeInTheDocument();
  });

  it("adds supplier debits and customer credits to the receivables and payables, with the ageing tied to the net ledger", async () => {
    m.notes.mockResolvedValue(NOTES_REGROUPED);
    at("/?tab=notes");
    const receivables = await screen.findByRole("table", { name: "7. Trade and other receivables" });
    expect(cells(within(receivables).getByRole("rowheader", { name: "Supplier accounts in debit (presented with receivables)" }).closest("tr"))).toEqual(["230.00", "–"]);
    expect(cells(within(receivables).getByRole("rowheader", { name: "Total trade and other receivables" }).closest("tr"))).toEqual(["1,390.00", "210.00"]);
    const payables = screen.getByRole("table", { name: "10. Trade and other payables" });
    expect(cells(within(payables).getByRole("rowheader", { name: "Customer accounts in credit (presented with payables)" }).closest("tr"))).toEqual(["80.00", "–"]);
    expect(cells(within(payables).getByRole("rowheader", { name: "Total trade and other payables" }).closest("tr"))).toEqual(["1,880.00", "525.00"]);
    const ageing = screen.getByRole("table", { name: "Ageing of trade receivables at 30/06/2025" });
    expect(cells(within(ageing).getByRole("rowheader", { name: "Customer accounts per ledger, net of accounts in credit" }).closest("tr"))).toEqual(["1,080.00"]);
    expect(cells(within(ageing).getByRole("rowheader", { name: "Receipts and credit notes not set against an invoice" }).closest("tr"))).toEqual(["(80.00)"]);
  });

  it("leaves the two optional rows out when they are nil", async () => {
    at("/?tab=notes");
    const receivables = await screen.findByRole("table", { name: "7. Trade and other receivables" });
    expect(within(receivables).queryByText(/Supplier accounts in debit/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "10. Trade and other payables" })).queryByText(/Customer accounts in credit/)).not.toBeInTheDocument();
  });

  it("puts the presentation and the added rows in the CSV", async () => {
    m.notes.mockResolvedValue(NOTES_REGROUPED);
    at("/?tab=notes");
    await screen.findByRole("table", { name: "7. Trade and other receivables" });
    fireEvent.click(screen.getByRole("button", { name: /CSV/ }));
    const rows = downloadCSV.mock.calls[0][2];
    expect(rows).toContainEqual(["Bank overdrafts (current liabilities)", -150, 0]);
    expect(rows).toContainEqual(["Supplier accounts in debit (presented with receivables)", 230, 0]);
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
