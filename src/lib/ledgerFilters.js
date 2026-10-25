// Narrowing a grouped ledger report to the part somebody actually wants: the payables, the
// receivables, the expenses - or only the accounts that still carry a balance.
//
// Pure, and shared by the General ledger and anything else the server answers as
// `groups: [{ name, category, accounts: [...], totals: {...} }]`. The trial balance has its own
// module because the server hands it a FLAT list of accounts and it does its own grouping; this one
// filters inside grouping the server already did. The two keep the same vocabulary on purpose -
// Category, Group, Rows - so the choices mean the same thing on every report.

import { SHOW_OPTIONS, SHOW_ALL_LABEL, CATEGORY_OPTIONS, CATEGORY_LABELS } from "./trialBalance";

export { SHOW_OPTIONS, SHOW_ALL_LABEL, CATEGORY_OPTIONS, CATEGORY_LABELS };

const ZERO = 0.005;
const CATEGORY_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

const moved = (a) => Math.abs(a.debit || 0) >= ZERO || Math.abs(a.credit || 0) >= ZERO;
const holds = (a) => Math.abs(a.closing || 0) >= ZERO;

/**
 * The groups a set of choices leaves. A group whose accounts are all filtered out goes with them -
 * an empty heading is noise, not information. Totals are recomputed from what survived, because a
 * subtotal that still counts rows nobody can see is simply wrong.
 */
export function filterGroups(groups = [], { search = "", category = "", group = "", show = "" } = {}) {
  const term = String(search || "").trim().toLowerCase();
  const out = [];
  for (const g of groups) {
    if (category && g.category !== category) continue;
    if (group && g.name !== group) continue;
    // A search that names the GROUP keeps all of it; otherwise it is matched account by account.
    const groupHit = term && String(g.name || "").toLowerCase().includes(term);
    const accounts = (g.accounts || []).filter((a) => {
      if (show === "activity" && !moved(a)) return false;
      if (show === "nonzero" && !holds(a)) return false;
      if (!term || groupHit) return true;
      return [a.accountName, a.accountCode].some((t) => String(t || "").toLowerCase().includes(term));
    });
    if (!accounts.length) continue;
    out.push({ ...g, accounts, totals: sumAccounts(accounts) });
  }
  return out;
}

export const sumAccounts = (accounts = []) => accounts.reduce((t, a) => ({
  opening: r2(t.opening + (a.opening || 0)),
  debit: r2(t.debit + (a.debit || 0)),
  credit: r2(t.credit + (a.credit || 0)),
  closing: r2(t.closing + (a.closing || 0)),
}), { opening: 0, debit: 0, credit: 0, closing: 0 });

export const sumGroups = (groups = []) => sumAccounts(groups.map((g) => g.totals || {}));

export const countAccounts = (groups = []) => groups.reduce((t, g) => t + (g.accounts?.length || 0), 0);

/** True when a choice is leaving something out. A category or group chosen, a search, or a rows rule. */
export const isNarrowed = ({ search = "", category = "", group = "", show = "" } = {}) =>
  Boolean(String(search || "").trim()) || Boolean(category) || Boolean(group) || Boolean(show);

/** The groups on offer, in reading order, for the Group filter. */
export const groupChoices = (groups = []) =>
  [...groups]
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
      || String(a.name).localeCompare(String(b.name)))
    .map((g) => [g.name, g.name]);
