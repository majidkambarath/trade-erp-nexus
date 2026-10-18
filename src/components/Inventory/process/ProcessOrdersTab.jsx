import React, { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { api } from "../../../lib/accountingApi";
import { pageSession } from "../../../lib/pageSession";
import { processOrders } from "../../../lib/processOrderApi";
import {
  DUE_LABEL, DUE_TONE, ORDER_STATUS, STEP_SUGGESTIONS, emptyProcess, emptyStep, processBody, processErrorText, processToForm, stepLabel,
  stepsFromLast, validateProcess,
} from "../../../lib/processOrders";
import { warningsOf } from "../../../lib/production";
import { formatDate, formatNumber, todayInput } from "../../../utils/format";
import { orgCurrency } from "../../../utils/orgLocale";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import FilterBar, { FilterSelect } from "../../lists/FilterBar";
import { useMasters, WarningsDialog } from "../productionShared";
import {
  ConfirmDialog, DataTable, DateInput, EmptyState, ErrorNote, Field, Modal, Panel, Pill, SearchSelect, Select, Spinner, Textarea, TextInput,
  useAsync, useToasts,
} from "../../accounting/kit";

// Inventory > Production > Process orders: a product made through several steps (cutting, bending, painting, packing ...),
// each done in house by a named person or by an outside job worker. Steps run one after another, each with what came out
// of the one before; when every step is done, Finish posts ONE production (materials out, the product in at their cost
// plus the costs moved in). Rules: lib/processOrders.js; the server decides again (utils/processOrders.js).

const session = pageSession("process-orders");
const qty = (n) => formatNumber(n ?? 0, 3).replace(/\.?0+$/, "");
const money = (n) => formatNumber(n ?? 0, 2);
const OrderPill = ({ status }) => <Pill tone={ORDER_STATUS[status]?.tone || "neutral"}>{ORDER_STATUS[status]?.label || status}</Pill>;
const stepWho = (s) => (s.mode === "job_work" ? s.jobWorkerName || "Job worker" : s.assigneeName || "In house");

export default function ProcessOrdersTab() {
  const [search, setSearch] = useState(() => session.get("search", ""));
  const [status, setStatus] = useState(() => session.get("status", ""));
  const params = { ...(status && { status }), ...(search.trim() && { search: search.trim() }) };
  const list = useAsync(() => processOrders.list(params), [JSON.stringify(params)]);
  const { notify, toastNode } = useToasts();
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const active = Boolean(search || status);
  const done = (message, next) => { setEditing(null); notify(message); list.reload(); if (next) setOpen(next._id); };

  return (
    <>
      <Panel
        bodyClassName="p-0"
        title="Process orders"
        description="A product made through several steps, in house or at a job worker. Each step starts when the one before is done."
        actions={<Can permission="inventory.adjust"><Button size="sm" onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" aria-hidden="true" />New process order</Button></Can>}
      >
        <div className="border-b p-4">
          <FilterBar
            search={search}
            onSearch={(v) => { setSearch(v); session.set("search", v); }}
            placeholder="Search number, product, step or person…"
            active={active}
            onClear={() => { setSearch(""); setStatus(""); session.set("search", ""); session.set("status", ""); }}
          >
            <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); session.set("status", v); }} allLabel="All" options={Object.entries(ORDER_STATUS).map(([v, s]) => [v, s.label])} />
          </FilterBar>
        </div>
        {list.loading && !list.data && <Spinner label="Loading process orders" />}
        {list.error && <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>}
        {list.data?.length === 0 && (
          <EmptyState title="No process orders" text={active ? "Nothing matches those filters." : "Plan a product through its steps: who does each one, and by when. Release it and it appears on the board."} />
        )}
        {list.data?.length > 0 && (
          <DataTable
            caption="Process orders"
            rows={list.data}
            rowKey={(r) => r._id}
            onRowClick={(r) => setOpen(r._id)}
            columns={[
              { key: "no", header: "Order no.", card: "primary", className: "whitespace-nowrap", cell: (r) => <span className="font-mono text-xs font-semibold">{r.processNo || "Draft"}</span> },
              { key: "item", header: "Product", card: "title", cell: (r) => <><span className="font-medium">{r.finished.itemName}</span><span className="ms-1 text-xs text-muted-foreground">x {qty(r.finished.qty)}</span></> },
              { key: "step", header: "At step", cell: (r) => (r.current ? `${r.current.seq}. ${r.current.name}` : r.readyToFinish ? "Ready to finish" : "–") },
              { key: "due", header: "Due", card: "meta", className: "hidden whitespace-nowrap lg:table-cell", headerClassName: "hidden lg:table-cell", cell: (r) => (r.dueDate ? formatDate(r.dueDate) : "–") },
              { key: "status", header: "Status", card: "badge", cell: (r) => <OrderPill status={r.status} /> },
              { key: "view", header: <span className="sr-only">Action</span>, align: "end", card: "actions", cell: (r) => <Button size="sm" variant="outline" aria-label={`View ${r.processNo || r.finished.itemName}`} onClick={(e) => { e.stopPropagation(); setOpen(r._id); }}>View</Button> },
            ]}
          />
        )}
      </Panel>
      {editing && <ProcessOrderForm order={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={done} />}
      {open && (
        <ProcessOrderView
          id={open}
          onClose={() => setOpen(null)}
          onEdit={(o) => { setOpen(null); setEditing(o); }}
          onChanged={(m) => { notify(m); list.reload(); }}
          onRemoved={(m) => { setOpen(null); notify(m); list.reload(); }}
        />
      )}
      {toastNode}
    </>
  );
}

