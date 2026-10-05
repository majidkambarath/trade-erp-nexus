import { formatDate, formatNumber } from "../utils/format";

// Pure rules for the IFRS statements screen: turning what the API returns into the rows of a
// statement, the CSV, the printed page, the headline figures and the warnings. No rendering here,
// so all of it is tested without a browser.
//
// A "document" is what every tab shows:
//   { title, period, blocks: [Block] }
//   Block = { type: "table", title?, columns: [heading], rows: [Row], signed? }
//         | { type: "text", title, text }
//         | { type: "footnote", text }
//   Row   = { kind: "heading" | "label" | "line" | "detail" | "subtotal" | "total", level, label, code?, values: [number|null] }
// A table has one value per column; amounts are in AED, a negative is a deduction or an outflow.

export const TABS = [
  { value: "position", label: "Financial position" },
  { value: "pl", label: "Profit or loss" },
  { value: "equity", label: "Changes in equity" },
  { value: "cash", label: "Cash flows" },
  { value: "notes", label: "Notes" },
];

export const COMPARE_OPTIONS = [
  { value: "prior-year", label: "Prior year" },
  { value: "prior-period", label: "Prior period" },
  { value: "none", label: "None" },
];

const TAB_REQUEST = {
  position: { method: "financialPosition", slug: "financial-position", asAt: true },
  pl: { method: "profitOrLoss", slug: "profit-or-loss" },
  equity: { method: "changesInEquity", slug: "changes-in-equity" },
  cash: { method: "cashFlows", slug: "cash-flows" },
  notes: { method: "notes", slug: "notes", asAt: true },
};

export const isTab = (value) => TABS.some((t) => t.value === value);
// The financial position and the notes are as at one day; the others cover a period.
export const isAsAtTab = (tab) => Boolean(TAB_REQUEST[tab]?.asAt);

// The API method to call and its query for a tab.
export function requestFor(tab, { from, to, compare }) {
  const t = TAB_REQUEST[tab];
  return { method: t.method, params: t.asAt ? { asAt: to, compare } : { from, to, compare } };
}

export const fileSlug = (tab) => TAB_REQUEST[tab].slug;

// ---------------------------------------------------------------- numbers and dates

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;
const num = (n) => (n === null || n === undefined ? null : r2(n));
const scale = (n, s) => (n === null || n === undefined ? null : r2(n * s));

// 1,234.50, a deduction as (1,234.50), nothing as an en dash (or `zero`).
export function formatAmount(n, { zero = "–" } = {}) {
  if (n === null || n === undefined || n === "") return "";
  const v = r2(n);
  if (v === 0) return zero;
  return v < 0 ? `(${formatNumber(-v, 2)})` : formatNumber(v, 2);
}

const span = (a, b) => `${formatDate(a)} – ${formatDate(b)}`;
const fromTo = (x) => span(x.from, x.to);

// ---------------------------------------------------------------- the five documents

const heading = (label, level = 0) => ({ kind: "heading", level, label, values: [] });
const caption = (label, level) => ({ kind: "label", level, label, values: [] });
const skipZero = (l) => l.optional && !l.amount && !l.comparative;

// Statement of financial position. `detail` lists the accounts under each group.
export function positionDocument(data, { detail = false } = {}) {
  const cmp = Boolean(data.comparative);
  const columns = [formatDate(data.asAt), ...(cmp ? [formatDate(data.comparative.asAt)] : [])];
  const values = (p) => (cmp ? [num(p.amount), num(p.comparative)] : [num(p.amount)]);
  const rows = [];
  const group = (g, level) => {
    rows.push({ kind: "line", level, label: g.name, values: values(g) });
    if (detail && !g.synthetic) {
      for (const a of g.accounts) rows.push({ kind: "detail", level: level + 1, code: a.accountCode, label: a.accountName, values: values(a) });
    }
  };
  const section = (sec, label, totalLabel) => {
    rows.push(heading(label, 1));
    sec.groups.forEach((g) => group(g, 2));
    rows.push({ kind: "subtotal", level: 1, label: totalLabel, values: values(sec) });
  };
  const e = data.equityAndLiabilities;
  rows.push(heading("ASSETS"));
  section(data.assets.nonCurrent, "Non-current assets", "Total non-current assets");
  section(data.assets.current, "Current assets", "Total current assets");
  rows.push({ kind: "total", level: 0, label: "TOTAL ASSETS", values: values(data.assets) });
  rows.push(heading("EQUITY AND LIABILITIES"));
  section(e.equity, "Equity", "Total equity");
  section(e.nonCurrentLiabilities, "Non-current liabilities", "Total non-current liabilities");
  section(e.currentLiabilities, "Current liabilities", "Total current liabilities");
  rows.push({ kind: "subtotal", level: 0, label: "Total liabilities", values: values(e.liabilities) });
  rows.push({ kind: "total", level: 0, label: "TOTAL EQUITY AND LIABILITIES", values: values(e) });
  return {
    title: "Statement of financial position",
    period: `As at ${formatDate(data.asAt)}`,
    blocks: [
      { type: "table", columns, rows },
      { type: "footnote", text: POSITION_FOOTNOTE },
    ],
  };
}

