import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

const m = vi.hoisted(() => ({ summary: vi.fn(), register: vi.fn(), movement: vi.fn(), lookups: vi.fn(), get: vi.fn() }));
vi.mock("../../../lib/tradeReportsApi", () => ({ tradeReports: { summary: m.summary, register: m.register, partyMovement: m.movement } }));
vi.mock("../../../lib/stockReportsApi", () => ({ stockReports: { lookups: m.lookups } }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get } }));

import TradeReports from "../TradeReports";

const totals = { quantity: 31, gross: 600, returns: 60, net: 540, vat: 27, total: 567, documents: 3, parties: 1, items: 2 };
const partyRow = { key: "c1", partyId: "c1", partyName: "Al Noor", partyCode: "C1", vatStatus: "registered", documents: 3, quantity: 31, gross: 600, returns: 60, net: 540, vat: 27, total: 567, avgPrice: 17.42, sharePct: 100, items: 2, firstDate: "2026-02-10T00:00:00.000Z", lastDate: "2026-03-25T00:00:00.000Z" };
const summary = (over = {}) => ({ direction: "sales", groupBy: "party", from: "2026-01-01", to: "2026-12-31", months: [], monthly: false, partyLabel: "Customer", rows: [partyRow], totals, truncated: false, ...over });

const show = (url = "/trade-reports") => render(<MemoryRouter initialEntries={[url]}><TradeReports /></MemoryRouter>);
const table = (name) => screen.getByRole("table", { name });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.summary.mockResolvedValue(summary());
  m.lookups.mockResolvedValue({ items: [{ id: "i1", name: "Rice 5kg", sku: "RICE" }], categories: [{ id: "k1", name: "Grain" }] });
  m.get.mockResolvedValue({ data: { data: [{ _id: "c1", customerName: "Al Noor" }] } });
});

describe("trade reports", () => {
  it("opens on sales by customer for this month and shows the figures with their totals", async () => {
    show();
    const t = await screen.findByRole("table", { name: "Report" });
    const row = within(t).getByText("Al Noor").closest("tr");
    expect(within(row).getByText("540.00")).toBeInTheDocument();
    expect(within(t).getAllByText("540.00")).toHaveLength(2); // the row and the total
    expect(m.summary.mock.calls[0][0]).toMatchObject({ direction: "sales", groupBy: "party" });
    expect(m.summary.mock.calls[0][0].from).toMatch(/-01$/); // the first of the month
    expect(screen.getByRole("columnheader", { name: "Returns" })).toBeInTheDocument();
  });

  it("asks for a column per month when Month by month is ticked, and draws them", async () => {
    show();
    await screen.findByRole("table", { name: "Report" });
    m.summary.mockResolvedValue(summary({ monthly: true, months: ["2026-02", "2026-03"], rows: [{ ...partyRow, monthly: { "2026-02": { quantity: 30, net: 450 }, "2026-03": { quantity: 1, net: 90 } } }] }));
    fireEvent.click(screen.getByLabelText("Month by month"));
    await waitFor(() => expect(m.summary.mock.calls.at(-1)[0]).toMatchObject({ monthly: true }));
    const t = await within(document.body).findByRole("columnheader", { name: "Feb 2026" });
    expect(t).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Mar 2026" })).toBeInTheDocument();
    expect(within(within(table("Report")).getByText("Al Noor").closest("tr")).getByText("450.00")).toBeInTheDocument();
  });

  it("opens the items a customer bought from their name", async () => {
    show();
    const t = await screen.findByRole("table", { name: "Report" });
    m.summary.mockResolvedValue(summary({ groupBy: "party_item", rows: [{ ...partyRow, key: "c1|i1", itemId: "i1", itemName: "Rice 5kg", itemCode: "RICE", category: "Grain", quantity: 26, net: 390 }] }));
    fireEvent.click(within(t).getByRole("button", { name: "Al Noor" }));
    await waitFor(() => expect(m.summary.mock.calls.at(-1)[0]).toMatchObject({ groupBy: "party_item", partyId: "c1" }));
    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
  });

  it("switches to purchases and speaks of vendors", async () => {
    show();
    await screen.findByRole("table", { name: "Report" });
    m.summary.mockResolvedValue(summary({ direction: "purchases", partyLabel: "Vendor", rows: [{ ...partyRow, partyName: "Gulf Mill" }] }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Purchases" })); // Radix tabs switch on mouse down
    await waitFor(() => expect(m.summary.mock.calls.at(-1)[0]).toMatchObject({ direction: "purchases" }));
    expect(await screen.findByText("Gulf Mill")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "By vendor" })).toBeInTheDocument();
  });

  it("reads the line register with its own totals", async () => {
    m.register.mockResolvedValue({
      direction: "sales", from: "2026-01-01", to: "2026-12-31", partyLabel: "Customer",
      rows: [{ date: "2026-03-28T00:00:00.000Z", documentNo: "SR-2026-0001", kind: "return", partyName: "Al Noor", itemId: "i1", itemName: "Rice 5kg", itemCode: "RICE", category: "Grain", quantity: -4, price: 15, net: -60, vat: 0, total: -60 }],
      totals: { lines: 1, quantity: -4, net: -60, vat: 0, total: -60 }, pagination: { page: 1, pages: 1, limit: 100, total: 1 },
    });
    show();
    await screen.findByRole("table", { name: "Report" });
    fireEvent.click(screen.getByRole("tab", { name: "Line register" }));
    const t = await screen.findByRole("table", { name: "Line register" });
    expect(within(t).getByText("SR-2026-0001")).toBeInTheDocument();
    expect(within(t).getByText("Return")).toBeInTheDocument();
    expect(within(t).getAllByText("-60.00").length).toBeGreaterThan(0);
  });

  it("shows receivables as opening, invoiced, returns, received and closing, and says it agrees with the balances", async () => {
    m.movement.mockResolvedValue({
      type: "customer", from: "2026-01-01", to: "2026-12-31",
      rows: [{ partyId: "c1", partyName: "Al Noor", partyCode: "C1", vatStatus: "registered", trn: "1", paymentTerms: "Net 30", opening: 100, invoiced: 600, returns: 60, settled: 200, other: 0, closing: 440, overdue: 90 }],
      totals: { opening: 100, invoiced: 600, returns: 60, settled: 200, other: 0, closing: 440, overdue: 90, parties: 1 },
    });
    show("/trade-reports?tab=receivables");
    const t = await screen.findByRole("table", { name: "Receivables" });
    const row = within(t).getByText("Al Noor").closest("tr");
    for (const v of ["100.00", "600.00", "60.00", "200.00", "440.00", "90.00"]) expect(within(row).getByText(v)).toBeInTheDocument();
    expect(screen.getByText(/agrees with/)).toBeInTheDocument();
    expect(m.movement.mock.calls[0][0]).toMatchObject({ type: "customer" });
  });

  it("explains an empty period instead of drawing an empty table", async () => {
    m.summary.mockResolvedValue(summary({ rows: [], totals: { ...totals, net: 0, documents: 0 } }));
    show();
    expect(await screen.findByText("Nothing in this period")).toBeInTheDocument();
  });

  it("reports a failed load with a way to retry", async () => {
    m.summary.mockRejectedValueOnce(new Error("The server is not reachable"));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("The server is not reachable");
  });
});
