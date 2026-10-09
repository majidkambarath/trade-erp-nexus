import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { AsRole, roleLoaded, statusFor } from "../../../shell/__tests__/asRole";

import SaleInvoiceView from "../../sales/InvoiceView.jsx";
import SalesReturnInvoiceView from "../../salesReturn/InvoiceView.jsx";
import PurchaseInvoiceView from "../../purchase/InvoiceView.jsx";
import PurchaseReturnInvoiceView from "../../purchaseReturn/InvoiceView.jsx";

// A document's own screen says what the list cannot: that it waits for a second approval, and why THIS person is not the one to
// approve it ("You prepared this document, so someone else has to approve it."). The same line on all four documents; the rules
// are lib/approvals.js and the line itself is shell/Approval.jsx (shell/__tests__/Approval.test.jsx).
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));
vi.mock("../useCompanyProfile", () => ({ useCompanyProfile: vi.fn(() => ({ companyName: "", vatNumber: "" })) }));
vi.mock("../../../../lib/sendDocumentsApi", () => ({
  sendSettings: { get: vi.fn(async () => ({ enabled: true, shareEnabled: true, attachPdf: true, shareLinkDays: 30, defaultNote: "" })) },
  documentSends: { send: vi.fn(), handoff: vi.fn(), history: vi.fn(), retry: vi.fn(), withdraw: vi.fn() },
}));
vi.mock("html2canvas", () => ({ default: vi.fn() }));
vi.mock("jspdf", () => ({ jsPDF: vi.fn() }));

const items = [{ itemCode: "ITM1", description: "Item One", qty: 2, rate: 200, vatAmount: 10, vatPercent: 5 }];
const doc = (over = {}) => ({ transactionNo: "DOC-1", id: "d1", status: "DRAFT", date: "2025-01-10T00:00:00.000Z", customerId: "c1", vendorId: "v1", items, totalAmount: "420.00", createdBy: "u2", approvals: [], ...over });
const customers = [{ _id: "c1", customerId: "CUST-001", customerName: "Acme Corp", billingAddress: "Dubai", phone: "123", email: "a@b.com", trnNumber: "TRN", paymentTerms: "30 Days" }];
const vendors = [{ _id: "v1", vendorId: "V-001", vendorName: "Gulf Supplies", address: "Sharjah", phone: "456", email: "v@b.com", trnNumber: "TRN" }];
const noop = () => {};

const VIEWS = [
  ["sales order", "sales", (d) => <SaleInvoiceView createdSO={d} customers={customers} setActiveView={noop} setSelectedSO={noop} setCreatedSO={noop} />],
  ["sales return", "sales", (d) => <SalesReturnInvoiceView createdSO={d} customers={customers} setActiveView={noop} setSelectedSO={noop} setCreatedSO={noop} />],
  ["purchase order", "purchase", (d) => <PurchaseInvoiceView createdPO={d} vendors={vendors} setActiveView={noop} setSelectedPO={noop} setCreatedPO={noop} />],
  ["purchase return", "purchase", (d) => <PurchaseReturnInvoiceView createdPO={d} vendors={vendors} setActiveView={noop} setSelectedPO={noop} setCreatedPO={noop} />],
];

const person = (module, { limit = null, policy = {}, grants = [`${module}.view`, `${module}.approve`] } = {}) => {
  const base = statusFor(grants);
  return { ...base, me: { ...base.me, id: "u1", role: { ...base.me.role, approvalLimit: limit } }, policy: { approvals: { separateApprover: false, secondApprovalAbove: null, ...policy } } };
};

beforeEach(() => {
  orgStatus = null;
});

describe.each(VIEWS)("the %s screen", (_name, module, view) => {
  const show = async (status, d) => {
    orgStatus = status;
    render(<MemoryRouter><AsRole>{view(d)}</AsRole></MemoryRouter>);
    await roleLoaded();
    // the document is on screen (Back to list is the control)
    expect(await screen.findByRole("button", { name: /back to list/i })).toBeInTheDocument();
  };

  it("says the person prepared the document when the organisation asks for a separate approver", async () => {
    await show(person(module, { policy: { separateApprover: true } }), doc({ createdBy: "u1" }));
    expect(await screen.findByText("You prepared this document, so someone else has to approve it.")).toBeInTheDocument();
  });

  it("says the document is over the person's approval limit", async () => {
    await show(person(module, { limit: 100 }), doc());
    expect(await screen.findByText("This is over your approval limit of 100.00 AED.")).toBeInTheDocument();
  });

  it("says the document waits for a second approval", async () => {
    await show(person(module, { policy: { secondApprovalAbove: 100 } }), doc({ approvals: [{ by: "u9", name: "Sam", step: 1 }] }));
    expect(await screen.findByText("Awaiting second approval.")).toBeInTheDocument();
  });

  it("says nothing about approving to a person who may approve it, once nothing waits", async () => {
    await show(person(module), doc());
    expect(screen.queryByRole("status")).toBeNull();
  });
});
