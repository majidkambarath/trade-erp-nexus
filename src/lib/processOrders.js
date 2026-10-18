// Pure rules of the Process screens (Inventory > Production > Board / Process orders): the order form, the words for a
// step's state and due date, and refusal messages. The server decides everything again (trade ERP node/utils/processOrders.js).

const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));

export const ORDER_STATUS = {
  DRAFT: { label: "Draft", tone: "neutral" },
  OPEN: { label: "In process", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

// A step's state in words; a job-work step in progress is "At job worker".
export function stepLabel(step) {
  if (step.status === "READY_TO_FINISH") return { label: "Ready to finish", tone: "success" };
  if (step.status === "DONE") return { label: "Done", tone: "success" };
  if (step.status === "IN_PROGRESS") return { label: step.mode === "job_work" ? "At job worker" : "In progress", tone: "warning" };
  if (step.status === "READY") return { label: step.mode === "job_work" ? "Ready to send" : "Ready", tone: "info" };
  return { label: "Waiting", tone: "neutral" };
}

export const DUE_LABEL = { overdue: "Overdue", today: "Due today", tomorrow: "Due tomorrow" };
export const DUE_TONE = { overdue: "danger", today: "warning", tomorrow: "info" };

export const emptyStep = () => ({ name: "", mode: "in_house", assigneeId: "", jobWorkerId: "", dueDate: "" });
export const emptyProcess = (today = "") => ({ finishedId: "", qty: "", dueDate: "", materials: [{ stockId: "", qty: "" }], steps: [emptyStep()], notes: "", date: today });
// Common steps, offered as quick picks when naming a step.
export const STEP_SUGGESTIONS = ["Cutting", "Bending", "Welding", "Drilling", "Polishing", "Painting", "Powder coating", "Plating", "Assembly", "Quality check", "Packing"];

const startedMaterial = (m) => Boolean(m.stockId || String(m.qty ?? "").trim());
const startedStep = (s) => Boolean(String(s.name || "").trim() || s.assigneeId || s.jobWorkerId || s.dueDate);

export function validateProcess(form) {
  const e = {};
  if (!form.finishedId) e.finishedId = "Choose the product to make";
  if (!(num(form.qty) > 0)) e.qty = "Enter how many to make";
  form.materials.forEach((m, i) => {
    if (!startedMaterial(m)) return;
    if (!m.stockId) e[`materials.${i}.stockId`] = "Choose the material";
    else if (m.stockId === form.finishedId) e[`materials.${i}.stockId`] = "A product cannot be made from itself";
    if (!(num(m.qty) > 0)) e[`materials.${i}.qty`] = "Enter the quantity";
  });
  const steps = form.steps.filter(startedStep);
  if (!steps.length) e.steps = "Add the steps the product goes through";
  const anyMaterial = form.materials.some((m) => m.stockId);
  form.steps.forEach((s, i) => {
    if (!startedStep(s)) return;
    if (!String(s.name || "").trim()) e[`steps.${i}.name`] = "Name the step";
    if (s.mode === "job_work" && !s.jobWorkerId) e[`steps.${i}.jobWorkerId`] = "Choose the job worker";
    if (s.mode === "job_work" && !anyMaterial) e[`steps.${i}.jobWorkerId`] = "A job-work step sends the material out: add the material first";
  });
  return e;
}

export const processBody = (form) => ({
  date: form.date || undefined,
  dueDate: form.dueDate || undefined,
  finished: { stockId: form.finishedId, qty: Number(form.qty) },
  materials: form.materials.filter(startedMaterial).map((m) => ({ stockId: m.stockId, qty: Number(m.qty) })),
  steps: form.steps.filter(startedStep).map((s) => ({
    name: s.name.trim(), mode: s.mode, dueDate: s.dueDate || undefined,
    ...(s.mode === "job_work" ? { jobWorkerId: s.jobWorkerId } : { assigneeId: s.assigneeId || undefined }),
  })),
  notes: form.notes.trim() || undefined,
});

const dayOf = (d) => (d ? String(d).slice(0, 10) : "");
export const processToForm = (o) => ({
  date: dayOf(o.date), dueDate: dayOf(o.dueDate), finishedId: String(o.finished?.stockId || ""), qty: String(o.finished?.qty ?? ""), notes: o.notes || "",
  materials: (o.materials || []).map((m) => ({ stockId: String(m.stockId), qty: String(m.qty) })),
  steps: (o.steps || []).map((s) => ({ name: s.name, mode: s.mode, assigneeId: s.assigneeId || "", jobWorkerId: s.jobWorkerId ? String(s.jobWorkerId) : "", dueDate: dayOf(s.dueDate) })),
});

// Steps copied from the product's last order (names and who does each; dates are the person's to set).
export const stepsFromLast = (last = []) => last.map((s) => ({ ...emptyStep(), name: s.name, mode: s.mode, assigneeId: s.assigneeId || "", jobWorkerId: s.jobWorkerId ? String(s.jobWorkerId) : "" }));

const WORDS = {
  STEP_NOT_READY: (e) => e.message,
  MORE_THAN_PLANNED: (e) => e.message,
  STEPS_NOT_DONE: () => "Every step must be done before the order is finished.",
  PROCESS_AT_JOB_WORKER: () => "Parts are out with a job worker on this order. Bring them back (or cancel that challan) first.",
  PROCESS_MOVED_ON: (e) => e.message,
  INSUFFICIENT_STOCK: (e) => e.message,
  LEDGER_POSTING_OFF: () => "Ledger posting is off, so costs cannot be moved into stock. Switch ledger posting on, or finish without costs.",
  FINISHED_STOCK_USED: (e) => e.message,
  PERMISSION_DENIED: (e) => e.message,
};
export const processErrorText = (err) => (err ? (WORDS[err.code] ? WORDS[err.code](err) : err.message || "Something went wrong") : "");
