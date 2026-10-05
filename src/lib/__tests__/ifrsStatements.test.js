import { describe, it, expect, vi } from "vitest";
import {
  buildDocument, cashDocument, documentCsv, documentHtml, equityDocument, fileSlug, formatAmount, isAsAtTab, isTab, keyFigures, notesDocument,
  positionDocument, printDocument, profitDocument, requestFor, signedText, warnings,
} from "../ifrsStatements";
import { CASH, EQUITY, NOTES, POSITION, PROFIT, withoutComparative } from "./ifrsFixtures";

const table = (doc, i = 0) => doc.blocks.filter((b) => b.type === "table")[i];
const row = (doc, label, i = 0) => table(doc, i).rows.find((r) => r.label === label);

describe("amounts", () => {
  it("groups thousands, puts a deduction in brackets and shows nothing as a dash", () => {
    expect(formatAmount(12221)).toBe("12,221.00");
    expect(formatAmount(-1200)).toBe("(1,200.00)");
    expect(formatAmount(0)).toBe("–");
    expect(formatAmount(-0)).toBe("–");
    expect(formatAmount(0.004)).toBe("–");
    expect(formatAmount(0, { zero: "0.00" })).toBe("0.00");
    expect(formatAmount(null)).toBe("");
    expect(formatAmount(undefined)).toBe("");
  });

  it("writes a ledger balance with its side", () => {
    expect(signedText(8371)).toBe("8,371.00 Dr");
    expect(signedText(-150)).toBe("150.00 Cr");
    expect(signedText(0)).toBe("0.00");
    expect(signedText(null)).toBe("");
  });
});

describe("which request a tab makes", () => {
  it("is as at one day for the position and notes, a period for the rest", () => {
    const q = { from: "2025-01-01", to: "2025-06-30", compare: "prior-period" };
    expect(requestFor("position", q)).toEqual({ method: "financialPosition", params: { asAt: "2025-06-30", compare: "prior-period" } });
    expect(requestFor("notes", q)).toEqual({ method: "notes", params: { asAt: "2025-06-30", compare: "prior-period" } });
    expect(requestFor("pl", q)).toEqual({ method: "profitOrLoss", params: q });
    expect(requestFor("equity", q).method).toBe("changesInEquity");
    expect(requestFor("cash", q).method).toBe("cashFlows");
    expect(["position", "notes"].every(isAsAtTab)).toBe(true);
    expect(["pl", "equity", "cash"].some(isAsAtTab)).toBe(false);
    expect(isTab("cash")).toBe(true);
    expect(isTab("trial")).toBe(false);
    expect(fileSlug("equity")).toBe("changes-in-equity");
  });
});

