import { describe, it, expect } from "vitest";
import {
  toCents, money, emptyPayment, validatePayment, paymentPayload, paymentFromVoucher, describePayment, modeLabel,
  journalTotals, validateJournal, suggestBalance, journalPayload, journalRowsFromVoucher,
  noteTotals, notePreview, validateNote, flattenAccounts, accountOption,
} from "../voucherForms";

const OPTIONS = { bankAccounts: [{ _id: "b1" }, { _id: "b2" }], cashAccounts: [{ _id: "c1" }] };
const pay = (over) => ({ ...emptyPayment(), ...over });
const TODAY = "2026-10-04";

describe("money", () => {
  it("works in whole cents", () => {
    expect(toCents("0.1") + toCents("0.2")).toBe(30);
    expect(toCents("1,250.505")).toBe(125051);
    expect(toCents("")).toBe(0);
    expect(toCents("abc")).toBe(0);
    expect(money(125000)).toBe("1,250.00");
  });
});

describe("payment modes", () => {
  it("cash needs nothing more", () => {
    expect(validatePayment(pay({ mode: "cash" }), { direction: "receipt", options: OPTIONS })).toEqual({});
  });

  it("bank needs the account when there is more than one, not when there is one", () => {
    expect(validatePayment(pay({ mode: "bank" }), { direction: "receipt", options: OPTIONS }).accountId).toMatch(/bank account/);
    expect(validatePayment(pay({ mode: "bank" }), { direction: "receipt", options: { bankAccounts: [{ _id: "only" }] } })).toEqual({});
    expect(validatePayment(pay({ mode: "bank", accountId: "b2" }), { direction: "receipt", options: OPTIONS })).toEqual({});
  });

  it("a transfer needs its reference", () => {
    const e = validatePayment(pay({ mode: "transfer", accountId: "b1" }), { direction: "payment", options: OPTIONS });
    expect(e.reference).toMatch(/reference/);
  });

  it("a cheque needs number, date and (when received) the drawing bank; stale cheques are refused", () => {
    const e = validatePayment(pay({ mode: "cheque", accountId: "b1" }), { direction: "receipt", options: OPTIONS, voucherDate: TODAY });
    expect(Object.keys(e).sort()).toEqual(["chequeDate", "chequeNo", "drawnOnBankId"]);
    // our own cheque is not "drawn on" a customer's bank
    expect(validatePayment(pay({ mode: "cheque", accountId: "b1", chequeNo: "000123", chequeDate: TODAY }), { direction: "payment", options: OPTIONS, voucherDate: TODAY })).toEqual({});
    expect(validatePayment(pay({ mode: "cheque", accountId: "b1", chequeNo: "12", chequeDate: TODAY, drawnOnBankName: "X" }), { direction: "receipt", options: OPTIONS, voucherDate: TODAY }).chequeNo).toMatch(/letters/);
    expect(validatePayment(pay({ mode: "cheque", accountId: "b1", chequeNo: "1234", chequeDate: "2026-01-01", drawnOnBankName: "X" }), { direction: "receipt", options: OPTIONS, voucherDate: TODAY }).chequeDate).toMatch(/six months/);
  });

  it("a card needs the card, and a receipt also the approval code", () => {
    expect(validatePayment(pay({ mode: "card" }), { direction: "payment", options: OPTIONS }).cardId).toBeTruthy();
    expect(validatePayment(pay({ mode: "card", cardId: "k1" }), { direction: "payment", options: OPTIONS })).toEqual({});
    expect(validatePayment(pay({ mode: "card", cardId: "k1" }), { direction: "receipt", options: OPTIONS }).approvalCode).toBeTruthy();
  });

  it("builds only the fields of the chosen mode", () => {
    expect(paymentPayload(pay({ mode: "cash", reference: "ignored", chequeNo: "ignored" }))).toEqual({ paymentMode: "cash", paymentDetails: {} });
    expect(paymentPayload(pay({ mode: "transfer", accountId: "b1", reference: " T-1 ", referenceDate: TODAY }))).toEqual({ paymentMode: "transfer", paymentDetails: { accountId: "b1", reference: "T-1", referenceDate: TODAY } });
    expect(paymentPayload(pay({ mode: "cheque", accountId: "b1", chequeNo: "555", chequeDate: TODAY, drawnOnBankName: "Mashreq" }))).toEqual({
      paymentMode: "cheque", paymentDetails: { accountId: "b1", chequeNo: "555", chequeDate: TODAY, drawnOnBankName: "Mashreq" },
    });
    expect(paymentPayload(pay({ mode: "cheque", accountId: "b1", chequeNo: "555", chequeDate: TODAY, drawnOnBankId: "m1", drawnOnBankName: "ignored" })).paymentDetails.drawnOnBankId).toBe("m1");
    expect(paymentPayload(pay({ mode: "card", cardId: "k1", approvalCode: "A1" })).paymentDetails).toEqual({ cardId: "k1", approvalCode: "A1" });
  });

  it("reads an existing voucher back into the form, old 'online' vouchers as transfers", () => {
    const form = paymentFromVoucher({ paymentMode: "online", paymentDetails: { accountId: "b1", onlineDetails: { transactionId: "OLD-7", transactionDate: "2026-10-01T00:00:00Z" } } });
    expect(form).toMatchObject({ mode: "transfer", accountId: "b1", reference: "OLD-7", referenceDate: "2026-10-01" });
    const chq = paymentFromVoucher({ paymentMode: "cheque", paymentDetails: { accountId: "b1", chequeDetails: { chequeNumber: "9", chequeDate: "2026-11-01T00:00:00Z" }, drawnOnBankName: "CBD" } });
    expect(chq).toMatchObject({ mode: "cheque", chequeNo: "9", chequeDate: "2026-11-01", drawnOnBankName: "CBD" });
  });

  it("describes how a voucher was paid in one line", () => {
    expect(describePayment({ paymentMode: "cheque", paymentDetails: { chequeDetails: { chequeNumber: "555" }, drawnOnBankName: "Mashreq", isPDC: true } })).toBe("Cheque 555 · Mashreq · post-dated");
    expect(describePayment({ paymentMode: "card", paymentDetails: { cardLabel: "POS 1", cardTypeName: "Visa", cardLast4: "4242", approvalCode: "A1" } })).toBe("POS 1 · Visa · •••• 4242 · auth A1");
    expect(describePayment({ paymentMode: "online", paymentDetails: { accountName: "ENBD", reference: "T-1" } })).toBe("ENBD · ref T-1");
    expect(modeLabel("online")).toBe("Transfer");
  });
});

