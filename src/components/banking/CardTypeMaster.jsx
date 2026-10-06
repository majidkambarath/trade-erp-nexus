import React, { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { DataTable, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import { banking } from "../../lib/bankingApi";

// Visa, Mastercard, American Express... with the fee the card processor takes when a customer
// pays by that card. A card terminal uses its type's fee unless it has its own.

const blank = () => ({ name: "", description: "", feePercent: "0", isActive: true });

export default function CardTypeMaster() {
  const { data, loading, error, reload } = useAsync(() => banking.cardTypes(), []);
  const { notify, toastNode } = useToasts();
  const [editing, setEditing] = useState(null);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Card types" description="The kinds of card you accept or pay with, and the processing fee on each." actions={<Button onClick={() => setEditing(blank())}><Plus className="h-4 w-4" aria-hidden="true" />New card type</Button>} />
      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading card types" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data?.length === 0 && <EmptyState title="No card types yet" text="Add Visa, Mastercard and the others you accept." />}
        {data?.length > 0 && (
          <DataTable
            caption="Card types"
            rows={data}
            rowKey={(t) => t._id}
            columns={[
              { key: "name", header: "Card type", card: "primary", className: "font-medium", cell: (t) => t.name },
              { key: "description", header: "Description", card: "title", className: "text-muted-foreground", cell: (t) => t.description },
              { key: "fee", header: "Processing fee", align: "end", card: "amount", className: "tabular-nums", cell: (t) => `${t.feePercent}%` },
              { key: "status", header: "Status", card: "badge", cell: (t) => t.isActive ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill> },
              { key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", cell: (t) => <button type="button" aria-label={`Edit ${t.name}`} onClick={() => setEditing({ ...t, feePercent: String(t.feePercent) })} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden="true" /></button> },
            ]}
          />
        )}
      </Panel>
      {editing && <CardTypeForm type={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); notify(msg); reload(); }} />}
      {toastNode}
    </div>
  );
}

export function CardTypeForm({ type, onClose, onSaved }) {
  const editing = Boolean(type._id);
  const [f, setF] = useState(type);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (p) => setF((s) => ({ ...s, ...p }));

  async function save() {
    const e = {};
    if (!f.name.trim()) e.name = "Enter the card type's name";
    const fee = Number(f.feePercent);
    if (f.feePercent === "" || !Number.isFinite(fee) || fee < 0 || fee > 100) e.feePercent = "Enter a percentage between 0 and 100";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = { name: f.name.trim(), description: f.description || "", feePercent: fee, isActive: f.isActive };
      const saved = editing ? await banking.updateCardType(type._id, body) : await banking.createCardType(body);
      onSaved(`${saved.name} ${editing ? "updated" : "added"}`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm" onClose={onClose} title={editing ? `Edit ${type.name}` : "New card type"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add card type"}</Button></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4">
        <ErrorNote error={problem} />
        <Field label="Name" required error={errors.name}><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} data-autofocus placeholder="e.g. Visa" /></Field>
        <Field label="Description"><TextInput value={f.description || ""} onChange={(e) => set({ description: e.target.value })} maxLength={250} /></Field>
        <Field label="Processing fee (%)" required error={errors.feePercent} hint="What the processor keeps from each card sale."><TextInput inputMode="decimal" className="text-end tabular-nums" value={f.feePercent} onChange={(e) => set({ feePercent: e.target.value })} /></Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
            Active
          </label>
        )}
        <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
      </form>
    </Modal>
  );
}
