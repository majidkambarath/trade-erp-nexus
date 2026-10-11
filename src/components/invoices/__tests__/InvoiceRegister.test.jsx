import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

const m = vi.hoisted(() => ({ get: vi.fn(), navigate: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get } }));
vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => m.navigate }));

import { SalesInvoices, PurchaseInvoices } from "../InvoiceRegister";

// Dated today so the default period (this calendar month) always holds them.
const today = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
const past = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10) + "T00:00:00.000Z";
const tx = (over = {}) => ({
  _id: over.transactionNo || "x", partyId: "c1", partyName: "Al Noor Trading", type: "sales_order", date: today, dueDate: null,
  status: "APPROVED", totalAmount: 1000, paidAmount: 0, outstandingAmount: 1000, isOpening: false, ...over,
});
const DOCS = [
  tx({ transactionNo: "SO-2026-0001", totalAmount: 1000, paidAmount: 1000, outstandingAmount: 0 }),
  tx({ transactionNo: "SO-2026-0002", partyId: "c2", partyName: "Bright Star", totalAmount: 600, paidAmount: 200, outstandingAmount: 400, dueDate: past }),
  tx({ transactionNo: "SO-2026-0003", totalAmount: 500, paidAmount: 0, outstandingAmount: 500 }),
  tx({ transactionNo: "SO-2026-0004", status: "DRAFT", totalAmount: 300, paidAmount: 0, outstandingAmount: 300 }),
  tx({ transactionNo: "SO-2026-0005", status: "REJECTED", totalAmount: 900 }),
];

// No stored due date, as on nearly every document: it falls due on its date plus the party's terms (the ageing report's rule).
const OLD = tx({ transactionNo: "SO-2026-0006", date: past, totalAmount: 100, paidAmount: 0, outstandingAmount: 100, party: { paymentTerms: "Net 30" } }); // due 10 days ago
const FRESH = tx({ transactionNo: "SO-2026-0007", totalAmount: 100, paidAmount: 0, outstandingAmount: 100, party: { paymentTerms: "Net 30" } }); // due in 30 days
const OLD_PAID = tx({ transactionNo: "SO-2026-0008", date: past, totalAmount: 100, paidAmount: 100, outstandingAmount: 0, party: { paymentTerms: "Net 30" } });

const show = (Component = SalesInvoices, rows = DOCS) => {
  m.get.mockResolvedValue({ data: { data: rows, pagination: { total: rows.length, pages: 1 } } });
  return render(<MemoryRouter><Component /></MemoryRouter>);
};
const table = () => screen.getByRole("table", { name: /invoices/i });

beforeEach(() => { m.get.mockReset(); m.navigate.mockReset(); });

