// Closing a month, as the screen words it. The rules (which month is next, what each check means) are the server's -
// services/financial/periodCloseService.js decides, and sends every year with its months and every check with its wording
// - so this file only does the small things around them: which year the month list opens on, how a month reads in the list,
// and the sentences a toast and a year's row say. The checks, the ticks and the Close button follow lib/yearEnd.js.

import { formatDate } from "../utils/format";

/** The calendar day a month lock runs to, as a sentence: "Posting is closed up to 31 Aug 2026". Empty when no month is closed. */
export const lockSentence = (lockedThrough) => (lockedThrough ? `Posting is closed up to ${formatDate(lockedThrough)}` : "");

/**
 * The year the month list opens on: the oldest open year that still has a month to close (that is where the work is),
 * else the newest year. `years` as the server lists them (newest first).
 */
export function defaultYear(years) {
  const list = Array.isArray(years) ? years : [];
  const working = list.filter((y) => y?.status !== "closed" && (y.months || []).some((m) => m.status === "open"));
  if (working.length) return working[working.length - 1];
  return list[0] || null;
}

/** A month's status, in the words of the list. */
export function statusLabel(month) {
  if (month?.status === "closed") return "Closed";
  if (month?.status === "yearClosed") return "Closed with the year";
  return "Open";
}

/** Who closed a month and when, or "" for a month that is not closed (or was closed before the record was kept). */
export function closedNote(month) {
  if (month?.status !== "closed") return "";
  const when = month.closedAt ? formatDate(month.closedAt) : "";
  if (month.closedBy && when) return `${month.closedBy}, ${when}`;
  return month.closedBy || when || "";
}

/** The button a month offers, or null: only the next month in order closes, only the latest closed month reopens. */
export function monthAction(month) {
  if (month?.canClose) return "close";
  if (month?.canReopen) return "reopen";
  return null;
}

/** The sentence a toast says after closing a month. */
export const closedToast = (label, lockedThrough) => `${label} closed. ${lockSentence(lockedThrough)}.`;

/** The sentence a toast says after reopening a month. */
export const reopenedToast = (label, lockedThrough) => (lockedThrough ? `${label} reopened. ${lockSentence(lockedThrough)}.` : `${label} reopened`);
