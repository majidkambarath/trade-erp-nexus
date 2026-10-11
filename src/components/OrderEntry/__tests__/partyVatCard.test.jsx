import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrderForm from "../OrderForm";
import { VARIANTS, recalcRow } from "../variants";
import axiosInstance from "../../../axios/axios";

// The party card must say whether the customer or vendor is VAT registered, show the TRN, and warn where it matters.

vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div>Attachments panel</div>, linkPending: vi.fn(async () => []) }));
vi.mock("../../../lib/processTransaction", () => ({ applyAfterSave: vi.fn(async () => ({ done: true, status: "APPROVED" })) }));

const rice = { _id: "s1", itemId: "ITM1", itemName: "Basmati 5kg", purchasePrice: 10, salesPrice: 20, currentStock: 40, taxPercent: 5 };
const customers = [
  { _id: "c1", customerId: "C1", customerName: "Al Noor Grocery", billingAddress: "Deira", paymentTerms: "Net 30", vat: { status: "registered", trn: "100123456700003" } },
  { _id: "c2", customerId: "C2", customerName: "Walk-in", billingAddress: "Deira", paymentTerms: "COD", vat: { status: "unregistered" } },
  { _id: "c3", customerId: "C3", customerName: "No Number LLC", billingAddress: "Deira", vat: { status: "registered" } },
];
const vendors = [
  { _id: "v1", vendorId: "V1", vendorName: "Gulf Grain", address: "Jebel Ali", trnNO: "100234561200003", vat: { status: "registered", trn: "100234561200003" } },
  { _id: "v2", vendorId: "V2", vendorName: "Corner Shop", address: "Satwa", vat: { status: "unregistered" } },
];

const line = (V) => recalcRow(V, { ...V.rowTemplate(), itemId: rice._id, itemCode: rice.itemId, qty: "2", ...V.hydrate(V.rowTemplate(), rice) });

function Harness({ variant, parties, partyId, partyType, withLine = false }) {
  const V = VARIANTS[variant];
  const [formData, setFormData] = useState({
    transactionNo: "", partyId, partyType, date: "2026-10-06", reference: "", deliveryAddress: "", notes: "", discount: "0", charges: [],
    items: withLine ? [line(V)] : [V.rowTemplate()],
  });
  return (
    <OrderForm
      variant={V} formData={formData} setFormData={setFormData} parties={parties} stockItems={[rice]}
      notify={() => {}} setActiveView={() => {}} resetForm={() => {}} onSuccess={() => {}} activeView="create"
    />
  );
}
const show = async (ui) => {
  const out = render(ui);
  await act(async () => {});
  return out;
};
const card = () => document.querySelector("[data-party-vat]");

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockResolvedValue({ data: { data: [] } });
});

describe("VAT registration on the party card", () => {
  it("shows a registered customer with their TRN and no warning", async () => {
    await show(<Harness variant="sales" parties={customers} partyId="c1" partyType="Customer" />);
    expect(card()).toHaveAttribute("data-party-vat", "registered");
    expect(within(card()).getByText("VAT registered")).toBeInTheDocument();
    expect(within(card()).getByText("100123456700003")).toBeInTheDocument();
    expect(within(card()).queryByRole("note")).not.toBeInTheDocument();
  });

  it("says an unregistered customer has no TRN printed and that VAT still applies", async () => {
    await show(<Harness variant="sales" parties={customers} partyId="c2" partyType="Customer" />);
    expect(within(card()).getByText("Not VAT registered")).toBeInTheDocument();
    expect(within(card()).queryByText("TRN")).not.toBeInTheDocument();
    expect(within(card()).getByRole("note")).toHaveTextContent(/no customer TRN/);
  });

  it("warns on a registered customer with no TRN on file", async () => {
    await show(<Harness variant="sales" parties={customers} partyId="c3" partyType="Customer" />);
    expect(within(card()).getByRole("note")).toHaveTextContent(/no TRN on file/);
  });

  it("shows the vendor's TRN, which this card never showed (it read a field vendors do not have)", async () => {
    await show(<Harness variant="purchase" parties={vendors} partyId="v1" partyType="Vendor" />);
    expect(within(card()).getByText("VAT registered")).toBeInTheDocument();
    expect(within(card()).getByText("100234561200003")).toBeInTheDocument();
  });

  it("warns, once there is VAT on the lines, that an unregistered vendor cannot charge it", async () => {
    await show(<Harness variant="purchase" parties={vendors} partyId="v2" partyType="Vendor" withLine />);
    expect(within(card()).getByText("Not VAT registered")).toBeInTheDocument();
    const note = within(card()).getByRole("note");
    expect(note).toHaveTextContent(/cannot charge VAT/);
    expect(note).toHaveTextContent(/cannot be claimed back/);
  });

  it("is only a note on that vendor while there is no VAT yet", async () => {
    await show(<Harness variant="purchase" parties={vendors} partyId="v2" partyType="Vendor" />);
    expect(within(card()).getByRole("note")).toHaveTextContent(/no VAT should be charged/);
  });
});
