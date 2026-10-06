import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import QuotationView from "../QuotationView";
import { quotations } from "../../../lib/salesDocumentsApi";
import { ApiError } from "../../../lib/accountingApi";

vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: vi.fn(() => ({ companyName: "Zarvia Trading", vatNumber: "100123456700003" })) }));
vi.mock("../../../lib/salesDocumentsApi", () => ({
  quotations: {
    get: vi.fn(), activity: vi.fn(), send: vi.fn(), accept: vi.fn(), reject: vi.fn(), revise: vi.fn(),
    convert: vi.fn(), toDeliveryNote: vi.fn(), remove: vi.fn(),
  },
}));

const actionsFor = (status, expired = false) => ({
  edit: status === "DRAFT", delete: status === "DRAFT", send: status === "DRAFT", accept: status === "SENT" && !expired,
  reject: ["SENT", "ACCEPTED"].includes(status), convert: ["SENT", "ACCEPTED"].includes(status) && !expired,
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
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    for (const gone of [/^accept$/i, /convert to sales order/i, /create delivery note/i, /^revise$/i]) {
      expect(screen.queryByRole("button", { name: gone })).not.toBeInTheDocument();
    }
  });

  it("an expired offer cannot be accepted or converted, says so, and can be revised", async () => {
    show(quotation({ status: "SENT", expired: true, daysLeft: -5 }));
    expect(await screen.findByText(/ran out on/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^accept$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /convert to sales order/i })).not.toBeInTheDocument();
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

  it("converting sends the date and says what was created", async () => {
    quotations.convert.mockResolvedValue({ quotation: {}, salesOrder: { transactionNo: "SO-2026-0031" } });
    show(quotation({ status: "ACCEPTED" }));
    fireEvent.click(await screen.findByRole("button", { name: /convert to sales order/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/nothing moves in stock or the ledger/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /create sales order/i }));
    await waitFor(() => expect(quotations.convert).toHaveBeenCalledWith("q1", { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("SO-2026-0031 created from QT-2026-0007"));
  });

  it("when the server refuses, the reason is shown in the dialog and the dialog stays open", async () => {
    quotations.convert.mockRejectedValue(new ApiError("QT-2026-0007 expired on 2026-11-05. Revise it to offer it again.", { code: "QUOTATION_EXPIRED", status: 409 }));
    show(quotation({ status: "ACCEPTED" }));
    fireEvent.click(await screen.findByRole("button", { name: /convert to sales order/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /create sales order/i }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/expired on 2026-11-05/);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
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
