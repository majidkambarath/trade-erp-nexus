// The CRM's rules on the client: labels, tones, the little derivations a screen needs, and the form validators -
// pure, so they are tested without rendering anything (src/lib/__tests__/crm.test.js).
//
// It is NOT a copy of the server's rules. The server decides what may be saved, which stage a document sends a deal
// to and when a follow-up falls due; this decides what the words are and which button to offer. Where both need the
// same word (a lead source, a lost reason), the server sends it on the record and the table here only translates it.

export const LEAD_STATUS = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];

export const STATUS_LABEL = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Became a customer",
  LOST: "Lost",
};

// The tones are src/lib/status.js's own vocabulary, so a CRM pill looks like every other pill in the product.
export const STATUS_TONE = {
  NEW: "info",
  CONTACTED: "default",
  QUALIFIED: "success",
  CONVERTED: "success",
  LOST: "danger",
};

export const SOURCES = [
  ["walk_in", "Walk-in"],
  ["phone", "Phone"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
  ["website", "Website"],
  ["referral", "Referral"],
  ["exhibition", "Exhibition"],
  ["repeat", "Repeat customer"],
  ["other", "Other"],
];

export const ACTIVITY_KINDS = [
  ["call", "Call"],
  ["visit", "Visit"],
  ["meeting", "Meeting"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
  ["note", "Note"],
  ["task", "Task"],
];

export const OUTCOMES = [
  ["spoke", "Spoke to them"],
  ["no_answer", "No answer"],
  ["interested", "Interested"],
  ["not_interested", "Not interested"],
  ["quoted", "Quoted"],
  ["follow_up", "Needs another follow-up"],
  ["done", "Done"],
];

export const LOST_REASONS = [
  ["price", "Price too high"],
  ["competitor", "Went to a competitor"],
  ["no_budget", "No budget"],
  ["no_response", "No response"],
  ["not_needed", "Not needed"],
  ["timing", "Wrong time"],
  ["other", "Other"],
];

export const BANDS = [
  ["hot", "Hot"],
  ["warm", "Warm"],
  ["cold", "Cold"],
];

export const ASSIGNMENT_MODES = [
  ["round_robin", "Round robin - each new enquiry to the next person"],
  ["creator", "Whoever entered it"],
  ["fixed", "One person, always"],
];

// What the pipeline's stage editor may choose as the thing that advances a deal into a stage. The words are the
// server's (utils/crm.js EVENT_LABEL); a stage may also answer nothing, and then only a person moves a deal into it.
export const ADVANCE_EVENTS = [
  ["", "Nothing - moved by hand"],
  ["quotation_sent", "A quotation was sent"],
  ["quotation_accepted", "The customer accepted the quotation"],
  ["invoice_approved", "The invoice was approved"],
];

const labelFrom = (pairs, value, fallback = "") => {
  const found = pairs.find(([key]) => key === value);
  return found ? found[1] : value || fallback;
};

export const sourceLabel = (value) => labelFrom(SOURCES, value, "Other");
export const kindLabel = (value) => labelFrom(ACTIVITY_KINDS, value);
export const outcomeLabel = (value) => labelFrom(OUTCOMES, value);
export const lostLabel = (value) => labelFrom(LOST_REASONS, value);
export const bandLabel = (value) => labelFrom(BANDS, value);
export const eventLabel = (value) => labelFrom(ADVANCE_EVENTS, value || "");

export const BAND_TONE = { hot: "danger", warm: "warning", cold: "default" };
export const DUE_TONE = { overdue: "danger", today: "warning", soon: "info", later: "default", done: "success", cancelled: "default" };
export const DUE_LABEL = { overdue: "Late", today: "Today", soon: "This week", later: "Later", done: "Done", cancelled: "Cancelled" };

/** A deal's or a lead's own next action, as one short line. */
export function nextActionText(row, today) {
  if (!row?.nextActionAt) return "Nothing planned";
  const left = dayGap(today, row.nextActionAt);
  if (left === null) return "Nothing planned";
  if (left < 0) return `${Math.abs(left)} ${Math.abs(left) === 1 ? "day" : "days"} late`;
  if (left === 0) return "Due today";
  if (left === 1) return "Due tomorrow";
  return `Due in ${left} days`;
}

/** Whole days between two "YYYY-MM-DD" days, or null when either is missing or not a day. */
export function dayGap(from, to) {
  const ok = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!ok(from) || !ok(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/** The tabs of the follow-up worklist, and which one to open on: whatever is late, else today's. */
export const DUE_TABS = [
  ["overdue", "Late"],
  ["today", "Today"],
  ["week", "This week"],
  ["", "All open"],
];

export const openingTab = (counts = {}) => {
  if (counts.overdue > 0) return "overdue";
  if (counts.today > 0) return "today";
  return "week";
};

/** The counts above the worklist, from one list of follow-ups (the server sends them already judged). */
export function dueCounts(rows = [], today = null) {
  const out = { overdue: 0, today: 0, week: 0, all: 0 };
  for (const row of rows) {
    out.all += 1;
    const state = row.dueState || "later";
    if (state === "overdue") out.overdue += 1;
    if (state === "today") out.today += 1;
    const left = dayGap(today, row.dueAt);
    if (left !== null && left <= 7) out.week += 1;
  }
  return out;
}

// ---- forms ---------------------------------------------------------------------------------------------------------

export const emptyLead = () => ({
  name: "", company: "", phone: "", email: "", city: "",
  source: "phone", sourceNote: "", interest: "", expectedValue: "", ownerId: "", notes: "",
});

const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || "").trim());

/** What the lead form may not save. The server judges it again; this is so a person is told before they press. */
export function validateLead(form = {}) {
  const errors = {};
  if (!String(form.name || "").trim()) errors.name = "Who is it?";
  if (!String(form.phone || "").trim() && !String(form.email || "").trim()) {
    errors.phone = "A phone number or an email address - something to reach them by";
  }
  if (String(form.email || "").trim() && !isEmail(form.email)) errors.email = "That does not look like an email address";
  if (form.expectedValue !== "" && Number(form.expectedValue) < 0) errors.expectedValue = "It cannot be less than nothing";
  return errors;
}

export const leadBody = (form = {}) => ({
  name: String(form.name || "").trim(),
  company: String(form.company || "").trim(),
  phone: String(form.phone || "").trim(),
  email: String(form.email || "").trim(),
  city: String(form.city || "").trim(),
  source: form.source || "other",
  sourceNote: String(form.sourceNote || "").trim(),
  interest: String(form.interest || "").trim(),
  expectedValue: Number(form.expectedValue) || 0,
  ownerId: form.ownerId || undefined,
  notes: String(form.notes || "").trim(),
});

export const emptyDeal = (customerId = "") => ({ title: "", customerId, value: "", expectedCloseDate: "", source: "other", ownerId: "", notes: "" });

export function validateDeal(form = {}) {
  const errors = {};
  if (!String(form.title || "").trim()) errors.title = "What is the deal for?";
  if (!form.customerId) errors.customerId = "Which customer?";
  if (form.value !== "" && Number(form.value) < 0) errors.value = "It cannot be worth less than nothing";
  return errors;
}

export const dealBody = (form = {}) => ({
  title: String(form.title || "").trim(),
  customerId: form.customerId,
  value: Number(form.value) || 0,
  expectedCloseDate: form.expectedCloseDate || undefined,
  source: form.source || "other",
  ownerId: form.ownerId || undefined,
  notes: String(form.notes || "").trim(),
});

export const emptyActivity = (kind = "call") => ({ kind, subject: "", notes: "", dueAt: "", ownerId: "" });

export function validateActivity(form = {}) {
  const errors = {};
  if (!form.kind) errors.kind = "A call, a visit, a message?";
  if (!String(form.subject || "").trim()) errors.subject = "What is it about?";
  return errors;
}

/** Logging what happened, and - the part that matters - when to do the next thing. */
export const emptyDone = (today = "") => ({ outcome: "spoke", notes: "", nextDueAt: "", nextSubject: "", nextKind: "call", today });

export function validateDone(form = {}) {
  const errors = {};
  if (!form.outcome) errors.outcome = "What came of it?";
  if (form.nextDueAt && form.today && dayGap(form.today, form.nextDueAt) < 0) {
    errors.nextDueAt = "The next follow-up cannot be in the past";
  }
  return errors;
}

export const doneBody = (form = {}) => ({
  outcome: form.outcome,
  notes: String(form.notes || "").trim(),
  nextDueAt: form.nextDueAt || undefined,
  nextSubject: String(form.nextSubject || "").trim() || undefined,
  nextKind: form.nextDueAt ? form.nextKind : undefined,
});

// ---- the pipeline's own settings ----------------------------------------------------------------------------------

export const stageRow = () => ({ key: "", name: "", probability: 50, advanceOn: "", followUpDays: 2, staleDays: 14, type: "open" });

/**
 * What the stage editor may not save. The same shape as the server's refusals, so the screen can say it first - and
 * deliberately the same three rules, because they are what the automation needs to work at all: one won stage, one
 * lost stage, and no two stages waiting for the same event.
 */
export function validateStages(stages = []) {
  const errors = {};
  if (!stages.length) return { stages: "A pipeline needs at least one stage" };
  const seen = new Set();
  const events = new Set();
  let won = 0;
  let lost = 0;
  stages.forEach((s, i) => {
    const name = String(s.name || "").trim();
    if (!name) errors[`${i}.name`] = "Give it a name";
    const key = String(s.key || "").trim().toLowerCase();
    if (key && seen.has(key)) errors[`${i}.key`] = "Two stages cannot share a key";
    seen.add(key);
    if (Number(s.probability) < 0 || Number(s.probability) > 100) errors[`${i}.probability`] = "Between 0 and 100";
    if (s.type === "won") won += 1;
    if (s.type === "lost") lost += 1;
    if (s.advanceOn) {
      if (events.has(s.advanceOn)) errors[`${i}.advanceOn`] = "Another stage already waits for this";
      events.add(s.advanceOn);
    }
  });
  if (won !== 1) errors.stages = "Exactly one stage must be the won one";
  else if (lost !== 1) errors.stages = "Exactly one stage must be the lost one";
  return errors;
}

/** A key a person never has to type: made from the name, kept stable once a stage has been saved. */
export const keyFor = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export const stagesBody = (stages = []) =>
  stages.map((s, i) => ({
    key: String(s.key || "").trim() || keyFor(s.name) || `stage-${i + 1}`,
    name: String(s.name || "").trim(),
    order: i + 1,
    probability: Number(s.probability) || 0,
    advanceOn: s.advanceOn || null,
    followUpDays: Number(s.followUpDays) || 0,
    staleDays: Number(s.staleDays) || 0,
    type: s.type || "open",
  }));

export const settingsBody = (form = {}) => ({
  autoAdvance: Boolean(form.autoAdvance),
  autoFollowUp: Boolean(form.autoFollowUp),
  assignmentMode: form.assignmentMode || "round_robin",
  fixedOwnerId: form.assignmentMode === "fixed" ? form.fixedOwnerId || null : null,
  uncontactedHours: Number(form.uncontactedHours) || 24,
  staleDays: Number(form.staleDays) || 14,
  // Number("") is 0 and Number(undefined) is NaN, so neither ?? nor || says what is meant here: nought days is a
  // real answer (warn on the day it lapses), and nothing at all means the default.
  quotationExpiryDays: Number.isFinite(Number(form.quotationExpiryDays)) && form.quotationExpiryDays !== "" ? Number(form.quotationExpiryDays) : 3,
});

export function validateSettings(form = {}) {
  const errors = {};
  if (form.assignmentMode === "fixed" && !form.fixedOwnerId) errors.fixedOwnerId = "Who should every enquiry go to?";
  const hours = Number(form.uncontactedHours);
  if (!(hours >= 1 && hours <= 720)) errors.uncontactedHours = "Between 1 and 720 hours";
  const stale = Number(form.staleDays);
  if (!(stale >= 1 && stale <= 365)) errors.staleDays = "Between 1 and 365 days";
  return errors;
}

// ---- exports (CSV) -------------------------------------------------------------------------------------------------

// { headers, rows }, which is what utils/format.js `downloadCSV(filename, headers, rows)` takes.
export const leadsCsv = (rows = []) => ({
  headers: ["Lead no.", "Name", "Company", "Phone", "Email", "Source", "Status", "Owner", "Expected value", "Score", "Next action"],
  rows: rows.map((r) => [
    r.leadNo, r.name, r.company, r.phone, r.email, sourceLabel(r.source), STATUS_LABEL[r.status] || r.status,
    r.ownerName, r.expectedValue, r.score, r.nextActionAt || "",
  ]),
});

export const pipelineCsv = (stages = []) => ({
  headers: ["Stage", "Chance", "Deals", "Value", "Weighted"],
  rows: stages.map((s) => [s.name, `${s.probability}%`, s.count, s.value, s.weighted]),
});
