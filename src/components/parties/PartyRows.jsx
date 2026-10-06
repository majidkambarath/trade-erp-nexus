import React, { useId, useRef, useState } from "react";
import { Download, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { accounting, downloadAttachment, uploadAttachment } from "../../lib/accountingApi";
import { checkFile, formatBytes } from "../accounting/AttachmentPanel";
import { DateInput, ErrorNote, Field, Pill, SearchSelect, TextInput } from "../accounting/kit";
import { formatDate } from "../../utils/format";
import {
  DOC_STATUS, addRow, daysLeftText, documentStatus, emptyBankAccount, emptyContact, emptyDocument, isValidIban, isValidSwift, removeRow, setPrimary, updateRow,
} from "../../lib/partyForms";

// The three "rows" sections of the party form: contacts, bank accounts and KYC documents. Each takes
// the party form's context (see PartyForm) and edits its own list through `set`.

const iconButton = "grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function RowFrame({ title, onRemove, removeLabel, children }) {
  return (
    <fieldset className="rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={onRemove} aria-label={removeLabel} className={iconButton}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </fieldset>
  );
}

function PrimaryRadio({ group, checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
      <input type="radio" name={group} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--color-primary)]" />
      {label}
    </label>
  );
}

// ---------- contacts ----------

export function ContactsSection({ value, set, errors }) {
  const group = useId();
  const rows = value.contacts;
  const edit = (i, patch) => set({ contacts: updateRow(rows, i, patch) });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">People to contact at this business, besides the contact person on the Basic tab. One of them is the primary contact.</p>
      {rows.map((c, i) => (
        <RowFrame key={i} title={`Contact ${i + 1}`} removeLabel={`Remove contact ${i + 1}`} onRemove={() => set({ contacts: removeRow(rows, i) })}>
          <Field label="Name" required error={errors[`contacts.${i}.name`]}>
            <TextInput value={c.name} onChange={(e) => edit(i, { name: e.target.value })} maxLength={100} />
          </Field>
          <Field label="Designation">
            <TextInput value={c.designation} onChange={(e) => edit(i, { designation: e.target.value })} maxLength={100} placeholder="e.g. Purchasing manager" />
          </Field>
          <Field label="Email" error={errors[`contacts.${i}.email`]}>
            <TextInput type="email" value={c.email} onChange={(e) => edit(i, { email: e.target.value })} maxLength={120} />
          </Field>
          <Field label="Phone" error={errors[`contacts.${i}.phone`]}>
            <TextInput type="tel" value={c.phone} onChange={(e) => edit(i, { phone: e.target.value })} maxLength={30} />
          </Field>
          <PrimaryRadio group={group} checked={c.isPrimary} onChange={() => set({ contacts: setPrimary(rows, i) })} label="Primary contact" />
        </RowFrame>
      ))}
      {rows.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No extra contacts yet.</p>}
      <Button type="button" variant="outline" onClick={() => set({ contacts: addRow(rows, emptyContact()) })}><Plus className="h-4 w-4" aria-hidden="true" />Add contact</Button>
    </div>
  );
}

// ---------- bank accounts ----------

