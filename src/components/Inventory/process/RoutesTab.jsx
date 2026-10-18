import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../ui/button";
import { api } from "../../../lib/accountingApi";
import { pageSession } from "../../../lib/pageSession";
import { processOrders, processRoutes } from "../../../lib/processOrderApi";
import { emptyRoute, emptyRouteStep, processErrorText, routeBody, routeToForm, validateRoute } from "../../../lib/processOrders";
import { formatNumber } from "../../../utils/format";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import FilterBar from "../../lists/FilterBar";
import { useMasters } from "../productionShared";
import { MaterialsEditor, StepsEditor } from "./StepsEditor";
import { ConfirmDialog, DataTable, EmptyState, ErrorNote, Field, Modal, Panel, SearchSelect, Spinner, Textarea, TextInput, useAsync, useToasts } from "../../accounting/kit";

// Inventory > Production > Routes: each product's saved way through the shop - what it is made from (for a batch) and
// its steps in order, with who usually does each and the days it takes. A new process order for the product is planned
// from it ("Use the saved route"); changing a route never changes an order already made.

const session = pageSession("process-routes");
const qty = (n) => formatNumber(n ?? 0, 3).replace(/\.?0+$/, "");
const days = (n) => `${n} day${n === 1 ? "" : "s"}`;

