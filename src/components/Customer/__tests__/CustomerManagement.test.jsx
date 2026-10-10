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
import { clearPageSessions } from "../../../lib/pageSession";

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
  clearPageSessions();
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

// The search and the two choices used to be "remembered" by a helper that threw on every read and write (`this` is undefined in a
// module-level arrow function), so nothing was ever kept; the filters sat behind a toggle button, and a customer with no email
// (the field is optional) crashed the search.
describe("the search and the choices", () => {
  const CREEK = {
    _id: "c3", customerId: "CUST2026003", customerName: "Creek Traders", contactPerson: "Ali", phone: "+971503334444", billingAddress: "Creek",
    creditLimit: 1000, paymentTerms: "Net 15", status: "Inactive", trnNumber: null, vat: { status: "unregistered", trn: null }, credit: { days: 15 }, documents: [],
  }; // no email at all
  const searchbox = () => screen.getByRole("searchbox", { name: "Search customers" });
  const status = () => screen.getByRole("combobox", { name: "Status" });
  const terms = () => screen.getByRole("combobox", { name: "Payment terms" });
  const clear = () => screen.queryByRole("button", { name: "Clear filters" });
  const names = () => screen.getAllByRole("row").slice(1).map((r) => r.textContent);

  it("are on the page without pressing anything first, and there is no toggle or dead back button", async () => {
    render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    expect(searchbox()).toBeVisible();
    expect(status()).toBeVisible();
    expect(terms()).toBeVisible();
    expect(screen.queryByTitle("Toggle filters")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear Filters" })).toBeNull();
    expect(screen.getByRole("button", { name: "Refresh data" })).toBeInTheDocument();
  });

  it("narrow the list, and are still there after going to another page and coming back", async () => {
    const first = render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    fireEvent.change(searchbox(), { target: { value: "bay" } });
    fireEvent.change(status(), { target: { value: "Active" } });
    fireEvent.change(terms(), { target: { value: "Net 30" } });
    expect(screen.queryByText("Al Noor Mart")).toBeNull();
    expect(screen.getByText("Bay Grocers")).toBeInTheDocument();
    first.unmount();

    render(<CustomerManagement />);
    await screen.findByText("Bay Grocers");
    expect(searchbox()).toHaveValue("bay");
    expect(status()).toHaveValue("Active");
    expect(terms()).toHaveValue("Net 30");
    expect(screen.queryByText("Al Noor Mart")).toBeNull();
    expect(screen.getByText(/1 displayed/)).toBeInTheDocument();
  });

  it("Clear filters empties all three, is offered only while one is set, and the cleared state is what comes back", async () => {
    const first = render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    expect(clear()).toBeNull();

    fireEvent.change(terms(), { target: { value: "Net 45" } });
    expect(clear()).toBeInTheDocument();
    fireEvent.change(searchbox(), { target: { value: "noor" } });
    fireEvent.change(status(), { target: { value: "Active" } });
    fireEvent.click(clear());

    expect(searchbox()).toHaveValue("");
    expect(status()).toHaveValue("");
    expect(terms()).toHaveValue("");
    expect(clear()).toBeNull();
    expect(screen.getByText("Bay Grocers")).toBeInTheDocument();
    first.unmount();

    render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    expect(searchbox()).toHaveValue("");
    expect(status()).toHaveValue("");
    expect(terms()).toHaveValue("");
  });

  it("the Clear search button in the box empties only the search", async () => {
    render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    fireEvent.change(status(), { target: { value: "Active" } });
    fireEvent.change(searchbox(), { target: { value: "bay" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(searchbox()).toHaveValue("");
    expect(status()).toHaveValue("Active");
  });

  it("a customer with no email does not break the search, and a term only some customers carry can be chosen", async () => {
    mocks.get.mockResolvedValue({ data: { data: [...CUSTOMERS, CREEK] } });
    render(<CustomerManagement />);
    await screen.findByText("Creek Traders");

    // "bay" reads every customer's email: the one with none used to throw and blank the page
    fireEvent.change(searchbox(), { target: { value: "bay" } });
    expect(screen.getByText("Bay Grocers")).toBeInTheDocument();
    expect(screen.queryByText("Creek Traders")).toBeNull();
    fireEvent.change(searchbox(), { target: { value: "" } });

    expect(within(terms()).getByRole("option", { name: "Net 15" })).toBeInTheDocument();
    expect(within(terms()).getByRole("option", { name: "Cash on Delivery" })).toBeInTheDocument();
    fireEvent.change(terms(), { target: { value: "Net 15" } });
    expect(screen.getByText("Creek Traders")).toBeInTheDocument();
    expect(screen.queryByText("Al Noor Mart")).toBeNull();
  });

  it("a stat card sets the Status choice you can now see", async () => {
    mocks.get.mockResolvedValue({ data: { data: [...CUSTOMERS, CREEK] } });
    render(<CustomerManagement />);
    await screen.findByText("Creek Traders");
    fireEvent.click(screen.getByRole("button", { name: /Inactive Customers/ }));
    expect(status()).toHaveValue("Inactive");
    expect(screen.getByText("Creek Traders")).toBeInTheDocument();
    expect(screen.queryByText("Al Noor Mart")).toBeNull();
  });

  it("with a search or choice set and nothing matching, says so and offers to clear them; with none set, says there are none yet", async () => {
    const view = render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    fireEvent.change(searchbox(), { target: { value: "no such customer" } });
    expect(screen.getByText("No customers match the search or filters")).toBeInTheDocument();
    expect(screen.queryByText("No customers yet")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add First Customer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(searchbox()).toHaveValue("");
    expect(await screen.findByText("Al Noor Mart")).toBeInTheDocument();
    view.unmount();

    clearPageSessions();
    mocks.get.mockResolvedValue({ data: { data: [] } });
    render(<CustomerManagement />);
    expect(await screen.findByText("No customers yet")).toBeInTheDocument();
    expect(screen.queryByText("No customers match the search or filters")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear search and filters" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add First Customer" })).toBeInTheDocument();
  });

  it("keeps the column the list is sorted by, and nothing goes to the browser's storage", async () => {
    const first = render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    const header = () => screen.getByRole("button", { name: /^Customer Name/ });
    fireEvent.click(header()); // ascending
    fireEvent.click(header()); // descending
    expect(names()[0]).toContain("Bay Grocers");
    fireEvent.change(searchbox(), { target: { value: "grocers" } });
    first.unmount();

    render(<CustomerManagement />);
    await screen.findByText("Bay Grocers");
    expect(header()).toHaveTextContent("↓");
    fireEvent.change(searchbox(), { target: { value: "" } });
    expect(names()[0]).toContain("Bay Grocers");
    expect(names()[1]).toContain("Al Noor Mart");

    const stored = [localStorage, sessionStorage].flatMap((st) =>
      Array.from({ length: st.length }, (_, i) => `${st.key(i)}=${st.getItem(st.key(i))}`)
    );
    expect(stored.join("\n")).not.toMatch(/grocers/i);
  });

  it("keeps the search while the add form is opened and cancelled (the form keeps no draft of its own on this screen)", async () => {
    render(<CustomerManagement />);
    await screen.findByText("Al Noor Mart");
    fireEvent.change(searchbox(), { target: { value: "noor" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Add Customer/ })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Add customer" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(searchbox()).toHaveValue("noor");
  });
});
