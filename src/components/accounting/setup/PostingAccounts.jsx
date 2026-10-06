import React, { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { Button } from "../../ui/button";
import { ConfirmDialog, ErrorNote, Panel, Pill, SearchSelect, Spinner, errorMessage, useAsync } from "../kit";

const CATEGORY_LABEL = { ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses" };

// What each setting is for, in the words an accountant or a buyer would use. The key itself is an
// internal name, so it is kept out of sight (it is the row's tooltip).
const HINTS = {
  "cash-account-group": "Where cash on hand is kept. Cash receipts and payments post here.",
  "bank-account-group": "Bank accounts. Bank, transfer and card receipts settle here.",
  "account-receivable-group": "Each customer gets an account in this group when they are created.",
  "account-payable-group": "Each vendor gets an account in this group when they are created.",
  "inventory-asset-group": "Stock on hand, valued at average cost.",
  "sales-income-group": "Revenue earned from selling goods.",
  "purchase-expense-group": "What you spend buying goods to resell.",
  "direct-income-group": "Other income earned directly from trading.",
  "indirect-income-group": "Other income such as interest and rebates.",
  "direct-expense-group": "Costs that belong to trading, such as freight in and handling.",
  "indirect-expense-group": "Running costs such as rent, salaries and utilities.",
  "share-capital-group": "Owner's capital and retained earnings.",
  "pdc-receipt-group": "Cheques received that are dated for a later day.",
  "pdc-issue-group": "Cheques you issued that are dated for a later day.",
  "credit-card-group": "Company credit cards. Each card gets its own account here.",
  "pdc-receipt": "Holds a received cheque until the bank clears it.",
  "pdc-issue": "Holds an issued cheque until it clears.",
  "card-charges": "The fee a card processor keeps from each card sale.",
  "bank-charges": "Fees the bank takes. Posted from a bank statement line, with the VAT on them.",
  "bank-interest": "Credit interest the bank pays. Posted from a bank statement line, with no VAT.",
  "stock-adjustment": "Gains and losses found when stock is counted.",
  "inventory-asset": "Debited when stock arrives and credited when it is sold.",
  "opening-balance-equity": "Offsets the opening balances you enter on accounts.",
  "vat-purchase": "VAT paid on purchases, which you claim back.",
  "rcm-purchase": "VAT you account for yourself on reverse-charge purchases.",
  "discount-purchase": "Discounts your vendors give you.",
  "freight-purchase": "Freight and handling added to purchases.",
  "round-off-purchase": "Rounding differences on purchase documents.",
  "purchase-variance": "The difference between the billed and the expected cost.",
  "sales-revenue": "Credited when a sale is approved.",
  "vat-sales": "VAT collected on sales, owed to the tax authority.",
  "discount-sales": "Discounts you give to customers.",
  "freight-sales": "Freight and handling charged to customers.",
  "round-off-sales": "Rounding differences on sales documents.",
  cogs: "The cost of the stock sold, booked on every sale.",
  "write-off-expiry": "Stock thrown away after its expiry date.",
  "damage-loss": "Stock lost or damaged.",
};

const SECTIONS = [
  { id: "groups", title: "Account groups", description: "The family each kind of account is filed under." },
  { id: "standing", title: "Standing accounts", description: "Single accounts used by cheques, cards, stock and opening balances." },
  { id: "buy", title: "When you buy", description: "Accounts a purchase posts to besides the vendor and the stock." },
  { id: "sell", title: "When you sell", description: "Accounts a sale posts to besides the customer." },
];
const sectionOf = (r) => (r.parentConfigKey === "purchase-group" ? "buy" : r.parentConfigKey === "sales-group" ? "sell" : r.targetKind === "account" ? "standing" : "groups");

function flatGroups(chart) {
  const out = [];
  const walk = (nodes, depth) => nodes.forEach((g) => { out.push({ _id: g._id, name: g.name, category: g.category, depth }); walk(g.children, depth + 1); });
  chart?.categories?.forEach((c) => walk(c.groups, 0));
  return out;
}
function flatAccounts(chart) {
  const out = [];
  const walk = (nodes, category) => nodes.forEach((g) => { g.accounts.forEach((a) => a.isActive && out.push({ ...a, category })); walk(g.children, category); });
  chart?.categories?.forEach((c) => { walk(c.groups, c.category); c.ungrouped.forEach((a) => a.isActive && out.push({ ...a, category: c.category })); });
  return out;
}

// Which ledger account (or account group) each business event posts to. Posting code asks for a
// key such as "vat-sales"; it never hard-codes an account, and an unmapped key fails loudly.
export default function PostingAccounts({ notify }) {
  const cfg = useAsync(() => accounting.configuration(), []);
  const chart = useAsync(() => accounting.chart(), []);
  const [draft, setDraft] = useState({}); // configKey -> chosen id
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState(null);

  const groups = useMemo(() => flatGroups(chart.data), [chart.data]);
  const accounts = useMemo(() => flatAccounts(chart.data), [chart.data]);

  if ((cfg.loading && !cfg.data) || (chart.loading && !chart.data)) return <Spinner label="Loading posting accounts" />;
  if (cfg.error || chart.error) return <ErrorNote error={cfg.error || chart.error} onRetry={() => { cfg.reload(); chart.reload(); }} />;

  const rows = cfg.data.accountConfiguration;
  const mappable = rows.filter((r) => r.isActive && r.targetKind !== "none");
  const current = (r) => (r.targetKind === "group" ? r.targetGroup?._id : r.targetAccount?._id) || "";
  const value = (r) => draft[r.configKey] ?? current(r);
  const changed = (r) => draft[r.configKey] !== undefined && draft[r.configKey] !== current(r);
  const dirty = Object.keys(draft).filter((k) => draft[k] !== current(rows.find((r) => r.configKey === k)));
  const unmapped = mappable.filter((r) => !value(r));
  const enabled = cfg.data.ledgerPostingEnabled;
  const mappedPct = mappable.length ? Math.round(((mappable.length - unmapped.length) / mappable.length) * 100) : 0;

  const visible = rows.filter((r) => r.isActive && r.targetKind !== "none" && r.configKey !== "purchase-group" && r.configKey !== "sales-group");
  const equityRow = rows.find((r) => r.configKey === "share-capital-group" && r.targetKind === "none");
  const sections = SECTIONS.map((s) => ({ ...s, rows: visible.filter((r) => sectionOf(r) === s.id) })).filter((s) => s.rows.length);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const mappings = dirty.map((k) => {
        const r = rows.find((x) => x.configKey === k);
        return r.targetKind === "group" ? { configKey: k, targetGroup: draft[k] || null } : { configKey: k, targetAccount: draft[k] || null };
      });
      await accounting.saveMappings(mappings);
      setDraft({});
      notify(`${mappings.length} mapping${mappings.length === 1 ? "" : "s"} saved`);
      cfg.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function togglePosting() {
    setBusy(true);
    try {
      const r = await accounting.setPosting(!enabled);
      const caught = r?.catchUp;
      notify(
        enabled ? "Ledger posting switched off"
          : caught?.posted ? `Ledger posting switched on; ${caught.posted} earlier document${caught.posted === 1 ? "" : "s"} posted`
          : "Ledger posting switched on"
      );
      if (caught?.failed?.length) notify(`${caught.failed.length} earlier document(s) could not be posted: ${caught.failed[0].transactionNo} - ${caught.failed[0].reason}`, "error");
      setConfirm(null);
      cfg.reload();
    } catch (e) {
      setConfirm(null);
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Ledger posting"
        description="When on, approving an order books its accounting entries (receivable or payable, revenue or stock, VAT, cost of goods)."
        actions={<Button variant={enabled ? "outline" : "default"} size="sm" onClick={() => setConfirm(enabled ? "off" : "on")} disabled={!enabled && unmapped.length > 0}>{enabled ? "Switch off" : "Switch on"}</Button>}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {enabled ? <Pill tone="success"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />On</Pill> : <Pill tone="warning">Off</Pill>}
          <span className="text-muted-foreground">
            {mappable.length - unmapped.length} of {mappable.length} accounts mapped
            {unmapped.length > 0 && <> · still to map: <span className="text-foreground">{unmapped.map((r) => r.displayName).join(", ")}</span></>}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-secondary" role="presentation">
          <div className={`h-full rounded-full transition-all ${unmapped.length ? "bg-status-warning" : "bg-status-success"}`} style={{ width: `${mappedPct}%` }} />
        </div>
        {!enabled && unmapped.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Map every account below, save, then switch posting on.</p>}
      </Panel>

      {sections.map((s) => {
        const left = s.rows.filter((r) => !value(r)).length;
        return (
          <Panel
            key={s.id} title={s.title} description={s.description} bodyClassName="p-0"
            actions={left ? <Pill tone="warning">{left} to map</Pill> : <Pill tone="success">All mapped</Pill>}
          >
            <div className="hidden border-b border-border bg-secondary/50 px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_26rem_7.5rem] lg:gap-x-6">
              <span>Posting event</span><span>Posts to</span><span>Status</span>
            </div>
            <ul className="divide-y divide-border">
              {s.rows.map((r) => (
                <li key={r.configKey} title={r.configKey} className={`grid items-center gap-x-6 gap-y-2 px-5 py-3.5 lg:grid-cols-[minmax(0,1fr)_26rem_7.5rem] ${changed(r) ? "bg-accent/40" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.displayName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{HINTS[r.configKey] || CATEGORY_LABEL[r.accountCategory] || ""}</p>
                  </div>
                  <SearchSelect
                    className="w-full" compact
                    aria-label={`Account for ${r.displayName}`} value={value(r)}
                    onChange={(v) => setDraft((d) => ({ ...d, [r.configKey]: v }))}
                    placeholder={r.targetKind === "group" ? "Choose a group" : "Choose an account"}
                    noOptionsText={r.targetKind === "group" ? "No group matches" : "No account matches"}
                    options={r.targetKind === "group"
                      ? groups.filter((g) => !r.accountCategory || g.category === r.accountCategory).map((g) => ({ value: g._id, label: g.name, depth: g.depth }))
                      : accounts.filter((a) => !r.accountCategory || a.category === r.accountCategory).map((a) => ({ value: a._id, label: a.accountName, hint: a.accountCode, searchText: a.accountCode }))}
                  />
                  <div className="text-sm">
                    {changed(r) ? <Pill tone="info">Unsaved</Pill>
                      : value(r) ? <span className="inline-flex items-center gap-1.5 text-status-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Mapped</span>
                      : <Pill tone="warning">Not mapped</Pill>}
                  </div>
                </li>
              ))}
              {s.id === "groups" && equityRow && (
                <li className="grid items-center gap-x-6 gap-y-1 px-5 py-3.5 lg:grid-cols-[minmax(0,1fr)_26rem_7.5rem]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{equityRow.displayName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{HINTS[equityRow.configKey]}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Every equity group is included automatically.</p>
                  <span className="inline-flex items-center gap-1.5 text-sm text-status-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Automatic</span>
                </li>
              )}
            </ul>
          </Panel>
        );
      })}

      <ErrorNote error={error} />
      <div className="sticky bottom-3 flex items-center justify-end gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-elevated">
        <span className="me-auto text-sm text-muted-foreground">{dirty.length ? `${dirty.length} unsaved change${dirty.length > 1 ? "s" : ""}` : "No unsaved changes"}</span>
        <Button variant="outline" onClick={() => setDraft({})} disabled={!dirty.length || busy}>Discard</Button>
        <Button onClick={save} disabled={!dirty.length || busy}>{busy ? "Saving…" : "Save mappings"}</Button>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm === "on" ? "Switch ledger posting on?" : "Switch ledger posting off?"} busy={busy} danger={confirm === "off"}
          confirmLabel={confirm === "on" ? "Switch on" : "Switch off"}
          text={confirm === "on"
            ? "Approving an order books its accounting entries. Orders already approved are posted now, with their original dates, so the books, statements and ageing agree."
            : "Orders approved while posting is off will have no accounting entries until it is switched on again, when they are caught up. Entries already booked stay as they are."}
          onConfirm={togglePosting} onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
