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

// ---- people ---------------------------------------------------------------------------------------------------

export const emptyContact = (partyKind = "", partyId = "") => ({
  name: "", designation: "", email: "", phone: "", isPrimary: false, notes: "",
  partyKind: partyKind || "", partyId: partyId || "",
});

/** A person needs a name. Everything else is optional, because a contact is usually a business card. */
export function validateContact(form = {}) {
  const errors = {};
  if (!String(form.name || "").trim()) errors.name = "Who is it?";
  if (String(form.email || "").trim() && !isEmail(form.email)) errors.email = "That does not look like an email address";
  return errors;
}

export const contactBody = (form = {}) => {
  const body = {
    name: String(form.name || "").trim(),
    designation: String(form.designation || "").trim(),
    email: String(form.email || "").trim(),
    phone: String(form.phone || "").trim(),
    isPrimary: Boolean(form.isPrimary),
    notes: String(form.notes || "").trim(),
  };
  // A person works for a customer OR a supplier; the server refuses both, so only the chosen one is ever sent.
  const id = String(form.partyId || "").trim();
  if (form.partyKind === "customer") body.customerId = id || null;
  else if (form.partyKind === "vendor") body.vendorId = id || null;
  else {
    body.customerId = null;
    body.vendorId = null;
  }
  return body;
};

export const partyLabelOf = (row = {}) => (row.partyKind === "vendor" ? "Supplier" : row.partyKind === "customer" ? "Customer" : "Nobody yet");

export const contactsCsv = (rows = []) => ({
  headers: ["Name", "Job title", "Works for", "Company", "Phone", "Email", "Main contact"],
  rows: rows.map((r) => [
    r.name || "",
    r.designation || "",
    partyLabelOf(r),
    r.partyName || "",
    r.phone || "",
    r.email || "",
    r.isPrimary ? "Yes" : "",
  ]),
});

export const communicationsCsv = (rows = []) => ({
  headers: ["When", "Kind", "What", "About", "Owner", "Status", "Outcome", "Due"],
  rows: rows.map((r) => [
    r.createdAt || "",
    kindLabel(r.kind),
    r.subject || "",
    r.regarding?.kind || "",
    r.ownerName || "",
    r.status || "",
    outcomeLabel(r.outcome),
    r.dueAt || "",
  ]),
});

/** The Communications tabs: one log, read five ways. "all" is first because the log is the point. */
export const COMM_TABS = [
  ["all", "All"],
  ["call", "Calls"],
  ["visit", "Visits"],
  ["whatsapp", "Messages"],
  ["note", "Notes"],
];

/** The named reports, in the order a sales manager reads them. */
export const REPORT_TABS = [
  ["pipeline", "Pipeline"],
  ["conversion", "Lead conversion"],
  ["winloss", "Win / loss"],
  ["performance", "Sales performance"],
  ["aging", "Aging"],
  ["deals", "Deals"],
  ["activity", "Communications"],
];

export const agingCsv = (rows = []) => ({
  headers: ["Deal", "Customer", "Stage", "Owner", "Days on this stage", "Value", "Expected close", "Past its close date"],
  rows: rows.map((r) => [r.opportunityNo, r.customerName, r.stageName, r.ownerName, r.days, r.value, r.expectedCloseDate || "", r.overdueClose ? "Yes" : ""]),
});

export const dealsCsv = (rows = []) => ({
  headers: ["Deal", "Title", "Customer", "Stage", "Status", "Owner", "Value", "Expected close"],
  rows: rows.map((r) => [r.opportunityNo, r.title, r.customerName, r.stageName, r.status, r.ownerName, r.value, r.expectedCloseDate || ""]),
});

// The CRM's categorical colours, assigned in a FIXED order and never cycled: a stage keeps its colour however
// many stages are on screen, so a filter that drops one cannot repaint the rest. They are the five chart tokens
// the rest of the product uses (already contrast-tested in both themes); past five, stages share the last one
// rather than inventing a hue nobody validated.
// Teal first and ink LAST: the first thing in a chart should not be near-black (which is what the home dashboard's
// single-series bars use for "this is the measure", not for "this is a category").
export const CHART_HUES = ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-1)"];

export const hueFor = (index) => CHART_HUES[Math.min(Math.max(0, index), CHART_HUES.length - 1)];

/** Stage colours follow pipeline ORDER, so the eye reads left-to-right down the funnel. Won and lost are status. */
export function stageHues(stages = []) {
  const open = stages.filter((s) => (s.type || "open") === "open");
  const map = {};
  open.forEach((s, i) => {
    map[s.key] = hueFor(i);
  });
  for (const s of stages) {
    if (s.type === "won") map[s.key] = "var(--status-success)";
    if (s.type === "lost") map[s.key] = "var(--status-danger)";
  }
  return map;
}

// ---- days, the task board and the calendar --------------------------------------------------------------------
//
// Every day here is a "YYYY-MM-DD" string and every shift is done ON that string, in UTC, never through a local
// clock: a day does not have a time zone, and the organisation's own "today" comes from the server (the screens
// are handed it), so nothing here ever asks the browser what day it is.

