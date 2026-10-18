import React, { useMemo, useRef, useState } from "react";
import { PackageCheck, Pencil, Plus, Send, Trash2, Undo2, XCircle } from "lucide-react";
import { Button } from "../../ui/button";
import { api } from "../../../lib/accountingApi";
import { jobWork } from "../../../lib/jobWorkApi";
import { pageSession } from "../../../lib/pageSession";
import {
  JOB_STATUS, emptyJob, emptyJobLine, jobBody, jobErrorText, jobToForm, receiveBody, receiveRows, setReceiveRow, validateJob, validateReceive,
} from "../../../lib/jobWork";
import { warningsOf } from "../../../lib/production";
import { formatDate, formatNumber, todayInput } from "../../../utils/format";
import { orgCountry, orgCurrency } from "../../../utils/orgLocale";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import FilterBar, { FilterSelect } from "../../lists/FilterBar";
import InvoiceScreen from "../../PurchaseOrder/shared/InvoiceScreen";
import { useCompanyProfile } from "../../PurchaseOrder/shared/useCompanyProfile";
import {
  ConfirmDialog, DataTable, DateInput, EmptyState, ErrorNote, Field, Modal, Panel, Pill, SearchSelect, Spinner, Textarea, TextInput, useAsync, useToasts,
} from "../../accounting/kit";
import { useMasters, WarningsDialog } from "../productionShared";
import { buildJobWorkChallan } from "./challan";
import { taxWord } from "../../../lib/taxTerms";

// Inventory > Production > Job work: our parts sent to an outside job worker (a powder coater) on a challan, and received
// back finished. Sending moves no stock (they are still ours); each receipt posts a Production: the parts out at their
// cost, the finished item in at that cost plus the coating and transport moved into it. Rules: lib/jobWork.js.

const session = pageSession("job-work");
const qtyText = (n) => formatNumber(n ?? 0, 3).replace(/\.?0+$/, "");
const money = (n) => formatNumber(n ?? 0, 2);
const StatusPill = ({ job }) => (
  <span className="inline-flex flex-wrap gap-1">
    <Pill tone={JOB_STATUS[job.status]?.tone || "neutral"}>{JOB_STATUS[job.status]?.label || job.status}</Pill>
    {job.overdue && <Pill tone="danger">Overdue</Pill>}
  </span>
);
const useCountry = () => {
  const { status } = useOrganisation();
  return String(status?.organisation?.country || orgCountry() || "AE").toUpperCase();
};

export default function JobWorkTab() {
  const [openId, setOpenId] = useState(() => session.get("open", null));
  const open = (id) => { setOpenId(id); session.set("open", id || undefined); };
  const { notify, toastNode } = useToasts();
  if (openId) return <><JobWorkView id={openId} onBack={() => open(null)} notify={notify} />{toastNode}</>;
  return <><JobWorkList onOpen={open} notify={notify} />{toastNode}</>;
}

// ------------------------------------------------------------------ the list

