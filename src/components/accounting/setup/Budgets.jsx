import React, { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { budgetPayload, lineTotal, monthLabel, spreadEvenly } from "../../../lib/budgets";
import { formatNumber, CURRENCY } from "../../../utils/format";
import { Button } from "../../ui/button";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import { AmountInput, DataTable, EmptyState, ErrorNote, Field, Panel, Pill, SearchSelect, Select, Spinner, TextInput, useAsync } from "../kit";
import { CostCentrePicker, useCostCentres } from "../CostCentreSelect";

const money = (n) => formatNumber(n, 2);

// Budgets: an amount per income or expense account per month of a fiscal year, for the whole business or one cost centre.
// Compared with what was posted on Ledger reports > Budget vs actual.
export default function Budgets({ notify }) {
  const list = useAsync(() => accounting.budgets(), []);
  const [editing, setEditing] = useState(null); // {} for a new one, { id } to change one
  const { canAny } = useOrganisation();
  const canManage = canAny("accounts.manage");

  if (editing) {
    return <BudgetEditor id={editing.id} onClose={() => setEditing(null)} onSaved={(m) => { setEditing(null); notify(m); list.reload(); }} />;
  }
  const rows = list.data || [];
  return (
    <Panel
      title="Budgets" bodyClassName="p-0"
      description="Set what you expect to earn and spend each month of a fiscal year, for the whole business or one cost centre, then compare it with the books on Ledger reports > Budget vs actual."
      actions={<Can permission="accounts.manage"><Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" aria-hidden="true" />New budget</Button></Can>}
    >
      {list.loading && !list.data && <Spinner />}
      {list.error && <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>}
      {list.data?.length === 0 && <EmptyState title="No budgets yet" text={canManage ? "Start one for this fiscal year. You can begin from last year's figures." : "No budget has been set up yet."} />}
      {rows.length > 0 && (
        <DataTable
          caption="Budgets"
          rows={rows}
          rowKey={(b) => b._id}
          onRowClick={canManage ? (b) => setEditing({ id: b._id }) : undefined}
          columns={[
            { key: "name", header: "Budget", card: "primary", className: "font-medium", cell: (b) => b.name },
            { key: "year", header: "Fiscal year", card: "title", cell: (b) => b.year?.code || "—" },
            { key: "centre", header: "Cost centre", card: "meta", cell: (b) => (b.costCentre ? `${b.costCentre.code} · ${b.costCentre.name}` : <Pill>Whole business</Pill>) },
            { key: "income", header: `Income (${CURRENCY})`, align: "end", card: "amount", className: "tabular-nums", cell: (b) => money(b.totals?.income || 0) },
            { key: "expense", header: `Expenses (${CURRENCY})`, align: "end", card: "meta", className: "tabular-nums", cell: (b) => money(b.totals?.expense || 0) },
            ...(canManage
              ? [{ key: "edit", header: <span className="sr-only">Edit</span>, align: "end", card: "actions", cell: (b) => <button type="button" onClick={() => setEditing({ id: b._id })} aria-label={`Edit ${b.name}`} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent lg:h-8 lg:w-8"><Pencil className="h-4 w-4" aria-hidden="true" /></button> }]
              : []),
          ]}
        />
      )}
    </Panel>
  );
}

// The year's total of a line. Typing a total here spreads it evenly over the months (to the fils, the last month taking what is
// left); typing in a month changes the total. What is being typed is kept while the box has the focus, so "1200." is not cut short.
function YearTotal({ name, total, onSpread }) {
  const [draft, setDraft] = useState(null);
  return (
    <AmountInput
      min="0" value={draft ?? (total ? String(total) : "")} aria-label={`${name}, year's total`} className="text-end font-medium tabular-nums"
      onChange={(e) => { setDraft(e.target.value); onSpread(Number(e.target.value) || 0); }}
      onBlur={() => setDraft(null)}
    />
  );
}

// The editor: a grid of accounts by month. It is a section of the page, not a dialog, because the grid scrolls sideways and a
// dialog on a phone has nowhere to scroll to.
export function BudgetEditor({ id, onClose, onSaved }) {
  const years = useAsync(() => accounting.fiscalYears(), []);
  const accounts = useAsync(() => accounting.postableAccounts(), []);
  const existing = useAsync(() => (id ? accounting.budget(id) : Promise.resolve(null)), [id]);
  const cc = useCostCentres();
  const [form, setForm] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");

  // the form is filled once what it starts from has arrived
  const yearList = useMemo(() => (Array.isArray(years.data) ? years.data : years.data?.years || []), [years.data]);
  if (!form && yearList.length && (!id || existing.data)) {
    const b = existing.data;
    const open = yearList.find((y) => y.status !== "closed") || yearList[0];
    setForm({
      name: b?.name || "", fiscalYearId: String(b?.fiscalYearId || open?._id || ""), costCentreId: b?.costCentreId ? String(b.costCentreId) : "", notes: b?.notes || "",
      lines: (b?.lines || []).map((l) => ({ accountId: String(l.accountId), amounts: Object.fromEntries(Object.entries(l.amounts || {}).map(([k, v]) => [k, String(v)])) })),
    });
  }

  const year = yearList.find((y) => String(y._id) === form?.fiscalYearId);
  const months = year?.months || [];
  const accountList = (accounts.data || []).filter((a) => a.category === "INCOME" || a.category === "EXPENSE");
  const byId = new Map(accountList.map((a) => [String(a._id), a]));
  const used = new Set((form?.lines || []).map((l) => l.accountId));
  const options = accountList.filter((a) => !used.has(String(a._id))).map((a) => ({ value: String(a._id), label: `${a.accountCode} · ${a.accountName}`, hint: a.category === "INCOME" ? "Income" : "Expense" }));

  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  const setAmount = (i, key, v) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, amounts: { ...l.amounts, [key]: v } } : l)) }));

  async function fromLastYear() {
    setProblem(null);
    try {
      const s = await accounting.suggestBudget({ fiscalYearId: form.fiscalYearId, ...(form.costCentreId ? { costCentreId: form.costCentreId } : {}) });
      if (!s?.lines?.length) {
        setProblem({ message: s?.from ? `Nothing was earned or spent in ${s.from} to start from.` : "There is no earlier fiscal year to start from." });
        return;
      }
      setForm((f) => ({ ...f, lines: s.lines.map((l) => ({ accountId: String(l.accountId), amounts: Object.fromEntries(Object.entries(l.amounts).map(([k, v]) => [k, String(v)])) })) }));
    } catch (err) {
      setProblem(err);
    }
  }

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      const body = budgetPayload(form);
      const saved = id ? await accounting.updateBudget(id, body) : await accounting.createBudget(body);
      onSaved(`${saved.name} saved`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const gone = await accounting.removeBudget(id);
      onSaved(`${gone.name} deleted`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  const loadError = years.error || accounts.error || existing.error;
  const totals = (form?.lines || []).reduce((t, l) => {
    const cat = byId.get(l.accountId)?.category;
    if (cat === "INCOME") t.income += lineTotal(l.amounts);
    if (cat === "EXPENSE") t.expense += lineTotal(l.amounts);
    return t;
  }, { income: 0, expense: 0 });

  return (
    <Panel
      title={id ? `Edit ${existing.data?.name || "budget"}` : "New budget"}
      description="Type an amount for each month, or a year's total to spread it evenly over the months. Income and expense accounts only."
      actions={<Button size="sm" variant="outline" onClick={onClose}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to budgets</Button>}
    >
      {!form && !loadError && <Spinner />}
      <ErrorNote error={loadError || problem} />
      {form && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Fiscal year" required>
              <Select value={form.fiscalYearId} onChange={(e) => setForm((f) => ({ ...f, fiscalYearId: e.target.value }))} disabled={Boolean(id)}>
                {yearList.map((y) => <option key={y._id} value={y._id}>{y.code}</option>)}
              </Select>
            </Field>
            {cc.uses ? (
              <Field label="Cost centre" hint="Empty: the whole business">
                <CostCentrePicker value={form.costCentreId} onChange={(v) => setForm((f) => ({ ...f, costCentreId: v }))} choices={cc.choices([form.costCentreId])} emptyLabel="Whole business" disabled={Boolean(id)} aria-label="Cost centre" />
              </Field>
            ) : <div className="hidden sm:block" />}
            <Field label="Name" hint="Optional"><TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={100} placeholder={`Budget ${year?.code || ""}`} /></Field>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:max-w-md">
              <Field label="Add an account">
                <SearchSelect value={adding} onChange={(v) => { if (!v) return; setForm((f) => ({ ...f, lines: [...f.lines, { accountId: v, amounts: {} }] })); setAdding(""); }} options={options} placeholder="Search income or expense accounts…" noOptionsText="No account matches" loading={accounts.loading} />
              </Field>
            </div>
            {!id && <Button type="button" variant="outline" onClick={fromLastYear}>Start from last year's actuals</Button>}
          </div>

          {form.lines.length === 0 ? (
            <EmptyState title="No accounts on this budget yet" text="Add the income and expense accounts you want to plan." />
          ) : (
            <div className="erp-scroll table-pin-first overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">Budget by month</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="min-w-56 px-3 py-2 text-start font-medium">Account</th>
                    {months.map((m) => <th key={m.key} scope="col" className="min-w-24 px-2 py-2 text-end font-medium">{monthLabel(m.key)}</th>)}
                    <th scope="col" className="min-w-36 px-3 py-2 text-end font-medium">Year ({CURRENCY}), spread evenly</th>
                    <th scope="col"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((l, i) => {
                    const a = byId.get(l.accountId);
                    const name = a ? `${a.accountCode} · ${a.accountName}` : "Account";
                    return (
                      <tr key={l.accountId} className="border-b border-border">
                        <th scope="row" className="px-3 py-1.5 text-start font-normal">
                          <span className="block font-medium">{name}</span>
                          <span className="text-xs text-muted-foreground">{a?.category === "INCOME" ? "Income" : "Expense"}</span>
                        </th>
                        {months.map((m) => (
                          <td key={m.key} className="px-1 py-1.5">
                            <AmountInput min="0" value={l.amounts[m.key] ?? ""} onChange={(e) => setAmount(i, m.key, e.target.value)} aria-label={`${name}, ${monthLabel(m.key)}`} className="text-end tabular-nums" />
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          <YearTotal name={name} total={lineTotal(l.amounts)} onSpread={(v) => setLine(i, { amounts: spreadEvenly(v, months) })} />
                        </td>
                        <td className="px-1 py-1.5">
                          <button type="button" aria-label={`Remove ${name}`} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger lg:h-8 lg:w-8"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span>Income <strong className="tabular-nums">{money(totals.income)}</strong></span>
            <span>Expenses <strong className="tabular-nums">{money(totals.expense)}</strong></span>
            <span>Result <strong className="tabular-nums">{money(totals.income - totals.expense)}</strong> {CURRENCY}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy || !form.fiscalYearId} data-shortcut="save">{busy ? "Saving…" : "Save budget"}</Button>
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            {id && <Button variant="outline" className="ms-auto" onClick={remove} disabled={busy}>Delete budget</Button>}
          </div>
        </div>
      )}
    </Panel>
  );
}
