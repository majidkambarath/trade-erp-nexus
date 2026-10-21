// The pipeline itself, and the automation that runs on it. This screen IS the rule editor: there is no When/If/Then
// builder, because the stages are the rules - what advances a deal into a stage, how soon the next follow-up is due
// once it is there, and how long it may stand still before somebody is told.
//
// What makes it comfortable to use rather than merely correct:
//  - a stage is ONE line (name, chance, what moves a deal there) with its timing a tap away, summarised in words;
//  - a live strip at the top draws the pipeline as it will behave, so an edit shows its effect before it is saved;
//  - stages are dragged into order (keyboard and touch included), and the arrows remain for anyone who prefers them;
//  - the screen knows when something has changed, says so on a bar that stays where Save is, and warns before the tab
//    is closed on unsaved work;
//  - a new stage opens with its name ready to type in, and Save takes you to the first thing that is wrong.
import React, { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, Panel, PageSpinner, ErrorNote, useAsync, useToasts, Field, Select } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import Guarded from "../shell/Guarded.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";
import { motionOK } from "../Dashborad/motion";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { OwnerSelect, useOwners } from "./crmShared.jsx";
import { PipelineFlow, SaveBar, Switch, UnitInput } from "./setupParts.jsx";
import StageList from "./StageList.jsx";
import { useReveal } from "./useReveal.js";

// A row needs an identity that survives renaming, reordering and not yet having a key (a stage that has just been
// added has none). The server never sees it: stagesBody() sends only the stage's own fields.
let rowSeq = 0;
const withUid = (stage) => ({ ...stage, uid: `stage-${(rowSeq += 1)}` });

