import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  settings: vi.fn(), saveSettings: vi.fn(), readiness: vi.fn(), fixParty: vi.fn(), documents: vi.fn(), preview: vi.fn(),
  submit: vi.fn(), submissions: vi.fn(), submission: vi.fn(), retry: vi.fn(), refresh: vi.fn(), dashboard: vi.fn(),
  inbound: vi.fn(), addInbound: vi.fn(), accept: vi.fn(), reject: vi.fn(),
}));
vi.mock("../../../lib/accountingApi", () => ({ einvoice: m }));

import EInvoicing from "../EInvoicing";

const at = (url = "/e-invoicing") => render(<MemoryRouter initialEntries={[url]}><EInvoicing /></MemoryRouter>);
const SETTINGS = { enabled: true, provider: "sandbox", environment: "sandbox", participantId: "0235:100123456700003", dueDays: 0, retryMax: 5, connected: false, hasWebhookSecret: true };
beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); m.settings.mockResolvedValue(SETTINGS); });

const doc = (over) => ({
  _id: "d1", transactionNo: "SO-2026-0001", type: "sales_order", invoiceTypeCode: "380", date: "2026-10-01", customer: "Al Noor", total: 1050,
  status: "NOT_SENT", partyReady: true, partyMissing: [], submissionId: null, lastError: null, overdue: false, ...over,
});
const PAYLOAD = {
  sellerName: "NH Foods LLC", sellerVatTrn: "100123456700003", buyerName: "Al Noor", buyerVatTrn: "100999888700003", issueDate: "2026-10-01",
  lines: [{ lineNumber: 1, itemName: "Rice", quantity: 10, lineNetAmount: 900, taxCategory: "S", taxRatePercent: 5, lineTaxAmount: 45 }],
  lineExtensionTotal: 900, taxAmount: 45, roundingAmount: 0, payableAmount: 945,
};

describe("the page", () => {
  it("says honestly that only a sandbox is connected", async () => {
    m.dashboard.mockResolvedValue({ outbound: { total: 0, byStatus: {}, net: 0, tax: 0, payable: 0, successRate: null, needsAttention: 0 }, inbound: {}, recent: [] });
    at();
    expect(await screen.findByText(/Sandbox only · live connection coming soon/)).toBeInTheDocument();
    expect(await screen.findByText("UAE mandate timeline")).toBeInTheDocument();
  });

  it("warns on the dashboard when e-invoicing is off", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, enabled: false });
    m.dashboard.mockResolvedValue({ outbound: { total: 0, byStatus: {}, net: 0, tax: 0, payable: 0, successRate: null, needsAttention: 0 }, inbound: {}, recent: [] });
    at();
    expect(await screen.findByText(/switched off, so nothing can be sent/)).toBeInTheDocument();
  });

  it("dashboard shows counts, the success rate and what needs attention", async () => {
    m.dashboard.mockResolvedValue({
      outbound: { total: 6, byStatus: { REPORTED: 3, FAILED: 1, REJECTED: 1 }, net: 1000, tax: 50, payable: 1050, successRate: 60, needsAttention: 2 },
      inbound: { RECEIVED: 4 }, recent: [{ _id: "r1", documentNo: "SO-2026-0001", buyerName: "Al Noor", status: "REPORTED", updatedAt: "2026-10-04T08:00:00Z" }],
    });
    at();
    expect(await screen.findByText("60% of those attempted")).toBeInTheDocument();
    expect(screen.getByText("failed or rejected")).toBeInTheDocument();
    expect(screen.getByText("Reported to FTA", { selector: "span" })).toBeInTheDocument();
  });
});

