import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "@testing-library/jest-dom";

import TradeOrdersPage from "../TradeOrdersPage";
import { tradeOrders } from "../../../lib/orderDocumentsApi";
import axiosInstance from "../../../axios/axios";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

// An organisation WITHOUT delivery notes cannot deliver against an order, so the order is converted to its
// invoice whole. The words ("Uninvoiced", no Delivered step) and the row action are what this pins.
vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: vi.fn(() => ({ companyName: "Zarvia", vatNumber: "100123456700003" })) }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div />, linkPending: vi.fn(async () => []) }));
vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));
vi.mock("../../../lib/orderDocumentsApi", () => ({
  tradeOrders: { list: vi.fn(), summary: vi.fn(), get: vi.fn(), activity: vi.fn(), remove: vi.fn(), create: vi.fn(), update: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), close: vi.fn(), reopen: vi.fn(), invoice: vi.fn() },
  goodsReceipts: {},
}));

const GRANTS = ["sales.view", "sales.create", "sales.edit", "sales.approve", "finance.view"];
const order = (over = {}) => ({
  _id: "o1", orderNo: "SORD-2026-0001", kind: "sales", status: "CONFIRMED", date: "2026-11-12T00:00:00.000Z", partyId: "c1",
  party: { _id: "c1", customerName: "Orient Insurance PJSC" }, totalAmount: 1800, subtotal: 1800, vatAmount: 0,
  items: [{ _id: "l1", itemCode: "I1", description: "Labour", qty: 1, price: 1800, rate: 1800 }],
  progress: { label: "Not delivered", totals: { invoiced: 0 }, lines: { l1: { ordered: 1, received: 0, onTheWay: 0, invoiced: 0, draftInvoice: 0, toReceive: 1 } } },
  actions: { confirm: false, receive: true, invoice: false, invoiceOrder: true, close: true, cancel: true }, invoices: [], ...over,
});

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
const show = (url, features) => {
  orgStatus = statusFor(GRANTS, features);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AsRole><Routes><Route path="*" element={<><TradeOrdersPage kind="sales" /><Where /></>} /></Routes></AsRole>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
  axiosInstance.get.mockResolvedValue({ data: { data: [] } });
  tradeOrders.list.mockResolvedValue({ rows: [order()], pagination: { current: 1, pages: 1, total: 1, limit: 25 } });
  tradeOrders.summary.mockResolvedValue({ byStatus: { CONFIRMED: { count: 1, value: 1800 } } });
  tradeOrders.get.mockImplementation(async () => order());
  tradeOrders.activity.mockResolvedValue({ rows: [] });
});

describe("the sales orders list, delivery notes off", () => {
  it("reads Uninvoiced, never Not delivered, and offers Convert to invoice beside View", async () => {
    show("/sales-orders", { deliveryNotes: false });
    await roleLoaded();
    expect(await screen.findByText("Uninvoiced")).toBeInTheDocument();
    expect(screen.queryByText("Not delivered")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /convert sorD-2026-0001 to an invoice/i })).toBeInTheDocument();
  });

  it("converts to a DRAFT invoice (no approval asked for) and opens it on the Invoices page", async () => {
    tradeOrders.invoice.mockResolvedValue({ invoice: { _id: "t1", transactionNo: "SO-2026-0027" }, documents: [] });
    show("/sales-orders", { deliveryNotes: false });
    await roleLoaded();
    fireEvent.click(await screen.findByRole("button", { name: /convert sord-2026-0001 to an invoice/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: /create draft invoice/i }));
    await waitFor(() => expect(tradeOrders.invoice).toHaveBeenCalledTimes(1));
    expect(tradeOrders.invoice.mock.calls[0][1]).not.toHaveProperty("approveNow");
    expect(axiosInstance.patch).not.toHaveBeenCalled(); // nothing was approved
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/sales-order?search=SO-2026-0027"));
  });

  it("with delivery notes the list is as it was: Not delivered and no Convert action", async () => {
    show("/sales-orders", {});
    await roleLoaded();
    expect(await screen.findByText("Not delivered")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /convert .* to an invoice/i })).not.toBeInTheDocument();
  });
});

describe("one sales order, delivery notes off", () => {
  it("has no Delivered step, says Uninvoiced, and Convert to invoice leads", async () => {
    show("/sales-orders?open=o1&mode=view", { deliveryNotes: false });
    await roleLoaded();
    expect((await screen.findAllByText("Uninvoiced")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Delivered")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /progress by line/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convert to invoice" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create delivery note/i })).not.toBeInTheDocument();
  });
});
