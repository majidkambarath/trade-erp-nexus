import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  lookups: vi.fn(), valuation: vi.fn(), movement: vi.fn(), itemLedger: vi.fn(),
  salesAnalysis: vi.fn(), expiry: vi.fn(), slowMoving: vi.fn(), reorder: vi.fn(),
}));
vi.mock("../../../lib/stockReportsApi", () => ({ stockReports: m }));
vi.mock("../../../utils/format", async (orig) => ({ ...(await orig()), downloadCSV: vi.fn() }));

import StockReports from "../StockReports";
import { downloadCSV, todayInput } from "../../../utils/format";

const at = (url = "/") => render(<MemoryRouter initialEntries={[url]}><StockReports /></MemoryRouter>);
const csv = () => downloadCSV.mock.calls.at(-1);
// react-select: open the list with the arrow key, then pick the option by its text
const choose = async (name, text) => {
  fireEvent.keyDown(screen.getByRole("combobox", { name }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(text) }));
};
const card = (title) => screen.getByText(title, { selector: "h3" }).closest("div.rounded-xl");

let errors;
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  downloadCSV.mockClear();
  m.lookups.mockResolvedValue(LOOKUPS);
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(errors, "the page logs no errors or React warnings").not.toHaveBeenCalled();
  errors.mockRestore();
});

// ---------------------------------------------------------------- fixtures (shapes the server returns)

const LOOKUPS = {
  items: [
    { id: "s1", code: "RICE", name: "Basmati Rice", sku: "RICE-5KG", unit: "kg", categoryId: "c1", status: "Active" },
    { id: "s2", code: "OIL", name: "Sunflower Oil", sku: "OIL-1L", unit: "ltr", categoryId: "c2", status: "Active" },
  ],
  categories: [{ id: "c1", name: "Grains" }, { id: "c2", name: "Oils" }],
};

const REC_OK = {
  available: true, account: { id: "a1", code: "INV0001", name: "Inventory" }, postingEnabled: true, asOn: "2026-10-04",
  stockValue: 2216.15, ledgerBalance: 2216.15, difference: 0, reconciles: true, unexplained: 0, filtered: false,
  lines: [
    { key: "purchases", label: "Purchases", stock: 3840, ledger: 3840, difference: 0 },
    { key: "sales", label: "Cost of goods sold", stock: -1153.85, ledger: -1153.85, difference: 0 },
  ],
};
const REC_BAD = {
  ...REC_OK, stockValue: 2216.15, ledgerBalance: 2257.69, difference: -41.54, reconciles: false,
  lines: [
    { key: "opening", label: "Opening stock and manual adjustments", stock: 58.46, ledger: 0, difference: 58.46, note: "Not posted to the ledger." },
    { key: "journals", label: "Journals and other vouchers posted to Inventory", stock: 0, ledger: 100, difference: -100, note: "Posted by hand." },
  ],
};

const VALUATION = {
  asOn: "2026-10-04", groupBy: "item",
  rows: [
    { stockId: "s1", itemId: "RICE", sku: "RICE-5KG", itemName: "Basmati Rice", unit: "kg", categoryId: "c1", categoryName: "Grains", qty: 110, avgCost: 11.69231, value: 1286.15, sharePct: 58 },
    { stockId: "s2", itemId: "OIL", sku: "OIL-1L", itemName: "Sunflower Oil", unit: "ltr", categoryId: "c2", categoryName: "Oils", qty: 45.5, avgCost: 20.66667, value: 930, sharePct: 42 },
  ],
  totals: { items: 2, qty: 155.5, value: 2216.15, negativeItems: 0, outOfSyncItems: 0 },
  reconciliation: REC_OK,
};

const mv = (qty, value) => ({ qty, value });
const MOVEMENT = {
  from: "2026-10-01", to: "2026-10-04",
  rows: [
    { stockId: "s1", itemId: "RICE", sku: "RICE-5KG", itemName: "Basmati Rice", categoryName: "Grains", opening: mv(200, 2400), purchases: mv(0, 0), salesReturns: mv(10, 120), purchaseReturns: mv(20, 280), sales: mv(60, 720), writeOffs: mv(0, 0), adjustments: mv(0, 0), closing: mv(130, 1520) },
    { stockId: "s2", itemId: "OIL", sku: "OIL-1L", itemName: "Sunflower Oil", categoryName: "Oils", opening: mv(50, 1000), purchases: mv(20, 440), salesReturns: mv(0, 0), purchaseReturns: mv(0, 0), sales: mv(10, 200), writeOffs: mv(0, 0), adjustments: mv(0, 0), closing: mv(60, 1240) },
  ],
  totals: { opening: mv(250, 3400), purchases: mv(20, 440), salesReturns: mv(10, 120), purchaseReturns: mv(20, 280), sales: mv(70, 920), writeOffs: mv(0, 0), adjustments: mv(0, 0), closing: mv(190, 2760) },
  reconciliation: { ...REC_OK, stockValue: 2760, ledgerBalance: 2760 },
};

