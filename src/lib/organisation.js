// What the app needs to know about the organisation it is signed in to, as plain functions: whether a screen is
// in the plan, what to say about the subscription, and how to recognise the server's refusals. No React and no
// requests, so every rule is a test.
//
// The server is the authority and enforces all of this itself. Nothing here grants anything: it decides what to
// SHOW, so a person is not offered a screen the plan does not include, and is told why when the door is shut.

// Fired on window when any request is refused because the organisation may not use the system; the shell listens.
export const BLOCKED_EVENT = "organisation-blocked";

export const BLOCKING_CODES = ["ORGANISATION_EXPIRED", "ORGANISATION_SUSPENDED", "ORGANISATION_CLOSED"];

const codeOf = (error) => error?.response?.data?.errorCode || null;
const detailsOf = (error) => error?.response?.data?.details || {};

export const isBlockedError = (error) => error?.response?.status === 403 && BLOCKING_CODES.includes(codeOf(error));
export const isReadOnlyError = (error) => error?.response?.status === 403 && codeOf(error) === "ORGANISATION_READ_ONLY";
export const isFeatureError = (error) => error?.response?.status === 403 && codeOf(error) === "FEATURE_NOT_IN_PLAN";
export const isLimitError = (error) => error?.response?.status === 403 && codeOf(error) === "LIMIT_REACHED";

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
  if (isFeatureError(error) || isLimitError(error) || isReadOnlyError(error)) return error.response.data.message;
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

/** The branches a head-office user may switch between: "All branches" first, then each. Empty when there is nothing to choose. */
export function branchChoices(status) {
  const branches = status?.branches || [];
  if (!status?.branch?.canSwitch || branches.length < 2) return [];
  return [{ value: "", label: "All branches" }, ...branches.map((b) => ({ value: b.code, label: b.isHeadOffice && !/head office/i.test(b.name) ? `${b.name} (head office)` : b.name }))];
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
  return chosen ? branches.find((b) => b.code === chosen)?.name || chosen : "All branches";
}

// ---- the subscription

const shortDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The notice to show above the work, or null when there is nothing to say. Said in the grace period, in the last
 * fortnight of a paid period, and for an organisation that is read-only; a blocked one never gets this far (it sees
 * the blocked page instead).
 *   tone: "info" | "warning" | "danger"
 */
export function subscriptionNotice(subscription) {
  if (!subscription || subscription.blocked) return null;
  const { state } = subscription;
  if (state === "grace") {
    return {
      tone: "warning",
      title: "Your subscription has ended",
      text: `It ended on ${shortDate(subscription.endsAt)}. You can keep working for ${plural(subscription.daysLeft ?? 0, "more day")} while it is renewed.`,
    };
  }
  if (state === "expired") {
    return {
      tone: "danger",
      title: "Your subscription has ended",
      text: `It ended on ${shortDate(subscription.endsAt)}. You can look at your records, but nothing can be changed until it is renewed.`,
    };
  }
  if (state === "active" && subscription.endsAt && subscription.daysLeft != null) {
    // days left is the server's own count (a part-day counts as a day), so the notice and the headers agree
    const left = subscription.daysLeft;
    if (left >= 0 && left <= 14) {
      return {
        tone: left <= 3 ? "warning" : "info",
        title: left === 0 ? "Your subscription ends today" : `Your subscription ends in ${plural(left, "day")}`,
        text: `It runs to ${shortDate(subscription.endsAt)}. Ask your account manager to renew it so nothing is interrupted.`,
      };
    }
  }
  return null;
}

/** The title and wording of the page shown to a blocked organisation. */
export function blockedPageText(blocked) {
  const state = blocked?.state;
  if (state === "suspended") return { title: "This account is suspended", lead: "Access has been paused." };
  if (state === "closed") return { title: "This account is closed", lead: "This organisation is no longer active." };
  return { title: "Your subscription has ended", lead: blocked?.endsAt ? `It ended on ${shortDate(blocked.endsAt)}.` : "Access has been paused until it is renewed." };
}
