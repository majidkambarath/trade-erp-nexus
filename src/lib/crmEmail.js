// Writing to a customer from the CRM, the browser's half: the form's rules, the template preview and the words the
// screen shows. Pure, so the things that would reach a customer (an unfilled placeholder, a template applied over
// something half typed) are tests rather than something found out afterwards.
//
// The SERVER fills the placeholders and sends; this only shapes what the form sends and previews the same
// substitution so what a person sees is what goes. The two tables are deliberately the same shape, and the server's
// answer is what is believed.

const text = (v, max = 10000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const MAX_RECIPIENTS = 10;
export const MAX_SUBJECT = 200;
export const MAX_BODY = 10000;

export const isAddress = (v) => EMAIL_RE.test(text(v, 160).toLowerCase());

/** One box, many people: a person types or pastes addresses separated by commas, semicolons, spaces or newlines. */
export function splitAddresses(value) {
  return String(value || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const joinAddresses = (list) => (Array.isArray(list) ? list : []).join(", ");

/** The empty form. `to` is seeded from whoever the screen already knows about, so nobody retypes a known address. */
export function blankEmail({ to = [], subject = "", body = "" } = {}) {
  return { to: joinAddresses(to), cc: "", subject, body, templateKey: "" };
}

/** What the form will not send, in the field's own words. The server checks the same things and is the authority. */
export function validate(form = {}) {
  const errors = {};
  const to = splitAddresses(form.to);
  if (!to.length) errors.to = "Say who it goes to";
  else if (to.some((a) => !isAddress(a))) errors.to = "One of those is not an email address";
  else if (to.length > MAX_RECIPIENTS) errors.to = `At most ${MAX_RECIPIENTS} people — more than that is a campaign`;

  const cc = splitAddresses(form.cc);
  if (cc.some((a) => !isAddress(a))) errors.cc = "One of the copied addresses is not an email address";

  if (!text(form.subject, MAX_SUBJECT)) errors.subject = "Give it a subject";
  if (!text(form.body, MAX_BODY)) errors.body = "Write something to send";
  else if (String(form.body).length > MAX_BODY) errors.body = "That is too long to send from here";
  return errors;
}

/** What goes to the server. */
export function emailBody(form = {}, regarding = {}) {
  return {
    regarding: { kind: regarding.kind, id: regarding.id },
    to: splitAddresses(form.to),
    cc: splitAddresses(form.cc),
    subject: text(form.subject, MAX_SUBJECT),
    body: text(form.body, MAX_BODY),
    templateKey: text(form.templateKey, 40) || undefined,
  };
}

// ---- templates ---------------------------------------------------------------------------------------------

/**
 * Fill a template for the preview. The same rule as the server's: a known placeholder with nothing behind it goes
 * blank, an UNKNOWN one is left exactly as written so the person sees it and fixes it before the customer does.
 */
export function fill(template, values = {}) {
  const known = new Set(Object.keys(values || {}));
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g, (whole, key) => (known.has(key) ? String(values[key] ?? "") : whole));
}

/** Which placeholders this text uses that nothing can fill: what the editor warns about. */
export function unknownIn(template, placeholders = []) {
  const known = new Set((placeholders || []).map((p) => (typeof p === "string" ? p : p.key)));
  const used = [...String(template ?? "").matchAll(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(used)].filter((k) => !known.has(k));
}

/**
 * Applying a template replaces the subject and the body, and says so first if either has been typed into. Silently
 * throwing away what somebody wrote is the one thing a template picker must never do.
 */
export function applyTemplate(form, template) {
  if (!template) return { form, overwrote: false };
  const hadWork = Boolean(text(form?.subject) || text(form?.body));
  return {
    form: { ...form, subject: template.subject || "", body: template.body || "", templateKey: template.key || "" },
    overwrote: hadWork,
  };
}

// ---- what the screen says ----------------------------------------------------------------------------------

/**
 * The answer, in words a person can act on. Three different things, and they must never read the same:
 * it went, it was only recorded because no mailbox is set up, or it failed.
 */
export function sendResult(out) {
  if (!out) return { tone: "default", text: "" };
  if (out.error || out.sent === false) {
    return { tone: "danger", text: `It was not sent: ${out.error || "the mail server refused it"}. It is on the record, marked as not sent.` };
  }
  if (out.recordedOnly) {
    return {
      tone: "warning",
      text: "Recorded on the customer's record, but NOT emailed: this organisation has not set a mailbox up yet (Settings, under Sending).",
    };
  }
  return { tone: "success", text: `Sent to ${(out.activity?.email?.to || []).join(", ")}` };
}

/** How one sent email reads in a timeline or on a card. */
export function emailLine(activity) {
  const e = activity?.email;
  if (!e) return { to: "", state: "", tone: "default" };
  const to = (e.to || []).join(", ");
  if (e.error) return { to, state: "Not sent", tone: "danger" };
  if (e.recordedOnly || e.provider === "console") return { to, state: "Recorded only", tone: "warning" };
  if (e.sentAt || e.sent) return { to, state: "Sent", tone: "success" };
  return { to, state: "", tone: "default" };
}

/**
 * The one honesty this feature owes on every screen. We send and we remember; the customer's reply goes to the
 * salesperson's own mailbox, which we do not read. Nothing may imply otherwise.
 */
export const REPLY_NOTE = "Replies go to your own mailbox — they are not shown here.";