describe("the invoice register", () => {
  it("asks for the right kind of document", async () => {
    show();
    await screen.findByText("SO-2026-0001");
    expect(m.get.mock.calls[0][1].params.type).toBe("sales_order");
    m.get.mockClear();
    render(<MemoryRouter><PurchaseInvoices /></MemoryRouter>);
    await waitFor(() => expect(m.get).toHaveBeenCalled());
    expect(m.get.mock.calls[0][1].params.type).toBe("purchase_order");
  });

  it("lists confirmed invoices by default, with what is paid, what is open and the payment state", async () => {
    show();
    await screen.findByText("SO-2026-0001");
    const t = within(table());
    expect(t.getByText("SO-2026-0002")).toBeInTheDocument();
    expect(t.queryByText("SO-2026-0004")).not.toBeInTheDocument(); // a draft is not an invoice that counts
    expect(t.queryByText("SO-2026-0005")).not.toBeInTheDocument(); // nor a rejected one

    const row = t.getByText("SO-2026-0002").closest("tr");
    expect(within(row).getByText("Partly paid")).toBeInTheDocument();
    expect(within(row).getByText("200.00")).toBeInTheDocument();
    expect(within(row).getByText("400.00")).toBeInTheDocument();
    expect(within(row).getByText(/past due/)).toBeInTheDocument();
    expect(within(t.getByText("SO-2026-0001").closest("tr")).getByText("Paid")).toBeInTheDocument();
    expect(within(t.getByText("SO-2026-0003").closest("tr")).getByText("Unpaid")).toBeInTheDocument();
  });

  it("totals only the confirmed invoices: invoiced, received, outstanding and past due", async () => {
    show();
    await screen.findByText("SO-2026-0001");
    // 1000 + 600 + 500 invoiced; 1000 + 200 received; 0 + 400 + 500 open; 400 of it past due
    expect(screen.getByText("2,100.00")).toBeInTheDocument();
    expect(screen.getByText("1,200.00")).toBeInTheDocument();
    expect(screen.getByText("900.00")).toBeInTheDocument();
    expect(screen.getByText(/1 invoice past the due date/)).toBeInTheDocument();
  });

  it("works the due date out from the party's terms when none is stored, and only calls an unpaid invoice past due", async () => {
    show(SalesInvoices, [OLD, FRESH, OLD_PAID]);
    await screen.findByText("SO-2026-0007");
    // the default period is this calendar month; the 40-day-old ones sit before it, so look at all time
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "all" } });
    const t = within(table());
    const rowOf = (no) => t.getByText(no).closest("tr");
    expect(within(rowOf("SO-2026-0006")).getByText(/past due/)).toBeInTheDocument();
    expect(within(rowOf("SO-2026-0008")).queryByText(/past due/)).not.toBeInTheDocument(); // old, but paid
    expect(within(rowOf("SO-2026-0007")).queryByText(/past due/)).not.toBeInTheDocument();
    // both the invoice date and a due date are shown, though nothing is stored on the document
    expect(within(rowOf("SO-2026-0007")).getAllByText(/\d{2}\/\d{2}\/\d{4}/)).toHaveLength(2);
  });

  it("filters by payment state", async () => {
    show();
    await screen.findByText("SO-2026-0001");
    fireEvent.change(screen.getByLabelText("Payment"), { target: { value: "UNPAID" } });
    expect(within(table()).getByText("SO-2026-0003")).toBeInTheDocument();
    expect(within(table()).queryByText("SO-2026-0001")).not.toBeInTheDocument();
    expect(within(table()).queryByText("SO-2026-0002")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Payment"), { target: { value: "PAID" } });
    expect(within(table()).getByText("SO-2026-0001")).toBeInTheDocument();
    expect(within(table()).queryByText("SO-2026-0003")).not.toBeInTheDocument();
  });

  it("filters by customer and by search", async () => {
    show();
    await screen.findByText("SO-2026-0001");
    fireEvent.change(screen.getByLabelText("Customer"), { target: { value: "c2" } });
    expect(within(table()).getByText("SO-2026-0002")).toBeInTheDocument();
    expect(within(table()).queryByText("SO-2026-0001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.change(screen.getByLabelText("Search invoices"), { target: { value: "0003" } });
    expect(within(table()).getByText("SO-2026-0003")).toBeInTheDocument();
    expect(within(table()).queryByText("SO-2026-0001")).not.toBeInTheDocument();
  });

  it("shows drafts on their own tab and says they are not in the accounts", async () => {
    show();
    await screen.findByText("SO-2026-0001");
    fireEvent.click(screen.getByRole("tab", { name: /^draft/i }));
    const t = within(table());
    expect(t.getByText("SO-2026-0004")).toBeInTheDocument();
    expect(t.queryByText("SO-2026-0001")).not.toBeInTheDocument();
    expect(t.getByText(/not in accounts/i)).toBeInTheDocument();
    expect(screen.getByText(/A draft is not in the accounts/)).toBeInTheDocument();
    // a draft has no payment state and is not totalled
    expect(t.queryByText("Unpaid")).not.toBeInTheDocument();
  });

  it("opens the document from its row", async () => {
    show();
    await screen.findByText("SO-2026-0001");
    fireEvent.click(within(table()).getByText("SO-2026-0003"));
    expect(m.navigate).toHaveBeenCalledWith("/sales-order?search=SO-2026-0003");
  });

  it("is the purchase register for vendors: Paid, not Received", async () => {
    show(PurchaseInvoices, [tx({ transactionNo: "PO-2026-0001", type: "purchase_order", partyName: "Gulf Grain", totalAmount: 17850, paidAmount: 5000, outstandingAmount: 12850 })]);
    await screen.findByText("PO-2026-0001");
    expect(screen.getByRole("heading", { name: "Purchase invoices" })).toBeInTheDocument();
    expect(screen.getByLabelText("Vendor")).toBeInTheDocument();
    expect(within(within(table()).getByText("PO-2026-0001").closest("tr")).getByText("Partly paid")).toBeInTheDocument();
    fireEvent.click(within(table()).getByText("PO-2026-0001"));
    expect(m.navigate).toHaveBeenCalledWith("/purchase-order?search=PO-2026-0001");
  });
});
