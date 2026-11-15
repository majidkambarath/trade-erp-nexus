// The guides: which flows exist, which the person may run, and their words.
import { addCustomer, addVendor, addItem } from "./flows/masters";
import { createQuotation, quotationNextStep, createSalesOrder, deliverAndInvoice, receivePayment } from "./flows/sell";
import en from "./i18n/en";

export const FLOWS = [addCustomer, addVendor, addItem, createQuotation, quotationNextStep, createSalesOrder, deliverAndInvoice, receivePayment];
export const LANGS = [
  { code: "en", label: "English", short: "EN", dir: "ltr" },
  { code: "ar", label: "العربية", short: "AR", dir: "rtl" },
  { code: "hi", label: "हिन्दी", short: "HI", dir: "ltr" },
  { code: "ml", label: "മലയാളം", short: "ML", dir: "ltr" },
];
// Languages other than English are loaded on demand, so a person who never switches pays nothing for them.
const LOADERS = {
  en: () => Promise.resolve(en),
  ar: () => import("./i18n/ar").then((m) => m.default),
  hi: () => import("./i18n/hi").then((m) => m.default),
  ml: () => import("./i18n/ml").then((m) => m.default),
};
export const loadLang = (code) => (LOADERS[code] || LOADERS.en)().catch(() => en);

// A step may name the permission and plan feature it needs (e.g. the delivery-note steps): for a person without it
// the step is left out of their run, never shown as a dead end. The first page and the last card always stay.
export function stepsFor(flow, mayUse) {
  if (!flow) return [];
  return flow.steps.filter((s, i) => i === 0 || i === flow.steps.length - 1 || (!s.permission && !s.feature) || mayUse(s.permission, s.feature));
}

export const flowById = (id) => FLOWS.find((f) => f.id === id) || null;

// What this person may run: their role holds the key AND the plan includes it (mayUse is the organisation's
// own "role and plan" test, lib/organisation.js). A flow nobody could finish is never offered.
export function flowsFor({ mayUse }) {
  return FLOWS.filter((f) => !f.permission || mayUse(f.permission, f.feature));
}

// The wording for a step in a language, falling back to English key by key so a missing line is never blank.
export function wording(table, key) {
  return table?.[key] || en[key] || { title: "", text: "" };
}
export function ui(table, key, ...args) {
  const v = table?.ui?.[key] ?? en.ui[key];
  return typeof v === "function" ? v(...args) : v;
}
