import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, Globe, Trash2, Upload } from "lucide-react";
import axiosInstance from "../../axios/axios";
import { normalizeIban } from "../../lib/iban";
import { STRENGTH, passwordStrength, validateProfile } from "../../lib/settingsForm";
import { DATE_FORMATS, TIME_FORMATS, formatDate, formatTime, getDateFormat, getTimeFormat, setTimeFormat } from "../../utils/format";
import { useTheme } from "../theme-provider";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useOrganisation } from "../shell/OrganisationContext";
import { buildState, supportLine } from "../../lib/version";
import { hasErpModules } from "../../lib/organisation";
import GoogleConnect from "../crm/GoogleConnect.jsx";
import { orgCurrency, orgTimezone, setOrgLocale } from "../../utils/orgLocale";
import { passwordHint, validatePasswordChange } from "../../lib/passwordForms";
import BusinessRules from "./BusinessRules";
import SendingSettings from "./SendingSettings";
import BranchSettings from "./BranchSettings";
import TwoFactorSection from "./TwoFactorSection";
import { ErrorNote, Field, PageHeader, Panel, PhoneInput, Pill, SearchSelect, Select, Spinner, TextInput, useToasts } from "../accounting/kit";

// Settings holds what belongs to the company and to the signed-in user: the company profile and
// logo, the business rules (credit control, returns, tax identity), the bank details printed on invoices, how this device shows the app (theme, date and
// time format) and the account password. Tax codes, document numbering, fiscal years and posting
// accounts live in Accounting setup, not here. Every control on this page does something; what is
// not built yet is listed as "coming soon" rather than shown as a control that saves nothing.

