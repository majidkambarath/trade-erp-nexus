import React, { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { DataTable, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, SearchSelect, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import Can from "../shell/Can.jsx";
import { choices, routes, vans } from "../../lib/vanSalesApi";
import { vanErrorText } from "../../lib/vanSales";

// Van sales > Vans and routes: the two masters. A van gets its own cash account when it is made (what the van takes
// is that account's balance); a route is the customers a van calls on, in the order it calls, and the days it runs.
const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const primaryBtn = "inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90";

function VanDialog({ van, people, routeList, onClose, onSaved }) {
  const editing = Boolean(van?.id);
  const [f, setF] = useState({ code: van?.code || "", name: van?.name || "", plate: van?.plate || "", salesmanId: van?.salesmanId || "", defaultRouteId: van?.defaultRouteId || "", active: van?.active !== false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { ...f, defaultRouteId: f.defaultRouteId || null };
      onSaved(editing ? await vans.update(van.id, body) : await vans.create(body), `${f.name} saved.`);
    } catch (err) { setError(err); setBusy(false); }
  }
  return (
    <Modal size="md" title={editing ? `Edit ${van.code}` : "New van"} description={editing ? undefined : "A cash account for the van is made with it, under Cash in the chart of accounts."} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !f.code || !f.name}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code" required hint={editing ? "The code does not change." : "Short, like VAN-1."}><TextInput value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} disabled={editing} maxLength={20} autoFocus={!editing} /></Field>
          <Field label="Number plate"><TextInput value={f.plate} onChange={(e) => set({ plate: e.target.value })} maxLength={20} /></Field>
        </div>
        <Field label="Name" required><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} /></Field>
        <Field label="Usual salesman"><SearchSelect value={f.salesmanId} onChange={(v) => set({ salesmanId: v })} clearable options={people.map((p) => ({ value: p.id, label: p.name }))} placeholder="Choose…" /></Field>
        <Field label="Usual route"><SearchSelect value={f.defaultRouteId} onChange={(v) => set({ defaultRouteId: v })} clearable options={routeList.map((r) => ({ value: r.id, label: r.name }))} placeholder="Choose…" /></Field>
        {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>}
      </div>
    </Modal>
  );
}

