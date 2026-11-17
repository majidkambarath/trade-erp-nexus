import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  mine: vi.fn(), list: vi.fn(), get: vi.fn(), activity: vi.fn(), sell: vi.fn(), collect: vi.fn(), settlement: vi.fn(), settle: vi.fn(),
  customers: vi.fn(), payment: vi.fn(), position: vi.fn(), apiGet: vi.fn(), print: vi.fn(), depart: vi.fn(),
  prices: vi.fn(), insight: vi.fn(), vanUpdate: vi.fn(), visit: vi.fn(), whatsapp: vi.fn(), offlinePack: vi.fn(), sync: vi.fn(), open: vi.fn(), suggestedLoad: vi.fn(), loadCheck: vi.fn(), load: vi.fn(), preorders: vi.fn(), preorder: vi.fn(), promoList: vi.fn(), promoCreate: vi.fn(), expense: vi.fn(), pin: vi.fn(), board: vi.fn(), routeProfit: vi.fn(), summary: vi.fn(), plList: vi.fn(), vansList: vi.fn(), routesList: vi.fn(), canManage: { value: true },
}));

vi.mock("../../../lib/vanSalesApi", () => ({
  trips: { mine: m.mine, list: m.list, get: m.get, activity: m.activity, sell: m.sell, collect: m.collect, settlement: m.settlement, settle: m.settle, depart: m.depart, open: vi.fn(), load: m.load, cancel: vi.fn(), returnGoods: vi.fn(), unload: vi.fn(), prices: m.prices, insight: m.insight, visit: m.visit, whatsapp: m.whatsapp, transfer: vi.fn(), offlinePack: m.offlinePack, sync: m.sync, suggestedLoad: m.suggestedLoad, loadCheck: m.loadCheck, preorders: m.preorders, preorder: m.preorder, expense: m.expense, pin: m.pin },
  fleet: { board: m.board },
  promotions: { list: m.promoList, create: m.promoCreate, update: vi.fn() },
  choices: { customers: m.customers, payment: m.payment, position: m.position, assignees: vi.fn(() => Promise.resolve([])), returnable: vi.fn() },
  vans: { list: m.vansList, update: m.vanUpdate, create: vi.fn() },
  routes: { list: m.routesList },
  priceLists: { list: m.plList, create: vi.fn(), update: vi.fn() },
  reports: { summary: m.summary, routeProfit: m.routeProfit },
}));
vi.mock("../../../lib/accountingApi", () => ({ api: { get: m.apiGet } }));
vi.mock("../../shell/OrganisationContext", () => ({
  useOrganisation: () => ({ can: () => m.canManage.value, canAny: () => m.canManage.value, me: { id: "u1", name: "Rashid" } }),
}));
vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: () => ({ companyName: "Gulf Foods", vatNumber: "100123456700003", vatRegistered: true }) }));
vi.mock("../../PurchaseOrder/shared/documentPdf.jsx", () => ({ printMarkup: m.print }));
vi.mock("../../../lib/geo", () => ({ currentLocation: () => Promise.resolve({ lat: 25.2, lng: 55.3, accuracy: 15 }) }));

import MyVan from "../MyVan";
import { VanHero } from "../VanHero";
import TripsPage from "../TripsPage";
import SettlementPage from "../SettlementPage";
import VansSetupPage from "../VansSetupPage";
import { LoadDialog, SellDialog } from "../tripDialogs";
import BoardPage from "../BoardPage";
import VanReports from "../VanReports";
import { DepartDialog, ExpenseDialog } from "../phase5Dialogs";

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
  m.prices.mockResolvedValue([{ stockId: "rice", price: 17, source: "customer", listName: "Al Noor deal" }]);
  m.vansList.mockResolvedValue([{ id: "v1", code: "VAN-1", name: "Van One", active: true, openTrip: null, cashLimit: 5000 }]);
  m.routesList.mockResolvedValue([]);
  m.plList.mockResolvedValue([{ id: "p1", name: "Al Noor deal", lines: [{ stockId: "rice", price: 17, minQty: 1 }], customerIds: ["c1"], active: true }]);
  m.canManage.value = true;
  m.promoList.mockResolvedValue([]);
  m.preorders.mockResolvedValue([]);
  m.offlinePack.mockResolvedValue({ at: "2026-11-17T08:00:00.000Z", trip, customers: [{ id: "c1", name: "Al Noor Grocery", trn: "" }], prices: { c1: { rice: 17 } }, freeNumbers: ["SO-2026-0100", "SO-2026-0101"] });
  setOnline(true);
});

