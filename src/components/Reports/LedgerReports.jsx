import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Download, TriangleAlert } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { downloadCSV, formatDate, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Balance, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, SearchSelect, Select, Spinner, TextInput, useAsync } from "../accounting/kit";
import { LedgerModal } from "../accounting/ChartOfAccounts";
import { DateRange, Frame, yearStart } from "./reportKit";

const money = (n) => formatNumber(n, 2);
const CATEGORIES = [["", "All categories"], ["ASSET", "Assets"], ["LIABILITY", "Liabilities"], ["EQUITY", "Equity"], ["INCOME", "Income"], ["EXPENSE", "Expenses"]];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.filter(([k]) => k));
const VOUCHER_TYPES = [
  ["sales_order", "Sales invoice"], ["sales_return", "Sales return"], ["purchase_order", "Purchase invoice"], ["purchase_return", "Purchase return"],
  ["receipt", "Receipt"], ["payment", "Payment"], ["expense", "Expense"], ["journal", "Journal"], ["contra", "Contra"], ["debit_note", "Debit note"], ["credit_note", "Credit note"],
];
const TYPE_OPTIONS = VOUCHER_TYPES.map(([value, label]) => ({ value, label }));
const TAB_IDS = ["gl", "daybook", "journals", "cash"];

// Reports read from the general ledger: every account, every voucher, the journals, and cash and bank.
export default function LedgerReports() {
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get("tab")) ? params.get("tab") : "gl";
  const [range, setRange] = useState({ from: yearStart(), to: todayInput() });
  const [ledgerFor, setLedgerFor] = useState(null);
  const openLedger = (a) => setLedgerFor({ _id: a.accountId || a._id, accountCode: a.accountCode, accountName: a.accountName });

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader title="Ledger reports" description="General ledger, day book, journals, and cash and bank, straight from the books." />
      <DateRange value={range} onChange={setRange} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="overflow-x-auto"><TabsList>
          <TabsTrigger value="gl">General ledger</TabsTrigger><TabsTrigger value="daybook">Day book</TabsTrigger><TabsTrigger value="journals">Journals</TabsTrigger><TabsTrigger value="cash">Cash and bank</TabsTrigger>
        </TabsList></div>
        <TabsContent value="gl">{tab === "gl" && <GeneralLedger range={range} onLedger={openLedger} />}</TabsContent>
        <TabsContent value="daybook">{tab === "daybook" && <DayBook range={range} />}</TabsContent>
        <TabsContent value="journals">{tab === "journals" && <Journals range={range} />}</TabsContent>
        <TabsContent value="cash">{tab === "cash" && <CashAndBankBook range={range} onLedger={openLedger} />}</TabsContent>
      </Tabs>
      {ledgerFor && <LedgerModal account={ledgerFor} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- general ledger

function GeneralLedger({ range, onLedger }) {
  const [category, setCategory] = useState("");
  const [groupsOnly, setGroupsOnly] = useState(false);
  const state = useAsync(() => accounting.generalLedger({ from: range.from, to: range.to, category: category || undefined }), [range.from, range.to, category]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-52">{CATEGORIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground"><input type="checkbox" checked={groupsOnly} onChange={(e) => setGroupsOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />Groups only</label>
      </div>
      <Frame state={state}>
        {(d) => {
          const exportCsv = () => downloadCSV(`general-ledger-${range.from}-${range.to}.csv`, ["Group", "Code", "Account", "Opening", "Debit", "Credit", "Closing"],
            d.groups.flatMap((g) => (groupsOnly ? [[g.name, "", "", g.totals.opening, g.totals.debit, g.totals.credit, g.totals.closing]] : g.accounts.map((a) => [g.name, a.accountCode, a.accountName, a.opening, a.debit, a.credit, a.closing]))).concat([["Total", "", "", d.totals.opening, d.totals.debit, d.totals.credit, d.totals.closing]]));
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title="Debits in period" count={money(d.totals.debit)} tone="teal" />
                <StatCard title="Credits in period" count={money(d.totals.credit)} tone="plum" />
                <StatCard title="Accounts with activity" count={String(d.groups.reduce((t, g) => t + g.accounts.length, 0))} tone="neutral" />
                <StatCard title="Groups" count={String(d.groups.length)} tone="neutral" />
              </div>
              <Panel bodyClassName="p-0" title="General ledger" description="Opening balance, the period's debits and credits, and the closing balance of every account, by group."
                actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!d.groups.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
                {d.groups.length === 0 ? <EmptyState title="No postings" text="Nothing has been posted to the ledger for this selection." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr><th className="px-5 py-2 text-start">Account</th><th className="px-3 py-2 text-end">Opening</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-5 py-2 text-end">Closing</th></tr>
                      </thead>
                      <tbody>
                        {d.groups.map((g) => (
                          <React.Fragment key={g.groupId || g.name}>
                            <tr className="border-t border-border bg-secondary/40">
                              <td className="px-5 py-2 font-medium">{g.name} <span className="ms-2 text-xs font-normal text-muted-foreground">{CATEGORY_LABEL[g.category]}</span></td>
                              <td className="px-3 py-2 text-end font-medium"><Balance net={g.totals.opening} /></td>
                              <td className="px-3 py-2 text-end font-medium tabular-nums">{g.totals.debit ? money(g.totals.debit) : ""}</td>
                              <td className="px-3 py-2 text-end font-medium tabular-nums">{g.totals.credit ? money(g.totals.credit) : ""}</td>
                              <td className="px-5 py-2 text-end font-medium"><Balance net={g.totals.closing} /></td>
                            </tr>
                            {!groupsOnly && g.accounts.map((a) => (
                              <tr key={a.accountId} className="border-t border-border/60 hover:bg-accent/40">
                                <td className="py-1.5 pe-3 ps-9"><button type="button" onClick={() => onLedger(a)} className="text-start hover:underline" aria-label={`Ledger of ${a.accountName}`}><span className="me-2 font-mono text-xs text-muted-foreground">{a.accountCode}</span>{a.accountName}</button></td>
                                <td className="px-3 py-1.5 text-end"><Balance net={a.opening} /></td>
                                <td className="px-3 py-1.5 text-end tabular-nums">{a.debit ? money(a.debit) : ""}</td>
                                <td className="px-3 py-1.5 text-end tabular-nums">{a.credit ? money(a.credit) : ""}</td>
                                <td className="px-5 py-1.5 text-end"><Balance net={a.closing} /></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-border bg-secondary/60 font-semibold"><td className="px-5 py-2.5">Total</td><td className="px-3 py-2.5 text-end"><Balance net={d.totals.opening} /></td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.totals.debit)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.totals.credit)}</td><td className="px-5 py-2.5 text-end"><Balance net={d.totals.closing} /></td></tr></tfoot>
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

// ---------------------------------------------------------------- day book

const PAGE = 50;

function DayBook({ range }) {
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [needle, setNeedle] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setNeedle(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [range.from, range.to, type]);

  const state = useAsync(() => accounting.dayBook({ from: range.from, to: range.to, type: type || undefined, search: needle || undefined, page, limit: PAGE }), [range.from, range.to, type, needle, page]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Voucher type" className="w-56"><SearchSelect value={type} onChange={setType} options={TYPE_OPTIONS} clearable placeholder="All types" noOptionsText="No type matches" /></Field>
        <Field label="Search" className="w-72">
          <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Voucher no, party or narration" />
        </Field>
      </div>
      <Frame state={state}>
        {(d) => {
          const pages = Math.max(1, Math.ceil(d.total / PAGE));
          const exportCsv = () => downloadCSV(`day-book-${range.from}-${range.to}.csv`, ["Date", "Voucher", "Type", "Party", "Narration", "Amount"], d.rows.map((r) => [formatDate(r.date), r.voucherNo, r.typeLabel, r.party, r.narration, r.amount]));
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title="Vouchers" count={String(d.total)} tone="neutral" />
                {d.byType.slice(0, 3).map((t, i) => <StatCard key={t.voucherType} title={t.label} count={money(t.amount)} subText={`${t.count} voucher${t.count === 1 ? "" : "s"}`} tone={["teal", "plum", "olive"][i]} />)}
              </div>
              <Panel bodyClassName="p-0" title="Day book" description="Every voucher posted in the period, newest first. Open one to see the debits and credits it made."
                actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!d.rows.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
                {d.rows.length === 0 ? <EmptyState title="No vouchers" text="Nothing was posted for this selection." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr><th className="px-5 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Voucher</th><th className="px-3 py-2 text-start">Type</th><th className="px-3 py-2 text-start">Party</th><th className="px-3 py-2 text-start">Narration</th><th className="px-5 py-2 text-end">Amount</th></tr>
                      </thead>
                      <tbody>
                        {d.rows.map((r) => (
                          <tr key={r.voucherId} className="border-t border-border hover:bg-accent/40">
                            <td className="whitespace-nowrap px-5 py-2">{formatDate(r.date)}</td>
                            <td className="px-3 py-2"><button type="button" onClick={() => setOpen(r)} className="font-mono text-xs hover:underline" aria-label={`Open ${r.voucherNo}`}>{r.voucherNo}</button></td>
                            <td className="px-3 py-2"><Pill>{r.typeLabel}</Pill></td>
                            <td className="px-3 py-2">{r.party || <span className="text-muted-foreground">-</span>}</td>
                            <td className="max-w-xs truncate px-3 py-2 text-muted-foreground">{r.narration}</td>
                            <td className="px-5 py-2 text-end tabular-nums">{money(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {d.total > PAGE && (
                  <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
                    <span>Page {page} of {pages} · {d.total} vouchers</span>
                    <span className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />Previous</Button>
                      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                    </span>
                  </div>
                )}
              </Panel>
            </>
          );
        }}
      </Frame>
      {open && <VoucherImpact voucher={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// The balanced debit and credit lines one voucher posted.
function VoucherImpact({ voucher, onClose }) {
  const { data, loading, error, reload } = useAsync(() => accounting.voucherImpact(voucher.voucherId), [voucher.voucherId]);
  return (
    <Modal size="lg" onClose={onClose} title={`${voucher.typeLabel} ${voucher.voucherNo}`} description={`${formatDate(voucher.date)}${voucher.party ? ` · ${voucher.party}` : ""}`}>
      {loading && !data && <Spinner label="Loading the postings" />}
      <ErrorNote error={error} onRetry={reload} />
      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2 text-start">Account</th><th className="px-4 py-2 text-end">Debit</th><th className="px-4 py-2 text-end">Credit</th></tr></thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={`${l.accountId}-${i}`} className="border-t border-border">
                    <td className="px-4 py-2"><span className="me-2 font-mono text-xs text-muted-foreground">{l.accountCode}</span>{l.accountName}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{l.debit ? money(l.debit) : ""}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{l.credit ? money(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-secondary/60 font-semibold"><td className="px-4 py-2">Total</td><td className="px-4 py-2 text-end tabular-nums">{money(data.totals.debit)}</td><td className="px-4 py-2 text-end tabular-nums">{money(data.totals.credit)}</td></tr></tfoot>
            </table>
          </div>
          <p className="mt-3"><Pill tone={data.balanced ? "success" : "danger"}>{data.balanced ? "Debits equal credits" : "Does not balance"}</Pill></p>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- journals

function Journals({ range }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [range.from, range.to]);
  const state = useAsync(() => accounting.dayBook({ from: range.from, to: range.to, type: "journal", includeLines: true, page, limit: 20 }), [range.from, range.to, page]);
  return (
    <Frame state={state}>
      {(d) => {
        const pages = Math.max(1, Math.ceil(d.total / 20));
        const exportCsv = () => downloadCSV(`journals-${range.from}-${range.to}.csv`, ["Date", "Voucher", "Narration", "Account code", "Account", "Debit", "Credit"],
          d.rows.flatMap((r) => r.lines.map((l) => [formatDate(r.date), r.voucherNo, r.narration, l.accountCode, l.accountName, l.debit, l.credit])));
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{d.total} journal{d.total === 1 ? "" : "s"} in this period</p>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!d.rows.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>
            </div>
            {d.rows.length === 0 && <Panel><EmptyState title="No journals" text="No journal voucher was posted in this period." /></Panel>}
            {d.rows.map((r) => (
              <Panel key={r.voucherId} bodyClassName="p-0" title={`${r.voucherNo} · ${formatDate(r.date)}`} description={r.narration || undefined}
                actions={<Pill tone={r.balanced ? "success" : "danger"}>{r.balanced ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <TriangleAlert className="h-3 w-3" aria-hidden="true" />}{r.balanced ? "Balanced" : "Does not balance"}</Pill>}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {r.lines.map((l, i) => (
                        <tr key={i} className="border-t border-border first:border-t-0">
                          <td className="px-5 py-1.5"><span className="me-2 font-mono text-xs text-muted-foreground">{l.accountCode}</span><span className={l.credit && !l.debit ? "ps-6" : ""}>{l.accountName}</span></td>
                          <td className="w-36 px-3 py-1.5 text-end tabular-nums">{l.debit ? money(l.debit) : ""}</td>
                          <td className="w-36 px-5 py-1.5 text-end tabular-nums">{l.credit ? money(l.credit) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))}
            {d.total > 20 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Page {page} of {pages}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />Previous</Button>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                </span>
              </div>
            )}
          </div>
        );
      }}
    </Frame>
  );
}

// ---------------------------------------------------------------- cash and bank book

function CashAndBankBook({ range, onLedger }) {
  const [kind, setKind] = useState("");
  const state = useAsync(() => accounting.cashBook({ from: range.from, to: range.to, kind: kind || undefined }), [range.from, range.to, kind]);
  return (
    <div className="space-y-4">
      <Field label="Show" className="w-52"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Cash and bank</option><option value="cash">Cash only</option><option value="bank">Bank only</option></Select></Field>
      <Frame state={state}>
        {(d) => {
          const exportCsv = () => downloadCSV(`cash-and-bank-${range.from}-${range.to}.csv`, ["Code", "Account", "Type", "Opening", "Receipts", "Payments", "Closing"],
            d.rows.map((r) => [r.accountCode, r.accountName, r.kind === "cash" ? "Cash" : "Bank", r.opening, r.receipts, r.payments, r.closing]).concat([["", "Total", "", d.totals.all.opening, d.totals.all.receipts, d.totals.all.payments, d.totals.all.closing]]));
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title="Cash" count={money(d.totals.cash.closing)} subText="closing, AED" tone="olive" />
                <StatCard title="Bank" count={money(d.totals.bank.closing)} subText="closing, AED" tone="teal" />
                <StatCard title="Money in" count={money(d.totals.all.receipts)} tone="plum" />
                <StatCard title="Money out" count={money(d.totals.all.payments)} tone="rose" />
              </div>
              <Panel bodyClassName="p-0" title="Cash and bank book" description="Each cash and bank account: what it held, what came in, what went out, and what it holds now."
                actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!d.rows.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
                {d.rows.length === 0 ? <EmptyState title="No cash or bank accounts" text="Add them in the chart of accounts." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr><th className="px-5 py-2 text-start">Account</th><th className="px-3 py-2 text-start">Type</th><th className="px-3 py-2 text-end">Opening</th><th className="px-3 py-2 text-end">Receipts</th><th className="px-3 py-2 text-end">Payments</th><th className="px-3 py-2 text-end">Closing</th><th className="px-5 py-2"><span className="sr-only">Ledger</span></th></tr>
                      </thead>
                      <tbody>
                        {d.rows.map((r) => (
                          <tr key={r.accountId} className="border-t border-border hover:bg-accent/40">
                            <td className="px-5 py-2"><span className="me-2 font-mono text-xs text-muted-foreground">{r.accountCode}</span>{r.accountName}</td>
                            <td className="px-3 py-2"><Pill>{r.kind === "cash" ? "Cash" : "Bank"}</Pill></td>
                            <td className="px-3 py-2 text-end"><Balance net={r.opening} /></td>
                            <td className="px-3 py-2 text-end tabular-nums">{r.receipts ? money(r.receipts) : ""}</td>
                            <td className="px-3 py-2 text-end tabular-nums">{r.payments ? money(r.payments) : ""}</td>
                            <td className="px-3 py-2 text-end"><Balance net={r.closing} /></td>
                            <td className="px-5 py-2 text-end"><button type="button" aria-label={`Ledger of ${r.accountName}`} onClick={() => onLedger(r)} className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><BookOpen className="h-4 w-4" aria-hidden="true" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-border bg-secondary/60 font-semibold"><td className="px-5 py-2.5" colSpan={2}>Total</td><td className="px-3 py-2.5 text-end"><Balance net={d.totals.all.opening} /></td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.totals.all.receipts)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.totals.all.payments)}</td><td className="px-3 py-2.5 text-end"><Balance net={d.totals.all.closing} /></td><td /></tr></tfoot>
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
