// Writing to a customer from the CRM.
//
// The gap this closes: a salesperson had to leave for Outlook, and nothing of that conversation came back. Written
// here, the letter lands on the lead's or the deal's timeline beside the calls, where the next person to pick the
// account up can read it.
//
// Three honesties the screen owes, and all three are visible before the button is pressed: who it is really going
// to, that replies arrive in the person's OWN mailbox and are not shown here, and - when the organisation has no
// mailbox set up - that pressing Send will record the letter and email nobody.
import React, { useEffect, useMemo, useState } from "react";
import { Field, TextInput, Textarea, Select } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import { CrmDialog } from "./crmShared.jsx";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crmEmail";

/** The people we already hold for this lead or deal: nobody should have to retype an address we have on file. */
function useRecipients(regarding) {
  const [state, setState] = useState({ people: [], loading: true });
  useEffect(() => {
    if (!regarding?.kind || !regarding?.id) return undefined;
    let alive = true;
    crm
      .emailRecipients({ kind: regarding.kind, id: regarding.id })
      .then((d) => alive && setState({ people: d?.people || [], loading: false }))
      .catch(() => alive && setState({ people: [], loading: false }));
    return () => {
      alive = false;
    };
  }, [regarding?.kind, regarding?.id]);
  return state;
}

function useTemplates() {
  const [state, setState] = useState({ templates: [], signature: "", placeholders: [] });
  useEffect(() => {
    let alive = true;
    crm
      .emailTemplates()
      .then((d) => alive && setState({ templates: d?.templates || [], signature: d?.signature || "", placeholders: d?.placeholders || [] }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export default function EmailDialog({ regarding, to = [], subject = "", onClose, onSent, notify }) {
  const { people, loading } = useRecipients(regarding);
  const { templates, signature, placeholders } = useTemplates();
  const [form, setForm] = useState(() => rules.blankEmail({ to, subject }));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [overwrote, setOverwrote] = useState(false);

  // Seed the address from the person we already know, but never over something the writer has typed.
  //
  // The guard is INSIDE the updater, not only in the effect. Found by a test: the effect can be committed while the
  // list is still arriving and its update applied after the person has started typing, so a check made at effect
  // time is already stale by the time it lands - and the address they typed is silently replaced.
  useEffect(() => {
    if (touched || form.to || loading || !people.length) return;
    const first = people.find((p) => p.primary) || people[0];
    if (first) setForm((f) => (f.to ? f : { ...f, to: first.email }));
  }, [people, loading, touched, form.to]);

  const set = (key) => (e) => {
    setTouched(true);
    setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  };

  const errors = useMemo(() => (touched ? rules.validate(form) : {}), [form, touched]);
  const unknown = useMemo(() => rules.unknownIn(`${form.subject}\n${form.body}`, placeholders), [form.subject, form.body, placeholders]);

  const pickTemplate = (e) => {
    const chosen = templates.find((t) => t.key === e.target.value);
    const out = rules.applyTemplate(form, chosen);
    setForm(out.form);
    setOverwrote(out.overwrote);
    setTouched(true);
  };

  const send = async () => {
    setTouched(true);
    const found = rules.validate(form);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const out = await crm.sendEmail(rules.emailBody(form, regarding));
      // Sent, recorded-only and failed must never read the same. `sendResult` is the one place that decides.
      const said = rules.sendResult(out);
      notify?.(said.text, said.tone === "success" ? undefined : "error");
      onSent?.(out);
      onClose?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog
      title="Write to the customer"
      description="It is sent from your organisation's address and kept on this record."
      confirmLabel="Send"
      size="md"
      busy={busy}
      problem={problem}
      onClose={onClose}
      onConfirm={send}
    >
      <div className="grid gap-3">
        {templates.length > 0 && (
          <Field label="Start from a template" hint="It replaces the subject and the message.">
            <Select value={form.templateKey} onChange={pickTemplate}>
              <option value="">Write it myself</option>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {overwrote && <Note tone="warning">The template replaced what you had written.</Note>}

        <Field label="To" required error={errors.to} hint={people.length ? "Several addresses: separate them with a comma." : undefined}>
          <TextInput value={form.to} onChange={set("to")} placeholder="name@company.com" data-autofocus />
        </Field>

        {people.length > 0 && (
          <div className="-mt-1 flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setTouched(true);
                  const have = rules.splitAddresses(form.to);
                  if (!have.includes(p.email)) setForm((f) => ({ ...f, to: rules.joinAddresses([...have, p.email]) }));
                }}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {p.name || p.email}
                {p.designation ? ` · ${p.designation}` : ""}
              </button>
            ))}
          </div>
        )}

        <Field label="Copy to" error={errors.cc}>
          <TextInput value={form.cc} onChange={set("cc")} placeholder="Optional" />
        </Field>

        <Field label="Subject" required error={errors.subject}>
          <TextInput value={form.subject} onChange={set("subject")} placeholder="Our quotation for the coating line" />
        </Field>

        <Field label="Message" required error={errors.body}>
          <Textarea rows={9} value={form.body} onChange={set("body")} placeholder="Hello…" />
        </Field>

        {unknown.length > 0 && (
          <Note tone="warning">
            Nothing can fill {unknown.map((u) => `{{${u}}}`).join(", ")} — it will be sent exactly as written. Take it out, or use one of:{" "}
            {placeholders.map((p) => `{{${p.key}}}`).join(", ")}.
          </Note>
        )}

        {signature ? <Note tone="info">Your signature is added at the foot.</Note> : null}
        <Note tone="info">{rules.REPLY_NOTE}</Note>
      </div>
    </CrmDialog>
  );
}