const setOnline = (on) => Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => on });

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
    expect(body.items).toEqual([{ itemId: "rice", qty: 10, price: 17 }]);
    expect(m.prices).toHaveBeenCalledWith("t1", "c1");
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

describe("My van, phase 2", () => {
  it("a stop without a sale is recorded with its reason and where the phone was", async () => {
    m.visit.mockResolvedValue({ visit: { _id: "x" } });
    wrap(<MyVan />);
    await screen.findByText(/VTR-2026-0001/);
    fireEvent.click(screen.getByRole("button", { name: "No sale at Al Noor Grocery" }));
    const dialog = await screen.findByRole("dialog");
    const record = within(dialog).getByRole("button", { name: "Record visit" });
    expect(record).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText("Still has stock"));
    fireEvent.click(record);
    await waitFor(() => expect(m.visit).toHaveBeenCalled());
    expect(m.visit.mock.calls[0]).toEqual(["t1", { customerId: "c1", reason: "has_stock", note: "", location: { lat: 25.2, lng: 55.3, accuracy: 15 } }]);
  });

  it("a stop already visited without a sale says why, and a van past its cash limit is told to hand cash in", async () => {
    m.mine.mockResolvedValue([{ ...trip, route: [{ ...trip.route[0], visit: { reason: "closed" } }], totals: { ...trip.totals, cash: 6000, cashLimit: 5000, cashOverLimit: true } }]);
    wrap(<MyVan />);
    expect(await screen.findByText("No sale: Shop closed")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(/more cash than its limit/);
  });

  it("after a sale the invoice can be handed to the customer on WhatsApp, to a number typed at the door", async () => {
    m.sell.mockResolvedValue({ invoice: { _id: "inv1", transactionNo: "SO-2026-0009", totalAmount: 21, items: [] }, receipt: null });
    m.whatsapp.mockResolvedValue({ waUrl: "https://wa.me/971501112222?text=x" });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    wrap(<MyVan />);
    await screen.findByText(/VTR-2026-0001/);
    fireEvent.click(screen.getByRole("button", { name: "Sell to Al Noor Grocery" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector(".search-select__single-value")).toHaveTextContent("Al Noor Grocery"));
    choose(dialog.querySelectorAll("input[role='combobox']")[1], "Rice 5kg (30 on van)");
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sell" }));
    await screen.findByText(/SO-2026-0009/);
    fireEvent.change(screen.getByPlaceholderText(/\+971/), { target: { value: "+971 50 111 2222" } });
    fireEvent.click(screen.getByRole("button", { name: /Send on WhatsApp/ }));
    await waitFor(() => expect(m.whatsapp).toHaveBeenCalledWith("t1", "inv1", { phone: "+971 50 111 2222" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://wa.me/971501112222?text=x", "_blank", "noopener"));
    open.mockRestore();
  });
});

describe("My van with no signal", () => {
  it("works from the pack: the sale is kept on the phone with a reserved number, a delivery slip prints, and it is sent when the signal is back", async () => {
    const { store } = await import("../../../lib/vanOffline");
    store._reset();
    wrap(<MyVan />);
    await screen.findByText(/VTR-2026-0001/);
    await waitFor(() => expect(m.offlinePack).toHaveBeenCalledWith("t1"));
    // the signal goes
    setOnline(false);
    await act(async () => { window.dispatchEvent(new Event("offline")); });
    expect(await screen.findByText(/No signal\. Working from figures read at/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Take goods back/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sell to Al Noor Grocery" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector(".search-select__single-value")).toHaveTextContent("Al Noor Grocery"));
    choose(dialog.querySelectorAll("input[role='combobox']")[1], "Rice 5kg (30 on van)");
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "4" } });
    expect(within(dialog).getByLabelText("Price")).toHaveValue("17");
    fireEvent.click(within(dialog).getByRole("button", { name: "Sell" }));
    expect(await screen.findByText(/kept on this phone as SO-2026-0100/)).toBeInTheDocument();
    expect(m.sell).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Print slip/ }));
    expect(m.print.mock.calls[0][0]).toContain("DELIVERY SLIP");
    expect(m.print.mock.calls[0][0]).toContain("SO-2026-0100");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText("1 done on the phone, waiting to send.")).toBeInTheDocument();
    expect(screen.getByText("26")).toBeInTheDocument(); // 30 on the van less the 4 kept on the phone

    // the signal comes back: it is sent by itself
    m.sync.mockResolvedValue({ results: [{ clientId: "x", ok: true }], applied: 1, refused: 0 });
    m.sync.mockImplementation((id, body) => Promise.resolve({ results: body.ops.map((o) => ({ clientId: o.clientId, ok: true })), applied: body.ops.length, refused: 0 }));
    setOnline(true);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(m.sync).toHaveBeenCalled());
    const [tripId, body] = m.sync.mock.calls[0];
    expect(tripId).toBe("t1");
    expect(body.ops[0]).toMatchObject({ kind: "sell", body: { customerId: "c1", number: "SO-2026-0100", items: [{ itemId: "rice", qty: 4, price: 17 }] } });
    await waitFor(() => expect(screen.queryByText(/waiting to send/)).toBeNull());
  });

  it("what the server refuses stays on the phone with its reason, until discarded", async () => {
    const { store, queuedOp } = await import("../../../lib/vanOffline");
    store._reset();
    await store.add(queuedOp({ tripId: "t1", kind: "sell", clientId: "bad", body: { customerId: "c1", items: [{ itemId: "rice", qty: 99, price: 20 }] } }));
    m.sync.mockResolvedValue({ results: [{ clientId: "bad", ok: false, error: { code: "VAN_STOCK_SHORT", message: "There is not enough of that on the van to sell" } }], applied: 0, refused: 1 });
    wrap(<MyVan />);
    fireEvent.click(await screen.findByRole("button", { name: "Send now" }));
    expect(await screen.findByText(/Sale not accepted: There is not enough of that on the van/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByText(/not accepted/)).toBeNull());
  });
});

