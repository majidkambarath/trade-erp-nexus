import React, { useMemo, useState } from "react";
import { accounting } from "../../../lib/accountingApi";
import { Button } from "../../ui/button";
import { ErrorNote, Field, Modal, Select, TextInput } from "../kit";
import {
  BRANCH_PREFIXES, METHODS, RESET_POLICIES, SEPARATORS,
  emptyVoucherType, formFrom, previewNumber, validateVoucherType, voucherTypeBody, warningsFor,
} from "../../../lib/voucherTypeForms";

const hintOf = (list, value) => list.find((o) => o.value === value)?.hint || "";

// Editing how a kind of document is numbered, or adding a variant of one ("Petty cash payment" under
// Payment). A variant carries its own name, prefix and counter and posts exactly as its parent, which is
// why it needs no new accounting behaviour.
//
// The number is drawn as the person types, because a format is far easier to judge by reading one than
// by reading the fields that make it.
export default function VoucherTypeModal({ row, types = [], branches = [], onClose, onSaved }) {
  const editing = Boolean(row);
  const [form, setForm] = useState(() => (row ? formFrom(row) : emptyVoucherType()));
  const [errors, setErrors] = useState({});
  const [topError, setTopError] = useState(null);
  const [busy, setBusy] = useState(false);

  const parents = types.filter((t) => !t.parentKey && t.kind !== "system");
  const parent = editing ? null : parents.find((t) => t.key === form.parentKey) || null;
  const statutory = editing ? Boolean(row.statutory) : Boolean(parent?.statutory);
  const kind = editing ? row.kind : parent?.kind || "voucher";
  const takenKeys = types.map((t) => t.key);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  // Choosing "never" and keeping the year is refused, so take the year out at the same moment rather than
  // letting somebody save and be told off for a choice they did not make.
  const setPolicy = (e) => setForm((f) => ({ ...f, resetPolicy: e.target.value, includeYear: e.target.value === "never" ? false : f.includeYear }));

  const branch = branches.find((b) => !b.isHeadOffice && b.isActive !== false);
  const warnings = useMemo(() => warningsFor(form, { branches }), [form, branches]);

  async function submit(ev) {
    ev.preventDefault();
    const e = validateVoucherType(form, { takenKeys, isNew: !editing, statutory, kind, branches });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setTopError(null);
    try {
      const body = voucherTypeBody(form, { isNew: !editing });
      if (editing) await accounting.updateVoucherType(row.key, body);
      else await accounting.createVoucherType(body);
      onSaved(editing ? `${body.name} updated` : `${body.name} added`);
    } catch (err) {
      // The server is the authority; show its field error where the person can act on it.
      const field = err?.details?.field;
      if (field) setErrors({ [field]: err.message });
      else setTopError(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg"
      title={editing ? `Numbering for ${row.name}` : "New voucher type"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="voucher-type-form" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add voucher type"}</Button>
        </>
      }
    >
      <form id="voucher-type-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {topError && <div className="sm:col-span-2"><ErrorNote error={topError} /></div>}

        {!editing && (
          <>
            <Field label="A variant of" required error={errors.parentKey} hint="It will post exactly as this type does. Only the name and the number differ." className="sm:col-span-2">
              <Select value={form.parentKey} onChange={(e) => setForm((f) => ({ ...f, parentKey: e.target.value }))} data-autofocus>
                <option value="">Choose a document type…</option>
                {parents.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Code" required error={errors.key} hint="Short, and never changes. It is how the series is named inside the system.">
              <TextInput value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toUpperCase() }))} maxLength={8} placeholder="PCV" className="font-mono" />
            </Field>
          </>
        )}

        <Field label="Name" required error={errors.name} className={editing ? "sm:col-span-2" : ""}>
          <TextInput value={form.name} onChange={set("name")} maxLength={60} data-autofocus={editing || undefined} placeholder="Petty cash payment" />
        </Field>

        <fieldset className="rounded-xl border border-border p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-medium">The number</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prefix" required error={errors.prefix}>
              <TextInput value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value.toUpperCase() }))} maxLength={10} placeholder="PCV" className="font-mono" />
            </Field>
            <Field label="Suffix" error={errors.suffix} hint="Optional, after the counter.">
              <TextInput value={form.suffix} onChange={(e) => setForm((f) => ({ ...f, suffix: e.target.value.toUpperCase() }))} maxLength={6} className="font-mono" />
            </Field>
            <Field label="Separator">
              <Select value={form.separator} onChange={set("separator")}>
                {SEPARATORS.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Counter digits" required error={errors.numberLength} hint="0001 is four.">
              <TextInput type="number" min="3" max="10" value={form.numberLength} onChange={(e) => setForm((f) => ({ ...f, numberLength: e.target.value }))} />
            </Field>
            <Field label="The branch" hint={hintOf(BRANCH_PREFIXES, form.branchPrefix)} className="sm:col-span-2">
              <Select value={form.branchPrefix} onChange={set("branchPrefix")}>
                {BRANCH_PREFIXES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
          </div>

          <div className="mt-4 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">A number will read</p>
            <p className="mt-1 font-mono text-base font-semibold" data-testid="number-preview">{previewNumber(form) || "—"}</p>
            {branch && form.branchPrefix === "auto" && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">{previewNumber(form, { branchId: branch.code })} in {branch.name}</p>
            )}
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-border p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-medium">The counter</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts again" hint={hintOf(RESET_POLICIES, form.resetPolicy)}>
              <Select value={form.resetPolicy} onChange={setPolicy}>
                {RESET_POLICIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="How the number is given" hint={hintOf(METHODS, form.method)} error={errors.method}>
              <Select value={form.method} onChange={set("method")} disabled={kind === "system"}>
                {METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field error={errors.includeYear} className="mt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.includeYear !== false} onChange={set("includeYear")} disabled={form.resetPolicy === "never"} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
              Show the year in the number
            </label>
          </Field>
          <Field error={errors.allowReuse} className="mt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(form.allowReuse)} onChange={set("allowReuse")} disabled={statutory || kind === "system"} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
              Give a deleted number to the next document
            </label>
          </Field>
          {statutory && (
            <p className="mt-2 text-xs text-muted-foreground">
              This is a document you issue bearing tax, so its number is kept for good once used. A deleted one is recorded with its reason instead, which is what a tax authority asks for.
            </p>
          )}
        </fieldset>

        {editing && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isActive !== false} onChange={set("isActive")} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
            In use
            {row.isSystem && <span className="text-muted-foreground">— a built-in type is switched off, never deleted</span>}
          </label>
        )}

        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-status-warning-soft p-3 text-xs text-status-warning sm:col-span-2">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
      </form>
    </Modal>
  );
}