describe("statement of financial position", () => {
  it("lists assets then equity and liabilities, with subtotals, totals and a comparative column", () => {
    const doc = positionDocument(POSITION);
    expect(doc.title).toBe("Statement of financial position");
    expect(doc.period).toBe("As at 30/06/2025");
    expect(table(doc).columns).toEqual(["30/06/2025", "30/06/2024"]);

    const labels = table(doc).rows.map((r) => r.label);
    expect(labels.indexOf("ASSETS")).toBeLessThan(labels.indexOf("Non-current assets"));
    expect(labels.indexOf("Total non-current assets")).toBeLessThan(labels.indexOf("Current assets"));
    expect(labels.indexOf("TOTAL ASSETS")).toBeLessThan(labels.indexOf("EQUITY AND LIABILITIES"));
    expect(labels.indexOf("Total equity")).toBeLessThan(labels.indexOf("Non-current liabilities"));
    expect(labels.indexOf("Total current liabilities")).toBeLessThan(labels.indexOf("Total liabilities"));
    expect(labels.at(-1)).toBe("TOTAL EQUITY AND LIABILITIES");

    expect(row(doc, "TOTAL ASSETS")).toMatchObject({ kind: "total", values: [12221, 3635] });
    expect(row(doc, "Total non-current assets").values).toEqual([1180, 0]);
    expect(row(doc, "Total current assets").values).toEqual([11041, 3635]);
    expect(row(doc, "Total liabilities")).toMatchObject({ kind: "subtotal", values: [3866, 535] });
    expect(row(doc, "TOTAL EQUITY AND LIABILITIES").values).toEqual([12221, 3635]);
    expect(row(doc, "Profit for the period").values).toEqual([155, 100]);
    expect(doc.blocks.at(-1)).toMatchObject({ type: "footnote" });
    expect(doc.blocks.at(-1).text).toMatch(/non-current when its account group/);
  });

  it("shows groups by default and the accounts under them on request", () => {
    expect(row(positionDocument(POSITION), "Furniture & Equipment")).toBeUndefined();
    expect(row(positionDocument(POSITION), "Fixed Assets").values).toEqual([1180, 0]);

    const detailed = positionDocument(POSITION, { detail: true });
    expect(row(detailed, "Furniture & Equipment")).toMatchObject({ kind: "detail", code: "FA0001", values: [1200, 0], level: 3 });
    expect(row(detailed, "Accumulated Depreciation").values).toEqual([-20, 0]);
    // the profit lines stand alone: they are not made of accounts
    expect(table(detailed).rows.filter((r) => r.label === "Profit for the period")).toHaveLength(1);
  });

  it("has one column without a comparative", () => {
    const doc = positionDocument(withoutComparative(POSITION));
    expect(table(doc).columns).toEqual(["30/06/2025"]);
    expect(row(doc, "TOTAL ASSETS").values).toEqual([12221]);
  });
});

describe("statement of profit or loss", () => {
  it("shows costs as deductions and profit at each level, with OCI", () => {
    const doc = profitDocument(PROFIT);
    expect(doc.period).toBe("For the period 01/06/2025 – 30/06/2025");
    expect(table(doc).columns).toEqual(["01/06/2025 – 30/06/2025", "01/06/2024 – 30/06/2024"]);
    expect(table(doc).rows.map((r) => r.label)).toEqual([
      "Revenue", "Cost of sales", "Gross profit", "Other income", "Operating expenses", "Depreciation and amortisation", "Operating profit",
      "Finance costs", "Profit before tax", "Income tax expense", "Profit for the period", "Other comprehensive income", "Total comprehensive income for the period",
    ]);
    expect(row(doc, "Revenue").values).toEqual([800, 200]);
    expect(row(doc, "Cost of sales").values).toEqual([-400, -100]);
    expect(row(doc, "Gross profit").values).toEqual([400, 100]);
    expect(row(doc, "Operating expenses").values).toEqual([-200, 0]);
    expect(row(doc, "Finance costs").values).toEqual([-15, 0]);
    expect(row(doc, "Income tax expense").values).toEqual([-10, 0]);
    expect(row(doc, "Profit for the period")).toMatchObject({ kind: "total", values: [155, 100] });
    expect(row(doc, "Other comprehensive income").values).toEqual([0, 0]);
    expect(row(doc, "Total comprehensive income for the period").values).toEqual([155, 100]);
    expect(row(doc, "Other income").values).toEqual([0, 0]);
  });

  it("lists the accounts under each line on request, with costs as deductions", () => {
    const doc = profitDocument(PROFIT, { detail: true });
    expect(row(doc, "Rent Expense")).toMatchObject({ kind: "detail", code: "OPEX0005", values: [-200, 0] });
    expect(row(doc, "Sales Revenue").values).toEqual([800, 200]);
  });
});

