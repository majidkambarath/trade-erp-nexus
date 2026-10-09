// The developer console's form rules as plain functions: what a new organisation needs, how a feature or a limit
// reads against its plan, and what to send for each change. No React and no requests, so each rule is a test.

// Countries offered when creating an organisation, each with the books and clock a customer there usually wants.
// A starting point only: the base currency and timezone stay choices. (The server fixes both, and the country,
// once the organisation is set up.)
export const COUNTRIES = [
  { code: "AE", name: "United Arab Emirates", baseCurrency: "AED", timezone: "Asia/Dubai" },
  { code: "SA", name: "Saudi Arabia", baseCurrency: "SAR", timezone: "Asia/Riyadh" },
  { code: "QA", name: "Qatar", baseCurrency: "QAR", timezone: "Asia/Qatar" },
  { code: "IN", name: "India", baseCurrency: "INR", timezone: "Asia/Kolkata" },
  { code: "PK", name: "Pakistan", baseCurrency: "PKR", timezone: "Asia/Karachi" },
  { code: "BD", name: "Bangladesh", baseCurrency: "BDT", timezone: "Asia/Dhaka" },
  { code: "LK", name: "Sri Lanka", baseCurrency: "LKR", timezone: "Asia/Colombo" },
  { code: "PH", name: "Philippines", baseCurrency: "PHP", timezone: "Asia/Manila" },
  { code: "EG", name: "Egypt", baseCurrency: "EGP", timezone: "Africa/Cairo" },
  { code: "TR", name: "Turkey", baseCurrency: "TRY", timezone: "Europe/Istanbul" },
  { code: "ZA", name: "South Africa", baseCurrency: "ZAR", timezone: "Africa/Johannesburg" },
  { code: "GB", name: "United Kingdom", baseCurrency: "GBP", timezone: "Europe/London" },
  { code: "DE", name: "Germany", baseCurrency: "EUR", timezone: "Europe/Berlin" },
  { code: "FR", name: "France", baseCurrency: "EUR", timezone: "Europe/Paris" },
  { code: "US", name: "United States", baseCurrency: "USD", timezone: "America/New_York" },
  { code: "CA", name: "Canada", baseCurrency: "CAD", timezone: "America/Toronto" },
  { code: "AU", name: "Australia", baseCurrency: "AUD", timezone: "Australia/Sydney" },
  { code: "SG", name: "Singapore", baseCurrency: "SGD", timezone: "Asia/Singapore" },
  { code: "CN", name: "China", baseCurrency: "CNY", timezone: "Asia/Shanghai" },
];

export const countryOf = (code) => COUNTRIES.find((c) => c.code === code) || null;

export const ACCOUNT_TYPES = [
  { value: "super_admin", label: "Super administrator" },
  { value: "admin", label: "Administrator" },
  { value: "manager", label: "Manager" },
  { value: "operator", label: "Operator" },
  { value: "viewer", label: "Viewer" },
];

// The roles a person can be given in the console: the organisation's own list (the ready-made ones and the ones it made
// for itself, switched-on ones only), or the five original account types while that list has not arrived. A role the
// person already holds stays in the list even if it has since been switched off, so the box shows what they hold.
export function roleOptions(roles, current) {
  const list = Array.isArray(roles) && roles.length ? roles : ACCOUNT_TYPES.map((t) => ({ key: t.value, name: t.label, builtIn: true, isActive: true }));
  const offered = list.filter((r) => r.isActive !== false || r.key === current).map((r) => ({ value: r.key, label: r.builtIn === false ? `${r.name} (custom)` : r.name }));
  if (current && !offered.some((o) => o.value === current)) offered.push({ value: current, label: current });
  return offered;
}

/** The role a person holds, in words: the server names it; an older answer without one falls back to the account type. */
export const roleLabel = (user) => user?.role?.name || ACCOUNT_TYPES.find((t) => t.value === (user?.role?.key || user?.type))?.label || user?.role?.key || user?.type || "";

export const emptyOrganisation = () => ({
  legalName: "",
  code: "",
  country: "AE",
  baseCurrency: "AED",
  timezone: "Asia/Dubai",
  planCode: "standard",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
});

