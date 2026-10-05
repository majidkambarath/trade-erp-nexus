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

import CustomerManagement from "../CustomerManagement";
import { todayInput } from "../../../utils/format";

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const CUSTOMERS = [
  {
    _id: "c1", customerId: "CUST2026001", customerName: "Al Noor Mart", contactPerson: "Sara Khan", email: "sara@alnoor.ae", phone: "+971501112222", billingAddress: "Deira",
    creditLimit: 25000, paymentTerms: "Net 45", status: "Active", trnNumber: "100123456700003", vat: { status: "registered", trn: "100123456700003" }, credit: { days: 45 },
    documents: [{ _id: "d1", typeName: "Trade licence", number: "CN-1", expiryDate: `${addDays(todayInput(), -4)}T00:00:00.000Z` }],
  },
  {
    _id: "c2", customerId: "CUST2026002", customerName: "Bay Grocers", contactPerson: "Omar", email: "omar@bay.ae", phone: "+971502223333", billingAddress: "Bur Dubai",
    creditLimit: 0, paymentTerms: "Net 30", status: "Active", trnNumber: null, vat: { status: "unregistered", trn: null }, credit: { days: 30 },
    documents: [{ _id: "d2", typeName: "Passport", number: "P123456", expiryDate: `${addDays(todayInput(), 400)}T00:00:00.000Z` }],
  },
];

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.get.mockResolvedValue({ data: { data: CUSTOMERS } });
  mocks.banks.mockResolvedValue([]);
  mocks.documentTypes.mockResolvedValue([]);
});

describe("Customer management", () => {
  it("lists the customers and flags the one with an expired document", async () => {
    render(<CustomerManagement />);
    const row = (await screen.findByText("Al Noor Mart")).closest("tr");
    expect(within(row).getByText("Document expired")).toBeInTheDocument();
    expect(within(row).getByTitle(/Trade licence: expired 4 days ago/)).toBeInTheDocument();
    expect(within(screen.getByText("Bay Grocers").closest("tr")).queryByText(/Document (expired|expiring)/)).toBeNull();
    expect(mocks.get).toHaveBeenCalledWith("/customers/customers");
  });

  it("Add Customer opens the shared party form and, once saved, reloads the list", async () => {
    mocks.save.mockResolvedValue({ _id: "c3" });
    render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    fireEvent.click(screen.getAllByRole("button", { name: /Add Customer/ })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Add customer" });
    expect(within(dialog).getAllByRole("tab")).toHaveLength(6);

    fireEvent.change(within(dialog).getByLabelText(/Customer name/), { target: { value: "New Buyer" } });
    fireEvent.change(within(dialog).getByLabelText(/Contact person/), { target: { value: "Huda" } });
    fireEvent.change(within(dialog).getByLabelText(/Billing address/), { target: { value: "Sharjah" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add customer" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0][0]).toBe("customer");
    expect(mocks.save.mock.calls[0][1]).toBeUndefined();
    expect(mocks.save.mock.calls[0][2]).toMatchObject({ customerName: "New Buyer", contactPerson: "Huda", billingAddress: "Sharjah", paymentTerms: "Net 30" });
    expect(await screen.findByText("Customer created successfully!")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("Edit opens the customer with its VAT, terms and limit filled in", async () => {
    mocks.save.mockResolvedValue({ _id: "c1" });
    render(<CustomerManagement />);
    const row = (await screen.findByText("Al Noor Mart")).closest("tr");
    fireEvent.click(within(row).getByTitle("Edit customer"));
    const dialog = await screen.findByRole("dialog", { name: "Edit customer" });
    expect(within(dialog).getByText("Al Noor Mart · CUST2026001")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Customer name/)).toHaveValue("Al Noor Mart");
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: /^VAT/ }), { button: 0 });
    expect(within(dialog).getByLabelText(/TRN/)).toHaveValue("100123456700003");
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: /^Credit and terms/ }), { button: 0 });
    expect(within(dialog).getByLabelText(/Credit limit/)).toHaveValue(25000);
    expect(within(dialog).getByLabelText("Credit days")).toHaveValue(45);
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: /^KYC documents/ }), { button: 0 });
    expect(within(dialog).getByText(/Expired 4 days ago/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Update customer" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0].slice(0, 2)).toEqual(["customer", "c1"]);
    expect(await screen.findByText("Customer updated successfully!")).toBeInTheDocument();
  });

  it("Cancel closes the form without saving", async () => {
    render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    fireEvent.click(screen.getAllByRole("button", { name: /Add Customer/ })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Add customer" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