export function BankAccountsSection({ value, set, errors, banks, banksLoading }) {
  const group = useId();
  const rows = value.bankAccounts;
  const edit = (i, patch) => set({ bankAccounts: updateRow(rows, i, patch) });
  const options = banks.map((b) => ({ value: b._id, label: b.bankName, hint: b.bankCode }));
  const [touched, setTouched] = useState({});
  const leave = (path) => () => setTouched((t) => ({ ...t, [path]: true }));
  // the IBAN checksum and the SWIFT shape are shown once the field has been left
  const shown = (path, live) => errors[path] || (touched[path] ? live : undefined);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Where this party pays from or is paid to. The IBAN is checked for typing mistakes.</p>
      {rows.map((b, i) => {
        const iban = `bankAccounts.${i}.iban`;
        const swift = `bankAccounts.${i}.swiftCode`;
        return (
          <RowFrame key={i} title={`Bank account ${i + 1}`} removeLabel={`Remove bank account ${i + 1}`} onRemove={() => set({ bankAccounts: removeRow(rows, i) })}>
            <Field label="Bank" required error={errors[`bankAccounts.${i}.bankId`]} hint={banks.length || banksLoading ? undefined : "No bank in the bank master yet. Type the bank's name."}>
              <SearchSelect
                value={b.bankId} onChange={(v) => edit(i, { bankId: v, ...(v ? { bankName: "" } : {}) })} clearable loading={banksLoading}
                options={options} placeholder="Search the bank master…" noOptionsText="No bank matches"
              />
            </Field>
            {!b.bankId && (
              <Field label="Bank name" hint="Only when the bank is not in the list.">
                <TextInput value={b.bankName} onChange={(e) => edit(i, { bankName: e.target.value })} maxLength={120} />
              </Field>
            )}
            <Field label="Account number" error={errors[`bankAccounts.${i}.accountNumber`]}>
              <TextInput value={b.accountNumber} onChange={(e) => edit(i, { accountNumber: e.target.value })} maxLength={40} />
            </Field>
            <Field label="IBAN" error={shown(iban, ibanError(b.iban))}>
              <TextInput value={b.iban} onChange={(e) => edit(i, { iban: e.target.value.toUpperCase() })} onBlur={leave(iban)} maxLength={42} placeholder="AE07 0331 2345 6789 0123 456" />
            </Field>
            <Field label="SWIFT / BIC" error={shown(swift, swiftError(b.swiftCode))} hint="8 or 11 characters.">
              <TextInput value={b.swiftCode} onChange={(e) => edit(i, { swiftCode: e.target.value.toUpperCase() })} onBlur={leave(swift)} maxLength={14} placeholder="EBILAEAD" />
            </Field>
            <PrimaryRadio group={group} checked={b.isPrimary} onChange={() => set({ bankAccounts: setPrimary(rows, i) })} label="Primary account" />
          </RowFrame>
        );
      })}
      {rows.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No bank accounts yet.</p>}
      <Button type="button" variant="outline" onClick={() => set({ bankAccounts: addRow(rows, emptyBankAccount()) })}><Plus className="h-4 w-4" aria-hidden="true" />Add bank account</Button>
    </div>
  );
}

const ibanError = (v) => (String(v || "").trim() && !isValidIban(v) ? "That IBAN is not valid. Check it for a typing mistake." : undefined);
const swiftError = (v) => (String(v || "").trim() && !isValidSwift(v) ? "A SWIFT / BIC code has 8 or 11 characters" : undefined);

// ---------- KYC documents ----------

const STATUS_PILL = {
  [DOC_STATUS.EXPIRED]: { tone: "danger" },
  [DOC_STATUS.EXPIRING_SOON]: { tone: "warning" },
  [DOC_STATUS.VALID]: { tone: "success" },
};

// The state of one document: Valid, Expires in 12 days, Expired 3 days ago. Nothing for a document with no expiry.
export function DocumentStatusPill({ expiryDate }) {
  const s = documentStatus(expiryDate);
  const style = STATUS_PILL[s.status];
  if (!style) return null;
  return <Pill tone={style.tone}>{s.status === DOC_STATUS.VALID ? "Valid" : daysLeftText(s.daysLeft)}</Pill>;
}

