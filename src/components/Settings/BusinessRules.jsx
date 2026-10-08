import React, { useEffect, useState } from "react";
import { accounting } from "../../lib/accountingApi";
import { Button } from "../ui/button";
import Guarded from "../shell/Guarded";
import { ErrorNote, Field, Panel, Select, Spinner, TextInput, errorMessage, useAsync } from "../accounting/kit";

const MODES = [
  { value: "off", label: "Off", help: "No credit check. Approvals are never held up." },
  { value: "warn", label: "Warn", help: "Approving a sale that goes over the limit asks for confirmation first. The confirmation is recorded." },
  { value: "block", label: "Block", help: "A sale that goes over the limit, or to a customer with a seriously overdue invoice, cannot be approved." },
];

// Business rules: credit control, returns and the company's tax identity. They live in Settings
// because they are the company's policy, not part of the ledger's structure (Accounting setup).
// `companyDefaults` is the saved company profile; it fills any tax-identity field still empty, so
// nothing is typed twice.
export default function BusinessRules({ notify, companyDefaults }) {
  const { data, loading, error, reload } = useAsync(() => accounting.settings(), []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  return (
    <Guarded permission="settings.manage" what="the business rules">
      <CreditControl settings={data} notify={notify} onSaved={reload} />
      <Returns settings={data} notify={notify} onSaved={reload} />
      <TaxIdentity settings={data} defaults={companyDefaults} notify={notify} onSaved={reload} />
    </Guarded>
  );
}

function useSection(save, notify, onSaved, message) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return {
    busy, error,
    submit: async (ev) => {
      ev.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await save();
        notify(message);
        onSaved();
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    },
  };
}

function CreditControl({ settings, notify, onSaved }) {
  const [mode, setMode] = useState(settings.creditControl.mode);
  const [days, setDays] = useState(String(settings.creditControl.overdueBlockDays));
  const s = useSection(() => accounting.saveSettings({ creditControl: { mode, overdueBlockDays: Number(days || 0) } }), notify, onSaved, "Credit control saved");
  return (
    <Panel title="Credit control" description="Checked when a sale is approved. Returns, payments and purchases are never held up: a document that reduces what a customer owes is always allowed.">
      <form onSubmit={s.submit} className="grid gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">When a sale would exceed the customer's credit limit</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <label key={m.value} className={`cursor-pointer rounded-xl border p-3 text-sm transition-colors ${mode === m.value ? "border-ring bg-accent" : "border-border hover:bg-accent/50"}`}>
                <span className="flex items-center gap-2 font-semibold"><input type="radio" name="credit-mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="accent-[var(--color-primary)]" />{m.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{m.help}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Also stop sales to customers with an invoice overdue by more than (days)" hint="0 ignores overdue invoices. Overdue is measured from the due date, set by the customer's payment terms." className="max-w-xl">
          <TextInput type="number" min="0" step="1" value={days} onChange={(e) => setDays(e.target.value)} disabled={mode === "off"} />
        </Field>
        <ErrorNote error={s.error} />
        <div><Button type="submit" disabled={s.busy}>{s.busy ? "Saving…" : "Save credit control"}</Button></div>
      </form>
    </Panel>
  );
}

function Returns({ settings, notify, onSaved }) {
  const [window_, setWindow] = useState(String(settings.returnWindowDays));
  const [link, setLink] = useState(settings.requireReturnLink);
  const s = useSection(() => accounting.saveSettings({ returnWindowDays: Number(window_ || 0), requireReturnLink: link }), notify, onSaved, "Return rules saved");
  return (
    <Panel title="Returns" description="A return that names its original invoice cannot exceed it in quantity or value, and stock is restored at the cost it was sold at.">
      <form onSubmit={s.submit} className="grid gap-4">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
          <span><span className="font-medium">Every return must name its original invoice</span><span className="block text-xs text-muted-foreground">Off: a return may be entered without one, and then nothing limits it.</span></span></label>
        <Field label="Accept returns within (days of the original invoice)" hint="0 means no time limit." className="max-w-xl"><TextInput type="number" min="0" step="1" value={window_} onChange={(e) => setWindow(e.target.value)} /></Field>
        <ErrorNote error={s.error} />
        <div><Button type="submit" disabled={s.busy}>{s.busy ? "Saving…" : "Save return rules"}</Button></div>
      </form>
    </Panel>
  );
}

const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

// What the tax authority knows: the saved tax identity, with anything still blank taken from the
// company profile (name, address, city, emirate, email, phone).
export function taxIdentityFrom(profile = {}, company) {
  const fallback = company ? {
    legalName: company.companyName, addressLine1: company.addressLine1, city: company.city,
    emirate: EMIRATES.includes(company.state) ? company.state : "", email: company.emailAddress, phone: company.phoneNumber,
  } : {};
  const merged = { legalName: "", trn: "", addressLine1: "", city: "", emirate: "", countryCode: "AE", email: "", phone: "", vatRegistered: true, ...profile };
  for (const [k, v] of Object.entries(fallback)) if (!merged[k] && v) merged[k] = v;
  return merged;
}

function TaxIdentity({ settings, defaults, notify, onSaved }) {
  const [p, setP] = useState(() => taxIdentityFrom(settings.profile, defaults));
  useEffect(() => setP(taxIdentityFrom(settings.profile, defaults)), [settings, defaults]);
  const [fieldError, setFieldError] = useState(null);
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const s = useSection(async () => {
    if (p.trn && !/^\d{15}$/.test(p.trn)) { setFieldError("A UAE TRN is exactly 15 digits"); throw new Error("Check the TRN"); }
    setFieldError(null);
    await accounting.saveSettings({ profile: p });
  }, notify, onSaved, "Tax identity saved");
  return (
    <Panel title="Tax identity" description="The seller on tax invoices and on every e-invoice. Taken from your company profile until you change it here.">
      <form onSubmit={s.submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Registered name" className="sm:col-span-2"><TextInput value={p.legalName || ""} onChange={set("legalName")} maxLength={150} /></Field>
        <Field label="Tax registration number (TRN)" error={fieldError} hint="15 digits."><TextInput inputMode="numeric" value={p.trn || ""} onChange={set("trn")} maxLength={15} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={p.vatRegistered !== false} onChange={set("vatRegistered")} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />Registered for VAT</label>
        <Field label="Address" className="sm:col-span-2"><TextInput value={p.addressLine1 || ""} onChange={set("addressLine1")} /></Field>
        <Field label="City"><TextInput value={p.city || ""} onChange={set("city")} /></Field>
        <Field label="Emirate">
          <Select value={p.emirate || ""} onChange={set("emirate")}>
            <option value="">Choose…</option>
            {EMIRATES.map((e) => <option key={e}>{e}</option>)}
          </Select>
        </Field>
        <Field label="Email"><TextInput type="email" value={p.email || ""} onChange={set("email")} /></Field>
        <Field label="Phone"><TextInput value={p.phone || ""} onChange={set("phone")} /></Field>
        {s.error && !fieldError && <div className="sm:col-span-2"><ErrorNote error={s.error} /></div>}
        <div className="sm:col-span-2"><Button type="submit" disabled={s.busy}>{s.busy ? "Saving…" : "Save tax identity"}</Button></div>
      </form>
    </Panel>
  );
}

export { errorMessage };