// `trade` marks the tabs that are about the trade documents (credit control, returns, the tax identity, the bank details printed on an
// invoice): an organisation that bought the CRM alone makes no invoice, so they are not offered to it (hasErpModules).
const TABS = [
  { id: "company", label: "Company" },
  { id: "branches", label: "Branches" },
  { id: "rules", label: "Business rules", trade: true },
  { id: "bank", label: "Invoice bank details", trade: true },
  { id: "sending", label: "Sending" },
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
const currencyOptions = (own) => {
  const list = CURRENCIES.some((c) => c.code === own) ? CURRENCIES : [{ code: own, name: "Base currency" }, ...CURRENCIES];
  return list.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` }));
};

const EMPTY_COMPANY = {
  companyName: "", addressLine1: "", addressLine2: "", city: "", state: "", country: "United Arab Emirates",
  postalCode: "", phoneNumber: "", emailAddress: "", website: "",
};
const emptyBank = () => ({ bankName: "", accountName: "", accountNumber: "", ibanNumber: "", swiftCode: "", currency: orgCurrency() });
const BANK_FIELDS = Object.keys(emptyBank());

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const apiMessage = (e) => e?.response?.data?.message || e?.message || "Something went wrong";

// What the server holds: the ORGANISATION's letterhead (GET /company/profile), one copy for everyone, not a copy per person.
function fromProfile(info) {
  const bank = info?.bankDetails || {};
  return {
    company: {
      companyName: info?.companyName || "", addressLine1: info?.addressLine1 || "", addressLine2: info?.addressLine2 || "",
      city: info?.city || "", state: info?.state || "", country: info?.country || "United Arab Emirates",
      postalCode: info?.postalCode || "", phoneNumber: info?.phoneNumber || "",
      emailAddress: info?.emailAddress || "", website: info?.website || "",
    },
    bank: {
      bankName: bank.bankName || "", accountName: bank.accountName || "", accountNumber: bank.accountNumber || "",
      ibanNumber: bank.ibanNumber || "", swiftCode: bank.swiftCode || "", currency: bank.currency || orgCurrency(),
    },
    logo: info?.companyLogo?.url || null,
  };
}

export default function SettingsModule() {
  const [params, setParams] = useSearchParams();
  const { notify, toastNode } = useToasts();
  const { can, status } = useOrganisation();
  // The letterhead is the company's, not the person's: anyone reads it, only someone who may change settings edits it.
  const canEdit = can("settings.manage");
  const trade = hasErpModules(status);
  // The Google connection is only meaningful where the CRM was bought and this person can open it; judged strictly
  // (grants known AND holding crm.view), the same way the CRM's other cross-module touches are.
  const crmHeld = Array.isArray(status?.me?.grants) && can("crm.view") && status?.modules?.crm?.on !== false;
  const tabs = TABS.filter((t) => trade || !t.trade);
  const active = tabs.some((t) => t.id === params.get("tab")) ? params.get("tab") : "company";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saved, setSaved] = useState(null); // what the server has: { company, bank, logo }
  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [bank, setBank] = useState(emptyBank);
  const [logoFile, setLogoFile] = useState(null);
  const [logoRemoved, setLogoRemoved] = useState(false); // the saved logo is taken off when the page is saved, like every other change here
  const [logoPreview, setLogoPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await axiosInstance.get("/company/profile");
      const next = fromProfile(res.data.data);
      setSaved(next);
      setCompany(next.company);
      setBank(next.bank);
      setLogoFile(null);
      setLogoRemoved(false);
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
    () => Boolean(saved) && (JSON.stringify({ company, bank }) !== JSON.stringify({ company: saved.company, bank: saved.bank }) || Boolean(logoFile) || logoRemoved),
    [saved, company, bank, logoFile, logoRemoved]
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
    reader.onload = () => { setLogoFile(file); setLogoRemoved(false); setLogoPreview(reader.result); };
    reader.readAsDataURL(file);
  }
  // Removing is not applied until the page is saved, so it can be undone with "Keep the saved logo" or Discard.
  const removeLogo = () => { setLogoFile(null); setLogoRemoved(true); setLogoPreview(null); };
  const restoreSavedLogo = () => { setLogoFile(null); setLogoRemoved(false); setLogoPreview(saved?.logo || null); };

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
      else if (logoRemoved) form.append("removeLogo", "true");
      await axiosInstance.put("/company/profile", form, { headers: { "Content-Type": "multipart/form-data" } });
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
        description={trade ? "Your company profile, the bank details printed on invoices, and your account password." : "Your company profile, how the app looks for you, and your account password."}
        actions={trade ? <Button variant="outline" asChild><Link to="/accounting-setup">Tax codes and numbering</Link></Button> : undefined}
      />
      {loading && !saved ? <Spinner label="Loading settings" /> : loadError && !saved ? <ErrorNote error={loadError} onRetry={load} /> : (
        <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <div className="overflow-x-auto"><TabsList>{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList></div>

          <TabsContent value="company" className="space-y-5">
            {!canEdit && <ReadOnlyNote />}
            <fieldset disabled={!canEdit} className="m-0 min-w-0 space-y-5 border-0 p-0">
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
                  {company.country === "United Arab Emirates" ? (
                    // F05: a free-text box with a datalist of suggestions still let anything through (a typo, an
                    // abbreviation, a trailing space), which is exactly what the VAT return's own emirate field
                    // (Settings > Business rules > Tax identity) reads when this one is left to stand for it.
                    // A hard choice of the seven here too means the letterhead and the return can never disagree.
                    <Select value={company.state} onChange={input(setCompany, "state")}>
                      <option value="">Choose an emirate</option>
                      {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
                    </Select>
                  ) : (
                    <TextInput value={company.state} onChange={input(setCompany, "state")} />
                  )}
                </Field>
                <Field label="Country" required>
                  <SearchSelect value={company.country} onChange={setField(setCompany, "country")} options={COUNTRY_OPTIONS} placeholder="Choose a country" />
                </Field>
                <Field label="Postal code">
                  <TextInput value={company.postalCode} onChange={input(setCompany, "postalCode")} />
                </Field>
                <Field label="Phone number">
                  <PhoneInput value={company.phoneNumber} onChange={input(setCompany, "phoneNumber")} placeholder="4 000 0000" />
                </Field>
                <Field label="Website">
                  <TextInput type="url" value={company.website} onChange={input(setCompany, "website")} placeholder="https://www.company.com" />
                </Field>
              </div>
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
                  {saved?.logo && !logoFile && !logoRemoved && (
                    <Button variant="ghost" onClick={removeLogo}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove logo
                    </Button>
                  )}
                  {(logoFile || logoRemoved) && <Button variant="ghost" onClick={restoreSavedLogo}>Keep the saved logo</Button>}
                  {logoFile && <span className="text-sm text-muted-foreground">{logoFile.name} - save to apply</span>}
                  {logoRemoved && <span className="text-sm text-muted-foreground">Removed - save to apply</span>}
                </div>
              </div>
            </Panel>
            </fieldset>
            <DateFormatPanel notify={notify} />
          </TabsContent>

          <TabsContent value="branches">
            <BranchSettings notify={notify} />
          </TabsContent>

          {trade && (
            <TabsContent value="rules">
              <BusinessRules notify={notify} companyDefaults={saved?.company} />
            </TabsContent>
          )}

          <TabsContent value="sending">
            <SendingSettings notify={notify} />
          </TabsContent>

          {trade && (
          <TabsContent value="bank" className="space-y-5">
            {!canEdit && <ReadOnlyNote />}
            <fieldset disabled={!canEdit} className="m-0 min-w-0 space-y-5 border-0 p-0">
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
                  <SearchSelect value={bank.currency} onChange={setField(setBank, "currency")} options={currencyOptions(orgCurrency())} placeholder="Choose a currency" />
                </Field>
              </div>
            </Panel>
            </fieldset>
          </TabsContent>
          )}

          <TabsContent value="preferences" className="space-y-5">
            <PreferencesPanel />
          </TabsContent>

          <TabsContent value="security" className="space-y-5">
            <PasswordPanel notify={notify} />
            <TwoFactorSection notify={notify} />
            {/* Connecting your own Google account belongs beside your password and your two-factor: it is yours, not
                the organisation's. It draws nothing at all where the CRM was not bought or Google is not set up. */}
            {crmHeld && <GoogleConnect notify={notify} />}
          </TabsContent>

          {canEdit && (active === "company" || active === "bank") && (
            <div className="sticky bottom-3 mt-5 flex items-center justify-end gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-elevated">
              <span className="me-auto text-sm text-muted-foreground">{dirty ? "You have unsaved changes" : "No unsaved changes"}</span>
              <Button variant="outline" onClick={discard} disabled={!dirty || saving}>Discard</Button>
              <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          )}
        </Tabs>
      )}
      {/* Outside the tabs on purpose: "open Settings and read the version" has to work whichever tab was
          last open, and it is the first thing anybody is asked for when reporting a problem. */}
      <BuildVersion api={status?.build?.api} />
      {toastNode}
    </div>
  );
}

/**
 * Which version is running. BOTH of them: the app and the API ship as separate Render services, so a
 * release is only really live once both have, and a mismatch that lasts means one did not finish.
 */
function BuildVersion({ api }) {
  const build = buildState(api);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(supportLine(api));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser that refuses the clipboard is not worth an error here - the figures are on screen to read.
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            Version <span className="tabular-nums">{build.app}</span>
            {build.state === "mismatched" && <span className="text-muted-foreground"> · server <span className="tabular-nums">{build.api}</span></span>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{build.note}</p>
        </div>
        <div className="flex items-center gap-2">
          {build.state === "mismatched" && <Pill tone="warning">Versions differ</Pill>}
          {build.state === "matched" && <Pill tone="success">Up to date</Pill>}
          <Button variant="outline" size="sm" onClick={copy}>{copied ? "Copied" : "Copy for support"}</Button>
        </div>
      </div>
    </section>
  );
}

// What a person sees on the company's profile and bank details when they may not change them.
function ReadOnlyNote() {
  return (
    <p role="note" className="rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
      This is the company's profile, the same for everyone. Only someone who may change settings can edit it.
    </p>
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

// How this organisation writes a date, on screen AND on every document it prints or sends. It is
// deliberately ONE setting for the whole organisation rather than a per-browser preference: two people
// printing the same invoice must not produce two different dates, and the copy the customer opens must
// read what the sender printed. Changing it needs settings.manage, like any other organisation setting.
function DateFormatPanel({ notify }) {
  const { status, can, refresh } = useOrganisation();
  const canEdit = can("settings.manage");
  const [value, setValue] = useState(getDateFormat);
  const [saving, setSaving] = useState(false);
  const now = new Date();

  const choose = async (next) => {
    const before = value;
    setValue(next);
    setSaving(true);
    try {
      await axiosInstance.put("/organisation/date-format", { dateFormat: next });
      setOrgLocale({ dateFormat: next }); // every date on screen follows at once
      await refresh?.();
      notify?.("Date format saved", "success");
    } catch (err) {
      setValue(before);
      notify?.(err?.response?.data?.message || "Could not save the date format", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Date format" description="How every date is written, for everyone in this organisation and on every document you send.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Date format" hint={canEdit ? `Today reads ${formatDate(now, value)}` : "Only someone who can change settings may set this."}>
          <Select value={value} disabled={!canEdit || saving} onChange={(e) => choose(e.target.value)}>
            {DATE_FORMATS.map((f) => <option key={f} value={f}>{f} - {formatDate(now, f)}</option>)}
          </Select>
        </Field>
      </div>
      {status?.organisation?.legalName && (
        <p className="mt-3 text-xs text-muted-foreground">Applies to everyone in {status.organisation.legalName}, not just this device.</p>
      )}
    </Panel>
  );
}

// How this device shows the app. Each choice applies at once and is remembered in this browser.
// The DATE format is deliberately not here: it is the organisation's (Company tab), because it is
// printed on documents that leave the building and must not differ between the people who print them.
function PreferencesPanel() {
  const { preference, setTheme } = useTheme();
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

      <Panel title="Times" description={`How times read on this device. Dates follow your organisation's time zone, ${orgTimezone()}.`}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Time format" hint={`Now reads ${formatTime(now, timeFormat)}`}>
            <Select value={timeFormat} onChange={(e) => { setTime(e.target.value); setTimeFormat(e.target.value); }}>
              {TIME_FORMATS.map((f) => <option key={f} value={f}>{f === "12h" ? `12-hour - ${formatTime(now, "12h")}` : `24-hour - ${formatTime(now, "24h")}`}</option>)}
            </Select>
          </Field>
          <Field label="Date format" hint="Set once for the whole organisation, under Company.">
            <Select value={getDateFormat()} disabled>
              <option value={getDateFormat()}>{getDateFormat()} - {formatDate(now, getDateFormat())}</option>
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
    const found = validatePasswordChange(form);
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
        <Field label="New password" required error={error.newPassword} hint={passwordHint}>
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