describe("statement of changes in equity", () => {
  it("has a column per kind of equity and a table per period", () => {
    const doc = equityDocument(EQUITY);
    const [current, comparative] = [table(doc, 0), table(doc, 1)];
    expect(current.title).toBe("Current period: 01/06/2025 – 30/06/2025");
    expect(comparative.title).toBe("Comparative period: 01/06/2024 – 30/06/2024");
    // nothing sits in "other equity", so that column is left out
    expect(current.columns).toEqual(["Share capital", "Retained earnings", "Total equity"]);
    const closing = current.rows.at(-1);
    expect(closing).toMatchObject({ label: "Balance at end of period", kind: "total", values: [8000, 355, 8355] });
    expect(current.rows[0]).toMatchObject({ kind: "subtotal", values: [3000, 200, 3200] });
    expect(current.rows.find((r) => r.label === "Total comprehensive income for the period").values).toEqual([0, 155, 155]);
    expect(comparative.rows.at(-1).values).toEqual([3000, 100, 3100]);
  });

  it("keeps the other-equity column when something is in it, and has one table without a comparative", () => {
    const withOther = structuredClone(EQUITY);
    withOther.current.rows[0].values.other_equity = 50;
    expect(table(equityDocument(withOther)).columns).toContain("Other equity and reserves");

    const doc = equityDocument(withoutComparative(EQUITY));
    expect(doc.blocks.filter((b) => b.type === "table")).toHaveLength(1);
    expect(table(doc).title).toBeUndefined();
  });
});

describe("statement of cash flows", () => {
  it("runs operating, investing and financing to the closing cash", () => {
    const doc = cashDocument(CASH);
    const labels = table(doc).rows.map((r) => r.label);
    expect(labels.slice(0, 3)).toEqual(["Cash flows from operating activities", "Profit before tax", "Adjustments for:"]);
    expect(labels.indexOf("Cash generated from operations")).toBeGreaterThan(labels.indexOf("Changes in working capital:"));
    expect(labels).toContain("Cash flows from investing activities");
    expect(labels).toContain("Cash flows from financing activities");
    expect(labels.at(-1)).toBe("Cash and cash equivalents at end of period");

    expect(row(doc, "Profit before tax").values).toEqual([165, 100]);
    expect(row(doc, "Cash generated from operations").values).toEqual([-410, 0]);
    expect(row(doc, "Net cash from / (used in) operating activities")).toMatchObject({ kind: "subtotal", values: [-429, 0] });
    expect(row(doc, "Net cash from / (used in) investing activities").values).toEqual([-1200, 0]);
    expect(row(doc, "Net cash from / (used in) financing activities").values).toEqual([7000, 3000]);
    expect(row(doc, "Net increase / (decrease) in cash and cash equivalents")).toMatchObject({ kind: "total", values: [5371, 3000] });
    expect(row(doc, "Cash and cash equivalents at end of period").values).toEqual([8371, 3000]);
  });

  it("leaves out optional lines that are nil, and shows 'Other' once it has something in it", () => {
    const quiet = cashDocument(CASH);
    expect(row(quiet, "Loss / (gain) on disposal of non-current assets")).toBeUndefined();
    expect(row(quiet, "Other movements (not classified above)")).toBeUndefined();
    expect(row(quiet, "Finance costs")).toBeDefined();

    const odd = structuredClone(CASH);
    odd.other.amount = -500;
    odd.operating.adjustments.lines[2].amount = 40;
    const doc = cashDocument(odd);
    expect(row(doc, "Other movements (not classified above)").values).toEqual([-500, 0]);
    expect(row(doc, "Loss / (gain) on disposal of non-current assets").values).toEqual([40, 0]);
  });
});

