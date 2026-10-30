import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { AmountInput, DataTable, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Select, SearchSelect, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import Can from "../shell/Can.jsx";
import { setup } from "../../lib/garageApi";
import { garageErrorText, BAY_KIND_LABEL } from "../../lib/garage";
import { useGarageMasters } from "./garageShared";

// Inventory > Garage > Setup: the service menu (standard jobs that fill a job card's estimate and tasks in
// one tap) and the bays a task can be assigned to. garage.manage only - the same door as every other
// organisation-wide "configure how this module works" screen.

function BayDialog({ bay, onClose, onSaved }) {
  const editing = Boolean(bay?._id);
  const [name, setName] = useState(bay?.name || "");
  const [code, setCode] = useState(bay?.code || "");
  const [kind, setKind] = useState(bay?.kind || "mechanical");
  const [active, setActive] = useState(bay?.active !== false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = { name, code, kind, active };
      const r = editing ? await setup.updateBay(bay._id, body) : await setup.createBay(body);
      onSaved(r, `${name} saved.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal size="sm" onClose={onClose} title={editing ? "Edit bay" : "New bay"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-3">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <Field label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code (optional)"><TextInput value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Field label="Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(BAY_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
        )}
      </div>
    </Modal>
  );
}

function ServiceDialog({ svc, masters, onClose, onSaved }) {
  const editing = Boolean(svc?._id);
  const [code, setCode] = useState(svc?.code || "");
  const [name, setName] = useState(svc?.name || "");
  const [category, setCategory] = useState(svc?.category || "");
  const [serviceItemId, setServiceItemId] = useState(svc?.serviceItemId ? String(svc.serviceItemId?._id || svc.serviceItemId) : "");
  const [standardHours, setStandardHours] = useState(svc?.standardHours ? String(svc.standardHours) : "");
  const [active, setActive] = useState(svc?.active !== false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const canSave = code.trim() && name.trim() && serviceItemId;

  async function submit() {
    if (!canSave) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = { code, name, category, serviceItemId, standardHours: standardHours === "" ? undefined : Number(standardHours), active };
      const r = editing ? await setup.updateService(svc._id, body) : await setup.createService(body);
      onSaved(r, `${name} saved.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal size="sm" onClose={onClose} title={editing ? "Edit standard job" : "New standard job"}
      description="The labour item this bills under; parts and tasks can be added once it exists, by using it on a job card and saving those as its defaults is not built yet - add them from the estimate for now."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !canSave}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-3">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code" required><TextInput value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></Field>
          <Field label="Category"><TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Oil service, brakes…" /></Field>
        </div>
        <Field label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="40,000 km service" /></Field>
        <Field label="Service item" required hint="A service item (Inventory > Stock items) carrying the price and income account.">
          <SearchSelect value={serviceItemId} onChange={setServiceItemId} options={masters.serviceOptions} loading={masters.loading} placeholder="Choose the labour item…" />
        </Field>
        <Field label="Standard hours"><AmountInput value={standardHours} onChange={(e) => setStandardHours(e.target.value)} min="0" /></Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function GarageSetupPage() {
  const { notify, toastNode } = useToasts();
  const [tab, setTab] = useState("services");
  const masters = useGarageMasters();
  const bays = useAsync(() => setup.bays({ status: "all" }), []);
  const services = useAsync(() => setup.services({ status: "all" }), []);
  const [addingBay, setAddingBay] = useState(false);
  const [editingBay, setEditingBay] = useState(null);
  const [addingService, setAddingService] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const bayColumns = [
    { key: "name", header: "Bay", card: "primary", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "code", header: "Code", card: "meta", cell: (r) => r.code || "–" },
    { key: "kind", header: "Kind", card: "badge", cell: (r) => BAY_KIND_LABEL[r.kind] || r.kind },
    { key: "active", header: "Status", card: "badge", cell: (r) => <Pill tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Pill> },
    { key: "actions", header: "", card: "actions", cell: (r) => <Button variant="outline" size="sm" onClick={() => setEditingBay(r)}>Edit</Button> },
  ];
  const serviceColumns = [
    { key: "code", header: "Code", card: "meta", cell: (r) => r.code },
    { key: "name", header: "Standard job", card: "primary", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "category", header: "Category", card: "meta", cell: (r) => r.category || "–" },
    { key: "hours", header: "Std. hours", align: "end", card: "amount", cell: (r) => r.standardHours || "–" },
    { key: "active", header: "Status", card: "badge", cell: (r) => <Pill tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Pill> },
    { key: "actions", header: "", card: "actions", cell: (r) => <Button variant="outline" size="sm" onClick={() => setEditingService(r)}>Edit</Button> },
  ];

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Garage setup" description="The service menu and the bays a task can be assigned to." />
      <div className="mt-4"><PillTabs tabs={[["services", "Service menu"], ["bays", "Bays"]]} value={tab} onChange={setTab} label="Garage setup" /></div>

      {tab === "services" && (
        <Panel className="mt-4">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <h2 className="text-sm font-semibold">Standard jobs</h2>
            <Can permission="garage.manage">
              <Button size="sm" onClick={() => setAddingService(true)}><Plus className="me-1 h-4 w-4" /> New standard job</Button>
            </Can>
          </div>
          {services.loading && <Spinner label="Loading the service menu" />}
          {services.error && <ErrorNote error={services.error} onRetry={services.reload} />}
          {!services.loading && (services.data || []).length === 0 && <EmptyState title="No standard jobs yet" description="Add one to fill a job card's estimate and tasks in one tap." />}
          {(services.data || []).length > 0 && <DataTable columns={serviceColumns} rows={services.data} rowKey={(r) => r._id} caption="Standard jobs" />}
        </Panel>
      )}

      {tab === "bays" && (
        <Panel className="mt-4">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <h2 className="text-sm font-semibold">Bays</h2>
            <Can permission="garage.manage">
              <Button size="sm" onClick={() => setAddingBay(true)}><Plus className="me-1 h-4 w-4" /> New bay</Button>
            </Can>
          </div>
          {bays.loading && <Spinner label="Loading the bays" />}
          {bays.error && <ErrorNote error={bays.error} onRetry={bays.reload} />}
          {!bays.loading && (bays.data || []).length === 0 && <EmptyState title="No bays yet" description="Add the ramps, lifts and booths a task can be assigned to." />}
          {(bays.data || []).length > 0 && <DataTable columns={bayColumns} rows={bays.data} rowKey={(r) => r._id} caption="Bays" />}
        </Panel>
      )}

      {addingBay && <BayDialog onClose={() => setAddingBay(false)} onSaved={() => { setAddingBay(false); bays.reload(); notify("Bay saved."); }} />}
      {editingBay && <BayDialog bay={editingBay} onClose={() => setEditingBay(null)} onSaved={() => { setEditingBay(null); bays.reload(); notify("Bay saved."); }} />}
      {addingService && <ServiceDialog masters={masters} onClose={() => setAddingService(false)} onSaved={() => { setAddingService(false); services.reload(); notify("Standard job saved."); }} />}
      {editingService && <ServiceDialog svc={editingService} masters={masters} onClose={() => setEditingService(null)} onSaved={() => { setEditingService(null); services.reload(); notify("Standard job saved."); }} />}
      {toastNode}
    </div>
  );
}
