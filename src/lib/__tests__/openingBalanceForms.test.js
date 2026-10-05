import { describe, it, expect } from "vitest";
import {
  accountTotals, accountsPayload, emptyAccountRow, emptyPartyRow, emptyStockRow, equityNet, hasEntries, itemAverages,
  partyPayload, partyTotals, stockPayload, stockRowCents, stockTotals, validateAccountRows, validatePartyRows, validateStockRows,
} from "../openingBalanceForms";

const row = (over) => ({ ...emptyAccountRow(), ...over });

describe("account balances", () => {
  it("totals the sides in cents and puts the difference on the side that is short", () => {
    const t = accountTotals([row({ accountId: "a", debit: "5,000.10" }), row({ accountId: "b", debit: "0.20" }), row({ accountId: "c", credit: "2000" }), emptyAccountRow()]);
    expect(t).toMatchObject({ count: 3, debit: 500030, credit: 200000, diff: 300030 });
    expect(t.equity).toEqual({ amount: 300030, side: "credit" }); // more debit: equity takes the credit
    expect(accountTotals([row({ accountId: "a", credit: "10" })]).equity).toEqual({ amount: 1000, side: "debit" });
    expect(accountTotals([row({ accountId: "a", debit: "10" }), row({ accountId: "b", credit: "10" })]).equity).toEqual({ amount: 0, side: null });
  });

  it("never shows 0.30000000000000004: 0.1 + 0.2 is 30 cents", () => {
    expect(accountTotals([row({ accountId: "a", debit: "0.1" }), row({ accountId: "b", debit: "0.2" })]).debit).toBe(30);
  });

  it("ignores spare rows and names what is wrong with a used one", () => {
    expect(validateAccountRows([emptyAccountRow(), emptyAccountRow()])).toEqual({ _: "Enter at least one account balance" });
    expect(validateAccountRows([row({ accountId: "a", debit: "5" }), emptyAccountRow()])).toEqual({});
    const e = validateAccountRows([row({ debit: "5" }), row({ accountId: "b" }), row({ accountId: "c", debit: "1", credit: "1" }), row({ accountId: "a", debit: "1" }), row({ accountId: "a", credit: "1" })]);
    expect(e[0]).toBe("Choose an account");
    expect(e[1]).toBe("Enter an amount");
    expect(e[2]).toBe("Enter a debit or a credit, not both");
    expect(e[3]).toBeUndefined();
    expect(e[4]).toBe("This account is already on row 4");
  });

  it("builds the request from the used rows only, with plain numbers", () => {
    const body = accountsPayload({ date: "2026-06-30", rows: [row({ accountId: "a", debit: "1,250.5" }), emptyAccountRow(), row({ accountId: "b", credit: "300" })] });
    expect(body).toEqual({ date: "2026-06-30", lines: [{ accountId: "a", debit: 1250.5, credit: 0 }, { accountId: "b", debit: 0, credit: 300 }] });
  });
});

