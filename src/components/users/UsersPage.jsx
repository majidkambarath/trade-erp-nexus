import React, { useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Pencil, Plus, ShieldOff, Trash2, UserPlus } from "lucide-react";
import { Button } from "../ui/button";
import { ConfirmDialog, DataTable, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Select, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import { cn } from "../../lib/utils";
import { formatDateTime } from "../../utils/format";
import { access } from "../../lib/accessApi";
import { can } from "../../lib/permissions";
import { emptyPerson, mayChange, newPersonPayload, personChanges, personFrom, rolesToGive, summarise, validatePerson } from "../../lib/accessForms";
import { blankRow, changed, payloadFromRows, rowsFromPerson, serverMessage, summaryOf, validateRows } from "../../lib/branchRoleForms";
import { useOrganisation } from "../shell/OrganisationContext";
import RoleEditor from "./RoleEditor";

const TABS = [
  { id: "people", label: "People" },
  { id: "roles", label: "Roles" },
];

const BRANCH_ROLES_HELP =
  "In these branches this person holds the role chosen here instead of their own. A person who belongs to another branch can work in a branch only if it is listed here. Someone with a role like this works in one branch at a time.";

// Adding or changing a person: their name, the role they hold, the branch they work from, and any branch where they hold a
// different role. A person is only offered the roles the one adding them may give (those below their own), and nobody changes
// their own role (or their own branch roles) here.
function PersonDialog({ person, roles, branches, me, onClose, onSaved }) {
  const isNew = !person;
  const self = person && String(person.id) === String(me?.id);
  const [form, setForm] = useState(() => (person ? personFrom(person) : emptyPerson()));
  const [rows, setRows] = useState(() => rowsFromPerson(person));
  const helpId = useId();
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const givable = useMemo(() => {
    const list = rolesToGive(roles, me?.role?.rank);
    // someone's current role stays in the list even if it is one the editor could not give (it is just not changed)
    return person && !list.some((r) => r.key === person.role.key) ? [{ key: person.role.key, name: person.role.name || person.role.key }, ...list] : list;
  }, [roles, me, person]);
  // the roles a branch row may name: the same ones the Role box offers (below the person's own rank), plus the one a row
  // already holds, so an existing row always shows what it is
  const grantable = useMemo(() => rolesToGive(roles, me?.role?.rank), [roles, me]);
  const roleChoices = (current) => {
    if (!current || grantable.some((r) => r.key === current)) return grantable;
    const held = person?.branchRoles?.find((b) => b.role?.key === current)?.role;
    const known = (roles || []).find((r) => r.key === current);
    return [{ key: current, name: held?.name || known?.name || current }, ...grantable];
  };
  // the branches a row may name: the organisation's active branches (what the status lists for this person), plus any a row
  // already holds, so one that has since been switched off still shows by its code and can be taken away
  const branchOptions = useMemo(() => {
    const list = branches?.length ? branches : [{ code: "main", name: "Head office" }];
    const extra = rowsFromPerson(person).filter((r) => r.branchId && !list.some((b) => b.code === r.branchId)).map((r) => ({ code: r.branchId, name: r.branchId }));
    return [...list, ...extra];
  }, [branches, person]);
  const errors = validatePerson(form, { isNew });
  const show = (k) => (touched ? errors[k] : undefined);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const locked = Boolean(self);
  // Nothing to choose in an organisation with one branch (unless the person already has rows, which must stay visible).
  const showBranchRoles = branchOptions.length > 1 || rowsFromPerson(person).length > 0;
  const rowErrors = locked || !showBranchRoles ? {} : validateRows(rows, { branches: branchOptions });
  const setRow = (i, k) => (e) => setRows((list) => list.map((r, at) => (at === i ? { ...r, [k]: e.target.value } : r)));

  const save = async () => {
    setTouched(true);
    if (Object.keys(errors).length || Object.keys(rowErrors).length || busy) return;
    // branch roles travel only when the section changed (and never from someone changing their own account)
    const withBranchRoles = !locked && showBranchRoles && changed(rows, person);
    const changes = isNew ? null : personChanges(form, person);
    if (!isNew && withBranchRoles) changes.branchRoles = payloadFromRows(rows);
    if (!isNew && Object.keys(changes).length === 0) return onClose();
    const body = isNew ? { ...newPersonPayload(form), ...(withBranchRoles ? { branchRoles: payloadFromRows(rows) } : {}) } : changes;
    setBusy(true);
    setError(null);
    try {
      const saved = isNew ? await access.createUser(body) : await access.updateUser(person.id, body);
      onSaved(saved, isNew);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Add a person" : `Change ${person.name}`}
      description={isNew ? "They sign in with the email and password you set here." : self ? "You can change your own name here. Another administrator changes your role." : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : isNew ? "Add person" : "Save"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required error={show("name")}><TextInput value={form.name} onChange={set("name")} autoComplete="off" /></Field>
        <Field label="Email" required={isNew} error={show("email")}><TextInput type="email" value={form.email} onChange={set("email")} disabled={!isNew} autoComplete="off" /></Field>
        <Field label={isNew ? "Password" : "New password"} required={isNew} hint={isNew ? "At least 8 characters." : "Leave blank to keep the current one."} error={show("password")}>
          <TextInput type="text" value={form.password} onChange={set("password")} disabled={locked} autoComplete="new-password" />
        </Field>
        <Field label="Role" required error={show("role")} hint={givable.find((r) => r.key === form.role)?.description}>
          <Select value={form.role} onChange={set("role")} disabled={locked}>
            {givable.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Branch">
          <Select value={form.branchId} onChange={set("branchId")} disabled={locked}>
            {(branches?.length ? branches : [{ code: "main", name: "Head office" }]).map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </Select>
        </Field>
        {showBranchRoles && (
          <fieldset className="space-y-3 rounded-xl border border-border p-3 sm:p-4" aria-describedby={helpId}>
            <legend className="px-1 text-sm font-medium text-foreground">Different role in a branch</legend>
            <p id={helpId} className="text-xs text-muted-foreground">{BRANCH_ROLES_HELP}</p>
            {rows.length === 0 && locked && <p className="text-sm text-muted-foreground">None.</p>}
            {rows.map((row, i) => (
              <div key={i} className="space-y-1">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Select aria-label={`Row ${i + 1}: branch`} aria-invalid={touched && rowErrors[i] ? true : undefined} value={row.branchId} onChange={setRow(i, "branchId")} disabled={locked}>
                    <option value="">Choose a branch</option>
                    {branchOptions.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </Select>
                  <Select aria-label={`Row ${i + 1}: role`} aria-invalid={touched && rowErrors[i] ? true : undefined} value={row.role} onChange={setRow(i, "role")} disabled={locked}>
                    <option value="">Choose a role</option>
                    {roleChoices(row.role).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                  </Select>
                  {!locked && (
                    <Button type="button" variant="ghost" size="icon" className="justify-self-end" aria-label={`Remove row ${i + 1}`} onClick={() => setRows((list) => list.filter((_, at) => at !== i))}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                {touched && rowErrors[i] && <p role="alert" className="text-xs font-medium text-status-danger">{rowErrors[i]}</p>}
              </div>
            ))}
            {!locked && (
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((list) => [...list, blankRow()])}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />Add a branch
              </Button>
            )}
          </fieldset>
        )}
        {!isNew && !locked && (
          <Field label="Access">
            <Select value={form.status} onChange={set("status")}>
              <option value="active">Can sign in</option>
              <option value="inactive">Switched off</option>
            </Select>
          </Field>
        )}
        {error && <ErrorNote error={{ message: serverMessage(error) }} />}
      </div>
    </Modal>
  );
}

function People({ users, roles, branches, me, notify, reload, canManage }) {
  const [dialog, setDialog] = useState(null);
  const [resetting, setResetting] = useState(null); // the person whose two-factor is about to be cleared
  const [resetBusy, setResetBusy] = useState(false);
  const rows = users.data || [];
  const myRank = me?.role?.rank ?? 0;

  const columns = [
    {
      key: "name", header: "Person", card: "primary",
      cell: (u) => (
        <div className="min-w-0">
          <p className="font-medium">{u.name}{String(u.id) === String(me?.id) && <span className="ms-2 text-xs font-normal text-muted-foreground">(you)</span>}</p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
        </div>
      ),
    },
    {
      key: "role", header: "Role", card: "title",
      cell: (u) => {
        const own = (u.role.name || u.role.key) + (u.role.active ? "" : " (switched off)");
        const elsewhere = summaryOf(u, branches); // "Viewer in Sharjah": the role they hold instead of their own in a branch
        if (!elsewhere) return own;
        // block spans, not divs or paragraphs: a card draws this cell inside a <p> that truncates to one line
        return (
          <span className="block min-w-0 whitespace-normal">
            <span className="block">{own}</span>
            <span className="block text-xs font-normal text-muted-foreground">{elsewhere}</span>
          </span>
        );
      },
    },
    { key: "branch", header: "Branch", card: "meta", cell: (u) => branches?.find((b) => b.code === u.branchId)?.name || u.branchId },
    { key: "last", header: "Last signed in", card: "meta", cell: (u) => (u.lastLogin ? formatDateTime(u.lastLogin) : "Never") },
    {
      key: "twoFactor", header: "Two-factor", card: "meta",
      cell: (u) => <Pill tone={u.twoFactorEnabled ? "success" : "neutral"}>{u.twoFactorEnabled ? "2FA on" : "2FA off"}</Pill>,
    },
    { key: "status", header: "Access", card: "badge", cell: (u) => <Pill tone={u.isActive && u.status === "active" ? "success" : "neutral"}>{u.isActive && u.status === "active" ? "Can sign in" : "Switched off"}</Pill> },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, card: "actions", align: "end",
      cell: (u) => {
        const self = String(u.id) === String(me?.id);
        const allowed = canManage && (self || mayChange(myRank, u.role.rank));
        if (!allowed) return null;
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" aria-label={`Change ${u.name}`} onClick={() => setDialog(u)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Change</Button>
            {/* hidden, not disabled, unless the person may reset it: an administrator below this one's rank, never one's own */}
            {!self && u.twoFactorEnabled && (
              <Button size="sm" variant="ghost" aria-label={`Reset two-factor for ${u.name}`} onClick={() => setResetting(u)}><ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />Reset two-factor</Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Panel
      title="People"
      description={`${rows.filter((u) => u.isActive).length} can sign in`}
      actions={canManage && <Button onClick={() => setDialog("new")}><UserPlus className="h-4 w-4" aria-hidden="true" />Add a person</Button>}
      bodyClassName="p-0"
    >
      {users.loading && !users.data && <Spinner label="Loading people" />}
      {users.error && <div className="p-4"><ErrorNote error={users.error} onRetry={users.reload} /></div>}
      {users.data && rows.length === 0 && <EmptyState title="Nobody yet" text="Add the first person." />}
      {rows.length > 0 && <DataTable caption="People" columns={columns} rows={rows} rowKey={(u) => u.id} />}
      {resetting && (
        <ConfirmDialog
          title={`Reset two-factor for ${resetting.name}?`}
          text="They will be signed out everywhere and can sign in with their password alone until they set it up again. Do this when they have lost their phone and their recovery codes."
          confirmLabel="Reset two-factor"
          danger
          busy={resetBusy}
          onClose={() => setResetting(null)}
          onConfirm={async () => {
            setResetBusy(true);
            try {
              await access.resetTwoFactor(resetting.id);
              notify(`Two-factor reset for ${resetting.name}`);
              setResetting(null);
              reload();
            } catch (error) {
              notify(error?.response?.data?.message || error.message, "error");
              setResetting(null);
            } finally {
              setResetBusy(false);
            }
          }}
        />
      )}
      {dialog && (
        <PersonDialog
          person={dialog === "new" ? null : dialog}
          roles={roles || []}
          branches={branches}
          me={me}
          onClose={() => setDialog(null)}
          onSaved={(saved, isNew) => {
            setDialog(null);
            notify(isNew ? `${saved.name} added` : `${saved.name} saved`);
            reload();
          }}
        />
      )}
    </Panel>
  );
}

function Roles({ rolesQuery, me, notify, reload, canManage }) {
  const [editing, setEditing] = useState(null); // { role } to view or change, { copy } for a new one from an old one, {} for a fresh one
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const data = rolesQuery.data;
  const myRank = me?.role?.rank ?? 0;

  const remove = async () => {
    setBusy(true);
    try {
      await access.removeRole(removing.key);
      notify(`${removing.name} removed`);
      setRemoving(null);
      reload();
    } catch (error) {
      notify(error.message, "error");
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: "name", header: "Role", card: "primary",
      cell: (r) => (
        // whitespace-normal: a card's headline slot truncates to one line, and the description is a sentence
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium">{r.name}</p>
          {r.description && <p className="text-xs font-normal text-muted-foreground">{r.description}</p>}
        </div>
      ),
    },
    { key: "kind", header: "Kind", card: "badge", cell: (r) => <Pill tone={r.builtIn ? "info" : r.isActive ? "neutral" : "warning"}>{r.builtIn ? "Built in" : r.isActive ? "Your own" : "Switched off"}</Pill> },
    { key: "grants", header: "Can do", card: "title", cell: (r) => summarise(r) },
    { key: "rank", header: "Rank", card: "meta", cell: (r) => r.rank },
    { key: "people", header: "People", card: "meta", cell: (r) => `${r.people} ${r.people === 1 ? "person" : "people"}` },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, card: "actions", align: "end",
      cell: (r) => {
        const mine = canManage && !r.builtIn && (myRank >= 100 || r.rank < myRank);
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing({ role: r })}>{mine ? <><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Change</> : "View"}</Button>
            {canManage && <Button size="sm" variant="ghost" onClick={() => setEditing({ copy: r })}><Copy className="h-3.5 w-3.5" aria-hidden="true" />Copy</Button>}
            {mine && <Button size="sm" variant="ghost" disabled={r.people > 0} title={r.people > 0 ? "People still hold this role" : "Remove this role"} onClick={() => setRemoving(r)} aria-label={`Remove ${r.name}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>}
          </div>
        );
      },
    },
  ];

  return (
    <Panel
      title="Roles"
      description="A role is what a person may do. The built-in ones cannot be changed; copy one, or start fresh, to make a role of your own."
      actions={canManage && <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" aria-hidden="true" />New role</Button>}
      bodyClassName="p-0"
    >
      {rolesQuery.loading && !data && <Spinner label="Loading roles" />}
      {rolesQuery.error && <div className="p-4"><ErrorNote error={rolesQuery.error} onRetry={rolesQuery.reload} /></div>}
      {data && <DataTable caption="Roles" columns={columns} rows={data.roles} rowKey={(r) => r.key} />}
      {editing && data && (
        <RoleEditor
          catalogue={data.catalogue}
          role={editing.role}
          copyOf={editing.copy}
          me={me}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew, copyFrom) => {
            if (copyFrom) return setEditing({ copy: copyFrom }); // "Copy as a new role" from a read-only built-in
            setEditing(null);
            notify(isNew ? `${saved.name} created` : `${saved.name} saved`);
            reload();
          }}
        />
      )}
      {removing && <ConfirmDialog title={`Remove ${removing.name}?`} text="Nobody holds it. This cannot be undone." confirmLabel="Remove role" danger busy={busy} onConfirm={remove} onClose={() => setRemoving(null)} />}
    </Panel>
  );
}

// The people who sign in to this organisation, and the roles that decide what each may do. Seeing it needs users.view;
// adding people and making roles needs users.manage, and then only for people and roles below the person's own rank.
export default function UsersPage() {
  const { me, status } = useOrganisation();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "people";
  const { notify, toastNode } = useToasts();
  const users = useAsync(() => access.users(), []);
  const roles = useAsync(() => access.roles(), []);
  const canManage = can(me, "users.manage");
  const reloadAll = () => Promise.all([users.reload(), roles.reload()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:py-6 lg:px-6">
      <PageHeader title="Users and roles" description="Who can sign in, and what each person may do." />
      <div role="tablist" aria-label="Users and roles" className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setParams(t.id === "people" ? {} : { tab: t.id }, { replace: true })}
            className={cn("h-11 border-b-2 px-4 text-sm font-medium transition-colors lg:h-10", t.id === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "people" ? (
        <People users={users} roles={roles.data?.roles} branches={status?.branches} me={me} notify={notify} reload={reloadAll} canManage={canManage} />
      ) : (
        <Roles rolesQuery={roles} me={me} notify={notify} reload={reloadAll} canManage={canManage} />
      )}
      {toastNode}
    </div>
  );
}
