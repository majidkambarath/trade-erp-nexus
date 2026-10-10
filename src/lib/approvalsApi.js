import { api } from "./accountingApi";

// The approvals list (GET /approvals/waiting): what is waiting for the signed-in person's decision, and what is waiting but
// not for them, each with the server's reason. Reading only - approving goes through the usual calls
// (lib/processTransaction.js for an order, lib/bankingApi.js `vouchers.approve` for a voucher), which judge every approve.
export const approvalQueue = {
  // { forYou: [row], others: [row], counts: { forYou, others }, capped }
  waiting: () => api.get("/approvals/waiting"),
  // { count, others, capped }: the same answer without the rows, cheap enough to ask for a badge
  count: () => api.get("/approvals/waiting", { countOnly: 1 }),
};

// Anything that decides a document tells the shell, so its badge is not stale until the next poll.
export const APPROVALS_CHANGED = "approvals-changed";
export function announceApprovalsChanged() {
  try {
    window.dispatchEvent(new Event(APPROVALS_CHANGED));
  } catch {
    /* no window (a test of something else): nothing to tell */
  }
}
