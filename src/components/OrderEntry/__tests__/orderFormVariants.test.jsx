import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrderForm from "../OrderForm";
import { VARIANTS } from "../variants";
import { recalcRow } from "../variants";
import axiosInstance from "../../../axios/axios";

// The form is one component serving six documents. This proves the opt-in hooks do what a quotation and a
// delivery note need, and - the part that matters most - that the sales order it already served is unchanged.

vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div>Attachments panel</div>, linkPending: vi.fn(async () => []) }));
vi.mock("../../../lib/processTransaction", () => ({ applyAfterSave: vi.fn(async () => ({ done: true, status: "APPROVED" })) }));

const customers = [{ _id: "c1", customerId: "C1", customerName: "Al Noor Grocery", billingAddress: "Deira", phone: "04 1", trnNumber: "1", paymentTerms: "Net 30" }];
const stockItems = [{ _id: "s1", itemId: "ITM1", itemName: "Basmati 5kg", purchasePrice: 10, salesPrice: 20, currentStock: 40, taxPercent: 5 }];

const filledRow = (V) => recalcRow(V, { ...V.rowTemplate(), itemId: "s1", itemCode: "ITM1", description: "Basmati 5kg", qty: "10", rate: "20", vatPercent: "5" });

// Render, then let the form's own lookups (tax codes, availability) settle inside act().
const show = async (ui) => {
  const out = render(ui);
  await act(async () => {});
  return out;
};

function Harness({ variant, initial, selected, onSuccess = () => {}, notify = () => {} }) {
  const [formData, setFormData] = useState(initial);
  return (
    <OrderForm
      variant={variant} formData={formData} setFormData={setFormData} parties={customers} stockItems={stockItems}
      notify={notify} selected={selected} setActiveView={() => {}} resetForm={() => {}} onSuccess={onSuccess} activeView={selected ? "edit" : "create"}
    />
  );
}

const quotationForm = (over = {}) => ({
  transactionNo: "", partyId: "c1", partyType: "Customer", date: "2026-10-06", validUntil: "2026-11-05", reference: "RFQ-77", terms: "Payment within 30 days",
  notes: "", discount: "0", charges: [], items: [filledRow(VARIANTS.quotation)], ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockImplementation(async (url) => {
    if (url === "/accounting/tax-codes") return { data: { data: [] } };
    if (url === "/delivery-notes/availability") return { data: { data: [{ itemId: "s1", onHand: 40, committed: 35, available: 5 }] } };
    return { data: { data: [] } };
  });
  axiosInstance.post.mockResolvedValue({ data: { data: { _id: "q1", partyId: "c1", items: [] } } });
  axiosInstance.put.mockResolvedValue({ data: { data: { _id: "q1", partyId: "c1", items: [] } } });
});