const LEDGER = {
  item: { id: "s1", itemId: "RICE", sku: "RICE-5KG", itemName: "Basmati Rice", unit: "kg", categoryName: "Grains" },
  from: "2026-01-01", to: "2026-10-04", opening: mv(200, 2400), truncated: false,
  rows: [
    { id: "m1", date: "2026-09-04T08:00:00.000Z", documentNo: "SO-2026-0001", eventType: "SALES_DISPATCH", typeLabel: "Sale", partyName: "Al Noor", batchNo: "R2", qtyIn: 0, qtyOut: 60, unitCost: 12, valueIn: 0, valueOut: 720, balanceQty: 140, balanceValue: 1680 },
    { id: "m2", date: "2026-09-14T08:00:00.000Z", documentNo: "SR-2026-0001", eventType: "SALES_RETURN", typeLabel: "Sales return", partyName: "Al Noor", batchNo: "", qtyIn: 10, qtyOut: 0, unitCost: 12, valueIn: 120, valueOut: 0, balanceQty: 150, balanceValue: 1800 },
  ],
  totals: { qtyIn: 10, qtyOut: 60, valueIn: 120, valueOut: 720 },
  closing: { qty: 150, value: 1800, avgCost: 12 },
};

const SALES = {
  from: "2026-10-01", to: "2026-10-04", groupBy: "item", direction: "sales",
  rows: [
    { key: "RICE", name: "Basmati Rice", code: "RICE-5KG", quantity: 70, soldQty: 80, returnedQty: 10, revenue: 1460, returns: 180, netRevenue: 1280, cogs: 833.85, grossProfit: 446.15, marginPct: 34.9, sharePct: 81, documents: 3 },
    { key: "OIL", name: "Sunflower Oil", code: "OIL-1L", quantity: 10, soldQty: 10, returnedQty: 0, revenue: 300, returns: 0, netRevenue: 300, cogs: 200, grossProfit: 100, marginPct: 33.3, sharePct: 19, documents: 1 },
  ],
  totals: { quantity: 80, revenue: 1760, returns: 180, netRevenue: 1580, cogs: 1033.85, grossProfit: 546.15, marginPct: 34.6, documents: 3 },
};
const PURCHASES = {
  from: "2026-10-01", to: "2026-10-04", groupBy: "item", direction: "purchases",
  rows: [{ key: "RICE", name: "Basmati Rice", code: "RICE-5KG", quantity: 180, purchasedQty: 200, returnedQty: 20, purchased: 2400, returned: 280, netValue: 2120, avgPrice: 11.77778, vendors: 2, sharePct: 100, documents: 3 }],
  totals: { quantity: 180, purchased: 2400, returned: 280, netValue: 2120, avgPrice: 11.77778, vendors: 2, documents: 3 },
};

const batch = (over) => ({ batchId: "b", batchNumber: "O1", stockId: "s2", itemId: "OIL", sku: "OIL-1L", itemName: "Sunflower Oil", unit: "ltr", categoryName: "Oils", qtyOnHand: 40, expiryDate: "2026-10-29T00:00:00.000Z", daysToExpiry: 25, expired: false, fefoRank: 2, unitCost: 20.66667, receiptCost: 20, valueAtCost: 826.67, sourceTransactionNo: "PO-2026-0001", ...over });
const EXPIRY = {
  withinDays: 30, asOn: "2026-10-04",
  rows: [
    batch({ batchId: "b1", batchNumber: "O-OLD", qtyOnHand: 5, expiryDate: "2026-10-01T00:00:00.000Z", daysToExpiry: -3, expired: true, fefoRank: 1, valueAtCost: 103.33 }),
    batch({ batchId: "b2" }),
    batch({ batchId: "b3", batchNumber: "O2", qtyOnHand: 3, daysToExpiry: 5, fefoRank: 3, valueAtCost: 62 }),
  ],
  totals: { batches: 3, items: 1, qty: 48, value: 992.0, expired: { batches: 1, qty: 5, value: 103.33 }, expiring: { batches: 2, qty: 43, value: 888.67 } },
};

const SLOW = {
  days: 90, asOn: "2026-10-04",
  rows: [
    { stockId: "s2", itemId: "OIL", sku: "OIL-1L", itemName: "Sunflower Oil", unit: "ltr", categoryName: "Oils", qty: 45, avgCost: 20.66667, value: 930, lastSaleDate: "2026-06-01T08:00:00.000Z", neverSold: false, daysSince: 125 },
    { stockId: "s3", itemId: "SALT", sku: "SALT-1KG", itemName: "Sea Salt", unit: "kg", categoryName: "Spices", qty: 30, avgCost: 2, value: 60, lastSaleDate: null, neverSold: true, daysSince: 100 },
  ],
  totals: { items: 2, value: 990, neverSold: 1, pctOfStockValue: 43.5, stockValue: 2276.15 },
};

