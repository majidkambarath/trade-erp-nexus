import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, TriangleAlert } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { CURRENCY, downloadCSV, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { EmptyState, PageHeader, Panel, Pill, useAsync } from "../accounting/kit";
import { LedgerModal } from "../accounting/ChartOfAccounts";
import { ClosingEntriesToggle, DateRange, Frame, yearStart } from "./reportKit";

const money = (n) => formatNumber(n, 2);
const CAT = { ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses" };
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
  const [closing, setClosing] = useState(false);
  const state = useAsync(() => accounting.trialBalance({ dateFrom: range.from, dateTo: `${range.to}T23:59:59.999`, includeClosing: closing || undefined }), [range.from, range.to, closing]);
  return (
    <div className="space-y-4">
    <ClosingEntriesToggle checked={closing} onChange={setClosing} />
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
                <div className="erp-scroll table-pin-first overflow-x-auto">
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
    </div>
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

// ---------- profit and loss, as a statement: revenue - cost of sales = gross profit, ... = net profit ----------

function StatementBlock({ title, section, onLedger }) {
  const { groups, total } = section;
  return (
    <>
      <tr className="bg-secondary/50"><th colSpan={2} scope="colgroup" className="px-5 py-2 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</th></tr>
      {groups.length === 0 && <tr><td colSpan={2} className="px-5 py-2.5 text-sm text-muted-foreground">Nothing in this period.</td></tr>}
      {groups.map((g) => (
        <React.Fragment key={g.groupId || g.name}>
          {groups.length > 1 && <tr><td colSpan={2} className="px-5 pt-2.5 text-xs font-medium text-muted-foreground">{g.name}</td></tr>}
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
          const block = (title, s) => { lines.push([title, "", ""]); s.groups.forEach((g) => g.accounts.forEach((a) => lines.push([a.accountCode, a.accountName, a.amount]))); lines.push(["", `Total ${title.toLowerCase()}`, s.total]); };
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
            <Panel bodyClassName="p-0" title="Profit and loss" description="Revenue less the direct cost of what was sold is the gross profit; other income and operating expenses take it to the net profit."
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