export const POSITION_FOOTNOTE =
  "Classification: an asset or liability is non-current when its account group, or any group above it, is named as fixed, non-current, property, plant, equipment, intangible or long-term; everything else is current. Profit is shown inside equity: profit before the start of the period as accumulated profit brought forward, and profit since as profit for the period.";
export const PROFIT_FOOTNOTE =
  "Expenses are shown by function. Revenue, cost of sales and gross profit follow the sales and direct cost groups of the posting configuration. Of the other expenses, accounts named like depreciation or amortisation, interest, finance or bank charges, and income or corporate tax are shown on their own lines.";
export const CASH_FOOTNOTE =
  "Indirect method. Cash and cash equivalents are the active cash and bank accounts. Movements are taken from the general ledger; anything the rules cannot place appears as Other.";
export const EQUITY_FOOTNOTE =
  "Profit is not closed to equity by an entry in the ledger, so profit of earlier periods is added to retained earnings at the start of the period. Capital introduced and drawings are the net movement on each equity account.";

// Statement of profit or loss and other comprehensive income, by function. Costs are shown as
// deductions. `detail` lists the accounts under each line.
export function profitDocument(data, { detail = false } = {}) {
  const cmp = Boolean(data.comparative);
  const columns = [fromTo(data), ...(cmp ? [fromTo(data.comparative)] : [])];
  const values = (p, s = 1) => (cmp ? [scale(p.amount, s), scale(p.comparative, s)] : [scale(p.amount, s)]);
  const rows = [];
  const section = (label, block, s = 1) => {
    rows.push({ kind: "line", level: 0, label, values: values(block, s) });
    if (detail) for (const a of block.accounts) rows.push({ kind: "detail", level: 1, code: a.accountCode, label: a.accountName, values: values(a, s) });
  };
  const sub = (label, p, kind = "subtotal") => rows.push({ kind, level: 0, label, values: values(p) });
  section("Revenue", data.revenue);
  section("Cost of sales", data.costOfSales, -1);
  sub("Gross profit", data.grossProfit);
  section("Other income", data.otherIncome);
  section("Operating expenses", data.operatingExpenses, -1);
  section("Depreciation and amortisation", data.depreciationAndAmortisation, -1);
  sub("Operating profit", data.operatingProfit);
  section("Finance costs", data.financeCosts, -1);
  sub("Profit before tax", data.profitBeforeTax);
  section("Income tax expense", data.incomeTaxExpense, -1);
  sub("Profit for the period", data.profitForPeriod, "total");
  rows.push({ kind: "line", level: 0, label: "Other comprehensive income", values: values(data.otherComprehensiveIncome) });
  sub("Total comprehensive income for the period", data.totalComprehensiveIncome, "total");
  return {
    title: "Statement of profit or loss and other comprehensive income",
    period: `For the period ${fromTo(data)}`,
    blocks: [
      { type: "table", columns, rows },
      { type: "footnote", text: PROFIT_FOOTNOTE },
    ],
  };
}

// Statement of cash flows, indirect method. Inflows are positive, outflows in brackets.
export function cashDocument(data) {
  const cmp = Boolean(data.comparative);
  const columns = [fromTo(data), ...(cmp ? [fromTo(data.comparative)] : [])];
  const values = (p) => (cmp ? [num(p.amount), num(p.comparative)] : [num(p.amount)]);
  const rows = [];
  const line = (l, level, kind = "line") => {
    if (!skipZero(l)) rows.push({ kind, level, label: l.label, values: values(l) });
  };
  const op = data.operating;

  rows.push(heading(op.label));
  line(op.profitBeforeTax, 1);
  rows.push(caption(`${op.adjustments.label}:`, 1));
  op.adjustments.lines.forEach((l) => line(l, 2));
  line(op.beforeWorkingCapital, 1, "subtotal");
  rows.push(caption(`${op.workingCapital.label}:`, 1));
  op.workingCapital.lines.forEach((l) => line(l, 2));
  line(op.cashGenerated, 1, "subtotal");
  line(op.interestPaid, 1);
  line(op.incomeTaxPaid, 1);
  line(op.net, 0, "subtotal");

  for (const part of [data.investing, data.financing]) {
    rows.push(heading(part.label));
    part.lines.forEach((l) => line(l, 1));
    line(part.net, 0, "subtotal");
  }

  line(data.other, 0);
  line(data.netIncrease, 0, "total");
  line(data.openingCash, 0);
  line(data.closingCash, 0, "total");
  return {
    title: "Statement of cash flows",
    period: `For the period ${fromTo(data)}`,
    blocks: [
      { type: "table", columns, rows },
      { type: "footnote", text: CASH_FOOTNOTE },
    ],
  };
}

