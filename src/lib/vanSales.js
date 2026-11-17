// Van sales: the pure rules the screens use (no React, no network). The server stays the authority - every check here
// only saves a round trip - so these mirror utils/vanSales.js on the backend rather than import it.

export const TRIP_STATUS = {
  LOADING: { label: "Loading", tone: "info" },
  ON_ROUTE: { label: "On the road", tone: "success" },
  UNLOADED: { label: "Counted in", tone: "warning" },
  SETTLED: { label: "Settled", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};
export const statusOf = (s) => TRIP_STATUS[s] || { label: s || "", tone: "neutral" };

// The step a trip is waiting at, in the words a salesman or a supervisor would use.
export function nextStep(trip) {
  switch (trip?.status) {
    case "LOADING": return trip.loads?.length ? "Send the van out" : "Load the van";
    case "ON_ROUTE": return "Sell and collect, then count the van back in";
    case "UNLOADED": return "Settle the day";
    case "SETTLED": return "Done";
    case "CANCELLED": return "Cancelled";
    default: return "";
  }
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;
export const round3 = (n) => Math.round((num(n) + Number.EPSILON) * 1000) / 1000;

/** A load form row set -> the body the server takes, dropping blanks. */
export function loadBody(rows) {
  return { lines: (rows || []).filter((r) => r.stockId && num(r.qty) > 0).map((r) => ({ stockId: r.stockId, qty: num(r.qty) })) };
}

/** Why a load form cannot be saved yet (the server checks the stock itself), or "". */
export function loadProblem(rows) {
  const used = (rows || []).filter((r) => r.stockId || num(r.qty) > 0);
  if (!used.length) return "Add at least one item.";
  if (used.some((r) => !r.stockId)) return "Choose an item on every line.";
  if (used.some((r) => !(num(r.qty) > 0))) return "Enter a quantity above zero on every line.";
  const seen = new Set();
  for (const r of used) {
    if (seen.has(r.stockId)) return "An item is on two lines. Put its quantity on one.";
    seen.add(r.stockId);
  }
  return "";
}

/** The sale lines of the sell form: price defaults to the van's list price for the item. */
export function saleLines(rows, onVan = []) {
  const byId = new Map((onVan || []).map((l) => [l.stockId, l]));
  return (rows || [])
    .filter((r) => r.itemId && num(r.qty) > 0)
    .map((r) => {
      const l = byId.get(r.itemId);
      return { itemId: r.itemId, qty: num(r.qty), price: r.price === "" || r.price == null ? num(l?.salesPrice) : num(r.price) };
    });
}

/** What the lines come to before VAT (the server prices the real invoice: this is the figure shown while typing). */
export const saleSubtotal = (lines) => round2((lines || []).reduce((t, l) => t + num(l.qty) * num(l.price), 0));

/** Why a sale cannot be made yet, or "". Quantity above what is on the van is the common one. */
export function saleProblem({ customerId, rows }, onVan = []) {
  if (!customerId) return "Choose the customer.";
  const lines = (rows || []).filter((r) => r.itemId || num(r.qty) > 0);
  if (!lines.length) return "Add at least one item.";
  const have = new Map((onVan || []).map((l) => [l.stockId, num(l.qty)]));
  const wanted = new Map();
  for (const r of lines) {
    if (!r.itemId) return "Choose an item on every line.";
    if (!(num(r.qty) > 0)) return "Enter a quantity above zero on every line.";
    wanted.set(r.itemId, round3((wanted.get(r.itemId) || 0) + num(r.qty)));
  }
  for (const [id, w] of wanted) {
    if (w > (have.get(id) || 0) + 1e-9) {
      const name = (onVan || []).find((l) => l.stockId === id)?.itemName || "that item";
      return `Only ${have.get(id) || 0} of ${name} is on the van.`;
    }
  }
  return "";
}

/** Count-back rows from what the van should hold: every sellable and damaged item, counted as found = expected to start. */
export function countRows(trip) {
  const rows = new Map();
  for (const l of trip?.sellable || []) rows.set(l.stockId, { stockId: l.stockId, itemName: l.itemName, expectedGood: num(l.qty), expectedDamaged: 0, good: String(l.qty), damaged: "0" });
  for (const l of trip?.damaged || []) {
    const cur = rows.get(l.stockId) || { stockId: l.stockId, itemName: l.itemName, expectedGood: 0, good: "0" };
    rows.set(l.stockId, { ...cur, expectedDamaged: num(l.qty), damaged: String(l.qty) });
  }
  return [...rows.values()];
}

/** The body for unloading: what was found, per item. */
export const unloadBody = (rows) => ({ counts: (rows || []).map((r) => ({ stockId: r.stockId, good: num(r.good), damaged: num(r.damaged) })) });

/** How a counted row differs from what it should be: units found less units expected (a damaged unit is still a unit). */
export const countDifference = (r) => round3(num(r.good) + num(r.damaged) - r.expectedGood - r.expectedDamaged);

/** What a settlement does to the cash, from the two figures typed. Mirrors the server's journal (it always balances). */
export function cashPlan(expected, handed) {
  const e = round2(expected);
  const h = round2(handed);
  return { expected: e, handed: h, short: h < e ? round2(e - h) : 0, over: h > e ? round2(h - e) : 0, variance: round2(h - e) };
}

const WORDS = {
  VAN_STOCK_SHORT: (e) => {
    const s = e.details?.short?.[0];
    return s ? `Only ${s.available} of that is on the van; this sells ${s.wanted}.` : "There is not enough of that on the van.";
  },
  INSUFFICIENT_STOCK: (e) => e.message,
  TRIP_NOT_SELLING: () => "This trip is not out on the road, so nothing can be sold on it.",
  VAN_TRIP_CLOSED: () => "This trip is closed, so nothing more can be approved on it.",
  VAN_HAS_OPEN_TRIP: () => "That van still has a trip that is not settled. Settle it first.",
  VAN_SETTLE_WARNINGS: () => "There are differences to tick before this trip can be settled.",
  VAN_SETTLE_BLOCKED: (e) => e.message,
  NOTHING_LOADED: () => "Load the van before it goes out.",
  TRIP_HAS_ACTIVITY: () => "Something has been sold or collected on this trip, so it cannot be cancelled. Count the van back in and settle it.",
  RISK_WARNING_ACKNOWLEDGEMENT_REQUIRED: (e) => e.message,
  MODULE_NOT_IN_PLAN: () => "Van sales is not included in this organisation's plan.",
};
export const vanErrorText = (err) => (err ? (WORDS[err.code] ? WORDS[err.code](err) : err.message || "Something went wrong") : "");

/** A credit warning comes back as a 409 the person may press on past (with the right to). */
export const isCreditWarning = (err) => err?.code === "RISK_WARNING_ACKNOWLEDGEMENT_REQUIRED";

/** Items to offer on the sell screen: what is on the van, with how many. */
export const vanItems = (trip) => (trip?.sellable || []).map((l) => ({ value: l.stockId, label: `${l.itemName} (${l.qty} on van)`, qty: l.qty, price: l.salesPrice, name: l.itemName }));
