import { describe, it, expect } from "vitest";
import { accountOptions, findAccount, groupByMonth, monthKeyOf, monthLabel, netOf } from "../statement";

// The rules behind Reports -> Account statement that can be judged without rendering: which month a
// posting falls in, what a month's own line says, how the whole chart is offered in the picker, and the
// one figure a statement is read by - net, debit minus credit.

// A day in the organisation's own zone, which is what toInputDate gives the screen.
const dayOf = (d) => String(d).slice(0, 10);

describe("the month a posting falls in", () => {
  it("files a row under the organisation's calendar month, not UTC's", () => {
    // Dubai is four hours ahead: 2026-10-01T00:00:00Z is still 1 October there, but an hour earlier in
    // UTC is 30 September. The day must come from the organisation's clock or a month's first postings
    // file themselves under the month before.
    const dubai = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    expect(monthKeyOf("2026-10-01T00:00:00.000Z", dubai)).toBe("2026-10");
    expect(monthKeyOf("2026-09-30T21:00:00.000Z", dubai)).toBe("2026-10");
    expect(monthKeyOf("2026-09-30T19:00:00.000Z", dubai)).toBe("2026-09");
  });

  it("names a month in words, and leaves a key it cannot read alone", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthLabel("2026-01")).toBe("January 2026");
    expect(monthLabel("")).toBe("");
    expect(monthLabel("rubbish")).toBe("rubbish");
  });
});

describe("a statement cut into months", () => {
  const rows = [
    { _id: "1", date: "2026-09-20", debit: 210, credit: 0, balance: 315, net: 315 },
    { _id: "2", date: "2026-10-04", debit: 100, credit: 0, balance: 415, net: 415 },
    { _id: "3", date: "2026-10-19", debit: 0, credit: 50, balance: 365, net: 365 },
  ];

  it("keeps the months in the order they were posted, each with its own debits and credits", () => {
    const months = groupByMonth(rows, dayOf);
    expect(months.map((m) => m.label)).toEqual(["September 2026", "October 2026"]);
    expect(months[0]).toMatchObject({ debit: 210, credit: 0, closingNet: 315 });
    expect(months[1]).toMatchObject({ debit: 100, credit: 50, closingNet: 365 });
    expect(months[1].rows).toHaveLength(2);
  });

  it("reads a month's closing off the LAST row rather than adding the rows up again", () => {
    // The running balance is the server's: opening + movement = closing. A month that re-added its own
    // rows would drop whatever was carried in from before the period and disagree with the line beside it.
    const carried = [{ _id: "1", date: "2026-10-04", debit: 100, credit: 0, balance: 1100, net: 1100 }];
    const [october] = groupByMonth(carried, dayOf);
    expect(october.debit).toBe(100);
    expect(october.closingNet).toBe(1100);
  });

  it("signs a vendor's month the way the rest of the statement is signed", () => {
    // An older server sends no `net`, only the party-signed `balance`; a vendor's is positive when we owe.
    const old = [{ _id: "1", date: "2026-10-04", debit: 0, credit: 500, balance: 500 }];
    expect(groupByMonth(old, dayOf, "Vendor")[0].closingNet).toBe(-500);
    expect(groupByMonth(old, dayOf, "Customer")[0].closingNet).toBe(500);
  });

  it("adds a month's figures without the fractions binary arithmetic leaves behind", () => {
    const pennies = [
      { _id: "1", date: "2026-10-01", debit: 0.1, credit: 0, balance: 0.1, net: 0.1 },
      { _id: "2", date: "2026-10-02", debit: 0.2, credit: 0, balance: 0.3, net: 0.3 },
    ];
    expect(groupByMonth(pennies, dayOf)[0].debit).toBe(0.3);
  });

  it("has nothing to group when there is nothing to show", () => {
    expect(groupByMonth([], dayOf)).toEqual([]);
    expect(groupByMonth(undefined, dayOf)).toEqual([]);
  });
});

describe("the figure a statement is read by", () => {
  it("prefers the server's net, which means the same thing for a party and an account", () => {
    expect(netOf({ net: -315, balance: 315 }, "Vendor")).toBe(-315);
    expect(netOf({ net: 0, balance: 99 }, "Customer")).toBe(0); // a real zero, not "missing"
  });

  it("falls back to unflipping an older server's party-signed balance", () => {
    expect(netOf({ balance: 315 }, "Customer")).toBe(315);
    expect(netOf({ balance: 315 }, "Vendor")).toBe(-315);
    expect(netOf({}, "Customer")).toBe(0);
    expect(netOf(undefined, "Customer")).toBe(0);
  });
});

describe("the whole chart, offered in the picker", () => {
  const chart = [
    { _id: "a2", accountName: "Emirates NBD", accountCode: "1010", groupName: "Bank", path: "Assets › Bank" },
    { _id: "a1", accountName: "Travelling", accountCode: "5300", groupName: "Operating Expenses", path: "Expenses › Operating Expenses" },
    { _id: "a3", accountName: "Coating powder", accountCode: "5310", groupName: "Operating Expenses", path: "Expenses › Operating Expenses" },
  ];

  it("files every account under its own group, groups and names in order", () => {
    const groups = accountOptions(chart);
    expect(groups.map((g) => g.label)).toEqual(["Assets › Bank", "Expenses › Operating Expenses"]);
    expect(groups[1].options.map((o) => o.label)).toEqual(["Coating powder", "Travelling"]);
  });

  it("carries the code as the hint, and the group in the text searched", () => {
    const [bank] = accountOptions(chart);
    expect(bank.options[0]).toMatchObject({ value: "a2", label: "Emirates NBD", hint: "1010" });
    expect(bank.options[0].searchText).toContain("Bank");
  });

  it("gathers an account with no group rather than dropping it", () => {
    // An account that cannot be chosen is an account whose history cannot be read.
    const [only] = accountOptions([{ _id: "x", accountName: "Suspense", accountCode: "9999" }]);
    expect(only.label).toBe("Other accounts");
    expect(only.options).toHaveLength(1);
  });

  it("has nothing to offer before the chart has arrived", () => {
    expect(accountOptions([])).toEqual([]);
    expect(accountOptions()).toEqual([]);
  });

  it("finds the account behind an id, whatever type the id arrives as", () => {
    expect(findAccount(chart, "a1").accountName).toBe("Travelling");
    expect(findAccount(chart, "nope")).toBeNull();
    expect(findAccount([], "a1")).toBeNull();
  });
});
