import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderAs, statusFor } from "./asRole";

// Opening balances: setting the go-live date and posting or reversing any opening entry is accounts.manage. A person
// who may only look still sees every figure that was entered, but no entry grid, no Post and no Reverse / Remove.

const m = vi.hoisted(() => ({
  summary: vi.fn(), setGoLive: vi.fn(),
  accounts: vi.fn(), postAccounts: vi.fn(), reverseAccounts: vi.fn(),
  parties: vi.fn(), postParties: vi.fn(), reverseParty: vi.fn(),
  stock: vi.fn(), postStock: vi.fn(), reverseStock: vi.fn(),
}));
let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));
vi.mock("../../../lib/openingBalanceApi", () => ({ openingBalances: m }));

import OpeningBalances from "../OpeningBalances";

const at = () => renderAs(<MemoryRouter><OpeningBalances /></MemoryRouter>);
const openTab = (name) => fireEvent.mouseDown(screen.getByRole("tab", { name: new RegExp(name) }), { button: 0 });

const GO_LIVE = "2026-06-30T00:00:00.000Z";
const SUMMARY = (over = {}) => ({
  goLive: GO_LIVE, postedAt: null, equity: { id: "obe", accountName: "Opening Balance Equity" },
  sections: {
    accounts: { rows: 0, vouchers: 0, debit: 0, credit: 0, difference: 0 },
    customers: { rows: 0, parties: 0, total: 0, outstanding: 0 },
    vendors: { rows: 0, parties: 0, total: 0, outstanding: 0 },
    stock: { rows: 0, items: 0, vouchers: 0, value: 0 },
  },
  trialBalance: { debit: 0, credit: 0, entries: 0, balanced: true, equity: null },
  stockReconciliation: { available: true, stockValue: 0, ledgerBalance: 0, difference: 0, reconciles: true, account: { name: "Inventory Stock" } },
  warnings: [], missing: [], ...over,
});

const READER = ["accounts.view"];
const MANAGER = ["accounts.view", "accounts.manage"];

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.summary.mockResolvedValue(SUMMARY());
});

