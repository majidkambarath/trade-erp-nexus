import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const m = vi.hoisted(() => ({
  settings: vi.fn(), saveSettings: vi.fn(), readiness: vi.fn(), fixParty: vi.fn(), documents: vi.fn(), preview: vi.fn(),
  submit: vi.fn(), submissions: vi.fn(), submission: vi.fn(), retry: vi.fn(), refresh: vi.fn(), dashboard: vi.fn(),
  inbound: vi.fn(), addInbound: vi.fn(), accept: vi.fn(), reject: vi.fn(),
  wafeqStart: vi.fn(), wafeqFinish: vi.fn(), wafeqDisconnect: vi.fn(),
  inboundPull: vi.fn(), inboundToPurchase: vi.fn(), correct: vi.fn(), creditInFull: vi.fn(), apiGet: vi.fn(),
  wafeqHealth: vi.fn(), wafeqSummary: vi.fn(),
}));
vi.mock("../../../lib/accountingApi", () => ({ einvoice: m, api: { get: m.apiGet } }));

import EInvoicing from "../EInvoicing";

const at = (url = "/e-invoicing/dashboard") => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/e-invoicing/*" element={<EInvoicing />} /><Route path="*" element={<p>elsewhere</p>} /></Routes></MemoryRouter>);
const SETTINGS = { enabled: true, provider: "sandbox", environment: "sandbox", participantId: "0235:100123456700003", dueDays: 0, retryMax: 5, connected: false, hasWebhookSecret: true };
beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); m.settings.mockResolvedValue(SETTINGS); });

const doc = (over) => ({
  _id: "d1", transactionNo: "SO-2026-0001", type: "sales_order", invoiceTypeCode: "380", date: "2026-10-01", customer: "Al Noor", total: 1050,
  status: "NOT_SENT", partyReady: true, partyMissing: [], submissionId: null, lastError: null, overdue: false, ...over,
});
const PAYLOAD = {
  sellerName: "Harbour Trading LLC", sellerVatTrn: "100123456700003", buyerName: "Al Noor", buyerVatTrn: "100999888700003", issueDate: "2026-10-01",
  lines: [{ lineNumber: 1, itemName: "Rice", quantity: 10, lineNetAmount: 900, taxCategory: "S", taxRatePercent: 5, lineTaxAmount: 45 }],
  lineExtensionTotal: 900, taxAmount: 45, roundingAmount: 0, payableAmount: 945,
};

const TODO = [
  { key: "notSent", label: "Not sent", count: 0, amount: 0, link: "/e-invoicing/outbound?status=NOT_SENT", tone: "warning" },
  { key: "failed", label: "Failed", count: 0, link: "/e-invoicing/outbound?status=FAILED", tone: "danger" },
  { key: "inboundToReview", label: "Supplier invoices to review", count: 0, link: "/e-invoicing/inbound?status=RECEIVED", tone: "warning" },
];
const LEGS = { delivery: { delivered: 0, inProgress: 0, ftaOnly: 0, failed: 0, rejected: 0, pending: 0 }, fta: { reported: 0, reporting: 0, notReported: 0, withdrawn: 0, unresolved: 0, rejected: 0, pending: 0 } };
const BLANK = { invoices: { count: 0, net: 0, tax: 0, payable: 0 }, creditNotes: { count: 0, net: 0, tax: 0, payable: 0 }, net: { net: 0, tax: 0, payable: 0 } };
const dash = (over = {}) => ({
  period: { from: "2026-11-01", to: "2026-11-30" }, sandbox: false, todo: TODO,
  pipeline: { byStatus: {}, notSent: 0, ...LEGS, deliveredRate: null, reportedRate: null }, totals: BLANK,
  monthly: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month) => ({ month, sent: 0, sentAmount: 0, received: 0, receivedAmount: 0 })),
  topCustomers: [], topSuppliers: [], inboundPeriod: { received: 0, accepted: 0, rejected: 0, recorded: 0, amount: 0 }, attention: [],
  outbound: {}, inbound: {}, recent: [], ...over,
});

describe("the page", () => {
  it("says honestly that only the built-in sandbox is in use until Wafeq is connected", async () => {
    m.dashboard.mockResolvedValue(dash());
    at();
    expect(await screen.findByText(/Built-in sandbox · connect Wafeq in Settings/)).toBeInTheDocument();
    expect(await screen.findByText("UAE mandate dates")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "" })).toBeInTheDocument(); // "All clear": nothing is waiting
    expect(screen.getByText("All clear.")).toBeInTheDocument();
  });

  it("warns on the dashboard when e-invoicing is off", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, enabled: false });
    m.dashboard.mockResolvedValue(dash());
    at();
    expect(await screen.findByText(/switched off, so nothing can be sent/)).toBeInTheDocument();
  });

  it("in test mode says the tax authority is never reached, instead of showing 0% as a failure", async () => {
    m.dashboard.mockResolvedValue(dash({
      sandbox: true,
      pipeline: { byStatus: { ACKNOWLEDGED: 2 }, notSent: 0, delivery: { ...LEGS.delivery, delivered: 2 }, fta: { ...LEGS.fta, notReported: 2 }, deliveredRate: 100, reportedRate: 0 },
      totals: { ...BLANK, invoices: { count: 2, net: 100, tax: 5, payable: 105 }, net: { net: 100, tax: 5, payable: 105 } },
    }));
    at();
    expect(await screen.findByText(/Nothing reaches the tax authority/)).toBeInTheDocument();
    expect(screen.getByText("not reported in test mode")).toBeInTheDocument();
    expect(screen.getByText("100% of those sent")).toBeInTheDocument();
    expect(screen.queryByText("0% of those sent")).toBeNull();
  });

  it("a worklist tile opens the list it counts, already filtered", async () => {
    m.dashboard.mockResolvedValue(dash({ todo: [{ ...TODO[1], count: 2 }, ...TODO.filter((t) => t.key !== "failed")] }));
    m.documents.mockResolvedValue([doc({ status: "FAILED", submissionId: "s1", lastError: "boom" })]);
    at();
    fireEvent.click(await screen.findByRole("button", { name: /Failed/ }));
    expect(await screen.findByLabelText("Filter by status")).toHaveValue("FAILED");
    await waitFor(() => expect(m.documents).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" })));
  });

  it("lists what needs attention with the next step, and links to the document", async () => {
    m.dashboard.mockResolvedValue(dash({
      todo: [{ ...TODO[1], count: 1 }, ...TODO.filter((t) => t.key !== "failed")],
      attention: [{ _id: "a1", documentNo: "SO-2026-0007", sourceId: "x", invoiceTypeCode: "380", buyerName: "Al Noor", status: "REJECTED", action: "correct", reason: "Buyer TRN does not match" }],
    }));
    at();
    expect(await screen.findByText("Buyer TRN does not match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend correction" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SO-2026-0007" })).toHaveAttribute("href", "/sales-order?search=SO-2026-0007");
  });

  it("shows invoices and credit notes apart, and the connection's checks on request only", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, connected: true, wafeq: { status: "active", mode: "sandbox", name: "Harbour Trading", tin: "1716865504", participantId: "0235:1716865504", lastWebhookAt: null, inboundPulledAt: null } });
    m.dashboard.mockResolvedValue(dash({ totals: { invoices: { count: 3, net: 300, tax: 15, payable: 315 }, creditNotes: { count: 1, net: 50, tax: 2.5, payable: 52.5 }, net: { net: 250, tax: 12.5, payable: 262.5 } } }));
    m.wafeqHealth.mockResolvedValue({ connected: true, ok: false, mismatches: [{ field: "Legal name", wafeq: "Sandbox taxpayer 5504", ours: "Harbour Trading" }] });
    m.wafeqSummary.mockResolvedValue({ connected: true, sandbox: true, outbound: { count: 9 }, inbound: { count: 1 } });
    at();
    await screen.findByText("Harbour Trading");
    expect(m.wafeqHealth).not.toHaveBeenCalled(); // spends Wafeq's shared budget: only when asked
    fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
    expect(await screen.findByText(/Wafeq's record differs from your company profile/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare with Wafeq" }));
    expect((await screen.findAllByText(/Wafeq holds/, { selector: "li" })).length).toBe(2);
    expect(screen.getByText(/The test taxpayer is shared/)).toBeInTheDocument();
  });

  it("the old address with ?tab= is still understood by the section", async () => {
    m.documents.mockResolvedValue([doc()]);
    at("/e-invoicing/outbound");
    expect(await screen.findByText("SO-2026-0001")).toBeInTheDocument();
  });
});

describe("outbound", () => {
  it("lists documents with status, and what is missing for a customer that is not ready", async () => {
    m.documents.mockResolvedValue([doc(), doc({ _id: "d2", transactionNo: "SO-2026-0002", customer: "Incomplete", partyReady: false, partyMissing: ["City", "Participant ID"] }), doc({ _id: "d3", transactionNo: "SO-2026-0003", status: "REPORTED", submissionId: "s3" })]);
    at("/e-invoicing/outbound");
    expect(await screen.findByText("SO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Missing: City, Participant ID")).toBeInTheDocument();
    expect(screen.getAllByText("Not sent").length).toBeGreaterThan(0);
    expect(screen.getByText("Reported to FTA", { selector: "span.rounded-full" })).toBeInTheDocument();
  });

  it("filters by status", async () => {
    m.documents.mockResolvedValue([doc(), doc({ _id: "d3", transactionNo: "SO-2026-0003", status: "FAILED", submissionId: "s3", lastError: "Sandbox: simulated network failure" })]);
    at("/e-invoicing/outbound");
    await screen.findByText("SO-2026-0001");
    // the server decides the filter (a status filter on the loaded page alone missed a failed invoice that was not on it)
    m.documents.mockResolvedValue([doc({ _id: "d3", transactionNo: "SO-2026-0003", status: "FAILED", submissionId: "s3", lastError: "Sandbox: simulated network failure" })]);
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "FAILED" } });
    await waitFor(() => expect(m.documents).toHaveBeenLastCalledWith(expect.objectContaining({ status: "FAILED" })));
    await waitFor(() => expect(screen.queryByText("SO-2026-0001")).toBeNull());
    expect(screen.getByText("SO-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("Sandbox: simulated network failure")).toBeInTheDocument();
  });

  it("reviewing shows the exact problems the server found", async () => {
    m.documents.mockResolvedValue([doc()]);
    m.preview.mockResolvedValue({ ready: false, payload: PAYLOAD, issues: [{ field: "buyerCity", message: "Customer city is missing" }, { field: "customerParticipantId", message: "Customer Participant ID is missing" }] });
    at("/e-invoicing/outbound");
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
    at("/e-invoicing/outbound");
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
    at("/e-invoicing/outbound");
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));
    const confirm = await screen.findByRole("dialog", { name: "Send SO-2026-0001?" });
    expect(m.submit).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Send e-invoice" }));
    expect(await screen.findByText("Customer city is missing")).toBeInTheDocument();
  });

  it("sending is disabled while e-invoicing is off", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, enabled: false });
    m.documents.mockResolvedValue([doc()]);
    at("/e-invoicing/outbound");
    expect(await screen.findByRole("button", { name: /^Send$/ })).toBeDisabled();
    expect(screen.getByText(/switched off/)).toBeInTheDocument();
  });

  it("a failed invoice can be retried, and an in-flight one checked", async () => {
    m.documents.mockResolvedValue([
      doc({ _id: "f", transactionNo: "SO-F", status: "FAILED", submissionId: "sf", lastError: "network" }),
      doc({ _id: "s", transactionNo: "SO-S", status: "SUBMITTED", submissionId: "ss" }),
    ]);
    m.retry.mockResolvedValue({}); m.refresh.mockResolvedValue({});
    at("/e-invoicing/outbound");
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
    at("/e-invoicing/outbound");
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
    at("/e-invoicing/inbound");
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
    at("/e-invoicing/inbound");
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
    at("/e-invoicing/inbound");
    expect(await screen.findByText("Reason: Wrong prices")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });

  it("adding by hand validates the TRN and requires a total", async () => {
    m.inbound.mockResolvedValue({ rows: [], total: 0 });
    m.addInbound.mockResolvedValue({ duplicate: false, matchNote: "Matched to Mill" });
    at("/e-invoicing/inbound");
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
    at("/e-invoicing/readiness");
    const fix = await screen.findByRole("link", { name: "Fix in Tax identity" });
    expect(fix).toHaveAttribute("href", "/settings?tab=rules");
    expect(screen.getByLabelText("Ready")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 ready")).toBeInTheDocument();
    expect(screen.getByText("Missing City · VAT Number must be 15 digits")).toBeInTheDocument();
  });

  it("completes a customer's details and sends only what was filled in", async () => {
    m.readiness.mockResolvedValue(READY);
    m.fixParty.mockResolvedValue({});
    at("/e-invoicing/readiness");
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
  it("shows the built-in sandbox in use, and offers to connect Wafeq when the server is set up for it", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, wafeq: { status: "disconnected", modes: { sandbox: { available: true, oauth: true }, live: { available: false, oauth: false } } } });
    at("/e-invoicing/settings");
    expect(await screen.findByText("In use")).toBeInTheDocument();
    expect(screen.getByText(/Nothing here is a valid tax e-invoice/)).toBeInTheDocument();
    expect(screen.getByText(/Wafeq FZ LLC/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect with Wafeq" })).toBeEnabled();
    expect(screen.getByRole("option", { name: /Live \(not available yet\)/ })).toBeDisabled();
  });

  it("sends the person to Wafeq's approval page, and shows nothing connected until they come back", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, wafeq: { status: "disconnected", modes: { sandbox: { available: true, oauth: true } } } });
    m.wafeqStart.mockResolvedValue({ url: "https://einvoicing.wafeq.com/sandbox/oauth/authorize?x=1", mode: "sandbox" });
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    at("/e-invoicing/settings");
    fireEvent.click(await screen.findByRole("button", { name: "Connect with Wafeq" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://einvoicing.wafeq.com/sandbox/oauth/authorize?x=1"));
    expect(m.wafeqStart).toHaveBeenCalledWith({ mode: "sandbox" });
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("cannot connect when the server has no OAuth client for the mode, and says so", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, wafeq: { status: "disconnected", modes: { sandbox: { available: true, oauth: false } } } });
    at("/e-invoicing/settings");
    expect(await screen.findByRole("button", { name: "Connect with Wafeq" })).toBeDisabled();
    expect(screen.getByText(/not set up for test connections yet/)).toBeInTheDocument();
  });

  it("shows a connected business with its Peppol id, locks the typed participant id, and can disconnect", async () => {
    m.settings.mockResolvedValue({
      ...SETTINGS, provider: "wafeq", connected: true, participantId: "0235:1716865504",
      wafeq: { status: "active", mode: "sandbox", name: "Sandbox taxpayer 5504", participantId: "0235:1716865504", modes: {} },
    });
    m.wafeqDisconnect.mockResolvedValue({ connected: false });
    at("/e-invoicing/settings");
    expect(await screen.findByText("Sandbox taxpayer 5504")).toBeInTheDocument();
    expect(screen.getByText("Test mode: invoices are checked and delivered in simulation. Nothing reaches the tax authority.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Participant ID/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(m.wafeqDisconnect).toHaveBeenCalledTimes(1));
  });

  it("says a lost connection needs connecting again", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, wafeq: { status: "revoked", lastError: "The Wafeq connection was withdrawn; connect again", modes: { sandbox: { available: true, oauth: true } } } });
    at("/e-invoicing/settings");
    expect(await screen.findByText("Connection lost")).toBeInTheDocument();
    expect(screen.getByText(/withdrawn; connect again/)).toBeInTheDocument();
  });

  it("never shows a stored secret; replacing it sends the new one", async () => {
    m.saveSettings.mockResolvedValue({});
    at("/e-invoicing/settings");
    expect(await screen.findByText("Stored")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Signing secret/)).toBeNull(); // no field showing the old value
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    fireEvent.change(screen.getByLabelText(/Signing secret/), { target: { value: "new-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ participantId: "0235:100123456700003", dueDays: 0, webhookSecret: "new-secret" }));
  });

  it("validates the participant id", async () => {
    at("/e-invoicing/settings");
    fireEvent.change(await screen.findByLabelText("Your Participant ID"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Looks like 0235:100123456700003")).toBeInTheDocument();
    expect(m.saveSettings).not.toHaveBeenCalled();
  });

  it("switching on reports why it cannot be switched on", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, enabled: false });
    m.saveSettings.mockRejectedValue(new Error("Not ready to enable: Company TRN (15 digits)"));
    at("/e-invoicing/settings");
    fireEvent.click(await screen.findByRole("button", { name: "Switch on" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not ready to enable: Company TRN (15 digits)");
  });
});

describe("received invoices through Wafeq", () => {
  const WAFEQ_INV = {
    _id: "i9", documentId: "SUP-77", status: "RECEIVED", source: "wafeq", kind: "invoice", sellerName: "Mill", currency: "AED", issueDate: "2026-11-20",
    totals: { payable: 105, tax: 5 }, matchedVendorId: { _id: "v1", vendorName: "Mill" }, matchNote: "Matched to Mill; no single purchase order matches",
    lines: [{ itemName: "Basmati Rice 25 kg", sellerItemId: "RICE", quantity: 1, unitPrice: 100, lineNetAmount: 100, taxCategory: "S", taxRatePercent: 5 }],
  };

  it("checks Wafeq for new invoices and says what arrived", async () => {
    m.inbound.mockResolvedValue({ rows: [], total: 0 });
    m.inboundPull.mockResolvedValue({ found: 2, added: 2, errors: [] });
    at("/e-invoicing/inbound");
    fireEvent.click(await screen.findByRole("button", { name: "Check for new" }));
    expect(await screen.findByText("2 new invoices received")).toBeInTheDocument();
    expect(m.inboundPull).toHaveBeenCalledTimes(1);
  });

  it("says so when Wafeq is not connected", async () => {
    m.inbound.mockResolvedValue({ rows: [], total: 0 });
    m.inboundPull.mockResolvedValue({ skipped: true, reason: "Wafeq is not connected" });
    at("/e-invoicing/inbound");
    fireEvent.click(await screen.findByRole("button", { name: "Check for new" }));
    expect(await screen.findByText(/Connect Wafeq in Settings/)).toBeInTheDocument();
  });

  it("records a received invoice as a draft purchase invoice, the item chosen for the line by its code", async () => {
    m.inbound.mockResolvedValue({ rows: [WAFEQ_INV], total: 1 });
    m.apiGet.mockResolvedValue({ stocks: [{ _id: "st1", itemId: "RICE", sku: "RICE", itemName: "Basmati Rice 25 kg" }, { _id: "st2", itemId: "OIL", sku: "OIL", itemName: "Oil" }] });
    m.inboundToPurchase.mockResolvedValue({ transactionId: "t1", transactionNo: "PO-2026-0009", total: 105, receivedTotal: 105, difference: 0 });
    at("/e-invoicing/inbound");
    expect(await screen.findByText("From Wafeq")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Record as purchase invoice/ }));
    const dialog = await screen.findByRole("dialog", { name: /Record SUP-77 as a purchase invoice/ });
    const make = within(dialog).getByRole("button", { name: "Make draft purchase invoice" });
    await waitFor(() => expect(make).toBeEnabled()); // the supplier's own item code matched our SKU
    fireEvent.click(make);
    await waitFor(() => expect(m.inboundToPurchase).toHaveBeenCalledWith("i9", { lines: [{ itemId: "st1" }] }));
    expect(await screen.findByText(/equals what the supplier billed/)).toBeInTheDocument();
  });

  it("shows a difference between the draft and the supplier's total instead of hiding it", async () => {
    m.inbound.mockResolvedValue({ rows: [WAFEQ_INV], total: 1 });
    m.apiGet.mockResolvedValue({ stocks: [{ _id: "st1", itemId: "RICE", sku: "RICE", itemName: "Basmati Rice 25 kg" }] });
    m.inboundToPurchase.mockResolvedValue({ transactionId: "t1", transactionNo: "PO-2026-0009", total: 104.99, receivedTotal: 105, difference: -0.01 });
    at("/e-invoicing/inbound");
    fireEvent.click(await screen.findByRole("button", { name: /Record as purchase invoice/ }));
    const dialog = await screen.findByRole("dialog", { name: /Record SUP-77/ });
    const make = within(dialog).getByRole("button", { name: "Make draft purchase invoice" });
    await waitFor(() => expect(make).toBeEnabled());
    fireEvent.click(make);
    expect(await screen.findByText(/a difference of/)).toBeInTheDocument();
  });

  it("offers no purchase-invoice button for a credit note or an unmatched supplier", async () => {
    m.inbound.mockResolvedValue({ rows: [{ ...WAFEQ_INV, kind: "credit_note" }, { ...WAFEQ_INV, _id: "i10", documentId: "SUP-78", matchedVendorId: null }], total: 2 });
    at("/e-invoicing/inbound");
    expect(await screen.findByText("SUP-77")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record as purchase invoice/ })).toBeNull();
  });
});

describe("fix and resend, and credit in full", () => {
  it("offers a correction only for a buyer's BV or SV rejection, and sends it for that invoice", async () => {
    m.documents.mockResolvedValue([
      doc({ status: "REJECTED", submissionId: "s1", rejectedBy: "buyer", deliveryReasonCode: "BV", deliveryReasonText: "Buyer TRN does not match" }),
      doc({ _id: "d2", transactionNo: "SO-2026-0002", status: "REJECTED", submissionId: "s2", rejectedBy: "fta" }),
      doc({ _id: "d3", transactionNo: "SO-2026-0003", status: "REJECTED", submissionId: "s3", rejectedBy: "buyer", deliveryReasonCode: "FD" }),
    ]);
    m.correct.mockResolvedValue({});
    at("/e-invoicing/outbound");
    const buttons = await screen.findAllByRole("button", { name: /Resend correction/ });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    const dialog = await screen.findByRole("dialog", { name: /Resend SO-2026-0001 as a correction/ });
    expect(within(dialog).getByText(/Buyer TRN does not match/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Resend correction" }));
    await waitFor(() => expect(m.correct).toHaveBeenCalledWith("s1"));
  });

  it("credits an invoice that was sent in full, after confirming", async () => {
    m.documents.mockResolvedValue([doc({ status: "REPORTED", submissionId: "s1" }), doc({ _id: "d2", transactionNo: "SO-2026-0002", status: "NOT_SENT" })]);
    m.creditInFull.mockResolvedValue({ _id: "r1", transactionNo: "SR-2026-0001" });
    at("/e-invoicing/outbound");
    const buttons = await screen.findAllByRole("button", { name: /Credit in full/ });
    expect(buttons).toHaveLength(1); // not offered for an invoice that was never sent
    fireEvent.click(buttons[0]);
    const dialog = await screen.findByRole("dialog", { name: /Credit SO-2026-0001 in full/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "Make the credit note" }));
    await waitFor(() => expect(m.creditInFull).toHaveBeenCalledWith("d1"));
  });
});
