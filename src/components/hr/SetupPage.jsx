// HRMS > Setup (/hr/setup): the dated-rule engine every compliance figure (and later wave's payroll
// deductions) reads. A rule is a row with an effective date, never a constant - the research behind this
// module found every figure here genuinely contested across sources, so this screen is how a client's own
// accountant corrects one without waiting for a release.
import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { AmountInput, DateInput, ErrorNote, Field, Modal, Pill, Select, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import { PillTabs } from "../salesDocs/parts.jsx";
import Can from "../shell/Can.jsx";
import { statutoryRules, shifts as shiftsApi, holidays as holidaysApi, leaveTypes as leaveTypesApi, salaryComponents, departments as departmentsApi } from "../../lib/hrApi";
import { formatDate } from "../../utils/format";

const COUNTRIES = [{ value: "AE", label: "United Arab Emirates" }, { value: "IN", label: "India" }];

function RuleForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ country: "AE", key: "", value: "", unit: "", effectiveFrom: "", notes: "" });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await statutoryRules.create({ ...form, value: Number(form.value) });
      onSaved(saved, "Rule saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="New statutory rule"
      description="The rule it replaces (if any) is closed the day before this one starts - the history stays correct."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Country">
          <Select value={form.country} onChange={setField("country")}>
            {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Key" hint="e.g. ae.gratuity.capYears">
          <TextInput value={form.key} onChange={setField("key")} />
        </Field>
        <Field label="Value">
          <AmountInput value={form.value} onChange={setField("value")} />
        </Field>
        <Field label="Unit" hint="Optional, for the list only">
          <TextInput value={form.unit} onChange={setField("unit")} placeholder="days, %, AED/month…" />
        </Field>
        <Field label="Starts from" required>
          <DateInput value={form.effectiveFrom} onChange={setField("effectiveFrom")} />
        </Field>
        <Field label="Notes" hint="Why, or the source">
          <TextInput value={form.notes} onChange={setField("notes")} />
        </Field>
      </div>
    </Modal>
  );
}

