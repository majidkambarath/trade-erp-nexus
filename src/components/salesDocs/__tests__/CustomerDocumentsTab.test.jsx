import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import CustomerDocumentsTab from "../CustomerDocumentsTab";
import { documentFlow } from "../../../lib/salesDocumentsApi";

vi.mock("../../../lib/salesDocumentsApi", () => ({ documentFlow: { customer: vi.fn() } }));

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
});
