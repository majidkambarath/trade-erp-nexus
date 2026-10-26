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

// A job card's own words for the current task on the board - "Ready to finish" when every task is settled,
// the task's name and state otherwise.
export function jobCardLabel(card) {
  if (!card.taskName) return { label: "Ready to finish", tone: "success" };
  return TASK_STATUS[card.taskStatus] || { label: card.taskStatus || "", tone: "neutral" };
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
};
export const garageErrorText = (err) => (err ? (WORDS[err.code] ? WORDS[err.code](err) : err.message || "Something went wrong") : "");