describe("notes", () => {
  it("numbers the policies and note tables in order", () => {
    const doc = notesDocument(NOTES);
    const titles = doc.blocks.filter((b) => b.title).map((b) => b.title);
    expect(titles.slice(0, 6)).toEqual([
      "1. Reporting entity", "2. Basis of preparation", "3. Inventories", "4. Revenue recognition", "5. Value added tax", "6. Current and non-current classification",
    ]);
    expect(titles).toContain("7. Trade and other receivables");
    expect(titles).toContain("Ageing of trade receivables at 30/06/2025");
    expect(titles).toContain("8. Inventories");
    expect(titles).toContain("9. Cash and cash equivalents");
    expect(titles).toContain("10. Trade and other payables");
    expect(titles).toContain("11. Value added tax");
    expect(doc.blocks.at(-1)).toMatchObject({ type: "footnote" });
    expect(doc.blocks.at(-1).text).toMatch(/not a complete set/);
  });

  it("carries the receivables with the ageing buckets, and a signed cash table", () => {
    const doc = notesDocument(NOTES);
    const receivables = doc.blocks.find((b) => b.title === "7. Trade and other receivables");
    expect(receivables.columns).toEqual(["30/06/2025", "30/06/2024"]);
    expect(receivables.rows.find((r) => r.label === "Trade receivables (customers)").values).toEqual([1160, 210]);
    expect(receivables.rows.some((r) => r.label.startsWith("Advances to vendors"))).toBe(false); // nil, optional
    expect(receivables.rows.at(-1)).toMatchObject({ kind: "total", values: [1160, 210] });

    const ageing = doc.blocks.find((b) => b.title === "Ageing of trade receivables at 30/06/2025");
    expect(ageing.rows.map((r) => [r.label, r.values[0]])).toEqual([
      ["Not yet due", 740], ["1-30 days", 210], ["31-60 days", 0], ["61-90 days", 0], ["Over 90 days", 210],
      ["Open invoices", 1160], ["of which overdue", 420], ["Trade receivables per ledger", 1160],
    ]);

    const cash = doc.blocks.find((b) => b.title === "9. Cash and cash equivalents");
    expect(cash.signed).toBe(true);
    expect(cash.rows.map((r) => r.values)).toEqual([[6386, 3000], [-150, 0], [6236, 3000]]);

    const vat = doc.blocks.find((b) => b.title === "11. Value added tax");
    expect(vat.rows.at(-1)).toMatchObject({ label: "Net VAT payable / (recoverable)", values: [-50, -15] });
  });

  it("shows the receipts not set against an invoice when the ledger and the invoices differ, and leaves VAT out when unmapped", () => {
    const odd = structuredClone(NOTES);
    odd.tables.tradeReceivables.ageing.notSetAgainstInvoices = -100;
    odd.tables.vat = null;
    const doc = notesDocument(odd);
    const ageing = doc.blocks.find((b) => b.title?.startsWith("Ageing of trade receivables"));
    expect(ageing.rows.find((r) => r.label.startsWith("Receipts and credit notes")).values).toEqual([-100]);
    expect(doc.blocks.some((b) => b.title?.endsWith("Value added tax") && b.type === "table")).toBe(false);
  });
});

describe("headline figures and warnings", () => {
  it("gives the position's three totals and the profit statement's four", () => {
    expect(keyFigures("position", POSITION).map((f) => [f.title, f.value])).toEqual([["Total assets", 12221], ["Total liabilities", 3866], ["Total equity", 8355]]);
    expect(keyFigures("position", POSITION)[0].sub).toBe("Comparative 3,635.00");
    expect(keyFigures("position", withoutComparative(POSITION))[0].sub).toBe("AED");
    expect(keyFigures("pl", PROFIT).map((f) => f.value)).toEqual([800, 400, 165, 155]);
    expect(keyFigures("equity", EQUITY).map((f) => f.value)).toEqual([3200, 155, 5000, 8355]);
    expect(keyFigures("cash", CASH).map((f) => f.value)).toEqual([-429, -1200, 7000, 8371]);
    expect(keyFigures("notes", NOTES)).toEqual([]);
  });

  it("marks a loss", () => {
    const loss = structuredClone(PROFIT);
    loss.profitForPeriod.amount = -40;
    expect(keyFigures("pl", loss).at(-1).tone).toBe("danger");
    expect(keyFigures("pl", PROFIT).at(-1).tone).not.toBe("danger");
  });

  it("is silent for a sound statement and says what is wrong otherwise", () => {
    for (const tab of ["position", "equity", "cash"]) expect(warnings(tab, { position: POSITION, equity: EQUITY, cash: CASH }[tab])).toEqual([]);

    expect(warnings("cash", { ...CASH, reconciles: false, difference: -75 })[0]).toMatch(/does not reconcile to the ledger.*75\.00/);
    expect(warnings("cash", { ...CASH, comparativeReconciles: false, comparativeDifference: 10 })[0]).toMatch(/comparative does not reconcile.*10\.00/);
    expect(warnings("position", { ...POSITION, isBalanced: false, difference: 75 })[0]).toMatch(/Assets differ from equity and liabilities by 75\.00/);
    expect(warnings("position", { ...POSITION, comparativeIsBalanced: false, comparativeDifference: -5 })[0]).toMatch(/comparative does not balance.*5\.00/);
    const bad = structuredClone(EQUITY);
    bad.current.reconciles = false;
    bad.current.difference = 12.5;
    expect(warnings("equity", bad)[0]).toMatch(/Closing equity differs.*12\.50/);
  });
});

