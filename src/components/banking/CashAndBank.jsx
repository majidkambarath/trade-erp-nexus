import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Balance, EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync } from "../accounting/kit";
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
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-2 text-start">Account</th>{kind === "bank" && <><th className="px-3 py-2 text-start">Bank</th><th className="px-3 py-2 text-start">Number</th></>}<th className="px-3 py-2 text-end">Balance</th><th className="px-5 py-2"><span className="sr-only">Ledger</span></th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a._id} className="border-t border-border hover:bg-accent/40">
                  <td className="px-5 py-2.5"><span className="font-medium">{a.accountName}</span><span className="block font-mono text-xs text-muted-foreground">{a.accountCode}</span></td>
                  {kind === "bank" && (
                    <>
                      <td className="px-3 py-2.5">{a.bank?.bankName || <span className="text-muted-foreground">Not set</span>}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{a.bank?.accountNumberMasked}{a.bank?.iban && <span className="block font-mono text-xs">{a.bank.iban}</span>}</td>
                    </>
                  )}
                  <td className="px-3 py-2.5 text-end font-medium"><Balance net={a.balance} /></td>
                  <td className="px-5 py-2.5 text-end"><button type="button" aria-label={`Ledger of ${a.accountName}`} onClick={() => setLedgerFor(a)} className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><BookOpen className="h-4 w-4" aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
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
