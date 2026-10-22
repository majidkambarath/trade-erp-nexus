import React, { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Balance, DataTable, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Spinner, Textarea, TextInput, useAsync, useToasts } from "../accounting/kit";
import { AccountModal, flattenGroups } from "../accounting/ChartOfAccounts";
import EntryGrid from "../finance/EntryGrid";
import { useOrganisation } from "../shell/OrganisationContext";
import { accounting } from "../../lib/accountingApi";
import { banking } from "../../lib/bankingApi";
import { amountsIn } from "../../utils/format";

// The banks the company deals with. A bank account itself is an account in the chart of accounts
// (under Bank) that points at one of these; this list holds the institution.

const blank = () => ({ bankName: "", bankCode: "", swiftCode: "", country: "AE", city: "", notes: "", branches: [], isActive: true });

export default function BankMaster() {
  const { data, loading, error, reload } = useAsync(() => banking.banks(), []);
  const { notify, toastNode } = useToasts();
  const { canAny } = useOrganisation();
  const canManage = canAny("banking.manage"); // adding and editing banks: the server asks the same
  // The accounts at a bank are chart accounts, so reading them is the chart's key and adding one is
  // a chart change - neither is banking.manage, and the server asks for exactly these.
  const canSeeAccounts = canAny(["banking.view", "accounts.view"]);
  const canAddAccount = canAny("accounts.manage");
  const [editing, setEditing] = useState(null);
  const [accountsFor, setAccountsFor] = useState(null); // the bank whose accounts are open
  const [addingFor, setAddingFor] = useState(null); // the bank a new account is being added to
  const [q, setQ] = useState("");
  const rows = useMemo(() => (data || []).filter((b) => !q || `${b.bankName} ${b.bankCode} ${b.city} ${b.swiftCode}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Banks"
        description={canManage ? "The banks you and your customers use. Add a bank here, then open it to add the company's account at that bank." : "The banks you and your customers use."}
        actions={canManage && <Button onClick={() => setEditing(blank())}><Plus className="h-4 w-4" aria-hidden="true" />New bank</Button>}
      />
      <div className="relative mb-4 max-w-sm print:hidden">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <TextInput aria-label="Search banks" className="ps-9" placeholder="Search name, code, SWIFT or city…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading banks" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && rows.length === 0 && <EmptyState title={q ? "No bank matches" : "No banks yet"} text={q ? "Try another name or code." : canManage ? "Add the first one with New bank." : "None have been added yet."} />}
        {rows.length > 0 && (
          <DataTable
            caption="Banks"
            rows={rows}
            rowKey={(b) => b._id}
            onRowClick={canSeeAccounts ? (b) => setAccountsFor(b) : undefined}
            columns={[
              { key: "name", header: "Bank", card: "primary", className: "font-medium", cell: (b) => b.bankName },
              { key: "code", header: "Code", card: "meta", className: "font-mono text-xs", cell: (b) => b.bankCode },
              { key: "swift", header: "SWIFT", card: "meta", className: "font-mono text-xs text-muted-foreground", cell: (b) => b.swiftCode },
              { key: "city", header: "City", card: "title", className: "text-muted-foreground", cell: (b) => [b.city, b.country].filter(Boolean).join(", ") },
              // The accounts the company holds at this bank, and the way into them. It is a real button
              // so the keyboard reaches it: a clickable row is for the pointer only.
              { key: "accounts", header: "Accounts", align: "end", card: "meta", cell: (b) => {
                const n = b.accounts?.total || 0;
                const text = n === 0 ? "No account yet" : `${n} account${n === 1 ? "" : "s"}`;
                if (!canSeeAccounts) return <span className="text-muted-foreground">{text}</span>;
                return <button type="button" onClick={() => setAccountsFor(b)} aria-label={`Accounts at ${b.bankName}`} className={`-my-1 inline-flex min-h-11 items-center rounded-md px-2 text-sm underline-offset-2 hover:underline lg:min-h-0 lg:py-1 ${n === 0 ? "text-muted-foreground" : "text-primary"}`}>{text}</button>;
              } },
              { key: "status", header: "Status", card: "badge", cell: (b) => b.isActive ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill> },
              // no edit column at all for someone who may only look (DataTable drops a false entry)
              canManage && { key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", cell: (b) => <button type="button" aria-label={`Edit ${b.bankName}`} onClick={() => setEditing(b)} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden="true" /></button> },
            ]}
          />
        )}
      </Panel>
      {editing && <BankForm bank={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); notify(msg); reload(); }} />}
      {/* The accounts dialog steps aside while an account is being added, rather than stacking a form
          on top of a list; closing the form brings it back and it reads its accounts again. */}
      {accountsFor && !addingFor && (
        <BankAccountsModal
          bank={accountsFor}
          canAdd={canAddAccount}
          onAdd={() => setAddingFor(accountsFor)}
          onClose={() => setAccountsFor(null)}
        />
      )}
      {addingFor && (
        <NewBankAccount
          bank={addingFor}
          onClose={() => setAddingFor(null)}
          onSaved={(msg) => { setAddingFor(null); notify(msg); reload(); }}
          onError={(msg) => notify(msg, "error")}
        />
      )}
      {toastNode}
    </div>
  );
}

export function BankForm({ bank, onClose, onSaved }) {
  const editing = Boolean(bank._id);
  const [f, setF] = useState({ ...blank(), ...bank, branches: (bank.branches || []).map((b) => ({ ...b })) });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (p) => setF((s) => ({ ...s, ...p }));
  const patchBranch = (i, p) => setF((s) => ({ ...s, branches: s.branches.map((b, k) => (k === i ? { ...b, ...p } : b)) }));

  async function save() {
    const e = {};
    if (!f.bankName.trim()) e.bankName = "Enter the bank's name";
    if (!f.bankCode.trim()) e.bankCode = "Enter a short code";
    if (f.swiftCode && !/^([A-Za-z0-9]{8}|[A-Za-z0-9]{11})$/.test(f.swiftCode.trim())) e.swiftCode = "A SWIFT/BIC code has 8 or 11 letters and digits";
    if (f.country && !/^[A-Za-z]{2}$/.test(f.country.trim())) e.country = "Use the 2-letter country code, like AE";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = { bankName: f.bankName.trim(), bankCode: f.bankCode.trim(), swiftCode: f.swiftCode.trim(), country: f.country.trim(), city: f.city.trim(), notes: f.notes, branches: f.branches, isActive: f.isActive };
      const saved = editing ? await banking.updateBank(bank._id, body) : await banking.createBank(body);
      onSaved(`${saved.bankName} ${editing ? "updated" : "added"}`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg" onClose={onClose} title={editing ? `Edit ${bank.bankName}` : "New bank"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add bank"}</Button></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4">
        <ErrorNote error={problem} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name" required error={errors.bankName} className="sm:col-span-2"><TextInput value={f.bankName} onChange={(e) => set({ bankName: e.target.value })} maxLength={150} data-autofocus placeholder="e.g. Emirates NBD" /></Field>
          <Field label="Code" required error={errors.bankCode} hint="Short and unique, like ENBD."><TextInput value={f.bankCode} onChange={(e) => set({ bankCode: e.target.value.toUpperCase() })} maxLength={20} /></Field>
          <Field label="SWIFT / BIC" error={errors.swiftCode}><TextInput value={f.swiftCode} onChange={(e) => set({ swiftCode: e.target.value.toUpperCase() })} maxLength={11} placeholder="EBILAEAD" /></Field>
          <Field label="Country" error={errors.country}><TextInput value={f.country} onChange={(e) => set({ country: e.target.value.toUpperCase() })} maxLength={2} /></Field>
          <Field label="City"><TextInput value={f.city} onChange={(e) => set({ city: e.target.value })} maxLength={100} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={f.notes || ""} onChange={(e) => set({ notes: e.target.value })} maxLength={500} /></Field>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium">Branches <span className="font-normal text-muted-foreground">(optional)</span></h3>
          <EntryGrid
            ariaLabel="Branches" rows={f.branches} minRows={0} addLabel="Add a branch"
            columns={[{ key: "name", label: "Branch" }, { key: "code", label: "Code", className: "w-32" }, { key: "address", label: "Address" }]}
            onAdd={() => set({ branches: [...f.branches, { name: "", code: "", address: "" }] })}
            onRemove={(i) => set({ branches: f.branches.filter((_, k) => k !== i) })}
            renderCell={(row, i, col) => <TextInput aria-label={`${col.label}, branch ${i + 1}`} value={row[col.key] || ""} onChange={(e) => patchBranch(i, { [col.key]: col.key === "code" ? e.target.value.toUpperCase() : e.target.value })} maxLength={col.key === "address" ? 250 : 150} />}
          />
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
            Active <span className="text-muted-foreground">(a bank with active accounts or cards cannot be switched off)</span>
          </label>
        )}
        <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
      </form>
    </Modal>
  );
}

// The company's own accounts at one bank. They are chart-of-accounts accounts under the Bank group
// that name this bank, which is why this reads them rather than keeping a list of its own: there is
// one bank account record in the product, and it lives in the chart.
export function BankAccountsModal({ bank, canAdd, onAdd, onClose }) {
  const { data, loading, error, reload } = useAsync(() => banking.bankAccounts(bank._id), [bank._id]);
  const accounts = data?.accounts || [];

  return (
    <Modal
      size="lg" onClose={onClose} title={`Accounts at ${bank.bankName}`}
      description={`The company's own accounts at this bank. Each one is an account in the chart, so its balance and ledger are the chart's. ${amountsIn()}.`}
      footer={<><Button variant="outline" onClick={onClose}>Close</Button>{canAdd && <Button onClick={onAdd}><Plus className="h-4 w-4" aria-hidden="true" />Add a bank account</Button>}</>}
    >
      {loading && !data && <Spinner label="Loading accounts" />}
      <ErrorNote error={error} onRetry={reload} />
      {data && accounts.length === 0 && (
        <EmptyState
          title="No account at this bank yet"
          text={canAdd ? "Add the company's account here: the bank, number and IBAN are filled in for you." : "Nobody has added the company's account at this bank."}
        />
      )}
      {accounts.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          {/* table-stack: inside a dialog there is nowhere to scroll sideways, so below md each row
              becomes a labelled block instead. */}
          <table className="table-stack w-full text-sm">
            <caption className="sr-only">Accounts at {bank.bankName}</caption>
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-semibold">Account</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">Number</th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">Balance</th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a._id} className="border-t border-border">
                  <td data-label="Account" className="px-3 py-2">
                    <span className="font-medium">{a.accountName}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{a.accountCode}</span>
                  </td>
                  <td data-label="Number" className="px-3 py-2 text-muted-foreground">
                    {a.bank?.accountNumberMasked || <span className="text-muted-foreground">Not set</span>}
                    {a.bank?.iban && <span className="block font-mono text-xs">{a.bank.iban}</span>}
                  </td>
                  <td data-label="Balance" className="px-3 py-2 text-end font-medium"><Balance net={a.balance} /></td>
                  <td data-label="Status" className="px-3 py-2 text-end">{a.isActive ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// Adding the company's account at a bank. The form is the chart's own account form, opened on the
// Bank group with the bank already chosen, so there is one account form in the product and an
// account added here is the same record as one added in the chart of accounts.
export function NewBankAccount({ bank, onClose, onSaved, onError }) {
  const { data: chart, loading, error, reload } = useAsync(() => accounting.chart(), []);
  const groups = useMemo(() => flattenGroups(chart), [chart]);
  // The first group whose role is bank, from the posting map. A company with several (one per bank,
  // say) gets the first; the form's own group picker moves the account to another.
  const bankGroup = groups.find((g) => g.role === "bank");

  if (loading || error) {
    return (
      <Modal size="md" onClose={onClose} title={`New account at ${bank.bankName}`} footer={<Button variant="outline" onClick={onClose}>Cancel</Button>}>
        {loading && <Spinner label="Loading the chart of accounts" />}
        <ErrorNote error={error} onRetry={reload} />
      </Modal>
    );
  }
  if (!bankGroup) {
    return (
      <Modal size="md" onClose={onClose} title={`New account at ${bank.bankName}`} footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
        <EmptyState
          title="No bank group in the chart"
          text="A bank account belongs to a group whose role is Bank. Set that role on a group under Accounting setup, or add the account in the chart of accounts."
        />
      </Modal>
    );
  }
  return (
    <AccountModal
      groupId={bankGroup._id}
      groups={groups}
      preset={{ bankId: bank._id }}
      onClose={onClose}
      // the chart's own message names the account it made
      onSaved={onSaved}
      onError={onError}
    />
  );
}
