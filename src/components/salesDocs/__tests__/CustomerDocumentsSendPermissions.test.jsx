import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// "Send the invoice" is a next step, and "Invoice not sent" a nudge, only for a person who may send (sales.send).
// What has already happened to an invoice ("Invoice emailed 6 Oct") is information and shows to everyone.
vi.mock("../../../lib/salesDocumentsApi", () => ({
  documentFlow: { customer: vi.fn() },
  orderClose: { preview: vi.fn(), closeShort: vi.fn(), reopen: vi.fn() },
}));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import CustomerDocumentsTab from "../CustomerDocumentsTab";
import { documentFlow } from "../../../lib/salesDocumentsApi";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
const summary = { outWithCustomer: { count: 0, value: 0 }, acceptedNotOrdered: { count: 0, value: 0 }, ordersToApprove: { count: 1, value: 500 }, deliveredNotInvoiced: { count: 0, value: 0 }, pastInvoiceWindow: 0 };
const order = (over = {}) => ({ _id: "o1", transactionNo: "SO-2026-0031", status: "DRAFT", totalAmount: 500, outstandingAmount: 500, date: daysAgo(1), ...over });
const note = (over = {}) => ({ _id: "n1", deliveryNoteNo: "DLN-2026-0012", status: "DELIVERED", deliveredAt: daysAgo(1), totalAmount: 105, ...over });
const chain = (over = {}) => ({ key: "k", stage: "quoted", mode: null, quotation: null, order: null, notes: [], amount: 100, date: daysAgo(1), invoiceClock: null, expiresInDays: null, ...over });
const invoiced = (key, no, orderOver = {}) => chain({
  key, stage: "invoiced", mode: "order_first", order: order({ _id: `o-${key}`, transactionNo: no, status: "APPROVED", outstandingAmount: 0, ...orderOver }),
  notes: [note({ _id: `n-${key}`, deliveryNoteNo: `DLN-${key}` })], delivery: { started: true, complete: true, remaining: [] },
});

const unsent = invoiced("u", "SO-2026-0040");
const emailed = invoiced("e", "SO-2026-0041", { lastSend: { status: "SENT", channel: "email", at: daysAgo(1), to: "ali@alnoor.ae" } });
const toApprove = chain({ key: "d", stage: "ordered", order: order(), amount: 500 });

const show = (grants) => {
  orgStatus = statusFor(grants);
  documentFlow.customer.mockResolvedValue({ customer: { _id: "c1", customerName: "Ann" }, chains: [unsent, emailed, toApprove], summary, truncated: false });
  return render(<MemoryRouter><AsRole><CustomerDocumentsTab customerId="c1" /></AsRole></MemoryRouter>);
};
const allDeals = async () => {
  await roleLoaded();
  fireEvent.click(await screen.findByRole("tab", { name: /^all/i }));
  return {
    unsent: screen.getByRole("article", { name: "Tax invoice SO-2026-0040" }),
    emailed: screen.getByRole("article", { name: "Tax invoice SO-2026-0041" }),
    toApprove: screen.getByRole("article", { name: "Sales order SO-2026-0031" }),
  };
};

beforeEach(() => vi.clearAllMocks());

describe("the customer's documents, for a person who may not send (sales.view)", () => {
  it("is not told to send an invoice: no 'Invoice not sent', no 'Send the invoice', and the deal is not under Needs action", async () => {
    show(["sales.view"]);
    const deals = await allDeals();
    // the deals are on screen
    expect(within(deals.toApprove).getByRole("link", { name: /approve the order/i })).toBeInTheDocument(); // other next steps stay
    expect(within(deals.emailed).getByText(/^Invoice emailed /)).toBeInTheDocument(); // information stays

    expect(within(deals.unsent).queryByText("Invoice not sent")).toBeNull();
    expect(within(deals.unsent).queryByRole("link", { name: /send the invoice/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /send the invoice/i })).toBeNull();
    // only the order waiting for approval needs someone
    expect(screen.getByRole("tab", { name: /needs action/i })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /^done/i })).toHaveTextContent("2");
  });
});

describe("the customer's documents, for a person who holds sales.send", () => {
  it("is told the unsent invoice needs sending, and it counts under Needs action", async () => {
    show(["sales.view", "sales.send"]);
    const deals = await allDeals();
    expect(within(deals.unsent).getByText("Invoice not sent")).toBeInTheDocument();
    expect(within(deals.unsent).getByRole("link", { name: /send the invoice/i })).toHaveAttribute("href", "/sales-order?search=SO-2026-0040");
    expect(within(deals.emailed).getByText(/^Invoice emailed /)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /needs action/i })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /^done/i })).toHaveTextContent("1");
  });
});
