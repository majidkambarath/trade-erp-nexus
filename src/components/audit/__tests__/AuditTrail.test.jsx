import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({ audit: vi.fn() }));
const v = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("../../../lib/accountingApi", () => ({ documents: m }));
vi.mock("../../../lib/bankingApi", () => ({ vouchers: v }));

import DocumentAuditTrail, { VoucherAuditTrail } from "../AuditTrail";

const TRAIL = {
  document: {
    _id: "t1", transactionNo: "SO-2026-0001", type: "sales_order", typeLabel: "Sales order",
    status: "APPROVED", date: "2026-10-04T00:00:00.000Z", totalAmount: 1312.5, paidAmount: 312.5,
    outstandingAmount: 1000, items: 1, isOpening: false,
  },
  party: { _id: "c1", type: "Customer", name: "QA Customer 46912" },
  ledger: {
    postingEnabled: true, posted: true, isReversed: false, reversedAt: null, note: null,
    entries: [
      { _id: "l1", accountCode: "ARA0001", accountName: "Customer - QA Customer 46912", debit: 1312.5, credit: 0, narration: "sales order SO-2026-0001" },
      { _id: "l2", accountCode: "INC0001", accountName: "Sales Revenue", debit: 0, credit: 1250, narration: "" },
      { _id: "l3", accountCode: "TAXL0001", accountName: "Output VAT", debit: 0, credit: 62.5, narration: "" },
    ],
    reversals: [],
    totals: { debit: 1312.5, credit: 1312.5 },
    balanced: true,
  },
  stock: {
    movements: [
      { _id: "m1", itemId: "RICE5", itemName: "Rice 5kg", eventType: "SALES_DISPATCH", quantity: -5,
        previousStock: 100, newStock: 95, unitCost: 9.2, totalValue: 46, cogsAmount: 46, costBasis: "sale",
        batchNumber: "LOT-1", date: "2026-10-04T00:00:00.000Z", isReversed: false },
    ],
  },
  partyBalance: {
    rows: [{ _id: "p1", type: "sales_order", date: "2026-10-04T00:00:00.000Z", invNo: "SO-2026-0001", amount: -1312.5, paid: 0, balance: -1312.5, status: "UNPAID", isReversal: false }],
  },
  settlements: [
    { _id: "v1", voucherNo: "RV-2026-0004", voucherType: "receipt", date: "2026-10-05T00:00:00.000Z", paymentMode: "bank", status: "approved", allocatedAmount: 312.5, previousBalance: 1312.5, newBalance: 1000 },
  ],
  einvoice: null,
  activity: [
    { _id: "a1", at: "2026-10-04T06:00:00.000Z", action: "TRANSACTION_CREATED", username: "boss@test.uae", summary: "Sales order SO-2026-0001 - 1312.50 saved as DRAFT", before: null, after: { status: "DRAFT" } },
    { _id: "a2", at: "2026-10-04T06:05:00.000Z", action: "TRANSACTION_APPROVED", username: "boss@test.uae", summary: "Sales order SO-2026-0001 - 1312.50 approved - 3 ledger entries, 1 stock movements, 1 party balance rows", before: null, after: { effects: { ledgerEntries: 3 } } },
  ],
};

const open = () => render(<DocumentAuditTrail id="t1" documentNo="SO-2026-0001" onClose={() => {}} />);
const section = (title) => screen.getByRole("heading", { name: title }).closest("section");

beforeEach(() => { m.audit.mockReset(); v.audit.mockReset(); });

