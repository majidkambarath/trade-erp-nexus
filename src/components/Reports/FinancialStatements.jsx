import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, TriangleAlert } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { downloadCSV, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { EmptyState, ErrorNote, Field, PageHeader, Panel, Pill, Spinner, TextInput, useAsync } from "../accounting/kit";
import { LedgerModal } from "../accounting/ChartOfAccounts";

const money = (n) => formatNumber(n, 2);
const CAT = { ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses" };
const monthStart = () => `${todayInput().slice(0, 7)}-01`;

// The three core statements, all read from the same ledger: they cannot disagree with each other.
export default function FinancialStatements() {
  const [params, setParams] = useSearchParams();
  const tab = ["trial", "pl", "bs"].includes(params.get("tab")) ? params.get("tab") : "trial";
  const [range, setRange] = useState({ from: `${new Date().getFullYear()}-01-01`, to: todayInput() });
  const [ledgerFor, setLedgerFor] = useState(null);
  const set = (k) => (e) => e.target.value && setRange((r) => ({ ...r, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader title="Financial statements" description="Trial balance, profit and loss, and balance sheet, from the general ledger." />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        {tab !== "bs" && <Field label="From"><TextInput type="date" value={range.from} max={range.to} onChange={set("from")} className="w-44" /></Field>}
        <Field label={tab === "bs" ? "As at" : "To"}><TextInput type="date" value={range.to} min={tab === "bs" ? undefined : range.from} onChange={set("to")} className="w-44" /></Field>
        {tab !== "bs" && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setRange({ from: monthStart(), to: todayInput() })}>This month</Button>
            <Button variant="ghost" size="sm" onClick={() => setRange({ from: `${new Date().getFullYear()}-01-01`, to: todayInput() })}>This year</Button>
          </>
        )}
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="overflow-x-auto"><TabsList>
          <TabsTrigger value="trial">Trial balance</TabsTrigger><TabsTrigger value="pl">Profit and loss</TabsTrigger><TabsTrigger value="bs">Balance sheet</TabsTrigger>
        </TabsList></div>
        <TabsContent value="trial">{tab === "trial" && <TrialBalance range={range} onLedger={setLedgerFor} />}</TabsContent>
        <TabsContent value="pl">{tab === "pl" && <ProfitLoss range={range} />}</TabsContent>
        <TabsContent value="bs">{tab === "bs" && <BalanceSheet asOf={range.to} onLedger={setLedgerFor} />}</TabsContent>
      </Tabs>
      {ledgerFor && <LedgerModal account={{ _id: ledgerFor._id, accountCode: ledgerFor.accountCode, accountName: ledgerFor.accountName }} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

function Frame({ state, children }) {
  if (state.loading && !state.data) return <Spinner label="Working out the figures" />;
  if (state.error) return <ErrorNote error={state.error} onRetry={state.reload} />;
  return state.data ? children(state.data) : null;
}

function TrialBalance({ range, onLedger }) {
  const state = useAsync(() => accounting.trialBalance({ dateFrom: range.from, dateTo: `${range.to}T23:59:59.999` }), [range.from, range.to]);
  return (
    <Frame state={state}>
      {(d) => {
        const exportCsv = () => downloadCSV(`trial-balance-${range.to}.csv`,
          ["Code", "Account", "Category", "Opening", "Debit", "Credit", "Closing Dr", "Closing Cr"],
          [...d.trialBalance.map((a) => [a.accountCode, a.accountName, CAT[a.category], a.openingBalance, a.totalDebits, a.totalCredits, a.closingDebit, a.closingCredit]),
            ["", "Total", "", "", d.summary.totalDebits, d.summary.totalCredits, d.summary.closingDebit, d.summary.closingCredit]]);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="Debits in period" count={money(d.summary.totalDebits)} tone="teal" />
              <StatCard title="Credits in period" count={money(d.summary.totalCredits)} tone="plum" />
              <StatCard title="Closing debits" count={money(d.summary.closingDebit)} tone="neutral" />
              <StatCard title="Closing credits" count={money(d.summary.closingCredit)} tone="neutral" />
            </div>
            <Panel bodyClassName="p-0" title={d.summary.isBalanced ? "In balance" : "Out of balance"}
              actions={<><Pill tone={d.summary.isBalanced ? "success" : "danger"}>{d.summary.isBalanced ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <TriangleAlert className="h-3 w-3" aria-hidden="true" />}{d.summary.isBalanced ? "Debits equal credits" : `Difference ${money(Math.abs(d.summary.closingDebit - d.summary.closingCredit))}`}</Pill><Button size="sm" variant="outline" onClick={exportCsv} disabled={!d.trialBalance.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button></>}>
              {d.trialBalance.length === 0 && <EmptyState title="No postings" text="Nothing has been posted to the ledger up to this date." />}
              {d.trialBalance.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="px-5 py-2 text-start">Account</th><th className="px-3 py-2 text-start">Category</th><th className="px-3 py-2 text-end">Opening</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-3 py-2 text-end">Closing Dr</th><th className="px-5 py-2 text-end">Closing Cr</th></tr>
                    </thead>
                    <tbody>
                      {d.trialBalance.map((a) => (
                        <tr key={a._id} className="border-t border-border hover:bg-accent/40">
                          <td className="px-5 py-2"><button type="button" onClick={() => onLedger(a)} className="text-start hover:underline"><span className="me-2 font-mono text-xs text-muted-foreground">{a.accountCode}</span>{a.accountName}</button></td>
                          <td className="px-3 py-2 text-muted-foreground">{CAT[a.category]}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{money(a.openingBalance)}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{a.totalDebits ? money(a.totalDebits) : ""}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{a.totalCredits ? money(a.totalCredits) : ""}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{a.closingDebit ? money(a.closingDebit) : ""}</td>
                          <td className="px-5 py-2 text-end tabular-nums">{a.closingCredit ? money(a.closingCredit) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-border bg-secondary/60 font-semibold"><td className="px-5 py-2.5" colSpan={3}>Total</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.summary.totalDebits)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.summary.totalCredits)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.summary.closingDebit)}</td><td className="px-5 py-2.5 text-end tabular-nums">{money(d.summary.closingCredit)}</td></tr></tfoot>
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

function Section({ title, rows, total, onLedger }) {
  return (
    <Panel bodyClassName="p-0" title={title} actions={<span className="text-sm font-semibold tabular-nums">{money(total)}</span>}>
      {rows.length === 0 ? <p className="px-5 py-4 text-sm text-muted-foreground">Nothing in this period.</p> : (
        <ul className="divide-y divide-border">
          {rows.map((a) => (
            <li key={a._id} className="flex items-center gap-3 px-5 py-2 text-sm">
              <button type="button" onClick={() => onLedger?.(a)} className="min-w-0 flex-1 truncate text-start hover:underline"><span className="me-2 font-mono text-xs text-muted-foreground">{a.accountCode}</span>{a.accountName}</button>
              <span className="tabular-nums">{money(a.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ProfitLoss({ range }) {
  const state = useAsync(() => accounting.profitLoss({ dateFrom: range.from, dateTo: `${range.to}T23:59:59.999` }), [range.from, range.to]);
  return (
    <Frame state={state}>
      {(d) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard title="Income" count={money(d.totalIncome)} tone="olive" />
            <StatCard title="Expenses" count={money(d.totalExpenses)} tone="rose" />
            <StatCard title={d.netProfit >= 0 ? "Net profit" : "Net loss"} count={money(Math.abs(d.netProfit))} tone={d.netProfit >= 0 ? "teal" : "danger"} subText="AED" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Income" rows={d.income} total={d.totalIncome} />
            <Section title="Expenses" rows={d.expenses} total={d.totalExpenses} />
          </div>
        </div>
      )}
    </Frame>
  );
}

function BalanceSheet({ asOf, onLedger }) {
  const state = useAsync(() => accounting.balanceSheet({ dateTo: `${asOf}T23:59:59.999` }), [asOf]);
  return (
    <Frame state={state}>
      {(d) => (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={d.isBalanced ? "success" : "danger"}>{d.isBalanced ? "Assets equal liabilities plus equity" : "Does not balance"}</Pill>
            <span className="text-sm text-muted-foreground">Profit earned to date is shown within equity.</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4"><Section title="Assets" rows={d.assets} total={d.totalAssets} onLedger={onLedger} /></div>
            <div className="space-y-4">
              <Section title="Liabilities" rows={d.liabilities} total={d.totalLiabilities} onLedger={onLedger} />
              <Section title="Equity" rows={[...d.equity, { _id: "profit", accountCode: "", accountName: "Profit to date", amount: d.profitToDate }]} total={d.totalEquity} onLedger={(a) => a._id !== "profit" && onLedger(a)} />
              <div className="flex justify-between rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold shadow-card"><span>Liabilities and equity</span><span className="tabular-nums">{money(d.totalLiabilitiesAndEquity)}</span></div>
            </div>
          </div>
        </div>
      )}
    </Frame>
  );
}
