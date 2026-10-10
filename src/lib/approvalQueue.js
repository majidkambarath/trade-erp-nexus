// The approvals list as plain functions: no React and no requests, so every rule is a test.
//
// The server decides everything (services/core/approvalQueueService.js judges each row with the SAME rules as the approve
// routes); this only words what it sent. A row is
//   { id, kind: "document" | "voucher", type, typeLabel, number, party, narration, amount, date, createdAt, preparedBy,
//     ageDays, state: "waiting" | "awaiting second approver", given, firstApprovers, step, of, reason: null | { code, message }, link }
import { approveMany, processTransaction } from "./processTransaction";
import { summariseApprovals } from "./approvals";

/** Any of these lets a person into the list. Strict: while the grants are unknown the answer is NO (nothing is fetched). */
export const APPROVE_KEYS = ["sales.approve", "purchase.approve", "finance.approve"];

export const holdsAnyApprove = (me) => Array.isArray(me?.grants) && APPROVE_KEYS.some((k) => me.grants.includes(k));

export const AWAITING_SECOND = "awaiting second approver";

/** "Today", "1 day", "12 days": how long it has been waiting. */
export const ageText = (days) => {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  if (n === 0) return "Today";
  return `${n} day${n === 1 ? "" : "s"}`;
};

/** The state as a badge says it. A document whose first approval is in says whose it was. */
export function stateText(row) {
  if (row?.state !== AWAITING_SECOND) return "Waiting";
  return "Awaiting second approver";
}

/** The line under a state badge: who gave the first approval. "" when nobody has. */
export const firstApprovalNote = (row) => (row?.firstApprovers?.length ? `First approval by ${row.firstApprovers.join(", ")}` : "");

/** What approving it will be, for a row that is theirs: "First of two approvals", "Second approval", or "" for a plain one. */
export function stepText(row) {
  if (!row || row.of === null || row.of === undefined || row.of < 2) return "";
  return row.step === 2 ? "Your approval finishes it" : "Your approval is the first of two";
}

/** The one-line sentence for why a row is not theirs, in the server's own words. */
export const whyNot = (row) => row?.reason?.message || "";

/** The permission that lets a person approve this row (what the server requires for it). */
export const approveKeyOf = (row) => {
  if (row?.kind === "voucher") return "finance.approve";
  return String(row?.type || "").startsWith("purchase_") ? "purchase.approve" : "sales.approve";
};

/** The words for a decision, from the run of results `approveRow` returns. */
export const outcomeOf = (result) => summariseApprovals([result]);

/**
 * Approve one row exactly as its own screen does: an order through processTransaction (which also asks about a credit warning),
 * a voucher through `vouchers.approve`. Never throws. -> { outcome: "approved" | "waiting" | "refused" | "cancelled", reason? }
 */
export async function approveRow(row, { vouchers, approveDocument = processTransaction } = {}) {
  const approve = row.kind === "voucher" ? (id) => vouchers.approve(id, "approve") : (id) => approveDocument(id, "approve");
  const [result] = await approveMany([row.id], { approve });
  return result;
}
