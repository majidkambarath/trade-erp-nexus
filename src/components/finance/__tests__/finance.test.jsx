import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const m = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), list: vi.fn(), get: vi.fn(), remove: vi.fn(),
  options: vi.fn(), cheques: vi.fn(), clearCheque: vi.fn(), bounceCheque: vi.fn(), cancelCheque: vi.fn(),
  banks: vi.fn(), createBank: vi.fn(), cardTypes: vi.fn(), createCard: vi.fn(),
  postable: vi.fn(), taxCodes: vi.fn(), axiosGet: vi.fn(),
}));
vi.mock("../../../lib/bankingApi", () => ({
  vouchers: { create: m.create, update: m.update, list: m.list, get: m.get, remove: m.remove },
  banking: {
    options: m.options, cheques: m.cheques, clearCheque: m.clearCheque, bounceCheque: m.bounceCheque, cancelCheque: m.cancelCheque,
    banks: m.banks, createBank: m.createBank, updateBank: vi.fn(), cardTypes: m.cardTypes, createCardType: vi.fn(), updateCardType: vi.fn(),
    cards: vi.fn().mockResolvedValue([]), createCard: m.createCard, updateCard: vi.fn(),
  },
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { postableAccounts: m.postable, taxCodes: m.taxCodes }, ApiError: class extends Error {} }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.axiosGet } }));

import EntryGrid from "../EntryGrid";
import PaymentModeFields from "../PaymentModeFields";
import { JournalForm } from "../JournalVouchers";
import { PartyVoucherForm, allocateOldestFirst } from "../PartyVouchers";
import { NoteForm } from "../DebitCreditNotes";
import ChequeRegister from "../../banking/ChequeRegister";
import { BankForm } from "../../banking/BankMaster";
import { CardForm } from "../../banking/CardMaster";
import { emptyPayment, flattenAccounts } from "../../../lib/voucherForms";

// react-select: open the list with the arrow key, then pick the option by its text
const box = (name) => screen.getByRole("combobox", { name });
const choose = async (name, text) => {
  fireEvent.keyDown(box(name), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(text) }));
};

const acct = (over) => ({ _id: "a", accountCode: "X", accountName: "X", isActive: true, allowDirectPosting: true, ...over });
const CHART = {
  categories: [
    { category: "ASSET", ungrouped: [], groups: [{ name: "Current Assets", accounts: [], children: [
      { name: "Cash", accounts: [acct({ _id: "cash", accountCode: "CASH0001", accountName: "Cash in Hand" })], children: [] },
      { name: "Bank", accounts: [acct({ _id: "bank", accountCode: "BANK0001", accountName: "Bank Account" })], children: [] },
    ] }] },
    { category: "INCOME", ungrouped: [], groups: [{ name: "Sales Income", accounts: [acct({ _id: "sales", accountCode: "SAL0001", accountName: "Sales Discounts" })], children: [] }] },
    { category: "EXPENSE", ungrouped: [], groups: [{ name: "Operating Expenses", accounts: [acct({ _id: "rent", accountCode: "OPEX0001", accountName: "Rent Expense" })], children: [] }] },
  ],
};
const OPTIONS = {
  modes: ["cash", "bank", "transfer", "cheque", "card"],
  cashAccounts: [{ _id: "cash", accountName: "Cash in Hand", accountCode: "CASH0001", balance: 500 }],
  bankAccounts: [
    { _id: "bank1", accountName: "ENBD Current", accountCode: "BANK0001", balance: 1000, bank: { bankName: "Emirates NBD", accountNumberMasked: "•••• 4567" } },
    { _id: "bank2", accountName: "RAK Current", accountCode: "BANK0002", balance: 0, bank: null },
  ],
  banks: [{ _id: "mash", bankName: "Mashreq", bankCode: "MASH" }],
  cards: [
    { _id: "pos", label: "POS 1", kind: "terminal", cardTypeName: "Visa", last4: "", forReceipt: true, forPayment: false, effectiveFeePercent: 2.5 },
    { _id: "amex", label: "Company Amex", kind: "credit", cardTypeName: "Amex", last4: "4242", forReceipt: false, forPayment: true, effectiveFeePercent: 0, creditLimit: 5000, owed: 1000 },
  ],
};

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.postable.mockResolvedValue(flattenAccounts(CHART));
  m.options.mockResolvedValue(OPTIONS);
  m.taxCodes.mockResolvedValue([{ _id: "std", name: "Standard 5%", ratePercent: 5, isActive: true }, { _id: "zero", name: "Zero-rated", ratePercent: 0, isActive: true }]);
  m.banks.mockResolvedValue([{ _id: "mash", bankName: "Mashreq", bankCode: "MASH", isActive: true }]);
  m.cardTypes.mockResolvedValue([{ _id: "visa", name: "Visa", feePercent: 2.5, isActive: true }]);
});

