import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import CustomerDocumentsTab from "../CustomerDocumentsTab";
import { documentFlow, orderClose } from "../../../lib/salesDocumentsApi";

vi.mock("../../../lib/salesDocumentsApi", () => ({
  documentFlow: { customer: vi.fn() },
  orderClose: { preview: vi.fn(), closeShort: vi.fn(), reopen: vi.fn() },
}));

const summary = (over = {}) => ({
  outWithCustomer: { count: 1, value: 100 }, acceptedNotOrdered: { count: 1, value: 300 }, ordersToApprove: { count: 1, value: 500 },
  deliveredNotInvoiced: { count: 2, value: 168 }, pastInvoiceWindow: 0, ...over,
});
const quote = (over = {}) => ({ _id: "q1", quotationNo: "QT-2026-0007", status: "SENT", expired: false, daysLeft: 12, validUntil: "2026-11-05T00:00:00.000Z", totalAmount: 100, ...over });
const order = (over = {}) => ({ _id: "o1", transactionNo: "SO-2026-0031", status: "DRAFT", totalAmount: 500, outstandingAmount: 500, ...over });
const note = (over = {}) => ({ _id: "n1", deliveryNoteNo: "DLN-2026-0012", status: "DELIVERED", deliveredAt: "2026-10-04T08:00:00.000Z", totalAmount: 105, ...over });
const chain = (over = {}) => ({ key: "k", stage: "quoted", mode: null, quotation: null, order: null, notes: [], amount: 100, date: "2026-10-06T00:00:00.000Z", invoiceClock: null, expiresInDays: null, ...over });

const waiting = chain({ key: "w", quotation: quote() });
const accepted = chain({ key: "a", quotation: quote({ _id: "q2", quotationNo: "QT-2026-0008", status: "ACCEPTED" }), amount: 300 });
const toApprove = chain({ key: "o", stage: "ordered", order: order(), amount: 500 });
const finished = chain({ key: "f", stage: "invoiced", mode: "order_first", quotation: quote({ _id: "q3", quotationNo: "QT-2026-0003", status: "CONVERTED" }), order: order({ _id: "o9", transactionNo: "SO-2026-0009", status: "APPROVED", outstandingAmount: 0 }), notes: [note({ _id: "n9", deliveryNoteNo: "DLN-2026-0009", invoiceStatus: "INVOICED" })] });
const goodsFirst = chain({ key: "g", stage: "delivered", mode: "delivery_first", notes: [note()], invoiceClock: { clock: "dueSoon", daysToStandard: 2, standardDue: "2026-10-18", summaryDue: "2026-11-14" } });

const show = (over = {}) => {
  documentFlow.customer.mockResolvedValue({ customer: { _id: "c1", customerName: "Ann" }, chains: [waiting, accepted, toApprove, finished, goodsFirst], summary: summary(), truncated: false, ...over });
  return render(<MemoryRouter><CustomerDocumentsTab customerId="c1" /></MemoryRouter>);
};

beforeEach(() => vi.clearAllMocks());

