// Pure rules of the Job work screens (Inventory > Production > Job work): the send form, the receive form and the
// words for each refusal. The server decides everything again (trade ERP node/utils/jobWork.js).

const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const JOB_STATUS = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "With job worker", tone: "warning" },
  PARTLY_RECEIVED: { label: "Partly received", tone: "warning" },
  RECEIVED: { label: "Received", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const emptyJobLine = () => ({ rawStockId: "", qtySent: "", finishedStockId: "", finishedPerRaw: "1" });
export const emptyJob = (today = "") => ({ jobWorkerId: "", date: today, purpose: "", vehicleNo: "", notes: "", lines: [emptyJobLine()] });

const dayOf = (d) => (d ? String(typeof d === "string" ? d : new Date(d).toISOString()).slice(0, 10) : "");
export const jobToForm = (j) => ({
  jobWorkerId: String(j.jobWorkerId || ""),
  date: dayOf(j.date),
  purpose: j.purpose || "",
  vehicleNo: j.vehicleNo || "",
  notes: j.notes || "",
  lines: (j.lines || []).map((l) => ({
    rawStockId: String(l.rawStockId), qtySent: String(l.qtySent), finishedStockId: String(l.finishedStockId), finishedPerRaw: String(l.finishedPerRaw ?? 1),
  })),
});

const started = (l) => Boolean(l.rawStockId || l.finishedStockId || String(l.qtySent ?? "").trim());

export function validateJob(form) {
  const e = {};
  if (!form.jobWorkerId) e.jobWorkerId = "Choose the job worker (the coater)";
  const lines = form.lines.filter(started);
  if (!lines.length) e.lines = "Add the item you send";
  form.lines.forEach((l, i) => {
    if (!started(l)) return;
    if (!l.rawStockId) e[`lines.${i}.rawStockId`] = "Choose the item you send";
    if (!l.finishedStockId) e[`lines.${i}.finishedStockId`] = "Choose the item that comes back";
    else if (l.finishedStockId === l.rawStockId) e[`lines.${i}.finishedStockId`] = "It must be a different item from the one sent (e.g. the coated one)";
    if (!(num(l.qtySent) > 0)) e[`lines.${i}.qtySent`] = "Enter how many you send";
    if (!(num(l.finishedPerRaw) > 0)) e[`lines.${i}.finishedPerRaw`] = "More than zero";
  });
  return e;
}

export const jobBody = (form) => ({
  jobWorkerId: form.jobWorkerId,
  date: form.date || undefined,
  purpose: form.purpose.trim() || undefined,
  vehicleNo: form.vehicleNo.trim() || undefined,
  notes: form.notes.trim() || undefined,
  lines: form.lines.filter(started).map((l) => ({ rawStockId: l.rawStockId, finishedStockId: l.finishedStockId, qtySent: Number(l.qtySent), finishedPerRaw: Number(l.finishedPerRaw) || 1 })),
});

// The receive form: one row per line still with the job worker. "Came back finished" starts empty; the raw used follows
// it from the line's ratio until the person types their own.
export function receiveRows(job) {
  const prog = new Map((job.progress?.lines || []).map((l) => [String(l.lineId), l]));
  return (job.lines || [])
    .map((l) => ({ line: l, at: prog.get(String(l._id))?.atWorker ?? 0 }))
    .filter((x) => x.at > 0)
    .map(({ line, at }) => ({
      lineId: String(line._id), rawName: line.rawName, finishedName: line.finishedName, ratio: Number(line.finishedPerRaw) || 1,
      atWorker: at, finishedQty: "", rawConsumed: "", rawConsumedTouched: false, rawReturned: "",
    }));
}

export const rawUsedFor = (row) => (num(row.finishedQty) > 0 ? round3(Number(row.finishedQty) / row.ratio) : 0);

export function setReceiveRow(row, patch) {
  const next = { ...row, ...patch };
  if ("rawConsumed" in patch) next.rawConsumedTouched = patch.rawConsumed !== "";
  if ("finishedQty" in patch && !next.rawConsumedTouched) next.rawConsumed = next.finishedQty === "" ? "" : String(rawUsedFor(next));
  return next;
}

export function validateReceive(rows) {
  const e = {};
  let any = false;
  rows.forEach((r, i) => {
    const f = num(r.finishedQty) || 0, used = r.rawConsumed === "" ? rawUsedFor(r) : num(r.rawConsumed), back = num(r.rawReturned) || 0;
    if ([f, used, back].some((v) => !(v >= 0))) { e[`rows.${i}`] = "Quantities cannot be negative"; return; }
    if (!f && !back) return;
    any = true;
    if (f > 0 && !(used > 0)) e[`rows.${i}`] = "Say how many sent units were used";
    else if (round3(used + back) > r.atWorker + 1e-9) e[`rows.${i}`] = `Only ${r.atWorker} still with the job worker`;
  });
  if (!any) e.rows = "Enter what came back";
  return e;
}

export const receiveBody = ({ rows, date, workerRef, costs }) => ({
  date: date || undefined,
  workerRef: workerRef.trim() || undefined,
  lines: rows
    .filter((r) => num(r.finishedQty) > 0 || num(r.rawReturned) > 0)
    .map((r) => ({
      lineId: r.lineId,
      finishedQty: num(r.finishedQty) || 0,
      rawConsumed: r.rawConsumed === "" ? rawUsedFor(r) : Number(r.rawConsumed),
      rawReturned: num(r.rawReturned) || 0,
    })),
  costs: costs.filter((c) => c.accountId && num(c.amount) > 0).map((c) => ({ accountId: c.accountId, amount: round2(c.amount), ...(c.narration?.trim() ? { narration: c.narration.trim() } : {}) })),
});

const WORDS = {
  INSUFFICIENT_STOCK: (e) => e.message,
  MORE_THAN_AT_WORKER: (e) => e.message,
  NOTHING_RECEIVED: () => "Enter what came back.",
  JOB_WORK_NOT_OPEN: (e) => e.message,
  JOB_WORK_NOT_DRAFT: (e) => e.message,
  JOB_WORK_NOT_CANCELLABLE: () => "Something has already come back on this job, so it cannot be cancelled. Reverse that receipt first.",
  SAME_ITEM: () => "The item that comes back must be a different item from the one sent (e.g. the coated one).",
  LEDGER_POSTING_OFF: () => "Ledger posting is off, so costs cannot be moved into stock. Switch ledger posting on, or receive without costs.",
  FINISHED_STOCK_USED: (e) => e.message,
  BATCH_PARTLY_USED: () => "Some of what came back has already been sold or used, so the receipt cannot be reversed.",
  PERIOD_CLOSED: (e) => `That date is in a closed period: ${e.message}`,
};
export const jobErrorText = (err) => (err ? (WORDS[err.code] ? WORDS[err.code](err) : err.message || "Something went wrong") : "");
