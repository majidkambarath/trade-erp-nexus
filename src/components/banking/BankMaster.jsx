import React, { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { Button } from "../ui/button";
import { DataTable, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Spinner, Textarea, TextInput, useAsync, useToasts } from "../accounting/kit";
import EntryGrid from "../finance/EntryGrid";
import { useOrganisation } from "../shell/OrganisationContext";
import { banking } from "../../lib/bankingApi";

// The banks the company deals with. A bank account itself is an account in the chart of accounts
// (under Bank) that points at one of these; this list holds the institution.

const blank = () => ({ bankName: "", bankCode: "", swiftCode: "", country: "AE", city: "", notes: "", branches: [], isActive: true });

export default function BankMaster() {
  const { data, loading, error, reload } = useAsync(() => banking.banks(), []);
  const { notify, toastNode } = useToasts();
  const { canAny } = useOrganisation();
  const canManage = canAny("banking.manage"); // adding and editing banks: the server asks the same
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const rows = useMemo(() => (data || []).filter((b) => !q || `${b.bankName} ${b.bankCode} ${b.city} ${b.swiftCode}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Banks"
        description={canManage ? "The banks you and your customers use. Add a bank here, then give a bank account in the chart of accounts its bank and IBAN." : "The banks you and your customers use."}
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
            columns={[
              { key: "name", header: "Bank", card: "primary", className: "font-medium", cell: (b) => b.bankName },
              { key: "code", header: "Code", card: "meta", className: "font-mono text-xs", cell: (b) => b.bankCode },
              { key: "swift", header: "SWIFT", card: "meta", className: "font-mono text-xs text-muted-foreground", cell: (b) => b.swiftCode },
              { key: "city", header: "City", card: "title", className: "text-muted-foreground", cell: (b) => [b.city, b.country].filter(Boolean).join(", ") },
              { key: "branches", header: "Branches", align: "end", card: "meta", className: "tabular-nums", cell: (b) => `${b.branches?.length || 0} branches` },
              { key: "status", header: "Status", card: "badge", cell: (b) => b.isActive ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill> },
              // no edit column at all for someone who may only look (DataTable drops a false entry)
              canManage && { key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", cell: (b) => <button type="button" aria-label={`Edit ${b.bankName}`} onClick={() => setEditing(b)} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden="true" /></button> },
            ]}
          />
        )}
      </Panel>
      {editing && <BankForm bank={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); notify(msg); reload(); }} />}
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
