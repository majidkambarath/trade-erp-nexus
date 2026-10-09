import React, { useCallback } from "react";
import { cn } from "../../lib/utils";
import { statusClasses } from "../../lib/status";
import { approvalState, awaitingLabel, firstApproverName, noticeFor } from "../../lib/approvals";
import { useOrganisation } from "./OrganisationContext";

// What the screens show about approving: who is asking, the organisation's rules, and the words. The rules themselves are
// lib/approvals.js (the same checks, in the same order, as the server's utils/approvalRules.js); the server still refuses
// whatever it should. While the status has not loaded `canApprove` is true: a missing answer must never hide an action.

/** `stateOf(doc)` -> { awaitingSecond, given, canApprove, reason } for the signed-in person under the organisation's policy. */
export function useApproval() {
  const { me, policy } = useOrganisation();
  const stateOf = useCallback((doc) => approvalState({ doc, me, policy }), [me, policy]);
  return { stateOf, me, policy };
}

/** "Awaiting second approval": the first of two approvals is in and the document is not approved yet. Nothing when it is not. */
export function AwaitingSecondBadge({ doc, state, className }) {
  if (!state?.awaitingSecond) return null;
  const by = firstApproverName(doc);
  return (
    <span
      title={by ? `First approval by ${by}` : undefined}
      className={cn("inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", statusClasses("PENDING"), className)}
    >
      {awaitingLabel(state)}
    </span>
  );
}

/**
 * The line on a document's own screen: that it waits for a second approver, and/or why THIS person is not the one to approve
 * it ("You prepared this document, so someone else has to approve it."). `permission` is the Approve of the document's module
 * ("sales.approve"): a person who could never approve is not told why they cannot approve THIS one. Nothing when there is
 * nothing to say.
 */
export function ApprovalBanner({ doc, permission, className }) {
  const { can } = useOrganisation();
  const { stateOf, me } = useApproval();
  if (!doc) return null;
  const state = stateOf(doc);
  const why = permission && !can(permission) ? "" : noticeFor(state, me);
  if (!state.awaitingSecond && !why) return null;
  return (
    <p role="status" className={cn("rounded-lg border px-3 py-2 text-sm", state.awaitingSecond ? "border-status-warning/40 bg-status-warning-soft text-foreground" : "border-border bg-secondary/40 text-muted-foreground", className)}>
      {state.awaitingSecond && <strong className="font-semibold">{awaitingLabel(state)}. </strong>}
      {state.awaitingSecond && !why && "One person has approved it; a different person has to give the second approval before it takes effect."}
      {why}
    </p>
  );
}
