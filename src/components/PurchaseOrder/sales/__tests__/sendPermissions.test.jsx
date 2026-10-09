import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// Sending an invoice to the customer is sales.send (POST /messaging/send and /messaging/handoff). Every place that offers it
// is covered here: the invoice's own screen and the sales order list, as a table and as cards. What the invoice already
// went through (the "Emailed" mark and the send history) is information and stays for whoever can see the document.
vi.mock("../../shared/useCompanyProfile", () => ({ useCompanyProfile: vi.fn(() => ({ companyName: "Harbour Trading", vatNumber: "100123456700003" })) }));
vi.mock("../../../../lib/sendDocumentsApi", () => ({
  sendSettings: { get: vi.fn(async () => ({ enabled: true, shareEnabled: true, attachPdf: true, shareLinkDays: 30, defaultNote: "" })) },
  documentSends: { send: vi.fn(), handoff: vi.fn(), history: vi.fn(async () => ({ rows: [], total: 0 })), retry: vi.fn(), withdraw: vi.fn() },
}));
vi.mock("html2canvas", () => ({ default: vi.fn() }));
vi.mock("jspdf", () => ({ jsPDF: vi.fn() }));
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import SaleInvoiceView from "../InvoiceView.jsx";
import TableView from "../TableView.jsx";
import GridView from "../GridView.jsx";
import { AsRole, roleLoaded, statusFor } from "../../../shell/__tests__/asRole";

const VIEWER = ["sales.view"];
const SENDER = ["sales.view", "sales.send"];

const SENT = { status: "SENT", channel: "email", at: "2026-10-06T10:32:00.000Z", to: "a@b.com", sendId: "s1" };
const so = (over = {}) => ({
  id: "so1", _id: "so1", transactionNo: "SO-1234", displayTransactionNo: "INV-1234", status: "APPROVED", date: "2026-10-01T00:00:00.000Z", deliveryDate: "2026-10-05T00:00:00.000Z",
  customerId: "c1", customerName: "Acme Corp", priority: "Medium", createdBy: "Boss", totalAmount: 525, lastSend: SENT,
  items: [{ itemCode: "ITM1", description: "Item One", qty: 2, rate: 200, vatAmount: 10, vatPercent: 5 }], ...over,
});
const customers = [{ _id: "c1", customerId: "CUST-001", customerName: "Acme Corp", billingAddress: "Dubai", phone: "123", email: "a@b.com", trnNumber: "TRN", paymentTerms: "30 Days" }];

describe("the invoice's own screen", () => {
  const view = (grants, order = so()) => {
    orgStatus = statusFor(grants);
    return render(
      <MemoryRouter><AsRole>
        <SaleInvoiceView selectedSO={null} createdSO={order} customers={customers} setActiveView={vi.fn()} setSelectedSO={vi.fn()} setCreatedSO={vi.fn()} />
      </AsRole></MemoryRouter>
    );
  };
  beforeEach(() => vi.clearAllMocks());

  it("a person without sales.send sees the invoice, that it was emailed and its send history, but no Send", async () => {
    view(VIEWER);
    await roleLoaded();
    // the screen is loaded: the document, the mark and the history
    expect(await screen.findByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Emailed")).toBeInTheDocument();
    expect(screen.getByText(/Emailed to a@b.com on /)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /send history/i }));
    expect(await screen.findByRole("dialog", { name: /send history/i })).toBeInTheDocument();
    // but no way to send
    expect(screen.queryByRole("button", { name: /^send$/i })).toBeNull();
  });

  it("a person who holds sales.send has Send, which opens the dialog", async () => {
    view(SENDER);
    await roleLoaded();
    fireEvent.click(await screen.findByRole("button", { name: /^send$/i }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Send tax invoice SO-1234");
  });

  it("a person who can send but has not sent it yet is still offered Send", async () => {
    view(SENDER, so({ lastSend: null }));
    await roleLoaded();
    expect(await screen.findByRole("button", { name: /^send$/i })).toBeEnabled();
  });
});

describe("the sales order list", () => {
  const noop = () => {};
  const onSendDocument = vi.fn();
  const list = (View, grants) => {
    orgStatus = statusFor(grants);
    return render(
      <AsRole>
        <View
          paginatedSOs={[so()]} selectedSOs={[]} setSelectedSOs={noop} getPriorityColor={() => "bg-muted"} getStatusColor={() => ""} getStatusIcon={() => null}
          handleSort={noop} sortBy="id" sortOrder="asc" setSelectedSO={noop} setActiveView={noop} editSO={noop} confirmSO={noop} deleteSO={noop}
          onDownloadInternal={noop} onDownloadCustomer={noop} onShowAudit={noop} onSendDocument={onSendDocument}
        />
      </AsRole>
    );
  };

  describe.each([["table", TableView], ["cards", GridView]])("as %s", (_name, View) => {
    beforeEach(() => onSendDocument.mockClear());

    it("a person without sales.send sees the invoice and 'Emailed 6 Oct', but no Send", async () => {
      list(View, VIEWER);
      await roleLoaded();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument(); // the row is on screen
      expect(screen.getByText(/^Emailed /)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Send INV-1234 to the customer/ })).toBeNull();
    });

    it("a person who holds sales.send has Send on the row, which asks the page to open the dialog", async () => {
      const { container } = list(View, SENDER);
      await roleLoaded();
      const button = await screen.findByRole("button", { name: "Send INV-1234 to the customer" });
      expect(within(container).getByText(/^Emailed /)).toBeInTheDocument();
      fireEvent.click(button);
      expect(onSendDocument).toHaveBeenCalledWith(expect.objectContaining({ id: "so1" }));
    });
  });
});
