import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Wand2 } from "lucide-react";
import { ErrorNote, Field, PageHeader, Panel, Pill, SearchSelect, Select, Spinner, TextInput, useAsync } from "../components/accounting/kit";
import { consoleError, platform } from "./platformApi";
import { COUNTRIES, emptyOrganisation, limitText, suggestPassword, toCreatePayload, validateNewOrganisation, withCountry } from "./platformForms";

const STEP_NAMES = {
  settings: "Company settings and posting accounts",
  currency: "Currency master (base currency)",
  fiscalYear: "Fiscal year",
  taxCodes: "Tax codes",
  chart: "Chart of accounts",
  headOffice: "Head-office branch",
};

function Result({ made, form }) {
  const steps = Object.entries(made.provisioning?.steps || {});
  const org = made.organisation;
  return (
    <div className="space-y-4">
      <Panel title={`${org.legalName} is created`} description={`Code ${org.code} · books in ${org.baseCurrency} · ${org.planCode} plan`}>
        <ul className="space-y-2 text-sm">
          {steps.map(([name, step]) => (
            <li key={name} className="flex items-start gap-2">
              {step.state === "done" || step.state === "skipped" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden="true" />
              )}
              <span>
                {STEP_NAMES[name] || name}
                <span className="text-muted-foreground"> — {step.state}{step.message ? `: ${step.message}` : ""}</span>
              </span>
            </li>
          ))}
        </ul>
        {!made.provisioning?.complete && <p className="mt-3 text-sm text-status-warning">Some set-up did not finish. Open the organisation and run the set-up again.</p>}
      </Panel>

      {made.firstAdmin ? (
        <Panel title="First administrator" description="Give these to the customer. They should change the password when they first sign in.">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{made.firstAdmin.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Password</dt>
              <dd className="font-mono font-medium">{form.adminPassword}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">This is the only time the password is shown. It is not stored anywhere readable.</p>
        </Panel>
      ) : (
        <ErrorNote error={{ message: `The organisation exists, but its first administrator could not be created: ${made.firstAdminError || "unknown reason"}. Add one from the organisation's People tab.` }} />
      )}

      <Link to={`/platform/organisations/${org.code}`} className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground lg:h-10">
        Open {org.legalName}
      </Link>
    </div>
  );
}

// Creating an organisation: who the customer is, the books they will keep, the plan, and their first administrator.
// The server then sets up their masters and accounts and makes their head-office branch.
export default function NewOrganisation() {
  const [form, setForm] = useState(emptyOrganisation);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState(null);
  const catalog = useAsync(() => platform.catalog(), []);
  const c = catalog.data;

  const errors = useMemo(() => validateNewOrganisation(form, c), [form, c]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const plan = c?.plans?.find((p) => p.code === form.planCode);

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length || busy) return;
    setBusy(true);
    setError("");
    try {
      setMade(await platform.createOrganisation(toCreatePayload(form)));
    } catch (err) {
      setError(consoleError(err));
    } finally {
      setBusy(false);
    }
  };

  if (made) {
    return (
      <>
        <PageHeader title="Organisation created" />
        <Result made={made} form={form} />
      </>
    );
  }

  const show = (key) => (touched ? errors[key] : undefined);

  return (
    <>
      <PageHeader title="New organisation" description="The customer, the books they will keep, their plan and their first administrator. Their accounts and masters are set up for them." />
      {catalog.loading && !c && <Spinner label="Loading options" />}
      <ErrorNote error={catalog.error} onRetry={catalog.reload} />
      {c && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Panel title="The organisation">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal name" required error={show("legalName")}>
                <TextInput value={form.legalName} onChange={(e) => set("legalName")(e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Code" hint="Optional. Lower-case letters, digits and hyphens; made from the name if left blank. It cannot be changed later." error={show("code")}>
                <TextInput value={form.code} onChange={(e) => set("code")(e.target.value)} autoComplete="off" placeholder="gulf-fresh" />
              </Field>
              <Field label="Country" required hint="Decides the tax set. Fixed once the organisation is set up." error={show("country")}>
                <SearchSelect
                  value={form.country}
                  onChange={(v) => setForm((f) => withCountry(f, v))}
                  options={COUNTRIES.map((x) => ({ value: x.code, label: x.name, hint: x.code }))}
                />
              </Field>
              <Field label="Base currency" required hint="The currency the books are kept in. Fixed once set up." error={show("baseCurrency")}>
                <SearchSelect
                  value={form.baseCurrency}
                  onChange={set("baseCurrency")}
                  options={c.currencies.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))}
                />
              </Field>
              <Field label="Timezone" required error={show("timezone")}>
                <SearchSelect value={form.timezone} onChange={set("timezone")} options={(c.timezones || []).map((z) => ({ value: z, label: z }))} />
              </Field>
              <Field label="Plan" required error={show("planCode")}>
                <Select value={form.planCode} onChange={(e) => set("planCode")(e.target.value)}>
                  {c.plans.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            {plan && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Includes</span>
                {c.features.filter((f) => plan.features?.[f.key]).map((f) => (
                  <Pill key={f.key} tone="info">{f.label}</Pill>
                ))}
                <span className="ms-1">Limits: {c.limits.map((k) => `${limitText(plan.limits?.[k])} ${k === "documentsPerMonth" ? "documents a month" : k}`).join(" · ")}</span>
                {plan.trialDays && <span>· a {plan.trialDays}-day trial</span>}
              </div>
            )}
          </Panel>

          <Panel title="First administrator" description="The person who signs in first and sets the rest of the organisation up.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required error={show("adminName")}>
                <TextInput value={form.adminName} onChange={(e) => set("adminName")(e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Email" required error={show("adminEmail")}>
                <TextInput type="email" value={form.adminEmail} onChange={(e) => set("adminEmail")(e.target.value)} autoComplete="off" />
              </Field>
              <div className="flex flex-col gap-2">
                <Field label="Password" required hint="At least 8 characters. Shown once, after the organisation is created." error={show("adminPassword")}>
                  <TextInput value={form.adminPassword} onChange={(e) => set("adminPassword")(e.target.value)} autoComplete="new-password" />
                </Field>
                <button
                  type="button"
                  onClick={() => set("adminPassword")(suggestPassword())}
                  className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium hover:bg-accent"
                >
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  Suggest a password
                </button>
              </div>
            </div>
          </Panel>

          {error && <ErrorNote error={{ message: error }} />}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Link to="/platform" className="inline-flex h-11 items-center justify-center rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent lg:h-10">Cancel</Link>
            <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
              {busy ? "Creating…" : "Create organisation"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
