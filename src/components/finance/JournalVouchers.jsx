import React, { useMemo, useRef, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { ErrorNote, Field, Modal, PageHeader, Panel, Pill, SearchSelect, Spinner, TextInput, errorMessage, useToasts, DateInput } from "../accounting/kit";
import EntryGrid from "./EntryGrid";
import { ListBody, ListToolbar, StatusPill, VoucherView, todayInput, useChartAccounts, useVoucherList } from "./shared";
import { vouchers } from "../../lib/bankingApi";
import { emptyJournalRow, fromCents, journalPayload, journalRowsFromVoucher, journalTotals, money, suggestBalance, toCents, validateJournal } from "../../lib/voucherForms";
import { drCr, formatDateGB } from "../../utils/format";

// Journal vouchers: any number of rows, each a debit or a credit on an account of the chart.
// Saving is allowed only when debits equal credits.

const AMOUNT = /^\d*(\.\d{0,2})?$/;
const clean = (v) => v.replace(/,/g, "");

export default function JournalVouchers() {
  const list = useVoucherList("journal");
  const { notify, toastNode } = useToasts();
  const [form, setForm] = useState(null); // {} for new, or a voucher to edit
  const [viewing, setViewing] = useState(null);

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader
        title="Journal vouchers"
        description="Move amounts between any accounts of the chart. Add as many rows as you need; the voucher posts when debits equal credits."
        actions={<Button onClick={() => setForm({})}><Plus className="h-4 w-4" aria-hidden="true" />New journal</Button>}
      />
      <ListToolbar filters={list.filters} set={list.set} />
      <Panel bodyClassName="p-0">
        <ListBody list={list} emptyTitle="No journal vouchers" emptyText="Record the first one with New journal.">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-2 text-start">Voucher</th><th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Narration</th><th className="px-3 py-2 text-end">Rows</th><th className="px-3 py-2 text-end">Amount</th><th className="px-3 py-2 text-start">Status</th><th className="px-5 py-2"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {list.rows.map((v) => (
                <tr key={v._id} className="border-t border-border hover:bg-accent/40">
                  <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs font-semibold">{v.voucherNo}{!v.ledgerBased && <Pill className="ms-2">Older format</Pill>}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateGB(v.date)}</td>
                  <td className="max-w-md truncate px-3 py-2.5 text-muted-foreground">{v.narration}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{v.entries?.length || 0}</td>
                  <td className="px-3 py-2.5 text-end font-medium tabular-nums">{money(toCents(v.totalAmount))}</td>
                  <td className="px-3 py-2.5"><StatusPill status={v.status} /></td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-end">
                    <button type="button" aria-label={`View ${v.voucherNo}`} onClick={() => setViewing(v._id)} className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" aria-hidden="true" /></button>
                    {v.ledgerBased && v.status === "approved" && (
                      <button type="button" aria-label={`Edit ${v.voucherNo}`} onClick={() => setForm(v)} className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListBody>
      </Panel>

      {form && <JournalForm voucher={form._id ? form : null} onClose={() => setForm(null)} onSaved={(msg) => { setForm(null); notify(msg); list.reload(); }} />}
      {viewing && <VoucherView id={viewing} title="Journal voucher" onClose={() => setViewing(null)} onDeleted={() => { setViewing(null); notify("Journal deleted and reversed"); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

export function JournalForm({ voucher, onClose, onSaved }) {
  const { options, loading: loadingAccounts, error: accountsError } = useChartAccounts();
  const grid = useRef(null);
  const [date, setDate] = useState(voucher ? new Date(voucher.date).toISOString().slice(0, 10) : todayInput());
  const [narration, setNarration] = useState(voucher?.narration || "");
  const [rows, setRows] = useState(() => (voucher ? journalRowsFromVoucher(voucher) : [emptyJournalRow(), emptyJournalRow()]));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const totals = useMemo(() => journalTotals(rows), [rows]);

  const patch = (i, p) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...p } : r)));

  function chooseAccount(i, accountId) {
    const row = rows[i];
    const empty = !toCents(row.debit) && !toCents(row.credit);
    const hint = accountId && empty ? suggestBalance(rows, i) : null;
    patch(i, { accountId, ...(hint ? { [hint.side]: String(hint.amount) } : {}) });
    // carry on to the amount: the suggested side, or the debit
    setTimeout(() => grid.current?.focusCell(i, hint?.side || "debit"), 0);
  }

  function setAmount(i, side, raw) {
    const v = clean(raw);
    if (!AMOUNT.test(v)) return;
    patch(i, { [side]: v, ...(toCents(v) ? { [side === "debit" ? "credit" : "debit"]: "" } : {}) });
  }
  const tidy = (i, side) => rows[i][side] && patch(i, { [side]: fromCents(toCents(rows[i][side])).toFixed(2) });

  async function save() {
    const found = validateJournal(rows);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = journalPayload({ date, narration: narration.trim() || undefined, rows });
      const saved = voucher ? await vouchers.update(voucher._id, body) : await vouchers.create(body);
      onSaved(`Journal ${saved.voucherNo} ${voucher ? "updated" : "posted"}`);
    } catch (e) {
      setProblem(e);
      setBusy(false);
    }
  }

  const diff = drCr(fromCents(totals.diff));
  return (
    <Modal
      size="xl" onClose={onClose} title={voucher ? `Edit ${voucher.voucherNo}` : "New journal voucher"}
      description="Enter moves across the row; Alt+N adds a row; Ctrl+Enter posts."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !totals.balanced}>{busy ? "Posting…" : voucher ? "Save changes" : "Post journal"}</Button>
        </>
      }
    >
      <div onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }} className="space-y-5">
        {loadingAccounts && <Spinner label="Loading accounts" />}
        <ErrorNote error={accountsError || problem} />
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Field label="Date" required><DateInput value={date} onChange={(e) => setDate(e.target.value)} data-autofocus /></Field>
          <Field label="Narration" hint="What this journal is for."><TextInput value={narration} onChange={(e) => setNarration(e.target.value)} maxLength={200} placeholder="e.g. Month-end accrual" /></Field>
        </div>

        <EntryGrid
          ref={grid} ariaLabel="Journal rows" rows={rows} rowErrors={errors}
          columns={[
            { key: "account", label: "Account", className: "min-w-64 w-[38%]" },
            { key: "narration", label: "Narration / remarks" },
            { key: "debit", label: "Debit", align: "end", className: "w-36" },
            { key: "credit", label: "Credit", align: "end", className: "w-36" },
          ]}
          onAdd={() => setRows((rs) => [...rs, emptyJournalRow()])}
          onRemove={(i) => setRows((rs) => rs.filter((_, k) => k !== i))}
          renderCell={(row, i, col) => {
            if (col.key === "account") {
              return (
                <SearchSelect
                  aria-label={`Account, row ${i + 1}`} value={row.accountId} onChange={(v) => chooseAccount(i, v)} options={options}
                  placeholder="Search account…" noOptionsText="No account matches" invalid={Boolean(errors[i] && !row.accountId)}
                />
              );
            }
            if (col.key === "narration") {
              return <TextInput aria-label={`Narration, row ${i + 1}`} value={row.narration} onChange={(e) => patch(i, { narration: e.target.value })} maxLength={200} placeholder="Narration…" />;
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
              <tr>
                <td colSpan={3} className="px-3 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-end tabular-nums">{money(totals.debit)}</td>
                <td className="px-4 py-2.5 text-end tabular-nums">{money(totals.credit)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-sm font-medium">{totals.balanced ? "Balanced" : "Difference"}</td>
                <td colSpan={2} className={totals.balanced ? "px-4 py-2 text-end text-status-success" : "px-4 py-2 text-end text-status-danger"} aria-live="polite">
                  {totals.balanced ? "0.00" : `${diff.text} ${diff.side === "Dr" ? "more debit" : "more credit"}`}
                </td>
                <td />
              </tr>
            </>
          }
        />
        {errors._ && <p role="alert" className="text-sm font-medium text-status-danger">{errors._}</p>}
      </div>
    </Modal>
  );
}

export { errorMessage };
