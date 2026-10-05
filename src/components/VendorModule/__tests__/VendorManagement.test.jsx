import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), banks: vi.fn(), documentTypes: vi.fn() }));

vi.mock("../../../axios/axios", () => ({ default: { get: mocks.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("../../../lib/accountingApi", () => ({
  accounting: { deleteAttachment: vi.fn(), attachments: vi.fn() }, uploadAttachment: vi.fn(), downloadAttachment: vi.fn(), linkAttachment: vi.fn(),
}));
vi.mock("../../../lib/bankingApi", () => ({ banking: { banks: mocks.banks } }));
vi.mock("../../../lib/partyMasterApi", () => ({ partyMaster: { documentTypes: { list: mocks.documentTypes }, parties: { save: mocks.save } } }));

import VendorManagement from "../VendorManagement";
import { todayInput } from "../../../utils/format";

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const VENDORS = [
  {
    _id: "v1", vendorId: "VEND2026001", vendorName: "Gulf Mills", contactPerson: "Omar", email: "o@gulf.ae", phone: "+971501112222", address: "Jebel Ali",
    paymentTerms: "COD", status: "Compliant", trnNO: "100123456700003", vat: { status: "registered", trn: "100123456700003" }, credit: { days: 0 },
    documents: [{ _id: "d1", typeName: "Trade licence", number: "CN-9", expiryDate: `${addDays(todayInput(), 12)}T00:00:00.000Z` }],
  },
  {
    _id: "v2", vendorId: "VEND2026002", vendorName: "Dubai Dates", contactPerson: "Fatima", email: "f@dates.ae", phone: "+971502223333", address: "Al Quoz",
    paymentTerms: "30 days", status: "Pending", trnNO: null, documents: [],
  },
];

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.get.mockResolvedValue({ data: { data: VENDORS } });
  mocks.banks.mockResolvedValue([]);
  mocks.documentTypes.mockResolvedValue([]);
});

describe("Vendor management", () => {
  it("lists the vendors and flags the one whose document is about to expire", async () => {
    render(<VendorManagement />);
    const row = (await screen.findByText("Gulf Mills")).closest("tr");
    expect(within(row).getByText("Document expiring")).toBeInTheDocument();
    expect(within(row).getByTitle(/Trade licence: expires in 12 days/)).toBeInTheDocument();
    expect(within(screen.getByText("Dubai Dates").closest("tr")).queryByText(/Document (expired|expiring)/)).toBeNull();
    expect(mocks.get).toHaveBeenCalledWith("/vendors/vendors");
  });

  it("Add Vendor opens the shared party form and, once saved, reloads the list", async () => {
    mocks.save.mockResolvedValue({ _id: "v3" });
    render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    fireEvent.click(screen.getByRole("button", { name: /Add Vendor/ }));
    const dialog = await screen.findByRole("dialog", { name: "Add vendor" });
    fireEvent.change(within(dialog).getByLabelText(/Vendor name/), { target: { value: "Al Ain Farms" } });
    fireEvent.change(within(dialog).getByLabelText(/Contact person/), { target: { value: "Khalid" } });
    fireEvent.change(within(dialog).getByLabelText(/^Address/), { target: { value: "Al Ain" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add vendor" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0][0]).toBe("vendor");
    expect(mocks.save.mock.calls[0][2]).toMatchObject({ vendorName: "Al Ain Farms", contactPerson: "Khalid", address: "Al Ain", status: "Compliant", paymentTerms: "30 days" });
    expect(await screen.findByText("Vendor created successfully!")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("Edit opens the vendor with its status, terms and TRN filled in", async () => {
    mocks.save.mockResolvedValue({ _id: "v1" });
    render(<VendorManagement />);
    const row = (await screen.findByText("Gulf Mills")).closest("tr");
    fireEvent.click(within(row).getByTitle("Edit vendor"));
    const dialog = await screen.findByRole("dialog", { name: "Edit vendor" });
    expect(within(dialog).getByText("Gulf Mills · VEND2026001")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Status")).toHaveValue("Compliant");
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: /^VAT/ }), { button: 0 });
    expect(within(dialog).getByLabelText(/TRN/)).toHaveValue("100123456700003");
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: /^Credit and terms/ }), { button: 0 });
    expect(within(dialog).getByLabelText("Payment terms")).toHaveValue("COD");
    fireEvent.click(within(dialog).getByRole("button", { name: "Update vendor" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0].slice(0, 2)).toEqual(["vendor", "v1"]);
    expect(await screen.findByText("Vendor updated successfully!")).toBeInTheDocument();
  });
});
