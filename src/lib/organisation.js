// What the app needs to know about the organisation it is signed in to, as plain functions: whether a screen is
// in the plan, what to say about the subscription, and how to recognise the server's refusals. No React and no
// requests, so every rule is a test.
//
// The server is the authority and enforces all of this itself. Nothing here grants anything: it decides what to
// SHOW, so a person is not offered a screen the plan does not include, and is told why when the door is shut.

// Fired on window when any request is refused because the organisation may not use the system; the shell listens.
export const BLOCKED_EVENT = "organisation-blocked";

export const BLOCKING_CODES = ["ORGANISATION_EXPIRED", "ORGANISATION_SUSPENDED", "ORGANISATION_CLOSED"];

// Fired on window when the branch this tab was working in is no longer one the person may work in (a role there was taken
// away, or the branch was switched off); the shell listens and starts again from the branch the person belongs to.
export const BRANCH_RESET_EVENT = "branch-reset";
export const BRANCH_REFUSAL_CODES = ["BRANCH_NOT_ALLOWED", "BRANCH_NOT_FOUND", "BRANCH_INACTIVE"];

const codeOf = (error) => error?.response?.data?.errorCode || null;
const detailsOf = (error) => error?.response?.data?.details || {};

export const isBlockedError = (error) => error?.response?.status === 403 && BLOCKING_CODES.includes(codeOf(error));
export const isReadOnlyError = (error) => error?.response?.status === 403 && codeOf(error) === "ORGANISATION_READ_ONLY";
export const isFeatureError = (error) => error?.response?.status === 403 && codeOf(error) === "FEATURE_NOT_IN_PLAN";
export const isLimitError = (error) => error?.response?.status === 403 && codeOf(error) === "LIMIT_REACHED";
/** The branch the request named is not one the person may work in. */
export const isBranchRefusal = (error) => error?.response?.status === 403 && BRANCH_REFUSAL_CODES.includes(codeOf(error));
/** The person's role does not allow what they asked for: the server's own refusal, which names what was needed. */
export const isPermissionError = (error) => error?.response?.status === 403 && codeOf(error) === "PERMISSION_DENIED";

/** The organisation may not use the system: why, since when, and who to ask. null when the error is anything else. */
export function blockedFrom(error) {
  if (!isBlockedError(error)) return null;
  const d = detailsOf(error);
  return {
    code: codeOf(error),
    state: d.state || null,
    message: error.response.data.message || "This organisation cannot use the system right now.",
    endsAt: d.endsAt || null,
    contact: d.contact || null,
    organisation: d.organisation || null,
  };
}

/** Where the server's own words are better than ours: a refusal for the plan, a limit, or a read-only organisation. */
export function planRefusalMessage(error) {
  if (isFeatureError(error) || isLimitError(error) || isReadOnlyError(error) || isPermissionError(error)) return error.response.data.message;
  return null;
}

// ---- features

/**
 * Is a feature available? Only an explicit `false` from the server says no: while the status is loading, or if it
 * could not be loaded, everything is shown and the server's own refusal (FEATURE_NOT_IN_PLAN) is the backstop.
 */
export const featureOn = (status, key) => !key || status?.features?.[key] !== false;

/** A navigation tab is shown when it has no `feature`, or its feature is on. */
export const tabInPlan = (tab, status) => featureOn(status, tab.feature);

/** The plain name of a feature for "X is not included in your plan". */
export const featureLabel = (key) => FEATURE_LABELS[key] || key;

export const FEATURE_LABELS = {
  quotations: "Quotations",
  deliveryNotes: "Delivery notes",
  batches: "Batches and expiry",
  banking: "Banks, cards and cheques",
  reconciliation: "Bank and card reconciliation",
  currencies: "Foreign currency",
  vatReturn: "VAT return",
  ifrsStatements: "IFRS statements",
  einvoicing: "E-invoicing",
  messaging: "Send documents to customers",
  multiBranch: "More than one branch",
};

// ---- branches

/**
 * May this person look at every branch together? Only an explicit `false` from the server says no (an older server sends
 * nothing, and then the answer is the one it always was). Someone whose role differs by branch, and anyone who belongs to a
 * branch other than head office, works in ONE branch at a time.
 */
export const canViewAllBranches = (status) => status?.branch?.canViewAll !== false;

/** The branches a person may switch between: "All branches" first when they may look at all of them, then each of
 * `status.branches` (the server lists only the ones they may use). Empty when there is nothing to choose. */
export function branchChoices(status) {
  const branches = status?.branches || [];
  if (!status?.branch?.canSwitch || branches.length < 2) return [];
  return [
    ...(canViewAllBranches(status) ? [{ value: "", label: "All branches" }] : []),
    ...branches.map((b) => ({ value: b.code, label: b.isHeadOffice && !/head office/i.test(b.name) ? `${b.name} (head office)` : b.name })),
  ];
}

/** A remembered branch is only kept while the person can still switch and the branch still exists and is active. */
export const validBranchSelection = (status, selected) =>
  selected && branchChoices(status).some((c) => c.value === selected) ? selected : null;

/** What the top bar says about where the person is working: always the branch, so a person knows where they are even
 * when there is only the head office. null only while the status is not known. */
export function branchLabel(status, selected) {
  const branches = status?.branches || [];
  if (!status?.branch) return null;
  if (branches.length < 2 || !status.branch.canSwitch) return status.branch.name || null;
  const chosen = validBranchSelection(status, selected);
  if (chosen) return branches.find((b) => b.code === chosen)?.name || chosen;
  // nothing (valid) chosen: someone who may look at everything is looking at everything; anyone else is in the branch the
  // server put them in, and the label names it rather than offering a view they do not have
  return canViewAllBranches(status) ? "All branches" : status.branch.name || status.branch.code || null;
}

/** The value of the branch choice that is in use: the one the person made, else the branch the server put them in when
 * they cannot look at all of them, else "" (all branches). It is what the switcher ticks. */
export function branchInUse(status, selected) {
  const chosen = validBranchSelection(status, selected);
  if (chosen) return chosen;
  return canViewAllBranches(status) ? "" : status?.branch?.code || "";
}