export const shiftDay = (day, delta) => {
  const [y, m, d] = String(day).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

/** Whole days from a to b; negative when b is earlier. */
export const daysBetween = (a, b) => Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86400000);
const ymd = (day) => {
  const [y, m, d] = String(day).split("-").map(Number);
  return [y, m - 1, d];
};

/**
 * The columns of the task board, by WHEN. Late cannot be dropped on: nobody reschedules something INTO being late.
 * Each droppable column names the one day a drop sets, and the screen prints it in the column's header - so a card
 * dropped on "Within a week" is never a surprise about which day it landed on.
 */
export const TASK_BUCKETS = [
  { key: "late", label: "Late", drop: null },
  { key: "today", label: "Today", drop: 0 },
  { key: "tomorrow", label: "Tomorrow", drop: 1 },
  { key: "week", label: "Within a week", drop: 7 },
  { key: "later", label: "Later", drop: 30 },
];

export function taskBucket(row, today) {
  if (!row?.dueAt || !today) return "later";
  const gap = daysBetween(today, row.dueAt);
  if (gap < 0) return "late";
  if (gap === 0) return "today";
  if (gap === 1) return "tomorrow";
  return gap <= 7 ? "week" : "later";
}

/** The day a card dropped on this column is given. null for a column that takes no drops. */
export function bucketTarget(key, today) {
  const column = TASK_BUCKETS.find((b) => b.key === key);
  return column && column.drop !== null && today ? shiftDay(today, column.drop) : null;
}

/** Open follow-ups sorted into the board's columns. Every column is present, even empty, so a drop target always exists. */
export function groupTasks(rows = [], today = null) {
  const out = Object.fromEntries(TASK_BUCKETS.map((b) => [b.key, []]));
  for (const row of rows) out[taskBucket(row, today)].push(row);
  for (const key of Object.keys(out)) out[key].sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  return out;
}

/** The board's other reading: by PERSON. "Nobody" is a column but never a drop target (the server cannot un-assign). */
export function groupByPerson(rows = [], owners = []) {
  const out = { __nobody__: [] };
  for (const o of owners) out[o.id] = [];
  for (const row of rows) {
    const key = row.ownerId && out[row.ownerId] ? row.ownerId : "__nobody__";
    out[key].push(row);
  }
  return out;
}

// ---- the month grid ---------------------------------------------------------------------------------------------

export const monthKeyOf = (day) => String(day).slice(0, 7);

export const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * The weeks a month occupies, as full rows of seven days - including the tail of the month before and the head of
 * the next, so the grid is always a clean rectangle. `weekStart` is 0 for Sunday and 1 for Monday (the default;
 * most of the markets this is sold into start the working week on a Monday).
 */
export function monthWeeks(key, weekStart = 1) {
  const first = `${key}-01`;
  const [y, m] = key.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() - weekStart + 7) % 7;
  const total = Math.ceil((lead + new Date(Date.UTC(y, m, 0)).getUTCDate()) / 7) * 7;
  const weeks = [];
  for (let i = 0; i < total; i += 7) {
    weeks.push(
      Array.from({ length: 7 }, (_, j) => {
        const day = shiftDay(first, i + j - lead);
        return { day, inMonth: monthKeyOf(day) === key };
      })
    );
  }
  return weeks;
}

/** The first and last day the grid shows, which is what the calendar asks the server for. */
export function monthRange(key, weekStart = 1) {
  const weeks = monthWeeks(key, weekStart);
  return { from: weeks[0][0].day, to: weeks[weeks.length - 1][6].day };
}

export const WEEKDAYS = (weekStart = 1) => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return [...names.slice(weekStart), ...names.slice(0, weekStart)];
};

/** Calendar items grouped by their day. */
export function itemsByDay(items = []) {
  const out = {};
  for (const item of items) (out[item.day] ||= []).push(item);
  return out;
}

/** The calendar's layers. Enquiries start OFF: they are the noisiest, and the market's own advice is an uncluttered month. */
export const CALENDAR_LAYERS = [
  { key: "activity", label: "Follow-ups", on: true },
  { key: "deal", label: "Deals closing", on: true },
  { key: "lead", label: "Enquiries", on: false },
];

/** Every day from `from` to `to`, with the count where there is one and nothing where there is not (a quiet day is a bar of nothing, not a gap). */
export function fillDays(rows = [], from, to) {
  if (!from || !to || from > to) return [];
  const counts = new Map((rows || []).map((r) => [r.day, r.count]));
  const out = [];
  for (let d = from, guard = 0; d <= to && guard < 400; d = shiftDay(d, 1), guard += 1) out.push({ day: d, count: counts.get(d) || 0 });
  return out;
}

/** How long a deal has stood still, as a scale from healthy to worrying. Status colours, because age IS a state here. */
export const AGE_HUES = ["var(--status-success)", "var(--chart-4)", "var(--status-warning)", "var(--chart-5)", "var(--status-danger)"];
