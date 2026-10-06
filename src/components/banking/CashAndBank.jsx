import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Balance, DataTable, EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync } from "../accounting/kit";
import { LedgerModal } from "../accounting/ChartOfAccounts";
import { banking } from "../../lib/bankingApi";
import { drCr } from "../../utils/format";

// Where the money is: every cash and bank account of the chart with its balance, the bank behind
// it, and a way into its ledger.

export default function CashAndBank() {
  const { data, loading, error, reload } = useAsync(() => banking.options(), []);
  const cheques = useAsync(() => banking.cheques({ status: "pending", limit: 1 }), []);
  const [ledgerFor, setLedgerFor] = useState(null);

  const cash = data?.cashAccounts || [];
  const bank = data?.bankAccounts || [];
  const sum = (rows) => rows.reduce((t, a) => t + (Number(a.balance) || 0), 0);
  const total = (rows) => { const { text, side } = drCr(sum(rows)); return side ? `${text} ${side}` : text; };

  const table = (rows, kind) => (
    <Panel bodyClassName="p-0" title={kind === "bank" ? "Bank accounts" : "Cash accounts"} actions={<Link to="/chart-of-accounts" className="text-sm text-primary underline-offset-2 hover:underline">Add an account</Link>}>
      {rows.length === 0 ? <EmptyState title={`No ${kind} accounts`} text="Add one in the chart of accounts." /> : (
        <DataTable
          caption="Accounts"
          rows={rows}
          rowKey={(a) => a._id}
          columns={[
            { key: "account", header: "Account", card: "primary", cell: (a) => <><span className="font-medium">{a.accountName}</span><span className="block font-mono text-xs font-normal text-muted-foreground">{a.accountCode}</span></> },
            // the bank columns only exist on the bank tab; false entries are filtered out by DataTable
            kind === "bank" && { key: "bank", header: "Bank", card: "title", cell: (a) => a.bank?.bankName || <span className="text-muted-foreground">Not set</span> },
            kind === "bank" && { key: "number", header: "Number", card: "meta", className: "text-muted-foreground", cell: (a) => <>{a.bank?.accountNumberMasked}{a.bank?.iban && <span className="ms-1 font-mono text-xs">{a.bank.iban}</span>}</> },
            { key: "balance", header: "Balance", align: "end", card: "amount", className: "font-medium", cell: (a) => <Balance net={a.balance} /> },
            { key: "ledger", header: <span className="sr-only">Ledger</span>, align: "end", card: "actions", cell: (a) => <button type="button" aria-label={`Ledger of ${a.accountName}`} onClick={() => setLedgerFor(a)} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><BookOpen className="h-4 w-4" aria-hidden="true" /></button> },
          ]}
        />
      )}
    </Panel>
  );

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Cash and bank"
        description="Every cash and bank account with its balance. Open an account's ledger for each posting and the running balance."
        actions={<><Button variant="outline" asChild><Link to="/contra-voucher">Move money (contra)</Link></Button><Button variant="outline" asChild><Link to="/cheques">Cheque register</Link></Button></>}
      />
      {loading && !data && <Spinner label="Loading accounts" />}
      <ErrorNote error={error} onRetry={reload} />
      {data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Cash" count={total(cash)} subText={`${cash.length} account${cash.length === 1 ? "" : "s"}`} tone="olive" />
            <StatCard title="Bank" count={total(bank)} subText={`${bank.length} account${bank.length === 1 ? "" : "s"}`} tone="teal" />
            <StatCard title="Cash and bank" count={total([...cash, ...bank])} subText="AED" tone="neutral" />
            {cheques.data && <StatCard title="Cheques to collect" count={String(cheques.data.summary.receivable.count)} subText={`${drCr(cheques.data.summary.receivable.amount).text} AED not yet cleared`} tone="warning" />}
          </div>
          <div className="space-y-5">
            {table(cash, "cash")}
            {table(bank, "bank")}
          </div>
        </>
      )}
      {ledgerFor && <LedgerModal account={{ _id: ledgerFor._id, accountCode: ledgerFor.accountCode, accountName: ledgerFor.accountName }} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}