// ------------------------------------------------------------------ the form

export function ProcessOrderForm({ order, onClose, onSaved }) {
  const masters = useMasters();
  const people = useAsync(() => processOrders.assignees(), []);
  const vendors = useAsync(() => api.get("/vendors/vendors"), []);
  const [form, setForm] = useState(() => (order ? processToForm(order) : emptyProcess(todayInput())));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const savedId = useRef(order?._id || null);
  const last = useAsync(() => (form.finishedId ? processOrders.lastSteps(form.finishedId) : Promise.resolve([])), [form.finishedId]);

  const personOptions = useMemo(() => (people.data || []).map((p) => ({ value: p.id, label: p.name })), [people.data]);
  const vendorOptions = useMemo(() => (vendors.data || []).map((v) => ({ value: v._id, label: v.vendorName, hint: v.vendorId })), [vendors.data]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (key, i, patch) => setForm((f) => ({ ...f, [key]: f[key].map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const dropLine = (key, i) => setForm((f) => ({ ...f, [key]: f[key].filter((_, j) => j !== i) }));
  const moveStep = (i, by) => setForm((f) => {
    const steps = [...f.steps];
    const j = i + by;
    if (j < 0 || j >= steps.length) return f;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    return { ...f, steps };
  });
  const lastSteps = last.data || [];
  const blankSteps = form.steps.every((s) => !s.name.trim());

  async function save(andRelease) {
    const e = validateProcess(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setFailure(null);
    setBusy(true);
    try {
      const body = processBody(form);
      const saved = savedId.current ? await processOrders.update(savedId.current, body) : await processOrders.create(body);
      savedId.current = saved._id;
      if (!andRelease) return onSaved(`Saved as a draft: ${saved.finished.itemName} x ${qty(saved.finished.qty)}. Release it to start the first step.`, saved);
      const released = await processOrders.release(saved._id);
      onSaved(`${released.processNo} released: ${released.current?.name || "the first step"} can start.`, released);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={order ? "Edit process order" : "New process order"}
      description="The product, what it is made from, and the steps it goes through in order. Nothing moves in stock until the order is finished."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={busy} data-shortcut="save">Save as draft</Button>
          <Button onClick={() => save(true)} disabled={busy}>{busy ? "Working…" : "Save and release"}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(false); }} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-5">
        {failure && <ErrorNote error={new Error(processErrorText(failure))} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Product to make" required error={errors.finishedId} className="sm:col-span-2">
            <SearchSelect value={form.finishedId} onChange={(v) => set({ finishedId: v })} options={masters.itemOptions} loading={masters.loading} placeholder="Choose the product" aria-label="Product to make" autoFocus noOptionsText="No stock items yet. Add the product under Inventory > Stock Items first." />
          </Field>
          <Field label="Quantity" required error={errors.qty}>
            <TextInput type="number" min="0" step="any" inputMode="decimal" value={form.qty} onChange={(e) => set({ qty: e.target.value })} aria-label="Quantity" />
          </Field>
          <Field label="Due by" hint="When the whole order should be done.">
            <DateInput value={form.dueDate} onChange={(v) => set({ dueDate: v })} aria-label="Due by" />
          </Field>
        </div>

        <section aria-labelledby="pro-materials">
          <h3 id="pro-materials" className="mb-1 text-sm font-semibold">Made from</h3>
          <p className="mb-3 text-xs text-muted-foreground">Taken out of stock when the order is finished. The first material is what goes out to a job worker.</p>
          <div className="grid gap-3">
            {form.materials.map((m, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-start">
                <Field label="Material" labelClassName="sm:sr-only" error={errors[`materials.${i}.stockId`]} className="col-span-2 sm:col-span-1">
                  <SearchSelect value={m.stockId} onChange={(v) => setLine("materials", i, { stockId: v })} options={masters.itemOptions.filter((o) => String(o.value) !== form.finishedId)} loading={masters.loading} placeholder="Choose a material" aria-label={`Material ${i + 1}`} noOptionsText="Add the raw material under Inventory > Stock Items (a different item from the product)." />
                </Field>
                <Field label="Quantity" labelClassName="sm:sr-only" error={errors[`materials.${i}.qty`]}>
                  <TextInput type="number" min="0" step="any" inputMode="decimal" value={m.qty} onChange={(e) => setLine("materials", i, { qty: e.target.value })} aria-label={`Material ${i + 1} quantity`} placeholder="Qty" />
                </Field>
                <Button type="button" variant="ghost" size="icon" className="self-end sm:self-center" onClick={() => dropLine("materials", i)} aria-label={`Remove material ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => set({ materials: [...form.materials, { stockId: "", qty: "" }] })}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add material</Button>
        </section>

        <section aria-labelledby="pro-steps">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 id="pro-steps" className="text-sm font-semibold">Steps, in order</h3>
            {lastSteps.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => set({ steps: stepsFromLast(lastSteps) })} disabled={!blankSteps && !order}>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />Copy steps from the last order
              </Button>
            )}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Each step is done in house by a person you name, or sent out to a job worker on a challan. A step starts when the one before it is done.</p>
          {errors.steps && <p className="mb-2 text-sm text-destructive">{errors.steps}</p>}
          <datalist id="process-step-suggestions">{STEP_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
          <ol className="grid gap-3">
            {form.steps.map((s, i) => (
              <li key={i} className="grid gap-2 rounded-lg border p-3" aria-label={`Step ${i + 1}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
                  <span className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(i, 1)} disabled={i === form.steps.length - 1} aria-label={`Move step ${i + 1} down`}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => dropLine("steps", i)} aria-label={`Remove step ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Step" error={errors[`steps.${i}.name`]}>
                    <TextInput value={s.name} maxLength={80} list="process-step-suggestions" onChange={(e) => setLine("steps", i, { name: e.target.value })} aria-label={`Step ${i + 1} name`} placeholder="e.g. Bending" />
                  </Field>
                  <Field label="Done by">
                    <Select value={s.mode} onChange={(e) => setLine("steps", i, { mode: e.target.value })} aria-label={`Step ${i + 1} done by`}>
                      <option value="in_house">In house</option>
                      <option value="job_work">Job worker (outside)</option>
                    </Select>
                  </Field>
                  {s.mode === "job_work" ? (
                    <Field label="Job worker" error={errors[`steps.${i}.jobWorkerId`]}>
                      <SearchSelect value={s.jobWorkerId} onChange={(v) => setLine("steps", i, { jobWorkerId: v })} options={vendorOptions} loading={vendors.loading} placeholder="Choose the job worker" aria-label={`Step ${i + 1} job worker`} noOptionsText="No vendors. Add the job worker under Purchase > Vendors first." />
                    </Field>
                  ) : (
                    <Field label="Person" hint="Optional. They see it under My work.">
                      <SearchSelect value={s.assigneeId} onChange={(v) => setLine("steps", i, { assigneeId: v })} options={personOptions} loading={people.loading} placeholder="Anyone" aria-label={`Step ${i + 1} person`} noOptionsText="No people found." />
                    </Field>
                  )}
                  <Field label="Due">
                    <DateInput value={s.dueDate} onChange={(v) => setLine("steps", i, { dueDate: v })} aria-label={`Step ${i + 1} due`} />
                  </Field>
                </div>
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => set({ steps: [...form.steps, emptyStep()] })}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add step</Button>
        </section>

        <Field label="Notes">
          <Textarea value={form.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ one order

export function ProcessOrderView({ id, onClose, onEdit, onChanged, onRemoved }) {
  const one = useAsync(() => processOrders.get(id), [id]);
  const { can, me } = useOrganisation();
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "delete" | "cancel" | "reopen" | "release"
  const [completing, setCompleting] = useState(null);
  const [sending, setSending] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const o = one.data;
  const manages = can("inventory.adjust");
  const mayWork = (s) => manages || (s.assigneeId && String(s.assigneeId) === String(me?.id));

  async function run(fn, message, { removed = false } = {}) {
    setBusy(true);
    setFailure(null);
    try {
      const r = await fn();
      setConfirm(null);
      if (removed) return onRemoved(message(r));
      onChanged(message(r));
      await one.reload();
    } catch (err) {
      setFailure(err);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }
  const changed = async (m) => { setCompleting(null); setSending(null); setFinishing(false); onChanged(m); await one.reload(); };

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={o ? `Process order ${o.processNo || "(draft)"}` : "Process order"}
      description={o ? `${o.finished.itemName} x ${qty(o.finished.qty)}${o.dueDate ? ` · due ${formatDate(o.dueDate)}` : ""}` : undefined}
      footer={
        o && (
          <div className="flex flex-wrap justify-end gap-2">
            <Can permission="inventory.adjust">
              {o.actions?.delete && <Button variant="outline" onClick={() => setConfirm("delete")}>Delete</Button>}
              {o.actions?.edit && <Button variant="outline" onClick={() => onEdit(o)}>Edit</Button>}
              {o.actions?.cancel && <Button variant="outline" onClick={() => setConfirm("cancel")}>Cancel order</Button>}
              {o.actions?.reopen && <Button variant="outline" onClick={() => setConfirm("reopen")}>Reopen</Button>}
              {o.actions?.release && <Button onClick={() => setConfirm("release")} disabled={busy}>Release</Button>}
              {o.actions?.finish && <Button onClick={() => setFinishing(true)}>Finish</Button>}
            </Can>
          </div>
        )
      }
    >
      {one.loading && !o && <Spinner label="Loading the process order" />}
      {one.error && <ErrorNote error={one.error} onRetry={one.reload} />}
      {failure && <div className="mb-4"><ErrorNote error={new Error(processErrorText(failure))} /></div>}
      {o && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <OrderPill status={o.status} />
            {o.status === "DRAFT" && <span className="text-xs text-muted-foreground">Not started. Release it to start the first step.</span>}
            {o.readyToFinish && <span className="text-xs text-muted-foreground">Every step is done: {qty(o.finishedQty)} good. Finish to put them into stock.</span>}
            {o.status === "COMPLETED" && <span className="text-xs text-muted-foreground">Finished {formatDate(o.completedAt)}{o.productionNo ? ` · posted as ${o.productionNo}` : ""}.</span>}
          </div>
          <section aria-labelledby="pro-view-materials">
            <h3 id="pro-view-materials" className="mb-2 text-sm font-semibold">Made from</h3>
            {o.materials.length === 0 ? <p className="text-sm text-muted-foreground">No materials.</p> : (
              <ul className="divide-y rounded-lg border text-sm">
                {o.materials.map((m) => <li key={String(m._id || m.stockId)} className="flex justify-between gap-3 px-3 py-2"><span className="min-w-0 truncate">{m.itemName}</span><span className="shrink-0 tabular-nums">{qty(m.qty)}</span></li>)}
              </ul>
            )}
          </section>
          <section aria-labelledby="pro-view-steps">
            <h3 id="pro-view-steps" className="mb-2 text-sm font-semibold">Steps</h3>
            <ol className="grid gap-2">
              {o.steps.map((s) => {
                const label = stepLabel(s);
                return (
                  <li key={String(s._id)} className="rounded-lg border p-3 text-sm" aria-label={`Step ${s.seq}: ${s.name}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="font-medium">{s.seq}. {s.name}</span>
                        <span className="ms-2 text-xs text-muted-foreground">{stepWho(s)}{s.dueDate ? ` · due ${formatDate(s.dueDate)}` : ""}</span>
                      </span>
                      <span className="flex flex-wrap gap-1">
                        <Pill tone={label.tone}>{label.label}</Pill>
                        {DUE_LABEL[s.dueState] && <Pill tone={DUE_TONE[s.dueState]}>{DUE_LABEL[s.dueState]}</Pill>}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {o.status !== "DRAFT" && `To process ${qty(s.plannedQty)}`}
                      {s.status === "DONE" && ` · ${qty(s.qtyDone)} good${s.qtyRejected ? `, ${qty(s.qtyRejected)} rejected` : ""}`}
                      {s.jobWorkNo && ` · challan ${s.jobWorkNo}`}
                    </div>
                    {s.mode === "job_work" && s.status === "IN_PROGRESS" && <p className="mt-1 text-xs">At the job worker. Receive it back on the Job work tab ({s.jobWorkNo}); the order moves on by itself.</p>}
                    {(s.actions?.start || s.actions?.complete || s.actions?.send) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.actions.start && mayWork(s) && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => processOrders.startStep(o._id, s._id), () => `${s.name} started.`)}>Start</Button>}
                        {s.actions.complete && mayWork(s) && <Button size="sm" onClick={() => setCompleting(s)}>Done</Button>}
                        {s.actions.send && manages && <Button size="sm" onClick={() => setSending(s)}>Send to job worker</Button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
          {o.notes && <p className="text-sm text-muted-foreground">{o.notes}</p>}
        </div>
      )}
      {confirm === "delete" && (
        <ConfirmDialog title="Delete this draft?" text="It has not started, so nothing has moved. It is deleted for good." confirmLabel="Delete" danger busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => processOrders.remove(id), () => "Draft process order deleted.", { removed: true })} />
      )}
      {confirm === "release" && (
        <ConfirmDialog title="Release this order?" text="It gets its number and its first step can start. It cannot be edited afterwards." confirmLabel="Release" busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => processOrders.release(id), (r) => `${r.processNo} released.`)} />
      )}
      {confirm === "cancel" && (
        <ConfirmDialog title={`Cancel ${o?.processNo}?`} text="The order stops where it is. Nothing was posted, so nothing is reversed." confirmLabel="Cancel order" danger busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => processOrders.cancel(id), (r) => `${r.processNo} cancelled.`)} />
      )}
      {confirm === "reopen" && (
        <ConfirmDialog title={`Reopen ${o?.processNo}?`} text="The production it posted is reversed: the product goes back out of stock and the materials come back. The order can then be finished again." confirmLabel="Reopen" danger typeToConfirm="reopen" busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => processOrders.reopen(id), (r) => `${r.processNo} reopened.`)} />
      )}
      {completing && <CompleteStepDialog orderId={o._id} step={completing} onClose={() => setCompleting(null)} onDone={changed} />}
      {sending && <SendStepDialog order={o} step={sending} onClose={() => setSending(null)} onDone={changed} />}
      {finishing && <FinishDialog order={o} onClose={() => setFinishing(false)} onDone={changed} />}
    </Modal>
  );
}