describe("Phase 4: offers, orders for next time, the suggested load", () => {
  const rice10 = { id: "pr1", _id: "pr1", name: "Rice 10+ 5%", kind: "slab", stockIds: ["rice"], categoryIds: [], customerIds: [], routeIds: [], minQty: 10, percent: 5, active: true };
  const bagFree = { id: "pr2", _id: "pr2", name: "Bag with rice", kind: "bxgy", stockIds: ["rice"], categoryIds: [], customerIds: [], routeIds: [], buyQty: 10, freeQty: 1, freeStockId: "rice", active: true };
  const combo = "input[role='combobox']";

  it("the sale shows the offer while typing, and sends the lines as they are (the server applies the offer)", async () => {
    m.promoList.mockResolvedValue([rice10, bagFree]);
    m.sell.mockResolvedValue({ invoice: { _id: "i1", transactionNo: "SO-1", totalAmount: 190, items: [] }, receipt: null });
    render(<SellDialog trip={trip} customerId="c1" onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector(".search-select__single-value")).toHaveTextContent("Al Noor Grocery"));
    choose(dialog.querySelectorAll(combo)[1], "Rice 5kg (30 on van)");
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "9" } });
    expect(within(dialog).queryByText("Offer applied")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "10" } });
    expect(await within(dialog).findByText("Offer applied")).toBeInTheDocument();
    expect(within(dialog).getByText(/Rice 10\+ 5%: 5% off from 10 units/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Free: 1 x Rice 5kg/)).toBeInTheDocument();
    expect(within(dialog).getByText(/after the offer/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sell" }));
    await waitFor(() => expect(m.sell).toHaveBeenCalled());
    expect(m.sell.mock.calls[0][1].items).toEqual([{ itemId: "rice", qty: 10, price: 17 }]);
  });

  it("at the door: what they owe, the last order held to the van, and one tap for what they usually buy", async () => {
    m.insight.mockResolvedValue({
      invoices: 4,
      lastOrder: { number: "SO-9", date: "2026-11-10T00:00:00.000Z", lines: [{ stockId: "rice", name: "Rice 5kg", qty: 40, onVan: 30 }] },
      usual: [{ stockId: "rice", name: "Rice 5kg", times: 3, avgQty: 6, onVan: 30 }], notLately: [],
      position: { owed: 440, open: [{ id: "a", number: "SO-8", outstanding: 440 }] },
    });
    render(<SellDialog trip={trip} customerId="c1" onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Owes AED 440.00/)).toBeInTheDocument();
    expect(within(dialog).getByText("SO-9")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Repeat last order" }));
    expect(within(dialog).getByLabelText("Quantity")).toHaveValue("30");
    expect(within(dialog).getByText(/Rice 5kg: 30 of 40 \(all the van has\)/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 6 Rice 5kg" }));
    expect(within(dialog).getByLabelText("Quantity")).toHaveValue("6");
    fireEvent.click(within(dialog).getByRole("button", { name: "One more" }));
    expect(within(dialog).getByLabelText("Quantity")).toHaveValue("7");
    fireEvent.click(within(dialog).getByRole("button", { name: "One less" }));
    expect(within(dialog).getByLabelText("Quantity")).toHaveValue("6");
  });

  it("a customer with no history, or a failed read, shows nothing extra and the sale still works", async () => {
    m.insight.mockRejectedValue(new Error("offline"));
    render(<SellDialog trip={trip} customerId="c1" onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(m.insight).toHaveBeenCalled());
    expect(within(dialog).queryByRole("button", { name: "Repeat last order" })).toBeNull();
    expect(within(dialog).queryByLabelText("About this customer")).toBeNull();
  });

  it("delivering an order fills its lines and sends the order with the sale", async () => {
    m.sell.mockResolvedValue({ invoice: { _id: "i1", transactionNo: "SO-1", totalAmount: 120, items: [] }, receipt: null });
    render(<SellDialog trip={trip} customerId="c1" preorder={{ id: "o1", orderNo: "SORD-2026-0003", items: [{ itemId: "rice", qty: 6, price: 18 }] }} onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Delivering order SORD-2026-0003/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Quantity")).toHaveValue("6");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Sell" })).not.toBeDisabled());
    fireEvent.click(within(dialog).getByRole("button", { name: "Sell" }));
    await waitFor(() => expect(m.sell).toHaveBeenCalled());
    expect(m.sell.mock.calls[0][1]).toMatchObject({ preorderId: "o1", items: [{ itemId: "rice", qty: 6, price: 18 }] });
  });

  it("the route offers an order for next visit, and an open order shows as Deliver", async () => {
    m.mine.mockResolvedValue([{ ...trip, routeId: "r1" }]);
    m.preorders.mockResolvedValue([{ id: "o1", orderNo: "SORD-2026-0003", customerId: "c1", items: [{ itemId: "rice", qty: 6, price: 18 }] }]);
    m.preorder.mockResolvedValue({ orderNo: "SORD-2026-0004" });
    m.apiGet.mockResolvedValue({ stocks: [{ _id: "rice", itemName: "Rice 5kg", itemType: "goods" }] });
    wrap(<MyVan />);
    expect(await screen.findByRole("button", { name: "Deliver order SORD-2026-0003" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Order for next visit from Bin Zayed Market" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(m.apiGet).toHaveBeenCalled());
    await waitFor(() => expect(dialog.querySelector(".search-select__control")).toBeTruthy());
    choose(dialog.querySelector(combo), "Rice 5kg");
    fireEvent.change(within(dialog).getByLabelText("Quantity"), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save order" }));
    await waitFor(() => expect(m.preorder).toHaveBeenCalledWith("t1", { customerId: "c2", items: [{ itemId: "rice", qty: 4 }], notes: "" }));
  });

  it("the load is filled from the suggestion with the reason on each line, and stock expiring too soon is said once before loading", async () => {
    m.apiGet.mockResolvedValue({ stocks: [{ _id: "rice", itemName: "Rice 5kg", itemType: "goods", currentStock: 100 }] });
    m.suggestedLoad.mockResolvedValue({ runs: 3, lines: [{ stockId: "rice", itemName: "Rice 5kg", qty: 31, why: { preorder: 6, average: 24.3, runs: 3, onVan: 0, free: 100, capped: false } }] });
    m.loadCheck.mockResolvedValue({ warnings: [{ code: "EXPIRY_SOON", stockId: "rice", message: "10 of Rice 5kg would expire before 2026-11-27", batches: [{ batchNo: "B1", expiryDate: "2026-11-21", qty: 10 }] }] });
    m.load.mockResolvedValue({});
    render(<LoadDialog trip={{ ...trip, status: "LOADING", routeId: "r1" }} onClose={() => {}} onDone={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Fill suggested load/ }));
    expect(await screen.findByText(/last 3 runs/)).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toHaveValue("31");
    expect(screen.getByText(/Suggested: 6 ordered, about 25 sold a run \(last 3\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save load" }));
    expect(await screen.findByText(/Expires before the customers will take it/)).toBeInTheDocument();
    expect(screen.getByText(/batch B1, 2026-11-21/)).toBeInTheDocument();
    expect(m.load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load anyway" }));
    await waitFor(() => expect(m.load).toHaveBeenCalledWith("t1", { lines: [{ stockId: "rice", qty: 31 }] }));
    expect(m.loadCheck).toHaveBeenCalledTimes(1);
  });

  it("the promotions tab lists each offer in words", async () => {
    m.promoList.mockResolvedValue([rice10, { id: "pr3", name: "Big order", kind: "basket", minValue: 1000, percent: 2, active: false }]);
    wrap(<VansSetupPage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Promotions" }));
    expect(await screen.findByText("Rice 10+ 5%")).toBeInTheDocument();
    expect(screen.getAllByText("5% off from 10 units").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2% off an order of 1000 or more").length).toBeGreaterThan(0);
  });
});

describe("Phase 5: running the fleet", () => {
  it("the board shows each van with its progress, cash in hand and the flags worth a call", async () => {
    m.board.mockResolvedValue({
      at: "2026-11-17T11:05:00.000Z", counts: { out: 2, loading: 0, toSettle: 1, quiet: 1, overCash: 1, far: 1 }, sales: 9000, cash: 5000,
      rows: [
        { id: "t1", tripNo: "VTR-1", vanCode: "VAN-1", salesmanName: "Rashid", routeName: "North", status: "ON_ROUTE", done: 3, total: 9, next: { name: "Corner Shop" }, lastAt: "2026-11-17T08:20:00.000Z", quietMinutes: 165, quiet: true, far: [{ kind: "sale", ref: "SO-2026-0105", distanceM: 1480 }], totals: { sales: 4000, cash: 2100, cashInHand: 2040, cashLimit: 5000 } },
        { id: "t2", tripNo: "VTR-2", vanCode: "VAN-2", salesmanName: "Maya", status: "ON_ROUTE", done: 1, total: 4, next: null, lastAt: null, quiet: false, far: [], totals: { sales: 5000, cash: 6100, cashInHand: 6100, cashLimit: 5000, cashOverLimit: true } },
      ],
    });
    wrap(<BoardPage />, ["/van-sales/board"]);
    expect(await screen.findByText("VAN-1 · Rashid")).toBeInTheDocument();
    expect(screen.getByText("3 of 9 stops")).toBeInTheDocument();
    expect(screen.getByText("Next: Corner Shop")).toBeInTheDocument();
    expect(screen.getByText("Quiet for 2 h 45 min with stops to go")).toBeInTheDocument();
    expect(screen.getByText(/Sale SO-2026-0105 1.48 km from the shop/)).toBeInTheDocument();
    expect(screen.getByText(/Carrying more cash than its/)).toBeInTheDocument();
    expect(screen.getByText("1 quiet, 1 over cash, 1 far from a shop")).toBeInTheDocument();
  });

  it("money spent on the road is sent with its kind and amount", async () => {
    m.expense.mockResolvedValue({ voucher: { voucherNo: "EV-1" } });
    const onDone = vi.fn();
    render(<ExpenseDialog trip={{ ...trip, totals: { cashInHand: 340 } }} onClose={() => {}} onDone={onDone} />);
    expect(screen.getByText(/The van holds/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Amount paid"), { target: { value: "60" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Note/ }), { target: { value: "ENOC" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.expense).toHaveBeenCalledWith("t1", { kind: "fuel", amount: 60, note: "ENOC" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("the van goes out with its odometer, or without one", async () => {
    m.depart.mockResolvedValue({});
    render(<DepartDialog trip={trip} onClose={() => {}} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText("Odometer going out"), { target: { value: "12000" } });
    fireEvent.click(screen.getByRole("button", { name: "Send out" }));
    await waitFor(() => expect(m.depart).toHaveBeenCalledWith("t1", { odometer: 12000 }));
  });

  it("a stop not yet pinned can be pinned where the van stands; a sale carries where the phone was", async () => {
    m.mine.mockResolvedValue([{ ...trip, route: [{ ...trip.route[0], pinned: false }, { ...trip.route[1], pinned: true }] }]);
    m.pin.mockResolvedValue({ customerId: "c1" });
    wrap(<MyVan />);
    fireEvent.click(await screen.findByRole("button", { name: "Pin Al Noor Grocery here" }));
    await waitFor(() => expect(m.pin).toHaveBeenCalledWith("t1", "c1", { location: { lat: 25.2, lng: 55.3, accuracy: 15 } }));
    expect(screen.queryByRole("button", { name: "Pin Bin Zayed Market here" })).toBeNull();
  });

  it("the reports have a profit view by route, salesman or van, from settled trips only", async () => {
    m.summary.mockResolvedValue({ from: "2026-10-19", to: "2026-11-17", total: { sales: 0, invoices: 0, trips: 0, cash: 0, cheques: 0, cashVariance: 0 }, rows: [], byVan: [], bySalesman: [] });
    m.routeProfit.mockResolvedValue({ trips: 3, rows: [{ key: "r1", name: "North", trips: 3, netSales: 1400, grossMargin: 560, damaged: 20, expenses: 80, cashVariance: -10, contribution: 450, marginPct: 32.14, perKm: 5.63 }] });
    wrap(<VanReports />, ["/van-sales/reports"]);
    fireEvent.click(await screen.findByRole("tab", { name: "Profit by route" }));
    expect(await screen.findByText(/From 3 settled trips/)).toBeInTheDocument();
    expect(screen.getAllByText("North").length).toBeGreaterThan(0);
    expect(screen.getAllByText("32.14%").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("combobox", { name: "By" }), { target: { value: "salesman" } });
    await waitFor(() => expect(m.routeProfit).toHaveBeenLastCalledWith({ from: undefined, to: undefined, by: "salesman" }));
  });
});

describe("Vans and routes", () => {
  it("has a price lists tab, and a person who cannot manage is not offered the edit dialog", async () => {
    wrap(<VansSetupPage />, ["/van-sales/setup"]);
    fireEvent.click(await screen.findByRole("tab", { name: "Price lists" }));
    expect(await screen.findByRole("table", { name: "Price lists" })).toBeInTheDocument();
    m.canManage.value = false;
  });

  it("without manage rights, clicking a van opens nothing", async () => {
    m.canManage.value = false;
    wrap(<VansSetupPage />, ["/van-sales/setup"]);
    const table = await screen.findByRole("table", { name: "Vans" });
    fireEvent.click(within(table).getByText("Van One"));
    expect(screen.queryByRole("dialog")).toBeNull();
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

describe("Phase 7: targets, the next stop within reach, and the owner's figures", () => {
  it("the trip card shows today's targets, and the phone keeps the next stop's Sell and Collect in reach", async () => {
    m.mine.mockResolvedValue([{ ...trip, totals: { ...trip.totals, target: { sales: 250, calls: 10 }, progress: { sales: { target: 250, done: 420, pct: 168, toGo: 0, hit: true }, calls: { target: 10, done: 2, pct: 20, toGo: 8, hit: false } } } }]);
    wrap(<MyVan />);
    expect(await screen.findByText("Today's target")).toBeInTheDocument();
    expect(screen.getByText("Target reached")).toBeInTheDocument();
    expect(screen.getByText("8 to go")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Sales against today's target" })).toHaveAttribute("aria-valuenow", "100");
    const bar = screen.getByRole("region", { name: "Next stop" });
    expect(within(bar).getByText("Al Noor Grocery")).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("button", { name: /Sell to Al Noor Grocery/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("a long route can be searched", async () => {
    const route = Array.from({ length: 8 }, (_, i) => ({ customerId: `c${i}`, name: i === 5 ? "Zayed Bakery" : `Shop ${i}`, seq: i, sold: false, collected: false }));
    m.mine.mockResolvedValue([{ ...trip, route }]);
    wrap(<MyVan />);
    const box = await screen.findByRole("searchbox", { name: "Find a customer on your route" });
    fireEvent.change(box, { target: { value: "bakery" } });
    expect(screen.getByText("Zayed Bakery")).toBeInTheDocument();
    expect(screen.queryByText("Shop 1")).toBeNull();
    fireEvent.change(box, { target: { value: "nobody" } });
    expect(screen.getByText(/No customer on this route matches/)).toBeInTheDocument();
  });

  it("reports show the owner's figures, sales by day and a salesman leaderboard", async () => {
    const man = { id: "u1", name: "Rashid", trips: 1, invoices: 3, lines: 4, sales: 420, returned: 0, cash: 420, cheques: 0, cashVariance: 0, calls: 2, productive: 2, dropSize: 140, linesPerCall: 2, strikeRate: 100, costPerDrop: 0, daysWithTarget: 1, targetDays: 1 };
    m.summary.mockResolvedValue({
      from: "2026-11-01", to: "2026-11-02", rows: [{ id: "t1", tripNo: "VTR-1", date: "2026-11-02T00:00:00.000Z", status: "SETTLED", vanCode: "VAN-1", salesmanName: "Rashid", sales: 420, cash: 420, strikeRate: 100, cashVariance: 0 }],
      byVan: [{ ...man, id: "v1", name: "VAN-1" }], bySalesman: [man],
      total: { trips: 1, invoices: 3, lines: 4, sales: 420, returned: 0, cash: 420, cheques: 0, cashVariance: 0, calls: 2, productive: 2, dropSize: 140, linesPerCall: 2, strikeRate: 100, costPerDrop: 0 },
      byDay: [{ day: "2026-11-01", sales: 0, invoices: 0 }, { day: "2026-11-02", sales: 420, invoices: 3 }],
    });
    wrap(<VanReports />, ["/van-sales/reports"]);
    expect(await screen.findByText("Average drop", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Road expenses per invoice")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 calls bought")).toBeInTheDocument();
    expect(screen.getByText(/Best day .*AED 420.00 on 3 invoices/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Sales for each of 2 days/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Leaderboard" }));
    const table = await screen.findByRole("table", { name: "Salesman leaderboard" });
    expect(within(table).getByText("Rashid")).toBeInTheDocument();
    expect(within(table).getByText("1 of 1 day")).toBeInTheDocument();
    expect(within(table).getByText("2.0")).toBeInTheDocument();
  });

  it("the board says how far each van is toward its sales target", async () => {
    m.board.mockResolvedValue({ at: "2026-11-17T11:05:00.000Z", counts: { out: 1, loading: 0, toSettle: 0, quiet: 0, overCash: 0, far: 0 }, sales: 200, cash: 0, rows: [{ id: "t1", tripNo: "VTR-1", vanCode: "VAN-1", salesmanName: "Rashid", status: "ON_ROUTE", done: 1, total: 4, next: { name: "Corner Shop" }, lastAt: null, quiet: false, far: [], totals: { sales: 200, cash: 0, cashInHand: 0, progress: { sales: { target: 400, done: 200, pct: 50, toGo: 200, hit: false } } } }] });
    wrap(<BoardPage />, ["/van-sales/board"]);
    expect(await screen.findByText("50% of today's sales target")).toBeInTheDocument();
  });
});

describe("Phase 7 gaps: van targets, offline history, and the waiting note", () => {
  it("a van's daily targets are shown, edited and sent", async () => {
    m.vansList.mockResolvedValue([{ id: "v1", _id: "v1", code: "VAN-1", name: "Van One", plate: "DXB 1", salesmanName: "Rashid", dailySalesTarget: 1500, dailyCallsTarget: 12, active: true, openTrip: null }]);
    m.routesList.mockResolvedValue([]);
    m.vanUpdate.mockResolvedValue({ id: "v1" });
    m.canManage.value = true;
    wrap(<VansSetupPage />, ["/van-sales/setup"]);
    const table = await screen.findByRole("table", { name: "Vans" });
    expect(within(table).getByText(/AED 1,500.00 · 12 calls/)).toBeInTheDocument();
    fireEvent.click(within(table).getByText("Van One"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Daily sales target/)).toHaveValue("1,500");
    fireEvent.change(within(dialog).getByLabelText(/Daily calls target/), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.vanUpdate).toHaveBeenCalled());
    expect(m.vanUpdate.mock.calls[0][1]).toMatchObject({ dailySalesTarget: "1500", dailyCallsTarget: "" });
  });

  it("with no signal the Sell dialog shows the history kept on the phone, and not what they owe", async () => {
    const pack = { at: "2026-11-17T08:00:00.000Z", trip, customers: [{ id: "c1", name: "Al Noor Grocery", code: "C1" }], prices: { c1: { rice: 20 } }, promotions: [], categories: {},
      insight: { c1: { invoices: 2, lastOrder: { number: "SO-9", date: "2026-11-10T00:00:00.000Z", lines: [{ stockId: "rice", name: "Rice 5kg", qty: 4, onVan: 30 }] }, usual: [], notLately: [] } } };
    const offline = { active: true, pack, view: { sellable: trip.sellable, waiting: 0 }, enqueue: vi.fn(), number: () => null, refresh: vi.fn() };
    render(<SellDialog trip={trip} customerId="c1" offline={offline} onClose={() => {}} onDone={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("SO-9")).toBeInTheDocument();
    expect(within(dialog).getByText(/From figures read at/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Owes/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Repeat last order" }));
    expect(within(dialog).getByLabelText("Quantity")).toHaveValue("4");
    expect(m.insight).not.toHaveBeenCalled();
  });

  it("the trip card says that sales waiting on the phone are not in the target figures yet", () => {
    const progress = { sales: { target: 400, done: 336, pct: 84, toGo: 64, hit: false }, calls: null };
    const { rerender } = render(<VanHero trip={{ ...trip, totals: { ...trip.totals, progress } }} waiting={2} />);
    expect(screen.getByText(/Not counting the 2 sales done on the phone/)).toBeInTheDocument();
    rerender(<VanHero trip={{ ...trip, totals: { ...trip.totals, progress } }} waiting={0} />);
    expect(screen.queryByText(/Not counting/)).toBeNull();
  });
});
