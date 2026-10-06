import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, Globe, Upload } from "lucide-react";
import axiosInstance from "../../axios/axios";
import { normalizeIban } from "../../lib/iban";
import { STRENGTH, passwordStrength, validateProfile } from "../../lib/settingsForm";
import { DATE_FORMATS, TIME_FORMATS, formatDate, formatTime, getDateFormat, getTimeFormat, setDateFormat, setTimeFormat } from "../../utils/format";
import { useTheme } from "../theme-provider";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import BusinessRules from "./BusinessRules";
import { ErrorNote, Field, PageHeader, Panel, Pill, SearchSelect, Select, Spinner, TextInput, useToasts } from "../accounting/kit";

// Settings holds what belongs to the company and to the signed-in user: the company profile and
// logo, the business rules (credit control, returns, tax identity), the bank details printed on invoices, how this device shows the app (theme, date and
// time format) and the account password. Tax codes, document numbering, fiscal years and posting
// accounts live in Accounting setup, not here. Every control on this page does something; what is
// not built yet is listed as "coming soon" rather than shown as a control that saves nothing.

const TABS = [
  { id: "company", label: "Company" },
  { id: "rules", label: "Business rules" },
  { id: "bank", label: "Invoice bank details" },
  { id: "preferences", label: "Preferences" },
  { id: "security", label: "Security" },
];

