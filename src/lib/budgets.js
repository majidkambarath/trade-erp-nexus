// Budgets on the screen: a total spread over the months, a line's total, and what is sent. Pure; the server
// (utils/budgets.js) is the authority and gives the same answers.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** A total shared over the months, to the fils: equal parts, the last month takes what rounding left. */
export function spreadEvenly(total, months) {
  const keys = (months || []).map((m) => (typeof m === "string" ? m : m.key));
  if (!keys.length) return {};
  const cents = Math.round(round2(Number(total) || 0) * 100);
  const each = Math.floor(cents / keys.length);
  const out = {};
  keys.forEach((k, i) => {
    out[k] = String((i === keys.length - 1 ? cents - each * (keys.length - 1) : each) / 100);
  });
  return out;
}

/** The sum of a line's months. */
export const lineTotal = (amounts) => round2(Object.values(amounts || {}).reduce((t, v) => t + (Number(v) || 0), 0));

/** What the form sends: blank months left out, numbers as numbers. */
export function budgetPayload({ name, fiscalYearId, costCentreId, notes, lines }) {
  return {
    name: String(name || "").trim() || undefined,
    fiscalYearId,
    costCentreId: costCentreId || null,
    notes: notes || "",
    lines: (lines || [])
      .filter((l) => l.accountId)
      .map((l) => ({
        accountId: l.accountId,
        amounts: Object.fromEntries(Object.entries(l.amounts || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined && Number(v) > 0).map(([k, v]) => [k, round2(v)])),
      })),
  };
}

/** A month key as a short label: "2026-04" -> "Apr 26". */
export function monthLabel(key) {
  const [y, m] = String(key).split("-").map(Number);
  if (!y || !m) return key;
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${String(y).slice(2)}`;
}
