import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "../ui/button";
import { ErrorNote, Field, Modal, Select, TextInput, Textarea } from "../accounting/kit";
import { cn } from "../../lib/utils";
import { can } from "../../lib/permissions";
import { access } from "../../lib/accessApi";
import { effectiveOf, emptyRole, holdsApprove, isLocked, keyFromName, rankChoices, roleFrom, rolePayload, serverField, serverMessage, ticksOf, toggle, toggleModule, validateRole } from "../../lib/accessForms";
import { limitText } from "../../lib/approvals";
import { orgCurrency } from "../../utils/orgLocale";

// One role: its name, where it ranks, and for every part of the product exactly what it may do. The boxes are the
// server's own catalogue (modules and their actions), so the editor never goes out of step with what the server enforces.
// Ticking Approve ticks and locks View (and whatever else it needs); a person may only tick what they hold themselves.
export default function RoleEditor({ catalogue, role, me, copyOf, onClose, onSaved }) {
  const isNew = !role;
  const readOnly = Boolean(role?.builtIn);
  const start = role || copyOf || null;
  const myRank = me?.role?.rank ?? 0;
  const ranks = rankChoices(myRank);
  // A new role starts at the usual rank where this person may give it, else at the highest rank they may give: a person
  // of rank 40 must not be offered 40 (the server refuses a role at or above its creator's own).
  const startRank = (wanted) => (ranks.find((r) => r.value <= wanted) || ranks[0])?.value ?? wanted;
  const [form, setForm] = useState(() => (role ? roleFrom(role) : copyOf ? { ...emptyRole(), name: `${copyOf.name} (copy)`, key: keyFromName(`${copyOf.name} copy`), description: copyOf.description || "", rank: startRank(Math.min(copyOf.rank, 75)), approvalLimit: roleFrom(copyOf).approvalLimit } : { ...emptyRole(), rank: startRank(emptyRole().rank) }));
  const [named, setNamed] = useState(() => ticksOf(catalogue, start));
  const [keyTouched, setKeyTouched] = useState(Boolean(role));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);

  const canGrant = (key) => can(me, key);
  const effective = useMemo(() => effectiveOf(catalogue, named), [catalogue, named]);
  // A limit means something only for a role that can approve; for any other it is not asked for (and is sent as none).
  const approves = holdsApprove(effective);
  // The person's own limit: a role they make cannot go above it, and cannot be left without one (the server enforces it and says so).
  const myLimit = me?.role?.approvalLimit ?? null;
  const errors = useMemo(() => validateRole(form, named, { isNew, myRank, canGrant, approves }), [form, named, isNew, myRank, me, approves]); // eslint-disable-line react-hooks/exhaustive-deps
  // a role being CHANGED keeps its own rank in the list even if it is not one of the standard steps; a new one never
  // offers a rank the person may not give
  const rankOptions = !isNew && !ranks.some((r) => r.value === Number(form.rank)) ? [{ value: Number(form.rank), label: `Rank ${form.rank}` }, ...ranks] : ranks;
  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  // The server's refusal belongs under the field it names (`details.field`, e.g. the approval limit); anything else is a note below.
  const refusedField = serverField(serverError);
  const show = (k) => (touched ? errors[k] : undefined) || (refusedField === k ? serverMessage(serverError) : undefined);
  // is the refused field on the screen? (if not, the refusal is a note below instead)
  const fieldShown = (refusedField === "approvalLimit" && approves) || ["name", "rank"].includes(refusedField) || (refusedField === "key" && isNew);

  const onName = (e) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, ...(isNew && !keyTouched ? { key: keyFromName(name) } : {}) }));
  };

  const save = async () => {
    setTouched(true);
    if (Object.keys(errors).length || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const body = rolePayload(form, named, { isNew, approves });
      const saved = isNew ? await access.createRole(body) : await access.updateRole(role.key, body);
      onSaved(saved, isNew);
    } catch (error) {
      setServerError(error);
    } finally {
      setBusy(false);
    }
  };

  const title = readOnly ? role.name : isNew ? (copyOf ? `New role, copied from ${copyOf.name}` : "New role") : `Change ${role.name}`;

  return (
    <Modal
      size="xl"
      title={title}
      description={readOnly ? "A built-in role cannot be changed. Copy it to make one of your own." : "Choose what people in this role may do. A person can only tick what they can do themselves."}
      onClose={onClose}
      footer={
        readOnly ? (
          <>
            <Button variant="outline" onClick={onClose}>Close</Button>
            {can(me, "users.manage") && <Button onClick={() => onSaved(null, false, role)}>Copy as a new role</Button>}
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : isNew ? "Create role" : "Save role"}</Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={show("name")}>
            <TextInput value={form.name} onChange={onName} disabled={readOnly} autoComplete="off" />
          </Field>
          <Field label="Rank" hint="A person can only manage people whose rank is below their own." error={show("rank")}>
            <Select value={String(form.rank)} onChange={setField("rank")} disabled={readOnly}>
              {(readOnly ? [{ value: form.rank, label: `Rank ${form.rank}` }] : rankOptions).map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
          {isNew && (
            <Field label="Key" hint="Letters, digits and underscores. It cannot be changed later." error={show("key")}>
              <TextInput value={form.key} onChange={(e) => { setKeyTouched(true); setForm((f) => ({ ...f, key: e.target.value.toLowerCase() })); }} autoComplete="off" />
            </Field>
          )}
          <Field label="Description" className={isNew ? undefined : "sm:col-span-2"}>
            <Textarea rows={2} value={form.description} onChange={setField("description")} disabled={readOnly} />
          </Field>
        </div>

        <div className="space-y-3" role="group" aria-label="Permissions">
          {catalogue.filter((m) => !m.automatic).map((m) => {
            const owned = m.actions.filter((a) => effective.has(a.key)).length;
            return (
              <section key={m.key} className="rounded-xl border border-border">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-2.5">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{m.label}</h3>
                    <p className="text-xs text-muted-foreground">{m.hint}</p>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{owned} of {m.actions.length}</span>
                      <button type="button" className="font-medium underline underline-offset-2" onClick={() => setNamed((n) => toggleModule(catalogue, n, m.key, true, canGrant))}>All</button>
                      <button type="button" className="font-medium underline underline-offset-2" onClick={() => setNamed((n) => toggleModule(catalogue, n, m.key, false))}>None</button>
                    </div>
                  )}
                </header>
                <ul className="grid gap-x-4 gap-y-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {m.actions.map((a) => {
                    const ticked = effective.has(a.key);
                    const locked = isLocked(catalogue, named, a.key);
                    const beyond = !canGrant(a.key);
                    const disabled = readOnly || locked || (beyond && !named.has(a.key));
                    const why = locked ? "Needed by something else that is ticked" : beyond ? "You cannot grant what you do not hold" : a.label;
                    return (
                      <li key={a.key}>
                        <label title={why} className={cn("flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-accent/60 lg:min-h-0", disabled && "cursor-default opacity-70 hover:bg-transparent")}>
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0"
                            checked={ticked}
                            disabled={disabled}
                            onChange={(e) => setNamed((n) => toggle(n, a.key, e.target.checked))}
                            aria-label={`${m.label}: ${a.short}`}
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 font-medium">
                              {a.short}
                              {locked && <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                            </span>
                            <span className="block text-xs text-muted-foreground">{a.label}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Anyone who can do more than look is also given the pick lists a form chooses from (customers, items, tax codes), so a form can be filled in.
          </p>
        </div>

        {approves && (
          <section className="rounded-xl border border-border p-4" aria-label="Approval">
            <Field
              label={`Approval limit (${orgCurrency()})`}
              hint={
                readOnly
                  ? undefined
                  : `The largest document someone in this role may approve. Leave empty for no limit.${myLimit !== null ? ` Your own limit is ${limitText(myLimit)}: a role you make cannot go above it, or have none.` : ""}`
              }
              error={show("approvalLimit")}
            >
              {readOnly ? (
                <TextInput value={form.approvalLimit === "" ? "No limit" : limitText(form.approvalLimit)} disabled readOnly />
              ) : (
                <TextInput
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="No limit"
                  value={form.approvalLimit}
                  onChange={(e) => {
                    if (refusedField === "approvalLimit") setServerError(null);
                    setField("approvalLimit")(e);
                  }}
                />
              )}
            </Field>
          </section>
        )}

        {show("permissions") && <ErrorNote error={{ message: errors.permissions }} />}
        {serverError && !fieldShown && <ErrorNote error={{ message: serverMessage(serverError) }} />}
      </div>
    </Modal>
  );
}