describe("outbound", () => {
  it("lists documents with status, and what is missing for a customer that is not ready", async () => {
    m.documents.mockResolvedValue([doc(), doc({ _id: "d2", transactionNo: "SO-2026-0002", customer: "Incomplete", partyReady: false, partyMissing: ["City", "Participant ID"] }), doc({ _id: "d3", transactionNo: "SO-2026-0003", status: "REPORTED", submissionId: "s3" })]);
    at("/e-invoicing?tab=outbound");
    expect(await screen.findByText("SO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Missing: City, Participant ID")).toBeInTheDocument();
    expect(screen.getAllByText("Not sent").length).toBeGreaterThan(0);
    expect(screen.getByText("Reported to FTA", { selector: "span.rounded-full" })).toBeInTheDocument();
  });

  it("filters by status", async () => {
    m.documents.mockResolvedValue([doc(), doc({ _id: "d3", transactionNo: "SO-2026-0003", status: "FAILED", submissionId: "s3", lastError: "Sandbox: simulated network failure" })]);
    at("/e-invoicing?tab=outbound");
    await screen.findByText("SO-2026-0001");
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "FAILED" } });
    expect(screen.queryByText("SO-2026-0001")).toBeNull();
    expect(screen.getByText("SO-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("Sandbox: simulated network failure")).toBeInTheDocument();
  });

  it("reviewing shows the exact problems the server found", async () => {
    m.documents.mockResolvedValue([doc()]);
    m.preview.mockResolvedValue({ ready: false, payload: PAYLOAD, issues: [{ field: "buyerCity", message: "Customer city is missing" }, { field: "customerParticipantId", message: "Customer Participant ID is missing" }] });
    at("/e-invoicing?tab=outbound");
    fireEvent.click(await screen.findByRole("button", { name: /Review/ }));
    const dialog = await screen.findByRole("dialog", { name: /SO-2026-0001/ });
    expect(within(dialog).getByText("2 problems to fix before this can be sent.")).toBeInTheDocument();
    expect(within(dialog).getByText("Customer city is missing")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Send e-invoice" })).toBeNull(); // cannot send while invalid
  });

  it("a clean review can be sent from the dialog", async () => {
    m.documents.mockResolvedValue([doc()]);
    m.preview.mockResolvedValue({ ready: true, payload: PAYLOAD, issues: [] });
    m.submit.mockResolvedValue({ alreadySubmitted: false });
    at("/e-invoicing?tab=outbound");
    fireEvent.click(await screen.findByRole("button", { name: /Review/ }));
    const dialog = await screen.findByRole("dialog", { name: /SO-2026-0001/ });
    expect(within(dialog).getByText("Checked and ready to send.")).toBeInTheDocument();
    expect(within(dialog).getByText("945.00")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Send e-invoice" }));
    await waitFor(() => expect(m.submit).toHaveBeenCalledWith("d1"));
    expect(await screen.findByText("SO-2026-0001 sent")).toBeInTheDocument();
  });

  it("Send asks for confirmation first, and shows server-side validation if it still fails", async () => {
    m.documents.mockResolvedValue([doc()]);
    m.submit.mockRejectedValue(Object.assign(new Error("Cannot send SO-2026-0001: 1 problem(s)"), { code: "EINVOICE_VALIDATION", details: { issues: [{ field: "buyerCity", message: "Customer city is missing" }] } }));
    at("/e-invoicing?tab=outbound");
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));
    const confirm = await screen.findByRole("dialog", { name: "Send SO-2026-0001?" });
    expect(m.submit).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Send e-invoice" }));
    expect(await screen.findByText("Customer city is missing")).toBeInTheDocument();
  });

  it("sending is disabled while e-invoicing is off", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, enabled: false });
    m.documents.mockResolvedValue([doc()]);
    at("/e-invoicing?tab=outbound");
    expect(await screen.findByRole("button", { name: /^Send$/ })).toBeDisabled();
    expect(screen.getByText(/switched off/)).toBeInTheDocument();
  });

  it("a failed invoice can be retried, and an in-flight one checked", async () => {
    m.documents.mockResolvedValue([
      doc({ _id: "f", transactionNo: "SO-F", status: "FAILED", submissionId: "sf", lastError: "network" }),
      doc({ _id: "s", transactionNo: "SO-S", status: "SUBMITTED", submissionId: "ss" }),
    ]);
    m.retry.mockResolvedValue({}); m.refresh.mockResolvedValue({});
    at("/e-invoicing?tab=outbound");
    fireEvent.click(await screen.findByRole("button", { name: /Retry/ }));
    await waitFor(() => expect(m.retry).toHaveBeenCalledWith("sf"));
    fireEvent.click(screen.getByRole("button", { name: /Check status/ }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalledWith("ss"));
  });

  it("history shows each step and exactly what was sent", async () => {
    m.documents.mockResolvedValue([doc({ status: "REPORTED", submissionId: "s1" })]);
    m.submission.mockResolvedValue({
      documentNo: "SO-2026-0001", status: "REPORTED", attempts: 1, providerEntryId: "SBX-123", taxStatus: "REPORTING_CONFIRMED", payloadHash: "abc123", payload: PAYLOAD,
      history: [{ status: "QUEUED", at: "2026-10-04T08:00:00Z" }, { status: "SUBMITTED", at: "2026-10-04T08:00:01Z" }, { status: "REPORTED", at: "2026-10-04T08:05:00Z" }],
    });
    at("/e-invoicing?tab=outbound");
    fireEvent.click(await screen.findByRole("button", { name: "History of SO-2026-0001" }));
    const dialog = await screen.findByRole("dialog", { name: /history/ });
    expect(await within(dialog).findByText("SBX-123")).toBeInTheDocument();
    expect(within(dialog).getByText("Complete.")).toBeInTheDocument();
    expect(within(dialog).queryByText(/abc123/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: /Show exactly what was sent/ }));
    expect(within(dialog).getByText(/abc123/)).toBeInTheDocument();
  });
});

