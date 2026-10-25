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
  NOTHING_TO_INVOICE: () => "There is nothing approved to invoice.",
};
export const garageErrorText = (err) => (err ? (WORDS[err.code] ? WORDS[err.code](err) : err.message || "Something went wrong") : "");
