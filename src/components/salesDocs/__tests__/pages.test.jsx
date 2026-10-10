import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import QuotationsPage from "../QuotationsPage";
import DeliveryNotesPage from "../DeliveryNotesPage";
import { quotations, deliveryNotes } from "../../../lib/salesDocumentsApi";
import axiosInstance from "../../../axios/axios";

// The pages, end to end inside the browser-less app: a list, the form behind "New", and the way back.
// The order form is the real one; only the network is replaced.

vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: vi.fn(() => ({ companyName: "Zarvia", vatNumber: "1" })) }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div />, linkPending: vi.fn(async () => []) }));
vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../../lib/salesDocumentsApi", () => ({
  quotations: { list: vi.fn(), summary: vi.fn(), get: vi.fn(), activity: vi.fn(), remove: vi.fn() },
  deliveryNotes: { list: vi.fn(), summary: vi.fn(), get: vi.fn(), activity: vi.fn(), fromOrder: vi.fn(), remove: vi.fn(), invoice: vi.fn() },
}));

const emptyPage = { rows: [], pagination: { current: 1, pages: 1, total: 0, limit: 20 } };

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockImplementation(async (url) => {
    if (url === "/customers/customers") return { data: { data: [{ _id: "c1", customerId: "C1", customerName: "Al Noor" }] } };
    if (url === "/stock/stock") return { data: { data: { stocks: [{ _id: "s1", itemId: "I1", itemName: "Rice", salesPrice: 20, currentStock: 9 }] } } };
    return { data: { data: [] } };
  });
  quotations.list.mockResolvedValue(emptyPage);
  quotations.summary.mockResolvedValue({ byStatus: {}, total: 0, winRate: null, expiringSoon: { count: 0, value: 0 } });
  deliveryNotes.list.mockResolvedValue(emptyPage);
  deliveryNotes.summary.mockResolvedValue({ byStatus: {}, uninvoiced: { count: 0, value: 0 }, clock: { count: 0 } });
});

const at = (ui, url = "/") => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);

describe("QuotationsPage", () => {
  it("opens on the list and goes to the form and back", async () => {
    at(<QuotationsPage />, "/quotations");
    expect(await screen.findByText("No quotations in this month")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /new quotation/i })[0]);
    expect(await screen.findByText("Create quotation")).toBeInTheDocument();
    expect(screen.getByLabelText("Valid until")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
    expect(await screen.findByText("No quotations in this month")).toBeInTheDocument();
  });

  it("the form opens with a date and a validity already filled in", async () => {
    at(<QuotationsPage />, "/quotations");
    fireEvent.click((await screen.findAllByRole("button", { name: /new quotation/i }))[0]);
    await screen.findByText("Create quotation");
    // shown in the user's own date format, so only that something is there is checked here;
    // that it is 30 days on is proved on the form's values in lib/__tests__/salesDocuments.test.js
    expect(screen.getByLabelText("Date").value).not.toBe("");
    expect(screen.getByLabelText("Valid until").value).not.toBe("");
  });

  it("?open= goes straight to that quotation", async () => {
    quotations.get.mockResolvedValue({ _id: "q9", quotationNo: "QT-2026-0009", status: "DRAFT", displayStatus: "DRAFT", items: [], party: {}, actions: {} });
    quotations.activity.mockResolvedValue({ rows: [] });
    at(<QuotationsPage />, "/quotations?open=q9");
    await waitFor(() => expect(quotations.get).toHaveBeenCalledWith("q9"));
    expect(quotations.list).not.toHaveBeenCalled();
  });
});

describe("DeliveryNotesPage", () => {
  it("New delivery note asks how the goods are being sent, and both ways lead somewhere", async () => {
    at(<DeliveryNotesPage />, "/delivery-notes");
    expect(await screen.findByText("No delivery notes in this month")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /new delivery note/i })[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Against a sales order")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /on its own/i }));
    expect(await screen.findByText("Create delivery note")).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle")).toBeInTheDocument();
  });

  it("against a sales order shows the order picker", async () => {
    at(<DeliveryNotesPage />, "/delivery-notes");
    fireEvent.click((await screen.findAllByRole("button", { name: /new delivery note/i }))[0]);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /against a sales order/i }));
    expect(await screen.findByText("Delivery note against a sales order")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sales order" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Sales order/)).toBeInTheDocument(); // the picker
    expect(screen.getByLabelText(/^Customer/)).toBeInTheDocument();
  });

  it("?order= starts a note against that order without asking", async () => {
    deliveryNotes.fromOrder.mockResolvedValue({
      order: { id: "o1", no: "SO-2026-0042", status: "DRAFT", date: "2026-10-02", reference: "LPO-1" }, party: { customerName: "Al Noor", contactPerson: "Ali" },
      deliveryAddress: "Al Quoz", lines: [{ sourceLineId: "l1", itemCode: "I1", description: "Rice", ordered: 10, delivered: 0, pending: 0, remaining: 10 }],
    });
    at(<DeliveryNotesPage />, "/delivery-notes?order=o1");
    expect(await screen.findByText("What goes on this note")).toBeInTheDocument();
    expect(deliveryNotes.fromOrder).toHaveBeenCalledWith("o1");
    expect(await screen.findByLabelText("Quantity of Rice on this note")).toHaveValue(10);
    expect(deliveryNotes.list).not.toHaveBeenCalled();
  });

  it("?status=UNINVOICED opens the list on that tab", async () => {
    at(<DeliveryNotesPage />, "/delivery-notes?status=UNINVOICED");
    await waitFor(() => expect(deliveryNotes.list).toHaveBeenCalledWith(expect.objectContaining({ status: "UNINVOICED" })));
  });
});
