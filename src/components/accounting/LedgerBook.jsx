import React, { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "../ui/button";
import { ErrorNote, Field, PageHeader, Panel, SearchSelect, EmptyState } from "./kit";
import { LedgerBody } from "./ChartOfAccounts";
import { useChartAccounts } from "../finance/shared";

// The ledger of any account of the chart: pick the account, optionally a period, and read every
// posting with its running balance and whether it is a debit or a credit balance.
const ALL = { categories: undefined };

export default function LedgerBook() {
  const { accounts, loading, error } = useChartAccounts(ALL);
  const [id, setId] = useState("");
  const account = accounts.find((a) => a._id === id);
  const options = accounts.map((a) => ({ value: a._id, label: a.accountName, hint: a.accountCode, searchText: `${a.groupName} ${a.category}` }));

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Ledger"
        description="Choose an account to see every posting to it, with the running balance."
        actions={account && <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" />Print</Button>}
      />
      <ErrorNote error={error} />
      <Field label="Account" className="mb-5 max-w-xl print:hidden">
        <SearchSelect value={id} onChange={setId} options={options} loading={loading} autoFocus placeholder="Search by name or code…" noOptionsText="No account matches" />
      </Field>
      {!account && <Panel><EmptyState title="Choose an account" text="Its postings and running balance appear here." /></Panel>}
      {account && (
        <Panel title={`${account.accountCode} · ${account.accountName}`} description={account.path}>
          <LedgerBody account={account} />
        </Panel>
      )}
    </div>
  );
}
