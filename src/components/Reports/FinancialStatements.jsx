import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, CheckCircle2, Download, TriangleAlert } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { amountsIn, formatDate, CURRENCY, downloadCSV, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { EmptyState, PageHeader, Panel, Pill, useAsync } from "../accounting/kit";
import { LedgerModal } from "../accounting/ChartOfAccounts";
import { ClosingEntriesToggle, DateRange, Frame, ViewBar, yearStart } from "./reportKit";
import FilterBar, { FilterSelect } from "../lists/FilterBar";
import { pageSession } from "../../lib/pageSession";
import * as TB from "../../lib/trialBalance";
import * as BSL from "../../lib/balanceSheet";
import SavedViews from "../lists/SavedViews";
import { useListView } from "../../lib/useListView";

const money = (n) => formatNumber(n, 2);
const CAT = { ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses" };
const DEFAULT_TB_FILTERS = { category: "", group: "", show: "", closing: false };
const TAB_IDS = ["trial", "pl", "cash", "bs"];

// The core statements, all read from the same ledger: they cannot disagree with each other.
export default function FinancialStatements() {
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get("tab")) ? params.get("tab") : "trial";
  const [range, setRange] = useState({ from: yearStart(), to: todayInput() });
  const [ledgerFor, setLedgerFor] = useState(null);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Financial statements" description="Trial balance, profit and loss, cash flow and balance sheet, from the general ledger." />
      <DateRange value={range} onChange={setRange} asAt={tab === "bs"} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="erp-scroll table-pin-first overflow-x-auto"><TabsList>
          <TabsTrigger value="trial">Trial balance</TabsTrigger><TabsTrigger value="pl">Profit and loss</TabsTrigger><TabsTrigger value="cash">Cash flow</TabsTrigger><TabsTrigger value="bs">Balance sheet</TabsTrigger>
        </TabsList></div>
        <TabsContent value="trial">{tab === "trial" && <TrialBalance range={range} onLedger={setLedgerFor} />}</TabsContent>
        <TabsContent value="pl">{tab === "pl" && <ProfitLoss range={range} onLedger={setLedgerFor} />}</TabsContent>
        <TabsContent value="cash">{tab === "cash" && <CashFlow range={range} />}</TabsContent>
        <TabsContent value="bs">{tab === "bs" && <BalanceSheet asOf={range.to} onLedger={setLedgerFor} />}</TabsContent>
      </Tabs>
      {ledgerFor && <LedgerModal account={{ _id: ledgerFor._id, accountCode: ledgerFor.accountCode, accountName: ledgerFor.accountName }} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

function TrialBalance({ range, onLedger }) {
  // The same state platform the master lists use, so this report gets saved views for free: a named
  // set of filters ("Payables only") that reopens later. The hook is storage and state, nothing
  // list-shaped, which is why a report can sit on it (lib/useListView.js).
  const list = useListView("trial-balance", { filters: DEFAULT_TB_FILTERS });
  const session = pageSession("trial-balance");
  const [open, setOpen] = useState(() => session.get("open", {}));
  // The layout is not a filter - it hides no row - so it is remembered beside the open groups
  // rather than inside list.filters, where it would read as "this report is narrowed".
  const [view, setView] = useState(() => session.get("view", "group"));
  const f = list.filters;
  const choices = { ...f, search: list.search };
  const toggle = (key) => setOpen((o) => {
    const next = { ...o, [key]: !o[key] };
    session.set("open", next);
    return next;
  });
  const state = useAsync(
    () => accounting.trialBalance({ dateFrom: range.from, dateTo: `${range.to}T23:59:59.999`, includeClosing: f.closing || undefined }),
    [range.from, range.to, f.closing],
  );

  return (
    <div className="space-y-4">
    <Frame state={state}>
      {(d) => {
        const all = d.trialBalance;
        const rows = TB.filterRows(all, choices);
        const groups = TB.groupRows(rows);
        // `view` is how the report is READ and `closing` is which entries it covers; neither hides a
        // row, so neither counts as narrowing it. Only a choice that leaves accounts out does.
        const narrowed = TB.isFiltered(choices);
        const totals = narrowed ? TB.sumRows(rows) : TB.reportTotals(d.summary, TB.sumRows(rows));
        const { isBalanced, difference } = narrowed ? TB.balanceOf(totals) : TB.balanceOf(d.summary);
        const exportCsv = () => {
          const { headers, lines } = TB.trialBalanceCsv(view, groups, rows, totals);
          downloadCSV(`trial-balance-${range.to}${narrowed ? "-filtered" : ""}.csv`, headers, lines);
        };
        const cell = (n) => (Math.abs(n || 0) < 0.005 ? "" : money(n));

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="Debits in period" count={money(totals.totalDebits)} tone="teal" subText={CURRENCY} />
              <StatCard title="Credits in period" count={money(totals.totalCredits)} tone="plum" subText={CURRENCY} />
              <StatCard title="Closing debits" count={money(totals.closingDebit)} tone="neutral" subText={CURRENCY} />
              <StatCard title="Closing credits" count={money(totals.closingCredit)} tone="neutral" subText={CURRENCY} />
            </div>
            <ViewBar list={list}>
              <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
                <input type="checkbox" checked={Boolean(f.closing)} onChange={(e) => list.setFilter("closing", e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
                Include year-end closing entries
              </label>
            </ViewBar>
            <FilterBar
              search={list.search}
              onSearch={list.setSearch}
              searchLabel="Search accounts"
              placeholder="Search accounts…"
              active={narrowed}
              onClear={() => { list.setSearch(""); list.clearFilters(); }}
              dense
            >
              <FilterSelect label="Layout" value={view} onChange={(v) => { setView(v); session.set("view", v); }} options={TB.VIEW_OPTIONS} className="sm:w-40" />
              <FilterSelect label="Category" value={f.category} onChange={(v) => { list.setFilter("category", v); list.setFilter("group", ""); }} options={TB.CATEGORY_OPTIONS} allLabel="All categories" className="sm:w-40" />
              <FilterSelect label="Group" value={f.group} onChange={(v) => list.setFilter("group", v)} options={TB.groupOptions(TB.filterRows(all, { ...choices, group: "" }))} allLabel="All groups" className="sm:w-56" />
              <FilterSelect label="Rows" value={f.show} onChange={(v) => list.setFilter("show", v)} options={TB.SHOW_OPTIONS} allLabel={TB.SHOW_ALL_LABEL} className="sm:w-56" />
                  </FilterBar>


            <Panel
              bodyClassName="p-0"
              title={narrowed ? "Part of the trial balance" : (isBalanced ? "In balance" : "Out of balance")}
              description={narrowed
                ? `Showing ${rows.length} of ${all.length} accounts. A part of a trial balance does not balance on its own - clear the filters to prove the whole.`
                : undefined}
              actions={<>
                {!narrowed && (
                  <Pill tone={isBalanced ? "success" : "danger"}>
                    {isBalanced ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <TriangleAlert className="h-3 w-3" aria-hidden="true" />}
                    {isBalanced ? "Debits equal credits" : `Difference ${money(Math.abs(difference))}`}
                  </Pill>
                )}
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>
              </>}
            >
              {rows.length === 0 && (
                <EmptyState
                  title={all.length ? "No account matches these filters" : "No postings"}
                  text={all.length ? "Widen the filters, or clear them to see the whole trial balance." : "Nothing has been posted to the ledger up to this date."}
                />
              )}
              {rows.length > 0 && (
                <div className="erp-scroll table-pin-first overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Trial balance{narrowed ? ", filtered" : ""}</caption>
                    <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="px-5 py-2 text-start">Account</th><th className="px-3 py-2 text-start">Category</th><th className="px-3 py-2 text-end">Opening</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-3 py-2 text-end">Closing Dr</th><th className="px-5 py-2 text-end">Closing Cr</th></tr>
                    </thead>
                    <tbody>
                      {view === "group"
                        ? groups.map((g) => (
                          <React.Fragment key={g.key}>
                            <tr className="border-t border-border bg-secondary/30">
                              <td className="px-5 py-2">
                                <button type="button" onClick={() => toggle(g.key)} aria-expanded={!!open[g.key]} className="flex items-center gap-1.5 text-start font-medium hover:underline">
                                  {open[g.key] ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
                                  {g.label}
                                  <span className="ms-1 text-xs font-normal text-muted-foreground">{g.count}</span>
                                </button>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{CAT[g.category]}</td>
                              <td className="px-3 py-2 text-end font-medium tabular-nums">{cell(g.openingBalance)}</td>
                              <td className="px-3 py-2 text-end font-medium tabular-nums">{cell(g.totalDebits)}</td>
                              <td className="px-3 py-2 text-end font-medium tabular-nums">{cell(g.totalCredits)}</td>
                              <td className="px-3 py-2 text-end font-medium tabular-nums">{cell(g.closingDebit)}</td>
                              <td className="px-5 py-2 text-end font-medium tabular-nums">{cell(g.closingCredit)}</td>
                            </tr>
                            {open[g.key] && g.accounts.map((a) => (
                              <tr key={a._id} className="border-t border-border hover:bg-accent/40">
                                <td className="py-1.5 pe-3 ps-11"><button type="button" onClick={() => onLedger(a)} className="text-start hover:underline"><span className="me-2 font-mono text-xs text-muted-foreground">{a.accountCode}</span>{a.accountName}</button></td>
                                <td className="px-3 py-1.5" />
                                <td className="px-3 py-1.5 text-end tabular-nums">{cell(a.openingBalance)}</td>
                                <td className="px-3 py-1.5 text-end tabular-nums">{cell(a.totalDebits)}</td>
                                <td className="px-3 py-1.5 text-end tabular-nums">{cell(a.totalCredits)}</td>
                                <td className="px-3 py-1.5 text-end tabular-nums">{cell(a.closingDebit)}</td>
                                <td className="px-5 py-1.5 text-end tabular-nums">{cell(a.closingCredit)}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                        : rows.map((a) => (
                          <tr key={a._id} className="border-t border-border hover:bg-accent/40">
                            <td className="px-5 py-2"><button type="button" onClick={() => onLedger(a)} className="text-start hover:underline"><span className="me-2 font-mono text-xs text-muted-foreground">{a.accountCode}</span>{a.accountName}</button></td>
                            <td className="px-3 py-2 text-muted-foreground">{CAT[a.category]}</td>
                            <td className="px-3 py-2 text-end tabular-nums">{cell(a.openingBalance)}</td>
                            <td className="px-3 py-2 text-end tabular-nums">{cell(a.totalDebits)}</td>
                            <td className="px-3 py-2 text-end tabular-nums">{cell(a.totalCredits)}</td>
                            <td className="px-3 py-2 text-end tabular-nums">{cell(a.closingDebit)}</td>
                            <td className="px-5 py-2 text-end tabular-nums">{cell(a.closingCredit)}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-border bg-secondary/60 font-semibold"><td className="px-5 py-2.5" colSpan={3}>{narrowed ? `Total of these ${rows.length} accounts` : "Total"}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(totals.totalDebits)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(totals.totalCredits)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(totals.closingDebit)}</td><td className="px-5 py-2.5 text-end tabular-nums">{money(totals.closingCredit)}</td></tr></tfoot>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        );
      }}
    </Frame>
    </div>
  );
}

// ---------- profit and loss, as a statement: revenue - cost of sales = gross profit, ... = net profit ----------

function StatementBlock({ title, section, onLedger }) {
  const { groups, total } = section;
  return (
    <>
      <tr className="bg-secondary/50"><th colSpan={2} scope="colgroup" className="px-5 py-2 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</th></tr>
      {groups.length === 0 && <tr><td colSpan={2} className="px-5 py-2.5 text-sm text-muted-foreground">Nothing in this period.</td></tr>}
      {groups.map((g) => (
        <React.Fragment key={g.groupId || g.name}>
          {(groups.length > 1 || g.synthetic) && <tr><td colSpan={2} className="px-5 pt-2.5 text-xs font-medium text-muted-foreground">{g.name}</td></tr>}
          {g.accounts.map((a) => (
            <tr key={a.accountId} className="hover:bg-accent/40">
              <td className="py-1.5 pe-3 ps-9 text-sm"><button type="button" onClick={() => onLedger?.({ _id: a.accountId, accountCode: a.accountCode, accountName: a.accountName })} className="text-start hover:underline"><span className="me-2 font-mono text-xs text-muted-foreground">{a.accountCode}</span>{a.accountName}</button></td>
              <td className="px-5 py-1.5 text-end text-sm tabular-nums">{money(a.amount)}</td>
            </tr>
          ))}
        </React.Fragment>
      ))}
      <tr className="border-t border-border"><td className="px-5 py-2 text-sm font-semibold">Total {title.toLowerCase()}</td><td className="px-5 py-2 text-end text-sm font-semibold tabular-nums">{money(total)}</td></tr>
    </>
  );
}

function ResultRow({ label, amount, note, tone }) {
  return (
    <tr className="border-y-2 border-border bg-secondary/70">
      <td className="px-5 py-3 text-sm font-semibold">{label}{note && <span className="ms-3 text-xs font-normal text-muted-foreground">{note}</span>}</td>
      <td className={`px-5 py-3 text-end text-sm font-semibold tabular-nums ${tone === "loss" ? "text-status-danger" : ""}`}>{money(amount)}</td>
    </tr>
  );
}

function ProfitLoss({ range, onLedger }) {
  const state = useAsync(() => accounting.profitLossDetail({ from: range.from, to: range.to }), [range.from, range.to]);
  return (
    <Frame state={state}>
      {(d) => {
        const exportCsv = () => {
          const lines = [];
          // a synthetic group (sales discounts, which are taken off revenue) gets a row of its own: its amounts are negative
          const block = (title, s) => { lines.push([title, "", ""]); s.groups.forEach((g) => { if (g.synthetic) lines.push(["", g.name, ""]); g.accounts.forEach((a) => lines.push([a.accountCode, a.accountName, a.amount])); }); lines.push(["", `Total ${title.toLowerCase()}`, s.total]); };
          block("Revenue", d.revenue); block("Cost of sales", d.directCosts); lines.push(["", "Gross profit", d.grossProfit]);
          block("Other income", d.otherIncome); block("Operating expenses", d.operatingExpenses); lines.push(["", "Net profit", d.netProfit]);
          downloadCSV(`profit-and-loss-${range.from}-${range.to}.csv`, ["Code", "Account", "Amount"], lines);
        };
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="Revenue" count={money(d.revenue.total)} tone="olive" subText={CURRENCY} />
              <StatCard title="Gross profit" count={money(d.grossProfit)} tone="teal" subText={d.grossMargin == null ? "No revenue yet" : `${formatNumber(d.grossMargin, 1)}% margin`} />
              <StatCard title="Operating expenses" count={money(d.operatingExpenses.total)} tone="rose" subText={CURRENCY} />
              <StatCard title={d.netProfit >= 0 ? "Net profit" : "Net loss"} count={money(Math.abs(d.netProfit))} tone={d.netProfit >= 0 ? "teal" : "danger"} subText={CURRENCY} />
            </div>
            <Panel bodyClassName="p-0" title="Profit and loss" description={`Revenue less the direct cost of what was sold is the gross profit; other income and operating expenses take it to the net profit. ${amountsIn()}.`}
              actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
              <div className="erp-scroll table-pin-first overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    <StatementBlock title="Revenue" section={d.revenue} onLedger={onLedger} />
                    <StatementBlock title="Cost of sales" section={d.directCosts} onLedger={onLedger} />
                    <ResultRow label="Gross profit" amount={d.grossProfit} note={d.grossMargin == null ? "" : `${formatNumber(d.grossMargin, 1)}% of revenue`} />
                    <StatementBlock title="Other income" section={d.otherIncome} onLedger={onLedger} />
                    <StatementBlock title="Operating expenses" section={d.operatingExpenses} onLedger={onLedger} />
                    <ResultRow label={d.netProfit >= 0 ? "Net profit" : "Net loss"} amount={d.netProfit} tone={d.netProfit < 0 ? "loss" : undefined} />
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        );
      }}
    </Frame>
  );
}

// ---------- cash flow: where cash and bank money came from and went to ----------

function CashFlow({ range }) {
  const state = useAsync(() => accounting.cashFlow({ from: range.from, to: range.to }), [range.from, range.to]);
  return (
    <Frame state={state}>
      {(d) => {
        const exportCsv = () => downloadCSV(`cash-flow-${range.from}-${range.to}.csv`, ["Source", "Money in", "Money out", "Net", "Vouchers"],
          [["Opening cash and bank", "", "", d.opening, ""], ...d.lines.map((l) => [l.label, l.inflow, l.outflow, l.net, l.count]), ["Closing cash and bank", d.totalIn, d.totalOut, d.closing, ""]]);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="Opening cash and bank" count={money(d.opening)} tone="neutral" subText={CURRENCY} />
              <StatCard title="Money in" count={money(d.totalIn)} tone="olive" subText={CURRENCY} />
              <StatCard title="Money out" count={money(d.totalOut)} tone="rose" subText={CURRENCY} />
              <StatCard title="Closing cash and bank" count={money(d.closing)} tone="teal" subText={CURRENCY} />
            </div>
            <Panel bodyClassName="p-0" title="Cash flow"
              actions={<><Pill tone={d.reconciles ? "success" : "danger"}>{d.reconciles ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <TriangleAlert className="h-3 w-3" aria-hidden="true" />}{d.reconciles ? "Agrees with the cash and bank ledgers" : `Differs from the ledgers by ${money(Math.abs(d.closing - d.closingPerLedger))}`}</Pill><Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button></>}>
              {d.lines.length === 0 ? <EmptyState title="No cash or bank movement" text="Nothing went in or out of the cash and bank accounts in this period." /> : (
                <div className="erp-scroll table-pin-first overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="px-5 py-2 text-start">Source</th><th className="px-3 py-2 text-end">Money in</th><th className="px-3 py-2 text-end">Money out</th><th className="px-3 py-2 text-end">Net</th><th className="px-5 py-2 text-end">Vouchers</th></tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border bg-secondary/30"><td className="px-5 py-2 font-medium" colSpan={3}>Opening cash and bank</td><td className="px-3 py-2 text-end font-medium tabular-nums">{money(d.opening)}</td><td /></tr>
                      {d.lines.map((l) => (
                        <tr key={l.voucherType} className="border-t border-border hover:bg-accent/40">
                          <td className="px-5 py-2">{l.label}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{l.inflow ? money(l.inflow) : ""}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{l.outflow ? money(l.outflow) : ""}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{money(l.net)}</td>
                          <td className="px-5 py-2 text-end tabular-nums text-muted-foreground">{l.count}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-border bg-secondary/60 font-semibold"><td className="px-5 py-2.5">Closing cash and bank</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.totalIn)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.totalOut)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.closing)}</td><td /></tr></tfoot>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        );
      }}
    </Frame>
  );
}

// One row of the statement. The kind decides how it reads: a heading, a section caption, a group,
// an account under it, a subtotal with a rule above, or a total with a rule above and below.
function StatementRow({ row, columns, onLedger }) {
  const pad = ["ps-5", "ps-5", "ps-8", "ps-12"][Math.min(row.level, 3)];
  if (row.kind === "heading") {
    return <tr className="bg-secondary/50"><th colSpan={columns.length + 1} scope="colgroup" className="px-5 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</th></tr>;
  }
  if (row.kind === "caption") {
    return <tr><td colSpan={columns.length + 1} className={`${pad} pe-5 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground`}>{row.label}</td></tr>;
  }
  const tone = row.kind === "total"
    ? "border-y-2 border-border bg-secondary/60 font-semibold"
    : row.kind === "subtotal" ? "border-t border-border font-medium" : "hover:bg-accent/40";
  const label = row.kind === "detail" && onLedger && row.id !== "profit"
    ? <button type="button" onClick={() => onLedger({ _id: row.id, accountCode: row.code, accountName: row.label })} className="text-start hover:underline"><span className="me-2 font-mono text-xs text-muted-foreground">{row.code}</span>{row.label}</button>
    : <>{row.code && <span className="me-2 font-mono text-xs text-muted-foreground">{row.code}</span>}{row.label}</>;
  return (
    <tr className={tone}>
      <td className={`${pad} pe-3 py-1.5 text-sm`}>{label}</td>
      {columns.map((c, i) => <td key={c} className="px-5 py-1.5 text-end text-sm tabular-nums">{BSL.formatAmount(row.values[i])}</td>)}
    </tr>
  );
}

function BalanceSheet({ asOf, onLedger }) {
  const session = pageSession("balance-sheet");
  const [compare, setCompare] = useState(() => session.get("compare", "none"));
  const [detail, setDetail] = useState(() => session.get("detail", false));
  const compareTo = BSL.compareDate(asOf, compare);
  const state = useAsync(
    () => accounting.balanceSheet({ dateTo: `${asOf}T23:59:59.999`, ...(compareTo ? { compareTo: `${compareTo}T23:59:59.999` } : {}) }),
    [asOf, compareTo],
  );
  return (
    <div className="space-y-4">
      <FilterBar dense className="sm:items-end">
        <FilterSelect label="Compare with" value={compare} onChange={(v) => { setCompare(v); session.set("compare", v); }} options={BSL.COMPARE_OPTIONS} className="sm:w-48" />
        <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
          <input type="checkbox" checked={detail} onChange={(e) => { setDetail(e.target.checked); session.set("detail", e.target.checked); }} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
          Show each account
        </label>
      </FilterBar>
      <Frame state={state}>
        {(d) => {
          const columns = BSL.columnsOf(asOf, d);
          const rows = BSL.statementRows(d, { detail });
          const exportCsv = () => {
            const { headers, lines } = BSL.balanceSheetCsv(rows, columns);
            downloadCSV(`balance-sheet-${asOf}.csv`, headers, lines);
          };
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone={d.isBalanced ? "success" : "danger"}>
                  {d.isBalanced ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <TriangleAlert className="h-3 w-3" aria-hidden="true" />}
                  {d.isBalanced ? "Assets equal liabilities plus equity" : `Difference ${money(Math.abs(d.totalAssets - d.totalLiabilitiesAndEquity))}`}
                </Pill>
                <span className="hidden text-sm text-muted-foreground sm:inline">Profit earned to date is shown within equity.</span>
              </div>
              <Panel
                bodyClassName="p-0"
                title="Statement of financial position"
                description={<>{`As at ${formatDate(asOf)}. ${amountsIn()}.`}<span className="hidden sm:inline"> Deductions are shown in brackets.</span></>}
                actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}
              >
                {rows.length === 0 ? <EmptyState title="Nothing posted" text="No account carries a balance as at this date." /> : (
                  <div className="erp-scroll table-pin-first overflow-x-auto">
                    <table className="w-full">
                      <caption className="sr-only">Statement of financial position as at {formatDate(asOf)}</caption>
                      <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-5 py-2 text-start">Account</th>
                          {columns.map((c) => <th key={c} className="px-5 py-2 text-end">{formatDate(c)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => <StatementRow key={`${row.kind}-${row.label}-${i}`} row={row} columns={columns} onLedger={onLedger} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          );
        }}
      </Frame>
    </div>
  );
}
