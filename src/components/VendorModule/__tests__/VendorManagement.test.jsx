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
import { clearPageSessions } from "../../../lib/pageSession";

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
  clearPageSessions();
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

describe("the vendor list's search and filters", () => {
  const searchBox = () => screen.getByRole("searchbox", { name: "Search vendors" });
  const rowOrder = () => screen.getAllByRole("row").map((r) => r.textContent).filter((t) => /Gulf Mills|Dubai Dates/.test(t));

  it("are on the page without pressing anything first", async () => {
    render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    expect(searchBox()).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Payment terms" })).toBeVisible();
    // the old toggle, the back chevron that did nothing and the old clear button are gone
    expect(screen.queryByTitle("Toggle filters")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear Filters" })).toBeNull();
    expect(screen.getAllByRole("button").every((b) => b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent.trim())).toBe(true);
  });

  it("narrow the list by the search and by each choice", async () => {
    render(<VendorManagement />);
    await screen.findByText("Gulf Mills");

    fireEvent.change(searchBox(), { target: { value: "dates" } });
    expect(screen.queryByText("Gulf Mills")).toBeNull();
    expect(screen.getByText("Dubai Dates")).toBeInTheDocument();

    fireEvent.change(searchBox(), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "Pending" } });
    expect(screen.queryByText("Gulf Mills")).toBeNull();
    expect(screen.getByText("Dubai Dates")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Payment terms" }), { target: { value: "COD" } });
    expect(screen.getByText("Gulf Mills")).toBeInTheDocument();
    expect(screen.queryByText("Dubai Dates")).toBeNull();
  });

  it("are still there after going to another page and coming back", async () => {
    const first = render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    fireEvent.change(searchBox(), { target: { value: "gulf" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "Compliant" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Payment terms" }), { target: { value: "COD" } });
    await waitFor(() => expect(screen.queryByText("Dubai Dates")).toBeNull());
    first.unmount();

    render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    expect(searchBox()).toHaveValue("gulf");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("Compliant");
    expect(screen.getByRole("combobox", { name: "Payment terms" })).toHaveValue("COD");
    expect(screen.queryByText("Dubai Dates")).toBeNull();
  });

  it("keep the column the list is sorted by", async () => {
    const first = render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    expect(rowOrder()[0]).toMatch(/Gulf Mills/); // the order the server sent
    fireEvent.click(screen.getByRole("button", { name: "Vendor Name" }));
    expect(rowOrder()[0]).toMatch(/Dubai Dates/);
    first.unmount();

    render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    expect(rowOrder()[0]).toMatch(/Dubai Dates/);
    expect(screen.getByRole("button", { name: /Vendor Name/ })).toHaveTextContent("↑");
  });

  it("start empty again once the sessions are cleared (sign-out)", async () => {
    const first = render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    fireEvent.change(searchBox(), { target: { value: "gulf" } });
    first.unmount();
    clearPageSessions();

    render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    expect(searchBox()).toHaveValue("");
    expect(screen.getByText("Dubai Dates")).toBeInTheDocument();
  });

  it("Clear filters empties the search and both choices, and is offered only while one is set", async () => {
    render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Payment terms" }), { target: { value: "30 days" } });
    expect(screen.queryByText("Gulf Mills")).toBeNull();
    fireEvent.change(searchBox(), { target: { value: "dates" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(searchBox()).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Payment terms" })).toHaveValue("");
    expect(screen.getByText("Gulf Mills")).toBeInTheDocument();
    expect(screen.getByText("Dubai Dates")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("an empty result says the search or filters are why, and can undo them", async () => {
    render(<VendorManagement />);
    await screen.findByText("Gulf Mills");
    fireEvent.change(searchBox(), { target: { value: "no such vendor" } });
    expect(screen.getByText("No vendors match the search or filters")).toBeInTheDocument();
    expect(screen.queryByText("No vendors yet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(await screen.findByText("Gulf Mills")).toBeInTheDocument();
    expect(searchBox()).toHaveValue("");
  });

  it("with no vendors at all says so, and offers no clear button", async () => {
    mocks.get.mockResolvedValue({ data: { data: [] } });
    render(<VendorManagement />);
    expect(await screen.findByText("No vendors yet")).toBeInTheDocument();
    expect(screen.queryByText("No vendors match the search or filters")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear search and filters" })).toBeNull();
  });

  it("a vendor saved with no email, contact or TRN does not stop the list or its search", async () => {
    mocks.get.mockResolvedValue({
      data: { data: [...VENDORS, { _id: "v3", vendorId: "VEND2026003", vendorName: "No Mail Co", phone: "+971503334444", address: "Ajman", paymentTerms: "COD", status: "Compliant", documents: [] }] },
    });
    render(<VendorManagement />);
    expect(await screen.findByText("No Mail Co")).toBeInTheDocument();
    fireEvent.change(searchBox(), { target: { value: "mail co" } });
    expect(screen.getByText("No Mail Co")).toBeInTheDocument();
    expect(screen.queryByText("Gulf Mills")).toBeNull();
    fireEvent.change(searchBox(), { target: { value: "100123456700003" } }); // the TRN is still searched
    expect(screen.getByText("Gulf Mills")).toBeInTheDocument();
    expect(screen.queryByText("No Mail Co")).toBeNull();
  });
});
