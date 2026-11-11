import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// A feature the organisation did not buy leaves nothing behind on this screen. Two rules pull in
// opposite directions on purpose, and both are here:
//   a STAGE that can never happen is dropped, so a deal does not look stuck at a step nobody can do;
//   a DOCUMENT that exists is never hidden - it is simply not a link any more.
vi.mock("../../../lib/salesDocumentsApi", () => ({
  documentFlow: { customer: vi.fn() },
  orderClose: { preview: vi.fn(), closeShort: vi.fn(), reopen: vi.fn() },
}));
vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({
  useCompanyProfile: () => ({ companyName: "Harbour Trading", vatNumber: "100123456700003" }),
}));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import CustomerDocumentsTab from "../CustomerDocumentsTab";
import { documentFlow } from "../../../lib/salesDocumentsApi";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
const GRANTS = ["sales.view", "sales.create", "sales.approve", "sales.send"];
const summary = { outWithCustomer: { count: 0, value: 0 }, acceptedNotOrdered: { count: 0, value: 0 }, ordersToApprove: { count: 0, value: 0 }, deliveredNotInvoiced: { count: 0, value: 0 }, pastInvoiceWindow: 0 };

const deal = {
  key: "k", stage: "invoiced", mode: "order_first", amount: 500, date: daysAgo(3), invoiceClock: null, expiresInDays: null,
  quotation: { _id: "q1", quotationNo: "QT-2026-0007", status: "CONVERTED", expired: false, daysLeft: null, validUntil: daysAgo(-20), totalAmount: 500 },
  order: { _id: "o1", transactionNo: "SO-2026-0031", status: "APPROVED", totalAmount: 500, outstandingAmount: 0, date: daysAgo(3), lastSend: { status: "SENT", channel: "email", at: daysAgo(2), to: "ali@x.ae" } },
  notes: [{ _id: "n1", deliveryNoteNo: "DLN-2026-0012", status: "DELIVERED", deliveredAt: daysAgo(3), totalAmount: 500 }],
  delivery: { started: true, complete: true, remaining: [] },
};

const show = (features, chains = [deal]) => {
  orgStatus = statusFor(GRANTS, features);
  documentFlow.customer.mockResolvedValue({ customer: { _id: "c1", customerName: "Ann" }, chains, summary, truncated: false });
  return render(<MemoryRouter><AsRole><CustomerDocumentsTab customerId="c1" /></AsRole></MemoryRouter>);
};
const open = async () => {
  await roleLoaded();
  fireEvent.click(await screen.findByRole("tab", { name: /^all/i }));
  return screen.getByRole("article", { name: "Tax invoice SO-2026-0031" });
};
const stepNames = (card) => within(card).getAllByRole("listitem").map((li) => li.textContent);

beforeEach(() => vi.clearAllMocks());

describe("the customer's deals, with features switched off", () => {
  it("shows every stage when the organisation has every feature", async () => {
    show({});
    const names = stepNames(await open()).join(" | ");
    expect(names).toMatch(/Quotation/);
    expect(names).toMatch(/Delivery/);
    expect(within(await open()).getByRole("link", { name: /QT-2026-0007/ })).toBeInTheDocument();
    expect(within(await open()).getByRole("link", { name: /DLN-2026-0012/ })).toBeInTheDocument();
  });

  // The documents exist, so they are still named - the feature was switched off after they were raised.
  // What goes is the LINK, because the screen behind it answers "not included in your plan".
  it("still names a document whose feature has gone, without linking to it", async () => {
    show({ quotations: false, deliveryNotes: false });
    const card = await open();
    expect(within(card).getByText("QT-2026-0007")).toBeInTheDocument();
    expect(within(card).getByText("DLN-2026-0012")).toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: /QT-2026-0007/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: /DLN-2026-0012/ })).not.toBeInTheDocument();
    // the invoice is not an optional feature, so it is still linked (its step row and its next-action button)
    expect(within(card).getAllByRole("link", { name: /SO-2026-0031/ }).length).toBeGreaterThan(0);
  });

  // A deal with no quotation and no delivery note behind it reads order -> invoice -> paid. A greyed
  // step that can never be completed would make a perfectly healthy deal look stuck.
  it("drops a stage the organisation can never reach", async () => {
    const bare = { ...deal, quotation: null, notes: [], delivery: { started: false, complete: false, remaining: [] } };
    show({ quotations: false, deliveryNotes: false }, [bare]);
    const names = stepNames(await open()).join(" | ");
    expect(names).not.toMatch(/Quotation/);
    expect(names).not.toMatch(/Delivery/);
    expect(names).toMatch(/Sales order/);
    expect(names).toMatch(/Invoice/);
    expect(names).toMatch(/Paid/);
  });

  it("does not offer a new quotation on the empty state when quotations were not bought", async () => {
    show({ quotations: false }, []);
    await roleLoaded();
    expect(await screen.findByText(/No orders or invoices yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /new quotation/i })).not.toBeInTheDocument();
  });

  // Sending is an ACTION: it needs the role AND the plan. What already happened to the invoice is a
  // record, and a record is never hidden - switching messaging off must not erase it.
  it("keeps the record of a send that happened, with the plan switched off", async () => {
    show({ messaging: false });
    const card = await open();
    expect(within(card).getByText(/emailed/i)).toBeInTheDocument();
  });
});
