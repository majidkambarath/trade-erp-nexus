import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { StatCard } from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Balance, DateInput, EmptyState, ErrorNote, Field, PageHeader, Panel, Pill, Spinner, useAsync, useToasts } from "./kit";
import AccountsStep from "./openingBalances/AccountsStep";
import PartiesStep from "./openingBalances/PartiesStep";
import StockStep from "./openingBalances/StockStep";
import { Note } from "./openingBalances/parts";
import { openingBalances } from "../../lib/openingBalanceApi";
import { day, equityNet, fmt, hasEntries } from "../../lib/openingBalanceForms";
import { formatDate, formatDateTime } from "../../utils/format";

// Opening balances: the go-live set-up. Pick the go-live date, then enter the account balances, the
// customer and vendor open invoices and the stock; everything is posted against Opening Balance
// Equity and the Review step checks that the opening trial balance balances. Each step saves on its
// own, so the work can be done over several sittings.

const STEPS = [
  { id: "date", label: "Go-live date", done: (s) => Boolean(s?.goLive) },
  { id: "accounts", label: "Accounts", done: (s) => s?.sections.accounts.rows > 0 },
  { id: "customers", label: "Customers", done: (s) => s?.sections.customers.rows > 0 },
  { id: "vendors", label: "Vendors", done: (s) => s?.sections.vendors.rows > 0 },
  { id: "stock", label: "Stock", done: (s) => s?.sections.stock.rows > 0 },
  { id: "review", label: "Review", done: () => false },
];