function StatutoryRulesPanel() {
  const { notify, toastNode } = useToasts();
  const [country, setCountry] = useState("AE");
  const rules = useAsync(() => statutoryRules.list(country), [country]);
  const [adding, setAdding] = useState(false);

  async function remove(id) {
    try {
      await statutoryRules.remove(id);
      notify("Rule removed.");
      rules.reload();
    } catch (err) {
      notify(err.message || "Could not remove that rule.", "error");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every figure here was seeded from the sources with the widest agreement, not a claim that it is
          correct today - confirm each one with your own accountant before relying on it.
        </p>
        <Can permission="hr.manage">
          <Button onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New rule</Button>
        </Can>
      </div>

      <div className="mb-4 flex gap-2">
        {COUNTRIES.map((c) => (
          <Button key={c.value} variant={country === c.value ? "default" : "outline"} size="sm" onClick={() => setCountry(c.value)}>{c.label}</Button>
        ))}
      </div>

      {rules.loading && <Spinner />}
      {rules.error && <ErrorNote error={rules.error} onRetry={rules.reload} />}
      {!rules.loading && !rules.error && (
        <div className="grid gap-2">
          {(rules.data || []).map((r) => (
            <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{r.key}</p>
                <p className="text-xs text-muted-foreground">
                  {r.value}{r.unit ? ` ${r.unit}` : ""} · from {formatDate(r.effectiveFrom)}{r.effectiveTo ? ` to ${formatDate(r.effectiveTo)}` : ""}
                </p>
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                {r.isSystem && <Pill tone="neutral">Our default - confirm it</Pill>}
                <Can permission="hr.manage">
                  <Button variant="ghost" size="sm" onClick={() => remove(r._id)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </Can>
              </div>
            </div>
          ))}
          {(rules.data || []).length === 0 && <p className="text-sm text-muted-foreground">No rules for {country} yet.</p>}
        </div>
      )}

      {adding && (
        <RuleForm
          onClose={() => setAdding(false)}
          onSaved={(_, message) => { setAdding(false); notify(message); rules.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}

// `row` present means edit: the same fields, sent to update instead of create. The create/edit duality
// EmployeeForm already has - a master whose server-side `update` exists should be reachable from the
// screen, or the only way to fix a typo is delete-and-recreate.
function ShiftForm({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: row?.name || "",
    startTime: row?.startTime || "09:00",
    endTime: row?.endTime || "18:00",
    hours: row?.hours ?? "9",
    halfDayBelowHours: row?.halfDayBelowHours ?? "",
  });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const body = { ...form, hours: Number(form.hours), halfDayBelowHours: form.halfDayBelowHours === "" ? "" : Number(form.halfDayBelowHours) };
      const saved = row ? await shiftsApi.update(row._id, body) : await shiftsApi.create(body);
      onSaved(saved, "Shift saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={row ? "Edit shift" : "New shift"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Name"><TextInput value={form.name} onChange={setField("name")} placeholder="Day shift" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm lg:h-10" /></Field>
          <Field label="End"><input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm lg:h-10" /></Field>
        </div>
        <Field label="Shift length (hours)"><AmountInput value={form.hours} onChange={setField("hours")} /></Field>
        <Field label="Half day below (hours)" hint="Optional - a day with fewer worked hours than this is a half day"><AmountInput value={form.halfDayBelowHours} onChange={setField("halfDayBelowHours")} /></Field>
      </div>
    </Modal>
  );
}

function ShiftsPanel() {
  const { notify, toastNode } = useToasts();
  const list = useAsync(() => shiftsApi.list(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  async function remove(id) {
    try { await shiftsApi.remove(id); notify("Shift removed."); list.reload(); }
    catch (err) { notify(err.message || "Could not remove that shift.", "error"); }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Can permission="hr.manage"><Button onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New shift</Button></Can>
      </div>
      {list.loading && <Spinner />}
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && (
        <div className="grid gap-2">
          {(list.data || []).map((s) => (
            <div key={s._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.startTime}–{s.endTime} · {s.hours}h{s.halfDayBelowHours ? ` · half day below ${s.halfDayBelowHours}h` : ""}</p>
              </div>
              <Can permission="hr.manage">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(s)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(s._id)} aria-label={`Remove ${s.name}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </div>
              </Can>
            </div>
          ))}
          {(list.data || []).length === 0 && <p className="text-sm text-muted-foreground">No shifts yet.</p>}
        </div>
      )}
      {adding && <ShiftForm onClose={() => setAdding(false)} onSaved={(_, m) => { setAdding(false); notify(m); list.reload(); }} />}
      {editing && <ShiftForm row={editing} onClose={() => setEditing(null)} onSaved={(_, m) => { setEditing(null); notify(m); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

function HolidayForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ day: "", name: "" });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await holidaysApi.create(form);
      onSaved(saved, "Holiday saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="New holiday"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Day" required><DateInput value={form.day} onChange={setField("day")} /></Field>
        <Field label="Name" required><TextInput value={form.name} onChange={setField("name")} placeholder="National Day" /></Field>
      </div>
    </Modal>
  );
}

function HolidaysPanel() {
  const { notify, toastNode } = useToasts();
  const list = useAsync(() => holidaysApi.list(), []);
  const [adding, setAdding] = useState(false);

  async function remove(id) {
    try { await holidaysApi.remove(id); notify("Holiday removed."); list.reload(); }
    catch (err) { notify(err.message || "Could not remove that holiday.", "error"); }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Can permission="hr.manage"><Button onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New holiday</Button></Can>
      </div>
      {list.loading && <Spinner />}
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && (
        <div className="grid gap-2">
          {(list.data || []).map((h) => (
            <div key={h._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(h.day)}</p>
              </div>
              <Can permission="hr.manage"><Button variant="ghost" size="sm" onClick={() => remove(h._id)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button></Can>
            </div>
          ))}
          {(list.data || []).length === 0 && <p className="text-sm text-muted-foreground">No holidays yet.</p>}
        </div>
      )}
      {adding && <HolidayForm onClose={() => setAdding(false)} onSaved={(_, m) => { setAdding(false); notify(m); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

function LeaveTypeForm({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: row?.name || "",
    accrualPerMonth: row?.accrualPerMonth ?? "1.5",
    maxCarryForward: row?.maxCarryForward ?? "",
    isPaid: row ? row.isPaid !== false : true,
  });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const body = { ...form, accrualPerMonth: Number(form.accrualPerMonth), maxCarryForward: form.maxCarryForward === "" ? "" : Number(form.maxCarryForward) };
      const saved = row ? await leaveTypesApi.update(row._id, body) : await leaveTypesApi.create(body);
      onSaved(saved, "Leave type saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={row ? "Edit leave type" : "New leave type"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Name" required><TextInput value={form.name} onChange={setField("name")} placeholder="Annual" /></Field>
        <Field label="Accrues per month (days)" required><AmountInput value={form.accrualPerMonth} onChange={setField("accrualPerMonth")} /></Field>
        <Field label="Max carried forward" hint="Optional"><AmountInput value={form.maxCarryForward} onChange={setField("maxCarryForward")} /></Field>
      </div>
    </Modal>
  );
}

function LeaveTypesPanel() {
  const { notify, toastNode } = useToasts();
  const list = useAsync(() => leaveTypesApi.list(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  async function remove(id) {
    try { await leaveTypesApi.remove(id); notify("Leave type removed."); list.reload(); }
    catch (err) { notify(err.message || "Could not remove that leave type.", "error"); }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Can permission="hr.manage"><Button onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New leave type</Button></Can>
      </div>
      {list.loading && <Spinner />}
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && (
        <div className="grid gap-2">
          {(list.data || []).map((t) => (
            <div key={t._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.accrualPerMonth} days/month{t.maxCarryForward != null ? ` · up to ${t.maxCarryForward} carried forward` : ""}{t.isPaid === false ? " · unpaid" : ""}</p>
              </div>
              <Can permission="hr.manage">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(t)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(t._id)} aria-label={`Remove ${t.name}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </div>
              </Can>
            </div>
          ))}
          {(list.data || []).length === 0 && <p className="text-sm text-muted-foreground">No leave types yet.</p>}
        </div>
      )}
      {adding && <LeaveTypeForm onClose={() => setAdding(false)} onSaved={(_, m) => { setAdding(false); notify(m); list.reload(); }} />}
      {editing && <LeaveTypeForm row={editing} onClose={() => setEditing(null)} onSaved={(_, m) => { setEditing(null); notify(m); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

const COMPUTATIONS = [["fixed", "A flat amount"], ["percentOfBasic", "% of basic pay"], ["percentOfGross", "% of gross pay"]];

function ComponentForm({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: row?.name || "",
    kind: row?.kind || "deduction",
    computation: row?.computation || "percentOfBasic",
    rate: row?.rate ?? "",
    capBase: row?.capBase ?? "",
    eligibleUpTo: row?.eligibleUpTo ?? "",
  });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const body = {
        ...form, rate: Number(form.rate),
        capBase: form.capBase === "" ? "" : Number(form.capBase),
        eligibleUpTo: form.eligibleUpTo === "" ? "" : Number(form.eligibleUpTo),
      };
      const saved = row ? await salaryComponents.update(row._id, body) : await salaryComponents.create(body);
      onSaved(saved, "Component saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={row ? "Edit salary component" : "New salary component"}
      description="Applied to every employee paid in a run. PF and ESI are the cap/eligibility shape - see the research note in the module's own docs before relying on either figure."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Name" required><TextInput value={form.name} onChange={setField("name")} placeholder="PF, ESI, Overtime…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select value={form.kind} onChange={setField("kind")}>
              <option value="earning">Earning</option>
              <option value="deduction">Deduction</option>
            </Select>
          </Field>
          <Field label="Computed as">
            <Select value={form.computation} onChange={setField("computation")}>
              {COMPUTATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={form.computation === "fixed" ? "Amount" : "Rate %"} required><AmountInput value={form.rate} onChange={setField("rate")} /></Field>
        {form.computation !== "fixed" && (
          <>
            <Field label="Cap the base at" hint="Optional - a PF-shaped wage ceiling before the % applies"><AmountInput value={form.capBase} onChange={setField("capBase")} /></Field>
            <Field label="Does not apply above" hint="Optional - an ESI-shaped eligibility ceiling"><AmountInput value={form.eligibleUpTo} onChange={setField("eligibleUpTo")} /></Field>
          </>
        )}
      </div>
    </Modal>
  );
}

function ComponentsPanel() {
  const { notify, toastNode } = useToasts();
  const list = useAsync(() => salaryComponents.list(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  async function remove(id) {
    try { await salaryComponents.remove(id); notify("Component removed."); list.reload(); }
    catch (err) { notify(err.message || "Could not remove that component.", "error"); }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Can permission="hr.payroll"><Button onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New component</Button></Can>
      </div>
      {list.loading && <Spinner />}
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && (
        <div className="grid gap-2">
          {(list.data || []).map((c) => (
            <div key={c._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{c.name} <span className="text-xs font-normal text-muted-foreground">({c.kind})</span></p>
                <p className="text-xs text-muted-foreground">
                  {c.computation === "fixed" ? c.rate : `${c.rate}% of ${c.computation === "percentOfBasic" ? "basic" : "gross"}`}
                  {c.capBase ? ` · capped at ${c.capBase}` : ""}{c.eligibleUpTo ? ` · not above ${c.eligibleUpTo}` : ""}
                  {c.country ? ` · ${c.country} only` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.isSystem && <Pill tone="neutral">Our default - confirm it</Pill>}
                {c.isActive === false && <Pill tone="warning">Inactive</Pill>}
                <Can permission="hr.payroll">
                  <Button variant="outline" size="sm" onClick={() => setEditing(c)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(c._id)} aria-label={`Remove ${c.name}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </Can>
              </div>
            </div>
          ))}
          {(list.data || []).length === 0 && <p className="text-sm text-muted-foreground">No components yet - payroll pays basic and allowances only.</p>}
        </div>
      )}
      {adding && <ComponentForm onClose={() => setAdding(false)} onSaved={(_, m) => { setAdding(false); notify(m); list.reload(); }} />}
      {editing && <ComponentForm row={editing} onClose={() => setEditing(null)} onSaved={(_, m) => { setEditing(null); notify(m); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

// Renaming matters most here: deleting a department and making a new one orphans every employee already
// assigned to the old one, so without this the only way to fix a typo was destructive.
function DepartmentForm({ row, onClose, onSaved }) {
  const [name, setName] = useState(row?.name || "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const saved = row ? await departmentsApi.update(row._id, { name }) : await departmentsApi.create({ name });
      onSaved(saved, "Department saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={row ? "Rename department" : "New department"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Name" required><TextInput value={name} onChange={(e) => setName(e?.target ? e.target.value : e)} placeholder="Fabrication" /></Field>
      </div>
    </Modal>
  );
}

function DepartmentsPanel() {
  const { notify, toastNode } = useToasts();
  const list = useAsync(() => departmentsApi.list(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  async function remove(id) {
    try { await departmentsApi.remove(id); notify("Department removed."); list.reload(); }
    catch (err) { notify(err.message || "Could not remove that department.", "error"); }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Can permission="hr.manage"><Button onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New department</Button></Can>
      </div>
      {list.loading && <Spinner />}
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && (
        <div className="grid gap-2">
          {(list.data || []).map((d) => (
            <div key={d._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">{d.name}</p>
              <Can permission="hr.manage">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(d)}>Rename</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(d._id)} aria-label={`Remove ${d.name}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </div>
              </Can>
            </div>
          ))}
          {(list.data || []).length === 0 && <p className="text-sm text-muted-foreground">No departments yet - People shows the free-text field until one is added.</p>}
        </div>
      )}
      {adding && <DepartmentForm onClose={() => setAdding(false)} onSaved={(_, m) => { setAdding(false); notify(m); list.reload(); }} />}
      {editing && <DepartmentForm row={editing} onClose={() => setEditing(null)} onSaved={(_, m) => { setEditing(null); notify(m); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

const SETUP_TABS = [["statutory", "Statutory rules"], ["shifts", "Shifts"], ["holidays", "Holidays"], ["leaveTypes", "Leave types"], ["components", "Salary components"], ["departments", "Departments"]];

export default function SetupPage() {
  const [tab, setTab] = useState("statutory");
  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Setup</h1>
      <p className="mb-4 text-sm text-muted-foreground">Statutory figures, shifts, the holiday calendar, leave types and salary components - the configuration the rest of the module reads.</p>
      <PillTabs tabs={SETUP_TABS} value={tab} onChange={setTab} label="HR setup" />
      <div className="mt-4">
        {tab === "statutory" && <StatutoryRulesPanel />}
        {tab === "shifts" && <ShiftsPanel />}
        {tab === "holidays" && <HolidaysPanel />}
        {tab === "leaveTypes" && <LeaveTypesPanel />}
        {tab === "components" && <ComponentsPanel />}
        {tab === "departments" && <DepartmentsPanel />}
      </div>
    </div>
  );
}