describe("CSV and print", () => {
  it("exports the statement as numbers, indented, with a column per period", () => {
    const { headers, rows } = documentCsv(positionDocument(POSITION, { detail: true }));
    expect(headers).toEqual(["Line item", "30/06/2025", "30/06/2024"]);
    expect(rows).toContainEqual(["TOTAL ASSETS", 12221, 3635]);
    expect(rows).toContainEqual(["      FA0001 Furniture & Equipment", 1200, 0]);
    expect(rows).toContainEqual(["    Fixed Assets", 1180, 0]);
  });

  it("puts every table of a multi-table document in one file", () => {
    const { headers, rows } = documentCsv(equityDocument(EQUITY));
    expect(headers).toEqual(["Line item", "Share capital", "Retained earnings", "Total equity"]);
    expect(rows[0]).toEqual(["Current period: 01/06/2025 – 30/06/2025"]);
    expect(rows).toContainEqual(["Balance at end of period", 8000, 355, 8355]);
    expect(rows).toContainEqual([]);
    expect(rows).toContainEqual(["Comparative period: 01/06/2024 – 30/06/2024", "Share capital", "Retained earnings", "Total equity"]);

    const notes = documentCsv(notesDocument(NOTES));
    expect(notes.rows[0][0]).toBe("1. Reporting entity");
    expect(notes.rows).toContainEqual(["Trade receivables (customers)", 1160, 210]);
  });

  it("builds a printable page with the company, the statement, the period and AED", () => {
    const html = documentHtml(profitDocument(PROFIT), { company: "NH Foods <Trading> LLC", trn: "100123456789012" });
    expect(html).toContain("<title>Statement of profit or loss and other comprehensive income</title>");
    expect(html).toContain("NH Foods &lt;Trading&gt; LLC");
    expect(html).toContain("TRN 100123456789012");
    expect(html).toContain("For the period 01/06/2025 – 30/06/2025");
    expect(html).toContain("Amounts in AED");
    expect(html).toContain("(400.00)");
    expect(html).toContain("155.00");
    expect(html).toContain("window.print()");
    expect(html).not.toContain("<Trading>");
  });

  it("prints signed tables with their side", () => {
    const html = documentHtml(notesDocument(NOTES), { company: "X" });
    expect(html).toContain("6,386.00 Dr");
    expect(html).toContain("150.00 Cr");
    expect(html).toContain("1. Reporting entity");
  });

  it("writes into a new window, and says so when the browser blocked it", () => {
    const write = vi.fn();
    const close = vi.fn();
    window.open.mockReturnValueOnce({ document: { write, close } });
    expect(printDocument(cashDocument(CASH), { company: "NH Foods" })).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toContain("Statement of cash flows");
    expect(close).toHaveBeenCalled();

    window.open.mockReturnValueOnce(null);
    expect(printDocument(cashDocument(CASH), { company: "NH Foods" })).toBe(false);
  });
});

describe("buildDocument", () => {
  it("picks the builder for the tab and refuses an unknown one", () => {
    expect(buildDocument("position", POSITION).title).toBe("Statement of financial position");
    expect(buildDocument("pl", PROFIT).title).toMatch(/profit or loss/);
    expect(buildDocument("equity", EQUITY).title).toBe("Statement of changes in equity");
    expect(buildDocument("cash", CASH).title).toBe("Statement of cash flows");
    expect(buildDocument("notes", NOTES).title).toBe("Notes to the financial statements");
    expect(() => buildDocument("trial", {})).toThrow(/Unknown statement/);
  });
});