describe("customer and vendor invoices", () => {
  const prow = (over) => ({ ...emptyPartyRow(), ...over });
  const goLive = "2026-06-30";

  it("counts the used rows, the parties and the total", () => {
    const t = partyTotals([prow({ partyId: "p1", amount: "100.5" }), prow({ partyId: "p1", reference: "X", amount: "20" }), prow({ partyId: "p2", amount: "0.1" }), emptyPartyRow()]);
    expect(t).toEqual({ count: 3, cents: 12060, parties: 2 });
  });

  it("checks party, amount and dates", () => {
    const e = validatePartyRows(
      [prow({ amount: "5" }), prow({ partyId: "p", amount: "" }), prow({ partyId: "p", reference: "A", amount: "5", date: "2026-07-01" }), prow({ partyId: "p", reference: "B", amount: "5", date: "2026-05-10", dueDate: "2026-05-01" }), prow({ partyId: "p", reference: "C", amount: "5", date: "2026-05-10", dueDate: "2026-06-10" })],
      { goLive }
    );
    expect(e[0]).toBe("Choose who it is for");
    expect(e[1]).toBe("Enter an amount greater than zero");
    expect(e[2]).toMatch(/after the go-live day/);
    expect(e[3]).toBe("The due date is before the invoice date");
    expect(e[4]).toBeUndefined();
  });

  it("an invoice with no date is dated the go-live day, so a due date before it is wrong", () => {
    expect(validatePartyRows([prow({ partyId: "p", reference: "A", amount: "5", dueDate: "2026-06-01" })], { goLive })[0]).toBe("The due date is before the invoice date");
  });

  it("catches a repeated invoice, a second lump sum, and what was entered earlier", () => {
    const rows = [
      prow({ partyId: "p", reference: "INV-1", amount: "5" }), prow({ partyId: "p", reference: "INV-1", amount: "5" }),
      prow({ partyId: "p", amount: "9" }), prow({ partyId: "p", amount: "9" }),
      prow({ partyId: "q", reference: "OLD", amount: "1" }), prow({ partyId: "q", amount: "1" }),
      prow({ partyId: "r", reference: "INV-1", amount: "5" }),
    ];
    const e = validatePartyRows(rows, { goLive, existing: [{ partyId: "q", reference: "OLD" }, { partyId: "q", reference: "" }] });
    expect(e[0]).toBeUndefined();
    expect(e[1]).toBe("Invoice INV-1 is already on row 1");
    expect(e[2]).toBeUndefined();
    expect(e[3]).toBe("This party already has a lump sum on row 3");
    expect(e[4]).toBe("Invoice OLD is already entered");
    expect(e[5]).toBe("A lump-sum balance for this party was entered earlier");
    expect(e[6]).toBeUndefined(); // the same number for another party is fine
  });

  it("sends the optional fields only when they are filled in; an empty reference is the lump sum", () => {
    const body = partyPayload({
      type: "customer", date: "2026-06-30",
      rows: [prow({ partyId: "p", reference: " INV-1 ", date: "2026-05-01", dueDate: "2026-05-31", amount: "1,200.50" }), prow({ partyId: "q", amount: "750" }), emptyPartyRow()],
    });
    expect(body).toEqual({
      type: "customer", date: "2026-06-30",
      rows: [{ partyId: "p", reference: "INV-1", date: "2026-05-01", dueDate: "2026-05-31", amount: 1200.5 }, { partyId: "q", amount: 750 }],
    });
  });
});

