import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  mine: vi.fn(), list: vi.fn(), get: vi.fn(), activity: vi.fn(), sell: vi.fn(), collect: vi.fn(), settlement: vi.fn(), settle: vi.fn(),
  customers: vi.fn(), payment: vi.fn(), position: vi.fn(), apiGet: vi.fn(), print: vi.fn(), depart: vi.fn(),
}));

vi.mock("../../../lib/vanSalesApi", () => ({
  trips: { mine: m.mine, list: m.list, get: m.get, activity: m.activity, sell: m.sell, collect: m.collect, settlement: m.settlement, settle: m.settle, depart: m.depart, open: vi.fn(), load: vi.fn(), cancel: vi.fn(), returnGoods: vi.fn(), unload: vi.fn() },
  choices: { customers: m.customers, payment: m.payment, position: m.position, assignees: vi.fn(() => Promise.resolve([])), returnable: vi.fn() },
  vans: { list: vi.fn(() => Promise.resolve([])) },
  routes: {},
  reports: {},
}));
vi.mock("../../../lib/accountingApi", () => ({ api: { get: m.apiGet } }));
vi.mock("../../shell/OrganisationContext", () => ({
  useOrganisation: () => ({ can: () => true, canAny: () => true, me: { id: "u1", name: "Rashid" } }),
}));
vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: () => ({ companyName: "Gulf Foods", vatNumber: "100123456700003", vatRegistered: true }) }));
vi.mock("../../PurchaseOrder/shared/documentPdf.jsx", () => ({ printMarkup: m.print }));

import MyVan from "../MyVan";
import TripsPage from "../TripsPage";
import SettlementPage from "../SettlementPage";

const wrap = (ui, entries = ["/van-sales/my-van"]) => render(<MemoryRouter initialEntries={entries}>{ui}</MemoryRouter>);

const trip = {
  id: "t1", tripNo: "VTR-2026-0001", vanCode: "VAN-1", vanName: "Van One", salesmanName: "Rashid", status: "ON_ROUTE", date: "2026-11-17T00:00:00.000Z",
  routeName: "North", loads: [{ no: 1 }],
  sellable: [{ stockId: "rice", itemName: "Rice 5kg", qty: 30, salesPrice: 20 }],
  damaged: [],
  route: [{ customerId: "c1", name: "Al Noor Grocery", seq: 0, sold: false, collected: false }, { customerId: "c2", name: "Bin Zayed Market", seq: 1, sold: true, collected: false }],
  totals: { sales: 210, cash: 210, cheques: 0, returned: 0, invoices: 1, returns: 0 },
};

// react-select: open the list and click an option. The inputs, in the order they appear in the dialog.
function choose(input, text) {
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.click(screen.getByText(text, { selector: ".search-select__option, .search-select__option *" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  m.mine.mockResolvedValue([trip]);
  m.customers.mockResolvedValue([{ id: "c1", name: "Al Noor Grocery", code: "C1" }, { id: "c2", name: "Bin Zayed Market", code: "C2" }]);
  m.payment.mockResolvedValue({ cheque: true, bankAccounts: [{ id: "b1", name: "Main Bank" }] });
  m.apiGet.mockResolvedValue({ stocks: [] });
});

describe("My van", () => {
  it("says so when no van is out for the person", async () => {
    m.mine.mockResolvedValue([]);
    wrap(<MyVan />);
    expect(await screen.findByText("No van is out for you")).toBeInTheDocument();
  });

  it("shows the trip, what is on the van, the money so far and the route in order, with the stops already served ticked", async () => {
    wrap(<MyVan />);
    expect(await screen.findByText(/VTR-2026-0001/)).toBeInTheDocument();
    expect(screen.getByText("On the road")).toBeInTheDocument();
    expect(screen.getByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    const stops = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(stops.findIndex((t) => t.includes("Al Noor"))).toBeLessThan(stops.findIndex((t) => t.includes("Bin Zayed")));
    expect(screen.getByLabelText("Visited")).toBeInTheDocument();
  });

  it("a salesman's own screen offers sell, collect and return, but not loading or cancelling the trip", async () => {
    wrap(<MyVan />);
    await screen.findByText(/VTR-2026-0001/);
    expect(screen.getByRole("button", { name: /^Sell$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Collect money/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take goods back/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Load the van|Top up/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Cancel trip/ })).toBeNull();
  });

  it("a stop's Sell opens the sale with that customer chosen, and selling more than is on the van is stopped before it is sent", async () => {
    wrap(<MyVan />);
    await screen.findByText(/VTR-2026-0001/);
    fireEvent.click(screen.getByRole("button", { name: "Sell to Al Noor Grocery" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector(".search-select__single-value")).toHaveTextContent("Al Noor Grocery"));
    const inputs = dialog.querySelectorAll("input[role='combobox']");
    choose(inputs[1], "Rice 5kg (30 on van)");
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "31" } });
    expect(within(dialog).getByText("Only 30 of Rice 5kg is on the van.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sell" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "10" } });
    expect(within(dialog).getByRole("button", { name: "Sell" })).not.toBeDisabled();
    expect(m.sell).not.toHaveBeenCalled();
  });

  it("a sale is sent with the list price filled in, then the slip can be printed", async () => {
    m.sell.mockResolvedValue({
      invoice: { transactionNo: "SO-2026-0007", date: "2026-11-17T00:00:00.000Z", totalAmount: 210, items: [{ description: "Rice 5kg", qty: 10, price: 20, vatAmount: 10, lineTotal: 210 }] },
      receipt: { voucherNo: "RV-2026-0003", totalAmount: 210 },
    });
    wrap(<MyVan />);
    await screen.findByText(/VTR-2026-0001/);
    fireEvent.click(screen.getByRole("button", { name: "Sell to Al Noor Grocery" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector(".search-select__single-value")).toHaveTextContent("Al Noor Grocery"));
    choose(dialog.querySelectorAll("input[role='combobox']")[1], "Rice 5kg (30 on van)");
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "10" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Money received now" }), { target: { value: "cash" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sell" }));
    await waitFor(() => expect(m.sell).toHaveBeenCalled());
    const [id, body] = m.sell.mock.calls[0];
    expect(id).toBe("t1");
    expect(body.customerId).toBe("c1");
    expect(body.items).toEqual([{ itemId: "rice", qty: 10, price: 20 }]);
    expect(body.payNow).toEqual({ mode: "cash", full: true });
    const done = await screen.findByText(/SO-2026-0007/);
    expect(done).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Print slip/ }));
    expect(m.print).toHaveBeenCalledTimes(1);
    expect(m.print.mock.calls[0][0]).toContain("TAX INVOICE");
    expect(m.print.mock.calls[0][0]).toContain("Al Noor Grocery");
  });

  it("a credit warning from the server is shown with the way past it", async () => {
    m.sell.mockRejectedValueOnce(Object.assign(new Error("Credit warning for Al Noor Grocery: over the limit"), { code: "RISK_WARNING_ACKNOWLEDGEMENT_REQUIRED" }));
    wrap(<MyVan />);
    await screen.findByText(/VTR-2026-0001/);
    fireEvent.click(screen.getByRole("button", { name: "Sell to Al Noor Grocery" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector(".search-select__single-value")).toHaveTextContent("Al Noor Grocery"));
    choose(dialog.querySelectorAll("input[role='combobox']")[1], "Rice 5kg (30 on van)");
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sell" }));
    expect(await within(dialog).findByText("Credit warning")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Sell anyway/)).toBeInTheDocument();
  });
});

