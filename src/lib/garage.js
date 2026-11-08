// Pure rules of the Garage screens (Board / Job cards / Vehicles): the words for a job card's and a task's
// state, due-date wording, and refusal messages. The server decides everything again
// (trade ERP node/utils/garage.js) - this only turns its answers into what a screen shows.

export const JOB_STATUS = {
  DRAFT: { label: "Draft", tone: "neutral" },
  AWAITING_APPROVAL: { label: "Waiting for approval", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  READY: { label: "Ready for collection", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "info" },
  CLOSED: { label: "Closed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const TASK_STATUS = {
  WAITING: { label: "Waiting", tone: "neutral" },
  READY: { label: "Ready", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  DONE: { label: "Done", tone: "success" },
  SKIPPED: { label: "Skipped", tone: "neutral" },
};

export const DUE_LABEL = { overdue: "Overdue", today: "Due today", tomorrow: "Due tomorrow" };
export const DUE_TONE = { overdue: "danger", today: "warning", tomorrow: "info" };

export const INVOICE_STATUS_LABEL = { NONE: "Not invoiced", DRAFT: "Invoice drafted", INVOICED: "Invoiced" };

// How a job is paid for (trade ERP node/models/modules/garage/jobCardModel.js jobType enum; "retail" is
// the default, every other value is typed by the advisor at check-in). Order matters: it is the order the
// job-cards register's own filter lists them in.
export const JOB_TYPES = ["retail", "insurance", "warranty", "internal", "fleet"];
export const JOB_TYPE_LABEL = { retail: "Retail", insurance: "Insurance", warranty: "Warranty", internal: "Internal", fleet: "Fleet" };

// A bay's own kind (trade ERP node/models/modules/garage/bayModel.js), for the Setup screen's picker and list.
export const BAY_KIND_LABEL = { mechanical: "Mechanical", body: "Body", paint: "Paint", wash: "Wash", other: "Other" };

// The walk-around (trade ERP node/utils/garage.js CHECK_IN_ITEMS / DAMAGE_KINDS): what a customer commonly
// leaves in the car, and the kinds of mark a check-in records against a panel.
export const CHECK_IN_ITEMS = ["Spare wheel", "Jack and tools", "Wheel spanner", "Stereo / screen", "Floor mats", "First-aid kit", "Fire extinguisher", "Registration card", "Fuel card", "Personal items"];
export const DAMAGE_KINDS = ["scratch", "dent", "crack", "chip", "rust", "missing", "broken"];

// An insurance claim's own words (trade ERP node/utils/insuranceClaims.js): DRAFT -> SUBMITTED -> SURVEYED ->
// APPROVED | PARTLY_APPROVED | REJECTED -> INVOICED. There is no stored "settled" - whether the insurer has
// actually paid is read off the invoice itself, never a claim status.
export const CLAIM_STATUS = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "warning" },
  SURVEYED: { label: "Surveyed", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  PARTLY_APPROVED: { label: "Partly approved", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" },
  INVOICED: { label: "Invoiced", tone: "success" },
};

// How long a job (or an open claim) has sat, as the server bands it (trade ERP node/utils/garage.js
// ageBand / utils/insuranceClaims.js claimAgeing: the same non-overlapping convention, under 5 days,
// 5-9, 10-14, 15 or more). Status tokens, not a plain progression - CLAUDE.md's own reasoning for the
// dashboard's age scale applies here word for word: this is how worried to be, not merely how long.
export const AGE_BAND_LABEL = { u5: "Under 5 days", b5_9: "5-9 days", b10_14: "10-14 days", o15: "15+ days" };
export const AGE_BAND_TONE = { u5: "neutral", b5_9: "info", b10_14: "warning", o15: "danger" };

// The four claims-ageing buckets (utils/insuranceClaims.js claimAgeing), a different convention from the
// job-ageing bands above (inclusive upper bounds, days since SUBMISSION rather than since the vehicle was
// received) - kept apart on purpose rather than forced to share one table.
export const CLAIM_AGE_BUCKET_LABEL = { "0-7": "0-7 days", "8-14": "8-14 days", "15-30": "15-30 days", "30+": "30+ days" };
export const CLAIM_AGE_BUCKET_TONE = { "0-7": "neutral", "8-14": "info", "15-30": "warning", "30+": "danger" };

// A UAE plate in full, the way a workshop reads one off the car: the issuing emirate, the plate's own
// code/category box, then the number - each only when it is actually set, so an older record with just a
// plateNumber reads exactly as it always did. Falls back to the chassis for a vehicle checked in with no
// plate yet. One helper for every place a vehicle is named (G7) - the vehicle screen, the register and the
// board - so the three pieces (captured on VehicleForm, shown nowhere until this) cannot read differently
// from one screen to the next.
export function vehiclePlateText(v) {
  if (!v) return "";
  const parts = [v.plateEmirate, v.plateCode, v.plateNumber].filter(Boolean);
  return parts.length ? parts.join(" · ") : v.chassisNo || "";
}

// A job card's own words for the current task on the board - "Ready to finish" when every task is settled,
// the task's name and state otherwise.
export function jobCardLabel(card) {
  if (!card.taskName) return { label: "Ready to finish", tone: "success" };
  return TASK_STATUS[card.taskStatus] || { label: card.taskStatus || "", tone: "neutral" };
}

// A line's own state on the estimate (D21): `approved === false` means two different things - declined
// at the first decision, or a later supplementary line nobody has decided on yet - and the two are told
// apart ONLY where it is unambiguous: a line from the ORIGINAL estimate (addedInVersion 1) once the card
// has moved past AWAITING_APPROVAL can only be declined, because the first decision settles every
// version-1 line, true or false, with nothing left pending from it. A later-version line that is still
// false stays "Pending" - it may yet be decided in the next round. One function, so the estimate tab and
// the primary-action rule below can never disagree about which line is still waiting.
export function lineDecisionLabel(line, status) {
  if (line.invoiced) return { label: "Invoiced", tone: "info", declined: false, pending: false };
  const declined = line.approved === false && (line.addedInVersion || 1) <= 1 && !["DRAFT", "AWAITING_APPROVAL"].includes(status);
  const pending = line.approved === false && !declined;
  if (declined) return { label: "Declined", tone: "neutral", declined: true, pending: false };
  if (pending) return { label: "Pending", tone: "warning", declined: false, pending: true };
  return { label: "Approved", tone: "success", declined: false, pending: false };
}

// The job-card detail's four tabs, and which one opens first for a given status - so a technician lands
// on tasks, an advisor on the estimate, and the counter on money, without a click to get there.
export const JOB_TABS = [
  ["job", "The job"],
  ["estimate", "The estimate"],
  ["work", "The work"],
  ["money", "Money"],
];
export function defaultJobTab(status) {
  if (status === "DRAFT" || status === "AWAITING_APPROVAL") return "estimate";
  if (status === "IN_PROGRESS") return "work";
  if (status === "READY" || status === "DELIVERED" || status === "CLOSED") return "money";
  return "job";
}

// One label and one permission per job-card action, read by both the primary button and the overflow
// menu - so the two can never show different words for the same action.
export const JOB_ACTION_LABEL = {
  edit: "Edit", delete: "Delete", checkIn: "Check-in", cancel: "Cancel job",
  sendEstimate: "Send estimate", recordApproval: "Record decision",
  reviseEstimate: "Supplementary estimate", createInvoice: "Raise invoice", release: "Release vehicle",
};
export const JOB_ACTION_PERMISSION = {
  edit: "garage.edit", delete: "garage.delete", checkIn: "garage.edit", cancel: "garage.edit",
  sendEstimate: "garage.edit", recordApproval: "garage.approve",
  reviseEstimate: "garage.edit", createInvoice: "garage.invoice", release: "garage.approve",
};

// The one loud button for the card's current status, from the same `card.actions` flags the old nine-
// button footer read - this only decides which ONE to lead with; every flag still gates its own button
// exactly as before (jobOverflowActions below draws the rest). Never a check on any one line's approval
// state for RELEASE or INVOICE - a card with a declined line still releases and bills correctly; what
// decides the primary here is only whether anything is left for a human to DECIDE right now.
export function jobPrimaryAction(card) {
  const a = card.actions || {};
  const act = (key) => ({ key, label: JOB_ACTION_LABEL[key], permission: JOB_ACTION_PERMISSION[key] });
  if (card.status === "DRAFT") {
    if (!(card.lines || []).length) return a.edit ? act("edit") : null;
    if (a.sendEstimate) return act("sendEstimate");
    return a.edit ? act("edit") : null;
  }
  if (card.status === "AWAITING_APPROVAL") return a.recordApproval ? act("recordApproval") : null;
  if (card.status === "IN_PROGRESS") {
    // A supplementary line nobody has decided on yet outranks billing what has already been approved.
    const undecided = (card.lines || []).some((l) => lineDecisionLabel(l, card.status).pending);
    if (undecided && a.recordApproval) return act("recordApproval");
    const settled = (card.tasks || []).length > 0 && card.tasks.every((t) => t.status === "DONE" || t.status === "SKIPPED");
    if (settled && a.createInvoice) return act("createInvoice");
    return null; // work is still open; advancing it happens on the task rows, not up here
  }
  if (card.status === "READY") {
    // Invoice before release: both are true at READY, and the board's own danger tile is "Delivered,
    // not invoiced" - making Release the loud button here is the product manufacturing its own red tile.
    if (a.createInvoice) return act("createInvoice");
    if (a.release) return act("release");
    return null;
  }
  if (card.status === "DELIVERED") return a.createInvoice ? act("createInvoice") : null;
  return null; // CLOSED and CANCELLED: every action flag is false
}

// Every other action the card's status allows, in one steady order, Delete last and marked danger -
// whatever jobPrimaryAction chose is left out so the two can never show the same action twice.
const OVERFLOW_ORDER = ["sendEstimate", "edit", "recordApproval", "reviseEstimate", "createInvoice", "release", "checkIn", "cancel", "delete"];
export function jobOverflowActions(card) {
  const a = card.actions || {};
  const primary = jobPrimaryAction(card);
  return OVERFLOW_ORDER.filter((key) => a[key] && key !== primary?.key).map((key) => ({
    key, label: JOB_ACTION_LABEL[key], permission: JOB_ACTION_PERMISSION[key], danger: key === "delete",
  }));
}

// A refusal the server did not already word plainly. Everything else falls back to err.message, which the
// server writes for a person to read (CLAUDE.md: "the message IS the UI text" for garage's own codes).
const WORDS = {
  PERMISSION_DENIED: (e) => e.message,
  LINE_KIND_MISMATCH: (e) => e.message,
  PAYMENT_DUE: (e) => `${e.details?.outstanding ?? ""} is still owed on this job. Take the payment, or release it on account.`,
  WORK_NOT_FINISHED: () => "Some work is still open. Finish or skip every task first.",
  JOB_NOT_AWAITING_APPROVAL: (e) => e.message,
  NOTHING_TO_INVOICE: (e) => e.message || "There is nothing approved to invoice.",
  // A line already carried on some other invoice (this job's own, or an insurance claim's) - the server's own
  // wording differs by which door it was hit from, so it is read straight through, not re-worded here.
  ALREADY_INVOICED: (e) => e.message,
  JOB_CANCELLED: () => "This job was cancelled.",
  INVALID_DAMAGE_KIND: (e) => e.message,
  // Insurance claims
  NOT_AN_INSURER: (e) => e.message,
  CLAIM_ALREADY_EXISTS: () => "This job card already has a claim.",
  CLAIM_NOT_DRAFT: (e) => e.message,
  CLAIM_NOT_SUBMITTED: (e) => e.message,
  CLAIM_NOT_SURVEYED: (e) => e.message,
  CLAIM_NOT_APPROVED: (e) => e.message,
  LPO_REQUIRED: () => "Enter the LPO or approval number the insurer gave.",
  // Setup
  BAY_NAME_REQUIRED: (e) => e.message,
  SERVICE_CODE_REQUIRED: (e) => e.message,
  SERVICE_CODE_TAKEN: () => "A service with this code already exists.",
  SERVICE_NAME_REQUIRED: (e) => e.message,
  SERVICE_ITEM_REQUIRED: (e) => e.message,
  ITEM_NOT_A_SERVICE: (e) => e.message,
  // Shortages / purchase orders
  NOTHING_TO_ORDER: () => "Choose at least one item to order.",
  VENDOR_REQUIRED: () => "Choose who to order from.",
};
export const garageErrorText = (err) => (err ? (WORDS[err.code] ? WORDS[err.code](err) : err.message || "Something went wrong") : "");
