import React, { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { Button } from "../../ui/button";
import { ConfirmDialog, ErrorNote, Panel, Pill, SearchSelect, Spinner, errorMessage, useAsync } from "../kit";

const CATEGORY_LABEL = { ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses" };
const SECTION_LABEL = { null: "General", "purchase-group": "When you buy", "sales-group": "When you sell" };

function flatGroups(chart) {
  const out = [];
  const walk = (nodes, depth) => nodes.forEach((g) => { out.push({ _id: g._id, name: g.name, category: g.category, depth }); walk(g.children, depth + 1); });
  chart?.categories.forEach((c) => walk(c.groups, 0));
  return out;
}
function flatAccounts(chart) {
  const out = [];
  const walk = (nodes, category) => nodes.forEach((g) => { g.accounts.forEach((a) => a.isActive && out.push({ ...a, category })); walk(g.children, category); });
  chart?.categories.forEach((c) => { walk(c.groups, c.category); c.ungrouped.forEach((a) => a.isActive && out.push({ ...a, category: c.category })); });
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
  const dirty = Object.keys(draft).filter((k) => draft[k] !== current(rows.find((r) => r.configKey === k)));
  const unmapped = mappable.filter((r) => !value(r));
  const enabled = cfg.data.ledgerPostingEnabled;

  const sections = [null, "purchase-group", "sales-group"].map((p) => ({
    key: p, title: SECTION_LABEL[p], rows: rows.filter((r) => (r.parentConfigKey || null) === p && r.targetKind !== "none" || (p === null && r.targetKind === "none" && r.configKey === "share-capital-group")),
  })).filter((s) => s.rows.length);

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
        {!enabled && unmapped.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Map every account below, save, then switch posting on.</p>}
      </Panel>

      {sections.map((s) => (
        <Panel key={String(s.key)} title={s.title} bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {s.rows.map((r) => (
              <li key={r.configKey} className="grid items-center gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.displayName}</p>
                  <p className="text-xs text-muted-foreground"><span className="font-mono">{r.configKey}</span>{r.accountCategory ? ` · ${CATEGORY_LABEL[r.accountCategory]}` : ""}</p>
                </div>
                {r.targetKind === "none" ? (
                  <p className="text-sm text-muted-foreground">Every equity group is included automatically.</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <SearchSelect
                      aria-label={`Account for ${r.displayName}`} value={value(r)} clearable
                      onChange={(v) => setDraft((d) => ({ ...d, [r.configKey]: v }))}
                      placeholder="Not mapped" noOptionsText={r.targetKind === "group" ? "No group matches" : "No account matches"}
                      options={r.targetKind === "group"
                        ? groups.filter((g) => !r.accountCategory || g.category === r.accountCategory).map((g) => ({ value: g._id, label: g.name, depth: g.depth }))
                        : accounts.filter((a) => !r.accountCategory || a.category === r.accountCategory).map((a) => ({ value: a._id, label: a.accountName, hint: a.accountCode, searchText: a.accountCode }))}
                    />
                    {!value(r) && <CircleAlert className="h-4 w-4 shrink-0 text-status-warning" aria-label="Not mapped" />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      ))}

      <ErrorNote error={error} />
      <div className="sticky bottom-3 flex items-center justify-end gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-elevated">
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