const EQUITY_ROW_KIND = { opening: "subtotal", comprehensive: "subtotal", closing: "total" };

// Statement of changes in equity: one table per period, a column per kind of equity.
export function equityDocument(data) {
  const periods = [data.current, data.comparative].filter(Boolean);
  // a column with nothing in it for any period is left out
  const empty = (key) => key !== "total" && periods.every((b) => b.rows.every((r) => !r.values[key]));
  const columns = data.columns.filter((c) => !empty(c.key));
  const table = (block, title) => ({
    type: "table",
    ...(title ? { title } : {}),
    columns: columns.map((c) => c.label),
    rows: block.rows.map((r) => ({ kind: EQUITY_ROW_KIND[r.key] || "line", level: 0, label: r.label, values: columns.map((c) => num(r.values[c.key])) })),
  });
  const cmp = Boolean(data.comparative);
  return {
    title: "Statement of changes in equity",
    period: `For the period ${fromTo(data)}`,
    blocks: [
      table(data.current, cmp ? `Current period: ${fromTo(data.current)}` : null),
      ...(cmp ? [table(data.comparative, `Comparative period: ${fromTo(data.comparative)}`)] : []),
      { type: "footnote", text: EQUITY_FOOTNOTE },
    ],
  };
}

// The notes: the policies as text, then the note tables from the ledger.
export function notesDocument(data) {
  const cmp = Boolean(data.comparative);
  const columns = [formatDate(data.asAt), ...(cmp ? [formatDate(data.comparative.asAt)] : [])];
  const values = (p) => (cmp ? [num(p.amount), num(p.comparative)] : [num(p.amount)]);
  const t = data.tables;
  let n = 0;
  const numbered = (title) => `${(n += 1)}. ${title}`;
  const blocks = [];

  for (const p of data.policies) blocks.push({ type: "text", title: numbered(p.title), text: p.text });

  const amounts = (rows) => rows.filter((r) => !skipZero(r)).map((r) => ({ kind: "line", level: 0, label: r.label, values: values(r) }));
  const ageingTable = (title, ageing, ledgerLabel, unsetLabel, ledgerTotal) => ({
    type: "table",
    title,
    columns: ["Amount"],
    rows: [
      ...ageing.buckets.map((b) => ({ kind: "line", level: 0, label: b.label, values: [num(b.amount)] })),
      { kind: "subtotal", level: 0, label: "Open invoices", values: [num(ageing.total)] },
      { kind: "detail", level: 1, label: "of which overdue", values: [num(ageing.overdue)] },
      ...(ageing.notSetAgainstInvoices ? [{ kind: "line", level: 0, label: unsetLabel, values: [num(ageing.notSetAgainstInvoices)] }] : []),
      { kind: "total", level: 0, label: ledgerLabel, values: [num(ledgerTotal)] },
    ],
  });

  blocks.push({
    type: "table", title: numbered("Trade and other receivables"), columns,
    rows: [...amounts(t.tradeReceivables.rows), { kind: "total", level: 0, label: "Total trade and other receivables", values: values(t.tradeReceivables.total) }],
  });
  blocks.push(ageingTable(
    `Ageing of trade receivables at ${formatDate(data.asAt)}`, t.tradeReceivables.ageing,
    "Trade receivables per ledger", "Receipts and credit notes not set against an invoice", t.tradeReceivables.rows[0].amount
  ));
  blocks.push({
    type: "table", title: numbered("Inventories"), columns,
    rows: [
      ...t.inventory.accounts.map((a) => ({ kind: "line", level: 0, code: a.accountCode, label: a.accountName, values: values(a) })),
      { kind: "total", level: 0, label: "Total inventories", values: values(t.inventory.total) },
    ],
  });
  blocks.push({ type: "footnote", text: `Inventories are measured at ${t.inventory.basis.toLowerCase()}.` });
  blocks.push({
    type: "table", title: numbered("Cash and cash equivalents"), columns, signed: true,
    rows: [
      ...t.cash.accounts.map((a) => ({ kind: "line", level: 0, code: a.accountCode, label: a.accountName, values: cmp ? [num(a.net), num(a.comparativeNet)] : [num(a.net)] })),
      { kind: "total", level: 0, label: "Total cash and cash equivalents", values: cmp ? [num(t.cash.total.net), num(t.cash.total.comparativeNet)] : [num(t.cash.total.net)] },
    ],
  });
  blocks.push({
    type: "table", title: numbered("Trade and other payables"), columns,
    rows: [...amounts(t.tradePayables.rows), { kind: "total", level: 0, label: "Total trade and other payables", values: values(t.tradePayables.total) }],
  });
  blocks.push(ageingTable(
    `Ageing of trade payables at ${formatDate(data.asAt)}`, t.tradePayables.ageing,
    "Trade payables per ledger", "Payments and debit notes not set against an invoice", t.tradePayables.rows[0].amount
  ));
  if (t.vat) {
    blocks.push({
      type: "table", title: numbered("Value added tax"), columns,
      rows: [
        ...t.vat.rows.map((r) => ({ kind: "line", level: 0, label: r.label, values: values(r) })),
        { kind: "total", level: 0, label: "Net VAT payable / (recoverable)", values: values(t.vat.net) },
      ],
    });
  }
  blocks.push({ type: "footnote", text: data.disclaimer });
  return { title: "Notes to the financial statements", period: `As at ${formatDate(data.asAt)}`, blocks };
}

