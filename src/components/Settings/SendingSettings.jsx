import React, { useState } from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { sendSettings } from "../../lib/sendDocumentsApi";
import { Button } from "../ui/button";
import { ErrorNote, Field, Panel, Pill, Select, Spinner, TextInput, Textarea, errorMessage, useAsync } from "../accounting/kit";

// Sending documents to customers: where the email comes from and how it is sent. Admins only change this
// (the server enforces it); everyone can see it. The email service key is write-only: once saved the
// screen can say it is stored and let it be replaced, but can never show it again.
//
// WhatsApp needs nothing here. It opens the person's own WhatsApp with the message written, so there is
// no account to connect and no setting to get wrong.

const MODES = [
  { value: "console", label: "Record only", text: "Nothing is emailed. Each send is logged so you can try the whole flow without an account." },
  { value: "resend", label: "Resend", text: "Emails go out through your Resend account, from your own address." },
  { value: "smtp", label: "Your own mail server (SMTP)", text: "Send through a mailbox you already have: Microsoft 365, Gmail or your hosting company." },
];

const PORTS = [
  { value: 587, label: "587, most servers" },
  { value: 465, label: "465, secure from the start" },
  { value: 2525, label: "2525, an alternative" },
];

export default function SendingSettings({ notify }) {
  const settings = useAsync(() => sendSettings.get(), []);
  const ready = useAsync(() => sendSettings.readiness(), []);
  const s = settings.data;
  const refresh = () => Promise.all([settings.reload(), ready.reload()]);
  if (settings.loading && !s) return <Spinner />;
  if (settings.error && !s) return <ErrorNote error={settings.error} onRetry={settings.reload} />;
  return (
    <div className="space-y-5">
      <Switch settings={s} notify={notify} onSaved={refresh} />
      <Connection settings={s} readiness={ready.data} notify={notify} onSaved={refresh} />
      <Wording settings={s} notify={notify} onSaved={refresh} />
      <TestEmail notify={notify} />
    </div>
  );
}

function useSave(notify, onSaved) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async (body, message) => {
    setBusy(true);
    setError(null);
    try {
      await sendSettings.save(body);
      notify(message);
      await onSaved();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, save };
}

function Switch({ settings, notify, onSaved }) {
  const { busy, error, save } = useSave(notify, onSaved);
  const on = settings.enabled;
  const note = !on ? "Email is switched off. WhatsApp still works."
    : settings.connected ? "Documents can be emailed to customers."
    : "On, but recording only: nothing is actually emailed until you connect an email service.";
  return (
    <Panel title="Sending documents" description="Switch it on once the checklist below is complete. WhatsApp does not need it.">
      <div className="flex flex-wrap items-center gap-3">
        {on ? <Pill tone="success">On</Pill> : <Pill tone="warning">Off</Pill>}
        <span className="text-sm text-muted-foreground">{note}</span>
        <Button className="ms-auto" variant={on ? "outline" : "default"} disabled={busy} onClick={() => save({ enabled: !on }, on ? "Sending switched off" : "Sending switched on")}>
          {on ? "Switch off" : "Switch on"}
        </Button>
      </div>
      {error && <div className="mt-3"><ErrorNote error={error} /></div>}
    </Panel>
  );
}

