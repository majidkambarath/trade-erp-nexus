// The wording of a subscription's state, for the notice above the work and the page a blocked organisation sees. Pure functions of the
// status the server sends, apart from the date: that is shown as the person chose to read dates (utils/format), so it lives here and
// not in lib/organisation.js - that file is loaded by plain Node (config/navigation.js reaches it, and so does the mobile sweep),
// and must stay free of anything that only the app's bundler can resolve.
import { formatDate } from "../utils/format";

// ---- the subscription

// A subscription runs to the END of the calendar day the developer entered, which the server stores as 23:59:59.999 UTC of that
// day (organisationService endOfDay) and names in its own messages ("ended on 2026-10-10"). The day to show is that day - not the
// instant read on the organisation's clock, which would call 23:59 UTC the next morning in Dubai. It is then shown like every
// other date in the app: as the person chose to read dates (Settings -> Preferences), through utils/format.
const shortDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatDate(d.toISOString().slice(0, 10)); // a plain day reads as UTC midnight: the same calendar day in any zone at or east of UTC
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
  const day = blocked?.endsAt ? shortDate(blocked.endsAt) : "";
  return { title: "Your subscription has ended", lead: day ? `It ended on ${day}.` : "Access has been paused until it is renewed." };
}
