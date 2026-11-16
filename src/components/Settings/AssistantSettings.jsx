import React, { useId, useState } from "react";
import { assistant } from "../../lib/assistantApi";
import {
  INSTALLATION, PROVIDERS, answeringNow, bodyFrom, choosePreset, formFrom, keyWillBeForgotten, testOutcome, validate,
} from "../../lib/assistantSettingsForms";
import { Button } from "../ui/button";
import Guarded from "../shell/Guarded";
import { ErrorNote, Field, Panel, Pill, Select, PageSpinner, TextInput, errorMessage, useAsync } from "../accounting/kit";

// Settings > Zarvia AI: which AI answers the in-app help, and what it has cost.
//
// Open models are the free route: an OpenAI-compatible service (Groq, OpenRouter, or a server of the
// organisation's own running Ollama or vLLM). The installation can also offer its own free model, so
// an organisation with nothing set up still has a working assistant. Keys are write-only: once saved
// the screen says one is stored and can replace it, never show it.

const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
};

export default function AssistantSettings({ notify }) {
  const settings = useAsync(() => assistant.settings(), []);
  const usage = useAsync(() => assistant.usage(daysAgo(30)), []);
  const s = settings.data;
  if (settings.loading && !s) return <PageSpinner />;
  if (settings.error && !s) return <ErrorNote error={settings.error} onRetry={settings.reload} />;
  return (
    <div className="space-y-5">
      <Panel title="Zarvia AI" description="The assistant answers questions about how Zarvia works, from Zarvia's own help guides. It reads no invoices, balances or other business records.">
        <div className="flex flex-wrap items-center gap-3">
          {s.effective?.provider === "echo" ? <Pill tone="warning">Test mode</Pill> : <Pill tone="success">Answering</Pill>}
          <span className="text-sm text-muted-foreground" data-testid="answering-now">{answeringNow(s)}</span>
        </div>
      </Panel>
      <Guarded permission="settings.manage" what="which AI answers questions">
        <Connection key={s.openBaseUrl + s.provider + s.openModel} settings={s} notify={notify} onSaved={() => Promise.all([settings.reload(), usage.reload()])} />
      </Guarded>
      <Usage usage={usage} />
    </div>
  );
}

