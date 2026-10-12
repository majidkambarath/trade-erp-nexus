import React, { useState } from "react";
import { KeyRound, Plus, ShieldCheck, ShieldOff } from "lucide-react";
import { ConfirmDialog, DataTable, EmptyState, ErrorNote, Field, PageHeader, Panel, Pill, Spinner, TextInput, useAsync } from "../components/accounting/kit";
import { formatDate } from "../utils/format";
import { consoleError, platform } from "./platformApi";
import { suggestPassword, validateDeveloper } from "./platformForms";

// The people who can open the developer console. It is not an organisation's staff list: a console account
// belongs to no organisation and can reach every one of them.
//
// This screen exists because the console was a single point of failure. The routes behind it were there from
// the start, but nothing called them, so one lost phone with two-factor on - or one forgotten password - shut
// the console for good, with no way back in short of the database. Keep a second account.
export default function PlatformDevelopers({ user }) {
  const { data, loading, error, reload } = useAsync(() => platform.developers(), []);
  const [form, setForm] = useState(null); // null = closed; { id?, name, email, password }
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(null);
  const [made, setMade] = useState(null); // the password shown once, after it is created
  const [resetting, setResetting] = useState(null);

  const rows = data || [];
  const isNew = form && !form.id;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const open = (row) => {
    setFailed(null);
    setErrors({});
    setMade(null);
    // a new account is handed a password to pass on; an edit leaves the box empty and keeps the one it has
    setForm(row ? { id: row._id, name: row.name, email: row.email, password: "" } : { name: "", email: "", password: suggestPassword() });
  };

  const save = async () => {
    const found = validateDeveloper(form, { needPassword: Boolean(isNew) });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setFailed(null);
    try {
      if (isNew) {
        await platform.createDeveloper({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password });
        setMade({ email: form.email.trim().toLowerCase(), password: form.password });
      } else {
        await platform.updateDeveloper(form.id, { name: form.name.trim(), ...(form.password ? { password: form.password } : {}) });
      }
      setForm(null);
      await reload();
    } catch (e) {
      setFailed(consoleError(e));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (row, status) => {
    setFailed(null);
    try {
      await platform.updateDeveloper(row._id, { status });
      await reload();
    } catch (e) {
      setFailed(consoleError(e));
    }
  };

  const resetTwoFactor = async () => {
    const row = resetting;
    setResetting(null);
    setFailed(null);
    try {
      await platform.resetDeveloperTwoFactor(row._id);
      await reload();
    } catch (e) {
      setFailed(consoleError(e));
    }
  };

  const columns = [
    {
      key: "name",
      header: "Developer",
      card: "primary",
      cell: (u) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {u.name}
            {String(u._id) === String(user?._id || user?.id) && <span className="ms-2 text-xs font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", card: "badge", cell: (u) => <Pill tone={u.status === "active" ? "success" : "neutral"}>{u.status === "active" ? "Active" : "Switched off"}</Pill> },
    {
      key: "twoFactor",
      header: "Two-factor",
      card: "meta",
      cell: (u) =>
        u.twoFactor?.enabled ? (
          <span className="inline-flex items-center gap-1 text-sm"><ShieldCheck className="h-4 w-4 text-status-success" aria-hidden="true" /> On</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ShieldOff className="h-4 w-4" aria-hidden="true" /> Off</span>
        ),
    },
    { key: "lastLogin", header: "Last signed in", card: "meta", cell: (u) => (u.lastLogin ? formatDate(u.lastLogin) : "Never") },
    {
      key: "actions",
      header: "",
      card: "actions",
      cell: (u) => {
        const self = String(u._id) === String(user?._id || user?.id);
        return (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => open(u)} className="inline-flex h-11 items-center lg:h-10 rounded-full border border-border px-3 text-sm">Edit</button>
            {u.twoFactor?.enabled && !self && (
              <button type="button" onClick={() => setResetting(u)} className="inline-flex h-11 items-center lg:h-10 gap-1 rounded-full border border-border px-3 text-sm">
                <KeyRound className="h-4 w-4" aria-hidden="true" /> Reset two-factor
              </button>
            )}
            {!self && (
              <button type="button" onClick={() => setStatus(u, u.status === "active" ? "inactive" : "active")} className="inline-flex h-11 items-center lg:h-10 rounded-full border border-border px-3 text-sm">
                {u.status === "active" ? "Switch off" : "Switch on"}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Developers"
        description="Who can open this console. A console account belongs to no organisation and can reach every one, so keep at least two: with two-factor on and no second account, a lost phone locks everybody out."
        actions={
          <button type="button" data-shortcut="new" onClick={() => open(null)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground lg:h-10">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New developer
          </button>
        }
      />

      {failed && <div className="mb-4"><ErrorNote error={failed} /></div>}

      {made && (
        <Panel className="mb-4" title="Pass this on now">
          <p className="text-sm text-muted-foreground">It is not stored anywhere and will not be shown again. {made.email} should change it after signing in.</p>
          <p className="mt-2 select-all font-mono text-base text-foreground">{made.password}</p>
          <button type="button" onClick={() => setMade(null)} className="mt-3 inline-flex h-11 items-center lg:h-10 rounded-full border border-border px-3 text-sm">Done</button>
        </Panel>
      )}

      {form && (
        <Panel className="mb-4" title={isNew ? "New developer" : `Edit ${form.email}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={errors.name}>
              <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Email" error={errors.email} hint={isNew ? undefined : "The sign-in address cannot be changed here"}>
              <TextInput type="email" value={form.email} disabled={!isNew} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label={isNew ? "Password" : "New password"} error={errors.password} hint={isNew ? "Twelve characters or more, letters and digits" : "Leave empty to keep the current password"}>
              <TextInput value={form.password} onChange={(e) => set({ password: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" data-shortcut="save" disabled={saving} onClick={save} className="inline-flex h-11 items-center lg:h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {saving ? "Saving..." : isNew ? "Create developer" : "Save"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="inline-flex h-11 items-center lg:h-10 rounded-full border border-border px-4 text-sm">Cancel</button>
            {isNew && (
              <button type="button" onClick={() => set({ password: suggestPassword() })} className="inline-flex h-11 items-center lg:h-10 rounded-full border border-border px-4 text-sm">Suggest another</button>
            )}
          </div>
        </Panel>
      )}

      <Panel bodyClassName="p-0">
        {error && <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div>}
        {loading && !data && <Spinner label="Loading developers" />}
        {data && rows.length === 0 && <EmptyState title="No developers yet" text="Create one so this console is not reachable by a single person." />}
        {rows.length > 0 && <DataTable caption="Developers" columns={columns} rows={rows} rowKey={(u) => u._id} />}
      </Panel>

      {resetting && (
        <ConfirmDialog
          title="Reset two-factor?"
          text={`${resetting.name} will sign in with their password alone until they set it up again. Do this only when you know who is asking.`}
          confirmLabel="Reset two-factor"
          danger
          onConfirm={resetTwoFactor}
          onClose={() => setResetting(null)}
        />
      )}
    </>
  );
}
