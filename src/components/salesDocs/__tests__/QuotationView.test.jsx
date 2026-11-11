import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import QuotationView from "../QuotationView";
import { quotations } from "../../../lib/salesDocumentsApi";
import { ApiError } from "../../../lib/accountingApi";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: vi.fn(() => ({ companyName: "Zarvia Trading", vatNumber: "100123456700003" })) }));
vi.mock("../../../lib/salesDocumentsApi", () => ({
  quotations: {
    get: vi.fn(), activity: vi.fn(), send: vi.fn(), accept: vi.fn(), reject: vi.fn(), revise: vi.fn(),
    convert: vi.fn(), toTradeOrder: vi.fn(), toDeliveryNote: vi.fn(), remove: vi.fn(),
  },
}));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

// Mirrors quotationService.present(): `deliveryNote` is its own flag, not the invoice's `convert`.
const actionsFor = (status, expired = false) => ({
  edit: status === "DRAFT", delete: status === "DRAFT", send: status === "DRAFT", accept: status === "SENT" && !expired,
  reject: ["SENT", "ACCEPTED"].includes(status), convert: ["SENT", "ACCEPTED"].includes(status) && !expired,
  convertToOrder: ["SENT", "ACCEPTED"].includes(status) && !expired,
  deliveryNote: ["SENT", "ACCEPTED"].includes(status) && !expired,
  revise: ["SENT", "ACCEPTED", "REJECTED"].includes(status),
});

const quotation = (over = {}) => {
  const status = over.status || "DRAFT";
  return {
    _id: "q1", quotationNo: "QT-2026-0007", status, displayStatus: over.expired ? "EXPIRED" : status, expired: false, daysLeft: 20,
    date: "2026-10-06T00:00:00.000Z", validUntil: "2026-11-05T00:00:00.000Z", reference: "RFQ-77", terms: "Payment within 30 days",
    items: [{ _id: "l1", itemId: "s1", itemCode: "R1", description: "Basmati 5kg", qty: 10, price: 20, taxableAmount: 200, vatPercent: 5, vatAmount: 10, lineTotal: 210, stockDetails: { unit: "BAG" } }],
    charges: [], discount: 0, pricing: { gross: 200, lineDiscount: 0, net: 200, lineVat: 10, chargesNet: 0, chargesVat: 0, headerDiscount: 0, roundOff: 0, grandTotal: 210 }, totalAmount: 210,
    party: { customerName: "Al Noor Grocery", customerId: "C1", billingAddress: "Deira", paymentTerms: "Net 30" },
    actions: actionsFor(status, over.expired), ...over,
  };
};

const notify = vi.fn();
const props = { id: "q1", onBack: vi.fn(), onEdit: vi.fn(), onOpenQuotation: vi.fn(), onChanged: vi.fn(), notify };

const show = (q) => {
  quotations.get.mockResolvedValue(q);
  quotations.activity.mockResolvedValue({ rows: [{ _id: "a1", at: "2026-10-06T08:00:00.000Z", action: "QUOTATION_CREATED", summary: "Quotation QT-2026-0007 saved as draft", username: "boss@test.uae" }], total: 1 });
  return render(<MemoryRouter><QuotationView {...props} /></MemoryRouter>);
};

// As an organisation whose plan is `features` (which names only what is OFF) - the only way to read the
// feature gate, since without a provider the context fails open and every feature is on.
const showAs = (q, features) => {
  orgStatus = statusFor(["sales.view", "sales.edit", "sales.create", "sales.delete", "sales.send", "sales.approve"], features);
  quotations.get.mockResolvedValue(q);
  quotations.activity.mockResolvedValue({ rows: [], total: 0 });
  return render(<MemoryRouter><AsRole><QuotationView {...props} /></AsRole></MemoryRouter>);
};

// The menu keeps its items in the DOM while closed (display:none, which jsdom cannot see without the
// stylesheet), so opening it is for fidelity - what the assertions turn on is whether an item EXISTS.
const openMenu = () => fireEvent.mouseEnter(screen.getByRole("button", { name: "More actions" }).parentElement);

beforeEach(() => {
  vi.clearAllMocks();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
});

