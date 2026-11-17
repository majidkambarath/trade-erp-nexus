import { emptyPayment } from "./voucherForms";

// The card Zarvia AI shows under an answer when it has PREPARED a payment, a receipt, an expense or a draft
// invoice. Pure, so every rule is tested without rendering.
//
// The assistant prepares; the person saves. A proposal carries the exact body the normal route takes. The
// card's button posts it to that route with the person's own sign-in, so the server's own rules (rights,
// approval limits, the period lock, reference numbers) decide - this file only decides what the card offers.

const KINDS = new Set(["payment", "receipt", "expense", "invoice", "customer", "vendor", "van_sale"]);
// A new customer or vendor is not a document: no payment details, and what is missing is a field of the party itself.
const PARTY = new Set(["customer", "vendor"]);
// The label of a box the card asks for, by what is missing. A reference is a bank transfer's slip number.
export const MISSING_LABEL = { reference: "Reference (the transfer or deposit slip number)", address: "Address" };

/** Keep only what a card needs and can trust to be the right shape; anything else from the server is dropped. */
export function normaliseProposals(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && KINDS.has(p.kind) && p.body && typeof p.body === "object" && (p.endpoint === "voucher" || p.endpoint === "transaction" || p.endpoint === "party" || (p.endpoint === "van_sale" && typeof p.body.tripId === "string" && /^[a-f0-9]{24}$/.test(p.body.tripId))))
    .map((p) => ({
      id: String(p.id || ""),
      kind: p.kind,
      endpoint: p.endpoint,
      title: String(p.title || ""),
      confirm: String(p.confirm || "Confirm"),
      lines: (Array.isArray(p.lines) ? p.lines : []).filter((r) => Array.isArray(r) && r.length === 2).map(([k, v]) => [String(k), String(v)]),
      body: p.body,
      missing: (Array.isArray(p.missing) ? p.missing : []).map(String),
      warnings: (Array.isArray(p.warnings) ? p.warnings : []).map(String),
      prefill: p.prefill && typeof p.prefill === "object" ? p.prefill : null,
      savedAs: p.savedAs ? String(p.savedAs) : "",
      // client-side state of this card
      result: p.result || null,
    }))
    .filter((p) => p.id);
}

/** What still has to be typed on the card before its button works: a reference for a bank transfer. */
export const stillNeeded = (p, filled = {}) =>
  (p.missing || []).filter((field) => !String(filled[field] ?? "").trim());

/** Can the button be pressed? Not once saved, not while something is missing, not after a successful save. */
export function canSave(p, filled = {}) {
  if (!p || p.savedAs || p.result?.ok) return false;
  return stillNeeded(p, filled).length === 0;
}

/** The body to send: the prepared one, with what the person typed on the card put where the form puts it. */
export function bodyToSend(p, filled = {}) {
  const body = { ...p.body };
  if (p.kind === "invoice") return body;
  if (p.kind === "van_sale") { delete body.tripId; return body; } // the trip is in the address, not the body
  if (PARTY.has(p.kind)) {
    for (const key of p.missing || []) if (String(filled[key] ?? "").trim()) body[key] = String(filled[key]).trim().slice(0, 500);
    return body;
  }
  const details = { ...(body.paymentDetails || {}) };
  const reference = String(filled.reference ?? "").trim();
  if (reference) details.reference = reference.slice(0, 60);
  body.paymentDetails = details;
  return body;
}

/** Where the normal route is. */
export const saveUrl = (p) => (p.kind === "van_sale" ? `/van-sales/trips/${p.body.tripId}/sell` : p.kind === "customer" ? "/customers" : p.kind === "vendor" ? "/vendors/vendors" : p.endpoint === "transaction" ? "/transactions/transactions" : "/vouchers/vouchers");

