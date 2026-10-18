import React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { STEP_SUGGESTIONS } from "../../../lib/processOrders";
import { DateInput, Field, SearchSelect, Select, TextInput } from "../../accounting/kit";

// What a process order and a saved route share: the materials a product is made from and its steps in order, each in
// house (a person) or at a job worker. An order's step has a due date; a route's step has the days it usually takes.

export function MaterialsEditor({ materials, onChange, errors, itemOptions, loading, finishedId }) {
  const setLine = (i, patch) => onChange(materials.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <>
      <div className="grid gap-3">
        {materials.map((m, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-start">
            <Field label="Material" labelClassName="sm:sr-only" error={errors[`materials.${i}.stockId`]} className="col-span-2 sm:col-span-1">
              <SearchSelect value={m.stockId} onChange={(v) => setLine(i, { stockId: v })} options={itemOptions.filter((o) => String(o.value) !== finishedId)} loading={loading} placeholder="Choose a material" aria-label={`Material ${i + 1}`} noOptionsText="Add the raw material under Inventory > Stock Items (a different item from the product)." />
            </Field>
            <Field label="Quantity" labelClassName="sm:sr-only" error={errors[`materials.${i}.qty`]}>
              <TextInput type="number" min="0" step="any" inputMode="decimal" value={m.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label={`Material ${i + 1} quantity`} placeholder="Qty" />
            </Field>
            <Button type="button" variant="ghost" size="icon" className="self-end sm:self-center" onClick={() => onChange(materials.filter((_, j) => j !== i))} aria-label={`Remove material ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onChange([...materials, { stockId: "", qty: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add material</Button>
    </>
  );
}

// `kind` "order" asks each step's due date, "route" the days it takes.
export function StepsEditor({ steps, onChange, errors, kind = "order", makeStep, vendorOptions, vendorsLoading, personOptions, peopleLoading }) {
  const setLine = (i, patch) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i, by) => {
    const j = i + by;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <>
      {errors.steps && <p className="mb-2 text-sm text-destructive">{errors.steps}</p>}
      <datalist id="process-step-suggestions">{STEP_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      <ol className="grid gap-3">
        {steps.map((s, i) => (
          <li key={i} className="grid gap-2 rounded-lg border p-3" aria-label={`Step ${i + 1}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
              <span className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={`Move step ${i + 1} down`}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Step" error={errors[`steps.${i}.name`]}>
                <TextInput value={s.name} maxLength={80} list="process-step-suggestions" onChange={(e) => setLine(i, { name: e.target.value })} aria-label={`Step ${i + 1} name`} placeholder="e.g. Bending" />
              </Field>
              <Field label="Done by">
                <Select value={s.mode} onChange={(e) => setLine(i, { mode: e.target.value })} aria-label={`Step ${i + 1} done by`}>
                  <option value="in_house">In house</option>
                  <option value="job_work">Job worker (outside)</option>
                </Select>
              </Field>
              {s.mode === "job_work" ? (
                <Field label="Job worker" error={errors[`steps.${i}.jobWorkerId`]}>
                  <SearchSelect value={s.jobWorkerId} onChange={(v) => setLine(i, { jobWorkerId: v })} options={vendorOptions} loading={vendorsLoading} placeholder="Choose the job worker" aria-label={`Step ${i + 1} job worker`} noOptionsText="No vendors. Add the job worker under Purchase > Vendors first." />
                </Field>
              ) : (
                <Field label="Person" hint="Optional. They see it under My work.">
                  <SearchSelect value={s.assigneeId} onChange={(v) => setLine(i, { assigneeId: v })} options={personOptions} loading={peopleLoading} placeholder="Anyone" aria-label={`Step ${i + 1} person`} noOptionsText="No people found." />
                </Field>
              )}
              {kind === "route" ? (
                <Field label="Days it takes" error={errors[`steps.${i}.days`]} hint="0 if done the same day as the step before.">
                  <TextInput type="number" min="0" max="365" step="1" inputMode="numeric" value={s.days} onChange={(e) => setLine(i, { days: e.target.value })} aria-label={`Step ${i + 1} days`} />
                </Field>
              ) : (
                <Field label="Due">
                  <DateInput value={s.dueDate} onChange={(v) => setLine(i, { dueDate: v })} aria-label={`Step ${i + 1} due`} />
                </Field>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onChange([...steps, makeStep()])}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add step</Button>
    </>
  );
}