function Connection({ settings, notify, onSaved }) {
  const [form, setForm] = useState(() => formFrom(settings));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(null);
  const listId = useId();
  const presets = settings.presets || [];
  const installation = settings.installationOpen || {};
  const errors = touched ? validate(form, settings) : {};
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setTested(null);
  };
  const preset = presets.find((p) => p.key === form.preset);
  const usingInstallation = form.provider === "openai" && form.preset === INSTALLATION;
  const forget = keyWillBeForgotten(form, settings);
  const presetOptions = [
    ...(installation.available ? [{ value: INSTALLATION, label: `Zarvia's own free model (${installation.model})` }] : []),
    ...presets.map((p) => ({ value: p.key, label: p.label })),
  ];

  const check = () => {
    setTouched(true);
    return Object.keys(validate(form, settings)).length === 0;
  };
  const save = async (ev) => {
    ev.preventDefault();
    if (!check()) return;
    setBusy(true);
    setError(null);
    try {
      await assistant.saveSettings(bodyFrom(form));
      notify("Zarvia AI settings saved");
      await onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    if (!check()) return;
    setTesting(true);
    setTested(null);
    setError(null);
    try {
      setTested(await assistant.testSettings(bodyFrom(form)));
    } catch (e) {
      setError(e);
    } finally {
      setTesting(false);
    }
  };
  const outcome = testOutcome(tested);

  return (
    <Panel title="Which AI answers" description="Choose a free open model to start. You can change this at any time; nothing people asked before is lost.">
      <form onSubmit={save} className="grid gap-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Service</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <label key={p.value} className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 ${form.provider === p.value ? "border-ring bg-accent" : "border-border"}`}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input type="radio" name="ai-provider" value={p.value} checked={form.provider === p.value} onChange={() => set({ provider: p.value })} className="h-4 w-4" />
                  {p.label}
                </span>
                <span className="text-sm text-muted-foreground">{p.text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {form.provider === "openai" && (
          <div className="grid gap-4">
            <Field label="Where the model runs" hint={usingInstallation ? "Nothing to set up: Zarvia's server already has a free model connected." : preset?.note}>
              <Select value={form.preset} onChange={(e) => setForm((f) => choosePreset(f, e.target.value, presets))} aria-label="Where the model runs">
                {presetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            {!usingInstallation && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="min-w-0" label="Address" hint="Ends in /v1, for example https://api.groq.com/openai/v1" error={errors.openBaseUrl}>
                  <TextInput value={form.openBaseUrl} onChange={(e) => set({ openBaseUrl: e.target.value })} maxLength={300} autoComplete="off" spellCheck={false} />
                </Field>
                <Field className="min-w-0" label="Model" hint="Choose a suggestion or type the exact name the service uses." error={errors.openModel}>
                  <TextInput value={form.openModel} onChange={(e) => set({ openModel: e.target.value })} list={listId} maxLength={200} autoComplete="off" spellCheck={false} />
                </Field>
                {/* Outside the Field: Field labels its ONE child, and the suggestions draw nothing. */}
                <datalist id={listId}>{(preset?.models || []).map((m) => <option key={m} value={m} />)}</datalist>
                <Field
                  className="min-w-0 sm:col-span-2"
                  label="API key"
                  hint={
                    settings.hasOpenApiKey && !forget
                      ? "Stored encrypted. It can never be shown again. Type a new one to replace it."
                      : preset && !preset.needsKey
                        ? "Not needed for a server of your own, unless you set one up."
                        : "From the service's own website. Stored encrypted."
                  }
                >
                  <TextInput type="password" value={form.openApiKey} onChange={(e) => set({ openApiKey: e.target.value })} autoComplete="new-password" placeholder={settings.hasOpenApiKey && !forget ? "Leave empty to keep the stored key" : ""} />
                </Field>
              </div>
            )}
            {forget && (
              <p role="status" className="rounded-lg border border-status-warning/25 bg-status-warning-soft px-3 py-2 text-sm text-status-warning">
                The address has changed, so the stored key will be forgotten when you save. A key is only ever sent to the address it was saved for. Enter the key again if this service needs one.
              </p>
            )}
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Free plans have daily limits and may keep what is sent to them. Zarvia AI sends the question, the person&apos;s name and role, your organisation&apos;s name and the help guides it found, never your invoices or accounts.
            </p>
          </div>
        )}

        {form.provider === "anthropic" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="min-w-0" label="Claude model">
              <Select value={form.model} onChange={(e) => set({ model: e.target.value })} aria-label="Claude model">
                {(settings.models || []).map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Field
              className="min-w-0"
              label="Anthropic API key"
              hint={settings.hasApiKey ? "Stored encrypted. Type a new one to replace it." : settings.usesOurKey ? "Optional: Zarvia's own key is used when this is empty." : "From console.anthropic.com. Stored encrypted."}
            >
              <TextInput type="password" value={form.apiKey} onChange={(e) => set({ apiKey: e.target.value })} autoComplete="new-password" placeholder={settings.hasApiKey ? "Leave empty to keep the stored key" : "sk-ant-..."} />
            </Field>
          </div>
        )}

        {settings.lastErrorCode === "PROVIDER_AUTH" && (
          <ErrorNote error={new Error("The AI service refused the saved key the last time it was used. Enter it again.")} />
        )}
        {error && <ErrorNote error={new Error(errorMessage(error))} />}
        {outcome && (
          <div role="status" className="flex flex-wrap items-start gap-3 rounded-lg border border-border px-3 py-2">
            <Pill tone={outcome.tone}>{outcome.title}</Pill>
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">{outcome.text}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="outline" disabled={testing || form.provider === "echo"} onClick={test}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Usage({ usage }) {
  const t = usage.data?.totals;
  if (usage.error) return null; // a person who may not see the cost simply does not see this panel
  if (!t) return null;
  return (
    <Panel title="Last 30 days" description="Questions asked of Zarvia AI in your organisation.">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Questions" value={t.questions} />
        <Stat label="Passed to the team" value={t.escalations} />
        <Stat label="Failed" value={t.failures} />
        <Stat label="Cost" value={t.costMicros ? `$${(t.costMicros / 1e6).toFixed(2)}` : "Free"} />
      </dl>
    </Panel>
  );
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