// ------------------------------------------------------------------------------ the grid
describe("EntryGrid keyboard", () => {
  function Grid() {
    const [rows, setRows] = useState([{}, {}]);
    return (
      <EntryGrid
        ariaLabel="g" rows={rows} columns={[{ key: "a", label: "A" }, { key: "b", label: "B" }]}
        onAdd={() => setRows((r) => [...r, {}])} onRemove={(i) => setRows((r) => r.filter((_, k) => k !== i))}
        renderCell={(r, i, c) => <input aria-label={`${c.key}${i}`} />}
      />
    );
  }

  it("Enter moves across the row, down to the next row, and adds a row after the last", async () => {
    render(<Grid />);
    screen.getByLabelText("a0").focus();
    fireEvent.keyDown(screen.getByLabelText("a0"), { key: "Enter" });
    expect(screen.getByLabelText("b0")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("b0"), { key: "Enter" });
    expect(screen.getByLabelText("a1")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("a1"), { key: "Enter" });
    fireEvent.keyDown(screen.getByLabelText("b1"), { key: "Enter" });
    await waitFor(() => expect(screen.getByLabelText("a2")).toHaveFocus());
    expect(screen.getAllByRole("row")).toHaveLength(1 + 3); // header + 3 rows
  });

  it("Up and Down keep the column; Alt+N adds a row; Alt+Delete removes the current one", async () => {
    render(<Grid />);
    screen.getByLabelText("b0").focus();
    fireEvent.keyDown(screen.getByLabelText("b0"), { key: "ArrowDown" });
    expect(screen.getByLabelText("b1")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("b1"), { key: "ArrowUp" });
    expect(screen.getByLabelText("b0")).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText("a0"), { key: "n", altKey: true });
    await waitFor(() => expect(screen.getByLabelText("a2")).toHaveFocus());

    fireEvent.keyDown(screen.getByLabelText("a2"), { key: "Delete", altKey: true });
    await waitFor(() => expect(screen.queryByLabelText("a2")).toBeNull());
    // never below the minimum
    fireEvent.keyDown(screen.getByLabelText("a1"), { key: "Delete", altKey: true });
    expect(screen.getByLabelText("a1")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------- journal
describe("journal form", () => {
  const open = async () => {
    const onSaved = vi.fn();
    render(<JournalForm onClose={() => {}} onSaved={onSaved} />);
    await waitFor(() => expect(m.postable).toHaveBeenCalled());
    return onSaved;
  };

  it("cannot be posted until debits equal credits, and says by how much it is out", async () => {
    await open();
    const post = screen.getByRole("button", { name: "Post journal" });
    expect(post).toBeDisabled();
    await choose("Account, row 1", "Rent Expense");
    fireEvent.change(screen.getByLabelText("Debit, row 1"), { target: { value: "100" } });
    await choose("Account, row 2", "Cash in Hand");
    // the balancing amount is offered on the side that needs it
    expect(screen.getByLabelText("Credit, row 2")).toHaveValue("100");
    expect(post).toBeEnabled();
    expect(screen.getByText("Balanced")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Credit, row 2"), { target: { value: "90" } });
    expect(post).toBeDisabled();
    expect(screen.getByText("Difference")).toBeInTheDocument();
    expect(screen.getByText(/10\.00\s+more debit/)).toBeInTheDocument();
  });

  it("an amount on one side clears the other; amounts are tidied to two decimals", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Debit, row 1"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Credit, row 1"), { target: { value: "20" } });
    expect(screen.getByLabelText("Debit, row 1")).toHaveValue("");
    fireEvent.blur(screen.getByLabelText("Credit, row 1"));
    expect(screen.getByLabelText("Credit, row 1")).toHaveValue("20.00");
    fireEvent.change(screen.getByLabelText("Credit, row 1"), { target: { value: "abc" } }); // not a number
    expect(screen.getByLabelText("Credit, row 1")).toHaveValue("20.00");
  });

  it("posts the used rows to the voucher API", async () => {
    const onSaved = await open();
    m.create.mockResolvedValue({ voucherNo: "JV-2026-0001" });
    await choose("Account, row 1", "Rent Expense");
    fireEvent.change(screen.getByLabelText("Debit, row 1"), { target: { value: "70.5" } });
    fireEvent.change(screen.getByLabelText("Narration, row 1"), { target: { value: "October rent" } });
    await choose("Account, row 2", "Cash in Hand");
    fireEvent.click(screen.getByRole("button", { name: "Post journal" }));
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    expect(m.create.mock.calls[0][0]).toMatchObject({
      voucherType: "journal",
      lines: [{ accountId: "rent", narration: "October rent", debit: 70.5, credit: 0 }, { accountId: "cash", debit: 0, credit: 70.5 }],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Journal JV-2026-0001 posted"));
  });

  it("shows the server's refusal and stays open", async () => {
    await open();
    m.create.mockRejectedValue(new Error("Direct posting is not allowed to Bank Account"));
    await choose("Account, row 1", "Rent Expense");
    fireEvent.change(screen.getByLabelText("Debit, row 1"), { target: { value: "5" } });
    await choose("Account, row 2", "Bank Account");
    fireEvent.click(screen.getByRole("button", { name: "Post journal" }));
    expect(await screen.findByText("Direct posting is not allowed to Bank Account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post journal" })).toBeEnabled();
  });
});

// ----------------------------------------------------------------------- payment modes
describe("payment mode fields", () => {
  function Fields({ direction = "receipt", amount, initial = {} }) {
    const [v, setV] = useState({ ...emptyPayment(), ...initial });
    return <PaymentModeFields value={v} onChange={setV} direction={direction} options={OPTIONS} errors={{}} voucherDate="2026-10-04" amount={amount} />;
  }

  it("offers the five modes and shows each mode's fields", () => {
    render(<Fields />);
    expect(screen.getAllByRole("radio").map((r) => r.value)).toEqual(["cash", "bank", "transfer", "cheque", "card"]);
    expect(screen.getByText(/Goes into Cash in Hand/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Transfer" }));
    expect(screen.getByLabelText(/Transfer reference/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Deposit to/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Cheque" }));
    expect(screen.getByLabelText(/Cheque number/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Drawn on bank/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Transfer reference/)).toBeNull();
  });

  it("flags a post-dated cheque", () => {
    render(<Fields initial={{ mode: "cheque", chequeDate: "2026-11-01" }} />);
    expect(screen.getByText(/waits in cheques in hand/)).toBeInTheDocument();
  });

  it("on a payment, a cheque is drawn on our bank account and asks nothing about the customer's bank", () => {
    render(<Fields direction="payment" initial={{ mode: "cheque" }} />);
    expect(screen.getByLabelText(/Cheque drawn on/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Drawn on bank/)).toBeNull();
  });

  it("a card receipt only offers terminals and previews the processor's fee; a payment offers the company's cards", async () => {
    const { unmount } = render(<Fields amount={200} initial={{ mode: "card", cardId: "pos" }} />);
    expect(screen.getByText(/Processor fee 2.5% · 5.00 AED, 195.00 AED reaches the bank/)).toBeInTheDocument();
    fireEvent.keyDown(box(/Card terminal/), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: /POS 1/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Company Amex/ })).toBeNull();
    unmount();

    render(<Fields direction="payment" initial={{ mode: "card", cardId: "amex" }} />);
    expect(screen.getByText(/1,000.00 of 5,000.00 AED used/)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------- receipts / payments
describe("receipt allocation", () => {
  it("fills the oldest invoice first and keeps the rest on account", () => {
    const inv = [{ _id: "a", outstandingAmount: 100 }, { _id: "b", outstandingAmount: 100 }, { _id: "c", outstandingAmount: 100 }];
    expect(allocateOldestFirst(inv, 150_00)).toEqual({ a: "100", b: "50" });
    expect(allocateOldestFirst(inv, 40_00)).toEqual({ a: "40" });
    expect(allocateOldestFirst(inv, 350_00)).toEqual({ a: "100", b: "100", c: "100" });
    expect(allocateOldestFirst([], 100_00)).toEqual({});
  });

  const cfg = { voucherType: "receipt", title: "Receipt vouchers", one: "receipt", noun: "Customer", amountLabel: "Amount received (AED)", partyPath: "/customers/customers", nameKey: "customerName", idKey: "customerId", partyField: "customerId", docType: "sales_order" };
  const INVOICES = [
    { _id: "i1", transactionNo: "SO-2026-0001", date: "2026-09-01", totalAmount: 100, outstandingAmount: 100 },
    { _id: "i2", transactionNo: "SO-2026-0002", date: "2026-09-10", totalAmount: 100, outstandingAmount: 100 },
    { _id: "i3", transactionNo: "SO-2026-0003", date: "2026-09-20", totalAmount: 50, outstandingAmount: 0 },
  ];
  beforeEach(() => {
    m.axiosGet.mockImplementation((url) =>
      Promise.resolve({ data: { data: url === "/customers/customers" ? [{ _id: "c1", customerName: "Al Noor", customerId: "CUST001" }] : INVOICES } })
    );
  });

  it("splits the amount over the open invoices oldest first, shows what stays on account, and posts it", async () => {
    const onSaved = vi.fn();
    m.create.mockResolvedValue({ voucherNo: "RV-2026-0001" });
    render(<PartyVoucherForm cfg={cfg} direction="receipt" onClose={() => {}} onSaved={onSaved} />);
    await waitFor(() => expect(m.options).toHaveBeenCalled());
    await choose(/^Customer/, "Al Noor");
    expect(await screen.findByLabelText("Amount against SO-2026-0001")).toBeInTheDocument();
    expect(screen.queryByLabelText("Amount against SO-2026-0003")).toBeNull(); // nothing open on it

    fireEvent.change(screen.getByLabelText(/Amount received/), { target: { value: "250" } });
    expect(screen.getByLabelText("Amount against SO-2026-0001")).toHaveValue("100");
    expect(screen.getByLabelText("Amount against SO-2026-0002")).toHaveValue("100");
    expect(within(screen.getByRole("region", { name: "Open invoices" })).getByText("50.00")).toBeInTheDocument(); // on account

    fireEvent.click(screen.getByRole("button", { name: "Post receipt" }));
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    expect(m.create.mock.calls[0][0]).toMatchObject({
      voucherType: "receipt", customerId: "c1", totalAmount: 250, paymentMode: "cash",
      linkedInvoices: [{ invoiceId: "i1", amount: 100, balance: 0 }, { invoiceId: "i2", amount: 100, balance: 0 }],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Receipt RV-2026-0001 posted"));
  });

  it("paying more against an invoice raises the amount; more than is open is refused", async () => {
    render(<PartyVoucherForm cfg={cfg} direction="receipt" onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(m.options).toHaveBeenCalled());
    await choose(/^Customer/, "Al Noor");
    await screen.findByLabelText("Amount against SO-2026-0001");
    fireEvent.change(screen.getByLabelText("Amount against SO-2026-0002"), { target: { value: "60" } });
    expect(screen.getByLabelText(/Amount received/)).toHaveValue("60");
    fireEvent.change(screen.getByLabelText("Amount against SO-2026-0002"), { target: { value: "160" } });
    fireEvent.click(screen.getByRole("button", { name: "Post receipt" }));
    expect(await screen.findByText(/More than the 100.00 open/)).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("checks the mode's own fields before sending (a cheque needs its number)", async () => {
    render(<PartyVoucherForm cfg={cfg} direction="receipt" onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(m.options).toHaveBeenCalled());
    await choose(/^Customer/, "Al Noor");
    fireEvent.change(screen.getByLabelText(/Amount received/), { target: { value: "50" } });
    fireEvent.click(await screen.findByRole("radio", { name: "Cheque" }));
    fireEvent.click(screen.getByRole("button", { name: "Post receipt" }));
    expect(await screen.findByText("Enter the cheque number")).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------------------- notes
describe("debit and credit notes", () => {
  beforeEach(() => {
    m.axiosGet.mockImplementation((url) => Promise.resolve({ data: { data: url === "/customers/customers" ? [{ _id: "c1", customerName: "Al Noor", customerId: "CUST001" }] : [] } }));
  });

  it("previews exactly what will post, with VAT, and sends the lines", async () => {
    const onSaved = vi.fn();
    m.create.mockResolvedValue({ voucherNo: "CN-2026-0001" });
    render(<NoteForm initialType="credit_note" onClose={() => {}} onSaved={onSaved} />);
    await waitFor(() => expect(m.postable).toHaveBeenCalled());
    await choose(/^Customer/, "Al Noor");
    await choose("Account, row 1", "Sales Discounts");
    fireEvent.change(screen.getByLabelText("Amount, row 1"), { target: { value: "100" } });
    await choose("Tax code, row 1", "Standard");

    const preview = screen.getByRole("region", { name: "What will be posted" });
    expect(within(preview).getByText("Al Noor").closest("li")).toHaveTextContent(/Cr.*Al Noor.*105\.00/);
    expect(within(preview).getByText("Sales Discounts").closest("li")).toHaveTextContent(/Dr.*Sales Discounts.*100\.00/);
    expect(within(preview).getByText("Output VAT").closest("li")).toHaveTextContent(/Dr.*Output VAT.*5\.00/);

    fireEvent.click(screen.getByRole("button", { name: "Post credit note" }));
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    expect(m.create.mock.calls[0][0]).toMatchObject({
      voucherType: "credit_note", partyType: "Customer", partyId: "c1",
      lines: [{ accountId: "sales", amount: 100, taxCodeId: "std" }],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("flips the sides for a debit note and uses input VAT for a vendor", async () => {
    m.axiosGet.mockImplementation((url) => Promise.resolve({ data: { data: url === "/vendors/vendors" ? [{ _id: "v1", vendorName: "Gulf Mills", vendorId: "VEN001" }] : [] } }));
    render(<NoteForm initialType="debit_note" onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(m.postable).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("radio", { name: "Vendor" }));
    await choose(/^Vendor/, "Gulf Mills");
    await choose("Account, row 1", "Rent Expense");
    fireEvent.change(screen.getByLabelText("Amount, row 1"), { target: { value: "200" } });
    await choose("Tax code, row 1", "Standard");
    const preview = screen.getByRole("region", { name: "What will be posted" });
    expect(within(preview).getByText("Gulf Mills").closest("li")).toHaveTextContent(/Dr.*Gulf Mills.*210\.00/);
    expect(within(preview).getByText("Input VAT").closest("li")).toHaveTextContent(/Cr.*Input VAT.*10\.00/);
  });

  it("only a note that lowers what the party owes can be set against an invoice", async () => {
    const locked = () => document.querySelectorAll(".search-select__control--is-disabled").length;
    render(<NoteForm initialType="credit_note" onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(m.postable).toHaveBeenCalled());
    expect(locked()).toBe(1); // the invoice list waits for a party
    await choose(/^Customer/, "Al Noor");
    await waitFor(() => expect(locked()).toBe(0)); // a customer credit note lowers what they owe
    fireEvent.click(screen.getByRole("radio", { name: "Debit note" }));
    expect(locked()).toBe(1); // a debit note adds to it, so it stays on account
    expect(screen.getByText(/adds to what they owe/)).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------- cheque register
describe("cheque register", () => {
  const ROW = (over) => ({ _id: "c1", chequeNo: "100200", direction: "receipt", voucherNo: "RV-2026-0001", partyName: "Al Noor", chequeDate: "2026-09-01T00:00:00Z", amount: 500, status: "pending", matured: true, drawnOnBankName: "Mashreq", bankAccountName: "ENBD Current", ...over });
  const list = (rows) => m.cheques.mockResolvedValue({ rows, total: rows.length, summary: { receivable: { amount: 700, count: 2 }, payable: { amount: 0, count: 0 } } });

  it("shows what is still to collect and lets a mature cheque be cleared", async () => {
    list([ROW(), ROW({ _id: "c2", chequeNo: "900900", chequeDate: "2099-01-01T00:00:00Z", matured: false })]);
    m.clearCheque.mockResolvedValue({});
    render(<ChequeRegister />);
    expect(await screen.findByText("100200")).toBeInTheDocument();
    expect(screen.getByText("700.00")).toBeInTheDocument();
    expect(screen.getByText("Post-dated")).toBeInTheDocument();

    // a post-dated cheque cannot be cleared before its date
    const buttons = screen.getAllByRole("button", { name: /Clear/ });
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();

    fireEvent.click(buttons[0]);
    const dialog = await screen.findByRole("dialog", { name: /Clear cheque 100200/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear cheque" }));
    await waitFor(() => expect(m.clearCheque).toHaveBeenCalledWith("c1", { clearedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    expect(await screen.findByText("Cheque 100200 cleared")).toBeInTheDocument();
  });

  it("a bounced cheque needs a reason", async () => {
    list([ROW()]);
    m.bounceCheque.mockResolvedValue({});
    render(<ChequeRegister />);
    await screen.findByText("100200");
    fireEvent.click(screen.getByRole("button", { name: /Bounced/ }));
    const dialog = await screen.findByRole("dialog", { name: /bounced/i });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark bounced" }));
    expect(await within(dialog).findByText("Say why the cheque was returned")).toBeInTheDocument();
    expect(m.bounceCheque).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Insufficient funds" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark bounced" }));
    await waitFor(() => expect(m.bounceCheque).toHaveBeenCalledWith("c1", { reason: "Insufficient funds" }));
  });

  it("explains an empty register", async () => {
    list([]);
    render(<ChequeRegister />);
    expect(await screen.findByText("No cheques here")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------------------- masters
describe("bank master", () => {
  it("checks the SWIFT code and the required fields before saving", async () => {
    const onSaved = vi.fn();
    m.createBank.mockResolvedValue({ bankName: "Emirates NBD" });
    render(<BankForm bank={{ bankName: "", bankCode: "", swiftCode: "", country: "AE", city: "", notes: "", branches: [], isActive: true }} onClose={() => {}} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Add bank" }));
    expect(await screen.findByText("Enter the bank's name")).toBeInTheDocument();
    expect(screen.getByText("Enter a short code")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Bank name/), { target: { value: "Emirates NBD" } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: "enbd" } });
    fireEvent.change(screen.getByLabelText(/SWIFT/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add bank" }));
    expect(await screen.findByText(/8 or 11 letters/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/SWIFT/), { target: { value: "ebilaead" } });
    fireEvent.click(screen.getByRole("button", { name: "Add bank" }));
    await waitFor(() => expect(m.createBank).toHaveBeenCalledWith(expect.objectContaining({ bankName: "Emirates NBD", bankCode: "ENBD", swiftCode: "EBILAEAD", country: "AE" })));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Emirates NBD added"));
  });
});

describe("card master", () => {
  const blank = { kind: "terminal", label: "", cardTypeId: "", bankId: "", holderName: "", terminalId: "", last4: "", expiryMonth: "", expiryYear: "", creditLimit: "", feePercent: "", accountId: "", isActive: true };

  it("asks for different things per kind of card", async () => {
    render(<CardForm card={blank} onClose={() => {}} onSaved={() => {}} />);
    await waitFor(() => expect(m.options).toHaveBeenCalled());
    // a merchant terminal settles into a bank account and has a processor fee, no holder or limit
    expect(box(/Settles into/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Processing fee/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Card holder/)).toBeNull();
    expect(screen.queryByLabelText(/Credit limit/)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Credit card/ }));
    expect(screen.getByLabelText(/Credit limit/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Card holder/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Settles into|Draws on/ })).toBeNull(); // its account is made for it
    expect(screen.getByText(/never stored/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Debit card/ }));
    expect(box(/Draws on/)).toBeInTheDocument();
  });

  it("keeps only four digits and sends what was filled in", async () => {
    m.createCard.mockResolvedValue({ label: "Company Amex" });
    const onSaved = vi.fn();
    render(<CardForm card={blank} onClose={() => {}} onSaved={onSaved} />);
    await waitFor(() => expect(m.cardTypes).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("radio", { name: /Credit card/ }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Company Amex" } });
    await choose(/^Card type/, "Visa");
    fireEvent.change(screen.getByLabelText(/Card holder/), { target: { value: "Boss" } });
    fireEvent.change(screen.getByLabelText(/Credit limit/), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText(/Last four digits/), { target: { value: "4242 4242 4242 4242" } });
    expect(screen.getByLabelText(/Last four digits/)).toHaveValue("4242"); // longer input is cut, never kept
    fireEvent.click(screen.getByRole("button", { name: "Add card" }));
    await waitFor(() => expect(m.createCard).toHaveBeenCalledTimes(1));
    const body = m.createCard.mock.calls[0][0];
    expect(body).toMatchObject({ kind: "credit", label: "Company Amex", cardTypeId: "visa", holderName: "Boss", creditLimit: 5000, last4: "4242" });
    expect(JSON.stringify(body)).not.toMatch(/cvv|cardNumber/i);
  });
});
