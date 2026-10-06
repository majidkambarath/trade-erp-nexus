import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileUp, SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Balance, EmptyState, ErrorNote, PageHeader, SearchSelect, Spinner, useAsync, useToasts } from "../accounting/kit";
import { Note, PillTabs } from "../salesDocs/parts";
import { reconcile } from "../../lib/bankReconcileApi";
import { formatDate, formatNumber } from "../../utils/format";
import LinesView from "./reconcile/LinesView";
import HistoryTab, { StatementDialog } from "./reconcile/HistoryTab";
import CardTab from "./reconcile/CardTab";
import ImportDialog from "./reconcile/ImportDialog";
import SetupDialog from "./reconcile/SetupDialog";

// Bank and card reconciliation. Import what the bank says, match it to what the books say line by
// line (the engine suggests, a person decides), post what the books are missing, and prove the two
// agree as of a date. Card sales are settled against the acquirer's payments.

const VIEWS = [["lines", "Statement lines"], ["card", "Card settlements"], ["history", "History"]];

export default function BankReconciliation() {
  const [params, setParams] = useSearchParams();
  const { notify, toastNode } = useToasts();
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const accounts = useAsync(() => reconcile.accounts(), [version]);
  const [dialog, setDialog] = useState(null); // "import" | "setup" | { statement: proof }

  const list = accounts.data || [];
  const accountId = params.get("account") || list[0]?._id || "";
  const account = list.find((a) => a._id === accountId);
  const view = VIEWS.some(([v]) => v === params.get("view")) ? params.get("view") : "lines";
  const go = (patch) => setParams({ account: accountId, view, ...patch }, { replace: true });
  const setup = useAsync(() => (account?.setUp ? reconcile.setupStatus(account._id) : Promise.resolve(null)), [account?._id, account?.setUp, version]);

  const options = list.map((a) => ({ value: a._id, label: a.accountName, hint: a.bank?.accountNumberMasked || a.bank?.bankName || a.accountCode }));
  const toDo = account ? account.counts.open : 0;

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Bank reconciliation"
        description="Match what the bank says to what the books say, line by line, and prove they agree."
        actions={account && <><Button variant="outline" onClick={() => setDialog("setup")}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Set up</Button><Button onClick={() => setDialog("import")}><FileUp className="h-4 w-4" aria-hidden="true" />Import a statement</Button></>}
      />

      {accounts.loading && !accounts.data && <Spinner label="Loading bank accounts" />}
      <ErrorNote error={accounts.error} onRetry={accounts.reload} />
      {accounts.data && list.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <EmptyState title="No bank accounts yet" text="Add a bank account under the Bank group in the chart of accounts, then come back to reconcile it." action={<Button asChild><Link to="/chart-of-accounts">Open the chart of accounts</Link></Button>} />
        </div>
      )}

      {account && (
        <>
          <div className="mb-5 max-w-md">
            <label htmlFor="recon-account" className="mb-1.5 block text-sm font-medium">Bank account</label>
            <SearchSelect id="recon-account" aria-label="Bank account" value={accountId} onChange={(id) => id && go({ account: id })} options={options} />
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Balance in the books" count={<Balance net={account.bookBalance} />} subText="AED, from the ledger" tone="teal" />
            <StatCard title="Lines to do" count={String(toDo)} subText={account.setUp ? (toDo === 0 ? "Nothing waiting" : "Not matched or ignored yet") : "Not set up yet"} tone={toDo > 0 ? "warning" : "olive"} />
            <StatCard title="Last reconciled" count={account.lastReconciled ? formatDate(account.lastReconciled.asOf) : "Never"} subText={account.lastReconciled ? `${account.lastReconciled.number} · ${formatNumber(account.lastReconciled.statementBalance, 2)}` : "No completed reconciliation"} tone="plum" />
            <StatCard title="Statement covers up to" count={account.lastLineDay ? formatDate(account.lastLineDay) : "-"} subText={`${account.counts.matched + account.counts.reconciled} matched · ${account.counts.ignored} ignored`} tone="neutral" />
          </div>

          {setup.data && setup.data.difference !== 0 && (
            <div className="mb-5">
              <Note tone="warning">
                The starting balance for this account is out by {formatNumber(Math.abs(setup.data.difference), 2)} (the books showed {formatNumber(setup.data.bookBalanceBefore, 2)} the day before the statement starts; the bank showed {formatNumber(setup.data.statementOpening, 2)}).{" "}
                <button type="button" className="font-medium underline underline-offset-2" onClick={() => setDialog("setup")}>Fix it in Set up</button>, or a reconciliation cannot be finished.
              </Note>
            </div>
          )}

          <div className="mb-4"><PillTabs tabs={VIEWS} value={view} onChange={(v) => go({ view: v })} label="Reconciliation views" /></div>

          {view === "lines" && <LinesView account={account} version={version} onChanged={bump} notify={notify} onImport={() => setDialog("import")} onSetup={() => setDialog("setup")} onStatement={(proof) => setDialog({ statement: proof })} />}
          {view === "card" && <CardTab account={account} version={version} />}
          {view === "history" && <HistoryTab account={account} version={version} notify={notify} onChanged={bump} />}
        </>
      )}

      {dialog === "import" && account && <ImportDialog account={account} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); notify(m); bump(); go({ view: "lines" }); }} />}
      {dialog === "setup" && account && <SetupDialog account={account} initial={setup.data || undefined} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); notify(m); bump(); }} />}
      {dialog?.statement && <StatementDialog proof={dialog.statement} title={`${account?.accountName || "Bank"}: reconciliation statement`} onClose={() => setDialog(null)} />}
      {toastNode}
    </div>
  );
}
