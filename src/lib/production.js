// Pure rules of the Production screen (Inventory > Production): the form, its live totals, the request body and the
// words for each refusal. The server decides everything again (trade ERP node/utils/production.js); this is what the
// person sees while typing.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const round5 = (n) => Math.round((Number(n) + Number.EPSILON) * 1e5) / 1e5;
const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));

export const STATUS = {
  DRAFT: { label: "Draft", tone: "neutral" },
  POSTED: { label: "Posted", tone: "success" },
  REVERSED: { label: "Reversed", tone: "warning" },
};

export const emptyMaterial = () => ({ stockId: "", qty: "" });
export const emptyCost = () => ({ accountId: "", amount: "", narration: "" });

export const emptyForm = (today = "") => ({
  date: today,
  finishedId: "",
  qty: "1",
  batchNumber: "",
  materials: [emptyMaterial()],
  costs: [emptyCost()],
  notes: "",
});

const dayOf = (d) => (d ? String(typeof d === "string" ? d : new Date(d).toISOString()).slice(0, 10) : "");

export function formFromProduction(p) {
  return {
    date: dayOf(p.date),
    finishedId: String(p.finished?.stockId || ""),
    qty: String(p.finished?.qty ?? ""),
    batchNumber: p.finished?.batchNumber || "",
    materials: (p.materials || []).map((m) => ({ stockId: String(m.stockId), qty: String(m.qty) })),
    costs: (p.costs || []).map((c) => ({ accountId: String(c.accountId), amount: String(c.amount), narration: c.narration || "" })),
    notes: p.notes || "",
  };
}

// A line the person has not started is not an error: it is left out.
const started = (line) => Object.entries(line).some(([k, v]) => k !== "narration" && String(v ?? "").trim() !== "");

// Errors by field ("qty", "materials.0.qty", ...). Empty: the form can be saved.
export function validateForm(form) {
  const e = {};
  if (!form.finishedId) e.finishedId = "Choose the item this production makes";
  if (!(num(form.qty) > 0)) e.qty = "Enter how many were made";
  const materials = form.materials.filter(started);
  const costs = form.costs.filter(started);
  form.materials.forEach((m, i) => {
    if (!started(m)) return;
    if (!m.stockId) e[`materials.${i}.stockId`] = "Choose the material";
    else if (m.stockId === form.finishedId) e[`materials.${i}.stockId`] = "An item cannot be used to make itself";
    if (!(num(m.qty) > 0)) e[`materials.${i}.qty`] = "Enter the quantity used";
  });
  form.costs.forEach((c, i) => {
    if (!started(c)) return;
    if (!c.accountId) e[`costs.${i}.accountId`] = "Choose the expense";
    const amount = num(c.amount);
    if (!(amount > 0)) e[`costs.${i}.amount`] = "Enter the amount";
    else if (Math.abs(round2(amount) - amount) > 1e-9) e[`costs.${i}.amount`] = "Use at most two decimals";
  });
  if (!materials.length && !costs.length) e.lines = "Add at least one material or one cost";
  return e;
}

export function buildBody(form) {
  return {
    date: form.date || undefined,
    finished: { stockId: form.finishedId, qty: Number(form.qty), ...(form.batchNumber.trim() ? { batchNumber: form.batchNumber.trim() } : {}) },
    materials: form.materials.filter(started).map((m) => ({ stockId: m.stockId, qty: Number(m.qty) })),
    costs: form.costs.filter(started).map((c) => ({ accountId: c.accountId, amount: Number(c.amount), ...(c.narration.trim() ? { narration: c.narration.trim() } : {}) })),
    notes: form.notes.trim() || undefined,
  };
}

// What the form adds up to today: each material at the average cost it would leave at (the item's purchasePrice),
// the costs as typed. `stocks` is the item list (`_id`, purchasePrice, currentStock).
export function formTotals(form, stocks = []) {
  const byId = new Map(stocks.map((s) => [String(s._id), s]));
  const materialLines = form.materials.filter(started).map((m) => {
    const s = byId.get(String(m.stockId));
    const qty = num(m.qty) > 0 ? Number(m.qty) : 0;
    const rate = Number(s?.purchasePrice) || 0;
    const onHand = Number(s?.currentStock) || 0;
    return { stockId: m.stockId, qty, rate, cost: round2(qty * rate), onHand, short: s ? Math.max(0, round5(qty - onHand)) : 0 };
  });
  const materials = round2(materialLines.reduce((t, l) => t + l.cost, 0));
  const costs = round2(form.costs.filter(started).reduce((t, c) => t + (num(c.amount) > 0 ? Number(c.amount) : 0), 0));
  const total = round2(materials + costs);
  const qty = num(form.qty) > 0 ? Number(form.qty) : 0;
  return { materialLines, materials, costs, total, unitCost: qty ? round5(total / qty) : 0, hasCosts: form.costs.some(started) };
}

const WORDS = {
  INSUFFICIENT_STOCK: (e) => `Not enough on hand: ${e.message}`,
  LATER_MOVEMENTS_EXIST: () => "Its items have moved since that date. Date the production today.",
  LEDGER_POSTING_OFF: () => "Ledger posting is off, so costs cannot be moved into stock. Switch ledger posting on (Accounting setup), or post with materials only.",
  FINISHED_STOCK_USED: (e) => e.message,
  BATCH_PARTLY_USED: () => "Some of the goods it made have already been sold or used, so it cannot be reversed.",
  PRODUCTION_NOT_DRAFT: (e) => e.message,
  PRODUCTION_NOT_POSTED: (e) => e.message,
  INVALID_COST_ACCOUNT: (e) => e.message,
  MATERIAL_IS_FINISHED_ITEM: () => "An item cannot be used to make itself.",
  SERVICE_HAS_NO_STOCK: () => "A service item has no stock, so it cannot be made or used in a production.",
  PERIOD_CLOSED: (e) => `That date is in a closed period: ${e.message}`,
};

export function errorText(err) {
  if (!err) return "";
  const f = WORDS[err.code];
  return f ? f(err) : err.message || "Something went wrong";
}

// The warnings a post answered with (409 PRODUCTION_WARNINGS), for the tick dialog.
export const warningsOf = (err) => (err?.code === "PRODUCTION_WARNINGS" ? err.details?.warnings || [] : []);
