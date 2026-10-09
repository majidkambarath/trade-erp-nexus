import Swal from "sweetalert2";
import axiosInstance from "../axios/axios";
import { noticeFor, wasFirstApproval } from "./approvals";

// Approve, reject or cancel an order. Approving a SALE can be held up by credit control:
//   - "warn" mode answers 409 RISK_WARNING_ACKNOWLEDGEMENT_REQUIRED with the reasons. The user is
//     asked, and if they accept, the same request is sent again carrying the acknowledgement
//     field the server named. Each kind of warning has its own field, so acknowledging one never
//     acknowledges another.
//   - "block" mode answers 403 RISK_LIMIT_BLOCKED, which is surfaced as an ordinary error.
//
// `confirm` is injectable so the behaviour can be tested without a dialog.

export const askToOverride = async (warning) => {
  const breaches = warning?.details?.risk?.breaches || [];
  const result = await Swal.fire({
    icon: "warning",
    title: "Credit warning",
    html: `<p style="text-align:left">${[warning.message, ...breaches.map((b) => b.message)]
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .map((m) => String(m).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])))
      .join("<br/>")}</p>`,
    showCancelButton: true,
    confirmButtonText: "Approve anyway",
    cancelButtonText: "Cancel",
    focusCancel: true,
  });
  return result.isConfirmed;
};

export async function processTransaction(id, action, { confirm = askToOverride } = {}) {
  const url = `/transactions/transactions/${id}/process`;
  try {
    return await axiosInstance.patch(url, { action });
  } catch (err) {
    const body = err.response?.data;
    if (err.response?.status === 409 && body?.errorCode === "RISK_WARNING_ACKNOWLEDGEMENT_REQUIRED") {
      const field = body.details?.risk?.acknowledgementField;
      if (!field) throw err;
      if (!(await confirm(body))) {
        const cancelled = new Error("Approval cancelled");
        cancelled.cancelled = true;
        throw cancelled;
      }
      return axiosInstance.patch(url, { action, [field]: true });
    }
    throw err;
  }
}

// Run the approve/reject a user asked for while saving a document. The document already exists as a
// draft, so a failure or a declined credit warning never loses it: the outcome says what happened and
// the caller reports it.
export async function applyAfterSave(id, action, { confirm } = {}) {
  try {
    const response = await processTransaction(id, action, confirm ? { confirm } : undefined);
    // Above the organisation's second-approver amount the first approval is only recorded: the document is still a draft
    if (action === "approve" && wasFirstApproval(response)) return { done: false, awaitingSecond: true };
    return { done: true, status: action === "approve" ? "APPROVED" : "REJECTED" };
  } catch (err) {
    if (err.cancelled) return { done: false, cancelled: true };
    return { done: false, message: err.response?.data?.message || err.message };
  }
}

/**
 * Approve several documents one by one and say what each came to, so a bulk approve can report honestly instead of stopping
 * at the first refusal. Never throws.
 *
 *   ids      the documents asked for
 *   docs     the list rows ({ id, status, totalAmount, createdBy, approvals }); a row not found is still tried (the server decides)
 *   stateOf  (doc) => approvalState: a document the server would certainly refuse for this person (their own work, over their
 *            limit, a second approval from the same person) is not sent, and is reported with the same words the server uses
 *   me       the person, for the words of a limit refusal
 *   approve  how one is approved (processTransaction, which also asks about a credit warning)
 *
 * -> [{ id, outcome: "approved" | "waiting" | "refused" | "cancelled", reason? }]
 */
export async function approveMany(ids, { docs = [], stateOf, me, approve = processTransaction } = {}) {
  const results = [];
  for (const id of ids) {
    const doc = docs.find((d) => String(d.id ?? d._id) === String(id));
    const state = doc && stateOf ? stateOf(doc) : null;
    if (state && !state.canApprove) {
      results.push({ id, outcome: "refused", reason: noticeFor(state, me) || "It is already decided" });
      continue;
    }
    try {
      const response = await approve(id, "approve");
      results.push({ id, outcome: wasFirstApproval(response) ? "waiting" : "approved" });
    } catch (err) {
      results.push(err.cancelled ? { id, outcome: "cancelled" } : { id, outcome: "refused", reason: err.response?.data?.message || err.message });
    }
  }
  return results;
}