// ------------------------------------------------------------------ step done

export function CompleteStepDialog({ orderId, step, onClose, onDone }) {
  const [good, setGood] = useState(String(step.plannedQty ?? ""));
  const [rejected, setRejected] = useState("");
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const planned = Number(step.plannedQty) || 0;
  const total = (Number(good) || 0) + (Number(rejected) || 0);
  const tooMany = planned > 0 && total > planned + 1e-9;

  async function submit() {
    if (!(Number(good) > 0) || tooMany) return;
    setBusy(true);
    setFailure(null);
    try {
      const r = await processOrders.completeStep(orderId, step._id, { qtyDone: Number(good), qtyRejected: Number(rejected) || 0, notes: notes.trim() || undefined });
      onDone(r.current ? `${step.name} done. ${r.current.name} can start.` : `${step.name} done. The order is ready to finish.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={`${step.name} done`}
      description={planned ? `${qty(planned)} to process. The good ones go on to the next step.` : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !(Number(good) > 0) || tooMany}>{busy ? "Saving…" : "Mark done"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(processErrorText(failure))} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Good" required error={!(Number(good) > 0) ? "Enter how many came out good" : undefined}>
            <TextInput type="number" min="0" step="any" inputMode="decimal" value={good} onChange={(e) => setGood(e.target.value)} aria-label="Good" autoFocus />
          </Field>
          <Field label="Rejected" error={tooMany ? `More than the ${qty(planned)} to process` : undefined}>
            <TextInput type="number" min="0" step="any" inputMode="decimal" value={rejected} onChange={(e) => setRejected(e.target.value)} aria-label="Rejected" />
          </Field>
        </div>
        <Field label="Note"><TextInput value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} aria-label="Note" /></Field>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ send a step out

function SendStepDialog({ order, step, onClose, onDone }) {
  const [date, setDate] = useState(todayInput());
  const [vehicleNo, setVehicleNo] = useState("");
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const main = order.materials[0];
  const out = main ? (Number(main.qty) / Number(order.finished.qty)) * Number(step.plannedQty) : 0;

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await processOrders.sendStep(order._id, step._id, { date, vehicleNo: vehicleNo.trim() || undefined });
      onDone(`Sent to ${step.jobWorkerName} on ${r.jobWork.jobWorkNo}. Print the challan from the Job work tab.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={`Send for ${step.name}`}
      description={`A challan to ${step.jobWorkerName}. The parts stay your stock while they are away; nothing is posted.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(processErrorText(failure))} />}
        {main && <p className="text-sm">Goes out: <span className="font-medium tabular-nums">{qty(out)}</span> {main.itemName}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date sent"><DateInput value={date} max={todayInput()} onChange={setDate} aria-label="Date sent" /></Field>
          <Field label="Vehicle no."><TextInput value={vehicleNo} maxLength={30} onChange={(e) => setVehicleNo(e.target.value)} aria-label="Vehicle no." /></Field>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ finish

function FinishDialog({ order, onClose, onDone }) {
  const masters = useMasters();
  const { canAny } = useOrganisation();
  const [date, setDate] = useState(todayInput());
  const [costs, setCosts] = useState([{ accountId: "", amount: "", narration: "" }]);
  const [failure, setFailure] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [busy, setBusy] = useState(false);
  const setCost = (i, patch) => setCosts((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const filled = costs.filter((c) => c.accountId && Number(c.amount) > 0);
  const costTotal = filled.reduce((s, c) => s + Number(c.amount), 0);
  const bad = costs.some((c) => (c.accountId && !(Number(c.amount) > 0)) || (!c.accountId && Number(c.amount) > 0));

  async function submit(acknowledge) {
    if (bad) return;
    setBusy(true);
    setFailure(null);
    try {
      const r = await processOrders.finish(order._id, {
        date, costs: filled.map((c) => ({ accountId: c.accountId, amount: Number(c.amount), narration: c.narration.trim() || undefined })),
        ...(acknowledge ? { acknowledge } : {}),
      });
      onDone(`${r.processNo} finished: ${r.production.productionNo} posted, ${qty(r.finishedQty)} ${r.finished.itemName} at ${orgCurrency()} ${money(r.production.totals.unitCost)} each.`);
    } catch (err) {
      const list = warningsOf(err);
      if (list.length) setWarnings(list);
      else { setWarnings(null); setFailure(err); }
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={`Finish ${order.processNo}`}
      description={`${qty(order.finishedQty)} ${order.finished.itemName} go into stock at the cost of the materials plus the costs below. One production is posted.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => submit()} disabled={busy || bad}>{busy ? "Posting…" : "Finish and post"}</Button></>}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        {failure && <ErrorNote error={new Error(processErrorText(failure))} />}
        <Field label="Date"><DateInput value={date} max={todayInput()} onChange={setDate} aria-label="Date" /></Field>
        <section aria-labelledby="pro-costs">
          <h3 id="pro-costs" className="mb-1 text-sm font-semibold">Costs moved in</h3>
          <p className="mb-3 text-xs text-muted-foreground">Every step's costs already paid by expense voucher: the job workers' charges, transport to and from them, in-house labour, packing that makes the product saleable. Not delivery to customers, office travel or admin.</p>
          {filled.length > 0 && !canAny("finance.create") && <p className="mb-3 text-xs text-destructive">Your role cannot move expenses into stock (it needs Finance: Add). Finish with no costs, or ask an administrator.</p>}
          <div className="grid gap-3">
            {costs.map((c, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto] sm:items-start">
                <Field label="Expense" labelClassName="sm:sr-only" className="col-span-2 sm:col-span-1">
                  <SearchSelect value={c.accountId} onChange={(v) => setCost(i, { accountId: v })} options={masters.expenseOptions} loading={masters.loading} placeholder="e.g. Bending labour" aria-label={`Cost ${i + 1} expense`} noOptionsText="Add the expense account under Accounts > Chart of accounts." />
                </Field>
                <Field label="Amount" labelClassName="sm:sr-only">
                  <TextInput type="number" min="0" step="0.01" inputMode="decimal" value={c.amount} onChange={(e) => setCost(i, { amount: e.target.value })} aria-label={`Cost ${i + 1} amount`} placeholder={orgCurrency()} />
                </Field>
                <Field label="Note" labelClassName="sm:sr-only" className="order-last col-span-2 sm:order-none sm:col-span-1">
                  <TextInput value={c.narration} maxLength={300} onChange={(e) => setCost(i, { narration: e.target.value })} aria-label={`Cost ${i + 1} note`} placeholder="Note (optional)" />
                </Field>
                <Button type="button" variant="ghost" size="icon" className="self-end sm:self-center" onClick={() => setCosts((cs) => cs.filter((_, j) => j !== i))} aria-label={`Remove cost ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setCosts((cs) => [...cs, { accountId: "", amount: "", narration: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add cost</Button>
          {bad && <p className="mt-2 text-sm text-destructive">Each cost needs both an expense and an amount.</p>}
          {costTotal > 0 && <p className="mt-2 text-sm">Costs moved in: <span className="font-semibold tabular-nums">{orgCurrency()} {money(costTotal)}</span></p>}
        </section>
      </div>
      {warnings && <WarningsDialog warnings={warnings} busy={busy} onClose={() => setWarnings(null)} onConfirm={(codes) => submit(codes)} />}
    </Modal>
  );
}