describe("opening stock", () => {
  const srow = (over) => ({ ...emptyStockRow(), ...over });
  const items = [
    { _id: "rice", itemName: "Rice", batchTracked: false, canEnter: true },
    { _id: "milk", itemName: "Milk", batchTracked: true, canEnter: true },
    { _id: "sugar", itemName: "Sugar", batchTracked: false, canEnter: false },
  ];

  it("values a row as quantity x unit cost to 2 decimals", () => {
    expect(stockRowCents(srow({ qty: "10", unitCost: "5" }))).toBe(5000);
    expect(stockRowCents(srow({ qty: "7", unitCost: "3.3333" }))).toBe(2333); // 23.3331
    expect(stockRowCents(srow({ qty: "3", unitCost: "2.1111" }))).toBe(633); // 6.3333
    expect(stockRowCents(srow({ qty: "1.005", unitCost: "1" }))).toBe(101); // half up, not 1.00
    expect(stockRowCents(srow({ qty: "0", unitCost: "5" }))).toBe(0);
    expect(stockRowCents(srow({ qty: "5", unitCost: "" }))).toBe(0);
    expect(stockRowCents(srow({ qty: "2", unitCost: "0" }))).toBe(0);
  });

  it("totals quantity and value; the average per item is total cost over total quantity", () => {
    const rows = [srow({ itemId: "rice", qty: "10", unitCost: "5" }), srow({ itemId: "rice", qty: "30", unitCost: "7" }), srow({ itemId: "milk", qty: "24", unitCost: "2.5" }), emptyStockRow()];
    expect(stockTotals(rows)).toEqual({ count: 3, items: 2, qty: 64, cents: 5000 + 21000 + 6000 });
    const avg = itemAverages(rows, items);
    expect(avg.find((a) => a.itemId === "rice")).toMatchObject({ qty: 40, cents: 26000, avg: 6.5 });
    expect(avg.find((a) => a.itemId === "milk").avg).toBe(2.5);
    // to 5 decimals, as the server keeps it
    const odd = itemAverages([srow({ itemId: "rice", qty: "7", unitCost: "3.3333" }), srow({ itemId: "rice", qty: "3", unitCost: "2.1111" })], items);
    expect(odd[0]).toMatchObject({ qty: 10, cents: 2966, avg: 2.966 });
  });

  it("refuses a missing item, quantity or cost, and an item that cannot take opening stock", () => {
    const { errors } = validateStockRows(
      [srow({ qty: "1", unitCost: "1" }), srow({ itemId: "rice", qty: "0", unitCost: "1" }), srow({ itemId: "rice", qty: "1" }), srow({ itemId: "rice", qty: "1", unitCost: "-1" }), srow({ itemId: "sugar", qty: "1", unitCost: "1" }), srow({ itemId: "rice", qty: "5", unitCost: "0" })],
      items, "2026-06-30"
    );
    expect(errors[0]).toBe("Choose an item");
    expect(errors[1]).toBe("The quantity must be greater than zero");
    expect(errors[2]).toBe("Enter the unit cost (0 or more)");
    expect(errors[3]).toBe("Enter the unit cost (0 or more)");
    expect(errors[4]).toMatch(/stock adjustment/);
    expect(errors[5]).toBeUndefined(); // a free item is allowed
  });

  it("a batch-tracked item needs a batch number and an expiry date", () => {
    const { errors } = validateStockRows(
      [srow({ itemId: "milk", qty: "5", unitCost: "2" }), srow({ itemId: "milk", qty: "5", unitCost: "2", batchNo: "M1" }), srow({ itemId: "milk", qty: "5", unitCost: "2", batchNo: "M1", expiryDate: "2027-01-01" })],
      items, "2026-06-30"
    );
    expect(errors[0]).toMatch(/batch-tracked/);
    expect(errors[1]).toMatch(/batch-tracked/);
    expect(errors[2]).toBeUndefined();
  });

  it("an expiry on or before the go-live day warns but does not block", () => {
    const { errors, warnings } = validateStockRows(
      [srow({ itemId: "rice", qty: "5", unitCost: "2", batchNo: "R1", expiryDate: "2026-06-30" }), srow({ itemId: "rice", qty: "5", unitCost: "2", batchNo: "R2", expiryDate: "2026-07-01" })],
      items, "2026-06-30"
    );
    expect(errors).toEqual({});
    expect(warnings[0]).toMatch(/already show as expired/);
    expect(warnings[1]).toBeUndefined();
  });

  it("builds the request with numbers, and only the batch fields that were filled", () => {
    expect(stockPayload({ date: "2026-06-30", rows: [srow({ itemId: "rice", qty: "10", unitCost: "5.5", batchNo: " B1 ", expiryDate: "2027-03-01" }), srow({ itemId: "milk", qty: "2", unitCost: "0" }), emptyStockRow()] })).toEqual({
      date: "2026-06-30",
      rows: [{ itemId: "rice", qty: 10, unitCost: 5.5, batchNo: "B1", expiryDate: "2027-03-01" }, { itemId: "milk", qty: 2, unitCost: 0 }],
    });
  });
});

describe("the review", () => {
  it("knows when something has been entered, and shows equity as a credit balance", () => {
    const empty = { sections: { accounts: { vouchers: 0 }, customers: { rows: 0 }, vendors: { rows: 0 }, stock: { vouchers: 0 } }, trialBalance: { equity: { openingBalance: 0 } } };
    expect(hasEntries(empty)).toBe(false);
    expect(hasEntries({ ...empty, sections: { ...empty.sections, customers: { rows: 2 } } })).toBe(true);
    expect(hasEntries(null)).toBe(false);
    expect(equityNet({ trialBalance: { equity: { openingBalance: 31600.5 } } })).toBe(-31600.5);
    expect(equityNet(null)).toBe(-0);
  });
});
