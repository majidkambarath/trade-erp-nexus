// The daily voucher summary and the day-end cash and bank report (services/reports/ledgerReportsService.js: dailySummary,
// dayEndSummary, dayEndRegister). The server does the sums; this does the small things around them: stepping from one day
// to the next, which day was busiest, and the shape of each report as a CSV.
//
// Days are the organisation's calendar days as "YYYY-MM-DD", so day arithmetic is done on the text and never on a local
// clock (a person's laptop may be in another zone from the books).

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The day `n` days from `day` ("2026-03-01", -1 -> "2026-02-28"); the same text back when it is not a day. */
export function shiftDay(day, n) {
  if (!DAY.test(String(day || ""))) return day;
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** The cell of one day and kind in the daily summary: { count, amount }, or null when there was none. */
export const cellOf = (day, type) => day?.byType?.[type] || null;

/** The day with the most vouchers (the later one on a tie), or null. */
export function busiestDay(days) {
  let best = null;
  for (const d of days || []) if (!best || d.count > best.count) best = d;
  return best;
}

/** Headers and rows of the daily summary: each kind of voucher as a count and an amount, a total row last. */
export function dailySummaryCsv(summary, formatDay) {
  const types = summary?.types || [];
  const headers = ["Date", "Vouchers", "Out of balance", ...types.flatMap((t) => [`${t.label} (count)`, `${t.label} (amount)`])];
  const line = (first, d) => [first, d.count, d.unbalanced || 0, ...types.flatMap((t) => [d.byType?.[t.voucherType]?.count ?? "", d.byType?.[t.voucherType]?.amount ?? ""])];
  const rows = (summary?.days || []).map((d) => line(formatDay ? formatDay(d.day) : d.day, d));
  if (summary?.totals) rows.push(line("Total", summary.totals));
  return { headers, rows };
}

/** Headers and rows of one day's cash and bank report: the accounts, then cash, bank and the whole. */
export function dayEndCsv(report) {
  const headers = ["Code", "Account", "Type", "Opening", "Receipts", "Payments", "Closing", "Vouchers"];
  const t = report?.totals || {};
  const rows = (report?.accounts || []).map((a) => [a.accountCode, a.accountName, a.kind === "cash" ? "Cash" : "Bank", a.opening, a.receipts, a.payments, a.closing, a.vouchers]);
  for (const [label, k] of [["Total cash", "cash"], ["Total bank", "bank"], ["Total cash and bank", "all"]]) {
    if (t[k]) rows.push(["", label, "", t[k].opening, t[k].receipts, t[k].payments, t[k].closing, ""]);
  }
  return { headers, rows };
}

/** Headers and rows of the day-by-day register: a brought-forward row, then each day. */
export function registerCsv(register, formatDay) {
  const headers = ["Day", "Cash in", "Cash out", "Cash closing", "Bank in", "Bank out", "Bank closing", "Total closing"];
  const o = register?.opening;
  const rows = [];
  if (o) rows.push(["Brought forward", "", "", o.cash, "", "", o.bank, o.all]);
  for (const d of register?.days || []) rows.push([formatDay ? formatDay(d.day) : d.day, d.cash.in, d.cash.out, d.cash.closing, d.bank.in, d.bank.out, d.bank.closing, d.closing]);
  return { headers, rows };
}