describe("inbound", () => {
  const INV = {
    _id: "i1", documentId: "SUP-9001", status: "RECEIVED", sellerName: "Mill", sellerVatTrn: "100555444300003", currency: "AED", issueDate: "2026-10-01",
    totals: { payable: 1050, tax: 50 }, matchedVendorId: { _id: "v1", vendorName: "Mill" }, suggestedPurchaseOrderId: { _id: "po1", transactionNo: "PO-2026-0001" },
    matchNote: "Matched to Mill, purchase order PO-2026-0001 (by amount)",
  };

  it("shows the match and accepts onto the suggested purchase order", async () => {
    m.inbound.mockResolvedValue({ rows: [INV], total: 1 });
    m.accept.mockResolvedValue({});
    at("/e-invoicing?tab=inbound");
    expect(await screen.findByText("Matched to Mill, purchase order PO-2026-0001 (by amount)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    const dialog = await screen.findByRole("dialog", { name: "Accept SUP-9001?" });
    expect(within(dialog).getByText(/linked to purchase order PO-2026-0001/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Accept invoice" }));
    await waitFor(() => expect(m.accept).toHaveBeenCalledWith("i1", {}));
  });

  it("rejecting needs a reason", async () => {
    m.inbound.mockResolvedValue({ rows: [{ ...INV, matchedVendorId: null, suggestedPurchaseOrderId: null, matchNote: "No vendor matches this supplier's TRN or participant id" }], total: 1 });
    m.reject.mockResolvedValue({});
    at("/e-invoicing?tab=inbound");
    fireEvent.click(await screen.findByRole("button", { name: /Reject/ }));
    const dialog = await screen.findByRole("dialog", { name: "Reject SUP-9001?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject invoice" }));
    expect(await within(dialog).findByText("Give a reason so the supplier can correct it")).toBeInTheDocument();
    expect(m.reject).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Wrong prices" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject invoice" }));
    await waitFor(() => expect(m.reject).toHaveBeenCalledWith("i1", { reason: "Wrong prices" }));
  });

  it("decided invoices no longer offer actions", async () => {
    m.inbound.mockResolvedValue({ rows: [{ ...INV, status: "REJECTED", decision: { reason: "Wrong prices" } }], total: 1 });
    at("/e-invoicing?tab=inbound");
    expect(await screen.findByText("Reason: Wrong prices")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });

  it("adding by hand validates the TRN and requires a total", async () => {
    m.inbound.mockResolvedValue({ rows: [], total: 0 });
    m.addInbound.mockResolvedValue({ duplicate: false, matchNote: "Matched to Mill" });
    at("/e-invoicing?tab=inbound");
    fireEvent.click(await screen.findByRole("button", { name: /Add received invoice/ }));
    const dialog = await screen.findByRole("dialog", { name: "Add a received invoice" });
    fireEvent.change(within(dialog).getByLabelText(/Supplier TRN/), { target: { value: "123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record invoice" }));
    for (const t of ["Enter the supplier's invoice number", "Enter the supplier's name", "A TRN is 15 digits", "Enter the total payable"]) expect(await within(dialog).findByText(t)).toBeInTheDocument();
    expect(m.addInbound).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/invoice number/), { target: { value: "SUP-1" } });
    fireEvent.change(within(dialog).getByLabelText(/Supplier name/), { target: { value: "Mill" } });
    fireEvent.change(within(dialog).getByLabelText(/Supplier TRN/), { target: { value: "100555444300003" } });
    fireEvent.change(within(dialog).getByLabelText(/Total payable/), { target: { value: "1050" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record invoice" }));
    await waitFor(() => expect(m.addInbound).toHaveBeenCalledTimes(1));
    expect(m.addInbound.mock.calls[0][0]).toMatchObject({ documentId: "SUP-1", sellerName: "Mill", sellerVatTrn: "100555444300003", payableAmount: 1050 });
  });
});

describe("readiness", () => {
  const READY = {
    ready: false,
    seller: [{ key: "trn", label: "Company TRN (15 digits)", ok: false }, { key: "legalName", label: "Company legal name", ok: true }],
    parties: { total: 2, ready: 1, notReady: [{ _id: "c2", customerName: "Incomplete", missing: ["City"], problems: ["VAT Number must be 15 digits"] }] },
  };

  it("points each failing company check at where to fix it", async () => {
    m.readiness.mockResolvedValue(READY);
    at("/e-invoicing?tab=readiness");
    const fix = await screen.findByRole("link", { name: "Fix in Company profile" });
    expect(fix).toHaveAttribute("href", "/accounting-setup?tab=rules");
    expect(screen.getByLabelText("Ready")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 ready")).toBeInTheDocument();
    expect(screen.getByText("Missing City · VAT Number must be 15 digits")).toBeInTheDocument();
  });

  it("completes a customer's details and sends only what was filled in", async () => {
    m.readiness.mockResolvedValue(READY);
    m.fixParty.mockResolvedValue({});
    at("/e-invoicing?tab=readiness");
    fireEvent.click(await screen.findByRole("button", { name: /Complete details/ }));
    const dialog = await screen.findByRole("dialog", { name: "Incomplete" });
    fireEvent.change(within(dialog).getByLabelText(/VAT number/), { target: { value: "12" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save details" }));
    expect(await within(dialog).findByText("A TRN is 15 digits")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/VAT number/), { target: { value: "100999888700003" } });
    fireEvent.change(within(dialog).getByLabelText("City"), { target: { value: "Dubai" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(m.fixParty).toHaveBeenCalledTimes(1));
    expect(m.fixParty.mock.calls[0]).toEqual(["c2", { trnNumber: "100999888700003", city: "Dubai", countryCode: "AE" }]);
  });
});

describe("settings", () => {
  it("shows the sandbox in use and the real connection as coming soon", async () => {
    at("/e-invoicing?tab=settings");
    expect(await screen.findByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByText("In use")).toBeInTheDocument();
    expect(screen.getByText(/nothing here is a valid tax e-invoice/)).toBeInTheDocument();
  });

  it("never shows a stored secret; replacing it sends the new one", async () => {
    m.saveSettings.mockResolvedValue({});
    at("/e-invoicing?tab=settings");
    expect(await screen.findByText("Stored")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Signing secret/)).toBeNull(); // no field showing the old value
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    fireEvent.change(screen.getByLabelText(/Signing secret/), { target: { value: "new-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ participantId: "0235:100123456700003", dueDays: 0, webhookSecret: "new-secret" }));
  });

  it("validates the participant id", async () => {
    at("/e-invoicing?tab=settings");
    fireEvent.change(await screen.findByLabelText("Your Participant ID"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Looks like 0235:100123456700003")).toBeInTheDocument();
    expect(m.saveSettings).not.toHaveBeenCalled();
  });

  it("switching on reports why it cannot be switched on", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, enabled: false });
    m.saveSettings.mockRejectedValue(new Error("Not ready to enable: Company TRN (15 digits)"));
    at("/e-invoicing?tab=settings");
    fireEvent.click(await screen.findByRole("button", { name: "Switch on" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not ready to enable: Company TRN (15 digits)");
  });
});
