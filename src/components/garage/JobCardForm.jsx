import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { jobCards, vehicles as vehiclesApi, partyChoices, setup } from "../../lib/garageApi";
import { garageErrorText } from "../../lib/garage";
import { useGarageMasters } from "./garageShared";
import VehicleForm from "./VehicleForm";
import { AmountInput, DateInput, ErrorNote, Field, Modal, QuickAddSelect, SearchSelect, Select, Textarea, TextInput, useAsync } from "../accounting/kit";

async function createCustomer(name) {
  const c = await partyChoices.createCustomer(name);
  return { value: c.id, label: c.name };
}

const FUEL_LEVELS = [["", "–"], ["E", "Empty"], ["1/4", "1/4"], ["1/2", "1/2"], ["3/4", "3/4"], ["F", "Full"]];
const JOB_TYPES = [["retail", "Retail"], ["insurance", "Insurance"], ["warranty", "Warranty"], ["internal", "Internal"], ["fleet", "Fleet"]];
const LINE_KINDS = [["part", "Part"], ["labour", "Labour"], ["sublet", "Sublet"], ["consumable", "Consumable"]];
const STOCKED_KINDS = new Set(["part", "consumable"]);

const emptyComplaint = () => ({ concern: "", cause: "", correction: "" });
const emptyLine = () => ({ kind: "part", itemId: "", qty: "1", price: "", discountPercent: "", vendorId: "" });
const emptyTask = () => ({ name: "", mode: "in_house", stage: "1", standardHours: "", staffId: "", vendorId: "", bayId: "" });

