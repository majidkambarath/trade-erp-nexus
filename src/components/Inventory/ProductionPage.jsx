import React, { useEffect, useMemo, useRef, useState } from "react";
import { Factory, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { accounting, api } from "../../lib/accountingApi";
import { accountOption } from "../../lib/voucherForms";
import { isService } from "../../lib/itemTypes";
import { pageSession } from "../../lib/pageSession";
import { productions } from "../../lib/productionApi";
import { STATUS, buildBody, emptyCost, emptyForm, emptyMaterial, errorText, formFromProduction, formTotals, validateForm, warningsOf } from "../../lib/production";
import { CURRENCY, formatDate, formatNumber, todayInput } from "../../utils/format";
import Can from "../shell/Can";
import { useOrganisation } from "../shell/OrganisationContext";
import FilterBar, { FilterSelect } from "../lists/FilterBar";
import { PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { VoucherAuditTrail } from "../audit/AuditTrail";
import {
  ConfirmDialog, DataTable, DateInput, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, SearchSelect, Spinner, Textarea, TextInput,
  useAsync, useToasts,
} from "../accounting/kit";

// Inventory > Production: materials used up and expenses already paid (travelling, coating powder, packing ...) moved
// into the cost of the item made. Posting moves the stock and books Dr Inventory / Cr Inventory (materials) /
// Cr "Production costs moved to stock"; each expense account keeps what was spent on it. Rules: lib/production.js.

const session = pageSession("production");
const money = (n) => formatNumber(n ?? 0, 2);
const qtyText = (n) => formatNumber(n ?? 0, 3).replace(/\.?0+$/, "");
const StatusPill = ({ status }) => <Pill tone={STATUS[status]?.tone || "neutral"}>{STATUS[status]?.label || status}</Pill>;

function useMasters() {
  const stocks = useAsync(() => api.get("/stock/stock", { itemType: "goods" }), []);
  const chart = useAsync(() => accounting.postableAccounts(), []);
  return useMemo(() => {
    const items = (stocks.data?.stocks || []).filter((s) => !isService(s));
    return {
      loading: stocks.loading || chart.loading,
      items,
      itemOptions: items.map((s) => ({ value: s._id, label: s.itemName, hint: s.itemId, searchText: `${s.itemId} ${s.sku || ""}` })),
      expenseOptions: (chart.data || []).filter((a) => a.category === "EXPENSE").map(accountOption),
    };
  }, [stocks.data, stocks.loading, chart.data, chart.loading]);
}

export default function ProductionPage() {
  const [tab, setTab] = useState(() => session.get("tab", "list"));
  const choose = (t) => { setTab(t); session.set("tab", t); };
  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Production"
        description="Make an item from materials in stock and the expenses spent on it. The item comes in at what it cost, so its sale shows the true cost of goods; each expense account keeps what was spent on it."
      />
      <Tabs value={tab} onValueChange={choose}>
        <TabsList className="justify-start">
          <TabsTrigger value="list">Productions</TabsTrigger>
          <TabsTrigger value="cost">Product cost</TabsTrigger>
        </TabsList>
        <TabsContent value="list">{tab === "list" && <ProductionList />}</TabsContent>
        <TabsContent value="cost">{tab === "cost" && <CostReport />}</TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------ the list

function ProductionList() {
  const [search, setSearch] = useState(() => session.get("search", ""));
  const [status, setStatus] = useState(() => session.get("status", ""));
  const period = usePeriodFilter({ restore: session.get("period") });
  useEffect(() => session.set("period", { preset: period.preset, from: period.from, to: period.to }), [period.preset, period.from, period.to]);
  const p = period.period;
  const params = { ...(status && { status }), ...(!p.all && p.from && { from: p.from }), ...(!p.all && p.to && { to: p.to }), ...(search.trim() && { search: search.trim() }) };
  const key = JSON.stringify(params);
  const list = useAsync(() => productions.list(params), [key]);
  const { notify, toastNode } = useToasts();
  const [editing, setEditing] = useState(null); // {} for a new one, a production to edit
  const [open, setOpen] = useState(null);

  const remember = (k, v) => session.set(k, v);
  const done = (message, next) => { setEditing(null); notify(message); list.reload(); if (next) setOpen(next._id); };
  const active = Boolean(search || status);

  return (
    <>
      <Panel
        bodyClassName="p-0"
        title="Productions"
        actions={<Can permission="inventory.adjust"><Button size="sm" onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" aria-hidden="true" />New production</Button></Can>}
      >
        <div className="border-b p-4">
          <FilterBar
            search={search}
            onSearch={(v) => { setSearch(v); remember("search", v); }}
            placeholder="Search number or item…"
            active={active}
            onClear={() => { setSearch(""); setStatus(""); remember("search", ""); remember("status", ""); }}
          >
            <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); remember("status", v); }} allLabel="All" options={Object.entries(STATUS).map(([v, s]) => [v, s.label])} />
            <PeriodSelect filter={period} labelled />
          </FilterBar>
        </div>
        {list.loading && !list.data && <Spinner label="Loading productions" />}
        {list.error && <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>}
        {list.data?.length === 0 && (
          <EmptyState
            title="No productions"
            text={active ? "Nothing matches those filters." : "Record a production when you make an item: the materials it used and the expenses spent on it become its cost."}
          />
        )}
        {list.data?.length > 0 && (
          <DataTable
            caption="Productions"
            rows={list.data}
            rowKey={(r) => r._id}
            onRowClick={(r) => setOpen(r._id)}
            columns={[
              { key: "no", header: "Production no.", card: "primary", className: "whitespace-nowrap", cell: (r) => <span className="font-mono text-xs font-semibold">{r.productionNo}</span> },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap", cell: (r) => formatDate(r.date) },
              { key: "item", header: "Item made", card: "title", cell: (r) => <><span className="font-medium">{r.finished.itemName}</span><span className="ms-1 text-xs text-muted-foreground">x {qtyText(r.finished.qty)}</span></> },
              { key: "unit", header: "Unit cost", align: "end", className: "tabular-nums", cell: (r) => (r.status === "DRAFT" ? "–" : money(r.totals?.unitCost)) },
              { key: "total", header: `Total (${CURRENCY})`, align: "end", card: "amount", className: "tabular-nums", cell: (r) => (r.status === "DRAFT" ? "–" : money(r.totals?.total)) },
              { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill status={r.status} /> },
              { key: "view", header: <span className="sr-only">Action</span>, align: "end", card: "actions", cell: (r) => <Button size="sm" variant="outline" aria-label={`View ${r.productionNo}`} onClick={(e) => { e.stopPropagation(); setOpen(r._id); }}>View</Button> },
            ]}
          />
        )}
      </Panel>
      {editing && <ProductionForm production={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={done} />}
      {open && (
        <ProductionView
          id={open}
          onClose={() => setOpen(null)}
          onEdit={(prod) => { setOpen(null); setEditing(prod); }}
          onChanged={(message) => { notify(message); list.reload(); }}
          onRemoved={(message) => { setOpen(null); notify(message); list.reload(); }}
        />
      )}
      {toastNode}
    </>
  );
}

// ------------------------------------------------------------------ the form

export function ProductionForm({ production, onClose, onSaved }) {
  const masters = useMasters();
  const { canAny } = useOrganisation();
  const [form, setForm] = useState(() => (production ? formFromProduction(production) : emptyForm(todayInput())));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState(null); // the warnings a post answered with, to tick
  // the draft this form has saved: a second press (after a refusal or a warning) saves THAT one again, never a second draft
  const savedId = useRef(production?._id || null);

  const totals = useMemo(() => formTotals(form, masters.items), [form, masters.items]);
  const finishedItem = masters.items.find((s) => String(s._id) === form.finishedId);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (list, i, patch) => setForm((f) => ({ ...f, [list]: f[list].map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const addLine = (list, make) => setForm((f) => ({ ...f, [list]: [...f[list], make()] }));
  const dropLine = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, j) => j !== i) }));
  const mayMoveCosts = canAny("finance.create");

  async function save(andPost, acknowledge) {
    const e = validateForm(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setFailure(null);
    setBusy(true);
    try {
      const body = buildBody(form);
      const saved = savedId.current ? await productions.update(savedId.current, body) : await productions.create(body);
      savedId.current = saved._id;
      if (!andPost) return onSaved(`${saved.productionNo} saved as a draft. Nothing has moved yet.`, saved);
      const posted = await productions.post(saved._id, acknowledge ? { acknowledge } : {});
      onSaved(`${posted.productionNo} posted: ${qtyText(posted.finished.qty)} ${posted.finished.itemName} at ${CURRENCY} ${money(posted.totals.unitCost)} each.`, posted);
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
      title={production ? `Edit ${production.productionNo}` : "New production"}
      description="The item made comes in at the cost of the materials it used plus the expenses moved into it."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={busy} data-shortcut="save">Save as draft</Button>
          <Button onClick={() => save(true)} disabled={busy}>{busy ? "Working…" : "Save and post"}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(false); }} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-5">
        {failure && <ErrorNote error={new Error(errorText(failure))} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Item made" required error={errors.finishedId} className="sm:col-span-2">
            <SearchSelect value={form.finishedId} onChange={(v) => set({ finishedId: v })} options={masters.itemOptions} loading={masters.loading} placeholder="Choose the finished item" aria-label="Item made" autoFocus />
          </Field>
          <Field label="Quantity made" required error={errors.qty} hint={finishedItem ? `${qtyText(finishedItem.currentStock)} on hand now` : undefined}>
            <TextInput type="number" min="0" step="any" inputMode="decimal" value={form.qty} onChange={(e) => set({ qty: e.target.value })} aria-label="Quantity made" />
          </Field>
          <Field label="Date">
            <DateInput value={form.date} max={todayInput()} onChange={(v) => set({ date: v })} aria-label="Date" />
          </Field>
        </div>

        <section aria-labelledby="prd-materials">
          <h3 id="prd-materials" className="mb-2 text-sm font-semibold">Materials used</h3>
          <p className="mb-3 text-xs text-muted-foreground">Taken out of stock at their average cost.</p>
          <div className="grid gap-3">
            {form.materials.map((m, i) => {
              const line = totals.materialLines.find((l) => l.stockId === m.stockId && m.stockId);
              return (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_auto] sm:items-start sm:border-0 sm:p-0">
                  <Field label="Material" labelClassName="sm:sr-only" error={errors[`materials.${i}.stockId`]} className="col-span-2 sm:col-span-1">
                    <SearchSelect value={m.stockId} onChange={(v) => setLine("materials", i, { stockId: v })} options={masters.itemOptions.filter((o) => String(o.value) !== form.finishedId)} loading={masters.loading} placeholder="Choose a material" aria-label={`Material ${i + 1}`} />
                  </Field>
                  <Field label="Quantity" labelClassName="sm:sr-only" error={errors[`materials.${i}.qty`]}>
                    <TextInput type="number" min="0" step="any" inputMode="decimal" value={m.qty} onChange={(e) => setLine("materials", i, { qty: e.target.value })} aria-label={`Material ${i + 1} quantity`} placeholder="Qty" />
                  </Field>
                  <div className="order-last col-span-2 self-center text-xs text-muted-foreground tabular-nums sm:order-none sm:col-span-1">
                    {line ? (
                      <>
                        <span className="block">{money(line.cost)} at {money(line.rate)}</span>
                        <span className={line.short ? "text-destructive" : undefined}>{qtyText(line.onHand)} on hand{line.short ? `, ${qtyText(line.short)} short` : ""}</span>
                      </>
                    ) : null}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="self-end sm:self-center" onClick={() => dropLine("materials", i)} aria-label={`Remove material ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </div>
              );
            })}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => addLine("materials", emptyMaterial)}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add material</Button>
        </section>

        <section aria-labelledby="prd-costs">
          <h3 id="prd-costs" className="mb-2 text-sm font-semibold">Costs moved in</h3>
          <p className="mb-3 text-xs text-muted-foreground">Expenses already paid (travelling, coating powder, packing…). Each expense account keeps what was spent on it; the amount moved into stock shows as one line, "Production costs moved to stock".</p>
          {!mayMoveCosts && totals.hasCosts && <p className="mb-3 text-xs text-destructive">Your role cannot move expenses into stock (it needs Finance: Add). Ask an administrator, or post with materials only.</p>}
          <div className="grid gap-3">
            {form.costs.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto] sm:items-start sm:border-0 sm:p-0">
                <Field label="Expense" labelClassName="sm:sr-only" error={errors[`costs.${i}.accountId`]} className="col-span-2 sm:col-span-1">
                  <SearchSelect value={c.accountId} onChange={(v) => setLine("costs", i, { accountId: v })} options={masters.expenseOptions} loading={masters.loading} placeholder="Choose the expense" aria-label={`Cost ${i + 1} expense`} />
                </Field>
                <Field label="Amount" labelClassName="sm:sr-only" error={errors[`costs.${i}.amount`]}>
                  <TextInput type="number" min="0" step="0.01" inputMode="decimal" value={c.amount} onChange={(e) => setLine("costs", i, { amount: e.target.value })} aria-label={`Cost ${i + 1} amount`} placeholder={CURRENCY} />
                </Field>
                <Field label="Note" labelClassName="sm:sr-only" className="order-last col-span-2 sm:order-none sm:col-span-1">
                  <TextInput value={c.narration} maxLength={300} onChange={(e) => setLine("costs", i, { narration: e.target.value })} aria-label={`Cost ${i + 1} note`} placeholder="Note (optional)" />
                </Field>
                <Button type="button" variant="ghost" size="icon" className="self-end sm:self-center" onClick={() => dropLine("costs", i)} aria-label={`Remove cost ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => addLine("costs", emptyCost)}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add cost</Button>
          {errors.lines && <p className="mt-2 text-sm text-destructive">{errors.lines}</p>}
        </section>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-4" aria-label="Cost of this production">
          <Figure label="Materials" value={totals.materials} />
          <Figure label="Costs moved in" value={totals.costs} />
          <Figure label="Total cost" value={totals.total} strong />
          <Figure label="Unit cost" value={totals.unitCost} strong testId="prd-unit-cost" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Batch number" hint="Optional. Left empty, the batch is named after the production number.">
            <TextInput value={form.batchNumber} maxLength={60} onChange={(e) => set({ batchNumber: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </form>
      {warnings && (
        <WarningsDialog
          warnings={warnings}
          busy={busy}
          onClose={() => setWarnings(null)}
          onConfirm={(codes) => save(true, codes)}
        />
      )}
    </Modal>
  );
}

function Figure({ label, value, strong, testId }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={strong ? "text-base font-semibold tabular-nums" : "tabular-nums"} data-testid={testId}>{CURRENCY} {money(value)}</div>
    </div>
  );
}

function WarningsDialog({ warnings, busy, onClose, onConfirm }) {
  const [ticked, setTicked] = useState(false);
  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Check before posting"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => onConfirm([...new Set(warnings.map((w) => w.code))])} disabled={!ticked || busy}>{busy ? "Posting…" : "Post anyway"}</Button></>}
    >
      <ul className="mb-4 grid gap-2 text-sm">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-1" />
        <span>I understand, and want to post it as it is.</span>
      </label>
    </Modal>
  );
}

// ------------------------------------------------------------------ one production

export function ProductionView({ id, onClose, onEdit, onChanged, onRemoved }) {
  const one = useAsync(() => productions.get(id), [id]);
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "delete" | "reverse"
  const [warnings, setWarnings] = useState(null);
  const [trail, setTrail] = useState(false);
  const p = one.data;

  async function run(action, fn, message) {
    setBusy(true);
    setFailure(null);
    try {
      const r = await fn();
      setConfirm(null);
      setWarnings(null);
      if (action === "delete") return onRemoved(message(r));
      onChanged(message(r));
      await one.reload();
    } catch (err) {
      const list = warningsOf(err);
      if (list.length) setWarnings(list);
      else { setFailure(err); setConfirm(null); }
    } finally {
      setBusy(false);
    }
  }
  const post = (acknowledge) =>
    run("post", () => productions.post(id, acknowledge ? { acknowledge } : {}), (r) => `${r.productionNo} posted: unit cost ${CURRENCY} ${money(r.totals.unitCost)}.`);

  const preview = p?.status === "DRAFT" ? p.preview : null;
  const totals = preview?.totals || p?.totals;
  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={p ? `Production ${p.productionNo}` : "Production"}
      description={p ? `${formatDate(p.date)} · ${p.finished.itemName} x ${qtyText(p.finished.qty)}` : undefined}
      footer={
        p && (
          <div className="flex flex-wrap justify-end gap-2">
            {p.ledgerPosted && <Button variant="outline" onClick={() => setTrail(true)}>Audit trail</Button>}
            <Can permission="inventory.adjust">
              {p.actions?.delete && <Button variant="outline" onClick={() => setConfirm("delete")}>Delete</Button>}
              {p.actions?.edit && <Button variant="outline" onClick={() => onEdit(p)}>Edit</Button>}
              {p.actions?.reverse && <Button variant="outline" onClick={() => setConfirm("reverse")}>Reverse</Button>}
              {p.actions?.post && <Button onClick={() => post()} disabled={busy}>{busy ? "Posting…" : "Post"}</Button>}
            </Can>
          </div>
        )
      }
    >
      {one.loading && !p && <Spinner label="Loading the production" />}
      {one.error && <ErrorNote error={one.error} onRetry={one.reload} />}
      {failure && <div className="mb-4"><ErrorNote error={new Error(errorText(failure))} /></div>}
      {p && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={p.status} />
            {p.status === "DRAFT" && <span className="text-xs text-muted-foreground">Nothing has moved yet. The figures below are what posting would do today.</span>}
            {p.status === "POSTED" && !p.ledgerPosted && <span className="text-xs text-muted-foreground">Ledger posting was off: the stock moved, the books did not.</span>}
            {p.status === "REVERSED" && <span className="text-xs text-muted-foreground">Reversed {formatDate(p.reversedAt)}{p.reverseReason ? `: ${p.reverseReason}` : ""}.</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-4">
            <Figure label="Materials" value={totals?.materials} />
            <Figure label="Costs moved in" value={totals?.costs} />
            <Figure label="Total cost" value={totals?.total} strong />
            <Figure label="Unit cost" value={totals?.unitCost} strong />
          </div>
          <Lines title="Materials used" empty="No materials." rows={p.materials.map((m) => {
            const pre = preview?.materials?.find((x) => String(x.stockId) === String(m.stockId));
            return { key: m._id || m.stockId, name: `${m.itemName} x ${qtyText(m.qty)}`, hint: m.itemId, amount: m.cost ?? pre?.cost, note: pre?.short ? `${qtyText(pre.short)} short` : null };
          })} />
          <Lines title="Costs moved in" empty="No costs." rows={p.costs.map((c) => ({ key: c._id || c.accountId, name: c.accountName, hint: c.narration, amount: c.amount }))} />
          {p.notes && <p className="text-sm text-muted-foreground">{p.notes}</p>}
        </div>
      )}
      {confirm === "delete" && (
        <ConfirmDialog title={`Delete ${p.productionNo}?`} text="It is a draft, so nothing has moved. It is deleted for good." confirmLabel="Delete" danger busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run("delete", () => productions.remove(id), (r) => `${r.productionNo} deleted.`)} />
      )}
      {confirm === "reverse" && (
        <ConfirmDialog title={`Reverse ${p.productionNo}?`} text="The item made goes back out at the cost it came in at, the materials come back into stock, and the ledger entries are reversed. It cannot be posted again; enter a new production instead." confirmLabel="Reverse" danger busy={busy} typeToConfirm="reverse"
          onClose={() => setConfirm(null)} onConfirm={() => run("reverse", () => productions.reverse(id), (r) => `${r.productionNo} reversed.`)} />
      )}
      {warnings && <WarningsDialog warnings={warnings} busy={busy} onClose={() => setWarnings(null)} onConfirm={(codes) => post(codes)} />}
      {trail && p && <VoucherAuditTrail id={p._id} voucherNo={p.productionNo} onClose={() => setTrail(false)} />}
    </Modal>
  );
}

function Lines({ title, rows, empty }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={String(r.key)} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{r.name}{r.hint && <span className="ms-2 text-xs text-muted-foreground">{r.hint}</span>}{r.note && <span className="ms-2 text-xs text-destructive">{r.note}</span>}</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">{r.amount == null ? "–" : money(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ product cost

function CostReport() {
  const period = usePeriodFilter({ restore: session.get("costPeriod") });
  useEffect(() => session.set("costPeriod", { preset: period.preset, from: period.from, to: period.to }), [period.preset, period.from, period.to]);
  const p = period.period;
  const params = { ...(!p.all && p.from && { from: p.from }), ...(!p.all && p.to && { to: p.to }) };
  const report = useAsync(() => productions.costReport(params), [JSON.stringify(params)]);
  const d = report.data;
  return (
    <Panel
      title="Product cost"
      description="What each item made in the period cost: the materials it used and every expense moved into it, by account."
      actions={<PeriodSelect filter={period} />}
    >
      {report.loading && !d && <Spinner label="Working out product costs" />}
      {report.error && <ErrorNote error={report.error} onRetry={report.reload} />}
      {d?.items?.length === 0 && <EmptyState title="Nothing produced" text="No production was posted in this period." />}
      {d?.items?.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {d.items.map((r) => (
            <article key={r.stockId} className="rounded-lg border p-4" aria-label={r.itemName}>
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold"><Factory className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{r.itemName}<span className="text-xs font-normal text-muted-foreground">{r.itemId}</span></h3>
                <span className="text-sm text-muted-foreground">{qtyText(r.qty)} made in {r.count} production{r.count === 1 ? "" : "s"}</span>
              </header>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                <Lines title="Materials" empty="None." rows={r.materialLines.map((m) => ({ key: m.stockId, name: `${m.itemName} x ${qtyText(m.qty)}`, amount: m.cost }))} />
                <Lines title="Costs moved in" empty="None." rows={r.costLines.map((c) => ({ key: c.accountId, name: c.accountName, hint: c.accountCode, amount: c.amount }))} />
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
                <span>Total <span className="font-semibold tabular-nums">{CURRENCY} {money(r.total)}</span></span>
                <span>Unit cost <span className="font-semibold tabular-nums">{CURRENCY} {money(r.unitCost)}</span></span>
              </div>
            </article>
          ))}
          <p className="text-end text-sm text-muted-foreground">All items: materials {money(d.totals.materials)}, costs moved in {money(d.totals.costs)}, total {CURRENCY} {money(d.totals.total)}</p>
        </div>
      )}
    </Panel>
  );
}
