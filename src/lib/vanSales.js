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

// Why a stop ended without a sale: the reasons the server accepts, in the words the salesman taps.
export const VISIT_REASONS = [
  ["closed", "Shop closed"],
  ["no_money", "No money today"],
  ["has_stock", "Still has stock"],
  ["refused", "Did not want to buy"],
  ["not_reached", "Could not reach"],
  ["other", "Something else"],
];
export const visitReasonLabel = (r) => (VISIT_REASONS.find(([k]) => k === r) || [r, r])[1];

/** Where a price came from, in a word for the sell screen. */
export const priceSourceLabel = (p) => (p?.source === "customer" ? p.listName || "Customer price" : p?.source === "route" ? p.listName || "Route price" : "List price");

/** The strike rate as text: "66.7%", or a dash when nobody was called on. */
export const strikeText = (r) => (r === null || r === undefined ? "–" : `${r}%`);

/** A price list form -> the body the server takes. */
export function priceListBody(f) {
  return {
    name: String(f.name || "").trim(), validFrom: f.validFrom || "", validTo: f.validTo || "",
    customerIds: (f.customers || []).map((c) => c.id),
    lines: (f.lines || []).filter((l) => l.stockId && l.price !== "").map((l) => ({ stockId: l.stockId, price: Number(l.price), minQty: l.minQty === "" ? 1 : Number(l.minQty) })),
    ...(typeof f.active === "boolean" ? { active: f.active } : {}),
  };
}

// ---- phase 4: offers, orders for next time, the suggested load ------------------------------------------------

export const PROMOTION_KINDS = [["slab", "Quantity discount"], ["bxgy", "Buy and get free"], ["basket", "Order value discount"]];
export const promotionKindLabel = (k) => (PROMOTION_KINDS.find(([x]) => x === k) || [k, k])[1];

/** One line saying what an offer gives. */
export function promotionText(p, names = new Map()) {
  if (!p) return "";
  if (p.kind === "slab") return `${p.percent}% off from ${p.minQty || 1} units`;
  if (p.kind === "bxgy") return `${p.freeQty} ${names.get(p.freeStockId) || (p.freeStockId ? "free item" : "free")} for every ${p.buyQty} bought`;
  if (p.kind === "basket") return `${p.percent}% off an order of ${round2(p.minValue)} or more`;
  return "";
}

/** A promotion form -> the body the server takes. */
export function promotionBody(f) {
  const n = (v) => (v === "" || v == null ? undefined : Number(v));
  const body = {
    name: String(f.name || "").trim(), kind: f.kind, validFrom: f.validFrom || "", validTo: f.validTo || "",
    priority: n(f.priority) ?? 0, stackable: Boolean(f.stackable),
    stockIds: (f.stockIds || []).filter(Boolean), customerIds: (f.customerIds || []).filter(Boolean), routeIds: (f.routeIds || []).filter(Boolean),
  };
  if (f.kind === "slab") Object.assign(body, { minQty: n(f.minQty) ?? 1, percent: n(f.percent) });
  if (f.kind === "bxgy") Object.assign(body, { buyQty: n(f.buyQty), freeQty: n(f.freeQty), freeStockId: f.freeStockId || "" });
  if (f.kind === "basket") Object.assign(body, { minValue: n(f.minValue), percent: n(f.percent) });
  if (typeof f.active === "boolean") body.active = f.active;
  return body;
}

/**
 * The offer as the sell screen shows it while typing: the rule's answer with names, the free goods, and the value
 * before VAT after the discounts. The server applies the same rule when the sale is made, and its figure wins.
 */
export function offerPreview(result, names = new Map()) {
  const lines = result?.lines || [];
  const subtotal = round2(lines.reduce((t, l) => t + num(l.qty) * num(l.price) * (1 - num(l.discountPercent) / 100), 0));
  const free = (result?.free || []).map((f) => ({ ...f, name: names.get(f.stockId) || "Free item" }));
  return { subtotal, free, applied: result?.applied || [], discounted: lines.some((l) => num(l.discountPercent) > 0) };
}

/** Why the suggested quantity is what it is, in words. */
export function suggestionWhy(w) {
  if (!w) return "";
  const parts = [];
  if (w.preorder) parts.push(`${w.preorder} ordered`);
  if (w.runs) parts.push(`about ${Math.ceil(w.average)} sold a run (last ${w.runs})`);
  if (w.onVan) parts.push(`less ${w.onVan} on the van`);
  if (w.capped) parts.push(`only ${w.free} free at the depot`);
  return parts.join(", ");
}

/** The suggested load as load-dialog rows (whole rows replaced, so a person edits from a full list). */
export const suggestedRows = (lines) => (lines || []).map((l) => ({ stockId: l.stockId, qty: String(l.qty), why: l.why }));

// ---- phase 5: the fleet --------------------------------------------------------------------------------------
export const EXPENSE_KINDS = [["fuel", "Fuel"], ["toll", "Toll"], ["parking", "Parking"], ["other", "Other road expense"]];
export const expenseKindLabel = (k) => (EXPENSE_KINDS.find(([x]) => x === k) || [k, k])[1];

