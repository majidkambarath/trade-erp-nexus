import React, { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { formatDateGB, formatNumber } from "../../../utils/format";
import { Button } from "../../ui/button";
import { DataTable, DateInput, EmptyState, errorMessage, ErrorNote, Field, Modal, Panel, Pill, Select, Spinner, TextInput, useAsync } from "../kit";

export const KINDS = {
  standard: "Standard-rated",
  zero_rated: "Zero-rated",
  exempt: "Exempt",
  out_of_scope: "Out of scope",
  reverse_charge: "Reverse charge",
};
const KIND_HELP = {
  standard: "Charged at the rate below.",
  zero_rated: "0% but still reported on the VAT return (exports, some staples).",
  exempt: "No VAT and not recoverable. Reported separately from zero-rated.",
  out_of_scope: "Outside the scope of VAT.",
  reverse_charge: "The buyer accounts for the VAT.",
};

// How a line is taxed. The percentage in force on the document date applies, and a snapshot of
// the kind is kept on the line, so changing a code later never restates a posted document.
export default function TaxCodes({ notify }) {
  const codes = useAsync(() => accounting.taxCodes(), []);
  const [modal, setModal] = useState(null);

  return (
    <Panel
      title="Tax codes" bodyClassName="p-0"
      description="Choose a tax code on each order line. A rate change takes effect on the date you set, without touching earlier documents."
      actions={<Button size="sm" onClick={() => setModal({})}><Plus className="h-4 w-4" aria-hidden="true" />New tax code</Button>}
    >
      {codes.loading && !codes.data && <Spinner />}
      {codes.error && <div className="p-5"><ErrorNote error={codes.error} onRetry={codes.reload} /></div>}
      {codes.data?.length === 0 && <EmptyState title="No tax codes" text="Add a standard-rated code (5% in the UAE) to start." />}
      {codes.data?.length > 0 && (
        <DataTable
          caption="Tax codes"
          rows={codes.data}
          rowKey={(c) => c._id}
          columns={[
            { key: "name", header: "Name", card: "primary", className: "font-medium", cell: (c) => <>{c.name} {c.isDefault && <Pill tone="info" className="ms-1">Default</Pill>}</> },
            { key: "kind", header: "Treatment", card: "title", cell: (c) => KINDS[c.kind] },
            { key: "rate", header: "Rate", align: "end", card: "amount", className: "tabular-nums", cell: (c) => `${formatNumber(c.ratePercent, 2)}%` },
            { key: "history", header: "Rate changes", card: "meta", className: "text-xs text-muted-foreground", cell: (c) => c.rateHistory?.length ? c.rateHistory.map((h) => `${formatNumber(h.ratePercent, 2)}% from ${formatDateGB(h.date)}`).join(" · ") : "—" },
            { key: "status", header: "Status", card: "badge", cell: (c) => c.isActive ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill> },
            { key: "edit", header: <span className="sr-only">Edit</span>, align: "end", card: "actions", cell: (c) => <button type="button" onClick={() => setModal({ code: c })} aria-label={`Edit ${c.name}`} className="grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" aria-hidden="true" /></button> },
          ]}
        />
      )}
      {modal && <TaxCodeModal {...modal} onClose={() => setModal(null)} onSaved={(m) => { setModal(null); notify(m); codes.reload(); }} />}
    </Panel>
  );
}

export function TaxCodeModal({ code, onClose, onSaved }) {
  const editing = Boolean(code);
  const [form, setForm] = useState({
    name: code?.name || "", kind: code?.kind || "standard", ratePercent: code?.ratePercent ?? 5,
    isDefault: code?.isDefault || false, isActive: code?.isActive ?? true,
    history: (code?.rateHistory || []).map((h) => ({ date: String(h.date).slice(0, 10), ratePercent: h.ratePercent })),
  });
  const [errors, setErrors] = useState({});
  const [topError, setTopError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setHist = (i, k, v) => setForm((f) => ({ ...f, history: f.history.map((h, j) => (j === i ? { ...h, [k]: v } : h)) }));

  async function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (!form.name.trim()) e.name = "Give the tax code a name";
    const rate = Number(form.ratePercent);
    if (form.ratePercent === "" || !Number.isFinite(rate) || rate < 0 || rate > 100) e.ratePercent = "Enter a rate from 0 to 100";
    if (form.kind === "standard" && rate === 0) e.ratePercent = "A standard-rated code needs a rate above 0";
    if (form.history.some((h) => !h.date || h.ratePercent === "" || Number(h.ratePercent) < 0 || Number(h.ratePercent) > 100)) e.history = "Each rate change needs a date and a rate from 0 to 100";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(), kind: form.kind, ratePercent: rate, isDefault: form.isDefault, isActive: form.isActive,
        rateHistory: form.history.map((h) => ({ date: h.date, ratePercent: Number(h.ratePercent) })),
      };
      if (editing) await accounting.updateTaxCode(code._id, body); else await accounting.createTaxCode(body);
      onSaved(editing ? `${form.name} updated` : `${form.name} created`);
    } catch (err) {
      if (err.status === 409 || /duplicate/i.test(err.message)) setErrors({ name: "A tax code with this name already exists" });
      else setTopError(err);
      setBusy(false);
    }
  }

  return (
    <Modal size="md" title={editing ? `Edit ${code.name}` : "New tax code"} onClose={onClose}
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="tax-form" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create tax code"}</Button></>}>
      <form id="tax-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {topError && <div className="sm:col-span-2"><ErrorNote error={topError} /></div>}
        <Field label="Name" required error={errors.name} className="sm:col-span-2"><TextInput value={form.name} onChange={set("name")} maxLength={80} data-autofocus placeholder="e.g. Standard 5%" /></Field>
        <Field label="Treatment" hint={KIND_HELP[form.kind]}>
          <Select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value, ratePercent: e.target.value === "standard" ? (f.ratePercent || 5) : 0 }))}>
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Rate (%)" required error={errors.ratePercent}><TextInput type="number" step="0.01" min="0" max="100" value={form.ratePercent} onChange={set("ratePercent")} /></Field>

        <fieldset className="rounded-xl border border-border p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-medium">Rate changes <span className="font-normal text-muted-foreground">(optional)</span></legend>
          {form.history.map((h, i) => (
            <div key={i} className="mb-2 flex items-end gap-2">
              <Field label="From" className="flex-1"><DateInput value={h.date} onChange={(e) => setHist(i, "date", e.target.value)} /></Field>
              <Field label="New rate (%)" className="w-32"><TextInput type="number" step="0.01" min="0" max="100" value={h.ratePercent} onChange={(e) => setHist(i, "ratePercent", e.target.value)} /></Field>
              <button type="button" aria-label={`Remove rate change ${i + 1}`} onClick={() => setForm((f) => ({ ...f, history: f.history.filter((_, j) => j !== i) }))} className="mb-1 grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-full text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          ))}
          {errors.history && <p className="mb-2 text-xs font-medium text-status-danger">{errors.history}</p>}
          <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, history: [...f.history, { date: "", ratePercent: f.ratePercent }] }))}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add a rate change</Button>
        </fieldset>

        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isDefault} onChange={set("isDefault")} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />Use as the default for new lines</label>
        {editing && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isActive} onChange={set("isActive")} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />Active</label>}
      </form>
    </Modal>
  );
}

export { errorMessage };
