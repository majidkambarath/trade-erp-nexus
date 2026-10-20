// The pipeline itself, and the automation that runs on it. This screen IS the rule editor: there is no When/If/Then
// builder, because the stages are the rules - what advances a deal into a stage, how soon the next follow-up is due
// once it is there, and how long it may stand still before somebody is told.
import React, { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, useAsync, useToasts, Field, TextInput, Select, inputClass } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import Guarded from "../shell/Guarded.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { OwnerSelect, useOwners } from "./crmShared.jsx";

const move = (list, from, to) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
};

function Stages({ may, notify }) {
  const loaded = useAsync(() => crm.stages(), []);
  const [stages, setStages] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    if (loaded.data) setStages(loaded.data.map((s) => ({ ...s })));
  }, [loaded.data]);

  const set = (index, key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setStages((list) => list.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  };

  const save = async () => {
    const found = rules.validateStages(stages || []);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await crm.saveStages(rules.stagesBody(stages));
      setStages(saved.map((s) => ({ ...s })));
      notify?.("The pipeline is saved");
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (loaded.loading && !stages) return <Spinner label="Reading the pipeline" />;
  if (loaded.error) return <ErrorNote error={loaded.error} onRetry={loaded.reload} />;
  if (!stages) return null;

  return (
    <Panel
      title="The pipeline"
      description="A deal moves into a stage when the thing named here happens. Change these and the automation changes with them."
      actions={
        may && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStages((list) => [...list.slice(0, -1), rules.stageRow(), list[list.length - 1]])} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium lg:h-10">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add a stage
            </button>
            <button type="button" data-shortcut="save" onClick={save} disabled={busy} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
              {busy ? "Saving…" : "Save the pipeline"}
            </button>
          </div>
        )
      }
    >
      {problem && (
        <Note tone="danger" className="mb-3">
          {problem}
        </Note>
      )}
      {errors.stages && (
        <Note tone="danger" className="mb-3">
          {errors.stages}
        </Note>
      )}
      <ol className="grid gap-3">
        {stages.map((stage, index) => (
          <li key={stage.key || `new-${index}`} className="rounded-lg border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Name" required error={errors[`${index}.name`]}>
                <TextInput value={stage.name} onChange={set(index, "name")} />
              </Field>
              <Field label="Chance of closing" error={errors[`${index}.probability`]}>
                <input className={inputClass} type="number" min="0" max="100" value={stage.probability} onChange={set(index, "probability")} />
              </Field>
              <Field label="It moves here when" error={errors[`${index}.advanceOn`]} className="xl:col-span-2">
                <Select value={stage.advanceOn || ""} onChange={set(index, "advanceOn")}>
                  {rules.ADVANCE_EVENTS.map(([value, label]) => (
                    <option key={value || "none"} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Next follow-up in" hint="Days">
                <input className={inputClass} type="number" min="0" max="365" value={stage.followUpDays} onChange={set(index, "followUpDays")} />
              </Field>
              <Field label="Call it quiet after" hint="Days with nothing happening">
                <input className={inputClass} type="number" min="0" max="365" value={stage.staleDays} onChange={set(index, "staleDays")} />
              </Field>
              <Field label="Kind">
                <Select value={stage.type} onChange={set(index, "type")}>
                  <option value="open">Open - still being worked on</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </Select>
              </Field>
              {may && (
                <div className="flex flex-wrap items-end gap-2">
                  <button type="button" aria-label={`Move ${stage.name} up`} onClick={() => setStages((l) => move(l, index, index - 1))} className="grid h-11 w-11 place-items-center rounded-lg border border-border lg:h-10 lg:w-10">
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`Move ${stage.name} down`} onClick={() => setStages((l) => move(l, index, index + 1))} className="grid h-11 w-11 place-items-center rounded-lg border border-border lg:h-10 lg:w-10">
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`Remove ${stage.name}`} onClick={() => setStages((l) => l.filter((_, i) => i !== index))} className="grid h-11 w-11 place-items-center rounded-lg border border-border text-status-danger lg:h-10 lg:w-10">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Exactly one stage is the won one and one the lost one, and no two stages may wait for the same thing - otherwise the
        automation would not know where to send a deal. A stage with open deals on it cannot be removed until they are moved.
      </p>
    </Panel>
  );
}

function Automation({ may, notify }) {
  const owners = useOwners();
  const loaded = useAsync(() => crm.settings(), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    if (loaded.data) setForm({ ...loaded.data });
  }, [loaded.data]);

  const set = (key) => (event) => {
    const value = event?.target ? (event.target.type === "checkbox" ? event.target.checked : event.target.value) : event;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    const found = rules.validateSettings(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await crm.saveSettings(rules.settingsBody(form));
      setForm({ ...saved });
      notify?.("Saved");
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (loaded.loading && !form) return <Spinner label="Reading the settings" />;
  if (loaded.error) return <ErrorNote error={loaded.error} onRetry={loaded.reload} />;
  if (!form) return null;

  return (
    <Panel
      title="The automation"
      description="What happens without anybody pressing anything."
      actions={
        may && (
          <button type="button" onClick={save} disabled={busy} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
            {busy ? "Saving…" : "Save"}
          </button>
        )
      }
    >
      {problem && (
        <Note tone="danger" className="mb-3">
          {problem}
        </Note>
      )}
      <div className="grid gap-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={form.autoAdvance} onChange={set("autoAdvance")} className="mt-1 h-5 w-5 rounded border-border" />
          <span>
            <span className="block text-sm font-medium">Let the documents move the deals</span>
            <span className="block text-xs text-muted-foreground">A quotation sent, the customer accepting it, an invoice approved - each moves the deal to the stage that waits for it. Switch this off and only people move deals.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={form.autoFollowUp} onChange={set("autoFollowUp")} className="mt-1 h-5 w-5 rounded border-border" />
          <span>
            <span className="block text-sm font-medium">Always leave a next action</span>
            <span className="block text-xs text-muted-foreground">Entering a stage creates the follow-up that stage asks for, so nothing is ever left with nobody owing anything.</span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Give new enquiries to">
            <Select value={form.assignmentMode} onChange={set("assignmentMode")}>
              {rules.ASSIGNMENT_MODES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {form.assignmentMode === "fixed" && (
            <Field label="That person" required error={errors.fixedOwnerId}>
              <OwnerSelect value={form.fixedOwnerId} onChange={(v) => setForm((f) => ({ ...f, fixedOwnerId: v }))} owners={owners} clearable={false} />
            </Field>
          )}
          <Field label="Say so when an enquiry is untouched for" hint="Hours. Told to the whole team." error={errors.uncontactedHours}>
            <input className={inputClass} type="number" min="1" max="720" value={form.uncontactedHours} onChange={set("uncontactedHours")} />
          </Field>
          <Field label="Call a deal quiet after" hint="Days, unless its stage says otherwise" error={errors.staleDays}>
            <input className={inputClass} type="number" min="1" max="365" value={form.staleDays} onChange={set("staleDays")} />
          </Field>
          <Field label="Warn about a quotation lapsing" hint="Days before it expires">
            <input className={inputClass} type="number" min="0" max="60" value={form.quotationExpiryDays} onChange={set("quotationExpiryDays")} />
          </Field>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Everything above is told through the bell, and the ones that belong to one person reach that person only.</p>
    </Panel>
  );
}

export default function CrmSetup() {
  const { can } = useOrganisation();
  const { notify, toastNode } = useToasts();
  const may = can("crm.manage");

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="CRM setup" description="The stages a deal goes through, and what moves it." />
      <div className="mt-6 grid gap-4">
        <Guarded permission="crm.manage" what="the pipeline and the automation">
          <Stages may={may} notify={notify} />
        </Guarded>
        <Guarded permission="crm.manage" what="the automation settings">
          <Automation may={may} notify={notify} />
        </Guarded>
      </div>
      {toastNode}
    </div>
  );
}
