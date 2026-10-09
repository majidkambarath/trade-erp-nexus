// Who may approve a document, as plain functions: no React and no requests, so every rule is a test.
//
// The server is the lock. It judges every approve itself (utils/approvalRules.js `decide`, 403 SELF_APPROVAL_NOT_ALLOWED /
// APPROVAL_LIMIT_EXCEEDED / SECOND_APPROVER_REQUIRED), and nothing here grants anything: it mirrors the SAME checks, in the
// SAME order, so a screen can decide what to OFFER instead of showing a button that can only answer "no".
//
//   1. separate approver  the person who prepared a document may not approve it        -> reason "own"
//   2. a role's limit     a document over the approver's limit is not theirs to approve  -> reason "limit"
//   3. a second approver  above an amount a document needs two DIFFERENT people; the
//                         person who gave the first may not give the second              -> reason "already"
//
// While anything needed to judge is unknown (the status has not loaded, there is no policy) the answer is "yes, offer it":
// a missing answer must never hide an action, and the server refuses what it should.
import { formatNumber } from "../utils/format";
import { orgCurrency } from "../utils/orgLocale";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// An id from an id, or from a populated user ({ _id } / { id }); nothing if there is none.
const idOf = (x) => {
  if (x === undefined || x === null || x === "") return null;
  if (typeof x === "object") return idOf(x._id ?? x.id ?? x.by ?? null);
  return String(x);
};
const sameId = (a, b) => idOf(a) !== null && idOf(a) === idOf(b);

// A limit as stored (a number, or empty for none) -> a number, or null for no limit.
const limitOf = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? round2(n) : null;
};

/** The organisation's policy with every missing or nonsensical value read as "not set". */
export function normalisePolicy(raw) {
  const above = raw?.secondApprovalAbove;
  const n = above === null || above === undefined || above === "" ? null : Number(above);
  return { separateApprover: raw?.separateApprover === true, secondApprovalAbove: n !== null && Number.isFinite(n) && n >= 0 ? round2(n) : null };
}

/** Does a document of this amount need two approvers under this policy? */
export const needsSecondApproval = (policy, amount) => {
  const p = normalisePolicy(policy);
  return p.secondApprovalAbove !== null && round2(amount) > p.secondApprovalAbove;
};

// A trade document is "DRAFT" (a purchase order may also say "PENDING") and a voucher "draft" or "pending" until approved;
// anything else has been decided.
const OPEN = ["DRAFT", "PENDING"];
export const isAwaitingApproval = (doc) => !doc?.status || OPEN.includes(String(doc.status).toUpperCase());

/**
 * Where a document stands for THIS person.
 *
 *   doc     { totalAmount, createdBy, approvals, status }   (a trade document or a voucher, as the list or the screen has it)
 *   me      { id, role: { approvalLimit } }                  (status.me)
 *   policy  { separateApprover, secondApprovalAbove }        (status.policy.approvals)
 *
 * -> { awaitingSecond, given, canApprove, reason }
 *   awaitingSecond  the first of two approvals is in and the document is still not approved
 *   given           how many approvals the document carries
 *   canApprove      may this person approve it? (false for a document that is already decided)
 *   reason          why not: "own" | "limit" | "already", else null
 */
export function approvalState({ doc, me, policy } = {}) {
  const approvals = Array.isArray(doc?.approvals) ? doc.approvals.filter((a) => a && a.by !== undefined && a.by !== null) : [];
  const given = approvals.length;
  const open = isAwaitingApproval(doc);
  const pol = normalisePolicy(policy);
  const amount = round2(doc?.totalAmount);
  const needsSecond = needsSecondApproval(pol, amount);

  const awaitingSecond = open && given >= 1 && needsSecond;
  if (!open) return { awaitingSecond: false, given, canApprove: false, reason: null };

  const myId = me?.id;
  if (pol.separateApprover && sameId(doc?.createdBy, myId)) return { awaitingSecond, given, canApprove: false, reason: "own" };
  const limit = limitOf(me?.role?.approvalLimit);
  if (limit !== null && amount > limit) return { awaitingSecond, given, canApprove: false, reason: "limit" };
  if (needsSecond && approvals.some((a) => sameId(a.by, myId))) return { awaitingSecond, given, canApprove: false, reason: "already" };
  return { awaitingSecond, given, canApprove: true, reason: null };
}