export default function OpeningBalances() {
  const { notify, toastNode } = useToasts();
  const summary = useAsync(() => openingBalances.summary(), []);
  const [tab, setTab] = useState("date");
  const s = summary.data;
  const goLive = day(s?.goLive);
  const props = { goLive, notify, onChanged: () => summary.reload(), goToDate: () => setTab("date") };

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader
        title="Opening balances"
        description="Start the books from where the old ones stood. Choose the go-live date, then enter the account balances, what customers owe and what is owed to vendors, and the stock on hand. Everything is posted against Opening Balance Equity, and the opening trial balance must balance."
        actions={goLive && <Pill tone="info">Go-live {formatDate(goLive)}</Pill>}
      />
      {summary.loading && !s && <Spinner label="Loading the opening balances" />}
      {summary.error && !s && <ErrorNote error={summary.error} onRetry={summary.reload} />}
      {s && (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto">
            <TabsList>
              {STEPS.map((step, n) => (
                <TabsTrigger key={step.id} value={step.id}>
                  <span className="tabular-nums text-muted-foreground">{n + 1}</span>
                  {step.label}
                  {step.done(s) && <CheckCircle2 className="h-3.5 w-3.5 text-status-success" aria-label="Has entries" />}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="date">{tab === "date" && <GoLiveStep summary={s} notify={notify} onSaved={() => summary.reload()} next={() => setTab("accounts")} />}</TabsContent>
          <TabsContent value="accounts">{tab === "accounts" && <AccountsStep {...props} />}</TabsContent>
          <TabsContent value="customers">{tab === "customers" && <PartiesStep type="customer" {...props} />}</TabsContent>
          <TabsContent value="vendors">{tab === "vendors" && <PartiesStep type="vendor" {...props} />}</TabsContent>
          <TabsContent value="stock">{tab === "stock" && <StockStep {...props} />}</TabsContent>
          <TabsContent value="review">{tab === "review" && <ReviewStep summary={s} loading={summary.loading} reload={summary.reload} go={setTab} />}</TabsContent>
        </Tabs>
      )}
      {toastNode}
    </div>
  );
}

// ------------------------------------------------------------------------ 1. go-live date

const WARNING_TONE = { TRANSACTIONS_BEFORE_GO_LIVE: "warning", POSTING_DISABLED: "danger", ACCOUNT_NOT_CONFIGURED: "danger" };

function GoLiveStep({ summary, notify, onSaved, next }) {
  const current = day(summary.goLive);
  const locked = hasEntries(summary);
  const [date, setDate] = useState(current);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [warnings, setWarnings] = useState(null);

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      const res = await openingBalances.setGoLive(date);
      setWarnings(res.warnings || []);
      notify(`Go-live date set to ${formatDate(date)}`);
      onSaved();
    } catch (e) {
      setProblem(e);
    } finally {
      setBusy(false);
    }
  }

  const shown = warnings ?? summary.warnings ?? [];
  return (
    <div className="space-y-5">
      <Panel title="Go-live date" description="The day the new books start. Opening balances are entered as they stood on that day and every entry is dated that day.">
        <div className="space-y-4">
          <ErrorNote error={problem} />
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Go-live date" required className="w-56" hint={locked ? "Fixed while opening entries exist." : undefined}>
              <DateInput value={date} onChange={(e) => setDate(e.target.value)} disabled={locked || busy} />
            </Field>
            <Button onClick={save} disabled={busy || locked || !date || date === current}>{busy ? "Saving…" : current ? "Change date" : "Set go-live date"}</Button>
            {current && <Button variant="outline" onClick={next}>Continue to accounts</Button>}
          </div>
          {locked && (
            <Note tone="info">
              Opening entries are already posted, dated {formatDate(current)}. To move the date, reverse the entries on the Accounts, Customers, Vendors and Stock steps first.
            </Note>
          )}
          {shown.length > 0 && (
            <ul className="space-y-2" aria-label="Warnings">
              {shown.map((w, i) => (
                <li key={`${w.code}-${i}`}><Note tone={WARNING_TONE[w.code] || "warning"} role="status">{w.message}</Note></li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel title="How the set-up works">
        <ol className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <li><p className="font-semibold">Account balances</p><p className="mt-1 text-muted-foreground">A trial balance as at the go-live date. The difference between debits and credits is posted to Opening Balance Equity, and you see it before posting.</p></li>
          <li><p className="font-semibold">Customers and vendors</p><p className="mt-1 text-muted-foreground">Enter their open invoices, not a single figure, so ageing, statements and receipts and payments work from the first day.</p></li>
          <li><p className="font-semibold">Stock</p><p className="mt-1 text-muted-foreground">Quantity and unit cost of each item, with batch number and expiry for batch-tracked items. Cost and batches follow the same rules as a purchase.</p></li>
          <li><p className="font-semibold">Review</p><p className="mt-1 text-muted-foreground">Checks that the opening trial balance balances, that stock agrees with the Inventory account, and lists what is still missing.</p></li>
        </ol>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------------------- 6. review

function ReviewStep({ summary, loading, reload, go }) {
  const sec = summary.sections;
  const tb = summary.trialBalance;
  const rec = summary.stockReconciliation;
  const accountsNet = (sec.accounts.debit || 0) - (sec.accounts.credit || 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Accounts" count={sec.accounts.rows} subText={`Debit ${fmt(sec.accounts.debit)} · Credit ${fmt(sec.accounts.credit)}`} />
        <StatCard title="Customers owe" count={fmt(sec.customers.total)} subText={`${sec.customers.rows} ${sec.customers.rows === 1 ? "invoice" : "invoices"}, ${sec.customers.parties} ${sec.customers.parties === 1 ? "customer" : "customers"}`} />
        <StatCard title="Owed to vendors" count={fmt(sec.vendors.total)} subText={`${sec.vendors.rows} ${sec.vendors.rows === 1 ? "invoice" : "invoices"}, ${sec.vendors.parties} ${sec.vendors.parties === 1 ? "vendor" : "vendors"}`} />
        <StatCard title="Stock value" count={fmt(sec.stock.value)} subText={`${sec.stock.items} ${sec.stock.items === 1 ? "item" : "items"}, ${sec.stock.rows} ${sec.stock.rows === 1 ? "row" : "rows"}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Opening trial balance"
          description="Every opening entry, from all four steps."
          actions={tb.balanced ? <Pill tone="success">Balanced</Pill> : <Pill tone="danger">Out of balance</Pill>}
        >
          <dl className="space-y-2 text-sm">
            <Row label="Total debits" value={fmt(tb.debit)} />
            <Row label="Total credits" value={fmt(tb.credit)} />
            {!tb.balanced && <Row label="Difference" value={fmt(Math.abs(tb.debit - tb.credit))} tone="danger" />}
            <Row label={tb.equity?.accountName || "Opening Balance Equity"} value={tb.equity ? <Balance net={equityNet(summary)} /> : "Not mapped"} strong />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Opening Balance Equity holds what the old books did not explain. Once the opening figures are final, move it to Owner&apos;s Capital or Retained Earnings with a journal.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline"><Link to="/financial-statements?tab=trial"><ExternalLink className="h-4 w-4" aria-hidden="true" />Open the trial balance</Link></Button>
          </div>
        </Panel>

        <Panel
          title="Stock against the Inventory account"
          description={`As at ${summary.goLive ? formatDate(summary.goLive) : "the go-live date"}.`}
          actions={rec?.available ? (rec.reconciles ? <Pill tone="success">Reconciles</Pill> : <Pill tone="danger">Differs</Pill>) : <Pill>Not available</Pill>}
        >
          {rec?.available ? (
            <dl className="space-y-2 text-sm">
              <Row label="Stock value" value={fmt(rec.stockValue)} />
              <Row label={`Inventory account${rec.account?.name ? ` (${rec.account.name})` : ""}`} value={fmt(rec.ledgerBalance)} />
              <Row label="Difference" value={fmt(rec.difference)} tone={rec.reconciles ? undefined : "danger"} strong />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{rec?.reason || "The Inventory account is not mapped."}</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Opening stock is posted to the Inventory account, so the two agree once everything is entered.</p>
        </Panel>
      </div>

      <Panel title="Per section" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-2 text-start">Section</th><th className="px-3 py-2 text-end">Rows</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-5 py-2 text-end"><span className="sr-only">Open</span></th></tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-5 py-2.5 font-medium">Accounts</td><td className="px-3 py-2.5 text-end tabular-nums">{sec.accounts.rows}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{fmt(sec.accounts.debit)}</td><td className="px-3 py-2.5 text-end tabular-nums">{fmt(sec.accounts.credit)}</td>
                <td className="px-5 py-2.5 text-end"><Button size="sm" variant="ghost" onClick={() => go("accounts")}>Open</Button></td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-5 py-2.5 font-medium">Customers</td><td className="px-3 py-2.5 text-end tabular-nums">{sec.customers.rows}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{fmt(sec.customers.total)}</td><td className="px-3 py-2.5 text-end tabular-nums" />
                <td className="px-5 py-2.5 text-end"><Button size="sm" variant="ghost" onClick={() => go("customers")}>Open</Button></td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-5 py-2.5 font-medium">Vendors</td><td className="px-3 py-2.5 text-end tabular-nums">{sec.vendors.rows}</td>
                <td className="px-3 py-2.5 text-end tabular-nums" /><td className="px-3 py-2.5 text-end tabular-nums">{fmt(sec.vendors.total)}</td>
                <td className="px-5 py-2.5 text-end"><Button size="sm" variant="ghost" onClick={() => go("vendors")}>Open</Button></td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-5 py-2.5 font-medium">Stock</td><td className="px-3 py-2.5 text-end tabular-nums">{sec.stock.rows}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{fmt(sec.stock.value)}</td><td className="px-3 py-2.5 text-end tabular-nums" />
                <td className="px-5 py-2.5 text-end"><Button size="sm" variant="ghost" onClick={() => go("stock")}>Open</Button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-muted-foreground">
          Accounts net {fmt(Math.abs(accountsNet))} {accountsNet > 0 ? "debit" : accountsNet < 0 ? "credit" : ""}; customer invoices, vendor invoices and stock are each balanced by an entry to Opening Balance Equity.
          {summary.postedAt && ` Last posted ${formatDateTime(summary.postedAt)}.`}
        </p>
      </Panel>

      <Panel
        title="Still to do"
        actions={<Button size="sm" variant="outline" onClick={reload} disabled={loading}><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Refresh</Button>}
      >
        {summary.missing.length === 0 && summary.warnings.length === 0 && (
          <EmptyState title="Nothing is missing" text="Every step has entries, the trial balance balances and the stock agrees with the ledger." />
        )}
        {summary.missing.length > 0 && (
          <ul className="space-y-2" aria-label="Still missing">
            {summary.missing.map((m) => (
              <li key={m.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-2.5 text-sm">
                <span>{m.message}</span>
                {STEP_OF[m.key] && <Button size="sm" variant="outline" onClick={() => go(STEP_OF[m.key])}>Go to {STEP_LABEL[STEP_OF[m.key]]}</Button>}
              </li>
            ))}
          </ul>
        )}
        {summary.warnings.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Warnings">
            {summary.warnings.map((w, i) => <li key={`${w.code}-${i}`}><Note tone={WARNING_TONE[w.code] || "warning"}>{w.message}</Note></li>)}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const STEP_OF = { "go-live": "date", accounts: "accounts", customers: "customers", vendors: "vendors", stock: "stock", "trial-balance": "accounts", "stock-reconciliation": "stock" };
const STEP_LABEL = Object.fromEntries(STEPS.map((s) => [s.id, s.label.toLowerCase()]));

function Row({ label, value, tone, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : "font-medium"} ${tone === "danger" ? "text-status-danger" : ""}`}>{value}</dd>
    </div>
  );
}