/** Choosing a country offers its usual currency and timezone; a person may still change both afterwards. */
export function withCountry(form, code) {
  const c = countryOf(code);
  return c ? { ...form, country: code, baseCurrency: c.baseCurrency, timezone: c.timezone } : { ...form, country: code };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** { field: message } for everything the server would refuse, so the form says so before it is sent. */
export function validateNewOrganisation(form, catalog = null) {
  const errors = {};
  if (form.legalName.trim().length < 2) errors.legalName = "Enter the organisation's legal name";
  if (form.code.trim() && (!CODE.test(form.code.trim()) || form.code.trim().length < 2)) errors.code = "Use lower-case letters, digits and hyphens, at least 2 characters";
  if (!/^[A-Za-z]{2}$/.test(form.country || "")) errors.country = "Choose the country";
  if (!form.baseCurrency) errors.baseCurrency = "Choose the base currency";
  else if (catalog && !catalog.currencies?.some((c) => c.code === form.baseCurrency)) {
    errors.baseCurrency = catalog.unsupportedCurrencies?.includes(form.baseCurrency)
      ? `${form.baseCurrency} uses three decimal places, which the books cannot keep yet`
      : "Choose one of the listed currencies";
  }
  if (!form.timezone) errors.timezone = "Choose the timezone";
  if (!form.planCode) errors.planCode = "Choose the plan";
  if (!form.adminName.trim()) errors.adminName = "The first administrator needs a name";
  if (!EMAIL.test(form.adminEmail.trim())) errors.adminEmail = "Enter a valid email address";
  if (form.adminPassword.length < 8) errors.adminPassword = "A password needs at least 8 characters";
  return errors;
}

/** The body for POST /platform/organisations. */
export function toCreatePayload(form) {
  return {
    legalName: form.legalName.trim(),
    ...(form.code.trim() ? { code: form.code.trim().toLowerCase() } : {}),
    country: form.country.toUpperCase(),
    baseCurrency: form.baseCurrency,
    timezone: form.timezone,
    planCode: form.planCode,
    firstAdmin: { name: form.adminName.trim(), email: form.adminEmail.trim().toLowerCase(), password: form.adminPassword },
  };
}

/** A password to hand over once, which the person is told to change. Twelve characters, letters and digits. */
export function suggestPassword(random = Math.random) {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (set) => set[Math.floor(random() * set.length)];
  const chars = [pick(digits), pick(digits), pick(letters.toUpperCase()), ...Array.from({ length: 9 }, () => pick(letters))];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ---- features: the plan's setting, or the developer's switch for this organisation

/** "default" (follow the plan), "on" or "off", for one feature of one organisation. */
export const featureChoice = (organisation, key) => {
  const v = organisation?.featureOverrides?.[key];
  return v === true ? "on" : v === false ? "off" : "default";
};

/** What the choice means for this organisation, given the plan's own setting. */
export const featureResult = (choice, planHas) => (choice === "on" ? true : choice === "off" ? false : Boolean(planHas));

/** The PATCH body that moves an organisation from its current overrides to the chosen ones. */
export function featurePatch(organisation, choices) {
  const featureOverrides = {};
  const resetFeatures = [];
  for (const [key, choice] of Object.entries(choices)) {
    if (featureChoice(organisation, key) === choice) continue;
    if (choice === "default") resetFeatures.push(key);
    else featureOverrides[key] = choice === "on";
  }
  return { ...(Object.keys(featureOverrides).length ? { featureOverrides } : {}), ...(resetFeatures.length ? { resetFeatures } : {}) };
}

// ---- limits: the plan's number, a number of its own, or none

/** "default", "number" or "unlimited" for one limit of one organisation. */
export const limitChoice = (organisation, key) => {
  const o = organisation?.limitOverrides;
  if (!o || !Object.prototype.hasOwnProperty.call(o, key) || o[key] === undefined) return "default";
  return o[key] === null ? "unlimited" : "number";
};

/** The PATCH body for one limit. `value` is the text in the box when the choice is "number". */
export function limitPatch(key, choice, value) {
  if (choice === "default") return { resetLimits: [key] };
  if (choice === "unlimited") return { limitOverrides: { [key]: null } };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return { error: "A limit is a whole number, 0 or more" };
  return { limitOverrides: { [key]: n } };
}

/** "10", "Unlimited" or "-" for how a limit reads. */
export const limitText = (limit) => (limit === null ? "Unlimited" : limit === undefined ? "-" : String(limit));

// ---- the subscription

/** "2026-10-31" from a stored end date, for the date field. */
export const isoDay = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

/** The PATCH body for the subscription block: end date (blank = never ends), grace days, and what happens at the end. */
export function subscriptionPatch({ endsAt, graceDays, onExpiry }) {
  const grace = Number(graceDays || 0);
  if (!Number.isInteger(grace) || grace < 0 || grace > 90) return { error: "Grace days is a whole number from 0 to 90" };
  return { subscription: { endsAt: endsAt ? endsAt : null, graceDays: grace, onExpiry: onExpiry === "readonly" ? "readonly" : "block" } };
}

/** How a subscription state reads, with the colour to draw it in. */
export function stateLabel(state) {
  switch (state?.state) {
    case "suspended": return { text: "Suspended", tone: "danger" };
    case "closed": return { text: "Closed", tone: "neutral" };
    case "expired": return { text: state.onExpiry === "readonly" ? "Expired (read-only)" : "Expired", tone: "danger" };
    case "grace": return { text: "Grace period", tone: "warning" };
    default:
      if (state?.daysLeft != null && state.daysLeft <= 14) return { text: `Ends in ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"}`, tone: "warning" };
      return { text: "Active", tone: "success" };
  }
}

/** A part of the set-up that has not finished, named for the console. */
export function provisioningIssues(provisioning) {
  return Object.entries(provisioning?.steps || {})
    .filter(([, step]) => step?.state && step.state !== "done" && step.state !== "skipped")
    .map(([name, step]) => ({ name, state: step.state, message: step.message || step.error || null }));
}
