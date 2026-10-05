import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({
  summary: vi.fn(), setGoLive: vi.fn(),
  accounts: vi.fn(), postAccounts: vi.fn(), reverseAccounts: vi.fn(),
  parties: vi.fn(), postParties: vi.fn(), reverseParty: vi.fn(),
  stock: vi.fn(), postStock: vi.fn(), reverseStock: vi.fn(),
}));
vi.mock("../../../lib/openingBalanceApi", () => ({ openingBalances: m }));

import OpeningBalances from "../OpeningBalances";

const at = () => render(<MemoryRouter><OpeningBalances /></MemoryRouter>);
const openTab = (name) => fireEvent.mouseDown(screen.getByRole("tab", { name: new RegExp(name) }), { button: 0 });
const box = (name) => screen.getByRole("combobox", { name });
const choose = async (name, text) => {
  fireEvent.keyDown(box(name), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(text) }));
};
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

const GO_LIVE = "2026-06-30T00:00:00.000Z";
const SUMMARY = (over = {}) => ({
  goLive: GO_LIVE, postedAt: null, equity: { id: "obe", accountName: "Opening Balance Equity" },
  sections: {
    accounts: { rows: 0, vouchers: 0, debit: 0, credit: 0, difference: 0 },
    customers: { rows: 0, parties: 0, total: 0, outstanding: 0 },
    vendors: { rows: 0, parties: 0, total: 0, outstanding: 0 },
    stock: { rows: 0, items: 0, vouchers: 0, value: 0 },
  },
  trialBalance: { debit: 0, credit: 0, entries: 0, balanced: true, equity: { accountName: "Opening Balance Equity", openingBalance: 0, balance: 0 } },
  stockReconciliation: { available: true, stockValue: 0, ledgerBalance: 0, difference: 0, reconciles: true, account: { name: "Inventory Stock" } },
  warnings: [], missing: [], ...over,
});

const ACCOUNT = (over) => ({ _id: "a1", accountCode: "CASH0001", accountName: "Cash in Hand", category: "ASSET", groupName: "Cash", path: "Current Assets › Cash", ...over });
const ACCOUNTS = (over = {}) => ({
  goLive: GO_LIVE, equity: { id: "obe", accountName: "Opening Balance Equity" }, entered: [], vouchers: [],
  available: [ACCOUNT(), ACCOUNT({ _id: "a2", accountCode: "BANK0001", accountName: "Bank Account", groupName: "Bank" }), ACCOUNT({ _id: "a3", accountCode: "LTL0001", accountName: "Bank Loan", category: "LIABILITY" })],
  ...over,
});

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.summary.mockResolvedValue(SUMMARY());
});

