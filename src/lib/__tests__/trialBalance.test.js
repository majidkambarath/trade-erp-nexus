import { describe, it, expect } from "vitest";
import * as TB from "../trialBalance";

// A trial balance of a real organisation is 13 customer accounts, 18 expense accounts and a handful
// of real ones. These are the rules that make it readable: collapse it to its groups, and let
// somebody ask for only the payables, only the receivables, or only what still carries a balance.

const row = (over) => ({
  _id: over.accountName, accountCode: "X", category: "ASSET", groupPath: ["Current Assets", "Cash"],
  openingBalance: 0, totalDebits: 0, totalCredits: 0, closingDebit: 0, closingCredit: 0, ...over,
});

const BOOKS = [
  row({ accountName: "Cash in Hand", accountCode: "CASH0001", groupPath: ["Current Assets", "Cash"], totalDebits: 7606, closingDebit: 7606 }),
  row({ accountName: "Customer - Majid", accountCode: "AR0001", groupPath: ["Current Assets", "Accounts Receivable"], totalDebits: 550, totalCredits: 550 }),
  row({ accountName: "Customer - Jashir", accountCode: "AR0008", groupPath: ["Current Assets", "Accounts Receivable"], totalDebits: 500, totalCredits: 500 }),
  row({ accountName: "Customer - Owing", accountCode: "AR0011", groupPath: ["Current Assets", "Accounts Receivable"], totalDebits: 460, closingDebit: 460 }),
  row({ accountName: "Vendor - Malabar", accountCode: "AP0001", category: "LIABILITY", groupPath: ["Current Liabilities", "Accounts Payable"], totalCredits: 1350, closingCredit: 1350 }),
  row({ accountName: "Rent", accountCode: "OE0004", category: "EXPENSE", groupPath: ["Operating Expenses"], totalDebits: 5744, closingDebit: 5744 }),
];

describe("which group a row belongs to", () => {
  it("is the deepest group it names", () => {
    expect(TB.groupOf(BOOKS[1])).toBe("Accounts Receivable");
    expect(TB.groupPathLabel(BOOKS[1])).toBe("Current Assets > Accounts Receivable");
  });

  it("reads a one-level group without a needless breadcrumb", () => {
    expect(TB.groupOf(BOOKS[5])).toBe("Operating Expenses");
    expect(TB.groupPathLabel(BOOKS[5])).toBe("Operating Expenses");
  });

  it("falls back to the group name, then says Ungrouped - never leaves a row nameless", () => {
    expect(TB.groupOf({ groupName: "Suspense" })).toBe("Suspense");
    expect(TB.groupOf({})).toBe("Ungrouped");
    expect(TB.groupOf(null)).toBe("Ungrouped");
    expect(TB.groupOf({ groupPath: [] })).toBe("Ungrouped");
  });
});

describe("collapsing to groups", () => {
  it("turns six accounts into four groups, each adding up its own", () => {
    const groups = TB.groupRows(BOOKS);
    // within a category the groups read alphabetically, which is the only order the chart gives us
    expect(groups.map((g) => g.label)).toEqual([
      "Current Assets > Accounts Receivable",
      "Current Assets > Cash",
      "Current Liabilities > Accounts Payable",
      "Operating Expenses",
    ]);
    const receivables = groups.find((g) => g.name === "Accounts Receivable");
    expect(receivables.count).toBe(3);
    expect(receivables.totalDebits).toBe(1510);
    expect(receivables.closingDebit).toBe(460);
  });

  it("reads in category order - assets, liabilities, equity, income, expenses - not alphabetically", () => {
    const groups = TB.groupRows([...BOOKS].reverse());
    expect(groups.map((g) => g.category)).toEqual(["ASSET", "ASSET", "LIABILITY", "EXPENSE"]);
  });

  it("keeps the accounts, so a group opens without asking the server again", () => {
    const receivables = TB.groupRows(BOOKS).find((g) => g.name === "Accounts Receivable");
    expect(receivables.accounts.map((a) => a.accountCode)).toEqual(["AR0001", "AR0008", "AR0011"]);
  });

  it("does not merge two categories that share the Ungrouped heading", () => {
    // an asset and an income account with no group are two different subtotals, not one
    const groups = TB.groupRows([
      row({ accountName: "Odd asset", groupPath: [], closingDebit: 100 }),
      row({ accountName: "Odd income", category: "INCOME", groupPath: [], closingCredit: 100 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.category)).toEqual(["ASSET", "INCOME"]);
  });

  it("the groups add up to the same figures as the accounts", () => {
    const groups = TB.groupRows(BOOKS);
    expect(TB.sumRows(groups)).toEqual(TB.sumRows(BOOKS));
  });
});

describe("filtering", () => {
  it("by group: only the receivables", () => {
    const rows = TB.filterRows(BOOKS, { group: "Accounts Receivable" });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => TB.groupOf(r) === "Accounts Receivable")).toBe(true);
  });

  it("by category: only what is owed", () => {
    expect(TB.filterRows(BOOKS, { category: "LIABILITY" }).map((r) => r.accountCode)).toEqual(["AP0001"]);
  });

  it("by closing balance: the settled customers drop out", () => {
    // two customers paid in full - transactions, but nothing owed. This is the clutter.
    const rows = TB.filterRows(BOOKS, { show: "nonzero" });
    expect(rows.map((r) => r.accountCode)).toEqual(["CASH0001", "AR0011", "AP0001", "OE0004"]);
  });

  it("by activity: an account that merely exists drops out, a settled one does not", () => {
    const quiet = row({ accountName: "Dormant", accountCode: "Z1" });
    const rows = TB.filterRows([...BOOKS, quiet], { show: "activity" });
    expect(rows.map((r) => r.accountCode)).not.toContain("Z1");
    expect(rows.map((r) => r.accountCode)).toContain("AR0001");
  });

  it("search matches the name, the code and the group", () => {
    expect(TB.filterRows(BOOKS, { search: "jashir" }).map((r) => r.accountCode)).toEqual(["AR0008"]);
    expect(TB.filterRows(BOOKS, { search: "AP0001" }).map((r) => r.accountCode)).toEqual(["AP0001"]);
    expect(TB.filterRows(BOOKS, { search: "receivable" })).toHaveLength(3);
  });

  it("the choices compose", () => {
    const rows = TB.filterRows(BOOKS, { category: "ASSET", group: "Accounts Receivable", show: "nonzero" });
    expect(rows.map((r) => r.accountCode)).toEqual(["AR0011"]);
  });

  it("knows when it is narrowing anything, which is what offers Clear filters", () => {
    expect(TB.isFiltered({})).toBe(false);
    expect(TB.isFiltered({ search: "", category: "", group: "", show: "" })).toBe(false);
    expect(TB.isFiltered({ search: "   " })).toBe(false);
    expect(TB.isFiltered({ show: "nonzero" })).toBe(true);
    expect(TB.isFiltered({ group: "Cash" })).toBe(true);
    // the layout is how it is read, not a filter: it hides nothing, and it is not kept here
    expect(TB.isFiltered({ view: "account" })).toBe(false);
  });
});

