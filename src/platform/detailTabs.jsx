import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { DataTable, DateInput, EmptyState, ErrorNote, Field, Modal, Panel, Pill, Select, Spinner, TextInput, useAsync } from "../components/accounting/kit";
import { formatDate, formatDateTime } from "../utils/format";
import { consoleError, platform } from "./platformApi";
import {
  ACCOUNT_TYPES,
  featureChoice,
  featurePatch,
  featureResult,
  isoDay,
  limitChoice,
  limitPatch,
  limitText,
  provisioningIssues,
  stateLabel,
  subscriptionPatch,
} from "./platformForms";

const LIMIT_LABELS = { users: "People", branches: "Branches", documentsPerMonth: "Documents each month" };
const primaryButton = "inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10";
const secondaryButton = "inline-flex h-11 items-center justify-center rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent disabled:opacity-60 lg:h-10";

const planOf = (catalog, org) => catalog?.plans?.find((p) => p.code === org.planCode) || null;

// ---------------------------------------------------------------------------------------------------- overview

export function OverviewTab({ detail, run, busy }) {
  const { organisation: org, usage, limits, state, room } = detail;
  const issues = provisioningIssues(org.provisioning);
  const s = stateLabel(state);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Subscription">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">State</dt><dd><Pill tone={s.tone}>{s.text}</Pill></dd></div>
          <div><dt className="text-muted-foreground">Ends</dt><dd className="font-medium">{org.subscription?.endsAt ? formatDate(org.subscription.endsAt) : "Never"}</dd></div>
          <div><dt className="text-muted-foreground">Grace period</dt><dd className="font-medium">{org.subscription?.graceDays || 0} days</dd></div>
          <div><dt className="text-muted-foreground">At the end</dt><dd className="font-medium">{org.subscription?.onExpiry === "readonly" ? "Read-only" : "Blocked"}</dd></div>
        </dl>
      </Panel>

      <Panel title="Use against the limits">
        <ul className="space-y-3 text-sm">
          {Object.keys(LIMIT_LABELS).map((key) => {
            const limit = limits?.[key];
            const used = usage?.[key] ?? 0;
            const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            const full = room?.[key] && !room[key].ok;
            return (
              <li key={key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span>{LIMIT_LABELS[key]}</span>
                  <span className={full ? "font-semibold text-status-danger" : "text-muted-foreground"}>{used} of {limitText(limit)}</span>
                </div>
                {limit ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" role="presentation">
                    <div className={full ? "h-full bg-status-danger" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel
        title="Set-up"
        description="Chart of accounts, tax codes, currency master, fiscal year and the head-office branch."
        actions={<button type="button" disabled={busy} onClick={() => run(() => platform.provision(org.code), "Set-up checked")} className={secondaryButton}>Run set-up again</button>}
        className="lg:col-span-2"
      >
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" />Everything is set up.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {issues.map((i) => (
              <li key={i.name} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden="true" /><span>{i.name} — {i.state}{i.message ? `: ${i.message}` : ""}</span></li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// -------------------------------------------------------------------------------------------- plan and features

const FEATURE_CHOICES = [
  { value: "default", label: "Follow the plan" },
  { value: "on", label: "Always on" },
  { value: "off", label: "Always off" },
];

function LimitRow({ label, planValue, org, limitKey, busy, run }) {
  const stored = limitChoice(org, limitKey);
  const [choice, setChoice] = useState(stored);
  const [value, setValue] = useState(String(org.limitOverrides?.[limitKey] ?? ""));
  const [error, setError] = useState("");
  useEffect(() => {
    setChoice(limitChoice(org, limitKey));
    setValue(String(org.limitOverrides?.[limitKey] ?? ""));
  }, [org, limitKey]);

  const save = () => {
    const patch = limitPatch(limitKey, choice, value);
    if (patch.error) return setError(patch.error);
    setError("");
    run(() => platform.updateOrganisation(org.code, patch), `${label} limit saved`);
  };
  const dirty = choice !== stored || (choice === "number" && String(org.limitOverrides?.[limitKey] ?? "") !== value);

  return (
    <div className="grid items-start gap-2 border-t border-border py-3 first:border-t-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">The plan allows {limitText(planValue)}</p>
      </div>
      <Select aria-label={`${label} limit`} value={choice} onChange={(e) => setChoice(e.target.value)} className="sm:w-44">
        <option value="default">Follow the plan</option>
        <option value="number">A number</option>
        <option value="unlimited">Unlimited</option>
      </Select>
      <div className="sm:w-28">
        {choice === "number" ? <TextInput inputMode="numeric" aria-label={`${label} limit number`} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={error ? true : undefined} /> : null}
        {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
      </div>
      <button type="button" disabled={busy || !dirty} onClick={save} className={secondaryButton}>Save</button>
    </div>
  );
}

export function PlanTab({ detail, catalog, run, busy }) {
  const org = detail.organisation;
  const plan = planOf(catalog, org);
  const [planCode, setPlanCode] = useState(org.planCode);
  const [choices, setChoices] = useState({});
  useEffect(() => {
    setPlanCode(org.planCode);
    setChoices({});
  }, [org]);

  if (!catalog) return <Spinner label="Loading plans" />;
  const chosen = (key) => choices[key] ?? featureChoice(org, key);
  const patch = featurePatch(org, Object.fromEntries(catalog.features.map((f) => [f.key, chosen(f.key)])));
  const featuresDirty = Object.keys(patch).length > 0;

  return (
    <div className="space-y-4">
      <Panel title="Plan" description="The plan sets what is switched on and the limits. Anything below overrides it for this organisation only.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Plan" className="sm:w-64">
            <Select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
              {catalog.plans.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <button type="button" disabled={busy || planCode === org.planCode} onClick={() => run(() => platform.updateOrganisation(org.code, { planCode }), "Plan changed")} className={primaryButton}>Change plan</button>
        </div>
      </Panel>

      <Panel
        title="Features"
        description="Each can follow the plan or be forced on or off for this organisation. A change applies on the person's very next request."
        actions={<button type="button" disabled={busy || !featuresDirty} onClick={() => run(() => platform.updateOrganisation(org.code, patch), "Features saved")} className={primaryButton}>Save features</button>}
      >
        <ul>
          {catalog.features.map((f) => {
            const choice = chosen(f.key);
            const on = featureResult(choice, plan?.features?.[f.key]);
            return (
              <li key={f.key} className="grid items-center gap-2 border-t border-border py-2.5 first:border-t-0 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{plan?.features?.[f.key] ? "In the plan" : "Not in the plan"}</p>
                </div>
                <Select aria-label={f.label} value={choice} onChange={(e) => setChoices((c) => ({ ...c, [f.key]: e.target.value }))} className="sm:w-44">
                  {FEATURE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
                <Pill tone={on ? "success" : "neutral"} className="justify-self-start sm:w-16 sm:justify-center">{on ? "On" : "Off"}</Pill>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Limits" description="The plan's number, a number of its own, or none.">
        {catalog.limits.map((key) => (
          <LimitRow key={key} limitKey={key} label={LIMIT_LABELS[key] || key} planValue={plan?.limits?.[key]} org={org} busy={busy} run={run} />
        ))}
      </Panel>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------- subscription

export function SubscriptionTab({ detail, run, busy }) {
  const org = detail.organisation;
  const sub = org.subscription || {};
  const [endsAt, setEndsAt] = useState(isoDay(sub.endsAt));
  const [graceDays, setGraceDays] = useState(String(sub.graceDays ?? 0));
  const [onExpiry, setOnExpiry] = useState(sub.onExpiry === "readonly" ? "readonly" : "block");
  const [days, setDays] = useState("30");
  const [error, setError] = useState("");
  useEffect(() => {
    setEndsAt(isoDay(org.subscription?.endsAt));
    setGraceDays(String(org.subscription?.graceDays ?? 0));
    setOnExpiry(org.subscription?.onExpiry === "readonly" ? "readonly" : "block");
  }, [org]);

  const save = () => {
    const patch = subscriptionPatch({ endsAt, graceDays, onExpiry });
    if (patch.error) return setError(patch.error);
    setError("");
    run(() => platform.updateOrganisation(org.code, patch), "Subscription saved");
  };
  const extend = (n) => run(() => platform.extend(org.code, { days: n }), `Extended by ${n} days`);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Renew" description="Adds time from the current end date, or from today if it has already passed. It never shortens what was paid for, and it reopens a suspended organisation.">
        <div className="flex flex-wrap gap-2">
          {[30, 90, 365].map((n) => (
            <button key={n} type="button" disabled={busy} onClick={() => extend(n)} className={secondaryButton}>+ {n} days</button>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <Field label="Or a number of days" className="w-40">
            <TextInput inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <button type="button" disabled={busy || !days} onClick={() => extend(Number(days))} className={secondaryButton}>Extend</button>
        </div>
      </Panel>

      <Panel title="Rules" description="What happens when the date passes.">
        <div className="space-y-4">
          <Field label="Subscription ends" hint="The end of this day. Leave blank for no end date.">
            <DateInput value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
          <Field label="Grace period (days)" hint="After the end date, everything keeps working for this long, with a warning." error={error}>
            <TextInput inputMode="numeric" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
          </Field>
          <Field label="After the grace period" hint="Blocked: nobody can use the system. Read-only: people can sign in and look at their records, nothing can be changed.">
            <Select value={onExpiry} onChange={(e) => setOnExpiry(e.target.value)}>
              <option value="block">Blocked</option>
              <option value="readonly">Read-only</option>
            </Select>
          </Field>
          <button type="button" disabled={busy} onClick={save} className={primaryButton}>Save</button>
        </div>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------ company

const PROFILE_FIELDS = [
  ["legalName", "Legal name"],
  ["trn", "Tax registration number"],
  ["addressLine1", "Address"],
  ["city", "City"],
  ["emirate", "Emirate or state"],
  ["email", "Email"],
  ["phone", "Phone"],
];

export function CompanyTab({ detail, run, busy }) {
  const org = detail.organisation;
  const profile = useMemo(() => detail.profile || {}, [detail.profile]);
  const [form, setForm] = useState({});
  const [vatRegistered, setVatRegistered] = useState(Boolean(profile.vatRegistered));
  useEffect(() => {
    setForm(Object.fromEntries(PROFILE_FIELDS.map(([key]) => [key, profile[key] ?? ""])));
    setVatRegistered(Boolean(profile.vatRegistered));
  }, [profile]);

  const save = () => run(() => platform.saveProfile(org.code, { ...form, vatRegistered }), "Company details saved");
  return (
    <Panel title="Company details" description="The letterhead and tax identity on this organisation's invoices. The customer can change these in their own Settings; use this to correct them for them.">
      <div className="grid gap-4 sm:grid-cols-2">
        {PROFILE_FIELDS.map(([key, label]) => (
          <Field key={key} label={label} hint={key === "trn" && org.country === "AE" ? "Fifteen digits" : undefined}>
            <TextInput value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          </Field>
        ))}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={vatRegistered} onChange={(e) => setVatRegistered(e.target.checked)} className="h-4 w-4" />
          Registered for VAT
        </label>
      </div>
      <button type="button" disabled={busy} onClick={save} className={`${primaryButton} mt-4`}>Save</button>
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------------- people

function PersonDialog({ code, branches, onClose, run, existing }) {
  const [form, setForm] = useState({ name: existing?.name || "", email: existing?.email || "", password: "", type: existing?.type || "admin", branchId: existing?.branchId || "main" });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = async () => {
    const body = existing ? { name: form.name, type: form.type, ...(form.password ? { password: form.password } : {}) } : form;
    const ok = await run(() => (existing ? platform.updateUser(code, existing._id, body) : platform.createUser(code, body)), existing ? "Account saved" : "Account created");
    if (ok) onClose();
  };
  return (
    <Modal
      title={existing ? `Change ${existing.name}` : "Add a person"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
          <button type="button" onClick={save} className={primaryButton}>{existing ? "Save" : "Add"}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required><TextInput value={form.name} onChange={set("name")} /></Field>
        <Field label="Email" required><TextInput type="email" value={form.email} onChange={set("email")} disabled={Boolean(existing)} /></Field>
        <Field label={existing ? "New password" : "Password"} required={!existing} hint={existing ? "Leave blank to keep the current password." : "At least 8 characters."}>
          <TextInput type="text" autoComplete="new-password" value={form.password} onChange={set("password")} />
        </Field>
        <Field label="Role">
          <Select value={form.type} onChange={set("type")}>{ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
        </Field>
        {!existing && (
          <Field label="Branch">
            <Select value={form.branchId} onChange={set("branchId")}>{branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function PeopleTab({ detail, code, run, busy }) {
  const users = useAsync(() => platform.users(code), [code]);
  const branches = useAsync(() => platform.branches(code), [code]);
  const [dialog, setDialog] = useState(null);
  const rows = users.data || [];
  // after a change anywhere, read the list again
  const act = async (action, done) => {
    const result = await run(action, done);
    await users.reload();
    return result;
  };

  const columns = [
    { key: "name", header: "Name", card: "primary", cell: (u) => <span className="font-medium">{u.name}</span> },
    { key: "email", header: "Email", card: "title", cell: (u) => u.email },
    { key: "type", header: "Role", card: "meta", cell: (u) => ACCOUNT_TYPES.find((t) => t.value === u.type)?.label || u.type },
    { key: "last", header: "Last signed in", card: "meta", cell: (u) => (u.lastLogin ? formatDateTime(u.lastLogin) : "Never") },
    { key: "status", header: "Status", card: "badge", cell: (u) => <Pill tone={u.isActive && u.status === "active" ? "success" : "neutral"}>{u.isActive && u.status === "active" ? "Active" : "Switched off"}</Pill> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      card: "actions",
      align: "end",
      cell: (u) => (
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setDialog(u)} className="h-9 rounded-full border border-input px-3 text-xs font-medium hover:bg-accent">Change</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => platform.updateUser(code, u._id, u.isActive && u.status === "active" ? { status: "inactive", isActive: false } : { status: "active", isActive: true }), "Account updated")}
            className="h-9 rounded-full border border-input px-3 text-xs font-medium hover:bg-accent"
          >
            {u.isActive && u.status === "active" ? "Switch off" : "Switch on"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <Panel
      title="People"
      description={`${detail.usage?.users ?? 0} of ${limitText(detail.limits?.users)} active`}
      actions={<button type="button" onClick={() => setDialog("new")} className={primaryButton}>Add a person</button>}
      bodyClassName="p-0"
    >
      {users.loading && !users.data && <Spinner label="Loading people" />}
      {users.error && <div className="p-4"><ErrorNote error={{ message: consoleError(users.error) }} onRetry={users.reload} /></div>}
      {users.data && rows.length === 0 && <EmptyState title="Nobody yet" text="Add the first administrator so the customer can sign in." />}
      {rows.length > 0 && <DataTable caption="People" columns={columns} rows={rows} rowKey={(u) => u._id} />}
      {dialog && (
        <PersonDialog
          code={code}
          branches={branches.data || [{ code: "main", name: "Head office" }]}
          existing={dialog === "new" ? null : dialog}
          run={act}
          onClose={() => setDialog(null)}
        />
      )}
    </Panel>
  );
}

// ----------------------------------------------------------------------------------------------------- branches

function BranchDialog({ code, existing, onClose, run }) {
  const [form, setForm] = useState({ code: existing?.code || "", name: existing?.name || "", city: existing?.address?.city || "" });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = async () => {
    const ok = await run(
      () => (existing ? platform.updateBranch(code, existing.code, { name: form.name, city: form.city }) : platform.createBranch(code, form)),
      existing ? "Branch saved" : "Branch created"
    );
    if (ok) onClose();
  };
  return (
    <Modal
      title={existing ? `Change ${existing.name}` : "Add a branch"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
          <button type="button" onClick={save} className={primaryButton}>{existing ? "Save" : "Add"}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Code" required hint="2 to 20 lower-case letters, digits or hyphens. It is printed in the branch's document numbers and cannot be changed." >
          <TextInput value={form.code} onChange={set("code")} disabled={Boolean(existing)} placeholder="dxb" />
        </Field>
        <Field label="Name" required><TextInput value={form.name} onChange={set("name")} /></Field>
        <Field label="City"><TextInput value={form.city} onChange={set("city")} /></Field>
      </div>
    </Modal>
  );
}

export function BranchesTab({ detail, code, run, busy }) {
  const branches = useAsync(() => platform.branches(code), [code]);
  const [dialog, setDialog] = useState(null);
  const rows = branches.data || [];
  const act = async (action, done) => {
    const result = await run(action, done);
    await branches.reload();
    return result;
  };

  const columns = [
    { key: "name", header: "Branch", card: "primary", cell: (b) => <span className="font-medium">{b.name}</span> },
    { key: "code", header: "Code", card: "meta", cell: (b) => b.code },
    { key: "city", header: "City", card: "meta", cell: (b) => b.address?.city || "-" },
    { key: "kind", header: "", card: "badge", cell: (b) => (b.isHeadOffice ? <Pill tone="info">Head office</Pill> : <Pill tone={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Switched off"}</Pill>) },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      card: "actions",
      align: "end",
      cell: (b) => (
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setDialog(b)} className="h-9 rounded-full border border-input px-3 text-xs font-medium hover:bg-accent">Change</button>
          {!b.isHeadOffice && (
            <button type="button" disabled={busy} onClick={() => act(() => platform.updateBranch(code, b.code, { isActive: !b.isActive }), "Branch updated")} className="h-9 rounded-full border border-input px-3 text-xs font-medium hover:bg-accent">
              {b.isActive ? "Switch off" : "Switch on"}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Panel
      title="Branches"
      description={`${detail.usage?.branches ?? 0} of ${limitText(detail.limits?.branches)} active. The head office is made with the organisation. More than one branch needs the "More than one branch" feature.`}
      actions={<button type="button" onClick={() => setDialog("new")} className={primaryButton}>Add a branch</button>}
      bodyClassName="p-0"
    >
      {branches.loading && !branches.data && <Spinner label="Loading branches" />}
      {branches.error && <div className="p-4"><ErrorNote error={{ message: consoleError(branches.error) }} onRetry={branches.reload} /></div>}
      {rows.length > 0 && <DataTable caption="Branches" columns={columns} rows={rows} rowKey={(b) => b.code} />}
      {dialog && <BranchDialog code={code} existing={dialog === "new" ? null : dialog} run={act} onClose={() => setDialog(null)} />}
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------------- activity

export function ActivityTab({ code }) {
  const log = useAsync(() => platform.audit({ organisation: code, limit: 100 }), [code]);
  const rows = log.data?.rows || [];
  const columns = [
    { key: "at", header: "When", card: "meta", cell: (r) => formatDateTime(r.at) },
    { key: "action", header: "What", card: "primary", cell: (r) => <span className="font-medium">{String(r.action || "").replaceAll("_", " ").toLowerCase()}</span> },
    { key: "summary", header: "Detail", card: "title", cell: (r) => r.summary },
    { key: "by", header: "By", card: "meta", cell: (r) => r.by },
  ];
  if (!code) columns.splice(1, 0, { key: "org", header: "Organisation", card: "badge", cell: (r) => r.organisation || "-" });
  return (
    <Panel title="Activity" description={code ? "Every change made to this organisation from the console." : "Every change made from the console, across all organisations."} bodyClassName="p-0">
      {log.loading && !log.data && <Spinner label="Loading activity" />}
      {log.error && <div className="p-4"><ErrorNote error={{ message: consoleError(log.error) }} onRetry={log.reload} /></div>}
      {log.data && rows.length === 0 && <EmptyState title="Nothing yet" />}
      {rows.length > 0 && <DataTable caption="Activity" columns={columns} rows={rows} rowKey={(r) => r._id} />}
    </Panel>
  );
}
