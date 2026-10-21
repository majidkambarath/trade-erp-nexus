// Booking a meeting, and moving one.
//
// A meeting is a follow-up with a time, the people who will be there, and an invitation that lands in their own
// calendar. The dialog is deliberately the same shape as "Log a follow-up" next door: a person who can do one can do
// the other without learning anything new.
//
// Two honesties the screen owes: it says when the invitation will NOT go out (the organisation has not set its email
// up, so nothing would leave the building), and it warns about an overlap rather than refusing one - the person
// booking knows whether two meetings at once is a mistake.
import React, { useEffect, useMemo, useState } from "react";
import { Field, TextInput, Textarea, Select, DateInput, SearchSelect, inputClass } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import { CrmDialog } from "./crmShared.jsx";
import { crm } from "../../lib/crmApi";
import { sendSettings } from "../../lib/sendDocumentsApi";
import * as rules from "../../lib/meetings";

/** The people who can be invited: the customer's side first, then ours, each said plainly. */
function useInvitees() {
  const [groups, setGroups] = useState({ contacts: [], colleagues: [] });
  useEffect(() => {
    let alive = true;
    Promise.all([crm.contacts({ limit: 300 }).catch(() => []), crm.owners().catch(() => [])]).then(([contacts, owners]) => {
      if (!alive) return;
      setGroups({
        contacts: (contacts || []).map((c) => ({
          value: `contact:${c._id}`,
          label: c.name,
          hint: c.email || c.phone || (c.party?.name ?? ""),
          searchText: `${c.name} ${c.email || ""} ${c.party?.name || ""}`,
          noEmail: !c.email,
        })),
        colleagues: (owners || []).map((o) => ({ value: `user:${o.id}`, label: o.name, hint: "Colleague", searchText: o.name })),
      });
    });
    return () => {
      alive = false;
    };
  }, []);
  return groups;
}

const keyOf = (a) => `${a.kind}:${a.id}`;
const parse = (value) => ({ kind: value.split(":")[0], id: value.split(":").slice(1).join(":") });