export function buildDocument(tab, data, options = {}) {
  switch (tab) {
    case "position": return positionDocument(data, options);
    case "pl": return profitDocument(data, options);
    case "equity": return equityDocument(data);
    case "cash": return cashDocument(data);
    case "notes": return notesDocument(data);
    default: throw new Error(`Unknown statement ${tab}`);
  }
}

// ---------------------------------------------------------------- headline figures and warnings

const TONES = ["teal", "plum", "olive", "neutral"];

// The four (or three) numbers shown above a statement.
export function keyFigures(tab, data) {
  const gain = (title, p, tone) => ({ title, p, tone: p.amount < 0 ? "danger" : tone });
  const list = {
    position: () => [
      { title: "Total assets", p: data.assets },
      { title: "Total liabilities", p: data.equityAndLiabilities.liabilities },
      { title: "Total equity", p: data.equityAndLiabilities.equity },
    ],
    pl: () => [
      { title: "Revenue", p: data.revenue },
      gain("Gross profit", data.grossProfit, "teal"),
      gain("Profit before tax", data.profitBeforeTax, "plum"),
      gain("Profit for the period", data.profitForPeriod, "olive"),
    ],
    equity: () => {
      const row = (key) => data.current.rows.find((r) => r.key === key).values.total;
      return [
        { title: "Equity at start", p: { amount: row("opening") } },
        gain("Total comprehensive income", { amount: row("comprehensive") }, "teal"),
        { title: "Capital less drawings", p: { amount: row("introduced") + row("reduced") } },
        { title: "Equity at end", p: { amount: row("closing") } },
      ];
    },
    cash: () => [
      { title: "Operating activities", p: data.operating.net },
      { title: "Investing activities", p: data.investing.net },
      { title: "Financing activities", p: data.financing.net },
      { title: "Cash at end of period", p: data.closingCash },
    ],
  }[tab];
  if (!list) return [];
  return list().map((f, i) => ({
    title: f.title,
    value: f.p.amount,
    tone: f.tone || TONES[i % TONES.length],
    sub: f.p.comparative === null || f.p.comparative === undefined ? "AED" : `Comparative ${formatAmount(f.p.comparative, { zero: "0.00" })}`,
  }));
}

const money = (n) => formatNumber(Math.abs(n), 2);

// What is wrong with a statement, in words. Empty when it is sound.
export function warnings(tab, data) {
  const out = [];
  if (tab === "position") {
    if (!data.isBalanced) out.push(`Assets differ from equity and liabilities by ${money(data.difference)}. The ledger does not balance.`);
    if (data.comparativeIsBalanced === false) out.push(`The comparative does not balance: assets differ from equity and liabilities by ${money(data.comparativeDifference)}.`);
  }
  if (tab === "cash") {
    if (!data.reconciles) out.push(`The statement does not reconcile to the ledger: closing cash differs from the cash and bank balance by ${money(data.difference)}.`);
    if (data.comparativeReconciles === false) out.push(`The comparative does not reconcile to the ledger: closing cash differs by ${money(data.comparativeDifference)}.`);
  }
  if (tab === "equity") {
    if (!data.current.reconciles) out.push(`Closing equity differs from the equity in the statement of financial position by ${money(data.current.difference)}.`);
    if (data.comparative && !data.comparative.reconciles) out.push(`The comparative closing equity differs from the statement of financial position by ${money(data.comparative.difference)}.`);
  }
  return out;
}

