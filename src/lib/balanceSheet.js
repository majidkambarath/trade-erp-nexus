// The Balance sheet on Reports -> Statements, as a statement rather than a list of accounts.
//
// Pure: the screen holds the choices, this decides what they mean and what the rows are. Rows come
// out in the same `{ kind, level, label, values }` shape lib/ifrsStatements.js uses, so the two
// balance sheets in the product are drawn by the same kind of code and read the same way.
//
// It must DEGRADE. A server from before the classified `sections` existed answers only the flat
// `assets` / `liabilities` / `equity` arrays; this then draws one ungrouped section per side rather
// than nothing at all, which is the standing rule for reading a new field with `?.`.

import { formatAmount } from "./ifrsStatements";

export { formatAmount };

// What to put beside the as-at column. A balance sheet is a position on a day, so a comparison is
// another day - not another range. "Prior period" is deliberately absent: for a position it has no
// single honest meaning, and the IFRS tab offers the nuanced version for anyone who needs it.
export const COMPARE_OPTIONS = [
  ["none", "No comparison"],
  ["year", "A year earlier"],
  ["month", "A month earlier"],
];

const pad = (n) => String(n).padStart(2, "0");
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * The day to compare with. A month end stays a month end: comparing 30 November with 30 October is
 * right, but comparing 31 March with 31 February is not a date at all, so the end of the month is
 * what is meant.
 */
export function compareDate(asOf, mode) {
  if (!asOf || mode === "none" || !mode) return null;
  const y = Number(asOf.slice(0, 4));
  const m = Number(asOf.slice(5, 7));
  const d = Number(asOf.slice(8, 10));
  if (!y || !m || !d) return null;
  const back = mode === "year" ? 12 : 1;
  const total = y * 12 + (m - 1) - back;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = daysIn(ny, nm);
  const nd = d >= daysIn(y, m) ? last : Math.min(d, last);
  return `${ny}-${pad(nm)}-${pad(nd)}`;
}

const heading = (label) => ({ kind: "heading", level: 0, label, values: [] });
const num = (v) => (v === null || v === undefined ? null : v);

/**
 * The statement, as rows. `detail` lists the accounts under each group; without it the groups are
 * the statement, which is how a balance sheet is normally read.
 */
export function statementRows(data, { detail = false } = {}) {
  if (!data) return [];
  const cmp = Boolean(data.comparative);
  const vals = (x) => (cmp ? [num(x?.amount), num(x?.comparative)] : [num(x?.amount)]);
  const rows = [];

  const section = (sec) => {
    if (!sec || !sec.groups || !sec.groups.length) return;
    rows.push({ kind: "caption", level: 1, label: sec.label, values: [] });
    for (const g of sec.groups) {
      rows.push({ kind: "line", level: 2, label: g.name, values: vals(g) });
      if (detail && !g.synthetic) {
        for (const a of g.accounts || []) {
          rows.push({ kind: "detail", level: 3, id: a._id, code: a.accountCode, label: a.accountName, values: vals(a) });
        }
      }
    }
    rows.push({ kind: "subtotal", level: 1, label: `Total ${sec.label.toLowerCase()}`, values: vals(sec) });
  };

  const s = data.sections;
  if (s) {
    rows.push(heading("ASSETS"));
    section(s.assets?.nonCurrent);
    section(s.assets?.current);
    rows.push({ kind: "total", level: 0, label: "TOTAL ASSETS", values: vals(s.assets) });
    rows.push(heading("EQUITY AND LIABILITIES"));
    section(s.equity);
    section(s.liabilities?.nonCurrent);
    section(s.liabilities?.current);
    if (s.liabilities?.groups !== undefined || s.liabilities) {
      rows.push({ kind: "subtotal", level: 0, label: "Total liabilities", values: vals(s.liabilities) });
    }
    rows.push({ kind: "total", level: 0, label: "TOTAL EQUITY AND LIABILITIES", values: vals(s.equityAndLiabilities) });
    return rows;
  }

  // An older server: one flat section a side, which is what this screen always showed.
  const flat = (label, list, total) => {
    rows.push({ kind: "caption", level: 1, label, values: [] });
    for (const a of list || []) {
      rows.push({ kind: "detail", level: 2, id: a._id, code: a.accountCode, label: a.accountName, values: [num(a.amount)] });
    }
    rows.push({ kind: "subtotal", level: 1, label: `Total ${label.toLowerCase()}`, values: [num(total)] });
  };
  rows.push(heading("ASSETS"));
  flat("Assets", data.assets, data.totalAssets);
  rows.push({ kind: "total", level: 0, label: "TOTAL ASSETS", values: [num(data.totalAssets)] });
  rows.push(heading("EQUITY AND LIABILITIES"));
  flat("Equity", [...(data.equity || []), { _id: "profit", accountName: "Profit for the period", amount: data.profitToDate }], data.totalEquity);
  flat("Liabilities", data.liabilities, data.totalLiabilities);
  rows.push({ kind: "total", level: 0, label: "TOTAL EQUITY AND LIABILITIES", values: [num(data.totalLiabilitiesAndEquity)] });
  return rows;
}

/** The columns above the figures: the as-at day, and the day it is compared with. */
export const columnsOf = (asOf, data) => (data?.comparative ? [asOf, data.comparative.asOf] : [asOf]);

/** The CSV is the statement as it reads, indentation and all. */
export function balanceSheetCsv(rows, columns) {
  const pad4 = (level) => "    ".repeat(Math.max(0, level - 1));
  return {
    headers: ["", ...columns],
    lines: rows
      .filter((r) => r.kind !== "heading" || true)
      .map((r) => [
        `${pad4(r.level)}${r.code ? `${r.code} ` : ""}${r.label}`,
        ...columns.map((_, i) => (r.values[i] === null || r.values[i] === undefined ? "" : r.values[i])),
      ]),
  };
}