/** Warn before the tab is closed or reloaded on unsaved work. The browser words the question itself. */
function useLeaveWarning(active) {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

function Stages({ loaded, may, notify, defaultQuietDays }) {
  const root = useRef(null);
  const [saved, setSaved] = useState(null); // what the server has
  const [stages, setStages] = useState(null); // what is on the screen
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const [focusUid, setFocusUid] = useState(null);

  useEffect(() => {
    if (loaded.data) {
      setSaved(loaded.data);
      setStages(loaded.data.map(withUid));
    }
  }, [loaded.data]);
  useReveal(root, Boolean(stages));

  const dirty = Boolean(stages && saved && rules.pipelineDirty(saved, stages));
  useLeaveWarning(dirty);

  // Take the person to a stage: the one just added, or the one they tapped in the strip.
  useEffect(() => {
    if (!focusUid) return;
    const field = document.querySelector(`[data-stage-name="${focusUid}"]`);
    if (field) {
      field.scrollIntoView?.({ block: "center", behavior: motionOK() ? "smooth" : "auto" });
      field.focus({ preventScroll: true });
    }
    setFocusUid(null);
  }, [focusUid, stages]);

  const change = (index, key, value) => setStages((list) => list.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  const reorder = (from, to) => setStages((list) => rules.moveItem(list, from, to));
  const remove = (index) => setStages((list) => list.filter((_, i) => i !== index));
  const toggle = (uid) =>
    setOpen((now) => {
      const next = new Set(now);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const add = () => {
    const row = withUid(rules.stageRow());
    // Before the last stage, which is the one that closes the pipeline - as it always was.
    setStages((list) => (list.length ? [...list.slice(0, -1), row, list[list.length - 1]] : [row]));
    setFocusUid(row.uid);
  };

  const discard = () => {
    setStages(saved.map(withUid));
    setErrors({});
    setProblem(null);
  };

  const save = async () => {
    const found = rules.validateStages(stages || []);
    setErrors(found);
    if (Object.keys(found).length) {
      // Go to the first thing that is wrong, rather than leaving the person to hunt for the red.
      requestAnimationFrame(() => {
        const bad = document.querySelector('[aria-invalid="true"]');
        (bad || root.current)?.scrollIntoView?.({ block: "center", behavior: motionOK() ? "smooth" : "auto" });
        bad?.focus({ preventScroll: true });
      });
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const result = await crm.saveStages(rules.stagesBody(stages));
      setSaved(result);
      // Same rows, same order: keep their identities so an open row stays open instead of being rebuilt.
      setStages((list) => result.map((s, i) => ({ ...s, uid: list[i]?.uid ?? withUid(s).uid })));
      notify?.("The pipeline is saved");
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!stages) return null; // the page holds the one loader and the one error note

  return (
    <div ref={root}>
      <Panel
        title="The pipeline"
        description="A deal moves into a stage when the thing named here happens. Change these and the automation changes with them."
        actions={
          may && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={add} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent lg:h-10">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add a stage
              </button>
              <button type="button" data-shortcut="save" onClick={save} disabled={busy} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
                {busy ? "Saving…" : "Save the pipeline"}
              </button>
            </div>
          )
        }
      >
        {errors.stages && (
          <Note tone="danger" className="mb-3">
            {errors.stages}
          </Note>
        )}
        <div data-reveal className="mb-4">
          <PipelineFlow stages={stages} onPick={setFocusUid} />
        </div>
        <StageList
          stages={stages}
          errors={errors}
          may={may}
          hues={rules.rowHues(stages)}
          defaultQuietDays={defaultQuietDays}
          openUids={open}
          onToggle={toggle}
          onChange={change}
          onReorder={reorder}
          onRemove={remove}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Exactly one stage is the won one and one the lost one, and no two stages may wait for the same thing - otherwise the
          automation would not know where to send a deal. A stage with open deals on it cannot be removed until they are moved.
        </p>
        <SaveBar show={Boolean(may && (dirty || problem))} problem={problem} busy={busy} saveLabel="Save the pipeline" onSave={save} onDiscard={dirty ? discard : undefined} />
      </Panel>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section data-reveal className="grid gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Automation({ loaded, may, notify, onSettled }) {
  const owners = useOwners();
  const root = useRef(null);
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    if (loaded.data) {
      setSaved(loaded.data);
      setForm({ ...loaded.data });
      onSettled?.(loaded.data);
    }
  }, [loaded.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useReveal(root, Boolean(form));

  const dirty = Boolean(form && saved && rules.settingsDirty(saved, form));
  useLeaveWarning(dirty);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));
  const flip = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const discard = () => {
    setForm({ ...saved });
    setErrors({});
    setProblem(null);
  };

  const save = async () => {
    const found = rules.validateSettings(form);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView?.({ block: "center", behavior: motionOK() ? "smooth" : "auto" }));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const result = await crm.saveSettings(rules.settingsBody(form));
      setSaved(result);
      setForm({ ...result });
      onSettled?.(result);
      notify?.("Saved");
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!form) return null; // the page holds the one loader and the one error note

  return (
    <div ref={root}>
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
        <div className="grid gap-6">
          <Group title="What moves by itself">
            <Switch
              checked={form.autoAdvance}
              onChange={flip("autoAdvance")}
              disabled={!may}
              label="Let the documents move the deals"
              description="A quotation sent, the customer accepting it, an invoice approved - each moves the deal to the stage that waits for it. Switch this off and only people move deals."
            />
            <Switch
              checked={form.autoFollowUp}
              onChange={flip("autoFollowUp")}
              disabled={!may}
              label="Always leave a next action"
              description="Entering a stage creates the follow-up that stage asks for, so nothing is ever left with nobody owing anything."
            />
          </Group>

          <Group title="New enquiries">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Give new enquiries to">
                <Select value={form.assignmentMode} onChange={set("assignmentMode")} disabled={!may}>
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
            </div>
          </Group>

          <Group title="What counts as neglected">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Say so when an enquiry is untouched for" hint="Told to the whole team." error={errors.uncontactedHours}>
                <UnitInput unit="hours" min="1" max="720" value={form.uncontactedHours} onChange={set("uncontactedHours")} disabled={!may} />
              </Field>
              <Field label="Call a deal quiet after" hint="Unless its stage says otherwise." error={errors.staleDays}>
                <UnitInput unit="days" min="1" max="365" value={form.staleDays} onChange={set("staleDays")} disabled={!may} />
              </Field>
              <Field label="Warn about a quotation lapsing" hint="Before it expires.">
                <UnitInput unit="days" min="0" max="60" value={form.quotationExpiryDays} onChange={set("quotationExpiryDays")} disabled={!may} />
              </Field>
            </div>
          </Group>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">Everything above is told through the bell, and the ones that belong to one person reach that person only.</p>
        <SaveBar show={Boolean(may && (dirty || problem))} problem={problem} busy={busy} saveLabel="Save" onSave={save} onDiscard={dirty ? discard : undefined} />
      </Panel>
    </div>
  );
}

export default function CrmSetup() {
  const { can } = useOrganisation();
  const { notify, toastNode } = useToasts();
  const may = can("crm.manage");
  // The pipeline's "0 means the usual" hint needs the organisation's usual, which the automation panel owns.
  const [quietDays, setQuietDays] = useState(null);

  // ONE loader for the screen, the app's own (kit's Spinner), not one per panel. The two reads are started
  // here together and the panels are drawn once both have answered: each panel loading on its own left two
  // spinners floating in an empty page, which reads as a screen that is broken rather than one that is busy.
  const pipeline = useAsync(() => crm.stages(), []);
  const settings = useAsync(() => crm.settings(), []);
  const loading = (pipeline.loading && !pipeline.data) || (settings.loading && !settings.data);
  const error = pipeline.error || settings.error;
  const retry = () => {
    if (pipeline.error) pipeline.reload();
    if (settings.error) settings.reload();
  };

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="CRM setup" description="The stages a deal goes through, and what moves it." />
      {loading && <PageSpinner label="Loading the CRM setup" />}
      {!loading && error && (
        <div className="mt-6">
          <ErrorNote error={error} onRetry={retry} />
        </div>
      )}
      {!loading && !error && (
        <div className="mt-6 grid gap-4">
          <Guarded permission="crm.manage" what="the pipeline and the automation">
            <Stages loaded={pipeline} may={may} notify={notify} defaultQuietDays={quietDays} />
          </Guarded>
          <Guarded permission="crm.manage" what="the automation settings">
            <Automation loaded={settings} may={may} notify={notify} onSettled={(s) => setQuietDays(Number(s.staleDays) || null)} />
          </Guarded>
        </div>
      )}
      {toastNode}
    </div>
  );
}
