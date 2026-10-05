import React, { useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { StatCard } from "../../ui/stat-card";
import EntryGrid from "../../finance/EntryGrid";
import { ConfirmDialog, DateInput, EmptyState, ErrorNote, Panel, Pill, SearchSelect, Spinner, TextInput, useAsync } from "../kit";
import { openingBalances } from "../../../lib/openingBalanceApi";
import { fromCents, money, toCents } from "../../../lib/voucherForms";
import { emptyPartyRow, fmt, partyPayload, partyTotals, validatePartyRows } from "../../../lib/openingBalanceForms";
import { formatDate } from "../../../utils/format";
import { FooterRow, NeedsDate, Note } from "./parts";

const AMOUNT = /^\d*(\.\d{0,2})?$/;
const clean = (v) => v.replace(/,/g, "");
const blankRows = () => [emptyPartyRow(), emptyPartyRow(), emptyPartyRow()];

const KIND = {
  customer: {
    noun: "Customer", plural: "customers", nounLower: "customer", invoice: "sales invoice", side: "credit",
    owes: "owes you", settle: "receipts", posting: "Each is posted to the customer's account against Opening Balance Equity (credit).",
    empty: "Open invoices you post appear here and can be settled with receipts.",
  },
  vendor: {
    noun: "Vendor", plural: "vendors", nounLower: "vendor", invoice: "purchase invoice", side: "debit",
    owes: "you owe", settle: "payments", posting: "Each is posted to the vendor's account against Opening Balance Equity (debit).",
    empty: "Open invoices you post appear here and can be settled with payments.",
  },
};

// Steps 3 and 4 - customer and vendor open invoices. Each row becomes a real, approved invoice with
// no lines, so ageing, statements and receipts or payments work from day one. A row with no invoice
// number is the party's lump-sum opening balance.
export default function PartiesStep({ type, goLive, notify, onChanged, goToDate }) {
  const k = KIND[type];
  const data = useAsync(() => openingBalances.parties(type), [type]);
  const grid = useRef(null);
  const [rows, setRows] = useState(blankRows);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null); // { kind: "post" } | { kind: "remove", row }
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const parties = useMemo(() => (data.data?.available || []).map((p) => ({ value: p._id, label: p.name, hint: p.code, searchText: p.paymentTerms || "" })), [data.data]);
  const totals = useMemo(() => partyTotals(rows), [rows]);
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
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...p } : r)));
    clearError(i);
  };
  function setAmount(i, raw) {
    const v = clean(raw);
    if (AMOUNT.test(v)) patch(i, { amount: v });
  }
  const tidy = (i) => rows[i].amount && patch(i, { amount: fromCents(toCents(rows[i].amount)).toFixed(2) });

  function review() {
    const found = validatePartyRows(rows, { goLive, existing: data.data?.rows || [] });
    setErrors(found);
    setProblem(null);
    if (!Object.keys(found).length) setConfirm({ kind: "post" });
  }

  async function run() {
    setBusy(true);
    try {
      if (confirm.kind === "post") {
        const res = await openingBalances.postParties(partyPayload({ type, date: goLive, rows }));
        notify(`${res.count} opening ${res.count === 1 ? "invoice" : "invoices"} posted, total ${fmt(res.total)}`);
        setRows(blankRows());
      } else {
        const res = await openingBalances.reverseParty(confirm.row._id);
        notify(`${res.transactionNo} removed`);
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

  const list = data.data?.rows || [];
  const sums = data.data?.totals;

  return (
    <div className="space-y-5">
      {sums && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Opening invoices" count={sums.count} subText={`${sums.parties} ${sums.parties === 1 ? k.nounLower : k.plural}`} />
          <StatCard title="Total entered" count={fmt(sums.amount)} subText={`What ${k.plural} ${k.owes}`} />
          <StatCard title="Settled so far" count={fmt(sums.paid)} subText={`By ${k.settle}`} />
          <StatCard title="Still open" count={fmt(sums.outstanding)} />
        </div>
      )}

      <Panel
        title={`${k.noun} open invoices`}
        description={`Enter what each ${k.nounLower} ${k.owes} as at ${formatDate(goLive)}, invoice by invoice, so ageing and statements are right from day one. Leave the invoice number empty to enter one lump-sum balance for a ${k.nounLower}; it is kept as a single document, Opening balance.`}
        actions={<Button onClick={review} disabled={busy || !totals.count}>Post opening invoices</Button>}
      >
        {data.loading && !data.data && <Spinner label={`Loading ${k.plural}`} />}
        <ErrorNote error={data.error || problem} />
        {data.data && (
          <div className="space-y-3" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); review(); } }}>
            <EntryGrid
              ref={grid} ariaLabel={`${k.noun} open invoices`} rows={rows} rowErrors={errors} minRows={1} addLabel="Add invoice"
              columns={[
                { key: "party", label: k.noun, className: "min-w-64 w-[32%]" },
                { key: "reference", label: "Invoice no.", className: "min-w-36" },
                { key: "date", label: "Invoice date", className: "w-44" },
                { key: "dueDate", label: "Due date", className: "w-44" },
                { key: "amount", label: "Amount", align: "end", className: "w-40" },
              ]}
              onAdd={() => setRows((rs) => [...rs, emptyPartyRow()])}
              onRemove={(i) => setRows((rs) => rs.filter((_, n) => n !== i))}
              renderCell={(row, i, col) => {
                if (col.key === "party") {
                  return (
                    <SearchSelect
                      aria-label={`${k.noun}, row ${i + 1}`} value={row.partyId} options={parties}
                      onChange={(v) => { patch(i, { partyId: v }); setTimeout(() => grid.current?.focusCell(i, "reference"), 0); }}
                      placeholder={`Search ${k.nounLower}…`} noOptionsText={`No ${k.nounLower} matches`} invalid={Boolean(errors[i] && !row.partyId)}
                    />
                  );
                }
                if (col.key === "reference") {
                  return <TextInput aria-label={`Invoice no., row ${i + 1}`} value={row.reference} maxLength={60} placeholder="Empty: lump sum" onChange={(e) => patch(i, { reference: e.target.value })} />;
                }
                if (col.key === "date" || col.key === "dueDate") {
                  return (
                    <DateInput
                      aria-label={`${col.label}, row ${i + 1}`} value={row[col.key]} max={col.key === "date" ? goLive : undefined}
                      placeholder={col.key === "date" ? "Go-live day" : "By terms"} onChange={(e) => patch(i, { [col.key]: e.target.value })}
                    />
                  );
                }
                return (
                  <TextInput
                    aria-label={`Amount, row ${i + 1}`} inputMode="decimal" className="text-end tabular-nums" placeholder="0.00"
                    value={row.amount} onChange={(e) => setAmount(i, e.target.value)} onBlur={() => tidy(i)}
                  />
                );
              }}
              footer={<FooterRow span={5} strong label={`Total (${totals.count} ${totals.count === 1 ? "invoice" : "invoices"})`} cells={[money(totals.cents)]} />}
            />
            {errors._ && <p role="alert" className="text-sm font-medium text-status-danger">{errors._}</p>}
            <p className="text-xs text-muted-foreground">
              An empty due date follows the {k.nounLower}&apos;s payment terms. Enter moves across the row; Alt+N adds a row; Ctrl+Enter posts.
            </p>
            <Note tone="info">{k.posting} No stock, VAT or e-invoice is created, and an opening invoice cannot be returned.</Note>
          </div>
        )}
      </Panel>

      <Panel title="Entered" description={`Opening invoices already posted. One can be removed while nothing has been set against it.`} bodyClassName="p-0">
        {data.data && list.length === 0 && <EmptyState title="Nothing entered yet" text={k.empty} />}
        {list.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 text-start">Document</th><th className="px-3 py-2 text-start">{k.noun}</th><th className="px-3 py-2 text-start">Invoice no.</th>
                  <th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Due</th>
                  <th className="px-3 py-2 text-end">Amount</th><th className="px-3 py-2 text-end">Paid</th><th className="px-3 py-2 text-end">Outstanding</th><th className="px-5 py-2"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r._id} className="border-t border-border">
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs font-semibold">{r.transactionNo}</td>
                    <td className="px-3 py-2.5 font-medium">{r.partyName}</td>
                    <td className="px-3 py-2.5">{r.reference || <Pill>Opening balance</Pill>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatDate(r.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.dueDate ? formatDate(r.dueDate) : "By terms"}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{fmt(r.amount)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{fmt(r.paid)}</td>
                    <td className="px-3 py-2.5 text-end font-medium tabular-nums">{fmt(r.outstanding)}</td>
                    <td className="px-5 py-2.5 text-end">
                      {r.canReverse
                        ? <Button size="sm" variant="outline" aria-label={`Remove ${r.transactionNo}`} onClick={() => setConfirm({ kind: "remove", row: r })}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove</Button>
                        : <span className="text-xs text-muted-foreground">Settled in part</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {confirm?.kind === "post" && (
        <ConfirmDialog
          title={`Post these ${k.nounLower} invoices?`} confirmLabel="Post invoices" busy={busy} onConfirm={run} onClose={() => setConfirm(null)}
          text={`${totals.count} opening ${totals.count === 1 ? "invoice" : "invoices"} for ${totals.parties} ${totals.parties === 1 ? k.nounLower : k.plural}, total ${money(totals.cents)}, will be posted dated ${formatDate(goLive)} against Opening Balance Equity (${k.side}). Each becomes an approved ${k.invoice} with no stock, VAT or e-invoice; it ages by its due date or the ${k.nounLower}'s terms and can be settled with ${k.settle}.`}
        />
      )}
      {confirm?.kind === "remove" && (
        <ConfirmDialog
          title={`Remove ${confirm.row.transactionNo}?`} confirmLabel="Remove invoice" danger busy={busy} onConfirm={run} onClose={() => setConfirm(null)}
          text={`The opening invoice ${confirm.row.reference || "(opening balance)"} of ${confirm.row.partyName}, ${fmt(confirm.row.amount)}, is taken out of the ledger and off the ${k.nounLower}'s balance. You can enter it again.`}
        />
      )}
    </div>
  );
}
