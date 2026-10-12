import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "@testing-library/jest-dom";

import TradeOrdersPage from "../TradeOrdersPage";
import GoodsReceivedPage from "../GoodsReceivedPage";
import { tradeOrders, goodsReceipts } from "../../../lib/orderDocumentsApi";
import axiosInstance from "../../../axios/axios";

// The order and goods-received screens inside the app: the list, one document, the actions the server allows, and the
// links other screens arrive by. The shared order form and invoice screen are the real ones; only the network is replaced.

vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: vi.fn(() => ({ companyName: "Zarvia", vatNumber: "100123456700003" })) }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div />, linkPending: vi.fn(async () => []) }));
vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
vi.mock("../../../lib/orderDocumentsApi", () => ({
  tradeOrders: { list: vi.fn(), summary: vi.fn(), get: vi.fn(), activity: vi.fn(), remove: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), close: vi.fn(), reopen: vi.fn(), invoice: vi.fn() },
  goodsReceipts: { list: vi.fn(), summary: vi.fn(), fromOrder: vi.fn(), get: vi.fn(), activity: vi.fn(), remove: vi.fn(), create: vi.fn(), update: vi.fn(), receive: vi.fn(), cancel: vi.fn(), invoice: vi.fn() },
}));

const emptyPage = { rows: [], pagination: { current: 1, pages: 1, total: 0, limit: 25 } };
const pageOf = (rows) => ({ rows, pagination: { current: 1, pages: 1, total: rows.length, limit: 25 } });

const progress = (over = {}) => ({ label: "Not delivered yet", lines: { l1: { ordered: 10, received: 0, onTheWay: 0, invoiced: 0, toReceive: 10 } }, ...over });
const order = (over = {}) => ({
  _id: "o1", orderNo: "PORD-2026-0001", kind: "purchase", status: "DRAFT", date: "2026-10-02T00:00:00.000Z", partyId: "v1",
  party: { _id: "v1", vendorName: "Gulf Foods" }, totalAmount: 1050, subtotal: 1000, vatAmount: 50,
  items: [{ _id: "l1", itemCode: "I1", description: "Rice", qty: 10, price: 100, rate: 1000 }],
  progress: progress(), actions: {}, ...over,
});
const receipt = (over = {}) => ({
  _id: "g1", receiptNo: "GRN-2026-0001", status: "DRAFT", date: "2026-10-03T00:00:00.000Z", partyId: "v1", party: { _id: "v1", vendorName: "Gulf Foods" },
  source: { kind: "purchase_order", id: "o1", no: "PORD-2026-0001" }, invoiceStatus: "NONE", totalAmount: 1050,
  items: [{ _id: "gl1", sourceLineId: "l1", itemCode: "I1", description: "Rice", qty: 10, price: 100, rate: 1000 }], actions: {}, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockImplementation(async (url) => {
    if (url === "/customers/customers") return { data: { data: [{ _id: "c1", customerId: "C1", customerName: "Al Noor" }] } };
    if (url === "/vendors/vendors") return { data: { data: [{ _id: "v1", vendorId: "V1", vendorName: "Gulf Foods" }] } };
    if (url === "/stock/stock") return { data: { data: { stocks: [{ _id: "s1", itemId: "I1", itemName: "Rice", purchasePrice: 100, salesPrice: 120, currentStock: 9 }] } } };
    return { data: { data: [] } };
  });
  tradeOrders.list.mockResolvedValue(emptyPage);
  tradeOrders.summary.mockResolvedValue({ DRAFT: { count: 0, value: 0 }, CONFIRMED: { count: 0, value: 0 }, CLOSED: { count: 0, value: 0 }, CANCELLED: { count: 0, value: 0 } });
  tradeOrders.activity.mockResolvedValue({ rows: [] });
  goodsReceipts.list.mockResolvedValue(emptyPage);
  goodsReceipts.summary.mockResolvedValue({ byStatus: {}, uninvoiced: { count: 0, value: 0 } });
  goodsReceipts.activity.mockResolvedValue({ rows: [] });
});

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
const at = (ui, url = "/") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="*" element={<>{ui}<Where /></>} /></Routes>
    </MemoryRouter>
  );

