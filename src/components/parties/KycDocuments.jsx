import React, { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ConfirmDialog, DataTable, EmptyState, errorMessage, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Select, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import { partyMaster } from "../../lib/partyMasterApi";
import { DOC_STATUS, daysLeftText } from "../../lib/partyForms";
import { formatDate } from "../../utils/format";

// Customer and vendor KYC documents: which ones have expired or expire soon, and the master list of
// document types (what a trade licence or an Emirates ID is: does it expire, how long is its number).

const WINDOWS = [7, 30, 60, 90];

export default function KycDocuments() {
  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="KYC documents" description="Documents held for customers and vendors: what has expired or is about to, and the document types the forms offer." />
      <Tabs defaultValue="expiry">
        <TabsList aria-label="KYC documents">
          <TabsTrigger value="expiry">Expiring documents</TabsTrigger>
          <TabsTrigger value="types">Document types</TabsTrigger>
        </TabsList>
        <TabsContent value="expiry"><ExpiringDocuments /></TabsContent>
        <TabsContent value="types"><DocumentTypes /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- expiring documents ----------

function ExpiringDocuments() {
  const [withinDays, setWithinDays] = useState("30");
  const [partyType, setPartyType] = useState("");
  const { data, loading, error, reload } = useAsync(() => partyMaster.documentExpiry({ withinDays, ...(partyType ? { partyType } : {}) }), [withinDays, partyType]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Expiring within">
          <Select value={withinDays} onChange={(e) => setWithinDays(e.target.value)}>
            {WINDOWS.map((d) => <option key={d} value={d}>{d} days</option>)}
          </Select>
        </Field>
        <Field label="Show">
          <Select value={partyType} onChange={(e) => setPartyType(e.target.value)}>
            <option value="">Customers and vendors</option>
            <option value="customer">Customers</option>
            <option value="vendor">Vendors</option>
          </Select>
        </Field>
        <p className="pb-2 text-xs text-muted-foreground">Reminders by email: Coming soon</p>
      </div>
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <StatCard title="Expired" count={data.summary.expired} tone="rose" subText="Past their expiry date" />
          <StatCard title="Expiring soon" count={data.summary.expiringSoon} tone="olive" subText={`Within ${data.withinDays} days`} />
        </div>
      )}
      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading documents" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && data.rows.length === 0 && <EmptyState title="Nothing has expired or is about to" text={`Every document with an expiry date is good for more than ${data.withinDays} days.`} />}
        {data && data.rows.length > 0 && (
          <div className="overflow-x-auto">
            <DataTable
              caption="Documents expiring"
              rows={data.rows}
              rowKey={(r) => `${r.partyId}-${r.documentId}`}
              columns={[
                { key: "document", header: "Document", card: "primary", cell: (r) => r.documentType || "Document" },
                { key: "party", header: "Party", card: "title", cell: (r) => <><span className="font-medium">{r.partyName}</span> <span className="font-mono text-xs text-muted-foreground">{r.partyCode}</span></> },
                { key: "kind", header: "Kind", card: "meta", className: "text-muted-foreground", cell: (r) => r.partyType },
                { key: "number", header: "Number", card: "meta", className: "font-mono text-xs", cell: (r) => r.number || "-" },
                { key: "expiry", header: "Expiry date", card: "amount", className: "tabular-nums", cell: (r) => formatDate(r.expiryDate) },
                { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={r.status === DOC_STATUS.EXPIRED ? "danger" : "warning"}>{daysLeftText(r.daysLeft)}</Pill> },
              ]}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------- document types ----------

const blankType = () => ({ name: "", code: "", requiresExpiry: false, minLength: "", maxLength: "", isActive: true });

function DocumentTypes() {
  const { data, loading, error, reload } = useAsync(() => partyMaster.documentTypes.list(), []);
  const { notify, toastNode } = useToasts();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await partyMaster.documentTypes.remove(removing._id);
      notify(`${removing.name} deleted`);
      setRemoving(null);
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">These are offered on the customer and vendor forms. A type can say that its documents expire and how many characters the number has.</p>
        <Button onClick={() => setEditing(blankType())}><Plus className="h-4 w-4" aria-hidden="true" />New document type</Button>
      </div>
      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading document types" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && (
          <div className="overflow-x-auto">
            <DataTable
              caption="Document types"
              rows={data}
              rowKey={(t) => t._id}
              columns={[
                { key: "name", header: "Document type", card: "primary", className: "font-medium", cell: (t) => <>{t.name}{t.isSystem && <span className="ms-2 text-xs font-normal text-muted-foreground">Default</span>}</> },
                { key: "code", header: "Code", card: "meta", className: "font-mono text-xs", cell: (t) => t.code },
                // untagged, so the card shows it as "Expires: ..." - the wording is the screen's own
              { key: "expires", header: "Expires", cell: (t) => t.requiresExpiry ? "Yes, needs an expiry date" : "No" },
                { key: "length", header: "Number length", card: "meta", className: "tabular-nums text-muted-foreground", cell: (t) => lengthText(t) },
                { key: "status", header: "Status", card: "badge", cell: (t) => t.isActive ? <Pill tone="success">Active</Pill> : <Pill>Switched off</Pill> },
                { key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", cell: (t) => (<><button type="button" aria-label={`Edit ${t.name}`} onClick={() => setEditing({ ...blankType(), ...t, minLength: t.minLength ?? "", maxLength: t.maxLength ?? "" })} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden="true" /></button>{!t.isSystem && <button type="button" aria-label={`Delete ${t.name}`} onClick={() => setRemoving(t)} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}</>) },
              ]}
            />
          </div>
        )}
      </Panel>
      {editing && <DocumentTypeForm type={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); notify(msg); reload(); }} />}
      {removing && <ConfirmDialog title={`Delete ${removing.name}?`} text="This cannot be undone. A type that documents already use cannot be deleted; switch it off instead." confirmLabel="Delete" danger busy={busy} onConfirm={remove} onClose={() => setRemoving(null)} />}
      {toastNode}
    </div>
  );
}