describe("a document's audit trail", () => {
  it("shows the double entry it posted, with totals that balance", async () => {
    m.audit.mockResolvedValue(TRAIL);
    open();

    const ledger = await waitFor(() => section("Financial effect"));
    expect(within(ledger).getByText("Sales Revenue")).toBeInTheDocument();
    expect(within(ledger).getByText("Customer - QA Customer 46912")).toBeInTheDocument();
    const total = within(ledger).getByText("Total").closest("tr");
    expect(within(total).getAllByText("1,312.50")).toHaveLength(2);
    expect(within(ledger).getByText("Debits equal credits")).toBeInTheDocument();
  });

  it("shows the stock it moved, the party balance it changed and the money that settled it", async () => {
    m.audit.mockResolvedValue(TRAIL);
    open();

    const stock = await waitFor(() => section("Stock movement"));
    expect(within(stock).getByText("Rice 5kg")).toBeInTheDocument();
    expect(within(stock).getByText("Dispatched")).toBeInTheDocument();
    const moved = within(stock).getByText("Rice 5kg").closest("tr");
    expect(moved.textContent).toContain("-5");
    expect(moved.textContent).toMatch(/100\s*→\s*95/);
    expect(moved.textContent).toContain("cost of sale");

    const party = section("Customer balance");
    const entry = within(party).getByText("Sale").closest("tr");
    expect(entry.textContent).toContain("-1,312.50");
    expect(within(party).getByText("Unpaid")).toBeInTheDocument();

    const settled = section("Settled by");
    expect(within(settled).getByText("RV-2026-0004")).toBeInTheDocument();
    expect(within(settled).getByText("312.50")).toBeInTheDocument();
  });

  it("lists who did what, and opens the before/after of an entry", async () => {
    m.audit.mockResolvedValue(TRAIL);
    open();

    const trail = await waitFor(() => section("Audit trail"));
    expect(within(trail).getByText("CREATED")).toBeInTheDocument();
    expect(within(trail).getByText("APPROVED")).toBeInTheDocument();
    expect(within(trail).queryByText(/"effects"/)).not.toBeInTheDocument();

    fireEvent.click(within(trail).getByRole("button", { name: /Show details of TRANSACTION_APPROVED/i }));
    expect(within(trail).getByText(/"ledgerEntries": 3/)).toBeInTheDocument();
  });

  it("says why a draft has no financial effect instead of showing an empty table", async () => {
    m.audit.mockResolvedValue({
      ...TRAIL,
      document: { ...TRAIL.document, status: "DRAFT" },
      ledger: { ...TRAIL.ledger, posted: false, entries: [], totals: { debit: 0, credit: 0 }, note: "Nothing is posted until the document is approved." },
      stock: { movements: [] },
      partyBalance: { rows: [] },
      settlements: [],
      activity: [],
    });
    open();

    const ledger = await waitFor(() => section("Financial effect"));
    expect(within(ledger).getByText(/Nothing is posted until the document is approved/)).toBeInTheDocument();
    expect(within(ledger).queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stock movement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Settled by" })).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing logged for this document yet/)).toBeInTheDocument();
  });

  it("marks a reversed posting and keeps the reversing entries behind a toggle", async () => {
    m.audit.mockResolvedValue({
      ...TRAIL,
      ledger: {
        ...TRAIL.ledger,
        isReversed: true,
        reversals: [{ _id: "r1", accountCode: "INC0001", accountName: "Sales Revenue", debit: 1250, credit: 0, narration: "Reversal: sales order SO-2026-0001" }],
      },
    });
    open();

    const ledger = await waitFor(() => section("Financial effect"));
    expect(within(ledger).getByText("Reversed")).toBeInTheDocument();
    const toggle = within(ledger).getByRole("button", { name: /1 reversing entry/ });
    expect(ledger.querySelectorAll("table")).toHaveLength(1);
    fireEvent.click(toggle);
    expect(ledger.querySelectorAll("table")).toHaveLength(2);
  });
});

const VOUCHER = {
  voucher: {
    _id: "v1", voucherNo: "RV-2026-0004", voucherType: "receipt", typeLabel: "Receipt",
    date: "2026-10-05T00:00:00.000Z", status: "approved", totalAmount: 1312.5, onAccountAmount: 0,
    partyName: "QA Customer 46912", partyType: "Customer", paymentMode: "cheque",
    paymentAccountName: "Cheques in Hand", narration: "Settled in full", ledgerBased: true,
    currency: null, exchangeRate: null,
  },
  ledger: {
    postingEnabled: true, posted: true, isReversed: false, reversedAt: null, note: null,
    entries: [
      { _id: "e1", accountCode: "CHQ0001", accountName: "Cheques in Hand", debit: 1312.5, credit: 0, narration: "" },
      { _id: "e2", accountCode: "ARA0001", accountName: "Customer - QA Customer 46912", debit: 0, credit: 1312.5, narration: "" },
    ],
    reversals: [], totals: { debit: 1312.5, credit: 1312.5 }, balanced: true,
  },
  allocations: [
    { invoiceId: "d2", transactionNo: "SO-2026-0002", typeLabel: "Sales order", date: "2026-10-04T00:00:00.000Z",
      invoiceTotal: 1312.5, allocatedAmount: 1312.5, previousBalance: 1312.5, newBalance: 0, outstandingNow: 0, status: "APPROVED" },
  ],
  onAccount: 0,
  cheque: {
    _id: "c1", chequeNo: "001234", chequeDate: "2026-11-01T00:00:00.000Z", amount: 1312.5, status: "pending",
    direction: "receipt", isPDC: true, drawnOnBankName: "Emirates NBD", clearedOn: null, bouncedOn: null, reason: null,
    history: [{ status: "pending", at: "2026-10-05T06:00:00.000Z", by: "boss@test.uae", note: "" }],
  },
  activity: [
    { _id: "va1", at: "2026-10-05T06:00:00.000Z", action: "VOUCHER_CREATED", username: "boss@test.uae",
      summary: "Receipt RV-2026-0004 - 1312.50 saved", before: null, after: { effects: { ledgerEntries: 2, cheques: 1 } } },
  ],
};

describe("a voucher's audit trail", () => {
  const openVoucher = () => render(<VoucherAuditTrail id="v1" voucherNo="RV-2026-0004" onClose={() => {}} />);

  it("shows the double entry, what it was set against, and its cheque", async () => {
    v.audit.mockResolvedValue(VOUCHER);
    openVoucher();

    const ledger = await waitFor(() => section("Financial effect"));
    expect(within(ledger).getByText("Cheques in Hand")).toBeInTheDocument();
    expect(within(ledger).getByText("Debits equal credits")).toBeInTheDocument();

    const against = section("Set against");
    const row = within(against).getByText("SO-2026-0002").closest("tr");
    expect(row.textContent).toMatch(/1,312\.50\s*→\s*0\.00/);

    const cheque = section("Cheque");
    expect(within(cheque).getByText("001234")).toBeInTheDocument();
    expect(within(cheque).getByText("Pending")).toBeInTheDocument();
    expect(cheque.textContent).toContain("post-dated");

    const trail = section("Audit trail");
    expect(within(trail).getByText("CREATED")).toBeInTheDocument();

    // an approved voucher reads "Posted" here, as it does on every other finance screen
    expect(screen.getByText("Posted")).toBeInTheDocument();
  });

  it("says what was left on account, and says why a pending voucher posted nothing", async () => {
    v.audit.mockResolvedValue({
      ...VOUCHER,
      voucher: { ...VOUCHER.voucher, status: "pending", onAccountAmount: 500 },
      ledger: { ...VOUCHER.ledger, posted: false, entries: [], totals: { debit: 0, credit: 0 }, note: "Nothing is posted until the voucher is approved." },
      allocations: [], onAccount: 500, cheque: null,
    });
    openVoucher();

    const ledger = await waitFor(() => section("Financial effect"));
    expect(within(ledger).getByText(/Nothing is posted until the voucher is approved/)).toBeInTheDocument();
    expect(within(ledger).queryByRole("table")).not.toBeInTheDocument();
    expect(section("Set against").textContent).toMatch(/500\.00 was left on account/);
    expect(screen.queryByRole("heading", { name: "Cheque" })).not.toBeInTheDocument();
  });
});