export default function RoutesTab() {
  const [search, setSearch] = useState(() => session.get("search", ""));
  const list = useAsync(() => processRoutes.list(search.trim() ? { search: search.trim() } : undefined), [search]);
  const { notify, toastNode } = useToasts();
  const [editing, setEditing] = useState(null);
  const done = (message) => { setEditing(null); notify(message); list.reload(); };

  return (
    <>
      <Panel
        bodyClassName="p-0"
        title="Routes"
        description="Each product's materials and steps, saved once. A new process order for it is planned from its route: the materials for the quantity, each step's person and due date."
        actions={<Can permission="inventory.adjust"><Button size="sm" onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" aria-hidden="true" />New route</Button></Can>}
      >
        <div className="border-b p-4">
          <FilterBar search={search} onSearch={(v) => { setSearch(v); session.set("search", v); }} placeholder="Search product or step…" active={Boolean(search)} onClear={() => { setSearch(""); session.set("search", ""); }} />
        </div>
        {list.loading && !list.data && <Spinner label="Loading routes" />}
        {list.error && <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>}
        {list.data?.length === 0 && (
          <EmptyState title="No routes" text={search ? "Nothing matches." : "Save a product's steps once and every new order for it is planned in one click. You can also tick \"Save as this product's route\" on a process order."} />
        )}
        {list.data?.length > 0 && (
          <DataTable
            caption="Routes"
            rows={list.data}
            rowKey={(r) => r._id}
            onRowClick={(r) => setEditing(r)}
            columns={[
              { key: "item", header: "Product", card: "title", cell: (r) => <><span className="font-medium">{r.finished.itemName}</span><span className="ms-1 text-xs text-muted-foreground">{r.finished.itemId}</span></> },
              { key: "steps", header: "Steps", cell: (r) => <span className="text-sm">{r.steps.map((s) => s.name).join(" › ")}</span> },
              { key: "days", header: "Takes", card: "meta", className: "whitespace-nowrap", cell: (r) => days(r.totalDays) },
              { key: "batch", header: "Materials for", align: "end", className: "hidden whitespace-nowrap lg:table-cell", headerClassName: "hidden lg:table-cell", cell: (r) => qty(r.batchQty) },
              { key: "open", header: <span className="sr-only">Action</span>, align: "end", card: "actions", cell: (r) => <Button size="sm" variant="outline" aria-label={`Open the route for ${r.finished.itemName}`} onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Open</Button> },
            ]}
          />
        )}
      </Panel>
      {editing && <RouteForm route={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={done} />}
      {toastNode}
    </>
  );
}

export function RouteForm({ route, onClose, onSaved }) {
  const masters = useMasters();
  const { can } = useOrganisation();
  const people = useAsync(() => processOrders.assignees(), []);
  const vendors = useAsync(() => api.get("/vendors/vendors"), []);
  const [form, setForm] = useState(() => (route ? routeToForm(route) : emptyRoute()));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const personOptions = useMemo(() => (people.data || []).map((p) => ({ value: p.id, label: p.name })), [people.data]);
  const vendorOptions = useMemo(() => (vendors.data || []).map((v) => ({ value: v._id, label: v.vendorName, hint: v.vendorId })), [vendors.data]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const total = form.steps.reduce((t, s) => t + (Number(s.days) || 0), 0);
  const editable = can("inventory.adjust");

  async function save() {
    const e = validateRoute(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const saved = route ? await processRoutes.update(route._id, routeBody(form)) : await processRoutes.create(routeBody(form));
      onSaved(`Route saved for ${saved.finished.itemName}: ${saved.steps.length} step${saved.steps.length === 1 ? "" : "s"}, ${days(saved.totalDays)}.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await processRoutes.remove(route._id);
      onSaved(`Route for ${route.finished.itemName} deleted. Orders already made keep their steps.`);
    } catch (err) {
      setFailure(err);
      setConfirm(false);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={route ? `Route for ${route.finished.itemName}` : "New route"}
      description="What the product is made from and the steps it goes through. Orders made from it can still be changed one by one."
      footer={editable ? (
        <div className="flex flex-wrap justify-end gap-2">
          {route && <Button variant="outline" onClick={() => setConfirm(true)}>Delete</Button>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy} data-shortcut="save">{busy ? "Saving…" : "Save route"}</Button>
        </div>
      ) : <Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-5">
        {failure && <ErrorNote error={new Error(processErrorText(failure))} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Product" required error={errors.finishedId} className="sm:col-span-2">
            <SearchSelect value={form.finishedId} onChange={(v) => set({ finishedId: v })} options={masters.itemOptions} loading={masters.loading} placeholder="Choose the product" aria-label="Product" autoFocus={!route} noOptionsText="Add the product under Inventory > Stock Items first." />
          </Field>
          <Field label="Materials are for" required error={errors.batchQty} hint="How many products the quantities below make.">
            <TextInput type="number" min="0" step="any" inputMode="decimal" value={form.batchQty} onChange={(e) => set({ batchQty: e.target.value })} aria-label="Materials are for" />
          </Field>
        </div>
        <section aria-labelledby="route-materials">
          <h3 id="route-materials" className="mb-1 text-sm font-semibold">Made from</h3>
          <p className="mb-3 text-xs text-muted-foreground">Scaled to each order's quantity. The first material is what goes out to a job worker.</p>
          <MaterialsEditor materials={form.materials} onChange={(materials) => set({ materials })} errors={errors} itemOptions={masters.itemOptions} loading={masters.loading} finishedId={form.finishedId} />
        </section>
        <section aria-labelledby="route-steps">
          <h3 id="route-steps" className="mb-1 text-sm font-semibold">Steps, in order</h3>
          <p className="mb-3 text-xs text-muted-foreground">Days are calendar days after the step before (the first, after the order's day). In all: {days(total)}.</p>
          <StepsEditor steps={form.steps} onChange={(steps) => set({ steps })} errors={errors} kind="route" makeStep={emptyRouteStep} vendorOptions={vendorOptions} vendorsLoading={vendors.loading} personOptions={personOptions} peopleLoading={people.loading} />
        </section>
        <Field label="Notes"><Textarea value={form.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </form>
      {confirm && (
        <ConfirmDialog title="Delete this route?" text="New orders for the product will no longer be planned from it. Orders already made keep their steps." confirmLabel="Delete" danger busy={busy}
          onClose={() => setConfirm(false)} onConfirm={remove} />
      )}
    </Modal>
  );
}
