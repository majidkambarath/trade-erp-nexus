// What the Trial balance screen shows: how its rows are grouped, filtered and totalled.
//
// Pure, so the rules are tested without rendering anything (the house pattern: lib/dayReports.js,
// lib/yearEnd.js, lib/periodClose.js). The screen holds the choices; this decides what they mean.
//
// WHY GROUP-WISE EXISTS. A trial balance of 34 accounts on the live books is 13 customer accounts,
// 18 expense accounts and a handful of real ones. Read account by account it is unreadable, and
// eight of those customers have settled in full and carry nothing at all. Every accounting package
// answers this the same way: Tally opens a trial balance GROUP-WISE and expands to ledgers on
// demand, and Xero, QuickBooks and Zoho all offer a rule for which rows are worth drawing.

import { formatNumber } from "../utils/format";

export const CATEGORY_LABELS = {
  ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses",
};
// The order a trial balance is read in, not alphabetical.
const CATEGORY_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
export const CATEGORY_OPTIONS = CATEGORY_ORDER.map((k) => [k, CATEGORY_LABELS[k]]);

export const VIEW_OPTIONS = [["group", "Group-wise"], ["account", "Account-wise"]];

// Which rows are worth drawing. The wording is Zoho's, because it is the clearest of the three and
// it says what it does: a settled customer account has transactions but no balance, and the two
// questions ("did anything happen?" and "is anything owed?") have different answers.
export const SHOW_OPTIONS = [
  ["all", "All accounts"],
  ["activity", "With transactions in the period"],
  ["nonzero", "With a closing balance"],
];

const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
const ZERO = 0.005; // the rounding the server uses; below this an amount is nothing

/** The group a row belongs to: the deepest group it names. "Ungrouped" is a real answer, not a gap. */
export const groupOf = (row) => {
  const path = Array.isArray(row?.groupPath) ? row.groupPath.filter(Boolean) : [];
  if (path.length) return path[path.length - 1];
  return row?.groupName || "Ungrouped";
};

/** Where it sits in the chart, for the caption under a group heading: "Current Assets > Accounts Receivable". */
export const groupPathLabel = (row) => {
  const path = Array.isArray(row?.groupPath) ? row.groupPath.filter(Boolean) : [];
  if (path.length > 1) return path.join(" > ");
  return groupOf(row);
};

const hasActivity = (row) => Math.abs(row.totalDebits || 0) >= ZERO || Math.abs(row.totalCredits || 0) >= ZERO;
const hasBalance = (row) => Math.abs(row.closingDebit || 0) >= ZERO || Math.abs(row.closingCredit || 0) >= ZERO;

/**
 * The rows a set of choices leaves. `search` matches the account name, its code and its group, so
 * typing "receivable" finds the group and typing "AR0007" finds the one account.
 */
export function filterRows(rows = [], { search = "", category = "", group = "", show = "all" } = {}) {
  const term = String(search || "").trim().toLowerCase();
  return rows.filter((row) => {
    if (category && row.category !== category) return false;
    if (group && groupOf(row) !== group) return false;
    if (show === "activity" && !hasActivity(row)) return false;
    if (show === "nonzero" && !hasBalance(row)) return false;
    if (!term) return true;
    return [row.accountName, row.accountCode, groupPathLabel(row)]
      .some((t) => String(t || "").toLowerCase().includes(term));
  });
}

/** True when any choice is narrowing the report, which is what puts "Clear filters" on the screen. */
export const isFiltered = ({ search = "", category = "", group = "", show = "all" } = {}) =>
  Boolean(String(search || "").trim()) || Boolean(category) || Boolean(group) || show !== "all";

/** Every group present in the rows, in reading order, for the Group filter. */
export function groupOptions(rows = []) {
  const seen = new Map();
  for (const row of rows) {
    const name = groupOf(row);
    if (!seen.has(name)) seen.set(name, { name, label: groupPathLabel(row), category: row.category });
  }
  return [...seen.values()]
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
      || a.label.localeCompare(b.label))
    .map((g) => [g.name, g.label]);
}