describe("CustomerDocumentsTab", () => {
  it("asks the server for this customer", async () => {
    show();
    await screen.findByText("Out with the customer");
    expect(documentFlow.customer).toHaveBeenCalledWith("c1");
  });

  it("opens on the deals that need doing, and says how many there are in each group", async () => {
    show();
    const tab = await screen.findByRole("tab", { name: /needs action/i });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toHaveTextContent("3"); // accepted, to approve, delivered-not-invoiced
    expect(screen.getByRole("tab", { name: /in progress/i })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /^done/i })).toHaveTextContent("1");

    expect(screen.getByRole("article", { name: "Quotation QT-2026-0008" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Sales order SO-2026-0031" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Quotation QT-2026-0007" })).not.toBeInTheDocument(); // waiting on the customer
    expect(screen.queryByRole("article", { name: /SO-2026-0009/ })).not.toBeInTheDocument(); // finished
  });

  it("the other groups are one tap away", async () => {
    show();
    fireEvent.click(await screen.findByRole("tab", { name: /in progress/i }));
    expect(screen.getByRole("article", { name: "Quotation QT-2026-0007" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^done/i }));
    expect(screen.getByRole("article", { name: "Tax invoice SO-2026-0009" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^all/i }));
    expect(screen.getAllByRole("article")).toHaveLength(5);
  });

  it("a deal reads as a stepper: each step says where it stands and links to its document", async () => {
    show();
    fireEvent.click(await screen.findByRole("tab", { name: /^done/i }));
    const deal = screen.getByRole("article", { name: "Tax invoice SO-2026-0009" });
    const steps = within(deal).getByRole("list", { name: "Steps of this deal" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    for (const label of ["Quotation", "Sales order", "Delivery", "Invoice"]) expect(within(steps).getByText(label)).toBeInTheDocument();
    expect(within(steps).getAllByText("Done")).toHaveLength(4); // a word for every state, not only a colour

    expect(within(steps).getByRole("link", { name: /QT-2026-0003/ })).toHaveAttribute("href", "/quotations?open=q3");
    expect(within(steps).getByRole("link", { name: /DLN-2026-0009/ })).toHaveAttribute("href", "/delivery-notes?open=n9");
    const invoice = within(steps).getAllByRole("link", { name: /SO-2026-0009/ });
    expect(invoice.length).toBe(2); // the order, and the same document as the invoice it became
    expect(invoice[0]).toHaveAttribute("href", "/sales-order?search=SO-2026-0009");
    expect(within(deal).queryByText(/^Next:/)).not.toBeInTheDocument(); // nothing left to do
  });

  it("the next step is one button that goes to where it is done", async () => {
    show();
    const accept = await screen.findByRole("article", { name: "Quotation QT-2026-0008" });
    expect(within(accept).getByText(/The customer said yes/)).toBeInTheDocument();
    expect(within(accept).getByRole("link", { name: /convert to a sales order/i })).toHaveAttribute("href", "/quotations?open=q2");

    const approve = screen.getByRole("article", { name: "Sales order SO-2026-0031" });
    expect(within(approve).getByRole("link", { name: /approve the order/i })).toHaveAttribute("href", "/sales-order?search=SO-2026-0031");
  });

  it("goods first reads quotation, delivery, invoice, with the 14-day clock beside it", async () => {
    show();
    const deal = await screen.findByRole("article", { name: "Delivery note DLN-2026-0012" });
    const steps = within(deal).getByRole("list", { name: "Steps of this deal" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    expect(within(steps).queryByText("Sales order")).not.toBeInTheDocument();
    expect(within(deal).getAllByText("Invoice due in 2 days").length).toBeGreaterThan(0);
    expect(within(deal).getByRole("link", { name: /create the invoice/i })).toHaveAttribute("href", "/delivery-notes?status=UNINVOICED");
  });

  it("a signed-for delivery that is only part of the order is not shown as finished", async () => {
    const part = chain({
      key: "p", stage: "delivering", mode: "order_first",
      order: order({ _id: "o5", transactionNo: "SO-2026-0050" }),
      notes: [note({ _id: "n5", deliveryNoteNo: "DLN-2026-0050" })],
      delivery: { started: true, complete: false, remaining: [{ description: "Rice", qty: 5 }] },
    });
    show({ chains: [part] });
    const deal = await screen.findByRole("article", { name: "Sales order SO-2026-0050" });
    const steps = within(deal).getByRole("list", { name: "Steps of this deal" });
    const delivery = within(steps).getByText("Delivery").closest("li");
    expect(within(delivery).queryByText("Done")).not.toBeInTheDocument();
    expect(within(delivery).getByText("Still to deliver: 5 x Rice")).toBeInTheDocument();
    expect(within(deal).getByRole("link", { name: /deliver the rest/i })).toHaveAttribute("href", "/delivery-notes?order=o5");
    expect(screen.getByRole("tab", { name: /needs action/i })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the figures that matter", async () => {
    show({ summary: summary({ pastInvoiceWindow: 1 }) });
    await screen.findByText("Delivered, not invoiced");
    expect(screen.getByText("1 past the 14-day window")).toBeInTheDocument();
    expect(screen.getByText("1 draft, not yet invoiced")).toBeInTheDocument();
    expect(screen.getByText("1 offer still valid")).toBeInTheDocument();
    expect(screen.getByText("1 waiting to be converted")).toBeInTheDocument();
  });

  it("with nothing to do it opens on everything instead of an empty list", async () => {
    show({ chains: [finished] });
    expect(await screen.findByRole("tab", { name: /^all/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("article", { name: "Tax invoice SO-2026-0009" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /needs action/i }));
    expect(screen.getByText("Nothing needs doing for this customer.")).toBeInTheDocument();
  });

  it("a customer with no documents is invited to start with a quotation", async () => {
    show({ chains: [], summary: summary({ outWithCustomer: { count: 0, value: 0 }, acceptedNotOrdered: { count: 0, value: 0 }, ordersToApprove: { count: 0, value: 0 }, deliveredNotInvoiced: { count: 0, value: 0 } }) });
    expect(await screen.findByText("No quotations, orders or delivery notes yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new quotation/i })).toHaveAttribute("href", "/quotations");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("says when older documents are not listed", async () => {
    show({ truncated: true });
    expect(await screen.findByText(/older quotations, orders and delivery notes are not shown/i)).toBeInTheDocument();
  });

  it("shows the server's message when it cannot load, and tries again when asked", async () => {
    documentFlow.customer.mockRejectedValueOnce(new Error("Customer not found"));
    render(<MemoryRouter><CustomerDocumentsTab customerId="c1" /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Customer not found");
    documentFlow.customer.mockResolvedValue({ customer: {}, chains: [], summary: summary(), truncated: false });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("No quotations, orders or delivery notes yet")).toBeInTheDocument();
  });

  describe("closing an order short", () => {
    const rice = [{ description: "Rice", qty: 4 }];
    const part = (over = {}) => chain({
      key: "p", stage: "delivering", mode: "order_first",
      order: order({ _id: "o5", transactionNo: "SO-2026-0050", ...(over.order || {}) }),
      notes: [note({ _id: "n5", deliveryNoteNo: "DLN-2026-0050" })],
      delivery: { started: true, complete: false, remaining: rice },
      ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== "order")),
    });
    const closedShort = (over = {}) => ({ at: "2026-10-05T08:00:00.000Z", reason: "Customer found another supplier", trimmed: false, valueShort: 84, left: rice, returns: [], creditDue: true, ...over });
    const previewOf = (over = {}) => ({
      order: { _id: "o5", transactionNo: "SO-2026-0050", status: "DRAFT", totalAmount: 210 },
      mode: "trim", valueShort: 84, newTotal: 126,
      lines: [{ lineId: "l1", description: "Rice", ordered: 10, delivered: 6, short: 4, valueShort: 84 }],
      ...over,
    });
    const openDialog = async (name = "Sales order SO-2026-0050") => {
      const deal = await screen.findByRole("article", { name });
      fireEvent.click(within(deal).getByRole("button", { name: "Close order short" }));
      return screen.findByRole("dialog");
    };

    it("is offered next to delivering the rest", async () => {
      show({ chains: [part()] });
      const deal = await screen.findByRole("article", { name: "Sales order SO-2026-0050" });
      expect(within(deal).getByRole("button", { name: "Close order short" })).toBeInTheDocument();
      expect(within(deal).getByRole("link", { name: /deliver the rest/i })).toBeInTheDocument();
    });

    it("is not offered while a delivery is still out", async () => {
      show({ chains: [part({ notes: [note({ _id: "n5", deliveryNoteNo: "DLN-2026-0050", status: "DISPATCHED" })] })] });
      const deal = await screen.findByRole("article", { name: "Sales order SO-2026-0050" });
      expect(within(deal).queryByRole("button", { name: "Close order short" })).not.toBeInTheDocument();
    });

    it("shows what fell short and what will happen to a draft before anything is changed", async () => {
      orderClose.preview.mockResolvedValue(previewOf());
      show({ chains: [part()] });
      const dialog = await openDialog();
      expect(orderClose.preview).toHaveBeenCalledWith("o5");
      expect(await within(dialog).findByText("Rice")).toBeInTheDocument();
      const cells = within(dialog).getAllByRole("cell").map((c) => c.textContent);
      expect(cells).toEqual(["Rice", "10", "6", "4"]);
      expect(within(dialog).getByText(/cut down to what was delivered/)).toHaveTextContent("AED 210.00 to AED 126.00");
      expect(orderClose.closeShort).not.toHaveBeenCalled();
    });

    it("says an invoiced order is left alone and a sales return is the way to put it right", async () => {
      orderClose.preview.mockResolvedValue(previewOf({ mode: "credit", newTotal: null, order: { _id: "o5", transactionNo: "SO-2026-0050", status: "APPROVED", totalAmount: 210 } }));
      show({ chains: [part({ order: { status: "APPROVED" } })] });
      const dialog = await openDialog("Tax invoice SO-2026-0050");
      expect(await within(dialog).findByText(/already invoiced in full/)).toHaveTextContent("about AED 84.00 with VAT");
      expect(within(dialog).getByText(/raise a sales return/)).toBeInTheDocument();
    });

    it("needs a reason, then closes the order and says so", async () => {
      orderClose.preview.mockResolvedValue(previewOf());
      orderClose.closeShort.mockResolvedValue({ _id: "o5" });
      show({ chains: [part()] });
      const dialog = await openDialog();
      const confirm = await within(dialog).findByRole("button", { name: "Close order short" });
      expect(confirm).toBeDisabled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Customer found another supplier" }));
      expect(within(dialog).getByRole("textbox")).toHaveValue("Customer found another supplier");
      expect(confirm).toBeEnabled();
      fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "  Stock ran out for good  " } });
      fireEvent.click(confirm);
      await waitFor(() => expect(orderClose.closeShort).toHaveBeenCalledWith("o5", { reason: "Stock ran out for good" }));
      expect(await screen.findByText("SO-2026-0050 closed short")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(documentFlow.customer).toHaveBeenCalledTimes(2); // the deals were read again
    });

    it("keeps the dialog open and shows the servers words when it refuses", async () => {
      orderClose.preview.mockResolvedValue(previewOf());
      orderClose.closeShort.mockRejectedValue(new Error("DLN-2026-0051 is not signed for yet. Confirm or cancel it first"));
      show({ chains: [part()] });
      const dialog = await openDialog();
      fireEvent.click(await within(dialog).findByRole("button", { name: "We cannot supply the rest" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Close order short" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("is not signed for yet");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(within(dialog).getByRole("textbox")).toHaveValue("We cannot supply the rest");
    });

    it("shows why it cannot be closed instead of an empty dialog", async () => {
      orderClose.preview.mockRejectedValue(new Error("Everything ordered on SO-2026-0050 was delivered, so there is nothing left to close"));
      show({ chains: [part()] });
      const dialog = await openDialog();
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("nothing left to close");
      expect(within(dialog).getByRole("button", { name: "Close order short" })).toBeDisabled();
    });

    it("a closed deal says what will not come and why, and an invoiced one asks for the sales return", async () => {
      const closed = chain({
        key: "c", stage: "invoiced", mode: "order_first", order: order({ _id: "o5", transactionNo: "SO-2026-0050", status: "APPROVED", outstandingAmount: 0 }),
        notes: [note({ _id: "n5", deliveryNoteNo: "DLN-2026-0050" })], delivery: { started: true, complete: true, remaining: [] }, closeShort: closedShort(),
      });
      show({ chains: [closed] });
      const deal = await screen.findByRole("article", { name: "Tax invoice SO-2026-0050" });
      expect(within(deal).getByText("Closed short")).toBeInTheDocument();
      expect(within(deal).getByText(/will not be delivered. Reason: Customer found another supplier/)).toHaveTextContent("The invoice was not changed");
      expect(within(deal).getByRole("link", { name: /raise a sales return/i })).toHaveAttribute("href", "/sales-return");
      expect(within(deal).queryByRole("button", { name: "Close order short" })).not.toBeInTheDocument();
    });

    it("reopens it after a question", async () => {
      const closed = chain({
        key: "c", stage: "delivered", mode: "order_first", order: order({ _id: "o5", transactionNo: "SO-2026-0050" }),
        notes: [note({ _id: "n5", deliveryNoteNo: "DLN-2026-0050" })], delivery: { started: true, complete: true, remaining: [] }, closeShort: closedShort({ trimmed: true, creditDue: false }),
      });
      orderClose.reopen.mockResolvedValue({ _id: "o5" });
      show({ chains: [closed] });
      const deal = await screen.findByRole("article", { name: "Sales order SO-2026-0050" });
      expect(within(deal).getByText(/The order was cut down to what was delivered/)).toBeInTheDocument();
      fireEvent.click(within(deal).getByRole("button", { name: "Reopen" }));
      const dialog = await screen.findByRole("dialog");
      expect(orderClose.reopen).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Reopen order" }));
      await waitFor(() => expect(orderClose.reopen).toHaveBeenCalledWith("o5"));
      expect(await screen.findByText("SO-2026-0050 reopened")).toBeInTheDocument();
    });

    it("an invoiced order with a sales return raised cannot be reopened", async () => {
      const returned = chain({
        key: "c", stage: "invoiced", mode: "order_first", order: order({ _id: "o5", transactionNo: "SO-2026-0050", status: "APPROVED", outstandingAmount: 0 }),
        notes: [note({ _id: "n5", deliveryNoteNo: "DLN-2026-0050" })], delivery: { started: true, complete: true, remaining: [] },
        closeShort: closedShort({ creditDue: false, returns: [{ _id: "r1", transactionNo: "SR-2026-0004", status: "APPROVED", totalAmount: 84 }] }),
      });
      show({ chains: [returned] });
      fireEvent.click(await screen.findByRole("tab", { name: /^done/i }));
      const deal = screen.getByRole("article", { name: "Tax invoice SO-2026-0050" });
      expect(within(deal).queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    });
  });
});
