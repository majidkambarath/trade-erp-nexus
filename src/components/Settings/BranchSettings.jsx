import React, { useState } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { Button } from "../ui/button";
import { ConfirmDialog, DataTable, EmptyState, ErrorNote, Field, Modal, Panel, Pill, Spinner, TextInput, useAsync } from "../accounting/kit";
import { branchesApi } from "../../lib/branchApi";
import { branchChanges, branchFrom, codeFromName, emptyBranch, newBranchPayload, planNote, validateBranch } from "../../lib/branchForms";
import { useOrganisation } from "../shell/OrganisationContext";

// The organisation's branches. A branch keeps its own documents, numbers and reports; the chart of accounts, customers,
// vendors and stock items are shared by the whole company. Anyone who may see the settings sees the list; adding and
// changing a branch is part of changing the company's settings (settings.manage). The plan's feature and limit are the
// server's to decide - this only words them - and a branch with people in it cannot be switched off (the server says so).
function BranchDialog({ branch, onClose, onSaved }) {
  const isNew = !branch;
  const [form, setForm] = useState(() => (branch ? branchFrom(branch) : emptyBranch()));
  const [codeTouched, setCodeTouched] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  const errors = validateBranch(form, { isNew });
  const show = (key) => (touched ? errors[key] : undefined);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const onName = (e) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, ...(isNew && !codeTouched ? { code: codeFromName(name) } : {}) }));
  };

  const save = async () => {
    setTouched(true);
    if (Object.keys(errors).length || busy) return;
    const body = isNew ? newBranchPayload(form) : branchChanges(form, branch);
    if (!isNew && Object.keys(body).length === 0) return onClose();
    setBusy(true);
    setServerError(null);
    try {
      const saved = isNew ? await branchesApi.create(body) : await branchesApi.update(branch.code, body);
      onSaved(saved, isNew);
    } catch (error) {
      setServerError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Add a branch" : `Change ${branch.name}`}
      description={isNew ? "Its documents are numbered with its code, so a branch can be told apart on paper." : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : isNew ? "Add branch" : "Save"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={show("name")} className="sm:col-span-2">
          <TextInput value={form.name} onChange={onName} autoComplete="off" placeholder="Sharjah Warehouse" />
        </Field>
        <Field label="Code" required={isNew} error={show("code")} hint={isNew ? "2 to 20 lower-case letters, digits or hyphens. It cannot be changed later." : "A code is stamped on documents, so it cannot be changed."}>
          <TextInput value={form.code} onChange={(e) => { setCodeTouched(true); setForm((f) => ({ ...f, code: e.target.value.toLowerCase() })); }} disabled={!isNew} autoComplete="off" placeholder="shj" />
        </Field>
        <Field label="City"><TextInput value={form.city} onChange={set("city")} /></Field>
        <Field label="Address" className="sm:col-span-2"><TextInput value={form.addressLine1} onChange={set("addressLine1")} placeholder="Street, building, area" /></Field>
        <Field label="Phone"><TextInput type="tel" value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Email" error={show("email")}><TextInput type="email" value={form.email} onChange={set("email")} /></Field>
      </div>
      {serverError && <div className="mt-4"><ErrorNote error={serverError} /></div>}
    </Modal>
  );
}

export default function BranchSettings({ notify }) {
  const { status, can, refresh } = useOrganisation();
  const branches = useAsync(() => branchesApi.list(), []);
  const [dialog, setDialog] = useState(null); // "new" | a branch
  const [switching, setSwitching] = useState(null); // a branch about to be switched off
  const [busy, setBusy] = useState(false);
  const canManage = can("settings.manage");
  const rows = branches.data || [];
  const used = rows.filter((b) => b.isActive).length;
  const plan = planNote({ featureOn: status?.features?.multiBranch, limit: status?.limits?.branches, used });

  // The branch switcher in the top bar reads the organisation's status, so it is read again after a change.
  const changed = async () => { await Promise.all([branches.reload(), refresh?.()]); };

  const saved = async (branch, isNew) => {
    setDialog(null);
    notify(isNew ? `${branch.name} added` : `${branch.name} saved`);
    await changed();
  };

  const setActive = async (branch, isActive) => {
    setBusy(true);
    try {
      await branchesApi.update(branch.code, { isActive });
      notify(isActive ? `${branch.name} is switched on` : `${branch.name} is switched off`);
      setSwitching(null);
      await changed();
    } catch (error) {
      setSwitching(null);
      notify(error.message || "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: "name", header: "Branch", card: "primary", cell: (b) => <span className="font-medium">{b.name}</span> },
    { key: "code", header: "Code", card: "meta", cell: (b) => <span className="font-mono text-xs">{b.code}</span> },
    { key: "city", header: "City", card: "meta", cell: (b) => b.address?.city || "-" },
    { key: "people", header: "People", card: "meta", cell: (b) => `${b.people ?? 0} ${b.people === 1 ? "person" : "people"}` },
    { key: "state", header: "Status", card: "badge", cell: (b) => (b.isHeadOffice ? <Pill tone="info">Head office</Pill> : <Pill tone={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Switched off"}</Pill>) },
    ...(canManage
      ? [{
          key: "actions", header: <span className="sr-only">Actions</span>, card: "actions", align: "end",
          cell: (b) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDialog(b)} aria-label={`Change ${b.name}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Change</Button>
              {!b.isHeadOffice && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => (b.isActive ? setSwitching(b) : setActive(b, true))} aria-label={`${b.isActive ? "Switch off" : "Switch on"} ${b.name}`}>
                  <Power className="h-3.5 w-3.5" aria-hidden="true" />{b.isActive ? "Switch off" : "Switch on"}
                </Button>
              )}
            </div>
          ),
        }]
      : []),
  ];

  return (
    <Panel
      title="Branches"
      description="A branch keeps its own documents, numbers and reports. The chart of accounts, customers, vendors and stock items are shared by the whole company."
      actions={canManage && plan.canAdd && <Button onClick={() => setDialog("new")}><Plus className="h-4 w-4" aria-hidden="true" />Add a branch</Button>}
      bodyClassName="p-0"
    >
      <p className="border-b border-border px-5 py-3 text-sm text-muted-foreground" aria-live="polite">{plan.text}{!plan.canAdd && status?.support?.contact ? ` Contact ${status.support.contact} to change it.` : ""}</p>
      {branches.loading && !branches.data && <Spinner label="Loading branches" />}
      {branches.error && <div className="p-5"><ErrorNote error={branches.error} onRetry={branches.reload} /></div>}
      {branches.data && rows.length === 0 && <EmptyState title="No branches yet" text="The head office is made with the organisation." />}
      {rows.length > 0 && <DataTable caption="Branches" columns={columns} rows={rows} rowKey={(b) => b.code} />}
      {dialog && <BranchDialog branch={dialog === "new" ? null : dialog} onClose={() => setDialog(null)} onSaved={saved} />}
      {switching && (
        <ConfirmDialog
          title={`Switch off ${switching.name}?`}
          text="Nothing is deleted. Its documents stay, and it can be switched on again. People who work from it must be moved to another branch first."
          confirmLabel="Switch off"
          danger
          busy={busy}
          onConfirm={() => setActive(switching, false)}
          onClose={() => setSwitching(null)}
        />
      )}
    </Panel>
  );
}
