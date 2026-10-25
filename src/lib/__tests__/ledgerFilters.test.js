import { describe, it, expect } from "vitest";
import * as LF from "../ledgerFilters";

// Narrowing a report the server has already grouped. The trial balance does its own grouping and has
// its own module; these two keep the same vocabulary - Category, Group, Rows - so a choice means the
// same thing on both screens.

const acct = (code, name, debit, credit, closing) => ({ accountId: code, accountCode: code, accountName: name, opening: 0, debit, credit, closing });
const group = (name, category, accounts) => ({
  groupId: `g-${name}`, name, category, accounts,
  totals: accounts.reduce((t, a) => ({ opening: 0, debit: t.debit + a.debit, credit: t.credit + a.credit, closing: t.closing + a.closing }), { opening: 0, debit: 0, credit: 0, closing: 0 }),
});

const LEDGER = [
  group("Cash", "ASSET", [acct("CASH0001", "Cash in Hand", 7606, 0, 7606)]),
  group("Accounts Receivable", "ASSET", [
    acct("AR0001", "Customer - Majid", 550, 550, 0),
    acct("AR0011", "Customer - Owing", 460, 0, 460),
  ]),
  group("Accounts Payable", "LIABILITY", [acct("AP0001", "Vendor - Malabar", 0, 1350, -1350)]),
];

describe("filtering a grouped ledger", () => {
  it("by group: only the payables", () => {
    const out = LF.filterGroups(LEDGER, { group: "Accounts Payable" });
    expect(out.map((g) => g.name)).toEqual(["Accounts Payable"]);
  });

  it("by category: only what is owed", () => {
    expect(LF.filterGroups(LEDGER, { category: "LIABILITY" }).map((g) => g.name)).toEqual(["Accounts Payable"]);
  });

  it("by closing balance: a settled customer drops out, and so does an emptied group", () => {
    const out = LF.filterGroups(LEDGER, { show: "nonzero" });
    const receivables = out.find((g) => g.name === "Accounts Receivable");
    expect(receivables.accounts.map((a) => a.accountCode)).toEqual(["AR0011"]);
    // nothing in Cash is settled, so it survives whole
    expect(out.find((g) => g.name === "Cash").accounts).toHaveLength(1);
  });

  it("a group left with no accounts is dropped, not left as an empty heading", () => {
    const out = LF.filterGroups([group("Quiet", "ASSET", [acct("Q1", "Dormant", 0, 0, 0)])], { show: "activity" });
    expect(out).toEqual([]);
  });

  it("searching the GROUP name keeps everything under it", () => {
    const out = LF.filterGroups(LEDGER, { search: "receivable" });
    expect(out).toHaveLength(1);
    expect(out[0].accounts).toHaveLength(2);
  });

  it("searching an account name keeps only that account, inside its group", () => {
    const out = LF.filterGroups(LEDGER, { search: "majid" });
    expect(out).toHaveLength(1);
    expect(out[0].accounts.map((a) => a.accountCode)).toEqual(["AR0001"]);
  });

  it("a group's totals are recomputed from what survived", () => {
    // a subtotal that still counts rows nobody can see is simply wrong
    const out = LF.filterGroups(LEDGER, { show: "nonzero" });
    const receivables = out.find((g) => g.name === "Accounts Receivable");
    expect(receivables.totals.debit).toBe(460);
    expect(receivables.totals.closing).toBe(460);
  });

  it("the choices compose, and the originals are never changed", () => {
    const before = JSON.stringify(LEDGER);
    expect(LF.filterGroups(LEDGER, { category: "ASSET", show: "nonzero", search: "owing" })
      .flatMap((g) => g.accounts).map((a) => a.accountCode)).toEqual(["AR0011"]);
    expect(JSON.stringify(LEDGER)).toBe(before);
  });

  it("survives a report that is empty or malformed", () => {
    expect(LF.filterGroups([], { group: "x" })).toEqual([]);
    expect(LF.filterGroups(undefined, {})).toEqual([]);
    expect(LF.filterGroups([{ name: "No accounts", category: "ASSET" }], {})).toEqual([]);
  });
});

describe("the totals and the group list", () => {
  it("sums the groups that are showing", () => {
    expect(LF.sumGroups(LEDGER)).toEqual({ opening: 0, debit: 8616, credit: 1900, closing: 6716 });
  });

  it("counts accounts, not groups", () => {
    expect(LF.countAccounts(LEDGER)).toBe(4);
    expect(LF.countAccounts([])).toBe(0);
  });

  it("offers the groups in reading order: assets before liabilities", () => {
    expect(LF.groupChoices(LEDGER).map(([v]) => v)).toEqual(["Accounts Receivable", "Cash", "Accounts Payable"]);
  });

  it("knows when a choice is leaving something out", () => {
    expect(LF.isNarrowed({})).toBe(false);
    expect(LF.isNarrowed({ show: "all", search: "  " })).toBe(false);
    expect(LF.isNarrowed({ group: "Cash" })).toBe(true);
    expect(LF.isNarrowed({ show: "nonzero" })).toBe(true);
    // how the report is READ hides nothing, so it does not count
    expect(LF.isNarrowed({ groupsOnly: true, closing: true })).toBe(false);
  });
});