describe("the order form as a quotation", () => {
  it("shows what a quotation has - valid until, terms, a reference - and none of what a Transaction has", async () => {
    await show(<Harness variant={VARIANTS.quotation} initial={quotationForm()} />);
    expect(screen.getByText("Create quotation")).toBeInTheDocument();
    expect(screen.getByLabelText("Valid until")).toBeInTheDocument();
    expect(screen.getByLabelText("Terms")).toBeInTheDocument();
    expect(screen.getByLabelText("Customer reference")).toHaveValue("RFQ-77");
    expect(screen.getByLabelText("Discount (AED)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument(); // it moves through its own actions
    expect(screen.queryByText("Attachments panel")).not.toBeInTheDocument(); // attachments belong to transactions
  });

  it("saves to /quotations with inputs only, and hands back the saved document", async () => {
    const onSuccess = vi.fn();
    await show(<Harness variant={VARIANTS.quotation} initial={quotationForm({ discount: "5" })} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /save quotation/i }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(1));
    const [url, body] = axiosInstance.post.mock.calls[0];
    expect(url).toBe("/quotations");
    expect(body).toMatchObject({ partyId: "c1", date: "2026-10-06", validUntil: "2026-11-05", reference: "RFQ-77", terms: "Payment within 30 days", discount: 5, charges: [] });
    expect(body.items).toEqual([{ itemId: "s1", itemCode: "ITM1", description: "Basmati 5kg", qty: 10, price: 20, vatPercent: 5 }]);
    for (const k of ["totalAmount", "status", "type"]) expect(body).not.toHaveProperty(k);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(axiosInstance.post).not.toHaveBeenCalledWith("/transactions/transactions", expect.anything());
  });

  it("edits a saved one with PUT to its own address", async () => {
    await show(<Harness variant={VARIANTS.quotation} initial={quotationForm()} selected={{ id: "q1" }} />);
    fireEvent.click(screen.getByRole("button", { name: /update quotation/i }));
    await waitFor(() => expect(axiosInstance.put).toHaveBeenCalledTimes(1));
    expect(axiosInstance.put.mock.calls[0][0]).toBe("/quotations/q1");
  });

  it("will not save an offer that is valid for a period that ends before it begins", async () => {
    await show(<Harness variant={VARIANTS.quotation} initial={quotationForm({ validUntil: "2026-10-01" })} />);
    fireEvent.click(screen.getByRole("button", { name: /save quotation/i }));
    expect(await screen.findByText("Valid until cannot be before the date")).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("will not save without a validity", async () => {
    await show(<Harness variant={VARIANTS.quotation} initial={quotationForm({ validUntil: "" })} />);
    fireEvent.click(screen.getByRole("button", { name: /save quotation/i }));
    expect(await screen.findByText("Valid until is required")).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and keeps the form", async () => {
    axiosInstance.post.mockRejectedValue({ response: { data: { message: "Line 1: that item no longer exists" } } });
    const notify = vi.fn();
    await show(<Harness variant={VARIANTS.quotation} initial={quotationForm()} notify={notify} />);
    fireEvent.click(screen.getByRole("button", { name: /save quotation/i }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Failed to save: Line 1: that item no longer exists", "error"));
    expect(screen.getByLabelText("Customer reference")).toHaveValue("RFQ-77");
  });
});

describe("the order form as a delivery note", () => {
  const noteForm = (over = {}) => ({
    transactionNo: "", partyId: "c1", partyType: "Customer", date: "2026-10-06", reference: "LPO-1", notes: "", discount: "0", charges: [],
    deliveryAddress: "Al Quoz", contactPerson: "", contactPhone: "", vehicleNo: "DXB A 1", driverName: "Raju", driverPhone: "",
    items: [filledRow(VARIANTS.deliveryNote)], ...over,
  });

  it("has the vehicle, driver and address fields and no second date or terms", async () => {
    await show(<Harness variant={VARIANTS.deliveryNote} initial={noteForm()} />);
    for (const label of ["Delivery address", "Contact person", "Contact phone", "Vehicle", "Driver", "Driver phone"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Terms")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Valid until")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Customer LPO")).toHaveValue("LPO-1");
  });

  it("saves to /delivery-notes with the carrier and where to", async () => {
    await show(<Harness variant={VARIANTS.deliveryNote} initial={noteForm()} />);
    fireEvent.click(screen.getByRole("button", { name: /save delivery note/i }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(1));
    const [url, body] = axiosInstance.post.mock.calls[0];
    expect(url).toBe("/delivery-notes");
    expect(body).toMatchObject({ reference: "LPO-1", deliveryAddress: "Al Quoz", vehicleNo: "DXB A 1", driverName: "Raju", contactPerson: "" });
  });

  it("warns when more is asked than is free, counting what other notes have promised, and still lets it save", async () => {
    await show(<Harness variant={VARIANTS.deliveryNote} initial={noteForm()} />);
    expect(await screen.findByText("Not enough free stock for this delivery note")).toBeInTheDocument();
    expect(screen.getByText(/10 asked, 5 available \(40 on hand, 35 already promised on other delivery notes\)/)).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith("/delivery-notes/availability", { params: { itemIds: "s1", excludeId: undefined } });
    fireEvent.click(screen.getByRole("button", { name: /save delivery note/i }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalled());
  });

  it("is silent when the quantity fits", async () => {
    axiosInstance.get.mockImplementation(async (url) => (url === "/delivery-notes/availability" ? { data: { data: [{ itemId: "s1", onHand: 40, committed: 0, available: 40 }] } } : { data: { data: [] } }));
    await show(<Harness variant={VARIANTS.deliveryNote} initial={noteForm()} />);
    await waitFor(() => expect(axiosInstance.get).toHaveBeenCalledWith("/delivery-notes/availability", expect.anything()));
    expect(screen.queryByText("Not enough free stock for this delivery note")).not.toBeInTheDocument();
  });
});

describe("the sales order it already served", () => {
  const salesForm = () => ({
    transactionNo: "", partyId: "c1", partyType: "Customer", date: "2026-10-06", deliveryDate: "2026-10-07", status: "DRAFT", refNo: "", docNo: "",
    notes: "", discount: "0", charges: [], items: [filledRow(VARIANTS.sales)],
  });

  it("still has its status picker, attachments and delivery date, and saves a Transaction", async () => {
    await show(<Harness variant={VARIANTS.sales} initial={salesForm()} />);
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByText("Attachments panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Delivery date")).toBeInTheDocument();
    expect(screen.queryByLabelText("Valid until")).not.toBeInTheDocument();
    expect(screen.queryByText("Not enough free stock for this delivery note")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save so/i }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(1));
    const [url, body] = axiosInstance.post.mock.calls[0];
    expect(url).toBe("/transactions/transactions");
    expect(body).toMatchObject({ type: "sales_order", partyType: "Customer", status: "DRAFT", totalAmount: 210 });
    expect(axiosInstance.get).not.toHaveBeenCalledWith("/delivery-notes/availability", expect.anything());
  });
});
