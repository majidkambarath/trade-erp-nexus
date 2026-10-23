import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrderForm from "../OrderForm";
import { VARIANTS, recalcRow } from "../variants";
import axiosInstance from "../../../axios/axios";

// Whether a person may type a document's number is the voucher type's own setting (Accounting setup ->
// Numbering), off until somebody turns it on. Before this the sales invoice form showed an Auto / Manual
// switch and an editable box whatever the setting said, and the server threw the typed number away
// without a word - a control that did nothing.

vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div>Attachments panel</div>, linkPending: vi.fn(async () => []) }));
vi.mock("../../../lib/processTransaction", () => ({ applyAfterSave: vi.fn(async () => ({ done: true, status: "DRAFT" })) }));

const customers = [{ _id: "c1", customerId: "C1", customerName: "Al Noor Grocery", billingAddress: "Deira", phone: "04 1", trnNumber: "1", paymentTerms: "Net 30" }];
const stockItems = [{ _id: "s1", itemId: "ITM1", itemName: "Basmati 5kg", purchasePrice: 10, salesPrice: 20, currentStock: 40, taxPercent: 5 }];
const filledRow = (V) => recalcRow(V, { ...V.rowTemplate(), itemId: "s1", itemCode: "ITM1", description: "Basmati 5kg", qty: "10", rate: "20", vatPercent: "5" });

const show = async (ui) => { const out = render(ui); await act(async () => {}); return out; };

function Harness({ variant, initial, selected }) {
  const [formData, setFormData] = useState(initial);
  return (
    <OrderForm
      variant={variant} formData={formData} setFormData={setFormData} parties={customers} stockItems={stockItems}
      notify={() => {}} selected={selected} setActiveView={() => {}} resetForm={() => {}} onSuccess={() => {}}
      activeView={selected ? "edit" : "create"}
    />
  );
}

const salesForm = (over = {}) => ({
  transactionNo: "", partyId: "c1", partyType: "Customer", date: "2026-10-06", deliveryDate: "", status: "DRAFT",
  notes: "", discount: "0", charges: [], items: [filledRow(VARIANTS.sales)], ...over,
});

// `method` is what the Numbering screen sets on the sales invoice type.
const withMethod = (method) => async (url) => {
  if (url === "/accounting/voucher-types") return { data: { data: { types: [{ key: "SO", name: "Sales invoice", method, isActive: true }], branches: [] } } };
  if (url === "/accounting/tax-codes") return { data: { data: [] } };
  return { data: { data: [] } };
};

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockImplementation(withMethod("auto"));
  axiosInstance.post.mockResolvedValue({ data: { data: { _id: "t1", transactionNo: "SO-2026-0043", partyId: "c1", items: [] } } });
  axiosInstance.put.mockResolvedValue({ data: { data: { _id: "t1", partyId: "c1", items: [] } } });
});

describe("typing a document's number", () => {
  it("offers nothing to type when the voucher type numbers automatically", async () => {
    await show(<Harness variant={VARIANTS.sales} initial={salesForm()} />);
    expect(screen.queryByRole("group", { name: "Number mode" })).not.toBeInTheDocument();
    const box = screen.getByLabelText("Invoice no.");
    expect(box).toHaveAttribute("readonly");
    expect(box).toHaveAttribute("placeholder", "Assigned when saved");
  });

  it("offers it once the type allows a number to be typed over", async () => {
    axiosInstance.get.mockImplementation(withMethod("auto_override"));
    await show(<Harness variant={VARIANTS.sales} initial={salesForm()} />);
    expect(screen.getByRole("group", { name: "Number mode" })).toBeInTheDocument();
    // still automatic until the person asks for Manual
    expect(screen.getByLabelText("Invoice no.")).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    expect(screen.getByLabelText("Invoice no.")).not.toHaveAttribute("readonly");
  });

  it("sends a typed number as manualNumber, never as transactionNo", async () => {
    axiosInstance.get.mockImplementation(withMethod("auto_override"));
    await show(<Harness variant={VARIANTS.sales} initial={salesForm()} />);
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    fireEvent.change(screen.getByLabelText("Invoice no."), { target: { value: "INV-500" } });
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalled());
    const body = axiosInstance.post.mock.calls[0][1];
    expect(body.manualNumber).toBe("INV-500");
    // the server strips transactionNo from a body on purpose: a body may not choose a document's number
    expect(body.transactionNo).toBeUndefined();
  });

  it("sends nothing when the person leaves it on Auto", async () => {
    axiosInstance.get.mockImplementation(withMethod("auto_override"));
    await show(<Harness variant={VARIANTS.sales} initial={salesForm({ transactionNo: "LEFTOVER" })} />);
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalled());
    expect(axiosInstance.post.mock.calls[0][1].manualNumber).toBeUndefined();
  });

  it("never offers it on an edit: an issued number identifies the document", async () => {
    axiosInstance.get.mockImplementation(withMethod("auto_override"));
    await show(<Harness variant={VARIANTS.sales} initial={salesForm({ transactionNo: "SO-2026-0042" })} selected={{ _id: "t1", transactionNo: "SO-2026-0042" }} />);
    expect(screen.queryByRole("group", { name: "Number mode" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Invoice no.")).toHaveAttribute("readonly");
  });

  it("falls back to automatic when the setting cannot be read, rather than to a box the server would refuse", async () => {
    axiosInstance.get.mockImplementation(async (url) => {
      if (url === "/accounting/voucher-types") throw new Error("offline");
      return { data: { data: [] } };
    });
    await show(<Harness variant={VARIANTS.sales} initial={salesForm()} />);
    expect(screen.queryByRole("group", { name: "Number mode" })).not.toBeInTheDocument();
  });
});
