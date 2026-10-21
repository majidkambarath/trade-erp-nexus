// The pieces every CRM screen uses: the pills that say where something stands, the person picker, the timeline, and
// the five dialogs. Kept in one file because they are small and always travel together, the way
// components/Inventory/productionShared.jsx does for Production.
import React, { useEffect, useMemo, useState } from "react";
import { Phone, Users, Mail, MessageCircle, StickyNote, CheckSquare, MapPin } from "lucide-react";
import { Field, TextInput, Textarea, Select, DateInput, SearchSelect, Modal, inputClass } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import { statusClasses } from "../../lib/status";
import { formatCurrencyAED, formatDate, formatDateTime } from "../../utils/format";
import * as rules from "../../lib/crm";
import { crm, filesFor } from "../../lib/crmApi";
import AttachmentPanel from "../accounting/AttachmentPanel.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";

const TONE_CLASS = {
  danger: "bg-status-danger/10 text-status-danger",
  warning: "bg-status-warning/10 text-status-warning",
  success: "bg-status-success/10 text-status-success",
  info: "bg-status-info/10 text-status-info",
  default: "bg-secondary text-secondary-foreground",
};

export function Tag({ tone = "default", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone] || TONE_CLASS.default} ${className}`}>
      {children}
    </span>
  );
}

/** Where a deal stands, and how likely it is: the two things a person reads first. */
export function StagePill({ deal }) {
  if (!deal?.stageName) return null;
  const tone = deal.status === "WON" ? "success" : deal.status === "LOST" ? "danger" : "info";
  return (
    <Tag tone={tone}>
      {deal.stageName}
      {deal.status === "OPEN" && <span className="opacity-70">{deal.probability}%</span>}
    </Tag>
  );
}

export const StatusPill = ({ status }) => (status ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(status)}`}>{rules.STATUS_LABEL[status] || status}</span> : null);

export const BandPill = ({ band, score }) =>
  band ? (
    <Tag tone={rules.BAND_TONE[band]}>
      {rules.bandLabel(band)}
      {typeof score === "number" && <span className="opacity-70 tabular-nums">{score}</span>}
    </Tag>
  ) : null;

export const DuePill = ({ state }) => (state ? <Tag tone={rules.DUE_TONE[state]}>{rules.DUE_LABEL[state] || state}</Tag> : null);

const KIND_ICON = { call: Phone, visit: MapPin, meeting: Users, whatsapp: MessageCircle, email: Mail, note: StickyNote, task: CheckSquare };

export function KindIcon({ kind, className = "h-4 w-4" }) {
  const Icon = KIND_ICON[kind] || CheckSquare;
  return <Icon className={className} aria-hidden="true" />;
}