describe("TradeOrdersPage", () => {
  it("lists a vendor's orders with their progress, asking the server for purchase orders only", async () => {
    tradeOrders.list.mockResolvedValue(pageOf([order({ _id: "o2", orderNo: "PORD-2026-0002", status: "CONFIRMED", progress: progress({ label: "Partly received" }) })]));
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders");
    expect(await screen.findByText("PORD-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Partly received")).toBeInTheDocument();
    expect(tradeOrders.list).toHaveBeenCalledWith(expect.objectContaining({ kind: "purchase" }));
  });

  it("a sales order list asks for sales orders", async () => {
    at(<TradeOrdersPage kind="sales" />, "/sales-orders");
    await waitFor(() => expect(tradeOrders.list).toHaveBeenCalledWith(expect.objectContaining({ kind: "sales" })));
    expect(await screen.findAllByRole("button", { name: /new sales order/i })).not.toHaveLength(0);
  });

  it("?open= goes straight to that order", async () => {
    tradeOrders.get.mockResolvedValue(order());
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    await waitFor(() => expect(tradeOrders.get).toHaveBeenCalledWith("o1"));
    expect(tradeOrders.list).not.toHaveBeenCalled();
  });

  it("a draft says it posts nothing, and offers confirm only when the server allows it", async () => {
    tradeOrders.get.mockResolvedValue(order({ actions: { edit: true, confirm: true, delete: true } }));
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    expect(await screen.findByText(/posts nothing and cannot be received against/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm order/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /receive goods/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create invoice/i })).not.toBeInTheDocument();
  });

  it("confirming goes through a dialog and calls the server once", async () => {
    tradeOrders.get.mockResolvedValue(order({ actions: { confirm: true } }));
    tradeOrders.confirm.mockResolvedValue(order({ status: "CONFIRMED" }));
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    fireEvent.click(await screen.findByRole("button", { name: /confirm order/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/nothing is posted/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm order/i }));
    await waitFor(() => expect(tradeOrders.confirm).toHaveBeenCalledWith("o1"));
  });

  it("a confirmed purchase order sends the person to receive goods against it", async () => {
    tradeOrders.get.mockResolvedValue(order({ status: "CONFIRMED", actions: { receive: true, close: true, cancel: true } }));
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    fireEvent.click(await screen.findByRole("button", { name: /receive goods/i }));
    // the router in this test has one catch-all route, so the address is the evidence
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/goods-received?order=o1"));
  });

  it("a confirmed sales order sends the person to make a delivery note", async () => {
    tradeOrders.get.mockResolvedValue(order({ kind: "sales", orderNo: "SORD-2026-0001", status: "CONFIRMED", party: { customerName: "Al Noor" }, actions: { receive: true } }));
    at(<TradeOrdersPage kind="sales" />, "/sales-orders?open=o1");
    fireEvent.click(await screen.findByRole("button", { name: /create delivery note/i }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/delivery-notes?tradeOrder=o1"));
  });

  it("shows what has been received and what is left, line by line", async () => {
    tradeOrders.get.mockResolvedValue(
      order({ status: "CONFIRMED", actions: {}, progress: progress({ label: "Partly received", lines: { l1: { ordered: 10, received: 4, onTheWay: 1, invoiced: 2, toReceive: 5 } } }) })
    );
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    const table = await screen.findByRole("table", { name: "Progress by line" });
    const row = within(table).getByText("Rice").closest("tr");
    const cells = within(row).getAllByRole("cell").map((c) => c.textContent);
    expect(cells.slice(1)).toEqual(["10", "4", "1", "2", "5"]);
    expect(screen.getAllByText("Partly received").length).toBeGreaterThan(0);
  });

  it("creating the invoice from an order asks for the vendor's invoice number and reports the number it made", async () => {
    tradeOrders.get.mockResolvedValue(order({ status: "CONFIRMED", actions: { invoice: true } }));
    tradeOrders.invoice.mockResolvedValue({ invoice: { _id: "t1", transactionNo: "PO-2026-0044" }, documents: [] });
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    fireEvent.click(await screen.findByRole("button", { name: /create invoice/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/vendor's invoice number/i), { target: { value: "INV-77" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /create and approve invoice|create draft invoice/i }));
    await waitFor(() => expect(tradeOrders.invoice).toHaveBeenCalledWith("o1", expect.objectContaining({ vendorInvoiceNo: "INV-77" })));
    // the person stays on the order, where the new invoice is listed with where it stands
    await waitFor(() => expect(tradeOrders.get.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByTestId("where")).toHaveTextContent("/purchase-orders?open=o1");
  });

  it("Create and approve makes the invoice and approves it in one step", async () => {
    tradeOrders.get.mockResolvedValue(order({ status: "CONFIRMED", actions: { invoice: true } }));
    tradeOrders.invoice.mockResolvedValue({ invoice: { _id: "t1", transactionNo: "PO-2026-0044" }, documents: [] });
    axiosInstance.patch.mockResolvedValue({ data: { success: true, data: { status: "APPROVED" } } });
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    fireEvent.click(await screen.findByRole("button", { name: /create invoice/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: /approve the invoice now/i })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: /create and approve invoice/i }));
    await waitFor(() => expect(tradeOrders.invoice).toHaveBeenCalled());
    // the flag is for the screen: the server is never sent it
    expect(tradeOrders.invoice.mock.calls[0][1]).not.toHaveProperty("approveNow");
    await waitFor(() => expect(axiosInstance.patch).toHaveBeenCalledWith("/transactions/transactions/t1/process", { action: "approve" }));
  });

  it("Create draft only leaves the invoice to be approved later", async () => {
    tradeOrders.get.mockResolvedValue(order({ status: "CONFIRMED", actions: { invoice: true } }));
    tradeOrders.invoice.mockResolvedValue({ invoice: { _id: "t1", transactionNo: "PO-2026-0044" }, documents: [] });
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    fireEvent.click(await screen.findByRole("button", { name: /create invoice/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /approve the invoice now/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: /create draft invoice/i }));
    await waitFor(() => expect(tradeOrders.invoice).toHaveBeenCalled());
    expect(axiosInstance.patch).not.toHaveBeenCalled();
  });

  it("the order's own screen lists its invoices and approves a draft with one press", async () => {
    tradeOrders.get.mockResolvedValue(
      order({
        status: "CONFIRMED", actions: {}, progress: progress({ label: "Fully received", lines: { l1: { ordered: 10, received: 10, onTheWay: 0, invoiced: 10, toReceive: 0 } } }),
        invoices: [{ id: "t7", no: "PO-2026-0077", status: "DRAFT", date: "2026-10-05T00:00:00.000Z", totalAmount: 1050, paidAmount: 0, outstandingAmount: 1050, creditedAmount: 0 }],
      })
    );
    axiosInstance.patch.mockResolvedValue({ data: { success: true, data: { status: "APPROVED" } } });
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    expect(await screen.findByText("PO-2026-0077")).toBeInTheDocument();
    expect(screen.getByText(/Draft: not in the books yet/)).toBeInTheDocument();
    expect(screen.getByText(/Next:/)).toHaveTextContent("Approve PO-2026-0077");
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    await waitFor(() => expect(axiosInstance.patch).toHaveBeenCalledWith("/transactions/transactions/t7/process", { action: "approve" }));
  });

  it("an approved, unpaid invoice offers Make payment with the party and amount filled in", async () => {
    tradeOrders.get.mockResolvedValue(
      order({
        status: "CONFIRMED", actions: {}, progress: progress({ label: "Fully received", lines: {} }),
        invoices: [{ id: "t8", no: "PO-2026-0078", status: "APPROVED", date: "2026-10-05T00:00:00.000Z", totalAmount: 1050, paidAmount: 0, outstandingAmount: 1050, creditedAmount: 0 }],
      })
    );
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    fireEvent.click(await screen.findByRole("button", { name: /make payment/i }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/payment-voucher?party=v1&amount=1050"));
  });

  it("the server's refusal is shown in the dialog, not swallowed", async () => {
    tradeOrders.get.mockResolvedValue(order({ status: "CONFIRMED", actions: { invoice: true } }));
    tradeOrders.invoice.mockRejectedValue(Object.assign(new Error("Nothing has been received on this order that is not invoiced yet"), { code: "NOTHING_TO_INVOICE" }));
    at(<TradeOrdersPage kind="purchase" />, "/purchase-orders?open=o1");
    fireEvent.click(await screen.findByRole("button", { name: /create invoice/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /create and approve invoice|create draft invoice/i }));
    expect(await within(dialog).findByText(/not invoiced yet/i)).toBeInTheDocument();
  });
});

describe("GoodsReceivedPage", () => {
  it("opens on the list of goods received", async () => {
    goodsReceipts.list.mockResolvedValue(pageOf([receipt({ status: "RECEIVED", invoiceStatus: "NONE", actions: { invoice: true } })]));
    at(<GoodsReceivedPage />, "/goods-received");
    expect(await screen.findByText("GRN-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Against PORD-2026-0001")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Goods received" })).getByText("Not invoiced")).toBeInTheDocument();
  });

  it("?status=UNINVOICED opens the list on the receipts waiting for an invoice", async () => {
    at(<GoodsReceivedPage />, "/goods-received?status=UNINVOICED");
    await waitFor(() => expect(goodsReceipts.list).toHaveBeenCalledWith(expect.objectContaining({ status: "UNINVOICED" })));
    // a worklist ignores the period: nothing is hidden because of its date
    const call = goodsReceipts.list.mock.calls[0][0];
    expect(call.dateFrom).toBeUndefined();
    expect(call.dateTo).toBeUndefined();
  });

  it("?open= goes straight to that receipt", async () => {
    goodsReceipts.get.mockResolvedValue(receipt());
    at(<GoodsReceivedPage />, "/goods-received?open=g1");
    await waitFor(() => expect(goodsReceipts.get).toHaveBeenCalledWith("g1"));
    expect(goodsReceipts.list).not.toHaveBeenCalled();
  });

  it("?order= starts a receipt against that purchase order without asking", async () => {
    goodsReceipts.fromOrder.mockResolvedValue({
      order: { id: "o1", no: "PORD-2026-0001", status: "CONFIRMED", date: "2026-10-02", reference: "LPO-9" }, party: { vendorName: "Gulf Foods" },
      lines: [{ sourceLineId: "l1", itemCode: "I1", description: "Rice", ordered: 10, received: 3, onTheWay: 0, toReceive: 7, price: 100 }],
    });
    at(<GoodsReceivedPage />, "/goods-received?order=o1");
    expect(await screen.findByText("What goes on this receipt")).toBeInTheDocument();
    expect(goodsReceipts.fromOrder).toHaveBeenCalledWith("o1");
    // starts at what is left, never at what was ordered
    expect(await screen.findByLabelText("Quantity of Rice on this receipt")).toHaveValue(7);
    expect(goodsReceipts.list).not.toHaveBeenCalled();
  });

  it("saves a receipt against an order with only the line ids and quantities, never prices", async () => {
    goodsReceipts.fromOrder.mockResolvedValue({
      order: { id: "o1", no: "PORD-2026-0001", status: "CONFIRMED", date: "2026-10-02" }, party: { vendorName: "Gulf Foods" },
      lines: [{ sourceLineId: "l1", itemCode: "I1", description: "Rice", ordered: 10, received: 0, onTheWay: 0, toReceive: 10, price: 100 }],
    });
    goodsReceipts.create.mockResolvedValue(receipt());
    goodsReceipts.get.mockResolvedValue(receipt());
    at(<GoodsReceivedPage />, "/goods-received?order=o1");
    const qty = await screen.findByLabelText("Quantity of Rice on this receipt");
    fireEvent.change(qty, { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: /save goods receipt/i }));
    await waitFor(() => expect(goodsReceipts.create).toHaveBeenCalled());
    const body = goodsReceipts.create.mock.calls[0][0];
    expect(body.sourceOrderId).toBe("o1");
    expect(body.items).toEqual([{ sourceLineId: "l1", qty: 6 }]);
  });

  it("will not save more than is left on the order", async () => {
    goodsReceipts.fromOrder.mockResolvedValue({
      order: { id: "o1", no: "PORD-2026-0001", status: "CONFIRMED", date: "2026-10-02" }, party: { vendorName: "Gulf Foods" },
      lines: [{ sourceLineId: "l1", itemCode: "I1", description: "Rice", ordered: 10, received: 8, onTheWay: 0, toReceive: 2, price: 100 }],
    });
    at(<GoodsReceivedPage />, "/goods-received?order=o1");
    const qty = await screen.findByLabelText("Quantity of Rice on this receipt");
    fireEvent.change(qty, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /save goods receipt/i }));
    expect(goodsReceipts.create).not.toHaveBeenCalled();
    expect((await screen.findAllByText(/more than|exceeds|only .* left/i)).length).toBeGreaterThan(0);
  });

  it("a draft receipt is confirmed with who took the goods in", async () => {
    goodsReceipts.get.mockResolvedValue(receipt({ actions: { edit: true, receive: true, delete: true } }));
    goodsReceipts.receive.mockResolvedValue(receipt({ status: "RECEIVED" }));
    at(<GoodsReceivedPage />, "/goods-received?open=g1");
    fireEvent.click(await screen.findByRole("button", { name: /confirm goods received/i }));
    const dialog = await screen.findByRole("dialog");

    // nothing is sent without a name
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm goods received/i }));
    expect(goodsReceipts.receive).not.toHaveBeenCalled();
    expect(await within(dialog).findByText(/name of the person/i)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText(/who took the goods in|person who took/i), { target: { value: "Sam" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm goods received/i }));
    await waitFor(() => expect(goodsReceipts.receive).toHaveBeenCalledWith("g1", expect.objectContaining({ receivedBy: "Sam" })));
    const body = goodsReceipts.receive.mock.calls[0][1];
    expect(body.lines).toEqual([expect.objectContaining({ lineId: "gl1", receivedQty: 10 })]);
  });

  it("a short line cannot be confirmed without a reason", async () => {
    goodsReceipts.get.mockResolvedValue(receipt({ actions: { receive: true } }));
    at(<GoodsReceivedPage />, "/goods-received?open=g1");
    fireEvent.click(await screen.findByRole("button", { name: /confirm goods received/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(/who took the goods in|person who took/i), { target: { value: "Sam" } });
    fireEvent.change(within(dialog).getByLabelText("Quantity of Rice received"), { target: { value: "8" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm goods received/i }));
    expect(goodsReceipts.receive).not.toHaveBeenCalled();
    expect(await within(dialog).findByText(/say why 2 did not arrive/i)).toBeInTheDocument();
  });

  it("received goods that are not invoiced say so, and offer the purchase invoice", async () => {
    goodsReceipts.get.mockResolvedValue(receipt({ status: "RECEIVED", invoiceStatus: "NONE", actions: { invoice: true, cancel: true } }));
    at(<GoodsReceivedPage />, "/goods-received?open=g1");
    expect(await screen.findByText(/received but not invoiced/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create purchase invoice/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm goods received/i })).not.toBeInTheDocument();
  });

  it("an invoiced receipt links to its purchase invoice and offers nothing more", async () => {
    goodsReceipts.get.mockResolvedValue(receipt({ status: "RECEIVED", invoiceStatus: "INVOICED", invoice: { kind: "purchase_order", id: "t1", no: "PO-2026-0044" }, actions: {} }));
    at(<GoodsReceivedPage />, "/goods-received?open=g1");
    const link = await screen.findByRole("link", { name: "PO-2026-0044" });
    expect(link).toHaveAttribute("href", "/purchase-order?search=PO-2026-0044");
    expect(screen.queryByRole("button", { name: /create purchase invoice/i })).not.toBeInTheDocument();
  });

  it("creating the purchase invoice sends the receipt, the vendor's number and lands on the invoice", async () => {
    goodsReceipts.get.mockResolvedValue(receipt({ status: "RECEIVED", actions: { invoice: true }, vendorDeliveryNo: "VD-5" }));
    goodsReceipts.invoice.mockResolvedValue({ purchaseInvoice: { _id: "t1", transactionNo: "PO-2026-0044" }, goodsReceipts: [receipt()] });
    at(<GoodsReceivedPage />, "/goods-received?open=g1");
    fireEvent.click(await screen.findByRole("button", { name: /create purchase invoice/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/vendor's invoice number/i)).toHaveValue("VD-5");
    fireEvent.click(within(dialog).getByRole("button", { name: /create and approve invoice|create draft invoice/i }));
    await waitFor(() => expect(goodsReceipts.invoice).toHaveBeenCalledWith(expect.objectContaining({ receiptIds: ["g1"], vendorInvoiceNo: "VD-5" })));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/purchase-order?search=PO-2026-0044"));
  });

  it("New goods receipt asks how the goods arrived, and both ways lead somewhere", async () => {
    at(<GoodsReceivedPage />, "/goods-received");
    fireEvent.click((await screen.findAllByRole("button", { name: /new goods receipt/i }))[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Against a purchase order")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /on its own/i }));
    expect(await screen.findByLabelText("Vehicle")).toBeInTheDocument();
  });

  it("the Not invoiced tab ticks receipts and refuses two vendors on one invoice", async () => {
    goodsReceipts.list.mockResolvedValue(
      pageOf([
        receipt({ _id: "g1", receiptNo: "GRN-2026-0001", status: "RECEIVED", partyId: "v1", party: { _id: "v1", name: "Gulf Foods" }, actions: { invoice: true } }),
        receipt({ _id: "g2", receiptNo: "GRN-2026-0002", status: "RECEIVED", partyId: "v2", party: { _id: "v2", name: "Dubai Dairy" }, actions: { invoice: true } }),
      ])
    );
    at(<GoodsReceivedPage />, "/goods-received?status=UNINVOICED");
    fireEvent.click(await screen.findByLabelText("Select GRN-2026-0001"));
    fireEvent.click(screen.getByLabelText("Select GRN-2026-0002"));
    expect(await screen.findByText(/different vendors cannot go on one invoice/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create purchase invoice/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Select GRN-2026-0002")); // untick the second
    await waitFor(() => expect(screen.getByRole("button", { name: /create purchase invoice/i })).toBeEnabled());
  });
});