function JobWorkList({ onOpen, notify }) {
  const country = useCountry();
  const [search, setSearch] = useState(() => session.get("search", ""));
  const [status, setStatus] = useState(() => session.get("status", ""));
  const params = { ...(status && { status }), ...(search.trim() && { search: search.trim() }) };
  const list = useAsync(() => jobWork.list(params), [JSON.stringify(params)]);
  const [editing, setEditing] = useState(null);

  return (
    <>
      <Panel
        bodyClassName="p-0"
        title="Job work"
        description={country === "IN"
          ? "Parts sent to an outside job worker (a coater) on a delivery challan (CGST Act s.143, Rule 55). They stay your stock, and must come back within one year."
          : "Parts sent to an outside job worker (a coater) for processing. They stay your stock until they come back finished."}
        actions={<Can permission="inventory.adjust"><Button size="sm" onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Send to job worker</Button></Can>}
      >
        <div className="border-b p-4">
          <FilterBar
            search={search}
            onSearch={(v) => { setSearch(v); session.set("search", v); }}
            placeholder="Search challan, job worker or item…"
            active={Boolean(search || status)}
            onClear={() => { setSearch(""); setStatus(""); session.set("search", ""); session.set("status", ""); }}
          >
            <FilterSelect
              label="Status" value={status} allLabel="All"
              onChange={(v) => { setStatus(v); session.set("status", v); }}
              options={[["OPEN", "Still with job worker"], ["OVERDUE", "Overdue"], ["DRAFT", "Draft"], ["RECEIVED", "Received"], ["CANCELLED", "Cancelled"]]}
            />
          </FilterBar>
        </div>
        {list.loading && !list.data && <Spinner label="Loading job work" />}
        {list.error && <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>}
        {list.data?.length === 0 && (
          <EmptyState
            title="No job work"
            text={search || status ? "Nothing matches those filters." : "When you send parts out for coating or any other work, record it here: the challan, what is still out, and what came back."}
          />
        )}
        {list.data?.length > 0 && (
          <DataTable
            caption="Job work"
            rows={list.data}
            rowKey={(r) => r._id}
            onRowClick={(r) => onOpen(r._id)}
            columns={[
              { key: "no", header: country === "IN" ? "Challan no." : "Dispatch no.", card: "primary", className: "whitespace-nowrap", cell: (r) => <span className="font-mono text-xs font-semibold">{r.jobWorkNo || "Draft"}</span> },
              { key: "date", header: "Sent", card: "meta", className: "hidden whitespace-nowrap lg:table-cell", headerClassName: "hidden lg:table-cell", cell: (r) => formatDate(r.date) },
              {
                key: "worker", header: "Job worker and items", card: "title",
                cell: (r) => (
                  <span className="block min-w-0 max-w-[14rem] lg:max-w-[22rem]">
                    <span className="block truncate font-medium">{r.jobWorker?.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{(r.lines || []).map((l) => `${qtyText(l.qtySent)} ${l.rawName}`).join(", ")}</span>
                  </span>
                ),
              },
              { key: "out", header: "Still out", align: "end", card: "amount", className: "tabular-nums", cell: (r) => (r.status === "DRAFT" || r.status === "CANCELLED" ? "–" : qtyText(r.atWorker)) },
              { key: "back", header: country === "IN" ? "Return by" : "Expected by", className: "hidden whitespace-nowrap lg:table-cell", headerClassName: "hidden lg:table-cell", cell: (r) => (r.returnBy ? formatDate(r.returnBy) : "–") },
              { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill job={r} /> },
              { key: "view", header: <span className="sr-only">Action</span>, align: "end", card: "actions", cell: (r) => <Button size="sm" variant="outline" aria-label={`View ${r.jobWorkNo || "draft job work"}`} onClick={(e) => { e.stopPropagation(); onOpen(r._id); }}>View</Button> },
            ]}
          />
        )}
      </Panel>
      {editing && (
        <JobWorkForm
          job={editing._id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(message, saved) => { setEditing(null); notify(message); list.reload(); if (saved?._id) onOpen(saved._id); }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ the send form

export function JobWorkForm({ job, onClose, onSaved }) {
  const masters = useMasters();
  const vendors = useAsync(() => api.get("/vendors/vendors"), []);
  const away = useAsync(() => api.get("/job-work/with-job-worker"), []);
  const [form, setForm] = useState(() => (job ? jobToForm(job) : emptyJob(todayInput())));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const savedId = useRef(job?._id || null);

  const vendorOptions = useMemo(() => (vendors.data || []).map((v) => ({ value: v._id, label: v.vendorName, hint: v.vendorId })), [vendors.data]);
  const freeOf = (stockId) => {
    const s = masters.items.find((x) => String(x._id) === String(stockId));
    if (!s) return null;
    return Math.max(0, (Number(s.currentStock) || 0) - (Number(away.data?.[stockId]) || 0));
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  async function save(andSend) {
    const e = validateJob(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setFailure(null);
    setBusy(true);
    try {
      const body = jobBody(form);
      const saved = savedId.current ? await jobWork.update(savedId.current, body) : await jobWork.create(body);
      savedId.current = saved._id;
      if (!andSend) return onSaved("Saved as a draft. Nothing has been sent yet.", saved);
      const sent = await jobWork.send(saved._id);
      onSaved(`${sent.jobWorkNo} sent. Print the challan to go with the parts.`, sent);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={job ? "Edit job work" : "Send to job worker"}
      description="The parts go out on a challan and stay your stock. Nothing is posted until they come back."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={busy} data-shortcut="save">Save as draft</Button>
          <Button onClick={() => save(true)} disabled={busy}>{busy ? "Working…" : "Save and send"}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(false); }} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-5">
        {failure && <ErrorNote error={new Error(jobErrorText(failure))} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Job worker" required error={errors.jobWorkerId} hint="The vendor who does the work, e.g. the powder coater.">
            <SearchSelect value={form.jobWorkerId} onChange={(v) => set({ jobWorkerId: v })} options={vendorOptions} loading={vendors.loading} placeholder="Choose the job worker" aria-label="Job worker" autoFocus noOptionsText="No vendors. Add the coater under Purchase > Vendors first." />
          </Field>
          <Field label="Date sent">
            <DateInput value={form.date} max={todayInput()} onChange={(v) => set({ date: v })} aria-label="Date sent" />
          </Field>
          <Field label="Purpose" hint="Printed on the challan, e.g. Powder coating, black.">
            <TextInput value={form.purpose} maxLength={200} onChange={(e) => set({ purpose: e.target.value })} />
          </Field>
          <Field label="Vehicle no.">
            <TextInput value={form.vehicleNo} maxLength={40} onChange={(e) => set({ vehicleNo: e.target.value })} />
          </Field>
        </div>

        <section aria-labelledby="jw-lines">
          <h3 id="jw-lines" className="mb-1 text-sm font-semibold">What goes out, and what comes back</h3>
          <p className="mb-3 text-xs text-muted-foreground">Send the raw item; it comes back as the finished item (a different stock item, e.g. "Car keychain holder" from "Car keychain holder (raw)").</p>
          <div className="grid gap-3">
            {form.lines.map((l, i) => {
              const free = l.rawStockId ? freeOf(l.rawStockId) : null;
              return (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_6rem_auto] sm:items-start">
                  <Field label="Item sent" error={errors[`lines.${i}.rawStockId`]} hint={free === null ? undefined : `${qtyText(free)} free to send`} className="col-span-2 sm:col-span-1">
                    <SearchSelect value={l.rawStockId} onChange={(v) => setLine(i, { rawStockId: v })} options={masters.itemOptions} loading={masters.loading} placeholder="Raw item" aria-label={`Item sent ${i + 1}`} noOptionsText="No stock items. Add them under Inventory > Stock Items." />
                  </Field>
                  <Field label="Qty sent" error={errors[`lines.${i}.qtySent`]}>
                    <TextInput type="number" min="0" step="any" inputMode="decimal" value={l.qtySent} onChange={(e) => setLine(i, { qtySent: e.target.value })} aria-label={`Quantity sent ${i + 1}`} />
                  </Field>
                  <Field label="Comes back as" error={errors[`lines.${i}.finishedStockId`]} className="order-last col-span-2 sm:order-none sm:col-span-1">
                    <SearchSelect value={l.finishedStockId} onChange={(v) => setLine(i, { finishedStockId: v })} options={masters.itemOptions.filter((o) => String(o.value) !== l.rawStockId)} loading={masters.loading} placeholder="Finished item" aria-label={`Comes back as ${i + 1}`} noOptionsText="Add the finished item under Inventory > Stock Items (a different item from the one sent)." />
                  </Field>
                  <Field label="Per unit" error={errors[`lines.${i}.finishedPerRaw`]} hint="Finished per unit sent" className="order-last sm:order-none">
                    <TextInput type="number" min="0" step="any" inputMode="decimal" value={l.finishedPerRaw} onChange={(e) => setLine(i, { finishedPerRaw: e.target.value })} aria-label={`Finished per unit ${i + 1}`} />
                  </Field>
                  <Button type="button" variant="ghost" size="icon" className="self-end sm:mt-7 sm:self-start" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))} aria-label={`Remove line ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </div>
              );
            })}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyJobLine()] }))}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add item</Button>
          {errors.lines && <p className="mt-2 text-sm text-destructive">{errors.lines}</p>}
        </section>

        <Field label="Notes">
          <Textarea value={form.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ one job: the challan and what came back

export function JobWorkView({ id, onBack, notify }) {
  const country = useCountry();
  const company = useCompanyProfile();
  const currency = orgCurrency();
  const one = useAsync(() => jobWork.get(id), [id]);
  const [dialog, setDialog] = useState(null); // edit | receive | send | cancel | delete | {reverse: receipt}
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const job = one.data;
  const doc = useMemo(() => (job ? buildJobWorkChallan(job, company, { country, currency }) : null), [job, company, country, currency]);

  if (one.loading && !job) return <div className="p-8"><Spinner label="Loading job work" /></div>;
  if (one.error) return <div className="p-6"><ErrorNote error={one.error} onRetry={one.reload} /></div>;
  if (!job) return null;

  const run = async (fn, message, after) => {
    setBusy(true);
    setFailure(null);
    try {
      const r = await fn();
      setDialog(null);
      notify(typeof message === "function" ? message(r) : message);
      if (after) after(r); else await one.reload();
    } catch (err) {
      setFailure(err);
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };
  const A = job.actions || {};
  const tb = "inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-accent lg:h-10";
  const actions = (
    <Can permission="inventory.adjust">
      <div className="flex flex-wrap gap-2">
        {A.edit && <button type="button" className={tb} onClick={() => setDialog("edit")}><Pencil className="h-4 w-4" aria-hidden="true" />Edit</button>}
        {A.delete && <button type="button" className={tb} onClick={() => setDialog("delete")}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</button>}
        {A.send && <button type="button" className="erp-btn-primary" onClick={() => run(() => jobWork.send(job._id), (r) => `${r.jobWorkNo} sent. Print the challan to go with the parts.`)} disabled={busy}><Send className="h-4 w-4" aria-hidden="true" />Send</button>}
        {A.receive && <button type="button" className="erp-btn-primary" onClick={() => setDialog("receive")}><PackageCheck className="h-4 w-4" aria-hidden="true" />Receive back</button>}
        {A.cancel && <button type="button" className={tb} onClick={() => setDialog("cancel")}><XCircle className="h-4 w-4" aria-hidden="true" />Cancel</button>}
      </div>
    </Can>
  );
  const live = (job.receipts || []).filter((r) => !r.reversedAt);
  const banner = (
    <div className="grid gap-3">
      {failure && <ErrorNote error={new Error(jobErrorText(failure))} />}
      {job.overdue && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Past its return-by day ({formatDate(job.returnBy)}). {country === "IN" ? "Under Section 143 the parts still out count as supplied from the day they left: bring them back or account for them." : "Chase the job worker for the parts still out."}
        </p>
      )}
      {job.status !== "DRAFT" && job.status !== "CANCELLED" && (
        <div className="grid gap-2 rounded-lg border p-3 text-sm" aria-label="What came back">
          <div className="font-semibold">What came back</div>
          {(job.progress?.lines || []).map((l) => {
            const line = job.lines.find((x) => String(x._id) === String(l.lineId));
            return (
              <div key={l.lineId} className="flex flex-wrap justify-between gap-2">
                <span className="min-w-0">{line?.rawName} → {line?.finishedName}</span>
                <span className="tabular-nums text-muted-foreground">sent {qtyText(l.qtySent)} · back {qtyText(l.finished)}{l.returned ? ` · returned unprocessed ${qtyText(l.returned)}` : ""} · <span className="font-medium text-foreground">still out {qtyText(l.atWorker)}</span></span>
              </div>
            );
          })}
          {live.length > 0 && (
            <ul className="mt-1 divide-y rounded-md border">
              {live.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>{formatDate(r.date)}{r.workerRef ? ` · their ref ${r.workerRef}` : ""}{r.productions?.length ? ` · ${r.productions.map((p) => p.no).join(", ")}` : " · returned unprocessed"}</span>
                  <Can permission="inventory.adjust">
                    <Button size="sm" variant="outline" onClick={() => setDialog({ reverse: r })}><Undo2 className="h-3.5 w-3.5" aria-hidden="true" />Reverse</Button>
                  </Can>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <InvoiceScreen
        sheet={doc.sheet}
        fileName={doc.fileName}
        copies={doc.copies}
        status={job.status}
        statusLabel={JOB_STATUS[job.status]?.label || job.status}
        onBack={onBack}
        actions={actions}
        banner={banner}
      />
      {dialog === "edit" && <JobWorkForm job={job} onClose={() => setDialog(null)} onSaved={(m) => { setDialog(null); notify(m); one.reload(); }} />}
      {dialog === "receive" && <ReceiveDialog job={job} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); notify(m); one.reload(); }} />}
      {dialog === "delete" && (
        <ConfirmDialog title="Delete this draft?" text="Nothing has been sent, so nothing moves. It is deleted for good." confirmLabel="Delete" danger busy={busy}
          onClose={() => setDialog(null)} onConfirm={() => run(() => jobWork.remove(job._id), "Draft deleted.", () => onBack())} />
      )}
      {dialog === "cancel" && (
        <ConfirmDialog title={`Cancel ${job.jobWorkNo}?`} text="Use this when the parts did not go, or all came back untouched. Nothing was posted, so nothing is undone; the job is closed." confirmLabel="Cancel job work" danger busy={busy}
          onClose={() => setDialog(null)} onConfirm={() => run(() => jobWork.cancel(job._id), `${job.jobWorkNo} cancelled.`)} />
      )}
      {dialog?.reverse && (
        <ConfirmDialog
          title="Reverse this receipt?"
          text={`${dialog.reverse.productions?.length ? `${dialog.reverse.productions.map((p) => p.no).join(", ")} will be reversed: the finished items go back out and the parts count as with the job worker again. ` : ""}Refused if any of what came back has already been sold.`}
          confirmLabel="Reverse" danger busy={busy} typeToConfirm="reverse"
          onClose={() => setDialog(null)} onConfirm={() => run(() => jobWork.reverseReceipt(job._id, dialog.reverse._id), "Receipt reversed.")}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ receive back

export function ReceiveDialog({ job, onClose, onDone }) {
  const masters = useMasters();
  const { canAny } = useOrganisation();
  const [rows, setRows] = useState(() => receiveRows(job));
  const [date, setDate] = useState(todayInput());
  const [workerRef, setWorkerRef] = useState("");
  const [costs, setCosts] = useState([{ accountId: "", amount: "", narration: "" }]);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [busy, setBusy] = useState(false);
  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? setReceiveRow(r, patch) : r)));
  const setCost = (i, patch) => setCosts((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const costTotal = costs.reduce((s, c) => s + (Number(c.amount) > 0 ? Number(c.amount) : 0), 0);
  const hasCosts = costs.some((c) => c.accountId && Number(c.amount) > 0);
  // A challan sent from a process order's step carries no costs: they go in once, when the whole order is finished.
  const forProcess = job.source?.kind === "process";

  async function submit(acknowledge) {
    const e = validateReceive(rows);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const r = await jobWork.receive(job._id, { ...receiveBody({ rows, date, workerRef, costs: forProcess ? [] : costs }), ...(acknowledge ? { acknowledge } : {}) });
      onDone(forProcess
        ? `Received. The step on ${job.source.no} is updated; its costs go in when the order is finished.`
        : r.productions?.length
        ? `Received. ${r.productions.map((p) => p.no).join(", ")} posted: the finished items are in stock at their full cost.`
        : "Recorded: the parts came back unprocessed.");
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
      title={`Receive back on ${job.jobWorkNo}`}
      description={forProcess
        ? `Sent for a step of process order ${job.source.no}. What comes back moves the order on; nothing is posted until the order is finished.`
        : "What came back finished becomes stock at the cost of the parts used plus the costs below (coating, transport)."}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => submit()} disabled={busy}>{busy ? "Saving…" : forProcess ? "Receive" : "Receive and post"}</Button></>}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        {failure && <ErrorNote error={new Error(jobErrorText(failure))} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date received"><DateInput value={date} max={todayInput()} onChange={setDate} aria-label="Date received" /></Field>
          <Field label="Job worker's challan / invoice no."><TextInput value={workerRef} maxLength={60} onChange={(e) => setWorkerRef(e.target.value)} /></Field>
        </div>
        <section aria-labelledby="jw-back">
          <h3 id="jw-back" className="mb-2 text-sm font-semibold">What came back</h3>
          <div className="grid gap-3">
            {rows.map((r, i) => (
              <div key={r.lineId} className="grid gap-2 rounded-lg border p-3">
                <div className="text-sm"><span className="font-medium">{r.finishedName}</span> <span className="text-muted-foreground">from {r.rawName} · {qtyText(r.atWorker)} still out</span></div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field label="Came back finished"><TextInput type="number" min="0" step="any" inputMode="decimal" value={r.finishedQty} onChange={(e) => setRow(i, { finishedQty: e.target.value })} aria-label={`Came back finished ${i + 1}`} /></Field>
                  <Field label="Parts used" hint={`${qtyText(r.ratio)} finished per part`}><TextInput type="number" min="0" step="any" inputMode="decimal" value={r.rawConsumed} onChange={(e) => setRow(i, { rawConsumed: e.target.value })} aria-label={`Parts used ${i + 1}`} /></Field>
                  <Field label="Returned unprocessed"><TextInput type="number" min="0" step="any" inputMode="decimal" value={r.rawReturned} onChange={(e) => setRow(i, { rawReturned: e.target.value })} aria-label={`Returned unprocessed ${i + 1}`} /></Field>
                </div>
                {errors[`rows.${i}`] && <p className="text-sm text-destructive">{errors[`rows.${i}`]}</p>}
              </div>
            ))}
          </div>
          {errors.rows && <p className="mt-2 text-sm text-destructive">{errors.rows}</p>}
        </section>
        {forProcess ? (
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">The job worker's charge and the transport are added when {job.source.no} is finished (Process orders &gt; Finish), together with every other step's costs.</p>
        ) : (
        <section aria-labelledby="jw-costs">
          <h3 id="jw-costs" className="mb-1 text-sm font-semibold">Costs moved in</h3>
          <p className="mb-3 text-xs text-muted-foreground">The coater's charge and the transport, from the expense vouchers that paid them (without {taxWord()}, which you claim back). Leave empty if the bill has not come yet.</p>
          {hasCosts && !canAny("finance.create") && <p className="mb-3 text-xs text-destructive">Your role cannot move expenses into stock (it needs Finance: Add).</p>}
          <div className="grid gap-3">
            {costs.map((c, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-start">
                <Field label="Expense" labelClassName="sm:sr-only" className="col-span-2 sm:col-span-1">
                  <SearchSelect value={c.accountId} onChange={(v) => setCost(i, { accountId: v })} options={masters.expenseOptions} loading={masters.loading} placeholder="e.g. Powder coating charges" aria-label={`Cost ${i + 1} expense`} noOptionsText="Add the expense account under Accounts > Chart of accounts." />
                </Field>
                <Field label="Amount" labelClassName="sm:sr-only">
                  <TextInput type="number" min="0" step="0.01" inputMode="decimal" value={c.amount} onChange={(e) => setCost(i, { amount: e.target.value })} aria-label={`Cost ${i + 1} amount`} placeholder={orgCurrency()} />
                </Field>
                <Button type="button" variant="ghost" size="icon" className="self-end sm:self-center" onClick={() => setCosts((cs) => cs.filter((_, j) => j !== i))} aria-label={`Remove cost ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setCosts((cs) => [...cs, { accountId: "", amount: "", narration: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add cost</Button>
          {costTotal > 0 && <p className="mt-2 text-sm">Costs moved in: <span className="font-semibold tabular-nums">{orgCurrency()} {money(costTotal)}</span></p>}
        </section>
        )}
      </div>
      {warnings && <WarningsDialog warnings={warnings} busy={busy} onClose={() => setWarnings(null)} onConfirm={(codes) => submit(codes)} />}
    </Modal>
  );
}