export const sumRows = (rows = []) => rows.reduce((t, r) => ({
  openingBalance: r2(t.openingBalance + (r.openingBalance || 0)),
  totalDebits: r2(t.totalDebits + (r.totalDebits || 0)),
  totalCredits: r2(t.totalCredits + (r.totalCredits || 0)),
  closingDebit: r2(t.closingDebit + (r.closingDebit || 0)),
  closingCredit: r2(t.closingCredit + (r.closingCredit || 0)),
}), { openingBalance: 0, totalDebits: 0, totalCredits: 0, closingDebit: 0, closingCredit: 0 });

/**
 * The rows collapsed to one line per group, each carrying the accounts under it so a group can be
 * opened without asking the server again. Groups read in category order, as a trial balance does.
 */
export function groupRows(rows = []) {
  const byName = new Map();
  for (const row of rows) {
    const name = groupOf(row);
    // Keyed on the category as well. A chart group has exactly one category, but the "Ungrouped"
    // fallback does not: merging an asset with an income account under one heading would print a
    // subtotal that is the sum of two different things.
    const key = `${row.category}|${name}`;
    if (!byName.has(key)) {
      byName.set(key, { key, name, label: groupPathLabel(row), category: row.category, accounts: [] });
    }
    byName.get(key).accounts.push(row);
  }
  return [...byName.values()]
    .map((g) => ({ ...g, ...sumRows(g.accounts), count: g.accounts.length }))
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
      || a.label.localeCompare(b.label));
}

/**
 * Whether what is on screen still proves itself. The report as a whole always balances; a FILTERED
 * trial balance is a slice of it and generally does not, so the screen must say which it is showing
 * rather than printing "out of balance" at somebody who merely asked for the payables.
 */
export const balanceOf = (totals) => ({
  difference: r2((totals.closingDebit || 0) - (totals.closingCredit || 0)),
  isBalanced: Math.abs(r2((totals.closingDebit || 0) - (totals.closingCredit || 0))) < 0.01,
});

/** The CSV is what is on the screen: the same rows, the same order, the same grouping. */
export function trialBalanceCsv(view, groups, accounts, totals) {
  const money = (n) => (Math.abs(n || 0) < ZERO ? "" : formatNumber(n, 2));
  const lines = [];
  if (view === "group") {
    for (const g of groups) {
      lines.push([`${g.label} (${g.count})`, CATEGORY_LABELS[g.category] || g.category, money(g.openingBalance),
        money(g.totalDebits), money(g.totalCredits), money(g.closingDebit), money(g.closingCredit)]);
      for (const a of g.accounts) {
        lines.push([`    ${a.accountCode} ${a.accountName}`.trimEnd(), "", money(a.openingBalance),
          money(a.totalDebits), money(a.totalCredits), money(a.closingDebit), money(a.closingCredit)]);
      }
    }
  } else {
    for (const a of accounts) {
      lines.push([`${a.accountCode} ${a.accountName}`.trim(), CATEGORY_LABELS[a.category] || a.category,
        money(a.openingBalance), money(a.totalDebits), money(a.totalCredits), money(a.closingDebit), money(a.closingCredit)]);
    }
  }
  lines.push(["Total", "", "", money(totals.totalDebits), money(totals.totalCredits), money(totals.closingDebit), money(totals.closingCredit)]);
  return { headers: ["Account", "Category", "Opening", "Debit", "Credit", "Closing Dr", "Closing Cr"], lines };
}

/**
 * What the figures above the table say. With nothing narrowed, the SERVER's summary is the report:
 * it is the figure that proves the ledger balances, and re-adding the rows on screen must not
 * quietly replace it. Narrowed, there is no server figure for a slice, so the rows add themselves up.
 */
export const reportTotals = (summary, computed) => ({
  ...computed,
  totalDebits: summary?.totalDebits ?? computed.totalDebits,
  totalCredits: summary?.totalCredits ?? computed.totalCredits,
  closingDebit: summary?.closingDebit ?? computed.closingDebit,
  closingCredit: summary?.closingCredit ?? computed.closingCredit,
});