function lengthText(t) {
  if (t.minLength && t.maxLength) return t.minLength === t.maxLength ? `${t.minLength}` : `${t.minLength} to ${t.maxLength}`;
  if (t.minLength) return `${t.minLength} or more`;
  if (t.maxLength) return `up to ${t.maxLength}`;
  return "Any";
}

export function DocumentTypeForm({ type, onClose, onSaved }) {
  const editing = Boolean(type._id);
  const [f, setF] = useState(type);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  async function save() {
    const e = {};
    if (!f.name.trim()) e.name = "Enter the document type's name";
    if (f.code && !/^[A-Za-z0-9_]{1,12}$/.test(f.code.trim())) e.code = "1 to 12 letters, digits or underscores";
    const limit = (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 60);
    if (!limit(f.minLength)) e.minLength = "A whole number from 0 to 60";
    if (!limit(f.maxLength)) e.maxLength = "A whole number from 0 to 60";
    if (!e.minLength && !e.maxLength && Number(f.minLength) && Number(f.maxLength) && Number(f.minLength) > Number(f.maxLength)) e.minLength = "The minimum cannot be more than the maximum";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = {
        name: f.name.trim(), requiresExpiry: f.requiresExpiry, isActive: f.isActive,
        minLength: f.minLength === "" ? null : Number(f.minLength), maxLength: f.maxLength === "" ? null : Number(f.maxLength),
        ...(f.code.trim() && !(editing && type.isSystem) ? { code: f.code.trim().toUpperCase() } : {}),
      };
      const saved = editing ? await partyMaster.documentTypes.update(type._id, body) : await partyMaster.documentTypes.create(body);
      onSaved(`${saved.name} ${editing ? "updated" : "added"}`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md" onClose={onClose} title={editing ? `Edit ${type.name}` : "New document type"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add document type"}</Button></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4">
        <ErrorNote error={problem} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name} className="sm:col-span-2"><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} data-autofocus placeholder="e.g. Halal certificate" /></Field>
          <Field label="Code" error={errors.code} hint={editing && type.isSystem ? "The code of a default type is fixed." : "Optional. Made from the name when empty."}>
            <TextInput value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} maxLength={12} disabled={editing && type.isSystem} />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={f.requiresExpiry} onChange={(e) => set({ requiresExpiry: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
              Documents of this type expire
            </label>
          </div>
          <Field label="Shortest number" error={errors.minLength} hint="Characters. Leave empty for no minimum."><TextInput type="number" min="0" max="60" value={f.minLength} onChange={(e) => set({ minLength: e.target.value })} /></Field>
          <Field label="Longest number" error={errors.maxLength} hint="Characters. Leave empty for no maximum."><TextInput type="number" min="0" max="60" value={f.maxLength} onChange={(e) => set({ maxLength: e.target.value })} /></Field>
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
            Offered on the forms <span className="text-muted-foreground">(documents already saved keep this type)</span>
          </label>
        )}
        <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
      </form>
    </Modal>
  );
}
