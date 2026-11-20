import React, { useEffect, useState } from "react";
import { einvoice } from "../../lib/accountingApi";
import { Button } from "../ui/button";
import { ErrorNote, Field, Panel, Pill, TextInput } from "../accounting/kit";
import WafeqConnection from "./WafeqConnection";

export default function EInvoiceSettings({ settings, notify, onSaved }) {
  const [participantId, setParticipantId] = useState(settings.participantId);
  const [dueDays, setDueDays] = useState(String(settings.dueDays));
  const [secret, setSecret] = useState("");
  const [replacing, setReplacing] = useState(!settings.hasWebhookSecret);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  useEffect(() => { setParticipantId(settings.participantId); setDueDays(String(settings.dueDays)); }, [settings]);

  async function save(body, message) {
    setBusy(true);
    setError(null);
    try {
      await einvoice.saveSettings(body);
      notify(message);
      setSecret("");
      setReplacing(false);
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (participantId && !/^\d+:\d+$/.test(participantId)) e.participantId = "Looks like 0235:100123456700003";
    if (dueDays === "" || !Number.isInteger(Number(dueDays)) || Number(dueDays) < 0) e.dueDays = "Enter a whole number of days, 0 or more";
    setErrors(e);
    if (Object.keys(e).length) return;
    save({ participantId, dueDays: Number(dueDays), ...(secret ? { webhookSecret: secret } : {}) }, "E-invoice settings saved");
  }

  return (
    <div className="space-y-5">
      <Panel title="E-invoicing" description="Switch it on once the Readiness tab shows your company is complete.">
        <div className="flex flex-wrap items-center gap-3">
          {settings.enabled ? <Pill tone="success">On</Pill> : <Pill tone="warning">Off</Pill>}
          <span className="text-sm text-muted-foreground">{settings.enabled ? "Approved sales documents can be sent." : "Sending is disabled."}</span>
          <Button className="ms-auto" variant={settings.enabled ? "outline" : "default"} disabled={busy} onClick={() => save({ enabled: !settings.enabled }, settings.enabled ? "E-invoicing switched off" : "E-invoicing switched on")}>
            {settings.enabled ? "Switch off" : "Switch on"}
          </Button>
        </div>
        {error && <div className="mt-3"><ErrorNote error={error} /></div>}
      </Panel>

      <Panel title="Connection" description="How invoices leave the system.">
        <WafeqConnection settings={settings} notify={notify} onSaved={onSaved} />
      </Panel>

      <Panel title="Your identity and preferences">
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Your Participant ID" error={errors.participantId} hint={settings.connected ? "Taken from Wafeq's record of your business." : "Your Peppol identifier, e.g. 0235:100123456700003."}><TextInput value={participantId} onChange={(e) => setParticipantId(e.target.value.trim())} placeholder="0235:…" disabled={settings.connected} /></Field>
          <Field label="Send within (days)" error={errors.dueDays} hint="Invoices not sent by then are flagged. 0 turns the reminder off."><TextInput type="number" min="0" step="1" value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Signing secret for received invoices" hint="Deliveries to /einvoice/inbound/webhook must be signed with this secret (HMAC-SHA256 of the body in the x-einvoice-signature header). It is stored encrypted and can never be read back.">
              {replacing
                ? <TextInput type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Enter a long random secret" />
                : <div className="flex h-10 items-center gap-3 text-sm"><Pill tone="success">Stored</Pill><button type="button" className="font-semibold underline underline-offset-2" onClick={() => setReplacing(true)}>Replace</button></div>}
            </Field>
          </div>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button></div>
        </form>
      </Panel>
    </div>
  );
}
