import React, { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { Button } from "../../ui/button";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import { DataTable, EmptyState, ErrorNote, Field, Modal, Panel, Pill, Select, Spinner, Textarea, TextInput, useAsync } from "../kit";

// Cost centres: the parts of the business whose income and costs are reported on their own (a shop, a project, a vehicle).
// Pick one on an invoice or a voucher, or on a single line; every ledger row carries it and the profit and loss can be read
// for one centre. A centre that has been used cannot be deleted - switch it off instead.
export default function CostCentres({ notify }) {
  const list = useAsync(() => accounting.costCentres(), []);
  const [modal, setModal] = useState(null);
  const { canAny } = useOrganisation();
  const canManage = canAny("accounts.manage");
  const rows = list.data || [];
  const nameOf = (id) => rows.find((c) => String(c._id) === String(id))?.name || "";

  return (
    <Panel
      title="Cost centres" bodyClassName="p-0"
      description="Report income and costs by shop, project or department. Choose a cost centre on an invoice or voucher, or on one line of it."
      actions={<Can permission="accounts.manage"><Button size="sm" onClick={() => setModal({})}><Plus className="h-4 w-4" aria-hidden="true" />New cost centre</Button></Can>}
    >
      {list.loading && !list.data && <Spinner />}
      {list.error && <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>}
      {list.data?.length === 0 && (
        <EmptyState
          title="No cost centres yet"
          text={canManage ? "Add one for each shop, project or department you want to see the profit of. Forms show a Cost centre field once there is one." : "No cost centre has been set up yet."}
        />
      )}
      {rows.length > 0 && (
        <DataTable
          caption="Cost centres"
          rows={rows}
          rowKey={(c) => c._id}
          columns={[
            { key: "code", header: "Code", card: "title", className: "font-mono text-xs", cell: (c) => c.code },
            { key: "name", header: "Name", card: "primary", className: "font-medium", cell: (c) => c.name },
            { key: "group", header: "Group", card: "meta", className: "text-sm text-muted-foreground", cell: (c) => (c.parentId ? nameOf(c.parentId) : "—") },
            { key: "status", header: "Status", card: "badge", cell: (c) => (c.isActive !== false ? <Pill tone="success">Active</Pill> : <Pill>Switched off</Pill>) },
            ...(canManage
              ? [{
                  key: "edit", header: <span className="sr-only">Edit</span>, align: "end", card: "actions",
                  cell: (c) => (
                    <button type="button" onClick={() => setModal({ centre: c })} aria-label={`Edit ${c.name}`} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent lg:h-8 lg:w-8">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ),
                }]
              : []),
          ]}
        />
      )}
      {modal && (
        <CostCentreModal
          {...modal}
          groups={rows.filter((c) => !c.parentId && String(c._id) !== String(modal.centre?._id || ""))}
          onClose={() => setModal(null)}
          onSaved={(m) => { setModal(null); notify(m); list.reload(); }}
          onRemoved={(m) => { setModal(null); notify(m); list.reload(); }}
        />
      )}
    </Panel>
  );
}

export function CostCentreModal({ centre, groups = [], onClose, onSaved, onRemoved }) {
  const editing = Boolean(centre);
  const [form, setForm] = useState({
    code: centre?.code || "", name: centre?.name || "", parentId: centre?.parentId ? String(centre.parentId) : "",
    notes: centre?.notes || "", isActive: centre ? centre.isActive !== false : true,
  });
  const [errors, setErrors] = useState({});
  const [topError, setTopError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (!/^[A-Za-z0-9_-]{1,12}$/.test(form.code.trim())) e.code = "1 to 12 letters, digits, - or _";
    if (!form.name.trim()) e.name = "Give the cost centre a name";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body = { code: form.code.trim(), name: form.name.trim(), parentId: form.parentId || null, notes: form.notes, isActive: form.isActive };
      if (editing) await accounting.updateCostCentre(centre._id, body);
      else await accounting.createCostCentre(body);
      onSaved(editing ? `${body.name} updated` : `${body.name} created`);
    } catch (err) {
      if (err.code === "COST_CENTRE_EXISTS") setErrors({ code: "A cost centre with this code or name already exists" });
      else setTopError(err);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await accounting.removeCostCentre(centre._id);
      onRemoved(`${centre.name} deleted`);
    } catch (err) {
      setTopError(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md" title={editing ? `Edit ${centre.name}` : "New cost centre"} onClose={onClose}
      footer={
        <>
          {editing && <Button type="button" variant="outline" className="me-auto" onClick={remove} disabled={busy}>Delete</Button>}
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="cost-centre-form" disabled={busy} data-shortcut="save">{busy ? "Saving…" : editing ? "Save changes" : "Create cost centre"}</Button>
        </>
      }
    >
      <form id="cost-centre-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {topError && <div className="sm:col-span-2"><ErrorNote error={topError} /></div>}
        <Field label="Code" required error={errors.code} hint="Short, e.g. SHOP1"><TextInput value={form.code} onChange={set("code")} maxLength={12} data-autofocus /></Field>
        <Field label="Name" required error={errors.name}><TextInput value={form.name} onChange={set("name")} maxLength={100} placeholder="e.g. Deira shop" /></Field>
        <Field label="Group" hint="Optional: report several centres together" className="sm:col-span-2">
          <Select value={form.parentId} onChange={set("parentId")}>
            <option value="">No group</option>
            {groups.map((g) => <option key={g._id} value={g._id}>{g.code} · {g.name}</option>)}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={set("notes")} rows={2} maxLength={500} /></Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isActive} onChange={set("isActive")} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
            Active (a switched-off centre stays on what it was used for, but cannot be chosen again)
          </label>
        )}
      </form>
    </Modal>
  );
}