const REORDER = {
  rows: [
    { stockId: "s1", itemId: "RICE", sku: "RICE-5KG", itemName: "Basmati Rice", unit: "kg", categoryName: "Grains", qty: 0, reorderLevel: 150, shortfall: 150, avgCost: 11.69231, shortfallValue: 1753.85, status: "out", vendorName: "Gulf Mills" },
    { stockId: "s3", itemId: "SALT", sku: "SALT-1KG", itemName: "Sea Salt", unit: "kg", categoryName: "Spices", qty: 20, reorderLevel: 30, shortfall: 10, avgCost: 2, shortfallValue: 20, status: "below", vendorName: "" },
  ],
  totals: { items: 2, outOfStock: 1, shortfallValue: 1773.85 },
};

// ---------------------------------------------------------------- valuation

describe("valuation", () => {
  it("shows the totals, each item's quantity, average cost and value, and the agreement with the ledger", async () => {
    m.valuation.mockResolvedValue(VALUATION);
    at();
    expect(await screen.findByText("Basmati Rice")).toBeInTheDocument();

    expect(within(card("Stock value")).getByText("2,216.15")).toBeInTheDocument();
    expect(within(card("Items in stock")).getByText("2")).toBeInTheDocument();
    expect(within(card("Inventory account")).getByText("2,216.15")).toBeInTheDocument();
    expect(within(card("Difference")).getByText("0.00")).toBeInTheDocument();

    const rice = screen.getByText("Basmati Rice").closest("tr");
    for (const v of ["Grains", "110", "11.6923", "1,286.15", "58.0%"]) expect(within(rice).getByText(v)).toBeInTheDocument();
    const oil = screen.getByText("Sunflower Oil").closest("tr");
    expect(within(oil).getByText("45.500")).toBeInTheDocument(); // a fractional quantity keeps its decimals
    const foot = screen.getByRole("table", { name: "Stock valuation by item" }).querySelector("tfoot");
    expect(within(foot).getByText("2,216.15")).toBeInTheDocument();

    expect(screen.getByText("Stock value agrees with the Inventory account")).toBeInTheDocument();
    expect(screen.getByText(/AED 2,216.15 as at this date in stock and in Inventory/)).toBeInTheDocument();
    expect(m.valuation).toHaveBeenCalledWith(expect.objectContaining({ asOn: todayInput(), groupBy: "item", categoryId: "", search: "" }));
  });

  it("warns with the difference and where it comes from when stock and ledger disagree", async () => {
    m.valuation.mockResolvedValue({ ...VALUATION, reconciliation: { ...REC_BAD, warning: "Ledger posting is switched off, so approved documents are not reaching the Inventory account." } });
    at();
    expect(await screen.findByText("Stock value differs from the Inventory account by AED 41.54")).toBeInTheDocument();
    expect(screen.getByText(/Stock AED 2,216.15, Inventory AED 2,257.69 as at this date\. Stock is lower than the ledger\./)).toBeInTheDocument();
    expect(screen.getByText(/Ledger posting is switched off/)).toBeInTheDocument();
    expect(screen.queryByText("Stock value agrees with the Inventory account")).toBeNull();

    const why = screen.getByRole("table", { name: "Stock value and ledger balance by source" });
    expect(within(why).getByText("Opening stock and manual adjustments")).toBeInTheDocument();
    expect(within(why).getByText("Journals and other vouchers posted to Inventory")).toBeInTheDocument();
    expect(within(why).getByText("-100.00")).toBeInTheDocument();
    expect(screen.getByText("Where the difference comes from").closest("details")).toHaveAttribute("open");
    expect(within(card("Difference")).getByText("-41.54")).toBeInTheDocument();
  });

  it("says so when the Inventory account is not set up, and notes when the check ignores the filters", async () => {
    m.valuation.mockResolvedValue({ ...VALUATION, reconciliation: { available: false, postingEnabled: false, stockValue: 2216.15, reason: "The Inventory account is not mapped under Accounting > Account configuration, so stock cannot be compared with the ledger." } });
    at();
    expect(await screen.findByText("Stock cannot be compared with the ledger")).toBeInTheDocument();
    expect(screen.getByText(/not mapped under Accounting/)).toBeInTheDocument();
    expect(within(card("Inventory account")).getByText("–")).toBeInTheDocument();
  });

  it("flags negative stock and an item record that disagrees with the movements", async () => {
    m.valuation.mockResolvedValue({
      ...VALUATION,
      rows: [{ ...VALUATION.rows[0], qty: -5, value: -58.46, negative: true }, { ...VALUATION.rows[1], outOfSync: true, recordedQty: 50 }],
      totals: { ...VALUATION.totals, negativeItems: 1, outOfSyncItems: 1 },
    });
    at();
    expect(await screen.findByText("Negative stock")).toBeInTheDocument();
    expect(screen.getByText("Item record shows 50")).toBeInTheDocument();
    expect(screen.getByText("2 need a look")).toBeInTheDocument();
  });

  it("each filter changes the request: date, category, search and grouping", async () => {
    m.valuation.mockResolvedValue(VALUATION);
    at();
    await screen.findByText("Basmati Rice");

    fireEvent.change(screen.getByLabelText("As at"), { target: { value: "2026-09-30" } });
    await waitFor(() => expect(m.valuation).toHaveBeenLastCalledWith(expect.objectContaining({ asOn: "2026-09-30" })));

    await choose("Category", "Oils");
    await waitFor(() => expect(m.valuation).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: "c2" })));

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "rice" } });
    await waitFor(() => expect(m.valuation).toHaveBeenLastCalledWith(expect.objectContaining({ search: "rice" })));

    m.valuation.mockResolvedValue({
      ...VALUATION, groupBy: "category",
      rows: [{ categoryId: "c1", categoryName: "Grains", items: 1, value: 1286.15, sharePct: 58 }, { categoryId: "c2", categoryName: "Oils", items: 1, value: 930, sharePct: 42 }],
    });
    const group = screen.getByRole("group", { name: "Group by" });
    expect(within(group).getByRole("button", { name: "Item" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "Category" }));
    await waitFor(() => expect(m.valuation).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: "category" })));
    const table = await screen.findByRole("table", { name: "Stock valuation by category" });
    expect(within(table).getByText("Grains")).toBeInTheDocument();
    expect(within(table).getByText("930.00")).toBeInTheDocument();
  });

  it("exports the table with its total and the ledger comparison", async () => {
    m.valuation.mockResolvedValue(VALUATION);
    at();
    await screen.findByText("Basmati Rice");
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    const [name, heads, rows] = csv();
    expect(name).toBe("stock-valuation-2026-10-04.csv");
    expect(heads).toEqual(["Code", "Item", "Category", "Unit", "Quantity", "Average cost", "Value", "Share %"]);
    expect(rows[0]).toEqual(["RICE-5KG", "Basmati Rice", "Grains", "kg", 110, 11.69231, 1286.15, 58]);
    expect(rows.map((r) => r[0])).toEqual(["RICE-5KG", "OIL-1L", "Total", "Inventory account in the ledger", "Difference (stock less ledger)"]);
    expect(rows[2][6]).toBe(2216.15);
    expect(rows[3][6]).toBe(2216.15);
  });

  it("loads, says plainly when there is nothing, and reports a failure with a retry", async () => {
    m.valuation.mockReturnValueOnce(new Promise(() => {}));
    const first = at();
    expect(await screen.findByText(/Valuing the stock/)).toBeInTheDocument();
    first.unmount();

    m.valuation.mockResolvedValue({ ...VALUATION, rows: [], totals: { ...VALUATION.totals, items: 0, value: 0 } });
    const second = at();
    expect(await screen.findByText("No stock on hand")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    second.unmount();

    m.valuation.mockRejectedValueOnce(new Error("The server is unavailable"));
    at();
    expect(await screen.findByRole("alert")).toHaveTextContent("The server is unavailable");
    m.valuation.mockResolvedValue(VALUATION);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Basmati Rice")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- movement

describe("movement", () => {
  it("opening plus in less out is the closing, in quantity and in value, with the ledger check on the closing value", async () => {
    m.movement.mockResolvedValue(MOVEMENT);
    at("/?tab=movement");
    const table = await screen.findByRole("table", { name: "Stock movement by item" });
    const rice = within(table).getByText("Basmati Rice").closest("tr");
    const cells = [...rice.querySelectorAll("td")].map((td) => td.textContent);
    // item, opening, purchases, sales returns, purchase returns, sales, write-offs, adjustments, closing
    expect(cells.slice(1)).toEqual(["200", "–", "10", "-20", "-60", "–", "–", "130"]);
    expect(200 + 10 - 20 - 60).toBe(130);
    const foot = [...table.querySelector("tfoot").querySelectorAll("td")].map((td) => td.textContent);
    expect(foot.slice(1)).toEqual(["250", "20", "10", "-20", "-70", "0", "0", "190"]);

    expect(within(card("Opening stock")).getByText("3,400.00")).toBeInTheDocument();
    expect(within(card("Purchases")).getByText("440.00")).toBeInTheDocument();
    expect(within(card("Cost of goods sold")).getByText("920.00")).toBeInTheDocument();
    expect(within(card("Closing stock")).getByText("2,760.00")).toBeInTheDocument();
    expect(screen.getByText("Stock value agrees with the Inventory account")).toBeInTheDocument();
    expect(m.movement).toHaveBeenCalledWith(expect.objectContaining({ from: expect.stringMatching(/-01$/), to: todayInput() }));
  });

  it("switches to values, and the closing value is still opening + in - out", async () => {
    m.movement.mockResolvedValue(MOVEMENT);
    at("/?tab=movement");
    await screen.findByRole("table", { name: "Stock movement by item" });
    const view = screen.getByRole("group", { name: "Show" });
    expect(within(view).getByRole("button", { name: "Quantity" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(view).getByRole("button", { name: "Value" }));

    const table = screen.getByRole("table", { name: "Stock movement by item" });
    const oil = [...within(table).getByText("Sunflower Oil").closest("tr").querySelectorAll("td")].map((td) => td.textContent);
    expect(oil.slice(1)).toEqual(["1,000.00", "440.00", "–", "–", "-200.00", "–", "–", "1,240.00"]);
    expect(1000 + 440 - 200).toBe(1240);
    expect(m.movement).toHaveBeenCalledTimes(1); // the view is a display choice, not a new request
  });

  it("quick ranges and dates re-query; the warning shows when the closing value is off", async () => {
    m.movement.mockResolvedValue({ ...MOVEMENT, reconciliation: { ...REC_BAD, stockValue: 2760, ledgerBalance: 2800, difference: -40 } });
    at("/?tab=movement");
    expect(await screen.findByText("Stock value differs from the Inventory account by AED 40.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    await waitFor(() => expect(m.movement).toHaveBeenLastCalledWith(expect.objectContaining({ from: expect.stringMatching(/^\d{4}-01-01$/) })));
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-30" } });
    await waitFor(() => expect(m.movement).toHaveBeenLastCalledWith(expect.objectContaining({ to: "2026-09-30" })));
    await choose("Category", "Grains");
    await waitFor(() => expect(m.movement).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: "c1" })));
  });

  it("exports quantity and value for every column", async () => {
    m.movement.mockResolvedValue(MOVEMENT);
    at("/?tab=movement");
    await screen.findByRole("table", { name: "Stock movement by item" });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    const [name, heads, rows] = csv();
    expect(name).toBe("stock-movement-2026-10-01-2026-10-04.csv");
    expect(heads).toHaveLength(3 + 8 + 8);
    expect(heads).toContain("Closing qty");
    expect(heads).toContain("Closing value");
    expect(rows[0].slice(0, 3)).toEqual(["RICE-5KG", "Basmati Rice", "Grains"]);
    expect(rows[0].slice(3, 11)).toEqual([200, 0, 10, -20, -60, 0, 0, 130]);
    expect(rows.at(-1)[1]).toBe("Total");
  });

  it("explains an empty period", async () => {
    m.movement.mockResolvedValue({ ...MOVEMENT, rows: [] });
    at("/?tab=movement");
    expect(await screen.findByText("No stock movement")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- item ledger

describe("item ledger", () => {
  it("asks for an item first, then lists every movement with its running balance", async () => {
    m.itemLedger.mockResolvedValue(LEDGER);
    at("/?tab=ledger");
    expect(await screen.findByText(/Pick an item to see every movement/)).toBeInTheDocument();
    expect(m.itemLedger).not.toHaveBeenCalled();

    await choose("Item", "Basmati Rice");
    const table = await screen.findByRole("table", { name: "Stock ledger of Basmati Rice" });
    expect(m.itemLedger).toHaveBeenCalledWith(expect.objectContaining({ itemId: "s1", from: expect.stringMatching(/^\d{4}-01-01$/) }));

    const rows = within(table).getAllByRole("row");
    const text = (tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent);
    expect(text(rows[1])[0]).toBe("Opening balance on 01/01/2026");
    expect(text(rows[1]).slice(1)).toEqual(["200", "2,400.00"]);
    // date, document, type, party, batch, in, out, unit cost, balance qty, balance value
    expect(text(rows[2])).toEqual(["04/09/2026", "SO-2026-0001", "Sale", "Al Noor", "R2", "", "60", "12.0000", "140", "1,680.00"]);
    expect(text(rows[3])).toEqual(["14/09/2026", "SR-2026-0001", "Sales return", "Al Noor", "–", "10", "", "12.0000", "150", "1,800.00"]);
    const foot = text(table.querySelector("tfoot tr"));
    expect(foot[0]).toBe("Closing balance");
    expect(foot.slice(5)).toEqual(["10", "60", "", "150", "1,800.00"]);
    expect(200 + 10 - 60).toBe(150);

    expect(within(card("Closing")).getByText("150 kg")).toBeInTheDocument();
    expect(within(card("Received")).getByText("10")).toBeInTheDocument();
    expect(within(card("Issued")).getByText("60")).toBeInTheDocument();
  });

  it("re-queries for the dates, exports, and says when nothing moved", async () => {
    m.itemLedger.mockResolvedValue(LEDGER);
    at("/?tab=ledger");
    await choose("Item", "Basmati Rice");
    await screen.findByRole("table", { name: "Stock ledger of Basmati Rice" });

    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    await waitFor(() => expect(m.itemLedger).toHaveBeenLastCalledWith(expect.objectContaining({ from: expect.stringMatching(/-01$/) })));

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    const [name, heads, rows] = csv();
    expect(name).toMatch(/^item-ledger-RICE-5KG-/);
    expect(heads).toEqual(["Date", "Document", "Type", "Party", "Batch", "Qty in", "Qty out", "Unit cost", "Balance qty", "Balance value"]);
    expect(rows[0][1]).toBe("Opening balance");
    expect(rows.at(-1).slice(-2)).toEqual([150, 1800]);

    m.itemLedger.mockResolvedValue({ ...LEDGER, rows: [], totals: { qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0 }, closing: { qty: 200, value: 2400, avgCost: 12 } });
    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    expect(await screen.findByText("No movement in this period.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- sales analysis

describe("sales analysis", () => {
  it("net revenue, actual cost, gross profit and margin per item, with share", async () => {
    m.salesAnalysis.mockResolvedValue(SALES);
    at("/?tab=sales");
    const table = await screen.findByRole("table", { name: "Sales by item" });
    const rice = [...within(table).getByText("Basmati Rice").closest("tr").querySelectorAll("td")].map((td) => td.textContent);
    expect(rice).toEqual(["Basmati RiceRICE-5KG", "70", "1,280.00", "833.85", "446.15", "34.9%", "81.0%"]);
    expect(within(card("Net revenue")).getByText("1,580.00")).toBeInTheDocument();
    expect(within(card("Cost of goods sold")).getByText("1,033.85")).toBeInTheDocument();
    expect(within(card("Gross profit")).getByText("546.15")).toBeInTheDocument();
    expect(within(card("Margin")).getByText("34.6%")).toBeInTheDocument();
    expect(table.querySelector("tfoot")).toHaveTextContent("1,580.00");
    expect(m.salesAnalysis).toHaveBeenCalledWith(expect.objectContaining({ direction: "sales", groupBy: "item" }));
  });

  it("switches direction and grouping, each a new request", async () => {
    m.salesAnalysis.mockResolvedValue(SALES);
    at("/?tab=sales");
    await screen.findByRole("table", { name: "Sales by item" });

    fireEvent.click(within(screen.getByRole("group", { name: "Group by" })).getByRole("button", { name: "Customer" }));
    await waitFor(() => expect(m.salesAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: "customer", direction: "sales" })));

    m.salesAnalysis.mockResolvedValue(PURCHASES);
    fireEvent.click(within(screen.getByRole("group", { name: "Direction" })).getByRole("button", { name: "Purchases" }));
    await waitFor(() => expect(m.salesAnalysis).toHaveBeenLastCalledWith(expect.objectContaining({ direction: "purchases" })));
    const table = await screen.findByRole("table", { name: "Purchases by item" });
    expect(within(table).getAllByText("11.7778")).toHaveLength(2); // the row and the total
    expect(within(card("Net purchases")).getByText("2,120.00")).toBeInTheDocument();
    expect(within(card("Vendors")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Group by" })).getByRole("button", { name: "Vendor" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(csv()[0]).toMatch(/^purchase-analysis-item-/);
    expect(csv()[1]).toEqual(["Item", "Code", "Net quantity", "Net purchases", "Average price paid", "Vendors", "Share %"]);
  });

  it("exports sales with its total row and shows a loss in the danger colour", async () => {
    m.salesAnalysis.mockResolvedValue({
      ...SALES,
      rows: [{ ...SALES.rows[0], netRevenue: 100, cogs: 150, grossProfit: -50, marginPct: -50 }],
      totals: { ...SALES.totals, netRevenue: 100, cogs: 150, grossProfit: -50, marginPct: -50 },
    });
    at("/?tab=sales");
    const table = await screen.findByRole("table", { name: "Sales by item" });
    expect(within(table).getAllByText("-50.0%")[0]).toHaveClass("text-status-danger");
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    const [name, heads, rows] = csv();
    expect(name).toBe("sales-analysis-item-2026-10-01-2026-10-04.csv");
    expect(heads).toEqual(["Item", "Code", "Net quantity", "Net revenue", "Cost of goods sold", "Gross profit", "Margin %", "Share %"]);
    expect(rows.at(-1)).toEqual(["Total", "", 80, 100, 150, -50, -50, ""]);
  });

  it("explains an empty period", async () => {
    m.salesAnalysis.mockResolvedValue({ ...SALES, rows: [], totals: { ...SALES.totals, netRevenue: 0, cogs: 0, grossProfit: 0, marginPct: null, quantity: 0, documents: 0 } });
    at("/?tab=sales");
    expect(await screen.findByText("No sales")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- expiry

describe("expiry", () => {
  it("lists batches soonest first with how long is left, and the value at risk", async () => {
    m.expiry.mockResolvedValue(EXPIRY);
    at("/?tab=expiry");
    const table = await screen.findByRole("table", { name: "Batches expiring or expired" });
    const rows = within(table).getAllByRole("row").slice(1, 4);
    expect(rows.map((r) => within(r).getByText(/^(O-OLD|O1|O2)$/).textContent)).toEqual(["O-OLD", "O1", "O2"]);
    expect(within(rows[0]).getByText("Expired 3 days ago")).toBeInTheDocument();
    expect(within(rows[1]).getByText("25 days")).toBeInTheDocument();
    expect(within(rows[2]).getByText("5 days")).toBeInTheDocument();
    expect(within(rows[0]).getByText("#1")).toBeInTheDocument();
    expect(within(rows[0]).getByText("103.33")).toBeInTheDocument();

    expect(within(card("Expired, value at risk")).getByText("103.33")).toBeInTheDocument();
    expect(within(card("Expiring within 30 days")).getByText("888.67")).toBeInTheDocument();
    expect(within(card("Batches listed")).getByText("3")).toBeInTheDocument();
    expect(m.expiry).toHaveBeenCalledWith(expect.objectContaining({ withinDays: "30" }));
  });

  it("the horizon is a filter: typing or a quick choice re-queries, a bad value asks again without querying", async () => {
    m.expiry.mockResolvedValue(EXPIRY);
    at("/?tab=expiry");
    await screen.findByRole("table", { name: "Batches expiring or expired" });

    fireEvent.change(screen.getByLabelText("Expiring within (days)"), { target: { value: "60" } });
    await waitFor(() => expect(m.expiry).toHaveBeenLastCalledWith(expect.objectContaining({ withinDays: "60" })));
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    await waitFor(() => expect(m.expiry).toHaveBeenLastCalledWith(expect.objectContaining({ withinDays: "90" })));

    const calls = m.expiry.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Expiring within (days)"), { target: { value: "" } });
    expect(await screen.findByText("Enter a whole number of days, 0 or more")).toBeInTheDocument();
    expect(m.expiry).toHaveBeenCalledTimes(calls);
  });

  it("exports, and says when nothing is near expiry", async () => {
    m.expiry.mockResolvedValue(EXPIRY);
    at("/?tab=expiry");
    await screen.findByRole("table", { name: "Batches expiring or expired" });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    const [name, heads, rows] = csv();
    expect(name).toBe("batch-expiry-within-30-days-2026-10-04.csv");
    expect(heads).toContain("Sell order (FEFO)");
    expect(rows[0].slice(0, 2)).toEqual(["O-OLD", "OIL-1L"]);
    expect(rows[0][6]).toBe("Yes");
    expect(rows.at(-1)[8]).toBe(992);

    m.expiry.mockResolvedValue({ ...EXPIRY, rows: [], totals: { batches: 0, items: 0, qty: 0, value: 0, expired: { batches: 0, qty: 0, value: 0 }, expiring: { batches: 0, qty: 0, value: 0 } } });
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(await screen.findByText("Nothing expiring")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- slow stock and reorder

describe("slow stock", () => {
  it("ranks idle stock by value, marks what never sold and shows its share of the stock", async () => {
    m.slowMoving.mockResolvedValue(SLOW);
    at("/?tab=slow");
    const table = await screen.findByRole("table", { name: "Slow-moving stock" });
    const [oil, salt] = within(table).getAllByRole("row").slice(1, 3);
    expect(within(oil).getByText("1")).toBeInTheDocument();
    expect(within(oil).getByText("930.00")).toBeInTheDocument();
    expect(within(oil).getByText("01/06/2026")).toBeInTheDocument();
    expect(within(oil).getByText("125")).toBeInTheDocument();
    expect(within(salt).getByText("Never sold")).toBeInTheDocument();

    expect(within(card("Slow stock value")).getByText("990.00")).toBeInTheDocument();
    expect(within(card("Never sold")).getByText("1")).toBeInTheDocument();
    expect(within(card("Share of stock value")).getByText("43.5%")).toBeInTheDocument();
    expect(m.slowMoving).toHaveBeenCalledWith(expect.objectContaining({ days: "90" }));
  });

  it("the number of days is a filter, and zero is refused", async () => {
    m.slowMoving.mockResolvedValue(SLOW);
    at("/?tab=slow");
    await screen.findByRole("table", { name: "Slow-moving stock" });
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    await waitFor(() => expect(m.slowMoving).toHaveBeenLastCalledWith(expect.objectContaining({ days: "30" })));
    const calls = m.slowMoving.mock.calls.length;
    fireEvent.change(screen.getByLabelText("No sale in (days)"), { target: { value: "0" } });
    expect(await screen.findByText("Enter a whole number of days, 1 or more")).toBeInTheDocument();
    expect(m.slowMoving).toHaveBeenCalledTimes(calls);

    fireEvent.change(screen.getByLabelText("No sale in (days)"), { target: { value: "45" } });
    await waitFor(() => expect(m.slowMoving).toHaveBeenLastCalledWith(expect.objectContaining({ days: "45" })));
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(csv()[0]).toBe("slow-stock-90-days-2026-10-04.csv");
    expect(csv()[2][0].slice(0, 3)).toEqual([1, "OIL-1L", "Sunflower Oil"]);
  });

  it("says when every item is moving", async () => {
    m.slowMoving.mockResolvedValue({ ...SLOW, rows: [], totals: { items: 0, value: 0, neverSold: 0, pctOfStockValue: 0, stockValue: 100 } });
    at("/?tab=slow");
    expect(await screen.findByText("No slow stock")).toBeInTheDocument();
  });
});

describe("reorder", () => {
  it("lists items at or below their level with the shortfall and its cost", async () => {
    m.reorder.mockResolvedValue(REORDER);
    at("/?tab=reorder");
    const table = await screen.findByRole("table", { name: "Items at or below their reorder level" });
    const [rice, salt] = within(table).getAllByRole("row").slice(1, 3);
    expect(within(rice).getByText("Out of stock")).toBeInTheDocument();
    expect(within(rice).getByText("Gulf Mills")).toBeInTheDocument();
    expect(within(rice).getByText("1,753.85")).toBeInTheDocument();
    expect(within(salt).getByText("Below level")).toBeInTheDocument();
    expect(within(card("Items to reorder")).getByText("2")).toBeInTheDocument();
    expect(within(card("Out of stock")).getByText("1")).toBeInTheDocument();
    expect(within(card("Shortfall at cost")).getByText("1,773.85")).toBeInTheDocument();

    await choose("Category", "Grains");
    await waitFor(() => expect(m.reorder).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: "c1" })));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "salt" } });
    await waitFor(() => expect(m.reorder).toHaveBeenLastCalledWith(expect.objectContaining({ search: "salt" })));

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(csv()[0]).toBe("reorder.csv");
    expect(csv()[2].at(-1)[1]).toBe("Total");
  });

  it("says when nothing needs ordering", async () => {
    m.reorder.mockResolvedValue({ rows: [], totals: { items: 0, outOfStock: 0, shortfallValue: 0 } });
    at("/?tab=reorder");
    expect(await screen.findByText("Nothing to reorder")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- the page

describe("the page", () => {
  it("has seven tabs, opens on valuation, follows the URL, and switching loads only that report", async () => {
    m.valuation.mockResolvedValue(VALUATION);
    m.reorder.mockResolvedValue(REORDER);
    at();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Valuation", "Movement", "Item ledger", "Sales analysis", "Expiry", "Slow stock", "Reorder"]);
    expect(screen.getByRole("tablist", { name: "Stock reports" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Valuation" })).toHaveAttribute("aria-selected", "true");
    await screen.findByText("Basmati Rice");
    expect(m.reorder).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Reorder" }));
    expect(await screen.findByText("Gulf Mills")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reorder" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Stock reports");
  });

  it("keeps a tab's filters when you come back to it", async () => {
    m.valuation.mockResolvedValue(VALUATION);
    m.reorder.mockResolvedValue(REORDER);
    at();
    await screen.findByText("Basmati Rice");
    fireEvent.change(screen.getByLabelText("As at"), { target: { value: "2026-09-30" } });
    await waitFor(() => expect(m.valuation).toHaveBeenLastCalledWith(expect.objectContaining({ asOn: "2026-09-30" })));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Reorder" }));
    await screen.findByText("Gulf Mills");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Valuation" }));
    await screen.findByText("Basmati Rice");
    expect(m.valuation).toHaveBeenLastCalledWith(expect.objectContaining({ asOn: "2026-09-30" }));
  });

  it("every filter has a visible label, and the item and category lists are searchable selects", async () => {
    m.valuation.mockResolvedValue(VALUATION);
    at();
    await screen.findByText("Basmati Rice");
    for (const label of ["As at", "Category", "Search"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument();
    expect(document.querySelector("select")).toBeNull();
    for (const t of document.querySelectorAll("table")) expect(t.querySelector("caption")).not.toBeNull();
    for (const t of document.querySelectorAll("table")) expect(t.parentElement.className).toMatch(/overflow-x-auto/);
  });

  it("still works, with empty pickers and a retry, when the item lists cannot be loaded", async () => {
    m.lookups.mockRejectedValueOnce(new Error("lookup failed"));
    m.valuation.mockResolvedValue(VALUATION);
    at();
    expect(await screen.findByRole("alert")).toHaveTextContent("The item and category lists could not be loaded.");
    expect(await screen.findByText("Basmati Rice")).toBeInTheDocument();
    m.lookups.mockResolvedValue(LOOKUPS);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    await choose("Category", "Grains");
    await waitFor(() => expect(m.valuation).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: "c1" })));
  });
});