// Opening and editing a job card: a vehicle and a customer, the car as it arrived, the customer's own
// complaints, a first estimate (parts and labour together - the one array utils/garage.js reads to split
// revenue by stream) and the tasks that will work it. Create, and edit while still a DRAFT (the estimate's
// own lifecycle - sending it, approving it, revising it - happens on the card itself, JobCardView.jsx).
export default function JobCardForm({ jobCard, onClose, onSaved }) {
  const editing = Boolean(jobCard?._id);
  const m = useGarageMasters();
  const vehiclesList = useAsync(() => vehiclesApi.list({ limit: 500 }), []);
  const vehicleOptions = (vehiclesList.data || []).map((v) => ({ value: v._id, label: `${v.plateNumber || v.chassisNo} - ${[v.make, v.model].filter(Boolean).join(" ")}`, hint: v.plateNumber ? v.chassisNo : "" }));

  const [form, setForm] = useState({
    vehicleId: jobCard?.vehicleId ? String(jobCard.vehicleId?._id || jobCard.vehicleId) : "",
    customerId: jobCard?.customerId ? String(jobCard.customerId?._id || jobCard.customerId) : "",
    jobType: jobCard?.jobType || "retail",
    promisedAt: jobCard?.promisedAt ? String(jobCard.promisedAt).slice(0, 10) : "",
    odometerIn: jobCard?.odometerIn ? String(jobCard.odometerIn) : "",
    fuelLevelIn: jobCard?.fuelLevelIn || "",
    comebackOf: jobCard?.comebackOf ? String(jobCard.comebackOf?._id || jobCard.comebackOf) : "",
    notes: jobCard?.notes || "",
    complaints: jobCard?.complaints?.length ? jobCard.complaints.map((c) => ({ _id: c._id, concern: c.concern, cause: c.cause || "", correction: c.correction || "" })) : [emptyComplaint()],
    lines: jobCard?.lines?.length
      ? jobCard.lines.map((l) => ({ _id: l._id, kind: l.kind, itemId: String(l.itemId?._id || l.itemId), qty: String(l.qty), price: String(l.price), discountPercent: l.discountPercent ? String(l.discountPercent) : "", vendorId: l.vendorId ? String(l.vendorId?._id || l.vendorId) : "" }))
      : [],
    tasks: jobCard?.tasks?.length
      ? jobCard.tasks.map((t) => ({ _id: t._id, name: t.name, mode: t.mode, stage: String(t.stage || 1), standardHours: t.standardHours ? String(t.standardHours) : "", staffId: t.staffId ? String(t.staffId?._id || t.staffId) : "", vendorId: t.vendorId ? String(t.vendorId?._id || t.vendorId) : "", bayId: t.bayId ? String(t.bayId?._id || t.bayId) : "" }))
      : [],
  });
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [standardJob, setStandardJob] = useState("");
  const [applyingJob, setApplyingJob] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  // A returning vehicle still within an earlier job's warranty: offered, never assumed (utils/garage.js
  // comebackCandidates). Only on a new card - an existing one already carries its own answer.
  const comebacks = useAsync(() => (!editing && form.vehicleId ? jobCards.comebackCandidates(form.vehicleId, form.odometerIn || undefined) : Promise.resolve([])), [editing, form.vehicleId]);

  // A standard job from the service menu (Setup) fills in its usual labour/parts and tasks in one tap, as a
  // starting point - every row stays editable, and nothing here is saved until the whole form is.
  async function applyStandardJob() {
    if (!standardJob) return;
    setApplyingJob(true);
    try {
      const plan = await setup.plan(standardJob);
      setForm((f) => ({
        ...f,
        lines: [...f.lines, ...plan.lines.filter((l) => l.itemId).map((l) => ({ kind: l.kind, itemId: l.itemId, qty: String(l.qty || 1), price: l.price != null ? String(l.price) : "", discountPercent: "", vendorId: "" }))],
        tasks: [...f.tasks, ...plan.tasks.map((t) => ({ name: t.name, mode: t.mode, stage: "1", standardHours: t.standardHours ? String(t.standardHours) : "", staffId: "", vendorId: "", bayId: "" }))],
      }));
    } catch (err) {
      setFailure(err);
    } finally {
      setApplyingJob(false);
    }
  }

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setField = (k) => (e) => set(k)(e?.target ? e.target.value : e);

  const setRow = (list, i, patch) => setForm((f) => ({ ...f, [list]: f[list].map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const addRow = (list, make) => setForm((f) => ({ ...f, [list]: [...f[list], make()] }));
  const removeRow = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, idx) => idx !== i) }));

  const canSave = form.vehicleId && form.customerId && form.complaints.some((c) => c.concern.trim());

  async function submit() {
    if (!canSave) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = {
        vehicleId: form.vehicleId,
        customerId: form.customerId,
        jobType: form.jobType,
        promisedAt: form.promisedAt || undefined,
        odometerIn: form.odometerIn === "" ? undefined : Number(form.odometerIn),
        fuelLevelIn: form.fuelLevelIn || undefined,
        comebackOf: form.comebackOf || undefined,
        notes: form.notes,
        complaints: form.complaints.filter((c) => c.concern.trim()).map((c) => ({ _id: c._id, concern: c.concern, cause: c.cause, correction: c.correction })),
        lines: form.lines
          .filter((l) => l.itemId)
          .map((l) => ({ _id: l._id, kind: l.kind, itemId: l.itemId, qty: Number(l.qty) || 0, price: Number(l.price) || 0, discountPercent: l.discountPercent ? Number(l.discountPercent) : undefined, vendorId: l.kind === "sublet" ? l.vendorId : undefined })),
        tasks: form.tasks
          .filter((t) => t.name.trim())
          .map((t) => ({ _id: t._id, name: t.name, mode: t.mode, stage: Number(t.stage) || 1, standardHours: t.standardHours ? Number(t.standardHours) : undefined, staffId: t.mode === "in_house" ? t.staffId || undefined : undefined, vendorId: t.mode === "sublet" ? t.vendorId || undefined : undefined, bayId: t.bayId || undefined })),
      };
      const c = editing ? await jobCards.update(jobCard._id, body) : await jobCards.create(body);
      onSaved(c, `${c.jobNo || "Job card"} saved.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        size="lg"
        onClose={onClose}
        title={editing ? `Edit ${jobCard.jobNo || "job card"}` : "New job card"}
        description="The vehicle, the customer, and what they reported. Add the estimate here or come back once it is open."
        footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !canSave}>{busy ? "Saving…" : "Save"}</Button></>}
      >
        <div className="grid gap-5">
          {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vehicle" required error={!form.vehicleId ? "Choose the vehicle" : undefined}>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <SearchSelect value={form.vehicleId} onChange={set("vehicleId")} options={vehicleOptions} loading={vehiclesList.loading} placeholder="Plate or chassis…" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setAddingVehicle(true)} aria-label="New vehicle"><Plus className="h-4 w-4" /></Button>
              </div>
            </Field>
            <Field label="Customer" required error={!form.customerId ? "Choose the customer" : undefined}>
              <QuickAddSelect value={form.customerId} onChange={set("customerId")} options={m.customerOptions} onCreate={createCustomer} loading={m.loading} placeholder="Choose or add the customer…" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Job type">
              <Select value={form.jobType} onChange={setField("jobType")}>{JOB_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            <Field label="Promised"><DateInput value={form.promisedAt} onChange={setField("promisedAt")} /></Field>
            <Field label="Odometer in (km)"><AmountInput value={form.odometerIn} onChange={setField("odometerIn")} min="0" /></Field>
            <Field label="Fuel">
              <Select value={form.fuelLevelIn} onChange={setField("fuelLevelIn")}>{FUEL_LEVELS.map(([v, l]) => <option key={v || "none"} value={v}>{l}</option>)}</Select>
            </Field>
          </div>

          {!editing && comebacks.data?.length > 0 && (
            <Field label="Is this a return visit for an earlier repair?" hint="Still within that job's warranty. Only mark it if the same fault is back.">
              <Select value={form.comebackOf} onChange={setField("comebackOf")}>
                <option value="">No - a new, separate job</option>
                {comebacks.data.map((c) => <option key={c.jobCardId} value={c.jobCardId}>{c.jobNo} - {c.work.join(", ") || "earlier work"}</option>)}
              </Select>
            </Field>
          )}

          <section aria-labelledby="jc-complaints">
            <h3 id="jc-complaints" className="mb-2 text-sm font-semibold">What the customer reported</h3>
            <div className="grid gap-2">
              {form.complaints.map((c, i) => (
                <div key={i} className="grid gap-1.5 rounded-lg border p-2">
                  <div className="flex gap-2">
                    <TextInput value={c.concern} onChange={(e) => setRow("complaints", i, { concern: e.target.value })} placeholder="Concern - in their own words…" className="flex-1" />
                    {form.complaints.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => removeRow("complaints", i)} aria-label="Remove"><X className="h-4 w-4" /></Button>}
                  </div>
                  {editing && (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <TextInput value={c.cause} onChange={(e) => setRow("complaints", i, { cause: e.target.value })} placeholder="Cause - what the technician found…" />
                      <TextInput value={c.correction} onChange={(e) => setRow("complaints", i, { correction: e.target.value })} placeholder="Correction - what was done…" />
                    </div>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => addRow("complaints", emptyComplaint)}><Plus className="me-1 h-4 w-4" /> Add complaint</Button>
            </div>
            {editing && <p className="mt-1 text-xs text-muted-foreground">Cause and Correction - the trade's "3 Cs" - can be filled in once diagnosis has found something.</p>}
          </section>

          <section aria-labelledby="jc-lines">
            <h3 id="jc-lines" className="mb-2 text-sm font-semibold">Estimate (optional for now)</h3>
            {m.serviceMenuOptions?.length > 0 && (
              <div className="mb-2 flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field label="Start from a standard job">
                    <SearchSelect value={standardJob} onChange={setStandardJob} options={m.serviceMenuOptions} placeholder="Oil change, brake job…" compact clearable />
                  </Field>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={!standardJob || applyingJob} onClick={applyStandardJob}>{applyingJob ? "Adding…" : "Add its lines"}</Button>
              </div>
            )}
            <div className="grid gap-2">
              {form.lines.map((l, i) => {
                const options = STOCKED_KINDS.has(l.kind) ? m.partOptions : m.serviceOptions;
                return (
                  <div key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_5rem_6rem_2.5rem] items-start gap-2 rounded-lg border p-2">
                    <Select value={l.kind} onChange={(e) => setRow("lines", i, { kind: e.target.value, itemId: "" })}>{LINE_KINDS.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}</Select>
                    <SearchSelect
                      value={l.itemId}
                      onChange={(v) => setRow("lines", i, { itemId: v, price: m.itemsById.get(v)?.salesPrice != null ? String(m.itemsById.get(v).salesPrice) : l.price })}
                      options={options}
                      loading={m.loading}
                      placeholder="Choose the item…"
                      compact
                    />
                    <AmountInput value={l.qty} onChange={(e) => setRow("lines", i, { qty: e.target.value })} min="0" placeholder="Qty" aria-label="Quantity" />
                    <AmountInput value={l.price} onChange={(e) => setRow("lines", i, { price: e.target.value })} min="0" placeholder="Price" aria-label="Price" />
                    <Button type="button" variant="outline" size="sm" onClick={() => removeRow("lines", i)} aria-label="Remove line"><X className="h-4 w-4" /></Button>
                    {l.kind === "sublet" && (
                      <div className="col-span-5">
                        <SearchSelect value={l.vendorId} onChange={(v) => setRow("lines", i, { vendorId: v })} options={m.vendorOptions} placeholder="Who the work goes out to…" compact />
                      </div>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => addRow("lines", emptyLine)}><Plus className="me-1 h-4 w-4" /> Add line</Button>
            </div>
          </section>

          <section aria-labelledby="jc-tasks">
            <h3 id="jc-tasks" className="mb-2 text-sm font-semibold">Tasks (optional for now)</h3>
            <div className="grid gap-2">
              {form.tasks.map((t, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem_4rem_6rem_2.5rem] items-start gap-2 rounded-lg border p-2">
                  <TextInput value={t.name} onChange={(e) => setRow("tasks", i, { name: e.target.value })} placeholder="Replace brake pads…" />
                  <Select value={t.mode} onChange={(e) => setRow("tasks", i, { mode: e.target.value })}>
                    <option value="in_house">In-house</option>
                    <option value="sublet">Sent out</option>
                  </Select>
                  <TextInput type="number" min="1" value={t.stage} onChange={(e) => setRow("tasks", i, { stage: e.target.value })} aria-label="Stage" />
                  <AmountInput value={t.standardHours} onChange={(e) => setRow("tasks", i, { standardHours: e.target.value })} min="0" placeholder="Hours" aria-label="Standard hours" />
                  <Button type="button" variant="outline" size="sm" onClick={() => removeRow("tasks", i)} aria-label="Remove task"><X className="h-4 w-4" /></Button>
                  <div className="col-span-3">
                    {t.mode === "in_house" ? (
                      <SearchSelect value={t.staffId} onChange={(v) => setRow("tasks", i, { staffId: v })} options={m.staffOptions} placeholder="Who does it (optional)…" compact clearable />
                    ) : (
                      <SearchSelect value={t.vendorId} onChange={(v) => setRow("tasks", i, { vendorId: v })} options={m.vendorOptions} placeholder="Who it goes out to…" compact />
                    )}
                  </div>
                  {t.mode === "in_house" && (
                    <div className="col-span-2">
                      <SearchSelect value={t.bayId} onChange={(v) => setRow("tasks", i, { bayId: v })} options={m.bayOptions} placeholder="Bay (optional)…" compact clearable />
                    </div>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => addRow("tasks", emptyTask)}><Plus className="me-1 h-4 w-4" /> Add task</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Tasks sharing the same stage run together; the next stage opens only once every task in this one is done.</p>
          </section>

          <Field label="Notes"><Textarea value={form.notes} onChange={setField("notes")} rows={2} /></Field>
        </div>
      </Modal>
      {addingVehicle && (
        <VehicleForm
          onClose={() => setAddingVehicle(false)}
          onSaved={(v) => { setAddingVehicle(false); vehiclesList.reload(); set("vehicleId")(String(v._id)); }}
        />
      )}
    </>
  );
}