export default function MeetingDialog({ regarding, activity = null, today = "", defaultOwnerId = "", onClose, onSaved, notify }) {
  const moving = Boolean(activity);
  const invitees = useInvitees();
  const [form, setForm] = useState(() => (moving ? rules.meetingToForm(activity) : { ...rules.emptyMeeting(today), ownerId: defaultOwnerId }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [clashes, setClashes] = useState([]);
  // Whether an invitation can actually reach anybody. It starts as "yes" so a slow or refused answer never warns
  // wrongly; only a definite "not ready" from the server says so. Read once, when the dialog opens.
  const [emailReady, setEmailReady] = useState(true);
  useEffect(() => {
    let alive = true;
    sendSettings
      .readiness()
      .then((r) => alive && setEmailReady(r?.ready !== false))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));

  const options = useMemo(() => [...invitees.contacts, ...invitees.colleagues], [invitees]);
  const chosen = useMemo(() => (form.attendees || []).map(keyOf), [form.attendees]);
  const noAddress = useMemo(
    () => (form.attendees || []).filter((a) => a.kind === "contact" && invitees.contacts.find((c) => c.value === keyOf(a))?.noEmail),
    [form.attendees, invitees.contacts]
  );

  const add = (value) => {
    if (!value || chosen.includes(value)) return;
    setForm((f) => ({ ...f, attendees: [...(f.attendees || []), parse(value)] }));
    setErrors((e) => ({ ...e, attendees: undefined }));
  };
  const drop = (key) => setForm((f) => ({ ...f, attendees: (f.attendees || []).filter((a) => keyOf(a) !== key) }));
  const nameOf = (key) => options.find((o) => o.value === key)?.label || key.split(":")[1];

  const save = async () => {
    const found = rules.validateMeeting(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const out = moving
        ? await crm.rescheduleMeeting(activity._id, rules.rescheduleBody(form, activity))
        : await crm.scheduleMeeting(rules.meetingBody(form, regarding));
      // A booking that went in but whose invitation did not is still a booking: say which happened, do not pretend.
      const invite = out?.invite;
      const told = invite?.sent ? ", and everybody was told" : invite?.error ? `, but the invitation did not go out: ${invite.error}` : "";
      notify?.(`${moving ? "Meeting moved" : "Meeting arranged"}${told}`, invite && !invite.sent && form.notify !== false ? "error" : undefined);
      onSaved?.(out);
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  // The overlap check asks the server for that day once the day and time are settled; it never blocks the save.
  useEffect(() => {
    if (!form.day || !form.time) return undefined;
    let alive = true;
    crm
      .meetingsOnDay({ day: form.day })
      .then((rows) => {
        if (alive) setClashes(rules.clashesAmong({ time: form.time, minutes: form.minutes, id: activity?._id }, rows));
      })
      .catch(() => setClashes([]));
    return () => {
      alive = false;
    };
  }, [form.day, form.time, form.minutes, activity]);

  return (
    <CrmDialog
      title={moving ? "Move the meeting" : "Arrange a meeting"}
      description={moving ? "Everybody invited is told it has moved." : "It goes in the calendar, and everybody invited is sent an invitation."}
      confirmLabel={moving ? "Move it" : "Arrange it"}
      size="md"
      busy={busy}
      problem={problem}
      onClose={onClose}
      onConfirm={save}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What the meeting is about" required error={errors.subject} className="sm:col-span-2">
          <TextInput value={form.subject} onChange={set("subject")} placeholder="Price review for 200 bags" data-autofocus />
        </Field>

        <Field label="Day" required error={errors.day}>
          <DateInput value={form.day} onChange={set("day")} />
        </Field>
        <Field label="Starts at" required error={errors.time} hint="On your organisation's clock">
          <input className={inputClass} type="time" step="900" value={form.time} onChange={set("time")} />
        </Field>

        <Field label="How long" error={errors.minutes}>
          <Select value={String(form.minutes)} onChange={(e) => setForm((f) => ({ ...f, minutes: Number(e.target.value) }))}>
            {rules.DURATIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Where">
          <Select value={form.where} onChange={set("where")}>
            {rules.WHERE.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        {form.where === "in_person" ? (
          <Field label="The place" className="sm:col-span-2">
            <TextInput value={form.location} onChange={set("location")} placeholder="Our Deira office, meeting room 2" />
          </Field>
        ) : (
          <Field
            label="Joining link"
            error={errors.joinUrl}
            className="sm:col-span-2"
            hint="Your own Meet, Zoom or Teams link. It goes in the invitation, and can be added later."
          >
            <TextInput value={form.joinUrl} onChange={set("joinUrl")} placeholder="https://meet.google.com/abc-defg-hij" inputMode="url" />
          </Field>
        )}

        <Field label="Who is coming" required error={errors.attendees} className="sm:col-span-2">
          <SearchSelect value="" onChange={add} options={options.filter((o) => !chosen.includes(o.value))} placeholder="Add a customer's contact or a colleague" />
        </Field>

        {chosen.length > 0 && (
          <ul className="sm:col-span-2 -mt-1 flex flex-wrap gap-2">
            {chosen.map((key) => (
              <li key={key}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-sm">
                  {nameOf(key)}
                  <button
                    type="button"
                    onClick={() => drop(key)}
                    aria-label={`Do not invite ${nameOf(key)}`}
                    className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <Field label="Anything to tell them" className="sm:col-span-2">
          <Textarea rows={2} value={form.note} onChange={set("note")} placeholder="Bring the new price list." />
        </Field>

        <label className="sm:col-span-2 flex min-h-11 items-start gap-2 text-sm lg:min-h-0">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={form.notify !== false} onChange={(e) => setForm((f) => ({ ...f, notify: e.target.checked }))} />
          <span>
            Send everybody an invitation
            <span className="block text-xs text-muted-foreground">It lands in their own calendar, with Accept and Decline.</span>
          </span>
        </label>
      </div>

      {noAddress.length > 0 && form.notify !== false && (
        <Note tone="warning" className="mt-3">
          {noAddress.length === 1 ? `${nameOf(keyOf(noAddress[0]))} has no email address, so cannot be sent an invitation.` : `${noAddress.length} of the people chosen have no email address, so cannot be sent one.`}
        </Note>
      )}
      {!emailReady && form.notify !== false && (
        <Note tone="warning" className="mt-3">
          Email is not set up yet, so the meeting is saved but no invitation will reach anybody. Settings, under Sending.
        </Note>
      )}
      {clashes.length > 0 && <Note tone="warning" className="mt-3">{rules.clashText(clashes)} It can still be arranged.</Note>}
    </CrmDialog>
  );
}
