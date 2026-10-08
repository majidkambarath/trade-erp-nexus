// The rules behind the Send dialog. No React here, so what decides who a document goes to, what it
// says and whether the PDF travels is tested without rendering.
//
// Phone numbers for WhatsApp are normalised on the server (utils/phone.js) so the history holds exactly
// what was used; the dialog only shows what the server will make of the number, with toWaNumber below,
// the same rule written once more for the screen. A test keeps the two in step.

import { isEmail } from "./partyForms";

// A PDF this heavy is not attached: the server refuses over 4 MB, and a mail server often refuses sooner.
// The link carries the document instead.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
// A statement can run to many pages; rasterised, that is slow to build and to upload.
export const MAX_ATTACHMENT_PAGES = 4;

// "a@x.ae, B@x.ae; a@x.ae" (a paste, or typed with commas) -> { emails, bad }. Unique, lowercase.
export function parseRecipients(text) {
  const seen = new Set();
  const emails = [];
  const bad = [];
  for (const raw of String(text ?? "").split(/[,;\s]+/)) {
    const e = raw.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    (isEmail(e) ? emails : bad).push(e);
  }
  return { emails, bad };
}

// Where to start: the customer's own address, then their primary contact, then the others.
export function defaultRecipients(party = {}) {
  const contacts = party.contacts || [];
  const ordered = [party.email, ...contacts.filter((c) => c.isPrimary).map((c) => c.email), ...contacts.filter((c) => !c.isPrimary).map((c) => c.email)];
  const out = [];
  for (const e of ordered) {
    const v = String(e ?? "").trim().toLowerCase();
    if (v && isEmail(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

// What a document's email is called. From the document's own title, so a draft is never "Tax invoice".
export function defaultSubject({ title, number, companyName }) {
  const base = [title, number].filter(Boolean).join(" ");
  return companyName ? `${base} from ${companyName}` : base;
}

// "Customer copy · 1 page · 184 KB"
export function sizeText(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function attachmentNote({ label = "Customer copy", pages, bytes }) {
  const parts = [label];
  if (pages) parts.push(`${pages} page${pages === 1 ? "" : "s"}`);
  if (bytes !== undefined && bytes !== null) parts.push(sizeText(bytes));
  return parts.join(" · ");
}

// Whether the PDF may go with the email, and if not, why in a sentence a person can use. The link always
// works, so "no" here only changes what the email carries.
export function attachmentDecision({ bytes, pages }) {
  if (Number(bytes) > MAX_ATTACHMENT_BYTES) {
    return { allowed: false, reason: `The PDF is ${sizeText(bytes)}, too large to attach. The email will carry the link instead.` };
  }
  if (Number(pages) > MAX_ATTACHMENT_PAGES) {
    return { allowed: false, reason: `This document is ${pages} pages. The email will carry the link instead, or narrow the dates and attach it.` };
  }
  return { allowed: true, reason: "" };
}

// UAE numbers as people type them, to the digits wa.me wants. null when it cannot be a phone number.
export function toWaNumber(input, defaultCountry = "971") {
  const raw = String(input ?? "").trim();
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return null;
  const compact = raw.replace(/\s/g, "");
  const international = compact.startsWith("+") || compact.startsWith("00");
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (compact.startsWith("00")) d = d.slice(2);
  if (international) return d.length >= 8 && d.length <= 15 ? d : null;
  if (d.startsWith(defaultCountry) && d.length >= defaultCountry.length + 8 && d.length <= defaultCountry.length + 9) return d;
  if (d.startsWith("0")) {
    const rest = d.slice(1);
    return rest.length === 8 || rest.length === 9 ? defaultCountry + rest : null;
  }
  return d.length === 9 && d.startsWith("5") ? defaultCountry + d : null;
}

// Everything the dialog can check before it asks the server. Returns { to, cc, errors } or errors only.
export function validateSend({ channel, to, cc, phone }) {
  const errors = {};
  if (channel === "whatsapp") {
    if (phone && !toWaNumber(phone)) errors.phone = "That does not look like a phone number. Include the country code, for example +971 50 111 2222.";
    return { errors };
  }
  const main = parseRecipients(to);
  const copy = parseRecipients(cc);
  if (!main.emails.length && !main.bad.length) errors.to = "Who should it go to? Add an email address.";
  else if (main.bad.length) errors.to = `${main.bad.join(", ")} ${main.bad.length === 1 ? "does" : "do"} not look like an email address.`;
  if (copy.bad.length) errors.cc = `${copy.bad.join(", ")} ${copy.bad.length === 1 ? "does" : "do"} not look like an email address.`;
  if (main.emails.length > 10) errors.to = "At most 10 addresses in To.";
  if (copy.emails.length > 5) errors.cc = "At most 5 addresses in Cc.";
  return { to: main.emails, cc: copy.emails, errors };
}

// A press of the button: a key the server uses to know a double click from a deliberate second send.
export const newIdempotencyKey = () => {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c?.randomUUID) return `send-${c.randomUUID()}`;
  return `send-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

// The server's refusals, as a sentence for the person. The server already writes these in plain words, so
// this only adds what the screen knows that the server does not.
export function sendProblem(error) {
  const code = error?.code;
  if (code === "MESSAGING_DISABLED" || code === "MESSAGING_NOT_CONFIGURED") return { message: error.message, setup: true };
  return { message: error?.message || "The document could not be sent.", setup: false };
}
