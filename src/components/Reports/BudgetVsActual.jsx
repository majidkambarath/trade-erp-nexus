import React, { useState } from "react";
import { Download } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { monthLabel } from "../../lib/budgets";
import { amountsIn, downloadCSV, formatNumber } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { EmptyState, Panel, Pill, Select, useAsync } from "../accounting/kit";
import { Frame, useExportPreamble } from "./reportKit";

const money = (n) => formatNumber(n, 2);
const pct = (n) => (n === null || n === undefined ? "—" : `${formatNumber(n, 0)}%`);

// The months of the page's date range that fall inside the budget's year, as "YYYY-MM" (empty: the server's default, the year to date).
export function monthsInRange(range, year) {
  if (!year?.startDate || !year?.endDate || !range?.from || !range?.to) return {};
  const first = String(year.startDate).slice(0, 7);
  const last = String(year.endDate).slice(0, 7);
  const from = range.from.slice(0, 7) < first ? first : range.from.slice(0, 7);
  const to = range.to.slice(0, 7) > last ? last : range.to.slice(0, 7);
  return from <= to ? { from, to } : {};
}

// Budget against what the ledger says, per account, for the months of the page's range inside the budget's year.
export default function BudgetVsActual({ range }) {
  const list = useAsync(() => accounting.budgets(), []);
  const [chosen, setChosen] = useState("");
  const budgets = list.data || [];
  const id = chosen || budgets[0]?._id || "";
  const picked = budgets.find((b) => String(b._id) === String(id));
  const months = monthsInRange(range, picked?.year);
  const state = useAsync(() => (id ? accounting.budgetReport(id, months) : Promise.resolve(null)), [id, months.from, months.to]);
  const preambleFor = useExportPreamble(`Budget vs actual - ${picked?.name || ""}`);

  if (list.data && budgets.length === 0) {
    return <EmptyState title="No budgets yet" text="Set one up in Accounting setup > Budgets, then compare it with the books here." />;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="bva-budget" className="text-sm font-medium">Budget</label>
        <Select id="bva-budget" value={id} onChange={(e) => setChosen(e.target.value)} className="w-auto min-w-64">
          {budgets.map((b) => <option key={b._id} value={b._id}>{b.name}{b.costCentre ? ` · ${b.costCentre.name}` : ""}</option>)}
        </Select>
      </div>
      <Frame state={state}>
        {(d) => {
          if (!d) return null;
          const period = d.months.length === 1 ? monthLabel(d.from) : `${monthLabel(d.from)} to ${monthLabel(d.to)}`;
          const exportCsv = () => downloadCSV(`budget-vs-actual-${d.from}-${d.to}.csv`, ["Code", "Account", "Type", "Budget", "Actual", "Variance", "Used %"],
            [
              ...d.rows.map((r) => [r.accountCode, r.accountName, r.category === "INCOME" ? "Income" : "Expense", r.budget, r.actual, r.variance, r.used ?? ""]),
              ["", "Net result", "", d.totals.net.budget, d.totals.net.actual, d.totals.net.variance, ""],
            ],
            { preamble: preambleFor(period) });
          const section = (cat, title) => {
            const rows = d.rows.filter((r) => r.category === cat);
            const t = cat === "INCOME" ? d.totals.income : d.totals.expense;
            return (
              <>
                <tr className="bg-secondary/50"><th scope="rowgroup" colSpan={5} className="px-4 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</th></tr>
                {rows.map((r) => (
                  <tr key={r.accountId} className="border-b border-border">
                    <td className="px-4 py-2.5"><span className="me-2 font-mono text-xs text-muted-foreground">{r.accountCode}</span>{r.accountName}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{money(r.budget)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{money(r.actual)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">
                      <span className={r.favourable ? "" : "text-status-danger"}>{money(r.variance)}</span>
                      {r.variance !== 0 && <span className="ms-2 text-xs text-muted-foreground">{r.favourable ? "better" : "worse"}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{pct(r.used)}</td>
                  </tr>
                ))}
                <tr className="border-b border-border font-semibold">
                  <td className="px-4 py-2.5">Total {title.toLowerCase()}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{money(t.budget)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{money(t.actual)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{money(t.variance)}</td>
                  <td />
                </tr>
              </>
            );
          };
          const netGood = d.totals.net.variance >= 0;
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title="Budgeted result" count={money(d.totals.net.budget)} tone="neutral" subText={period} />
                <StatCard title="Actual result" count={money(d.totals.net.actual)} tone={d.totals.net.actual >= 0 ? "teal" : "danger"} subText={period} />
                <StatCard title={netGood ? "Ahead of budget" : "Behind budget"} count={money(Math.abs(d.totals.net.variance))} tone={netGood ? "olive" : "danger"} subText="Result against budget" />
                <StatCard title="Spent of expense budget" count={pct(d.totals.expense.budget ? Math.round((d.totals.expense.actual / d.totals.expense.budget) * 100) : null)} tone="rose" subText={`${money(d.totals.expense.actual)} of ${money(d.totals.expense.budget)}`} />
              </div>
              <Panel bodyClassName="p-0" title={`${d.budget.name}${d.budget.costCentre ? ` · ${d.budget.costCentre.name}` : ""}`}
                description={`${period}, against what was posted${d.budget.costCentre ? " to this cost centre" : ""}. A variance is better when income is above budget or an expense below it. ${amountsIn()}.`}
                actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
                {d.rows.length === 0 ? (
                  <EmptyState title="Nothing to compare" text="This budget has no lines and nothing was posted in these months." />
                ) : (
                  <div className="erp-scroll table-pin-first overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Budget against actual</caption>
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th scope="col" className="px-4 py-2.5 text-start font-medium">Account</th>
                          <th scope="col" className="px-4 py-2.5 text-end font-medium">Budget</th>
                          <th scope="col" className="px-4 py-2.5 text-end font-medium">Actual</th>
                          <th scope="col" className="px-4 py-2.5 text-end font-medium">Variance</th>
                          <th scope="col" className="px-4 py-2.5 text-end font-medium">Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section("INCOME", "Income")}
                        {section("EXPENSE", "Expenses")}
                        <tr className="bg-secondary/70 font-semibold">
                          <td className="px-4 py-3">Net result {!netGood && <Pill tone="danger" className="ms-2">Behind budget</Pill>}</td>
                          <td className="px-4 py-3 text-end tabular-nums">{money(d.totals.net.budget)}</td>
                          <td className="px-4 py-3 text-end tabular-nums">{money(d.totals.net.actual)}</td>
                          <td className="px-4 py-3 text-end tabular-nums">{money(d.totals.net.variance)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          );
        }}
      </Frame>
    </div>
  );
}