describe("journal", () => {
  const row = (accountId, debit = "", credit = "") => ({ accountId, narration: "", debit, credit });

  it("totals in cents and says when it balances", () => {
    const t = journalTotals([row("a", "0.1"), row("b", "0.2"), row("c", "", "0.3")]);
    expect(t).toMatchObject({ debit: 30, credit: 30, diff: 0, balanced: true });
    expect(journalTotals([row("a", "100"), row("b", "", "90")])).toMatchObject({ diff: 1000, balanced: false });
    expect(journalTotals([row("a"), row("b")]).balanced).toBe(false);
  });

  it("validates like the server does, ignoring untouched spare rows", () => {
    expect(validateJournal([row("a", "50"), row("b", "", "50"), row("")])).toEqual({});
    expect(validateJournal([row("a", "50")])._).toMatch(/two lines/);
    expect(validateJournal([row("a", "50"), row("b", "", "40")])._).toMatch(/differ by 10.00/);
    expect(validateJournal([row("a", "50", "50"), row("b", "", "50")])[0]).toMatch(/not both/);
    expect(validateJournal([row("", "50"), row("b", "", "50")])[0]).toMatch(/account/);
    expect(validateJournal([row("a"), row("b", "", "50")])[0]).toMatch(/amount/);
  });

  it("offers the amount that balances, on the side that needs it", () => {
    const rows = [row("a", "100"), row("b")];
    expect(suggestBalance(rows, 1)).toEqual({ side: "credit", amount: 100 });
    expect(suggestBalance([row("a", "", "30"), row("b")], 1)).toEqual({ side: "debit", amount: 30 });
    expect(suggestBalance([row("a", "100"), row("b", "", "100"), row("c")], 2)).toBeNull();
  });

  it("builds the request from used rows only", () => {
    const p = journalPayload({ date: TODAY, narration: "Accrual", rows: [{ ...row("a", "70.5"), narration: " rent " }, row("b", "", "70.5"), row("")] });
    expect(p).toEqual({
      voucherType: "journal", date: TODAY, narration: "Accrual",
      lines: [{ accountId: "a", narration: "rent", debit: 70.5, credit: 0 }, { accountId: "b", narration: undefined, debit: 0, credit: 70.5 }],
    });
  });

  it("reads a saved journal back into rows", () => {
    expect(journalRowsFromVoucher({ entries: [{ accountId: "a", debitAmount: 5, creditAmount: 0, description: "x" }, { accountId: "b", debitAmount: 0, creditAmount: 5 }] })).toEqual([
      { accountId: "a", narration: "x", debit: "5", credit: "" },
      { accountId: "b", narration: "", debit: "", credit: "5" },
    ]);
  });
});

