import React, { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History, Plus } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { EmptyState, ErrorNote, Field, Modal, Panel, Pill, Select, Spinner, TextInput, useAsync, useToasts, DateInput } from "./kit";
import { currencies } from "../../lib/currencyApi";
import { RATE_SOURCES, currencyState, formatRate, sourceLabel, typedRate, validateCurrencyForm, validateRateForm, validateTolerance } from "../../lib/currencyForms";
import { cn } from "../../lib/utils";
import { CURRENCY, formatDate, formatDateTime, todayInput } from "../../utils/format";

// The currencies the company deals in and the exchange rate of each to the base currency (AED),
// day by day. The ledger is always kept in AED: a receipt or payment in a foreign currency is
// converted at the rate in force on its date, so a currency needs to be switched on AND to have a
// rate before it can be chosen on a voucher.

export default function Currencies() {
  const list = useAsync(() => currencies.list(), []);
  const tolerance = useAsync(() => currencies.settings().catch(() => null), []);
  const { notify, toastNode } = useToasts();
  const [adding, setAdding] = useState(false);
  const [ratesFor, setRatesFor] = useState(null);
  const [busy, setBusy] = useState("");

  const rows = useMemo(() => list.data || [], [list.data]);
  const base = rows.find((c) => c.isBase)?.code || CURRENCY;
  const ready = rows.filter((c) => currencyState(c).key === "ready").length;
  const missing = rows.filter((c) => currencyState(c).key === "norate").length;

  async function toggle(c) {
    setBusy(c.code);
    try {
      await currencies.update(c.code, { isActive: !c.isActive });
      notify(c.isActive ? `${c.code} switched off. Vouchers already made in it are unchanged.` : c.latestRate == null ? `${c.code} switched on. Add a rate before using it on a voucher.` : `${c.code} switched on`);
      list.reload();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Currencies</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            The currencies you deal in and their exchange rate to {base}, by date. Receipts and payments in a foreign currency are converted at the rate in force on their date; the ledger stays in {base}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" asChild><Link to="/currency-register">Currency register</Link></Button>
          <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" />Add currency</Button>
        </div>
      </div>

      {list.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard title="Base currency" count={base} subText="Every ledger amount is kept in it" tone="neutral" />
          <StatCard title="Ready for vouchers" count={String(ready)} subText="Switched on, with a rate" tone="teal" />
          <StatCard title="Need a rate" count={String(missing)} subText={missing ? "Switched on, but no rate yet" : "Every switched-on currency has a rate"} tone={missing ? "warning" : "neutral"} />
        </div>
      )}

      <Panel bodyClassName="p-0">
        {list.loading && !list.data && <Spinner label="Loading currencies" />}
        {list.error && <div className="p-5"><ErrorNote error={list.error} onRetry={list.reload} /></div>}
        {list.data && rows.length === 0 && <EmptyState title="No currencies yet" text="Add one with Add currency." />}
        {rows.length > 0 && (
          <div className="erp-scroll table-pin-first relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Currencies and their latest exchange rate to {base}</caption>
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2 text-start">Currency</th>
                  <th scope="col" className="px-3 py-2 text-start">Symbol</th>
                  <th scope="col" className="px-3 py-2 text-end">Latest rate</th>
                  <th scope="col" className="px-3 py-2 text-start">From</th>
                  <th scope="col" className="px-3 py-2 text-start">Status</th>
                  <th scope="col" className="px-3 py-2 text-center">Use</th>
                  <th scope="col" className="px-5 py-2 text-end"><span className="sr-only">Rates</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const state = currencyState(c);
                  return (
                    <tr key={c.code} className="border-t border-border hover:bg-accent/40">
                      <td className="px-5 py-2.5"><span className="font-mono text-xs font-semibold">{c.code}</span><span className="block font-medium">{c.name}</span></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.symbol}</td>
                      {c.isBase ? (
                        <td className="px-3 py-2.5 text-end text-muted-foreground" colSpan={2}>Base currency, always 1</td>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 text-end tabular-nums">{c.latestRate == null ? <span className="text-muted-foreground">-</span> : <><span className="font-medium">{formatRate(c.latestRate)}</span><span className="block text-xs text-muted-foreground">{base} per 1 {c.code}</span></>}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{c.latestRateDate ? formatDate(c.latestRateDate) : ""}</td>
                        </>
                      )}
                      <td className="px-3 py-2.5"><Pill tone={state.tone}>{state.label}</Pill></td>
                      <td className="px-3 py-2.5 text-center">
                        {c.isBase ? <span className="text-xs text-muted-foreground">Always on</span> : <Switch checked={c.isActive} label={`Use ${c.code}`} disabled={busy === c.code} onChange={() => toggle(c)} />}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-end">
                        {!c.isBase && <Button size="sm" variant="outline" aria-label={`Add rate for ${c.code}`} onClick={() => setRatesFor(c)}><History className="h-3.5 w-3.5" aria-hidden="true" />Add rate</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ToleranceSetting current={tolerance.data?.fxTolerancePercent} loading={tolerance.loading} onSaved={(v) => { tolerance.setData(v); notify("Allowed difference saved"); }} onError={(m) => notify(m, "error")} />

      {adding && <AddCurrencyModal existing={rows} onClose={() => setAdding(false)} onSaved={(code) => { setAdding(false); notify(`${code} added`); list.reload(); }} />}
      {ratesFor && <RatesModal currency={ratesFor} base={base} onClose={() => setRatesFor(null)} onChanged={(msg) => { notify(msg); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60",
        checked ? "border-primary bg-primary" : "border-input bg-secondary"
      )}
    >
      <span aria-hidden="true" className={cn("inline-block h-4 w-4 rounded-full bg-card shadow-sm transition-transform", checked ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1")} />
    </button>
  );
}

// How far a rate typed on a voucher may be from the rate on file before a reason is asked for.
function ToleranceSetting({ current, loading, onSaved, onError }) {
  const [value, setValue] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading && current === undefined) return null;
  if (current === undefined) return null; // the setting could not be read: say nothing rather than show a control that cannot work
  const shown = value ?? String(current);
  const changed = value !== null && Number(value) !== Number(current);

  async function save() {
    const problem = validateTolerance(shown);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const saved = await currencies.updateSettings({ fxTolerancePercent: Number(shown) });
      setValue(null);
      onSaved(saved);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="mt-5" title="Rate tolerance" description="A rate typed on a voucher that is further from the rate on file than this needs a reason.">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Allowed difference (%)" error={error} className="w-48">
          <TextInput inputMode="decimal" className="text-end tabular-nums" value={shown} onChange={(e) => { setValue(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
        </Field>
        <Button variant="outline" onClick={save} disabled={!changed || busy}>{busy ? "Saving…" : "Save"}</Button>
      </div>
    </Panel>
  );
}

function AddCurrencyModal({ existing, onClose, onSaved }) {
  const formId = useId();
  const [form, setForm] = useState({ code: "", name: "", symbol: "", decimals: "2" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    const e = validateCurrencyForm(form, existing);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const code = form.code.trim().toUpperCase();
      await currencies.create({ code, name: form.name.trim(), symbol: form.symbol.trim(), decimals: Number(form.decimals) });
      onSaved(code);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md" onClose={onClose} title="Add a currency" description="For a currency that is not in the list. It is switched on; add its rate next."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form={formId} disabled={busy}>{busy ? "Adding…" : "Add currency"}</Button></>}
    >
      <form id={formId} onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
        <ErrorNote error={problem} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required error={errors.code} hint="ISO 4217, three letters">
            <TextInput value={form.code} maxLength={3} className="font-mono uppercase" onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} data-autofocus />
          </Field>
          <Field label="Name" required error={errors.name}><TextInput value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Symbol" hint="Optional, for example JD"><TextInput value={form.symbol} maxLength={8} onChange={(e) => set({ symbol: e.target.value })} /></Field>
          <Field label="Decimal places" required error={errors.decimals} hint="Most currencies use 2; dinars use 3">
            <Select value={form.decimals} onChange={(e) => set({ decimals: e.target.value })}>{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function RatesModal({ currency, base, onClose, onChanged }) {
  const { code } = currency;
  const history = useAsync(() => currencies.rates(code), [code]);
  const [form, setForm] = useState({ rate: "", effectiveDate: todayInput(), source: "manual", note: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const rows = history.data || [];
  const today = todayInput();
  const inForce = rows.find((r) => r.effectiveDay <= today)?._id;
  const sameDay = rows.find((r) => r.effectiveDay === form.effectiveDate);

  async function save() {
    const e = validateRateForm(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await currencies.addRate(code, { rate: Number(form.rate), effectiveDate: form.effectiveDate, source: form.source, note: form.note.trim() || undefined });
      onChanged(saved.replaced ? `${code} rate for ${formatDate(saved.effectiveDay)} replaced (was ${formatRate(saved.previousRate)})` : `${code} rate saved from ${formatDate(saved.effectiveDay)}`);
      set({ rate: "", note: "" });
      history.reload();
    } catch (err) {
      setProblem(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg" onClose={onClose} title={`Exchange rates: ${code}`}
      description={`${currency.name}. ${base} per 1 ${code}. A rate applies from its date until the next one.`}
      footer={<Button onClick={onClose} data-autofocus>Close</Button>}
    >
      <div className="space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} aria-label={`New ${code} rate`} className="space-y-4">
          <ErrorNote error={problem} />
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr]">
            <Field label={`Rate (${base} per 1 ${code})`} required error={errors.rate}>
              <TextInput inputMode="decimal" className="text-end tabular-nums" placeholder="3.6725" value={form.rate} onChange={(e) => { const v = typedRate(e.target.value); if (v !== null) set({ rate: v }); }} data-autofocus />
            </Field>
            <Field label="Applies from" required error={errors.effectiveDate} hint={sameDay ? `A rate for this date exists (${formatRate(sameDay.rate)}). Saving replaces it; the old value stays in the audit log.` : undefined}>
              <DateInput value={form.effectiveDate} onChange={(e) => set({ effectiveDate: e.target.value })} />
            </Field>
            <Field label="Source">
              <Select value={form.source} onChange={(e) => set({ source: e.target.value })}>{RATE_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
            </Field>
          </div>
          <Field label="Note"><TextInput value={form.note} maxLength={200} placeholder="Optional" onChange={(e) => set({ note: e.target.value })} /></Field>
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save rate"}</Button></div>
        </form>

        <section aria-label={`${code} rate history`}>
          <h3 className="mb-2 text-sm font-medium text-foreground">Rate history</h3>
          {history.loading && !history.data && <Spinner label="Loading rates" />}
          {history.error && <ErrorNote error={history.error} onRetry={history.reload} />}
          {history.data && rows.length === 0 && <p className="rounded-xl border border-dashed border-input px-4 py-3 text-sm text-muted-foreground">No rate yet. {code} cannot be used on a voucher until one is added.</p>}
          {rows.length > 0 && (
            <div className="erp-scroll table-pin-first overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-2 text-start">From</th><th className="px-3 py-2 text-end">Rate</th><th className="px-3 py-2 text-start">Source</th><th className="px-3 py-2 text-start">Note</th><th className="px-4 py-2 text-start">Saved</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2">{formatDate(r.effectiveDay)}{r._id === inForce && <Pill tone="success" className="ms-2">In force</Pill>}{r.effectiveDay > today && <Pill tone="info" className="ms-2">Upcoming</Pill>}</td>
                      <td className="px-3 py-2 text-end font-medium tabular-nums">{formatRate(r.rate)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{sourceLabel(r.source)}</td>
                      <td className="max-w-48 truncate px-3 py-2 text-muted-foreground" title={r.note}>{r.note}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{formatDateTime(r.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