describe("QuotationView", () => {
  it("shows the document the customer will get and what has happened to it", async () => {
    show(quotation());
    expect((await screen.findAllByText("QT-2026-0007")).length).toBeGreaterThan(0);
    expect(screen.getByText("Al Noor Grocery")).toBeInTheDocument();
    expect(screen.getByText("Payment within 30 days")).toBeInTheDocument(); // the terms print on it
    expect(await screen.findByText("Quotation QT-2026-0007 saved as draft")).toBeInTheDocument();
  });

  it("offers only what the server says is allowed", async () => {
    show(quotation({ status: "DRAFT" }));
    await screen.findByRole("button", { name: /mark as sent/i });
    openMenu();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    for (const gone of [/^accept$/i, /convert to sales order/i, /convert to invoice/i, /create delivery note/i, /^revise$/i]) {
      expect(screen.queryByRole("button", { name: gone })).not.toBeInTheDocument();
    }
  });

  // The row was Accept, two conversions, a delivery note, Reject and Revise all shouting at once, beside
  // the copy toggle and the print buttons InvoiceScreen adds.
  it("leads with one step and puts the rest behind More actions", async () => {
    show(quotation({ status: "SENT" }));
    const accept = await screen.findByRole("button", { name: /^accept$/i });
    expect(accept).toHaveClass("erp-btn-primary"); // the one strong button
    const menu = screen.getByRole("button", { name: "More actions" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.mouseEnter(menu.parentElement);
    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute("aria-expanded", "true");
    for (const label of [/convert to sales order/i, /convert to invoice/i, /create delivery note/i, /^revise$/i, /^reject$/i]) {
      expect(screen.getByRole("button", { name: label })).not.toHaveClass("erp-btn-primary");
    }
  });

  it("an expired offer cannot be accepted or converted, says so, and can be revised", async () => {
    show(quotation({ status: "SENT", expired: true, daysLeft: -5 }));
    expect(await screen.findByText(/ran out on/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^accept$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /convert to sales order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /convert to invoice/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^revise$/i })).toBeInTheDocument();
    expect(screen.getAllByText("Expired").length).toBeGreaterThan(0);
  });

  it("marking as sent is honest that nothing is emailed, then records it", async () => {
    quotations.send.mockResolvedValue({});
    show(quotation());
    fireEvent.click(await screen.findByRole("button", { name: /mark as sent/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/not available yet/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /^mark as sent$/i }));
    await waitFor(() => expect(quotations.send).toHaveBeenCalledWith("q1"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("QT-2026-0007 marked as sent"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(props.onChanged).toHaveBeenCalled();
  });

  it("accepting records who accepted", async () => {
    quotations.accept.mockResolvedValue({});
    show(quotation({ status: "SENT" }));
    fireEvent.click(await screen.findByRole("button", { name: /^accept$/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/accepted by/i), { target: { value: "Mr Ali, LPO 991" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /record acceptance/i }));
    await waitFor(() => expect(quotations.accept).toHaveBeenCalledWith("q1", { acceptedBy: "Mr Ali, LPO 991" }));
  });

  // The offer can become the ORDER (a commitment, delivered in stages) or the INVOICE directly. Before this
  // the single button labelled "Convert to sales order" made the invoice, so an order could not be raised at all.
  it("converting to a sales order raises the order document, not the invoice", async () => {
    quotations.toTradeOrder.mockResolvedValue({ quotation: {}, tradeOrder: { orderNo: "SORD-2026-0003" } });
    show(quotation({ status: "ACCEPTED" }));
    fireEvent.click(await screen.findByRole("button", { name: /convert to sales order/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/commits nothing to the accounts/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /create sales order/i }));
    await waitFor(() => expect(quotations.toTradeOrder).toHaveBeenCalledWith("q1", { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expectedDate: undefined }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("SORD-2026-0003 created from QT-2026-0007"));
    expect(quotations.convert).not.toHaveBeenCalled();
  });

  it("converting to an invoice sends the date and says what was created", async () => {
    quotations.convert.mockResolvedValue({ quotation: {}, salesOrder: { transactionNo: "SO-2026-0031" } });
    show(quotation({ status: "ACCEPTED" }));
    fireEvent.click(await screen.findByRole("button", { name: /convert to invoice/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/nothing moves in stock or the ledger/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /create invoice/i }));
    await waitFor(() => expect(quotations.convert).toHaveBeenCalledWith("q1", { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("SO-2026-0031 created from QT-2026-0007"));
    expect(quotations.toTradeOrder).not.toHaveBeenCalled();
  });

  it("when the server refuses, the reason is shown in the dialog and the dialog stays open", async () => {
    quotations.toTradeOrder.mockRejectedValue(new ApiError("QT-2026-0007 expired on 2026-11-05. Revise it to offer it again.", { code: "QUOTATION_EXPIRED", status: 409 }));
    show(quotation({ status: "ACCEPTED" }));
    fireEvent.click(await screen.findByRole("button", { name: /convert to sales order/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /create sales order/i }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/expired on 2026-11-05/);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
  });

  // The defect this was written for, seen on a live organisation whose plan has no Delivery notes: the
  // button rode on the INVOICE's `convert` flag and consulted no plan at all, so it offered a document
  // the organisation cannot have - and the server would now refuse it anyway.
  it("offers no delivery note to an organisation that did not buy them", async () => {
    showAs(quotation({ status: "ACCEPTED" }), { deliveryNotes: false });
    await roleLoaded();
    await screen.findByRole("button", { name: /convert to sales order/i });
    openMenu();
    expect(screen.queryByRole("button", { name: /create delivery note/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/delivery note/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /convert to invoice/i })).toBeInTheDocument(); // the invoice is untouched
  });

  it("offers it to an organisation that did, and still creates the note", async () => {
    quotations.toDeliveryNote.mockResolvedValue({ quotation: {}, deliveryNote: { deliveryNoteNo: "DLN-2026-0012" } });
    showAs(quotation({ status: "ACCEPTED" }), {});
    await roleLoaded();
    openMenu();
    fireEvent.click(await screen.findByRole("button", { name: /create delivery note/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^create delivery note$/i }));
    await waitFor(() => expect(quotations.toDeliveryNote).toHaveBeenCalledWith("q1", { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), deliveryAddress: undefined }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("DLN-2026-0012 created from QT-2026-0007"));
  });

  it("deleting a draft goes back to the list without trying to reload what it just deleted", async () => {
    quotations.remove.mockResolvedValue(undefined);
    show(quotation());
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /delete draft/i }));
    await waitFor(() => expect(props.onBack).toHaveBeenCalled());
    expect(quotations.get).toHaveBeenCalledTimes(1); // no second read of a deleted document
  });
});