describe("the group filter offers what is actually there", () => {
  it("one entry per group, in category order", () => {
    expect(TB.groupOptions(BOOKS)).toEqual([
      ["Accounts Receivable", "Current Assets > Accounts Receivable"],
      ["Cash", "Current Assets > Cash"],
      ["Accounts Payable", "Current Liabilities > Accounts Payable"],
      ["Operating Expenses", "Operating Expenses"],
    ]);
  });

  it("offers nothing for an empty report rather than throwing", () => {
    expect(TB.groupOptions([])).toEqual([]);
    expect(TB.groupRows([])).toEqual([]);
    expect(TB.filterRows(undefined, { group: "x" })).toEqual([]);
  });
});

describe("what the figures above the table say", () => {
  it("unfiltered, the server's summary is the report - not a re-addition of the rows", () => {
    // the server knows about rounding and about rows the screen may not be drawing
    const summary = { totalDebits: 999, totalCredits: 999, closingDebit: 500, closingCredit: 500 };
    const totals = TB.reportTotals(summary, TB.sumRows(BOOKS));
    expect(totals.closingDebit).toBe(500);
    expect(totals.totalDebits).toBe(999);
  });

  it("an older server that sends no summary falls back to the rows", () => {
    expect(TB.reportTotals(undefined, TB.sumRows(BOOKS)).closingDebit).toBe(TB.sumRows(BOOKS).closingDebit);
    expect(TB.reportTotals({}, TB.sumRows(BOOKS)).totalDebits).toBe(TB.sumRows(BOOKS).totalDebits);
  });

  it("a slice of a trial balance generally does not balance, and says so", () => {
    const part = TB.sumRows(TB.filterRows(BOOKS, { group: "Accounts Receivable" }));
    expect(TB.balanceOf(part).isBalanced).toBe(false);
    expect(TB.balanceOf(TB.sumRows(BOOKS)).difference).toBe(
      TB.sumRows(BOOKS).closingDebit - TB.sumRows(BOOKS).closingCredit,
    );
  });

  it("a hundredth of a unit is not a difference worth shouting about", () => {
    expect(TB.balanceOf({ closingDebit: 100, closingCredit: 100.004 }).isBalanced).toBe(true);
    expect(TB.balanceOf({ closingDebit: 100, closingCredit: 100.02 }).isBalanced).toBe(false);
  });
});

describe("the CSV is what is on the screen", () => {
  it("group-wise writes the group line then its accounts, indented", () => {
    const groups = TB.groupRows(BOOKS);
    const { headers, lines } = TB.trialBalanceCsv("group", groups, BOOKS, TB.sumRows(BOOKS));
    expect(headers[0]).toBe("Account");
    expect(lines[0][0]).toBe("Current Assets > Accounts Receivable (3)");
    expect(lines[1][0]).toBe("    AR0001 Customer - Majid");
    expect(lines[lines.length - 1][0]).toBe("Total");
  });

  it("account-wise writes one line per account and the same total", () => {
    const rows = TB.filterRows(BOOKS, { show: "nonzero" });
    const { lines } = TB.trialBalanceCsv("account", [], rows, TB.sumRows(rows));
    expect(lines).toHaveLength(rows.length + 1);
    expect(lines[0][0]).toBe("CASH0001 Cash in Hand");
  });

  it("writes nothing rather than 0.00 where there is no figure", () => {
    const { lines } = TB.trialBalanceCsv("account", [], [BOOKS[1]], TB.sumRows([BOOKS[1]]));
    expect(lines[0][5]).toBe(""); // closing Dr of a settled customer
  });
});