function RouteDialog({ route, onClose, onSaved }) {
  const editing = Boolean(route?.id);
  const customers = useAsync(() => choices.customers(), []);
  const [name, setName] = useState(route?.name || "");
  const [days, setDays] = useState(route?.days || []);
  const [stops, setStops] = useState((route?.customers || []).map((c) => ({ customerId: String(c.customerId), name: c.name })));
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const move = (i, d) => setStops((s) => { const n = [...s]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const taken = new Set(stops.map((s) => s.customerId));
  const options = (customers.data || []).filter((c) => !taken.has(c.id)).map((c) => ({ value: c.id, label: c.name, hint: c.code }));
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { name, days, customers: stops };
      onSaved(editing ? await routes.update(route.id, body) : await routes.create(body), `${name} saved.`);
    } catch (err) { setError(err); setBusy(false); }
  }
  return (
    <Modal size="lg" title={editing ? `Edit ${route.name}` : "New route"} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div className="grid grid-cols-1 gap-3">
        {error && <ErrorNote error={new Error(vanErrorText(error))} />}
        <Field label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus /></Field>
        <Field label="Runs on" hint="Leave all unticked for any day.">
          <div className="flex flex-wrap gap-2">
            {DAYS.map(([d, label]) => (
              <label key={d} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm">
                <input type="checkbox" checked={days.includes(d)} onChange={(e) => setDays((x) => (e.target.checked ? [...x, d] : x.filter((y) => y !== d)))} /> {label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Customers, in the order they are called on">
          <div className="grid gap-2">
            {stops.map((s, i) => (
              <div key={s.customerId} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                <span className="w-5 text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <button type="button" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label={`Move ${s.name} down`} disabled={i === stops.length - 1} onClick={() => move(i, 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-40"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label={`Remove ${s.name}`} onClick={() => setStops((x) => x.filter((_, j) => j !== i))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <SearchSelect value={adding} onChange={(v) => { const c = (customers.data || []).find((x) => x.id === v); if (c) setStops((s) => [...s, { customerId: c.id, name: c.name }]); setAdding(""); }} options={options} loading={customers.loading} placeholder="Add a customer…" />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export default function VansSetupPage() {
  const [tab, setTab] = useState("vans");
  const vanList = useAsync(() => vans.list({ all: 1 }), []);
  const routeList = useAsync(() => routes.list({ all: 1 }), []);
  const people = useAsync(() => choices.assignees(), []);
  const { notify, toastNode } = useToasts();
  const [dialog, setDialog] = useState(null);
  const done = (message) => { setDialog(null); notify(message); vanList.reload(); routeList.reload(); };

  const vanCols = [
    { key: "code", header: "Van", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.code}</span> },
    { key: "name", header: "Name", card: "title", cell: (r) => <div className="min-w-0"><p className="truncate font-medium">{r.name}</p><p className="truncate text-xs text-muted-foreground">{r.plate}</p></div> },
    { key: "salesman", header: "Usual salesman", card: "meta", cell: (r) => r.salesmanName || "–" },
    { key: "out", header: "Now", card: "badge", cell: (r) => (r.openTrip ? <Pill tone="success">{r.openTrip.tripNo}</Pill> : r.active ? <Pill tone="neutral">At the depot</Pill> : <Pill tone="neutral">Inactive</Pill>) },
  ];
  const routeCols = [
    { key: "name", header: "Route", card: "primary", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "stops", header: "Customers", card: "meta", cell: (r) => `${r.customers?.length || 0}` },
    { key: "days", header: "Days", card: "meta", cell: (r) => (r.days?.length ? DAYS.filter(([d]) => r.days.includes(d)).map(([, l]) => l).join(", ") : "Any day") },
    { key: "active", header: "", card: "badge", cell: (r) => (r.active ? null : <Pill tone="neutral">Inactive</Pill>) },
  ];

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Vans and routes" description="The vans, who drives them, and the customers each one calls on."
        actions={<Can permission="vansales.manage"><button type="button" data-shortcut="new" className={primaryBtn} onClick={() => setDialog(tab === "vans" ? { kind: "van" } : { kind: "route" })}><Plus className="h-4 w-4" aria-hidden="true" /> {tab === "vans" ? "New van" : "New route"}</button></Can>} />
      <div className="mt-6"><PillTabs label="Vans and routes" tabs={[["vans", "Vans"], ["routes", "Routes"]]} value={tab} onChange={setTab} /></div>
      <div className="mt-4">
        <Panel bodyClassName="p-0">
          {tab === "vans" && (
            <>
              {vanList.loading && !vanList.data && <Spinner label="Reading the vans" />}
              {vanList.error && <ErrorNote error={vanList.error} onRetry={vanList.reload} />}
              {vanList.data?.length === 0 && <EmptyState title="No vans yet" text="Add the first van to start loading trips." />}
              {vanList.data?.length > 0 && <DataTable caption="Vans" rows={vanList.data} rowKey={(r) => r.id} onRowClick={(r) => setDialog({ kind: "van", van: r })} columns={vanCols} />}
            </>
          )}
          {tab === "routes" && (
            <>
              {routeList.loading && !routeList.data && <Spinner label="Reading the routes" />}
              {routeList.error && <ErrorNote error={routeList.error} onRetry={routeList.reload} />}
              {routeList.data?.length === 0 && <EmptyState title="No routes yet" text="A route lists the customers a van calls on, in order." />}
              {routeList.data?.length > 0 && <DataTable caption="Routes" rows={routeList.data} rowKey={(r) => r.id} onRowClick={(r) => setDialog({ kind: "route", route: r })} columns={routeCols} />}
            </>
          )}
        </Panel>
      </div>
      {dialog?.kind === "van" && <VanDialog van={dialog.van} people={people.data || []} routeList={routeList.data || []} onClose={() => setDialog(null)} onSaved={(_, m) => done(m)} />}
      {dialog?.kind === "route" && <RouteDialog route={dialog.route} onClose={() => setDialog(null)} onSaved={(_, m) => done(m)} />}
      {toastNode}
    </div>
  );
}