/** The badge text for a document that has had its first approval and is waiting for the second; "" when it is not. */
export const awaitingLabel = (state) => (state?.awaitingSecond ? "Awaiting second approval" : "");

/** The name of whoever gave the first approval, for a title on the badge. "" when unknown. */
export const firstApproverName = (doc) => {
  const first = (Array.isArray(doc?.approvals) ? doc.approvals : []).find((a) => a && (a.name || a.by));
  return first?.name ? String(first.name) : "";
};

/** "5,000.00 AED": an amount in the organisation's base currency. */
export const limitText = (limit) => `${formatNumber(limit)} ${orgCurrency()}`.trim();

/** A role's limit in words, for a list row or a card: "Up to 5,000.00 AED" / "No limit". */
export const limitSummary = (limit) => {
  const n = limitOf(limit);
  return n === null ? "No limit" : `Up to ${limitText(n)}`;
};

/**
 * One plain sentence for why this person is not offered Approve, in the server's own words (what a refusal would say).
 * `limit` is the person's own limit, for the "limit" reason. "" when there is nothing to explain.
 */
export function approvalNotice(reason, { limit } = {}) {
  if (reason === "own") return "You prepared this document, so someone else has to approve it.";
  if (reason === "limit") {
    const n = limitOf(limit);
    return n === null ? "This is over your approval limit." : `This is over your approval limit of ${limitText(n)}.`;
  }
  if (reason === "already") return "You gave the first approval; a different person has to give the second.";
  return "";
}

/** The sentence for a document and a person, straight from the state: "" when they may approve (or it is decided). */
export const noticeFor = (state, me) => approvalNotice(state?.reason, { limit: me?.role?.approvalLimit });

/** The words shown when an approve answered `approval.awaitingSecond` - an information message, never "approved". */
export const FIRST_APPROVAL_MESSAGE = "First approval recorded. A second person must approve it before it takes effect.";

/** Did this response (a transaction or voucher approve) record only the first of two approvals? */
export const wasFirstApproval = (response) => {
  const body = response?.data?.data ?? response?.data ?? response;
  return body?.approval?.awaitingSecond === true || body?.awaitingSecondApproval === true;
};

/**
 * What a run of approvals came to, said honestly. `results` is [{ outcome: "approved" | "waiting" | "refused" | "cancelled", reason? }].
 * -> { text, tone } where tone is "success" (every one approved), "info" (some wait for a second person, none refused) or
 * "warning" (any was refused). "2 approved, 1 waiting for a second approver, 1 refused: <reason>".
 */
export function summariseApprovals(results) {
  const list = Array.isArray(results) ? results : [];
  const count = (o) => list.filter((r) => r.outcome === o).length;
  const approved = count("approved");
  const waiting = count("waiting");
  const cancelled = count("cancelled");
  const refused = list.filter((r) => r.outcome === "refused");
  const parts = [];
  if (approved) parts.push(`${approved} approved`);
  if (waiting) parts.push(`${waiting} waiting for a second approver`);
  if (cancelled) parts.push(`${cancelled} left as ${cancelled === 1 ? "it was" : "they were"} (you cancelled)`);
  if (refused.length) {
    const reasons = [...new Set(refused.map((r) => r.reason).filter(Boolean))];
    parts.push(`${refused.length} refused${reasons.length ? `: ${reasons.join(" / ")}` : ""}`);
  }
  if (!parts.length) return { text: "Nothing was approved.", tone: "warning" };
  return { text: parts.join(", "), tone: refused.length ? "warning" : waiting || cancelled ? "info" : "success" };
}