// ---------------------------------------------------------------- CSV and print

const indent = (level) => "  ".repeat(level || 0);
const rowCells = (r) => [`${indent(r.level)}${r.code ? `${r.code} ` : ""}${r.label}`, ...r.values];

// The whole document as one table of cells: numbers stay numbers, deductions stay negative.
export function documentCsv(doc) {
  const tables = doc.blocks.filter((b) => b.type === "table");
  const headers = ["Line item", ...(tables[0]?.columns || [])];
  const rows = [];
  for (const b of doc.blocks) {
    if (b.type === "text") rows.push([b.title, b.text]);
    else if (b.type === "table") {
      // each further table gets a blank line and a heading row of its own
      if (b !== tables[0]) rows.push([], [b.title || "", ...b.columns]);
      else if (b.title) rows.push([b.title]);
      for (const r of b.rows) rows.push(rowCells(r));
    }
  }
  return { headers, rows };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const ROW_CLASS = { heading: "h", label: "l", detail: "d", subtotal: "s", total: "t" };

function tableHtml(b) {
  const head = `<tr><th></th>${b.columns.map((c) => `<th class="n">${esc(c)}</th>`).join("")}</tr>`;
  const body = b.rows
    .map((r) => {
      const label = `${r.code ? `<small>${esc(r.code)}</small> ` : ""}${esc(r.label)}`;
      const cells = r.kind === "heading"
        ? `<td colspan="${b.columns.length + 1}" style="padding-left:${(r.level || 0) * 16}px">${label}</td>`
        : `<td style="padding-left:${(r.level || 0) * 16 + 8}px">${label}</td>${b.columns.map((_, i) => `<td class="n">${esc(b.signed ? signedText(r.values[i]) : formatAmount(r.values[i], { zero: r.kind === "total" || r.kind === "subtotal" ? "0.00" : "–" }))}</td>`).join("")}`;
      return `<tr class="${ROW_CLASS[r.kind] || ""}">${cells}</tr>`;
    })
    .join("");
  return `${b.title ? `<h3>${esc(b.title)}</h3>` : ""}<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

// 8,371.00 Dr / 150.00 Cr, the way a ledger balance is written.
export function signedText(net) {
  if (net === null || net === undefined) return "";
  const v = r2(net);
  return `${formatNumber(Math.abs(v), 2)}${v > 0 ? " Dr" : v < 0 ? " Cr" : ""}`;
}

// A plain printable page: company, statement, period, "AED", then the tables and notes.
export function documentHtml(doc, { company = "", trn = "", currency = "AED" } = {}) {
  const blocks = doc.blocks
    .map((b) => {
      if (b.type === "table") return tableHtml(b);
      if (b.type === "text") return `<h3>${esc(b.title)}</h3><p>${esc(b.text)}</p>`;
      return `<p class="f">${esc(b.text)}</p>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>
    body{font:13px system-ui,sans-serif;margin:32px;color:#111} h1{font-size:18px;margin:0 0 2px} h2{font-size:15px;margin:0;font-weight:600} h3{font-size:13px;margin:20px 0 6px}
    .meta{margin:2px 0 14px;color:#555} table{width:100%;border-collapse:collapse;margin-top:8px} th,td{padding:5px 8px;text-align:left;vertical-align:top}
    thead th{border-bottom:1px solid #111;font-weight:600} .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    tr.h td{font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.04em;color:#555;padding-top:12px} tr.l td{color:#555} tr.d td{color:#555;font-size:12px}
    tr.s td{font-weight:600;border-top:1px solid #999} tr.t td{font-weight:600;border-top:1px solid #111;border-bottom:3px double #111} small{color:#666}
    p{margin:0 0 6px;line-height:1.45} .f{color:#555;font-size:11px;margin-top:14px}
  </style></head><body>
    <h1>${esc(company)}</h1>${trn ? `<div class="meta">TRN ${esc(trn)}</div>` : ""}
    <h2>${esc(doc.title)}</h2><div class="meta">${esc(doc.period)} &middot; Amounts in ${esc(currency)}</div>
    ${blocks}
    <script>window.onload=function(){window.print()}</script></body></html>`;
}

// Opens the printable page in its own window. False when the browser blocked the window.
export function printDocument(doc, meta) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return false;
  w.document.write(documentHtml(doc, meta));
  w.document.close();
  return true;
}