function Connection({ settings, readiness, notify, onSaved }) {
  const [provider, setProvider] = useState(settings.provider);
  const [fromName, setFromName] = useState(settings.fromName);
  const [fromEmail, setFromEmail] = useState(settings.fromEmail);
  const [replyTo, setReplyTo] = useState(settings.replyTo);
  const [domain, setDomain] = useState(settings.verifiedDomain);
  const [key, setKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(String(settings.smtpPort || 587));
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState("");
  const [replacingPass, setReplacingPass] = useState(false);
  const { busy, error, save } = useSave(notify, onSaved);
  const live = provider === "resend";
  const smtp = provider === "smtp";
  const submit = async (ev) => {
    ev.preventDefault();
    const body = smtp
      ? { provider, fromName, fromEmail, replyTo, smtpHost, smtpPort: Number(smtpPort), smtpUser, ...(smtpPass ? { smtpPassword: smtpPass } : {}) }
      : { provider, fromName, fromEmail, replyTo, verifiedDomain: domain, ...(key ? { apiKey: key } : {}) };
    const ok = await save(body, "Sending setup saved");
    if (ok) { setKey(""); setReplacing(false); setSmtpPass(""); setReplacingPass(false); }
  };
  const stored = settings.hasApiKey && !replacing;
  const passStored = settings.hasSmtpPassword && !replacingPass;
  return (
    <Panel title="Email connection" description="Who the email comes from, and how it is sent.">
      <form onSubmit={submit} className="grid gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">How email is sent</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <label key={m.value} className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 ${provider === m.value ? "border-ring bg-accent" : "border-border"}`}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input type="radio" name="provider" value={m.value} checked={provider === m.value} onChange={() => setProvider(m.value)} className="h-4 w-4" />{m.label}
                </span>
                <span className="text-sm text-muted-foreground">{m.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sender name" hint="What the customer sees first, for example your company name."><TextInput value={fromName} onChange={(e) => setFromName(e.target.value)} maxLength={100} /></Field>
          <Field label="Sender address" hint={smtp ? "Usually the mailbox you log in with, for example accounts@yourcompany.ae. Most mail servers refuse any other." : "Must be on your own domain, for example accounts@yourcompany.ae."}><TextInput type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} maxLength={160} /></Field>
          <Field label="Replies go to" hint="Optional. Leave empty to use the sender address."><TextInput type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} maxLength={160} /></Field>
          {live && <Field label="Verified domain" hint="The domain you verified at Resend, for example yourcompany.ae."><TextInput value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={120} /></Field>}
        </div>
        {smtp && (
          <div className="grid gap-4">
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Hosted on Render&apos;s free plan? It blocks connections to mail servers, so this option cannot work there. Use Resend instead, or move to a paid plan.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="min-w-0" label="Mail server" hint="For example smtp.office365.com or smtp.gmail.com. Your mail provider or hosting company can tell you.">
                <TextInput value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} maxLength={253} autoComplete="off" placeholder="smtp.yourcompany.ae" />
              </Field>
              <Field className="min-w-0" label="Port" hint="Leave it on 587 unless your provider says otherwise.">
                <Select value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)}>
                  {(PORTS.some((p) => String(p.value) === smtpPort) ? PORTS : [...PORTS, { value: smtpPort, label: String(smtpPort) }]).map((p) => <option key={p.value} value={String(p.value)}>{p.label}</option>)}
                </Select>
              </Field>
              <Field className="min-w-0" label="Username" hint="Usually the full email address of the mailbox.">
                <TextInput value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} maxLength={200} autoComplete="off" />
              </Field>
              <Field className="min-w-0" label="Password" hint={passStored ? "Stored encrypted. It can never be shown again." : "Gmail and Microsoft 365 need an app password, not the normal one. Stored encrypted."}>
                {passStored
                  ? <div className="flex items-center gap-3"><Pill tone="success">Stored</Pill><Button type="button" variant="outline" size="sm" onClick={() => setReplacingPass(true)}>Replace password</Button></div>
                  : <TextInput type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} autoComplete="new-password" />}
              </Field>
            </div>
          </div>
        )}
        {live && (
          <Field label="Resend API key" hint={stored ? "Stored encrypted. It can never be shown again." : "From your Resend account, under API keys. Stored encrypted."}>
            {stored
              ? <div className="flex items-center gap-3"><Pill tone="success">Stored</Pill><Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>Replace key</Button></div>
              : <TextInput type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" placeholder="re_..." />}
          </Field>
        )}
        {settings.lastAuthFailureAt && live && <ErrorNote error={new Error("The email service refused the saved key the last time it was used. Enter it again.")} />}
        {settings.lastAuthFailureAt && smtp && <ErrorNote error={new Error("The mail server refused the saved username or password the last time it was used. Check them and enter the password again.")} />}
        {error && <ErrorNote error={new Error(errorMessage(error))} />}
        <div><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
      </form>
      {readiness && (
        <ul className="mt-5 space-y-1.5 border-t border-border pt-4" aria-label="Setup checklist">
          {readiness.checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-sm">
              {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}{!c.ok && !c.blocking ? " (advised)" : ""}</span>
              <span className="sr-only">{c.ok ? "done" : "to do"}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Wording({ settings, notify, onSaved }) {
  const [signature, setSignature] = useState(settings.signature);
  const [defaultNote, setDefaultNote] = useState(settings.defaultNote);
  const [days, setDays] = useState(String(settings.shareLinkDays));
  const [attachPdf, setAttachPdf] = useState(settings.attachPdf);
  const [bccSelf, setBccSelf] = useState(settings.bccSelf);
  const { busy, error, save } = useSave(notify, onSaved);
  return (
    <Panel title="What the customer receives" description="The wording under the greeting, and how long the document link stays open.">
      <form onSubmit={(ev) => { ev.preventDefault(); save({ signature, defaultNote, shareLinkDays: Number(days), attachPdf, bccSelf }, "Saved"); }} className="grid gap-4">
        <Field label="Starting message" hint="Fills the message box each time. The person sending can change it."><Textarea rows={2} value={defaultNote} onChange={(e) => setDefaultNote(e.target.value)} maxLength={500} /></Field>
        <Field label="Signature" hint="Added at the end of every email."><Textarea rows={2} value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={500} /></Field>
        <Field label="Link stays open for (days)" hint="After this the link shows an expired page. From 1 to 365."><TextInput type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} className="sm:max-w-[10rem]" /></Field>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5 rounded border-input" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} />Attach the PDF to the email (otherwise the email carries the link only)</label>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5 rounded border-input" checked={bccSelf} onChange={(e) => setBccSelf(e.target.checked)} />Send me a copy of every email I send</label>
        {error && <ErrorNote error={new Error(errorMessage(error))} />}
        <div><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
      </form>
    </Panel>
  );
}

function TestEmail({ notify }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const run = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await sendSettings.test(to.trim());
      setDone(r);
      notify(`Test message sent to ${r.to}`);
    } catch (e) {
      setError(e); // in place, in the provider's own words: a toast would vanish before it was read
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Send a test email" description="Checks the whole setup with a real message, before a customer is involved.">
      <form onSubmit={run} className="flex flex-wrap items-end gap-3">
        <Field label="Send the test to" className="min-w-[14rem] flex-1"><TextInput type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@yourcompany.ae" /></Field>
        <Button type="submit" disabled={busy || !to.trim()}>{busy ? "Sending…" : "Send test"}</Button>
      </form>
      {error && <div className="mt-3"><ErrorNote error={new Error(errorMessage(error))} /></div>}
      {done && <p role="status" className="mt-3 text-sm text-status-success">Sent to {done.to}{done.provider === "console" ? " (recorded only: no email service is connected)" : ""}.</p>}
    </Panel>
  );
}