/** "Change details": the normal form, opened already filled in. An invoice has no form to prefill, so none. */
export function formTarget(p, filled = {}) {
  if (!p?.prefill) return null;
  const reference = String(filled.reference ?? p.prefill.reference ?? "").trim();
  const state = { assistantPrefill: { ...p.prefill, kind: p.kind, reference } };
  if (p.kind === "payment") return { path: "/payment-voucher", state };
  if (p.kind === "receipt") return { path: "/receipt-voucher", state };
  if (p.kind === "expense") return { path: "/expense-voucher", state };
  return null;
}

/** The number a saved document got, wherever the route puts it. */
export const numberOf = (saved) => saved?.voucherNo || saved?.transactionNo || saved?.invoice?.transactionNo || saved?.number || "";

/**
 * What to say once the route answered. `data` is the route's own body ({ data, approval? }). A voucher held
 * for approval has been saved but posts nothing yet, and the card must not call it paid.
 */
export function savedResult(p, data) {
  const doc = data?.data || data || {};
  const number = numberOf(doc);
  if (PARTY.has(p.kind)) {
    const id = doc.customerId || doc.vendorId || "";
    return { ok: true, number: id, held: false, text: `${p.kind === "vendor" ? "Vendor" : "Customer"} ${doc.vendorName || doc.customerName || p.body.vendorName || p.body.customerName} is added${id ? ` (${id})` : ""}.`, open: p.kind === "vendor" ? "/vendor-creation" : "/customer-creation", openLabel: p.kind === "vendor" ? "Open vendors" : "Open customers" };
  }
  if (p.kind === "van_sale") {
    const paid = doc.receipt ? `, ${doc.receipt.voucherNo} received` : ", on credit";
    return { ok: true, number, held: false, text: `Sold from the van: ${number || "invoice made"}${paid}.`, open: "/van-sales/my-van", openLabel: "Open my van" };
  }
  const held = Boolean(data?.approval?.held || doc?.status === "pending");
  if (p.kind === "invoice") {
    return { ok: true, number, held: false, text: `Saved as a draft${number ? ` ${number}` : ""}. Nothing is posted until it is approved.`, open: number ? `/sales-order?search=${encodeURIComponent(number)}` : "/sales-order" };
  }
  if (held) {
    return { ok: true, number, held: true, text: `Saved${number ? ` ${number}` : ""}, waiting for approval. Nothing is posted until it is approved.` };
  }
  const word = p.kind === "payment" ? "Payment" : p.kind === "receipt" ? "Receipt" : "Expense";
  return { ok: true, number, held: false, text: `${word} ${number || "saved"} is recorded.` };
}

/** The server's own words for a refusal, never a paraphrase. */
export const refusalText = (err) => err?.response?.data?.message || err?.message || "That could not be saved.";

const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const positive = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? String(Number(n)) : "");

/**
 * "Change details" on a payment or receipt card: the form's starting values, from the router state (an address has no room
 * for an account and a reference). The kind must match the screen, so a prepared receipt never opens on the payments screen.
 * `spread` asks the form to settle the oldest bills first, as the card said, once they have loaded.
 */
export function partyPrefillFromAssistant(state, direction) {
  const a = state?.assistantPrefill;
  if (!a || a.kind !== direction) return null;
  return {
    partyId: String(a.partyId || ""),
    date: isDay(a.date) ? a.date : undefined,
    amount: positive(a.amount),
    narration: String(a.narration || ""),
    payment: { ...emptyPayment(), mode: String(a.mode || "cash"), accountId: String(a.accountId || ""), reference: String(a.reference || "") },
    spread: true,
  };
}

/** The same for an expense: the expense form's own `fields` and `payment`. */
export function expensePrefillFromAssistant(state, today) {
  const a = state?.assistantPrefill;
  if (!a || a.kind !== "expense") return null;
  return {
    fields: { date: isDay(a.date) ? a.date : today, expenseAccountId: String(a.accountId || ""), description: String(a.description || ""), amount: positive(a.amount), taxCodeId: "", vendorId: "" },
    payment: { ...emptyPayment(), mode: String(a.mode || "cash"), accountId: String(a.payAccountId || ""), reference: String(a.reference || "") },
  };
}
