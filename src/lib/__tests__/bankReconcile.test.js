import { describe, it, expect } from "vitest";
import {
  colLetter, columnOptions, formFromMapping, mappingFromForm, mappingReady, postingKinds, proofRows, readiness, signedAmount,
  splitDifference, splitGross, unexplained, LINE_TABS,
} from "../bankReconcile";

describe("signs and what can be posted", () => {
  it("shows the direction as a sign, from the bank account's side", () => {
    expect(signedAmount(1050)).toBe("+1,050.00");
    expect(signedAmount(-21)).toBe("-21.00");
    expect(signedAmount(0)).toBe("0.00");
  });

  it("offers what fits the direction of the money", () => {
    expect(postingKinds(100).map((k) => k.value)).toEqual(["receipt", "interest", "transfer", "journal"]);
    expect(postingKinds(-100).map((k) => k.value)).toEqual(["fee", "payment", "transfer", "journal"]);
    for (const k of [...postingKinds(5), ...postingKinds(-5)]) expect(k.help.length).toBeGreaterThan(10);
  });

  it("the worklist has the five tabs in working order", () => {
    expect(LINE_TABS.map((t) => t[0])).toEqual(["todo", "suggested", "matched", "ignored", "all"]);
  });
});

describe("columns of a statement file", () => {
  it("names columns like a spreadsheet does", () => {
    expect([0, 1, 25, 26, 27].map(colLetter)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });

  it("names each column by its header, or by its first value when there is no header", () => {
    const rows = [["Account 123", ""], ["Date", "Description", "Debit"], ["05/10/2026", "SHOP", "5.00"]];
    expect(columnOptions(rows, 1).map((o) => o.label)).toEqual(["A · Date (05/10/2026)", "B · Description (SHOP)", "C · Debit (5.00)"]);
    expect(columnOptions([["Date", "Memo"]], 0).map((o) => o.label)).toEqual(["A · Date", "B · Memo"]);
    expect(columnOptions([["05/10/2026", "A VERY LONG DESCRIPTION OF A PAYMENT TO SOMEONE"]], -1).map((o) => o.label)).toEqual(["A · 05/10/2026", "B · A VERY LONG DESCRIPTION"]);
    expect(columnOptions([["x", ""]], -1)[1].label).toBe("B · (empty)");
  });

  it("a choice on screen becomes the mapping the server reads, and back again", () => {
    const form = { headerRow: "2", dateFormat: "DMY", date: "0", valueDate: "", description: ["1"], reference: "", cheque: "", balance: "4", amountMode: "split", debit: "2", credit: "3", amount: "", flag: "", invert: false };
    const mapping = mappingFromForm(form);
    expect(mapping).toEqual({ headerRow: 2, dateFormat: "DMY", columns: { date: 0, description: 1, balance: 4 }, amount: { mode: "split", debit: 2, credit: 3 } });
    expect(formFromMapping(mapping)).toEqual({ ...form, valueDate: "" });
  });

  it("several description columns stay a list; one stays a number", () => {
    const f = (d) => mappingFromForm({ headerRow: "0", date: "0", description: d, amountMode: "signed", amount: "2" });
    expect(f(["1", "3"]).columns.description).toEqual([1, 3]);
    expect(f(["1"]).columns.description).toBe(1);
    expect(f([]).columns.description).toBeUndefined();
  });

  it("the other amount layouts", () => {
    const signed = mappingFromForm({ headerRow: "0", date: "0", amountMode: "signed", amount: "2", invert: true });
    expect(signed.amount).toEqual({ mode: "signed", column: 2, invert: true });
    const drcr = mappingFromForm({ headerRow: "0", date: "0", amountMode: "drcr", amount: "2", flag: "3" });
    expect(drcr.amount).toEqual({ mode: "drcr", column: 2, flag: 3, invert: false });
  });

  it("is ready when a date and the money are chosen", () => {
    const base = { date: "0", amountMode: "split", debit: "", credit: "", amount: "", flag: "" };
    expect(mappingReady({ ...base })).toBe(false);
    expect(mappingReady({ ...base, credit: "3" })).toBe(true);
    expect(mappingReady({ ...base, date: "" , credit: "3" })).toBe(false);
    expect(mappingReady({ ...base, amountMode: "signed", amount: "2" })).toBe(true);
    expect(mappingReady({ ...base, amountMode: "drcr", amount: "2" })).toBe(false);
    expect(mappingReady({ ...base, amountMode: "drcr", amount: "2", flag: "3" })).toBe(true);
  });
});

describe("a card settlement's difference", () => {
  it("is the VAT on the commission booked at the sale first, and any commission beyond it after", () => {
    // booked fee 6.00 at 5% VAT = 0.30, and that is all the acquirer kept
    expect(splitDifference({ difference: 0.3, feeBooked: 6, vatRate: 5 })).toEqual({ extraCommission: 0, vat: 0.3 });
    // it kept 0.50: 0.20 of VAT on a 4.00 commission, 0.30 more commission
    expect(splitDifference({ difference: 0.5, feeBooked: 4, vatRate: 5 })).toEqual({ extraCommission: 0.3, vat: 0.2 });
    // less than the VAT it would be: all of it is VAT
    expect(splitDifference({ difference: 0.1, feeBooked: 6, vatRate: 5 })).toEqual({ extraCommission: 0, vat: 0.1 });
  });

  it("explains nothing when the bank paid what the books expected, or more", () => {
    expect(splitDifference({ difference: 0, feeBooked: 6 })).toEqual({ extraCommission: 0, vat: 0 });
    expect(splitDifference({ difference: -0.5, feeBooked: 6 })).toEqual({ extraCommission: 0, vat: 0 });
  });

  it("counts what is still unexplained in whole fils, so 0.1 + 0.2 is 0.3", () => {
    expect(unexplained(0.3, 0.1, 0.2)).toBe(0);
    expect(unexplained(0.5, 0.45, 0.05)).toBe(0);
    expect(unexplained(0.5, 0.2, 0.1)).toBe(0.2);
  });
});

describe("a bank fee's gross", () => {
  it("splits into net and VAT that add back to what the statement says", () => {
    expect(splitGross(21, 5)).toEqual({ net: 20, vat: 1, exact: true });
    expect(splitGross(10, 5)).toEqual({ net: 9.52, vat: 0.48, exact: true });
    expect(splitGross(100, 0)).toEqual({ net: 100, vat: 0, exact: true });
    for (let g = 1; g <= 5000; g += 1) {
      const s = splitGross(g / 100, 5);
      expect(Math.round(s.net * 100) + Math.round(s.vat * 100)).toBe(g);
    }
  });
});

describe("the bank reconciliation statement", () => {
  const proof = {
    statementBalance: 1000, depositsInTransit: { total: 77, items: [{ id: "a" }] }, outstandingPayments: { total: -20, items: [] },
    adjustedBank: 1057, bookBalance: 1072, bankItemsNotInBooks: { total: -15, items: [] }, ignored: { total: 0, items: [] }, adjustedBook: 1057, difference: 0,
    canFinish: true, blockers: [],
  };

  it("reads top to bottom as an accountant would", () => {
    const rows = proofRows(proof);
    expect(rows.map((r) => r.key)).toEqual(["statement", "transit", "outstanding", "adjustedBank", "books", "bankItems", "ignored", "adjustedBook", "difference"]);
    expect(rows.find((r) => r.key === "transit").amount).toBe(77);
    expect(rows.find((r) => r.key === "adjustedBank").rule).toBe(true);
    expect(proofRows(null)).toEqual([]);
  });

  it("says in one sentence whether it can be finished", () => {
    expect(readiness(proof)).toEqual({ ready: true, text: "The two sides agree. This can be finished." });
    expect(readiness({ ...proof, canFinish: false, blockers: [{ message: "2 statement lines are not matched or ignored yet" }] })).toEqual({ ready: false, text: "2 statement lines are not matched or ignored yet" });
    expect(readiness(null).ready).toBe(false);
  });
});
