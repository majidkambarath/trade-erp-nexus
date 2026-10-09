import React, { useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "../../ui/button";
import { useOrganisation } from "../../shell/OrganisationContext";
import EntryGrid from "../../finance/EntryGrid";
import { Balance, ConfirmDialog, EmptyState, ErrorNote, Panel, Pill, SearchSelect, Spinner, TextInput, useAsync } from "../kit";
import { openingBalances } from "../../../lib/openingBalanceApi";
import { accountOption, fromCents, money, toCents } from "../../../lib/voucherForms";
import { accountTotals, accountsPayload, emptyAccountRow, fmt, validateAccountRows } from "../../../lib/openingBalanceForms";
import { formatDate } from "../../../utils/format";
import { FooterRow, LedgerLink, NeedsDate, Note, StatusPill } from "./parts";

const AMOUNT = /^\d*(\.\d{0,2})?$/;
const clean = (v) => v.replace(/,/g, "");
const blankRows = () => [emptyAccountRow(), emptyAccountRow(), emptyAccountRow()];

// Step 2 - account balances, entered as a trial balance. The difference between the debits and the
// credits is posted to Opening Balance Equity, so the voucher always balances; the figure is shown
// before posting.
export default function AccountsStep({ goLive, notify, onChanged, goToDate }) {
  const data = useAsync(() => openingBalances.accounts(), []);
  const grid = useRef(null);
  const [rows, setRows] = useState(blankRows);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null); // { kind: "post" } | { kind: "reverse", voucher }
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  // Entering and reversing opening balances is accounts.manage; the entered figures are there for anyone who may look.
  const { canAny } = useOrganisation();
  const canManage = canAny("accounts.manage");

  const options = useMemo(() => (data.data?.available || []).map(accountOption), [data.data]);
  const totals = useMemo(() => accountTotals(rows), [rows]);
  const equityName = data.data?.equity?.accountName || "Opening Balance Equity";
  if (!goLive) return <NeedsDate onGo={goToDate} />;

  // a row that is being corrected no longer shows the mistake it was flagged for (the next Post checks it again)
  const clearError = (i) => setErrors((e) => {
    if (!e[i] && !e._) return e;
    const next = { ...e };
    delete next[i];
    delete next._;
    return next;
  });
  const patch = (i, p) => {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...p } : r)));
    clearError(i);
  };
  function setAmount(i, side, raw) {
    const v = clean(raw);
    if (!AMOUNT.test(v)) return;
    patch(i, { [side]: v, ...(toCents(v) ? { [side === "debit" ? "credit" : "debit"]: "" } : {}) });
  }
  const tidy = (i, side) => rows[i][side] && patch(i, { [side]: fromCents(toCents(rows[i][side])).toFixed(2) });

  function review() {
    const found = validateAccountRows(rows);
    setErrors(found);
    setProblem(null);
    if (!Object.keys(found).length) setConfirm({ kind: "post" });
  }

  async function run() {
    setBusy(true);
    try {
      if (confirm.kind === "post") {
        const res = await openingBalances.postAccounts(accountsPayload({ date: goLive, rows }));
        notify(`${res.voucherNo} posted: ${res.lines} account balances`);
        setRows(blankRows());
      } else {
        const res = await openingBalances.reverseAccounts(confirm.voucher._id);
        notify(`${res.voucherNo} reversed`);
      }
      setConfirm(null);
      await data.reload();
      onChanged();
    } catch (e) {
      setConfirm(null);
      setProblem(e);
    } finally {
      setBusy(false);
    }
  }

  const eq = totals.equity;
  const entered = data.data?.entered || [];
  const vouchers = data.data?.vouchers || [];

  return (
    <div className="space-y-5">
      {/* the entry panel carries these for someone who can enter; a reader gets them here */}
      {!canManage && data.loading && !data.data && <Spinner label="Loading accounts" />}
      {!canManage && <ErrorNote error={data.error} />}
      {canManage && (
        <Panel
          title="Account balances"
          description={`Enter each account's balance as at ${formatDate(goLive)}, as a debit or a credit. Customer and vendor accounts come from their open invoices, and the Inventory account from the opening stock.`}
          actions={<Button onClick={review} disabled={busy || !totals.count}>Post account balances</Button>}
        >
          {data.loading && !data.data && <Spinner label="Loading accounts" />}
          <ErrorNote error={data.error || problem} />
          {data.data && (
            <div className="space-y-3" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); review(); } }}>
              <EntryGrid
                ref={grid} ariaLabel="Account balances" rows={rows} rowErrors={errors} minRows={1} addLabel="Add account"
                columns={[
                  { key: "account", label: "Account", className: "min-w-72 w-[55%]" },
                  { key: "debit", label: "Debit", align: "end", className: "w-40" },
                  { key: "credit", label: "Credit", align: "end", className: "w-40" },
                ]}
                onAdd={() => setRows((rs) => [...rs, emptyAccountRow()])}
                onRemove={(i) => setRows((rs) => rs.filter((_, k) => k !== i))}
                renderCell={(row, i, col) => {
                  if (col.key === "account") {
                    return (
                      <SearchSelect
                        aria-label={`Account, row ${i + 1}`} value={row.accountId} options={options}
                        onChange={(v) => { patch(i, { accountId: v }); setTimeout(() => grid.current?.focusCell(i, row.credit && !row.debit ? "credit" : "debit"), 0); }}
                        placeholder="Search account…" noOptionsText="No account matches" invalid={Boolean(errors[i] && !row.accountId)}
                      />
                    );
                  }
                  return (
                    <TextInput
                      aria-label={`${col.label}, row ${i + 1}`} inputMode="decimal" className="text-end tabular-nums" placeholder="0.00"
                      value={row[col.key]} onChange={(e) => setAmount(i, col.key, e.target.value)} onBlur={() => tidy(i, col.key)}
                    />
                  );
                }}
                footer={
                  <>
                    <FooterRow span={2} label="Entered" cells={[money(totals.debit), money(totals.credit)]} />
                    <FooterRow
                      span={2}
                      label={<>Balancing line to <span className="font-semibold">{equityName}</span>{eq.side && <span className="ms-1 text-muted-foreground">({eq.side})</span>}</>}
                      cells={[eq.side === "debit" ? money(eq.amount) : "", eq.side === "credit" ? money(eq.amount) : ""]}
                    />
                    <FooterRow span={2} strong label="Voucher total" cells={[money(Math.max(totals.debit, totals.credit)), money(Math.max(totals.debit, totals.credit))]} />
                  </>
                }
              />
              {errors._ && <p role="alert" className="text-sm font-medium text-status-danger">{errors._}</p>}
              <p className="text-xs text-muted-foreground">Enter moves across the row; Alt+N adds a row; Ctrl+Enter posts.</p>
              {eq.amount > 0 && (
                <Note tone="info" aria-live="polite">
                  The difference of <span className="font-semibold">{money(eq.amount)}</span> will be posted to {equityName} as a {eq.side}, so the voucher balances.
                </Note>
              )}
            </div>
          )}
        </Panel>
      )}

      <Panel title="Already entered" description={canManage ? "These accounts have an opening balance and are not offered again. Reverse the voucher below to correct them." : "These accounts have an opening balance."} bodyClassName="p-0">
        {data.data && entered.length === 0 && <EmptyState title="Nothing entered yet" text="Accounts you post appear here with their amounts." />}
        {entered.length > 0 && (
          <div className="erp-scroll table-pin-first overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-2 text-start">Account</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-3 py-2 text-start">Voucher</th><th className="px-5 py-2"><span className="sr-only">Ledger</span></th></tr>
              </thead>
              <tbody>
                {entered.map((e) => (
                  <tr key={e.accountId} className="border-t border-border">
                    <td className="px-5 py-2.5">
                      <span className="font-medium">{e.accountName}</span> <span className="text-xs text-muted-foreground">{e.accountCode}</span>
                      {e.party && <Pill className="ms-2">Customer / vendor account</Pill>}
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{e.debit ? fmt(e.debit) : ""}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{e.credit ? fmt(e.credit) : ""}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.source === "account-created" ? "Set when the account was created" : e.voucherNo}</td>
                    <td className="px-5 py-2.5 text-end"><LedgerLink /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {vouchers.length > 0 && (
        <Panel title="Opening vouchers" description="Each submission is one voucher. Reversing it removes all its lines and the balancing line, while the fiscal period is open." bodyClassName="p-0">
          <div className="erp-scroll table-pin-first overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-2 text-start">Voucher</th><th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-end">Accounts</th><th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-3 py-2 text-end">To equity</th><th className="px-3 py-2 text-start">Status</th>{canManage && <th className="px-5 py-2 text-end"><span className="sr-only">Action</span></th>}</tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v._id} className="border-t border-border">
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs font-semibold">{v.voucherNo}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatDate(v.date)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{v.lines?.length || 0}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{fmt(v.totalDebit)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{fmt(v.totalCredit)}</td>
                    <td className="px-3 py-2.5 text-end"><Balance net={v.difference?.side === "debit" ? v.difference.amount : -(v.difference?.amount || 0)} /></td>
                    <td className="px-3 py-2.5"><StatusPill status={v.status} /></td>
                    {canManage && (
                      <td className="px-5 py-2.5 text-end">
                        {v.status === "posted" && (
                          <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "reverse", voucher: v })}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reverse</Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {confirm?.kind === "post" && (
        <ConfirmDialog
          title="Post these account balances?" confirmLabel="Post balances" busy={busy} onConfirm={run} onClose={() => setConfirm(null)}
          text={`${totals.count} account${totals.count === 1 ? "" : "s"} will be posted as one voucher dated ${formatDate(goLive)}: debits ${money(totals.debit)}, credits ${money(totals.credit)}.${eq.amount > 0 ? ` The difference of ${money(eq.amount)} goes to ${equityName} as a ${eq.side}.` : ""} It can be reversed later while the fiscal period is open.`}
        />
      )}
      {confirm?.kind === "reverse" && (
        <ConfirmDialog
          title={`Reverse ${confirm.voucher.voucherNo}?`} confirmLabel="Reverse voucher" danger busy={busy} onConfirm={run} onClose={() => setConfirm(null)}
          text={`All ${confirm.voucher.lines?.length || 0} account balances of this voucher, and its balancing line to ${equityName}, are taken out of the ledger. The accounts can then be entered again. The reversal stays on record.`}
        />
      )}
    </div>
  );
}