describe("opening balances: go-live date", () => {
  it("asks for the date, warns about earlier activity, and saves the chosen date", async () => {
    m.summary.mockResolvedValue(SUMMARY({ goLive: null, warnings: [{ code: "TRANSACTIONS_BEFORE_GO_LIVE", message: "3 approved documents are dated before the go-live date." }] }));
    m.setGoLive.mockResolvedValue({ date: "2026-07-01T00:00:00.000Z", warnings: [] });
    at();
    expect(await screen.findByRole("heading", { name: "Opening balances" })).toBeInTheDocument();
    expect(screen.getByText(/3 approved documents are dated before/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set go-live date" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Go-live date/, { selector: "input[type=text]" }), { target: { value: "01/07/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Set go-live date" }));
    await waitFor(() => expect(m.setGoLive).toHaveBeenCalledWith("2026-07-01"));
    expect(await screen.findByText(/Go-live date set to 01\/07\/2026/)).toBeInTheDocument();
  });

  it("the other steps wait for the date", async () => {
    m.summary.mockResolvedValue(SUMMARY({ goLive: null }));
    m.accounts.mockResolvedValue(ACCOUNTS());
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Accounts");
    expect(await screen.findByText("Choose the go-live date first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Choose the date/ }));
    expect(await screen.findByText("How the set-up works")).toBeInTheDocument();
  });

  it("the date is fixed once opening entries exist", async () => {
    m.summary.mockResolvedValue(SUMMARY({ sections: { ...SUMMARY().sections, customers: { rows: 2, parties: 1, total: 10, outstanding: 10 } } }));
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    expect(screen.getByLabelText(/Go-live date/, { selector: "input[type=text]" })).toBeDisabled();
    expect(screen.getByText(/Opening entries are already posted, dated 30\/06\/2026/)).toBeInTheDocument();
  });
});

describe("opening balances: accounts", () => {
  it("shows the balancing line to Opening Balance Equity, states the consequence, and posts the lines", async () => {
    m.accounts.mockResolvedValue(ACCOUNTS());
    m.postAccounts.mockResolvedValue({ _id: "v1", voucherNo: "OBV-2026-0001", lines: 2 });
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Accounts");
    await screen.findByLabelText("Account balances");

    await choose("Account, row 1", "Cash in Hand");
    type("Debit, row 1", "1000");
    await choose("Account, row 2", "Bank Loan");
    type("Credit, row 2", "400");

    // 1,000.00 debit against 400.00 credit: equity takes the 600.00 credit
    const table = screen.getByRole("table", { name: "Account balances" });
    const line = within(table).getByText(/Balancing line to/).closest("tr");
    expect(line).toHaveTextContent("Opening Balance Equity");
    expect(line).toHaveTextContent("(credit)");
    expect(line).toHaveTextContent("600.00");
    expect(screen.getByText(/will be posted to Opening Balance Equity as a credit/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Post account balances" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("2 accounts will be posted as one voucher dated 30/06/2026");
    expect(dialog).toHaveTextContent("debits 1,000.00, credits 400.00");
    expect(dialog).toHaveTextContent("The difference of 600.00 goes to Opening Balance Equity as a credit");
    expect(m.postAccounts).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Post balances" }));
    await waitFor(() => expect(m.postAccounts).toHaveBeenCalledWith({
      date: "2026-06-30", lines: [{ accountId: "a1", debit: 1000, credit: 0 }, { accountId: "a3", debit: 0, credit: 400 }],
    }));
    expect(await screen.findByText(/OBV-2026-0001 posted: 2 account balances/)).toBeInTheDocument();
    await waitFor(() => expect(m.summary).toHaveBeenCalledTimes(2)); // the page reloads its totals
  });

  it("does not post a row without an account or an amount, and a debit and credit together are refused", async () => {
    m.accounts.mockResolvedValue(ACCOUNTS());
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Accounts");
    await screen.findByLabelText("Account balances");
    expect(screen.getByRole("button", { name: "Post account balances" })).toBeDisabled();

    type("Debit, row 1", "50");
    fireEvent.click(screen.getByRole("button", { name: "Post account balances" }));
    expect(await screen.findByText("Row 1: Choose an account")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(m.postAccounts).not.toHaveBeenCalled();
  });

  it("lists the accounts already entered with their amounts, read-only, and reverses a voucher after asking", async () => {
    m.accounts.mockResolvedValue(ACCOUNTS({
      entered: [
        { accountId: "a1", accountCode: "CASH0001", accountName: "Cash in Hand", debit: 5500, credit: 0, voucherNo: "OBV-2026-0002", voucherId: "v2", source: "opening-balances" },
        { accountId: "a9", accountCode: "BANK0009", accountName: "ENBD Savings", debit: 100, credit: 0, voucherNo: "OB-BANK0009", voucherId: null, source: "account-created" },
      ],
      available: [ACCOUNT({ _id: "a2", accountCode: "BANK0001", accountName: "Bank Account" })],
      vouchers: [{ _id: "v2", voucherNo: "OBV-2026-0002", date: GO_LIVE, status: "posted", totalDebit: 5500, totalCredit: 0, difference: { amount: 5500, side: "credit" }, lines: [{}] }],
    }));
    m.reverseAccounts.mockResolvedValue({ _id: "v2", voucherNo: "OBV-2026-0002", status: "reversed" });
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Accounts");
    const entered = (await screen.findByText("Already entered")).closest("section");
    expect(within(entered).getByText("Cash in Hand")).toBeInTheDocument();
    expect(within(entered).getByText("5,500.00")).toBeInTheDocument();
    expect(within(entered).getByText("Set when the account was created")).toBeInTheDocument();
    expect(within(entered).getAllByRole("link", { name: "Open ledger" })).toHaveLength(2);

    // an entered account is not offered again
    fireEvent.keyDown(box("Account, row 1"), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: /Bank Account/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Cash in Hand/ })).toBeNull();
    fireEvent.keyDown(box("Account, row 1"), { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Reverse" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Reverse OBV-2026-0002?");
    expect(dialog).toHaveTextContent("taken out of the ledger");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reverse voucher" }));
    await waitFor(() => expect(m.reverseAccounts).toHaveBeenCalledWith("v2"));
    expect(await screen.findByText("OBV-2026-0002 reversed")).toBeInTheDocument();
  });

  it("shows the server's refusal and leaves the entered rows alone", async () => {
    m.accounts.mockResolvedValue(ACCOUNTS());
    m.postAccounts.mockRejectedValue(Object.assign(new Error("Cash in Hand already has an opening balance."), { code: "ALREADY_HAS_OPENING" }));
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Accounts");
    await screen.findByLabelText("Account balances");
    await choose("Account, row 1", "Cash in Hand");
    type("Debit, row 1", "10");
    fireEvent.click(screen.getByRole("button", { name: "Post account balances" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Post balances" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cash in Hand already has an opening balance.");
    expect(screen.getByLabelText("Debit, row 1")).toHaveValue("10");
  });
});

const PARTIES = (over = {}) => ({
  type: "customer", goLive: GO_LIVE, rows: [], totals: { count: 0, parties: 0, amount: 0, paid: 0, outstanding: 0 },
  available: [{ _id: "c1", code: "C1", name: "Al Noor", paymentTerms: "Net 30" }, { _id: "c2", code: "C2", name: "Gulf Co", paymentTerms: "" }], ...over,
});

describe("opening balances: customers and vendors", () => {
  it("posts invoices with their dates, and a row with no invoice number as a lump sum", async () => {
    m.parties.mockResolvedValue(PARTIES());
    m.postParties.mockResolvedValue({ count: 2, total: 1950.5, created: [] });
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Customers");
    await screen.findByLabelText("Customer open invoices");

    await choose("Customer, row 1", "Al Noor");
    type("Invoice no., row 1", "INV-1001");
    type("Invoice date, row 1", "01/05/2026");
    type("Due date, row 1", "31/05/2026");
    type("Amount, row 1", "1,200.50");
    await choose("Customer, row 2", "Gulf Co");
    type("Amount, row 2", "750");
    expect(screen.getByText("Total (2 invoices)").closest("tr")).toHaveTextContent("1,950.50");

    fireEvent.click(screen.getByRole("button", { name: "Post opening invoices" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("2 opening invoices for 2 customers, total 1,950.50");
    expect(dialog).toHaveTextContent("against Opening Balance Equity (credit)");
    expect(dialog).toHaveTextContent("no stock, VAT or e-invoice");
    fireEvent.click(within(dialog).getByRole("button", { name: "Post invoices" }));
    await waitFor(() => expect(m.postParties).toHaveBeenCalledWith({
      type: "customer", date: "2026-06-30",
      rows: [{ partyId: "c1", reference: "INV-1001", date: "2026-05-01", dueDate: "2026-05-31", amount: 1200.5 }, { partyId: "c2", amount: 750 }],
    }));
    expect(await screen.findByText(/2 opening invoices posted, total 1,950.50/)).toBeInTheDocument();
  });

  it("catches a repeated invoice before asking the server", async () => {
    m.parties.mockResolvedValue(PARTIES({ rows: [{ _id: "t1", transactionNo: "OSI-2026-0001", partyId: "c1", partyName: "Al Noor", reference: "INV-1001", date: GO_LIVE, dueDate: null, amount: 10, paid: 0, outstanding: 10, canReverse: true }], totals: { count: 1, parties: 1, amount: 10, paid: 0, outstanding: 10 } }));
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Customers");
    await screen.findByLabelText("Customer open invoices");
    await choose("Customer, row 1", "Al Noor");
    type("Invoice no., row 1", "INV-1001");
    type("Amount, row 1", "5");
    fireEvent.click(screen.getByRole("button", { name: "Post opening invoices" }));
    expect(await screen.findByText("Row 1: Invoice INV-1001 is already entered")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(m.postParties).not.toHaveBeenCalled();
  });

  it("lists the entered invoices with their paid and outstanding amounts, and removes one that is untouched", async () => {
    m.parties.mockResolvedValue(PARTIES({
      rows: [
        { _id: "t1", transactionNo: "OSI-2026-0001", partyId: "c1", partyName: "Al Noor", reference: "INV-1001", date: "2026-05-01T00:00:00.000Z", dueDate: "2026-06-10T00:00:00.000Z", amount: 1200.5, paid: 700.5, outstanding: 500, canReverse: false },
        { _id: "t2", transactionNo: "OSI-2026-0002", partyId: "c2", partyName: "Gulf Co", reference: "", date: GO_LIVE, dueDate: null, amount: 750, paid: 0, outstanding: 750, canReverse: true },
      ],
      totals: { count: 2, parties: 2, amount: 1950.5, paid: 700.5, outstanding: 1250 },
    }));
    m.reverseParty.mockResolvedValue({ _id: "t2", transactionNo: "OSI-2026-0002", removed: true });
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Customers");
    const table = (await screen.findByText("OSI-2026-0001")).closest("table");
    const first = within(table).getByText("OSI-2026-0001").closest("tr");
    expect(first).toHaveTextContent("01/05/2026");
    expect(first).toHaveTextContent("10/06/2026");
    expect(first).toHaveTextContent("1,200.50");
    expect(first).toHaveTextContent("700.50");
    expect(first).toHaveTextContent("500.00");
    expect(first).toHaveTextContent("Settled in part");
    expect(within(first).queryByRole("button")).toBeNull();
    const lump = within(table).getByText("OSI-2026-0002").closest("tr");
    expect(lump).toHaveTextContent("Opening balance");
    expect(lump).toHaveTextContent("By terms");

    fireEvent.click(within(lump).getByRole("button", { name: "Remove OSI-2026-0002" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("taken out of the ledger and off the customer's balance");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove invoice" }));
    await waitFor(() => expect(m.reverseParty).toHaveBeenCalledWith("t2"));
  });

  it("vendors are the same screen the other way round", async () => {
    m.parties.mockResolvedValue(PARTIES({ type: "vendor", available: [{ _id: "v1", code: "V1", name: "Gulf Mills", paymentTerms: "Net 45" }] }));
    m.postParties.mockResolvedValue({ count: 1, total: 3000, created: [] });
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Vendors");
    await screen.findByLabelText("Vendor open invoices");
    expect(m.parties).toHaveBeenCalledWith("vendor");
    await choose("Vendor, row 1", "Gulf Mills");
    type("Invoice no., row 1", "INV-V-77");
    type("Amount, row 1", "3000");
    fireEvent.click(screen.getByRole("button", { name: "Post opening invoices" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("against Opening Balance Equity (debit)");
    expect(dialog).toHaveTextContent("approved purchase invoice");
    fireEvent.click(within(dialog).getByRole("button", { name: "Post invoices" }));
    await waitFor(() => expect(m.postParties).toHaveBeenCalledWith({ type: "vendor", date: "2026-06-30", rows: [{ partyId: "v1", reference: "INV-V-77", amount: 3000 }] }));
  });
});

const ITEM = (over) => ({ _id: "i1", itemId: "RICE", sku: "RICE", itemName: "Rice", unit: "KG", currentStock: 0, batchTracked: false, entered: false, canEnter: true, reason: "", ...over });
const STOCK = (over = {}) => ({
  goLive: GO_LIVE, vouchers: [],
  items: [ITEM(), ITEM({ _id: "i2", itemId: "MILK", sku: "MILK", itemName: "Milk", batchTracked: true }), ITEM({ _id: "i3", itemId: "SUGAR", sku: "SUGAR", itemName: "Sugar", canEnter: false, reason: "Has stock movements: use a stock adjustment" })],
  ...over,
});

describe("opening balances: stock", () => {
  it("values each row, shows the average cost, and posts quantity, cost, batch and expiry", async () => {
    m.stock.mockResolvedValue(STOCK());
    m.postStock.mockResolvedValue({ voucherNo: "OST-2026-0001", rows: 2, totalValue: 260, warnings: [] });
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Stock");
    await screen.findByLabelText("Opening stock");

    // items that already have movements are not offered
    fireEvent.keyDown(box("Item, row 1"), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: /Rice/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Sugar/ })).toBeNull();
    fireEvent.keyDown(box("Item, row 1"), { key: "Escape" });
    expect(screen.getByText("Items that cannot take it").closest(".rounded-xl")).toHaveTextContent("1"); // the stat tile: Sugar

    await choose("Item, row 1", "Rice");
    type("Quantity, row 1", "10");
    type("Unit cost, row 1", "5");
    type("Batch no., row 1", "R-B1");
    type("Expiry date, row 1", "01/03/2027");
    await choose("Item, row 2", "Rice");
    type("Quantity, row 2", "30");
    type("Unit cost, row 2", "7");
    type("Batch no., row 2", "R-B2");
    expect(screen.getByLabelText("Value, row 1")).toHaveValue("50.00");
    expect(screen.getByLabelText("Value, row 2")).toHaveValue("210.00");
    expect(screen.getByText("Total (2 rows, 1 item)").closest("tr")).toHaveTextContent("260.00");
    expect(screen.getByText(/Average cost after posting:/)).toHaveTextContent("Rice 40 at 6.50");

    fireEvent.click(screen.getByRole("button", { name: "Post opening stock" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("2 rows for 1 item, value 260.00, dated 30/06/2026");
    expect(dialog).toHaveTextContent("Dr Inventory, Cr Opening Balance Equity");
    fireEvent.click(within(dialog).getByRole("button", { name: "Post stock" }));
    await waitFor(() => expect(m.postStock).toHaveBeenCalledWith({
      date: "2026-06-30",
      rows: [{ itemId: "i1", qty: 10, unitCost: 5, batchNo: "R-B1", expiryDate: "2027-03-01" }, { itemId: "i1", qty: 30, unitCost: 7, batchNo: "R-B2" }],
    }));
    expect(await screen.findByText(/OST-2026-0001 posted: 2 rows, value 260.00/)).toBeInTheDocument();
  });

  it("a batch-tracked item needs its batch and expiry; an expiry before go-live warns but does not block", async () => {
    m.stock.mockResolvedValue(STOCK());
    m.postStock.mockResolvedValue({ voucherNo: "OST-2026-0002", rows: 1, totalValue: 12, warnings: [] });
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Stock");
    await screen.findByLabelText("Opening stock");

    await choose("Item, row 1", "Milk");
    expect(screen.getByLabelText("Batch no., row 1")).toHaveAttribute("placeholder", "Required");
    type("Quantity, row 1", "6");
    type("Unit cost, row 1", "2");
    fireEvent.click(screen.getByRole("button", { name: "Post opening stock" }));
    expect(await screen.findByText(/Row 1: Milk is batch-tracked: enter the batch number and the expiry date/)).toBeInTheDocument();
    expect(m.postStock).not.toHaveBeenCalled();

    type("Batch no., row 1", "M-1");
    // the mistake the row was flagged for goes as soon as the row is corrected, not at the next Post
    expect(screen.queryByText(/Row 1: Milk is batch-tracked/)).not.toBeInTheDocument();
    type("Expiry date, row 1", "25/06/2026");
    fireEvent.click(screen.getByRole("button", { name: "Post opening stock" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Row 1: Expires on or before the go-live day");
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Post stock" }));
    await waitFor(() => expect(m.postStock).toHaveBeenCalled());
  });

  it("lists the vouchers with their batches, and says why one cannot be reversed", async () => {
    const row = (over) => ({ itemName: "Rice", qty: 10, unitCost: 5, value: 50, batchNumber: "R-B1", expiryDate: "2027-03-01T00:00:00.000Z", ...over });
    m.stock.mockResolvedValue(STOCK({
      vouchers: [
        { _id: "s1", voucherNo: "OST-2026-0001", date: GO_LIVE, status: "posted", totalValue: 50, rows: [row()], canReverse: false, blockedBy: ["Rice"] },
        { _id: "s2", voucherNo: "OST-2026-0002", date: GO_LIVE, status: "posted", totalValue: 60, rows: [row({ itemName: "Milk", batchNumber: "MILK-01", value: 60 })], canReverse: true, blockedBy: [] },
        { _id: "s3", voucherNo: "OST-2026-0003", date: GO_LIVE, status: "reversed", totalValue: 9, rows: [row({ itemName: "Flour", value: 9 })], canReverse: false, blockedBy: [] },
      ],
    }));
    m.reverseStock.mockResolvedValue({ _id: "s2", voucherNo: "OST-2026-0002", status: "reversed" });
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Stock");
    const first = (await screen.findByText("OST-2026-0001")).closest("section");
    expect(first).toHaveTextContent("Cannot be reversed: Rice has later stock movements");
    expect(within(first).getByRole("table", { name: "Rows of OST-2026-0001" })).toHaveTextContent("R-B1");
    expect(within(first).getByRole("table", { name: "Rows of OST-2026-0001" })).toHaveTextContent("01/03/2027");
    expect(within(screen.getByText("OST-2026-0003").closest("section")).getByText("Reversed")).toBeInTheDocument();

    const second = screen.getByText("OST-2026-0002").closest("section");
    fireEvent.click(within(second).getByRole("button", { name: "Reverse" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("a matching reversal movement is recorded for each");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reverse stock entry" }));
    await waitFor(() => expect(m.reverseStock).toHaveBeenCalledWith("s2"));
  });
});

describe("opening balances: review", () => {
  it("shows the section totals, the trial balance check, Opening Balance Equity and the stock reconciliation", async () => {
    m.summary.mockResolvedValue(SUMMARY({
      sections: {
        accounts: { rows: 6, vouchers: 1, debit: 55600, credit: 25000, difference: 30500 },
        customers: { rows: 4, parties: 3, total: 3650.5, outstanding: 2950 },
        vendors: { rows: 1, parties: 1, total: 3000, outstanding: 2000 },
        stock: { rows: 4, items: 3, vouchers: 2, value: 350 },
      },
      trialBalance: { debit: 91700.5, credit: 91700.5, entries: 30, balanced: true, equity: { accountName: "Opening Balance Equity", openingBalance: 31600.5, balance: 31600.5 } },
      stockReconciliation: { available: true, stockValue: 350, ledgerBalance: 350, difference: 0, reconciles: true, account: { name: "Inventory Stock" } },
    }));
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Review");
    const tb = (await screen.findByText("Opening trial balance")).closest("section");
    expect(within(tb).getByText("Balanced")).toBeInTheDocument();
    expect(within(tb).getByText("Opening Balance Equity").closest("div")).toHaveTextContent(/31,600.50s*Cr/);
    expect(within(tb).getByRole("link", { name: /Open the trial balance/ })).toHaveAttribute("href", "/financial-statements?tab=trial");
    const stock = screen.getByText("Stock against the Inventory account").closest("section");
    expect(within(stock).getByText("Reconciles")).toBeInTheDocument();
    expect(screen.getByText("Nothing is missing")).toBeInTheDocument();
    expect(screen.getAllByText("3,650.50").length).toBeGreaterThan(0);
  });

  it("says what is out of balance and what is still missing, with a way to each step", async () => {
    m.summary.mockResolvedValue(SUMMARY({
      trialBalance: { debit: 100, credit: 40, entries: 3, balanced: false, equity: null },
      stockReconciliation: { available: true, stockValue: 350, ledgerBalance: 300, difference: 50, reconciles: false, account: { name: "Inventory Stock" } },
      missing: [{ key: "customers", message: "No customer opening invoices entered yet." }, { key: "stock-reconciliation", message: "Stock value differs from the Inventory account by 50.00." }],
      warnings: [{ code: "POSTING_DISABLED", message: "Ledger posting is switched off." }],
    }));
    m.parties.mockResolvedValue(PARTIES());
    at();
    await screen.findByRole("heading", { name: "Opening balances" });
    openTab("Review");
    const tb = (await screen.findByText("Opening trial balance")).closest("section");
    expect(within(tb).getByText("Out of balance")).toBeInTheDocument();
    expect(tb).toHaveTextContent("Difference60.00");
    expect(within(screen.getByText("Stock against the Inventory account").closest("section")).getByText("Differs")).toBeInTheDocument();
    const missing = screen.getByRole("list", { name: "Still missing" });
    expect(within(missing).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Ledger posting is switched off.")).toBeInTheDocument();

    fireEvent.click(within(missing).getByRole("button", { name: "Go to customers" }));
    expect(await screen.findByLabelText("Customer open invoices")).toBeInTheDocument();
  });
});