function DocumentFile({ row, index, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function pick(files) {
    const file = files?.[0];
    if (!file) return;
    const problem = checkFile(file);
    if (problem) { setError(new Error(problem)); return; }
    setBusy(true);
    setError(null);
    try {
      const ref = await uploadAttachment(file, row.typeName ? { label: row.typeName } : {});
      // a file uploaded now but not saved yet is deleted at once if it is taken off again
      if (row.attachmentId && row.pending) await accounting.deleteAttachment(row.attachmentId).catch(() => {});
      onChange({ attachmentId: ref.attachmentId, fileName: ref.fileName, fileSize: ref.fileSize, pending: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function download() {
    try { await downloadAttachment({ attachmentId: row.attachmentId, fileName: row.fileName || "document" }); } catch (e) { setError(e); }
  }
  async function detach() {
    // a saved file is deleted when the party is saved; one only just uploaded goes now
    if (row.pending && row.attachmentId) await accounting.deleteAttachment(row.attachmentId).catch(() => {});
    onChange({ attachmentId: "", fileName: "", fileSize: undefined, pending: false });
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span className="text-sm font-medium text-foreground">File</span>
      {row.attachmentId ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.fileName || "File"}{row.fileSize ? <span className="ms-2 text-xs text-muted-foreground">{formatBytes(row.fileSize)}</span> : null}</span>
          <button type="button" aria-label={`Download file of document ${index + 1}`} onClick={download} className="grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Download className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" aria-label={`Remove file of document ${index + 1}`} onClick={detach} className={iconButton}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm text-foreground focus-within:ring-2 focus-within:ring-ring/40 hover:bg-accent">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /> : <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          {busy ? "Uploading…" : "Choose a file (PDF, image, Word or Excel, up to 10 MB)"}
          <input ref={input} type="file" className="sr-only" aria-label={`Upload file for document ${index + 1}`} onChange={(e) => pick(e.target.files)} />
        </label>
      )}
      {error && <ErrorNote error={error} />}
    </div>
  );
}

export function DocumentsSection({ value, set, errors, documentTypes, typesLoading }) {
  const rows = value.documents;
  const types = new Map(documentTypes.map((t) => [String(t._id), t]));
  const options = documentTypes.filter((t) => t.isActive !== false || rows.some((r) => String(r.documentTypeId) === String(t._id))).map((t) => ({ value: t._id, label: t.name, hint: t.requiresExpiry ? "expires" : undefined }));
  const edit = (i, patch) => set({ documents: updateRow(rows, i, patch) });
  const numberHint = (t) => {
    if (!t) return undefined;
    if (t.minLength && t.maxLength) return t.minLength === t.maxLength ? `${t.minLength} characters.` : `${t.minLength} to ${t.maxLength} characters.`;
    if (t.minLength) return `At least ${t.minLength} characters.`;
    if (t.maxLength) return `Up to ${t.maxLength} characters.`;
    return undefined;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">Trade licence, VAT certificate, Emirates ID, passport and the like. The status follows the expiry date, counted on the Dubai calendar; a document counts as expiring in its last 30 days.</p>
        <span className="text-xs text-muted-foreground">Reminders by email: Coming soon</span>
      </div>
      {rows.map((d, i) => {
        const type = d.documentTypeId ? types.get(String(d.documentTypeId)) : null;
        return (
          <RowFrame key={d.key || i} title={`Document ${i + 1}${d.typeName ? ` · ${d.typeName}` : ""}`} removeLabel={`Remove document ${i + 1}`} onRemove={() => set({ documents: removeRow(rows, i) })}>
            <Field label="Document type" required error={errors[`documents.${i}.documentTypeId`]}>
              <SearchSelect
                value={d.documentTypeId} loading={typesLoading} options={options} placeholder="Search document types…" noOptionsText="No document type matches"
                onChange={(v) => edit(i, { documentTypeId: v, typeName: types.get(String(v))?.name || "" })}
              />
            </Field>
            <Field label="Number" required={Boolean(type?.minLength)} error={errors[`documents.${i}.number`]} hint={numberHint(type)}>
              <TextInput value={d.number} onChange={(e) => edit(i, { number: e.target.value })} maxLength={type?.maxLength || 60} />
            </Field>
            <Field label="Issue date" error={errors[`documents.${i}.issueDate`]}>
              <DateInput value={d.issueDate} onChange={(e) => edit(i, { issueDate: e.target.value })} />
            </Field>
            <Field label="Expiry date" required={Boolean(type?.requiresExpiry)} error={errors[`documents.${i}.expiryDate`]} hint={d.expiryDate ? `On ${formatDate(d.expiryDate)}` : undefined}>
              <DateInput value={d.expiryDate} onChange={(e) => edit(i, { expiryDate: e.target.value })} />
            </Field>
            <DocumentFile row={d} index={i} onChange={(patch) => edit(i, patch)} />
            <div className="flex flex-wrap items-end gap-3 pb-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={d.isVerified} onChange={(e) => edit(i, { isVerified: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
                Verified
              </label>
              <DocumentStatusPill expiryDate={d.expiryDate} />
            </div>
          </RowFrame>
        );
      })}
      {rows.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No documents yet.</p>}
      <Button type="button" variant="outline" onClick={() => set({ documents: addRow(rows, emptyDocument()) })}><Plus className="h-4 w-4" aria-hidden="true" />Add document</Button>
    </div>
  );
}