describe("Trips", () => {
  it("lists the trips with the van, the salesman and the status", async () => {
    m.list.mockResolvedValue([{ id: "t1", tripNo: "VTR-2026-0001", vanCode: "VAN-1", vanName: "Van One", salesmanName: "Rashid", routeName: "North", date: "2026-11-17T00:00:00.000Z", status: "ON_ROUTE", loadedUnits: 60 }]);
    wrap(<TripsPage />, ["/van-sales/trips"]);
    const table = await screen.findByRole("table", { name: "Van trips" });
    expect(within(table).getByText("VTR-2026-0001")).toBeInTheDocument();
    expect(within(table).getByText("On the road")).toBeInTheDocument();
    expect(within(table).getByText("60 units")).toBeInTheDocument();
  });
});

describe("Settlement", () => {
  const plan = {
    trip: { id: "t1", tripNo: "VTR-2026-0001" },
    cash: { expected: 210, handed: 210, short: 0, over: 0, variance: 0 }, cheques: [], missingCheques: [],
    rows: [{ stockId: "rice", itemName: "Rice 5kg", expectedGood: 30, countedGood: 29, expectedDamaged: 0, countedDamaged: 0, difference: -1, varianceValue: -10, damagedValue: 0 }],
    stockVarianceValue: -10, damagedValue: 0, blockers: [],
    warnings: [{ code: "STOCK_DIFFERENCE", message: "1 item counted differently from what the van should hold (-10.00 at cost). It is booked as a stock adjustment." }],
  };

  it("lists the trips waiting, and settling needs each difference ticked first", async () => {
    m.list.mockImplementation((p) => Promise.resolve(p?.status === "UNLOADED" ? [{ id: "t1", tripNo: "VTR-2026-0001", vanCode: "VAN-1", vanName: "Van One", salesmanName: "Rashid", date: "2026-11-17T00:00:00.000Z", status: "UNLOADED" }] : []));
    m.settlement.mockResolvedValue(plan);
    m.settle.mockResolvedValue({ trip: { id: "t1" }, plan });
    wrap(<SettlementPage />, ["/van-sales/settlement"]);
    const table = await screen.findByRole("table", { name: "Trips waiting to be settled" });
    fireEvent.click(within(table).getByRole("button", { name: "Settle" }));
    const dialog = await screen.findByRole("dialog");
    const settle = await within(dialog).findByRole("button", { name: "Settle trip" });
    expect(settle).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(settle).not.toBeDisabled();
    fireEvent.click(settle);
    await waitFor(() => expect(m.settle).toHaveBeenCalled());
    const [, body] = m.settle.mock.calls[0];
    expect(body.acknowledge).toEqual(["STOCK_DIFFERENCE"]);
    expect(body.cashHanded).toBe(210);
  });

  it("a blocker (a receipt waiting for approval) keeps the button off however many boxes are ticked", async () => {
    m.list.mockImplementation((p) => Promise.resolve(p?.status === "UNLOADED" ? [{ id: "t1", tripNo: "VTR-2026-0001", vanCode: "VAN-1", salesmanName: "Rashid", date: "2026-11-17T00:00:00.000Z", status: "UNLOADED" }] : []));
    m.settlement.mockResolvedValue({ ...plan, warnings: [], blockers: [{ code: "PENDING_RECEIPTS", message: "1 receipt is waiting for approval. Approve or reject it first." }] });
    wrap(<SettlementPage />, ["/van-sales/settlement"]);
    fireEvent.click(await screen.findByRole("button", { name: "Settle" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/waiting for approval/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Settle trip" })).toBeDisabled();
  });
});
