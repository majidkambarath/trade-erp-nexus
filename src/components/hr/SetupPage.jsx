// HRMS > Setup (/hr/setup): the dated-rule engine every compliance figure (and later wave's payroll
// deductions) reads. A rule is a row with an effective date, never a constant - the research behind this
// module found every figure here genuinely contested across sources, so this screen is how a client's own
// accountant corrects one without waiting for a release.
import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { AmountInput, DateInput, ErrorNote, Field, Modal, Pill, Select, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import Can from "../shell/Can.jsx";
import { statutoryRules } from "../../lib/hrApi";
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

export default function SetupPage() {
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
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Setup</h1>
          <p className="text-sm text-muted-foreground">
            Every figure here was seeded from the sources with the widest agreement, not a claim that it is
            correct today - confirm each one with your own accountant before relying on it.
          </p>
        </div>
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
