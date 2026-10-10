// Closing a fiscal year, as the screen words it. The rules (what may be closed, what each check means) are the
// server's - services/financial/yearEndService.js decides, and sends the checks with their wording - so this file only
// does the small things around them: when the button may be pressed, how a closed year's row reads, how an amount is said.

import { formatNumber } from "../utils/format";
import { orgCurrency } from "../utils/orgLocale";
import { lockSentence } from "./periodClose";

/** "AED 1,234.50" in the organisation's own currency. */
export const money = (n, currency = orgCurrency()) => `${currency} ${formatNumber(Math.abs(Number(n) || 0), 2)}`.trim();

/** A check's level -> the tone of its pill and icon. */
export const TONE = { ok: "success", warning: "warning", blocker: "danger" };

/** The profit of a year in words: "Profit of AED 500.00", "Loss of AED 50.00" or "No profit or loss". */
export function profitWords(profit, currency) {
  const p = Math.round((Number(profit) || 0) * 100) / 100;
  if (p === 0) return "No profit or loss";
  return `${p > 0 ? "Profit" : "Loss"} of ${money(p, currency)}`;
}

/** The codes of the warnings a person has ticked. */
export const acknowledged = (ticked) => [...(ticked || [])].sort();

/** May the Close button be pressed? Nothing blocks the year, and every warning has been ticked by name. */
export function canConfirm(preview, ticked) {
  if (!preview || preview.canClose !== true) return false;
  const given = new Set(ticked || []);
  return (preview.warnings || []).every((w) => given.has(w.code));
}

/** Every warning of a preview that is still to be ticked. */
export const outstanding = (preview, ticked) => {
  const given = new Set(ticked || []);
  return (preview?.warnings || []).filter((w) => !given.has(w.code));
};

/** What a closed year's row says about how it was closed; for an open year, how far its months are closed, or "". */
export function closedNote(year, currency) {
  if (year?.status !== "closed") return year?.lockedThrough ? `Months closed. ${lockSentence(year.lockedThrough)}` : "";
  const c = year.closing;
  if (!c) return "Locked only. It was closed before year-end closing existed, so its profit never reached Retained Earnings. Reopen and close it again to move it.";
  if (c.posted) return `${profitWords(c.profit, currency)} moved to ${c.retainedAccountName || "Retained Earnings"} (${c.voucherNo})`;
  return "Closed. There was nothing to carry over.";
}

/** The sentence a toast says after closing. */
export function closedToast(code, closing, currency) {
  if (!closing?.posted) return `${code} closed`;
  return `${code} closed. ${profitWords(closing.profit, currency)} moved to ${closing.retainedAccountName || "Retained Earnings"}.`;
}