/** "2 h 30 min", "45 min", or "" when unknown: how long a van has done nothing. */
export function quietText(minutes) {
  if (minutes === null || minutes === undefined) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

/** The odometer typed in a dialog, as the server takes it (blank = not given). */
export const odometerBody = (v) => (v === "" || v === null || v === undefined ? {} : { odometer: Number(v) });

/** A distance in words. */
export const distanceText = (m) => (m === null || m === undefined ? "" : m >= 1000 ? `${round2(m / 1000)} km` : `${m} m`);

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
  PRICE_BELOW_LIST: (e) => e.message,
  VAN_TRIP_SETTLED: () => "This trip has been counted back in, so what was done on it stays. Correct it with a new return or receipt.",
  VISIT_REASON_REQUIRED: () => "Say why there was no sale.",
  INVOICE_NOT_ON_TRIP: () => "That invoice was not raised on this trip.",
  TRANSFER_TARGET_CLOSED: (e) => e.message,
  NO_PHONE: () => "This customer has no phone number saved. Type the WhatsApp number.",
  PREORDER_NOT_OPEN: (e) => e.message,
  PREORDER_NOT_FOUND: () => "That order is not this customer's.",
  ROUTE_REQUIRED: () => "This trip has no route, so there is no next visit to order for.",
  PROMOTION_NAME_TAKEN: (e) => e.message,
  FREE_ITEM_REQUIRED: () => "Say which item is given free.",
  ODOMETER_INVALID: () => "Enter the odometer reading in km.",
  ODOMETER_BELOW_OUT: (e) => e.message,
  LOCATION_REQUIRED: (e) => e.message,
  LOCATION_ALREADY_SET: (e) => e.message,
  CUSTOMER_NOT_ON_ROUTE: (e) => e.message,
  PENDING_EXPENSES: (e) => e.message,
};
export const vanErrorText = (err) => (err ? (WORDS[err.code] ? WORDS[err.code](err) : err.message || "Something went wrong") : "");

/** A credit warning comes back as a 409 the person may press on past (with the right to). */
export const isCreditWarning = (err) => err?.code === "RISK_WARNING_ACKNOWLEDGEMENT_REQUIRED";

/** Items to offer on the sell screen: what is on the van, with how many. */
export const vanItems = (trip) => (trip?.sellable || []).map((l) => ({ value: l.stockId, label: `${l.itemName} (${l.qty} on van)`, qty: l.qty, price: l.salesPrice, name: l.itemName }));

/** A stop on today's route is done once the van sold there, collected there, or recorded a visit without a sale. */
export function stopDone(c) {
  return Boolean(c?.sold || c?.collected || c?.visit);
}

// ---- at the customer's door (phase 7) ---------------------------------------------------------------------------

/**
 * "Repeat last order": the last order's lines as sale rows, each held to what the van carries now. A line the van
 * has none of is left out, and every cut is named so the salesman is never surprised by a smaller basket.
 */
export function repeatRows(lastOrder, onVan = []) {
  const have = new Map((onVan || []).map((l) => [l.stockId, num(l.qty)]));
  const rows = [];
  const cut = [];
  for (const l of lastOrder?.lines || []) {
    const avail = have.get(l.stockId) || 0;
    const qty = Math.min(num(l.qty), avail);
    if (qty < num(l.qty)) cut.push({ name: l.name, wanted: num(l.qty), got: qty > 0 ? qty : 0 });
    if (qty > 0) rows.push({ itemId: l.stockId, qty: String(qty), price: "" });
  }
  return { rows, cut };
}

/** One suggested item added to the rows: more of a line already there, else the first empty row, else a new one; never above the van. */
export function addSuggestedRow(rows, item, onVan = []) {
  const avail = num((onVan || []).find((l) => l.stockId === item.stockId)?.qty);
  if (!(avail > 0)) return rows;
  const at = rows.findIndex((r) => r.itemId === item.stockId);
  if (at >= 0) return rows.map((r, i) => (i === at ? { ...r, qty: String(Math.min(avail, round3(num(r.qty) + num(item.avgQty) || 1))) } : r));
  const row = { itemId: item.stockId, qty: String(Math.min(avail, num(item.avgQty) || 1)), price: "" };
  const blank = rows.findIndex((r) => !r.itemId && !num(r.qty));
  return blank >= 0 ? rows.map((r, i) => (i === blank ? row : r)) : [...rows, row];
}

/** A line's quantity moved by one step (the phone's - and + buttons), never below zero nor above what the van holds. */
export function stepQty(row, delta, onVan = []) {
  const avail = row.itemId ? num((onVan || []).find((l) => l.stockId === row.itemId)?.qty) : Infinity;
  const next = Math.max(0, Math.min(avail, round3(num(row.qty) + delta)));
  return { ...row, qty: next === 0 ? "" : String(next) };
}

/** The cuts "Repeat last order" had to make, in words. */
export const cutText = (cut = []) => cut.map((c) => (c.got > 0 ? `${c.name}: ${c.got} of ${c.wanted} (all the van has)` : `${c.name}: none on the van`)).join("; ");