describe("opening balances: the go-live date", () => {
  it("shows the date, with nothing to change, to someone who may only look", async () => {
    status = statusFor(READER);
    await at();
    expect(await screen.findByRole("heading", { name: "Opening balances" })).toBeInTheDocument();
    expect(await screen.findByText("How the set-up works")).toBeInTheDocument(); // the date step has loaded
    expect(screen.getByText(/The go-live date is/)).toHaveTextContent("30/06/2026");
    expect(screen.queryByRole("button", { name: /Change date|Set go-live date/ })).toBeNull();
    expect(screen.queryByLabelText(/Go-live date/, { selector: "input" })).toBeNull();
    // moving on to read the next step is not a change
    expect(screen.getByRole("button", { name: "Continue to accounts" })).toBeInTheDocument();
  });

  it("says the date is not set, without a Set button, when none is", async () => {
    m.summary.mockResolvedValue(SUMMARY({ goLive: null }));
    status = statusFor(READER);
    await at();
    expect(await screen.findByText(/The go-live date has not been set yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set go-live date/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue to accounts/ })).toBeNull();
  });

  it("offers the date and its button to someone who holds accounts.manage", async () => {
    m.summary.mockResolvedValue(SUMMARY({ goLive: null }));
    status = statusFor(MANAGER);
    await at();
    expect(await screen.findByRole("button", { name: "Set go-live date" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Go-live date/, { selector: "input[type=text]" })).toBeInTheDocument();
  });

  it("tells a reader that the other steps wait for the date, with no button to choose it", async () => {
    m.summary.mockResolvedValue(SUMMARY({ goLive: null }));
    m.accounts.mockResolvedValue({ goLive: null, equity: null, entered: [], vouchers: [], available: [] });
    status = statusFor(READER);
    await at();
    await screen.findByText(/The go-live date has not been set yet/);
    openTab("Accounts");
    expect(await screen.findByText("The go-live date has not been set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Choose the date/ })).toBeNull();
  });

  it("offers the button to choose the date to someone who holds accounts.manage", async () => {
    m.summary.mockResolvedValue(SUMMARY({ goLive: null }));
    m.accounts.mockResolvedValue({ goLive: null, equity: null, entered: [], vouchers: [], available: [] });
    status = statusFor(MANAGER);
    await at();
    await screen.findByRole("button", { name: "Set go-live date" });
    openTab("Accounts");
    expect(await screen.findByRole("button", { name: /Choose the date/ })).toBeInTheDocument();
  });
});

describe("opening balances: account balances", () => {
  const entered = {
    goLive: GO_LIVE, equity: { id: "obe", accountName: "Opening Balance Equity" },
    entered: [{ accountId: "a1", accountCode: "CASH0001", accountName: "Cash in Hand", debit: 5500, credit: 0, voucherNo: "OBV-2026-0002", voucherId: "v2", source: "opening-balances" }],
    available: [{ _id: "a2", accountCode: "BANK0001", accountName: "Bank Account", category: "ASSET", groupName: "Bank", path: "Bank" }],
    vouchers: [{ _id: "v2", voucherNo: "OBV-2026-0002", date: GO_LIVE, status: "posted", totalDebit: 5500, totalCredit: 0, difference: { amount: 5500, side: "credit" }, lines: [{}] }],
  };

  it("shows what was entered but no entry grid, no Post and no Reverse to someone who may only look", async () => {
    m.accounts.mockResolvedValue(entered);
    status = statusFor(READER);
    await at();
    await screen.findByText("How the set-up works");
    openTab("Accounts");
    expect(await screen.findByText("Cash in Hand")).toBeInTheDocument(); // the entered figures have loaded
    expect(screen.getAllByText("OBV-2026-0002")).toHaveLength(2); // in the entered list and in the vouchers list
    expect(screen.queryByLabelText("Account balances")).toBeNull();
    expect(screen.queryByRole("button", { name: "Post account balances" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reverse" })).toBeNull();
    expect(screen.queryByText(/Ctrl\+Enter posts/)).toBeNull();
  });

  it("offers the grid, Post and Reverse to someone who holds accounts.manage", async () => {
    m.accounts.mockResolvedValue(entered);
    status = statusFor(MANAGER);
    await at();
    await screen.findByText("How the set-up works");
    openTab("Accounts");
    expect(await screen.findByText("Cash in Hand")).toBeInTheDocument();
    expect(screen.getByLabelText("Account balances")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post account balances" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reverse" })).toBeInTheDocument();
  });
});

describe("opening balances: customers and vendors", () => {
  const rows = [
    { _id: "t1", transactionNo: "OSI-2026-0001", partyId: "c1", partyName: "Al Noor", reference: "INV-1001", date: "2026-05-01T00:00:00.000Z", dueDate: null, amount: 100, paid: 0, outstanding: 100, canReverse: true },
    { _id: "t2", transactionNo: "OSI-2026-0002", partyId: "c2", partyName: "Gulf Co", reference: "INV-1002", date: "2026-05-02T00:00:00.000Z", dueDate: null, amount: 200, paid: 50, outstanding: 150, canReverse: false },
  ];
  const parties = { type: "customer", goLive: GO_LIVE, rows, totals: { count: 2, parties: 2, amount: 300, paid: 50, outstanding: 250 }, available: [{ _id: "c3", code: "C3", name: "New Co", paymentTerms: "" }] };

  it("shows the entered invoices but no entry grid, no Post and no Remove to someone who may only look", async () => {
    m.parties.mockResolvedValue(parties);
    status = statusFor(READER);
    await at();
    await screen.findByText("How the set-up works");
    openTab("Customers");
    expect(await screen.findByText("OSI-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("OSI-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Settled in part")).toBeInTheDocument(); // a fact about the invoice, not an action
    expect(screen.queryByLabelText("Customer open invoices")).toBeNull();
    expect(screen.queryByRole("button", { name: "Post opening invoices" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove OSI-2026-0001" })).toBeNull();
  });

  it("offers the grid, Post and Remove to someone who holds accounts.manage", async () => {
    m.parties.mockResolvedValue(parties);
    status = statusFor(MANAGER);
    await at();
    await screen.findByText("How the set-up works");
    openTab("Customers");
    expect(await screen.findByText("OSI-2026-0001")).toBeInTheDocument();
    expect(screen.getByLabelText("Customer open invoices")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post opening invoices" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove OSI-2026-0001" })).toBeInTheDocument();
  });

  it("is the same for vendors", async () => {
    m.parties.mockResolvedValue({ ...parties, type: "vendor" });
    status = statusFor(READER);
    await at();
    await screen.findByText("How the set-up works");
    openTab("Vendors");
    expect(await screen.findByText("OSI-2026-0001")).toBeInTheDocument();
    expect(screen.queryByLabelText("Vendor open invoices")).toBeNull();
    expect(screen.queryByRole("button", { name: "Post opening invoices" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove OSI-2026-0001" })).toBeNull();
  });
});

describe("opening balances: stock", () => {
  const row = { itemName: "Rice", qty: 10, unitCost: 5, value: 50, batchNumber: "R-B1", expiryDate: null };
  const stock = {
    goLive: GO_LIVE,
    items: [{ _id: "i1", itemId: "RICE", sku: "RICE", itemName: "Rice", unit: "KG", currentStock: 0, batchTracked: false, entered: false, canEnter: true, reason: "" }],
    vouchers: [
      { _id: "s1", voucherNo: "OST-2026-0001", date: GO_LIVE, status: "posted", totalValue: 50, rows: [row], canReverse: true, blockedBy: [] },
      { _id: "s2", voucherNo: "OST-2026-0002", date: GO_LIVE, status: "posted", totalValue: 60, rows: [row], canReverse: false, blockedBy: ["Rice"] },
    ],
  };

  it("shows the vouchers but no entry grid, no Post and no Reverse to someone who may only look", async () => {
    m.stock.mockResolvedValue(stock);
    status = statusFor(READER);
    await at();
    await screen.findByText("How the set-up works");
    openTab("Stock");
    expect(await screen.findByText("OST-2026-0001")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Rows of OST-2026-0001" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Opening stock")).toBeNull();
    expect(screen.queryByRole("button", { name: "Post opening stock" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reverse" })).toBeNull();
    expect(screen.queryByText(/Cannot be reversed/)).toBeNull();
  });

  it("offers the grid, Post and Reverse to someone who holds accounts.manage", async () => {
    m.stock.mockResolvedValue(stock);
    status = statusFor(MANAGER);
    await at();
    await screen.findByText("How the set-up works");
    openTab("Stock");
    expect(await screen.findByText("OST-2026-0001")).toBeInTheDocument();
    expect(screen.getByLabelText("Opening stock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post opening stock" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reverse" })).toBeInTheDocument();
    expect(screen.getByText(/Cannot be reversed/)).toBeInTheDocument();
  });
});