/** The people a lead or a deal may be given to. Loaded once per screen that needs it. */
export function useOwners() {
  const [owners, setOwners] = useState([]);
  useEffect(() => {
    let alive = true;
    crm
      .owners()
      .then((rows) => alive && setOwners(Array.isArray(rows) ? rows : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return owners;
}

export function OwnerSelect({ id, value, onChange, owners, placeholder = "Nobody yet", clearable = true }) {
  const options = useMemo(() => owners.map((o) => ({ value: o.id, label: o.name })), [owners]);
  return <SearchSelect id={id} value={value || ""} onChange={onChange} options={options} placeholder={placeholder} clearable={clearable} />;
}

/** What has happened, newest first. The one place a person reads the story of a lead or a deal. */
export function ActivityTimeline({ rows = [], empty = "Nothing yet." }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row._id} className="flex gap-3 py-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
            <KindIcon kind={row.kind} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{row.subject}</p>
              {row.status === "OPEN" ? <DuePill state={row.dueState} /> : <Tag tone={row.status === "DONE" ? "success" : "default"}>{row.status === "DONE" ? rules.outcomeLabel(row.outcome) || "Done" : "Cancelled"}</Tag>}
              {row.auto && <Tag>Automatic</Tag>}
            </div>
            {row.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{row.notes}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {row.status === "DONE" && row.completedAt ? formatDateTime(row.completedAt) : row.dueAt ? `Due ${formatDate(row.dueAt)}` : formatDateTime(row.createdAt)}
              {row.ownerName ? ` · ${row.ownerName}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A dialog that saves something, with the server's own refusal shown where it happened. */
export function CrmDialog({ title, description, confirmLabel, danger = false, busy, problem, size = "sm", onClose, onConfirm, children, disabled = false }) {
  return (
    <Modal
      title={title}
      description={description}
      size={size}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || disabled}
            data-shortcut="save"
            className={`h-11 rounded-lg px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10 ${danger ? "bg-status-danger" : "bg-primary"}`}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </>
      }
    >
      {problem && (
        <Note tone="danger" className="mb-3">
          {problem}
        </Note>
      )}
      {children}
    </Modal>
  );
}

/** Log a call, a visit, a message - or plan one for later. */
export function LogActivityDialog({ regarding, defaultOwnerId, owners, onClose, onSaved, notify }) {
  const [form, setForm] = useState(() => ({ ...rules.emptyActivity(), ownerId: defaultOwnerId || "" }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));

  const save = async () => {
    const found = rules.validateActivity(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      await crm.logActivity({
        kind: form.kind,
        subject: form.subject,
        notes: form.notes,
        dueAt: form.dueAt || undefined,
        ownerId: form.ownerId || undefined,
        regarding,
      });
      notify?.(form.kind === "note" ? "Noted" : "Follow-up saved");
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog title="Log a follow-up" confirmLabel="Save" busy={busy} problem={problem} onClose={onClose} onConfirm={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What" required error={errors.kind}>
          <Select value={form.kind} onChange={set("kind")}>
            {rules.ACTIVITY_KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due" hint={form.kind === "note" ? "A note is recorded as done at once" : "Leave it today to do it now"}>
          <DateInput value={form.dueAt} onChange={set("dueAt")} disabled={form.kind === "note"} />
        </Field>
        <Field label="About" required error={errors.subject} className="sm:col-span-2">
          <TextInput value={form.subject} onChange={set("subject")} placeholder="Ring back about the rice price" />
        </Field>
        <Field label="Who" className="sm:col-span-2">
          <OwnerSelect value={form.ownerId} onChange={(v) => setForm((f) => ({ ...f, ownerId: v }))} owners={owners} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes} onChange={set("notes")} />
        </Field>
      </div>
    </CrmDialog>
  );
}

/**
 * Done - and when is the next one? The next follow-up is offered here and not on a screen of its own, because the
 * person who has just put the phone down is the one who knows, and a deal with nothing owed is how a pipeline rots.
 */
export function DoneDialog({ activity, today, onClose, onSaved, notify }) {
  const [form, setForm] = useState(() => rules.emptyDone(today));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));

  const save = async () => {
    const found = rules.validateDone(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const out = await crm.completeActivity(activity._id, rules.doneBody(form));
      notify?.(out?.next ? `Done. Next one on ${formatDate(out.next.dueAt)}.` : "Done");
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog title={activity.subject} description="What came of it?" confirmLabel="Save" busy={busy} problem={problem} onClose={onClose} onConfirm={save}>
      <div className="grid gap-3">
        <Field label="Outcome" required error={errors.outcome}>
          <Select value={form.outcome} onChange={set("outcome")}>
            {rules.OUTCOMES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="Wants a price for 200 bags" />
        </Field>
        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">The next follow-up</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="When" error={errors.nextDueAt} hint="Leave it empty if nothing more is needed">
              <DateInput value={form.nextDueAt} min={today} onChange={set("nextDueAt")} />
            </Field>
            <Field label="What">
              <Select value={form.nextKind} onChange={set("nextKind")} disabled={!form.nextDueAt}>
                {rules.ACTIVITY_KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="About" className="sm:col-span-2">
              <TextInput value={form.nextSubject} onChange={set("nextSubject")} disabled={!form.nextDueAt} placeholder={activity.subject} />
            </Field>
          </div>
        </fieldset>
      </div>
    </CrmDialog>
  );
}

/** Move a deal by hand. The automation does this from the documents; this is for everything else. */
export function MoveStageDialog({ deal, stages, onClose, onSaved, notify }) {
  const [stageKey, setStageKey] = useState(deal.stageKey);
  const [lostReason, setLostReason] = useState("price");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const chosen = stages.find((s) => s.key === stageKey);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await crm.moveDeal(deal._id, { stageKey, note, lostReason: chosen?.type === "lost" ? lostReason : undefined });
      notify?.(`Moved to ${chosen?.name || "the next stage"}`);
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog title="Move the deal" confirmLabel="Move" busy={busy} problem={problem} onClose={onClose} onConfirm={save} disabled={stageKey === deal.stageKey}>
      <div className="grid gap-3">
        <Field label="Stage" required hint={chosen?.advanceOn ? `This stage also happens by itself when: ${rules.eventLabel(chosen.advanceOn).toLowerCase()}` : undefined}>
          <Select value={stageKey} onChange={(e) => setStageKey(e.target.value)}>
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name} ({s.probability}%)
              </option>
            ))}
          </Select>
        </Field>
        {chosen?.type === "lost" && (
          <Field label="Why" required>
            <Select value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
              {rules.LOST_REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Note">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it moved" />
        </Field>
      </div>
    </CrmDialog>
  );
}

/** Lost: a reason is required, because "lost" with no reason teaches nobody anything. */
export function LoseDialog({ title, onLose, onClose, onSaved, notify }) {
  const [reason, setReason] = useState("price");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await onLose({ reason, note });
      notify?.("Marked as lost");
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog title={title} description="It stays on record, with the reason - that is how the next one is won." confirmLabel="Mark as lost" danger busy={busy} problem={problem} onClose={onClose} onConfirm={save}>
      <div className="grid gap-3">
        <Field label="Why" required>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {rules.LOST_REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Anything else">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </CrmDialog>
  );
}

/**
 * Qualify: this enquiry is real business. It makes a customer (with its ledger account) and a deal, so the dialog says
 * exactly that before anybody presses it.
 */
export function QualifyDialog({ lead, onClose, onSaved, notify }) {
  // Said in the organisation's own terms: a customer has an account in the books where there are books, and is simply a
  // customer where the CRM was bought alone (nobody there can see an account they have no screen for).
  const { can } = useOrganisation();
  const books = can("sales.view") || can("accounts.view");
  const [form, setForm] = useState(() => ({
    customerName: lead.company || lead.name || "",
    creditLimit: "",
    billingAddress: "",
    title: `${lead.company || lead.name} - ${lead.interest || "enquiry"}`.slice(0, 120),
    value: lead.expectedValue || "",
    expectedCloseDate: "",
  }));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const out = await crm.qualifyLead(lead._id, {
        customerName: form.customerName,
        creditLimit: Number(form.creditLimit) || 0,
        billingAddress: form.billingAddress,
        title: form.title,
        value: Number(form.value) || 0,
        expectedCloseDate: form.expectedCloseDate || undefined,
      });
      notify?.(`${out?.opportunity?.opportunityNo || "The deal"} is in the pipeline`);
      onSaved?.(out);
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog
      title={`Qualify ${lead.name}`}
      description={books ? "This makes a real customer, with its own account in the books, and opens a deal in the pipeline." : "This adds the company to your customers and opens a deal in the pipeline."}
      confirmLabel="Qualify"
      busy={busy}
      problem={problem}
      size="md"
      onClose={onClose}
      onConfirm={save}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer name" required className="sm:col-span-2">
          <TextInput value={form.customerName} onChange={set("customerName")} />
        </Field>
        <Field label="Credit limit" hint={`In ${formatCurrencyAED(0).replace(/[\d.,\s]/g, "")}`}>
          <input className={inputClass} type="number" min="0" value={form.creditLimit} onChange={set("creditLimit")} />
        </Field>
        <Field label="Address">
          <TextInput value={form.billingAddress} onChange={set("billingAddress")} />
        </Field>
        <Field label="What the deal is for" required className="sm:col-span-2">
          <TextInput value={form.title} onChange={set("title")} />
        </Field>
        <Field label="What it may be worth">
          <input className={inputClass} type="number" min="0" value={form.value} onChange={set("value")} />
        </Field>
        <Field label="Expected to close">
          <DateInput value={form.expectedCloseDate} onChange={set("expectedCloseDate")} />
        </Field>
      </div>
    </CrmDialog>
  );
}

/** Give it to somebody else, with their open follow-ups going with it. */
export function AssignDialog({ title, owners, current, onAssign, onClose, onSaved, notify }) {
  const [ownerId, setOwnerId] = useState(current || "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await onAssign(ownerId);
      notify?.("Handed over");
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog title={title} description="Whatever is owed on it goes with it." confirmLabel="Hand over" busy={busy} problem={problem} onClose={onClose} onConfirm={save} disabled={!ownerId}>
      <Field label="Who" required>
        <OwnerSelect value={ownerId} onChange={setOwnerId} owners={owners} clearable={false} />
      </Field>
    </CrmDialog>
  );
}

/**
 * The files on a lead or a deal. The panel is the accounting documents' own (type and size checks, drag and drop, the
 * list), pointed at the CRM's door onto files by `source`: that has to be the same object between renders or the list
 * is read again on every one, hence the memo. `kind` is "lead" or "deal".
 */
export function CrmFiles({ kind, id, readOnly = false }) {
  const source = useMemo(() => filesFor(kind, id), [kind, id]);
  return <AttachmentPanel source={source} readOnly={readOnly} label="Files" />;
}