describe("debit and credit notes", () => {
  const TAX = [{ _id: "std", ratePercent: 5 }, { _id: "zero", ratePercent: 0 }];

  it("adds VAT line by line", () => {
    expect(noteTotals([{ amount: "100", taxCodeId: "std" }, { amount: "40.50", taxCodeId: "zero" }, { amount: "10", taxCodeId: "" }], TAX)).toEqual({ net: 15050, vat: 500, total: 15550 });
  });

  it("previews what will post: the party on one side, the lines and VAT on the other", () => {
    const totals = noteTotals([{ amount: "100", taxCodeId: "std" }], TAX);
    const accounts = [{ _id: "disc", accountName: "Sales Discounts Given" }];
    const credit = notePreview({ type: "credit_note", partyName: "Al Noor", partyType: "Customer", lines: [{ accountId: "disc", amount: "100" }], accounts, totals });
    expect(credit).toEqual([
      { account: "Al Noor", side: "Cr", amount: 10500 },
      { account: "Sales Discounts Given", side: "Dr", amount: 10000 },
      { account: "Output VAT", side: "Dr", amount: 500 },
    ]);
    const debit = notePreview({ type: "debit_note", partyName: "Gulf Mills", partyType: "Vendor", lines: [{ accountId: "disc", amount: "100" }], accounts, totals });
    expect(debit.map((r) => `${r.account}:${r.side}`)).toEqual(["Gulf Mills:Dr", "Sales Discounts Given:Cr", "Input VAT:Cr"]);
  });

  it("validates the party and the lines", () => {
    expect(validateNote({ partyId: "", lines: [] })).toMatchObject({ partyId: expect.any(String), _: expect.any(String) });
    expect(validateNote({ partyId: "p", lines: [{ accountId: "a", amount: "" }] })[0]).toMatch(/amount/);
    expect(validateNote({ partyId: "p", lines: [{ accountId: "a", amount: "5" }, {}] })).toEqual({});
  });
});

describe("chart accounts", () => {
  const CHART = {
    categories: [
      { category: "ASSET", groups: [{ name: "Current Assets", accounts: [], children: [{ name: "Bank", accounts: [{ _id: "b", accountName: "Bank Account", accountCode: "BANK0001", isActive: true }], children: [] }] }], ungrouped: [] },
      { category: "EXPENSE", groups: [{ name: "Operating Expenses", accounts: [{ _id: "r", accountName: "Rent", accountCode: "OPEX0001", isActive: true }, { _id: "x", accountName: "Closed", isActive: false }, { _id: "n", accountName: "Locked", allowDirectPosting: false }], children: [] }], ungrouped: [] },
    ],
  };

  it("flattens the tree to postable accounts with their group path", () => {
    const all = flattenAccounts(CHART);
    expect(all.map((a) => a._id)).toEqual(["b", "r"]);
    expect(all[0]).toMatchObject({ category: "ASSET", groupName: "Bank", path: "Current Assets › Bank" });
    expect(flattenAccounts(CHART, { categories: ["EXPENSE"] }).map((a) => a._id)).toEqual(["r"]);
  });

  it("makes options searchable by code and group", () => {
    const [bank] = flattenAccounts(CHART);
    expect(accountOption(bank)).toEqual({ value: "b", label: "Bank Account", hint: "BANK0001", searchText: "BANK0001 Bank ASSET" });
  });
});
