import React, { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axiosInstance from "../../axios/axios";
import { Eye, Plus } from "lucide-react";
import { Button } from "../ui/button";
import Can from "../shell/Can";
import { DataTable, DateInput, ErrorNote, Field, Modal, PageHeader, Panel, SearchSelect, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import EntryGrid from "./EntryGrid";
import { ListBody, ListToolbar, StatusPill, VoucherView, todayInput, useChartAccounts, useVoucherList } from "./shared";
import { accounting } from "../../lib/accountingApi";
import { vouchers } from "../../lib/bankingApi";
import { emptyNoteLine, money, noteTotals, notePreview, savedVerb, toCents, validateNote } from "../../lib/voucherForms";
import { cn } from "../../lib/utils";
import { CURRENCY, formatDateGB, formatNumber } from "../../utils/format";
import { isReverseCharge } from "../../lib/reverseCharge";

// Debit and credit notes. The party is debited by a debit note and credited by a credit note; the
// lines on the other side say what it was for (a price difference, damaged goods, a charge).
//
//   Customer credit note  - we reduce what they owe     (can be set against an open invoice)
//   Customer debit note   - we charge them more
//   Vendor debit note     - we reduce what we owe them  (can be set against an open invoice)
//   Vendor credit note    - they charge us more

const TYPES = {
  credit_note: { label: "Credit notes", one: "credit note", short: "CN" },
  debit_note: { label: "Debit notes", one: "debit note", short: "DN" },
};
const reduces = (type, partyType) => (partyType === "Customer" && type === "credit_note") || (partyType === "Vendor" && type === "debit_note");
const AMOUNT = /^\d*(\.\d{0,2})?$/;

export default function DebitCreditNotes() {
  const [params, setParams] = useSearchParams();
  const type = TYPES[params.get("type")] ? params.get("type") : "credit_note";
  const list = useVoucherList(type);
  const { notify, toastNode } = useToasts();
  const [form, setForm] = useState(false);
  const [viewing, setViewing] = useState(null);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Debit and credit notes"
        description="Adjust what a customer or vendor owes without a new invoice: a price correction, damaged goods, an extra charge."
        actions={<Can permission="finance.create"><Button onClick={() => setForm(true)}><Plus className="h-4 w-4" aria-hidden="true" />New {TYPES[type].one}</Button></Can>}
      />
      <div role="tablist" aria-label="Note type" className="mb-4 inline-flex rounded-full border border-border bg-card p-1">
        {Object.entries(TYPES).map(([key, t]) => (
          <button
            key={key} role="tab" type="button" aria-selected={type === key} onClick={() => setParams({ type: key }, { replace: true })}
            className={cn("min-h-10 rounded-full px-4 py-1.5 text-sm font-medium lg:min-h-0", type === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ListToolbar filters={list.filters} set={list.set} />
      <Panel bodyClassName="p-0">
        <ListBody list={list} emptyTitle={`No ${TYPES[type].label.toLowerCase()}`} emptyText={`Raise one with New ${TYPES[type].one}.`}>
          <DataTable
            caption="Debit and credit notes"
            rows={list.rows}
            rowKey={(v) => v._id}
            onRowClick={(v) => setViewing(v._id)}
            columns={[
              { key: "no", header: "Note", card: "primary", className: "whitespace-nowrap font-mono text-xs font-semibold", cell: (v) => v.voucherNo },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap", cell: (v) => formatDateGB(v.date) },
              { key: "party", header: "Party", card: "title", cell: (v) => <><span className="font-medium">{v.partyName}</span><span className="ms-1 text-xs text-muted-foreground">{v.partyType}</span></> },
              { key: "against", header: "Against", card: "meta", className: "whitespace-nowrap font-mono text-xs text-muted-foreground", cell: (v) => v.referenceInvoiceNo || "On account" },
              { key: "vat", header: "VAT", align: "end", card: "hidden", className: "tabular-nums text-muted-foreground", cell: (v) => v.vatTotal ? money(toCents(v.vatTotal)) : "" },
              { key: "total", header: "Total", align: "end", card: "amount", className: "font-medium tabular-nums", cell: (v) => money(toCents(v.totalAmount)) },
              { key: "status", header: "Status", card: "badge", cell: (v) => <StatusPill status={v.status} doc={v} /> },
              { key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", cell: (v) => <button type="button" aria-label={`View ${v.voucherNo}`} onClick={() => setViewing(v._id)} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" aria-hidden="true" /></button> },
            ]}
          />
        </ListBody>
      </Panel>
      {form && <NoteForm initialType={type} onClose={() => setForm(false)} onSaved={(msg, savedType) => { setForm(false); notify(msg); if (savedType !== type) setParams({ type: savedType }, { replace: true }); else list.reload(); }} />}
      {viewing && <VoucherView id={viewing} onChanged={list.reload}title={TYPES[type].one[0].toUpperCase() + TYPES[type].one.slice(1)} onClose={() => setViewing(null)} onDeleted={() => { setViewing(null); notify("Note deleted and reversed"); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

const Segmented = ({ label, value, onChange, options }) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-input bg-card p-0.5">
    {options.map(([v, text]) => (
      <label key={v} className={cn("cursor-pointer min-h-10 rounded-full px-4 py-1.5 text-sm font-medium lg:min-h-0 focus-within:ring-2 focus-within:ring-ring", value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
        <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
        {text}
      </label>
    ))}
  </div>
);

export function NoteForm({ initialType = "credit_note", onClose, onSaved }) {
  const { accounts, options: accountOptions, loading: loadingAccounts, error: accountsError } = useChartAccounts();
  const taxes = useAsync(() => accounting.taxCodes(), []);
  const grid = useRef(null);
  const [type, setType] = useState(initialType);
  const [partyType, setPartyType] = useState("Customer");
  const [partyId, setPartyId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [date, setDate] = useState(todayInput());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState([emptyNoteLine()]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const parties = useAsync(() => axiosInstance.get(partyType === "Vendor" ? "/vendors/vendors" : "/customers/customers").then((r) => r.data?.data || []), [partyType]);
  const nameKey = partyType === "Vendor" ? "vendorName" : "customerName";
  const party = (parties.data || []).find((p) => p._id === partyId);
  const partyOptions = useMemo(() => (parties.data || []).map((p) => ({ value: p._id, label: p[nameKey], hint: p[partyType === "Vendor" ? "vendorId" : "customerId"] })), [parties.data, nameKey, partyType]);

  const canSettle = reduces(type, partyType);
  const invoices = useAsync(
    () => (partyId && canSettle
      ? axiosInstance.get("/transactions/transactions", { params: { type: partyType === "Vendor" ? "purchase_order" : "sales_order", partyId, status: "APPROVED", limit: 100 } })
          .then((r) => (r.data?.data || []).filter((d) => d.outstandingAmount > 0.005))
      : Promise.resolve([])),
    [partyId, canSettle, partyType]
  );
  const invoiceOptions = (invoices.data || []).map((d) => ({ value: d._id, label: d.transactionNo, hint: `${formatNumber(d.outstandingAmount, 2)} open · ${formatDateGB(d.date)}` }));

  const taxList = (taxes.data || []).filter((t) => t.isActive !== false);
  // a reverse-charge code is assessed on a purchase invoice, not here (the server refuses it); one a line already carries stays visible
  const taxOptions = taxList.filter((t) => !isReverseCharge(t) || lines.some((l) => l.taxCodeId === t._id)).map((t) => ({ value: t._id, label: t.name, hint: `${t.ratePercent}%` }));
  const totals = useMemo(() => noteTotals(lines, taxList), [lines, taxList]);
  const preview = notePreview({ type, partyName: party?.[nameKey], partyType, lines, accounts, totals });
  const patch = (i, p) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));

  const changeParty = (p) => { setPartyType(p); setPartyId(""); setInvoiceId(""); };

  async function save() {
    const found = validateNote({ partyId, lines });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await vouchers.create({
        voucherType: type, partyType, partyId, date, narration: narration.trim() || undefined,
        referenceInvoiceId: canSettle && invoiceId ? invoiceId : undefined,
        lines: lines.filter((l) => l.accountId || toCents(l.amount)).map((l) => ({ accountId: l.accountId, description: l.description.trim() || undefined, amount: toCents(l.amount) / 100, taxCodeId: l.taxCodeId || undefined })),
      });
      onSaved(`${TYPES[type].one[0].toUpperCase() + TYPES[type].one.slice(1)} ${saved.voucherNo} ${savedVerb(saved)}`, type);
    } catch (e) {
      setProblem(e);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="xl" onClose={onClose} title={`New ${TYPES[type].one}`} description="Enter moves across the line; Alt+N adds a line; Ctrl+Enter posts."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || totals.total <= 0}>{busy ? "Posting…" : `Post ${TYPES[type].one}`}</Button></>}
    >
      <div onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }} className="space-y-5">
        {(loadingAccounts || taxes.loading) && <Spinner label="Loading" />}
        <ErrorNote error={accountsError || parties.error || problem} />
        <div className="flex flex-wrap items-center gap-4">
          <Segmented label="Note type" value={type} onChange={(t) => { setType(t); setInvoiceId(""); }} options={[["credit_note", "Credit note"], ["debit_note", "Debit note"]]} />
          <Segmented label="For a" value={partyType} onChange={changeParty} options={[["Customer", "Customer"], ["Vendor", "Vendor"]]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_12rem]">
          <Field label={partyType} required error={errors.partyId}>
            <SearchSelect value={partyId} onChange={(v) => { setPartyId(v); setInvoiceId(""); }} options={partyOptions} loading={parties.loading} autoFocus placeholder={`Search ${partyType.toLowerCase()}s…`} invalid={Boolean(errors.partyId)} noOptionsText={`No ${partyType.toLowerCase()} matches`} />
          </Field>
          <Field label="Set against invoice" hint={canSettle ? (partyId ? "Optional. Lowers what is open on that invoice." : "Choose the party first.") : `A ${TYPES[type].one} to a ${partyType.toLowerCase()} adds to what they owe, so it stays on account.`}>
            <SearchSelect value={invoiceId} onChange={setInvoiceId} options={invoiceOptions} clearable disabled={!canSettle || !partyId} loading={invoices.loading} placeholder="On account" noOptionsText="No open invoices" />
          </Field>
          <Field label="Date" required><DateInput value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>

        <EntryGrid
          ref={grid} ariaLabel="Note lines" rows={lines} rowErrors={errors} minRows={1} addLabel="Add line"
          columns={[
            { key: "account", label: "Account", className: "min-w-56 w-[30%]" },
            { key: "description", label: "Description" },
            { key: "taxCodeId", label: "Tax code", className: "w-44" },
            { key: "amount", label: "Amount", align: "end", className: "w-36" },
          ]}
          onAdd={() => setLines((ls) => [...ls, emptyNoteLine()])}
          onRemove={(i) => setLines((ls) => ls.filter((_, k) => k !== i))}
          renderCell={(row, i, col) => {
            if (col.key === "account") {
              return <SearchSelect aria-label={`Account, row ${i + 1}`} value={row.accountId} onChange={(v) => { patch(i, { accountId: v }); setTimeout(() => grid.current?.focusCell(i, "description"), 0); }} options={accountOptions} placeholder="Search account…" noOptionsText="No account matches" invalid={Boolean(errors[i] && !row.accountId)} />;
            }
            if (col.key === "description") return <TextInput aria-label={`Description, row ${i + 1}`} value={row.description} onChange={(e) => patch(i, { description: e.target.value })} maxLength={200} placeholder="What it is for…" />;
            if (col.key === "taxCodeId") return <SearchSelect aria-label={`Tax code, row ${i + 1}`} value={row.taxCodeId} onChange={(v) => patch(i, { taxCodeId: v })} options={taxOptions} clearable placeholder="No VAT" />;
            return <TextInput aria-label={`Amount, row ${i + 1}`} inputMode="decimal" className="text-end tabular-nums" placeholder="0.00" value={row.amount} onChange={(e) => AMOUNT.test(e.target.value.replace(/,/g, "")) && patch(i, { amount: e.target.value.replace(/,/g, "") })} />;
          }}
          footer={
            <>
              <tr><td colSpan={4} className="px-3 py-2 text-end font-medium">Amount</td><td className="px-4 py-2 text-end tabular-nums">{money(totals.net)}</td><td /></tr>
              <tr><td colSpan={4} className="px-3 py-2 text-end font-medium">VAT</td><td className="px-4 py-2 text-end tabular-nums">{money(totals.vat)}</td><td /></tr>
              <tr><td colSpan={4} className="px-3 py-2 text-end">Note total ({CURRENCY})</td><td className="px-4 py-2 text-end tabular-nums">{money(totals.total)}</td><td /></tr>
            </>
          }
        />
        {errors._ && <p role="alert" className="text-sm font-medium text-status-danger">{errors._}</p>}

        <div className="grid gap-4 sm:grid-cols-[1fr_20rem]">
          <Field label="Narration"><TextInput value={narration} onChange={(e) => setNarration(e.target.value)} maxLength={200} placeholder="Reason for the note" /></Field>
          <section aria-label="What will be posted" className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Will post</h3>
            <ul className="space-y-1">
              {preview.map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate"><b className="me-1.5 text-xs text-muted-foreground">{r.side}</b>{r.account}</span>
                  <span className="tabular-nums">{money(r.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Modal>
  );
}