const COUNTRIES = [
  "United Arab Emirates", "Saudi Arabia", "Qatar", "Bahrain", "Kuwait", "Oman", "India", "United Kingdom",
  "United States", "Canada", "Australia", "Germany", "France", "Singapore", "China", "Japan",
];
const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Fujairah", "Ras Al Khaimah", "Umm Al Quwain"];
const CURRENCIES = [
  { code: "AED", name: "UAE Dirham" }, { code: "USD", name: "US Dollar" }, { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" }, { code: "SAR", name: "Saudi Riyal" }, { code: "INR", name: "Indian Rupee" },
];
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: c }));
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` }));

const EMPTY_COMPANY = {
  companyName: "", addressLine1: "", addressLine2: "", city: "", state: "", country: "United Arab Emirates",
  postalCode: "", phoneNumber: "", emailAddress: "", website: "",
};
const EMPTY_BANK = { bankName: "", accountName: "", accountNumber: "", ibanNumber: "", swiftCode: "", currency: "AED" };
const BANK_FIELDS = Object.keys(EMPTY_BANK);

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const apiMessage = (e) => e?.response?.data?.message || e?.message || "Something went wrong";

function fromProfile(profile) {
  const info = profile?.companyInfo || {};
  const bank = info.bankDetails || {};
  return {
    company: {
      companyName: info.companyName || "", addressLine1: info.addressLine1 || "", addressLine2: info.addressLine2 || "",
      city: info.city || "", state: info.state || "", country: info.country || "United Arab Emirates",
      postalCode: info.postalCode || "", phoneNumber: info.phoneNumber || "",
      emailAddress: info.emailAddress || profile?.email || "", website: info.website || "",
    },
    bank: {
      bankName: bank.bankName || "", accountName: bank.accountName || "", accountNumber: bank.accountNumber || "",
      ibanNumber: bank.ibanNumber || "", swiftCode: bank.swiftCode || "", currency: bank.currency || "AED",
    },
    logo: info.companyLogo?.url || null,
  };
}

export default function SettingsModule() {
  const [params, setParams] = useSearchParams();
  const { notify, toastNode } = useToasts();
  const active = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "company";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saved, setSaved] = useState(null); // what the server has: { company, bank, logo }
  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [bank, setBank] = useState(EMPTY_BANK);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await axiosInstance.get("/profile/me");
      const next = fromProfile(res.data.data);
      setSaved(next);
      setCompany(next.company);
      setBank(next.bank);
      setLogoFile(null);
      setLogoPreview(next.logo);
      setErrors({});
    } catch (e) {
      setLoadError(new Error(apiMessage(e)));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(
    () => Boolean(saved) && (JSON.stringify({ company, bank }) !== JSON.stringify({ company: saved.company, bank: saved.bank }) || Boolean(logoFile)),
    [saved, company, bank, logoFile]
  );

  const setField = (setter, key) => (value) => {
    setter((s) => ({ ...s, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };
  const input = (setter, key) => (e) => setField(setter, key)(e.target.value);

  function chooseLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("Choose an image file (PNG or JPG)", "error");
    if (file.size > MAX_LOGO_BYTES) return notify("The logo must be smaller than 5 MB", "error");
    const reader = new FileReader();
    reader.onload = () => { setLogoFile(file); setLogoPreview(reader.result); };
    reader.readAsDataURL(file);
  }
  const restoreSavedLogo = () => { setLogoFile(null); setLogoPreview(saved?.logo || null); };

  function discard() {
    setCompany(saved.company);
    setBank(saved.bank);
    restoreSavedLogo();
    setErrors({});
  }

  async function save() {
    const found = validateProfile(company, bank);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      setParams({ tab: BANK_FIELDS.includes(first) ? "bank" : "company" }, { replace: true });
      notify("Please correct the highlighted fields", "error");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append("companyInfo", JSON.stringify({
        ...Object.fromEntries(Object.entries(company).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])),
        bankDetails: { ...bank, ibanNumber: normalizeIban(bank.ibanNumber), swiftCode: bank.swiftCode.trim().toUpperCase() },
      }));
      if (logoFile) form.append("companyLogo", logoFile);
      await axiosInstance.put("/profile/me", form, { headers: { "Content-Type": "multipart/form-data" } });
      notify("Settings saved");
      await load();
    } catch (e) {
      notify(apiMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Settings"
        description="Your company profile, the bank details printed on invoices, and your account password."
        actions={<Button variant="outline" asChild><Link to="/accounting-setup">Tax codes and numbering</Link></Button>}
      />
      {loading && !saved ? <Spinner label="Loading settings" /> : loadError && !saved ? <ErrorNote error={loadError} onRetry={load} /> : (
        <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <div className="overflow-x-auto"><TabsList>{TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList></div>

          <TabsContent value="company" className="space-y-5">
            <Panel title="Company profile" description="Shown on invoices, statements and printed documents.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Company name" required error={errors.companyName}>
                  <TextInput value={company.companyName} onChange={input(setCompany, "companyName")} autoComplete="organization" />
                </Field>
                <Field label="Email address" error={errors.emailAddress}>
                  <TextInput type="email" value={company.emailAddress} onChange={input(setCompany, "emailAddress")} placeholder="accounts@company.com" />
                </Field>
                <Field label="Address line 1" required error={errors.addressLine1}>
                  <TextInput value={company.addressLine1} onChange={input(setCompany, "addressLine1")} placeholder="Street address" />
                </Field>
                <Field label="Address line 2">
                  <TextInput value={company.addressLine2} onChange={input(setCompany, "addressLine2")} placeholder="Building, floor, area (optional)" />
                </Field>
                <Field label="City" required error={errors.city}>
                  <TextInput value={company.city} onChange={input(setCompany, "city")} />
                </Field>
                <Field label="State / emirate" required error={errors.state}>
                  <TextInput value={company.state} onChange={input(setCompany, "state")} list={company.country === "United Arab Emirates" ? "emirates" : undefined} />
                </Field>
                <Field label="Country" required>
                  <SearchSelect value={company.country} onChange={setField(setCompany, "country")} options={COUNTRY_OPTIONS} placeholder="Choose a country" />
                </Field>
                <Field label="Postal code">
                  <TextInput value={company.postalCode} onChange={input(setCompany, "postalCode")} />
                </Field>
                <Field label="Phone number">
                  <TextInput type="tel" value={company.phoneNumber} onChange={input(setCompany, "phoneNumber")} placeholder="+971 4 000 0000" />
                </Field>
                <Field label="Website">
                  <TextInput type="url" value={company.website} onChange={input(setCompany, "website")} placeholder="https://www.company.com" />
                </Field>
              </div>
              <datalist id="emirates">{EMIRATES.map((e) => <option key={e} value={e} />)}</datalist>
            </Panel>

            <Panel title="Logo" description="Printed at the top of invoices. PNG or JPG, up to 5 MB.">
              <div className="flex flex-wrap items-center gap-5">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-secondary">
                  {logoPreview ? <img src={logoPreview} alt="Company logo" className="h-full w-full object-contain" /> : <span className="px-2 text-center text-xs text-muted-foreground">No logo yet</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {logoPreview ? "Change logo" : "Choose logo"}
                      <input type="file" accept="image/*" onChange={chooseLogo} className="sr-only" aria-label="Logo file" />
                    </label>
                  </Button>
                  {logoFile && <Button variant="ghost" onClick={restoreSavedLogo}>Keep the saved logo</Button>}
                  {logoFile && <span className="text-sm text-muted-foreground">{logoFile.name} - save to apply</span>}
                </div>
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="rules">
            <BusinessRules notify={notify} companyDefaults={saved?.company} />
          </TabsContent>

          <TabsContent value="bank" className="space-y-5">
            <Panel
              title="Bank details on invoices"
              description="Printed on sales invoices so customers know where to pay. The bank accounts you receive and pay through are kept in Banks and the Chart of accounts."
              actions={<Button variant="outline" size="sm" asChild><Link to="/banks">Bank masters</Link></Button>}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Bank name">
                  <TextInput value={bank.bankName} onChange={input(setBank, "bankName")} placeholder="Emirates NBD" />
                </Field>
                <Field label="Account holder name">
                  <TextInput value={bank.accountName} onChange={input(setBank, "accountName")} placeholder="As registered with the bank" />
                </Field>
                <Field label="Account number">
                  <TextInput value={bank.accountNumber} onChange={input(setBank, "accountNumber")} inputMode="numeric" />
                </Field>
                <Field label="IBAN" error={errors.ibanNumber} hint="The check digits are verified when you save.">
                  <TextInput value={bank.ibanNumber} onChange={input(setBank, "ibanNumber")} placeholder="AE07 0331 2345 6789 0123 456" className="font-mono" />
                </Field>
                <Field label="SWIFT / BIC" error={errors.swiftCode} hint="Needed for payments from outside the UAE.">
                  <TextInput value={bank.swiftCode} onChange={input(setBank, "swiftCode")} placeholder="EBILAEAD" className="font-mono uppercase" maxLength={11} />
                </Field>
                <Field label="Account currency">
                  <SearchSelect value={bank.currency} onChange={setField(setBank, "currency")} options={CURRENCY_OPTIONS} placeholder="Choose a currency" />
                </Field>
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-5">
            <PreferencesPanel />
          </TabsContent>

          <TabsContent value="security">
            <PasswordPanel notify={notify} />
          </TabsContent>

          {(active === "company" || active === "bank") && (
            <div className="sticky bottom-3 mt-5 flex items-center justify-end gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-elevated">
              <span className="me-auto text-sm text-muted-foreground">{dirty ? "You have unsaved changes" : "No unsaved changes"}</span>
              <Button variant="outline" onClick={discard} disabled={!dirty || saving}>Discard</Button>
              <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          )}
        </Tabs>
      )}
      {toastNode}
    </div>
  );
}

const THEMES = [
  { id: "light", name: "Light", text: "Bright background, best in daylight" },
  { id: "dark", name: "Dark", text: "Dim background, easier in low light" },
  { id: "system", name: "Match device", text: "Follows your computer's setting" },
];
const SOON = [
  { icon: <Globe className="h-4 w-4" aria-hidden="true" />, title: "Language", text: "Arabic with a right-to-left layout, alongside English." },
  { icon: <Bell className="h-4 w-4" aria-hidden="true" />, title: "Notifications", text: "Alerts for approvals, low stock, expiring batches and overdue invoices." },
];

// How this device shows the app. Each choice applies at once and is remembered in this browser.
function PreferencesPanel() {
  const { preference, setTheme } = useTheme();
  const [dateFormat, setDate] = useState(getDateFormat);
  const [timeFormat, setTime] = useState(getTimeFormat);
  const now = new Date();
  return (
    <>
      <Panel title="Appearance" description="Applies at once and is remembered on this device.">
        <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t) => (
            <label key={t.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/50 ${preference === t.id ? "border-ring bg-accent/40" : "border-border"}`}>
              <input type="radio" name="theme" value={t.id} checked={preference === t.id} onChange={() => setTheme(t.id)} className="mt-1 h-4 w-4 accent-foreground" />
              <span><span className="block text-sm font-medium text-foreground">{t.name}</span><span className="block text-xs text-muted-foreground">{t.text}</span></span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Dates and times" description="How dates and times read in lists, statements and printed documents. Dates follow Dubai time.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date format" hint={`Today reads ${formatDate(now, dateFormat)}`}>
            <Select value={dateFormat} onChange={(e) => { setDate(e.target.value); setDateFormat(e.target.value); }}>
              {DATE_FORMATS.map((f) => <option key={f} value={f}>{f} - {formatDate(now, f)}</option>)}
            </Select>
          </Field>
          <Field label="Time format" hint={`Now reads ${formatTime(now, timeFormat)}`}>
            <Select value={timeFormat} onChange={(e) => { setTime(e.target.value); setTimeFormat(e.target.value); }}>
              {TIME_FORMATS.map((f) => <option key={f} value={f}>{f === "12h" ? `12-hour - ${formatTime(now, "12h")}` : `24-hour - ${formatTime(now, "24h")}`}</option>)}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel title="Coming soon" description="Not available yet. These will appear here when they are ready.">
        <ul className="divide-y divide-border">
          {SOON.map(({ icon, title, text }) => (
            <li key={title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">{icon}</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>
              <Pill>Coming soon</Pill>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function PasswordPanel({ notify }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError((x) => ({ ...x, [k]: undefined })); };
  const strength = passwordStrength(form.newPassword);

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!form.currentPassword) found.currentPassword = "Enter your current password";
    if (form.newPassword.length < 6) found.newPassword = "Use at least 6 characters";
    else if (form.newPassword === form.currentPassword) found.newPassword = "Choose a password you have not used here";
    if (form.confirmPassword !== form.newPassword) found.confirmPassword = "The two passwords do not match";
    setError(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await axiosInstance.put("/profile/change-password", form);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      notify("Password changed");
    } catch (err) {
      notify(apiMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const type = show ? "text" : "password";
  return (
    <Panel title="Change password" description="Use something you do not use anywhere else. You stay signed in on this device.">
      <form onSubmit={submit} className="grid max-w-md gap-5" noValidate>
        <Field label="Current password" required error={error.currentPassword}>
          <TextInput type={type} value={form.currentPassword} onChange={set("currentPassword")} autoComplete="current-password" />
        </Field>
        <Field label="New password" required error={error.newPassword} hint="At least 6 characters. Longer, with capitals, digits and symbols, is stronger.">
          <TextInput type={type} value={form.newPassword} onChange={set("newPassword")} autoComplete="new-password" />
        </Field>
        {form.newPassword && (
          <div aria-live="polite" className="-mt-2">
            <div className="h-1.5 w-full rounded-full bg-secondary"><div className={`h-1.5 rounded-full transition-all ${STRENGTH[strength].bar} ${STRENGTH[strength].width}`} /></div>
            <p className="mt-1 text-xs text-muted-foreground">Strength: {STRENGTH[strength].label}</p>
          </div>
        )}
        <Field label="Confirm new password" required error={error.confirmPassword}>
          <TextInput type={type} value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-foreground" />
          Show passwords
        </label>
        <div><Button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button></div>
      </form>
    </Panel>
  );
}
