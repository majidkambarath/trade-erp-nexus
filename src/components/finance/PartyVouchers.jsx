import React, { useMemo, useState } from "react";
import axiosInstance from "../../axios/axios";
import { Eye, Plus, Wand2 } from "lucide-react";
import { Button } from "../ui/button";
import { ErrorNote, Field, Modal, PageHeader, Panel, SearchSelect, Spinner, TextInput, Textarea, useAsync, useToasts } from "../accounting/kit";
import PaymentModeFields from "./PaymentModeFields";
import { ListBody, ListToolbar, StatusPill, VoucherView, todayInput, useBankingOptions, useVoucherList } from "./shared";
import { vouchers } from "../../lib/bankingApi";
import { PAYMENT_MODES, describePayment, emptyPayment, fromCents, money, modeLabel, paymentPayload, toCents, validatePayment } from "../../lib/voucherForms";
import { formatDateGB } from "../../utils/format";

// Receipts (money in from a customer) and payments (money out to a vendor) are the same screen
// with the direction turned round.
const CONFIG = {
  receipt: {
    voucherType: "receipt", title: "Receipt vouchers", one: "receipt", noun: "Customer", amountLabel: "Amount received (AED)",
    description: "Money received from customers, set against their invoices or kept on account.",
    partyPath: "/customers/customers", nameKey: "customerName", idKey: "customerId", partyField: "customerId", docType: "sales_order",
  },
  payment: {
    voucherType: "payment", title: "Payment vouchers", one: "payment", noun: "Vendor", amountLabel: "Amount paid (AED)",
    description: "Money paid to vendors, set against their invoices or kept as an advance.",
    partyPath: "/vendors/vendors", nameKey: "vendorName", idKey: "vendorId", partyField: "vendorId", docType: "purchase_order",
  },
};

export const ReceiptVouchers = () => <PartyVouchers direction="receipt" />;
export const PaymentVouchers = () => <PartyVouchers direction="payment" />;

function PartyVouchers({ direction }) {
  const cfg = CONFIG[direction];
  const list = useVoucherList(cfg.voucherType);
  const { notify, toastNode } = useToasts();
  const [form, setForm] = useState(false);
  const [viewing, setViewing] = useState(null);

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader title={cfg.title} description={cfg.description} actions={<Button onClick={() => setForm(true)}><Plus className="h-4 w-4" aria-hidden="true" />New {cfg.one}</Button>} />
      <ListToolbar filters={list.filters} set={list.set}>
        <Field label="Paid by" className="w-36">
          <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={list.filters.paymentMode} onChange={(e) => list.set({ paymentMode: e.target.value })}>
            <option value="">Any</option>
            {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
      </ListToolbar>
      <Panel bodyClassName="p-0">
        <ListBody list={list} emptyTitle={`No ${cfg.title.toLowerCase()}`} emptyText={`Record the first one with New ${cfg.one}.`}>
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-2 text-start">Voucher</th><th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-start">{cfg.noun}</th><th className="px-3 py-2 text-start">Paid by</th><th className="px-3 py-2 text-end">Invoices</th><th className="px-3 py-2 text-end">Amount</th><th className="px-3 py-2 text-start">Status</th><th className="px-5 py-2"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {list.rows.map((v) => (
                <tr key={v._id} className="border-t border-border hover:bg-accent/40">
                  <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs font-semibold">{v.voucherNo}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateGB(v.date)}</td>
                  <td className="px-3 py-2.5 font-medium">{v.partyName}</td>
                  <td className="max-w-xs px-3 py-2.5"><span className="font-medium">{modeLabel(v.paymentMode)}</span><span className="block truncate text-xs text-muted-foreground">{describePayment(v)}</span></td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{v.linkedInvoices?.length || 0}{v.onAccountAmount > 0 && <span className="block text-xs text-muted-foreground">{money(toCents(v.onAccountAmount))} on account</span>}</td>
                  <td className="px-3 py-2.5 text-end font-medium tabular-nums">{money(toCents(v.totalAmount))}</td>
                  <td className="px-3 py-2.5"><StatusPill status={v.status} /></td>
                  <td className="px-5 py-2.5 text-end"><button type="button" aria-label={`View ${v.voucherNo}`} onClick={() => setViewing(v._id)} className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListBody>
      </Panel>
      {form && <PartyVoucherForm cfg={cfg} direction={direction} onClose={() => setForm(false)} onSaved={(msg) => { setForm(false); notify(msg); list.reload(); }} />}
      {viewing && <VoucherView id={viewing} title={cfg.one[0].toUpperCase() + cfg.one.slice(1) + " voucher"} onClose={() => setViewing(null)} onDeleted={() => { setViewing(null); notify(`${cfg.one[0].toUpperCase() + cfg.one.slice(1)} deleted and reversed`); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

// Oldest invoice first: the amount fills each invoice's open balance in turn; the rest stays on account.
export function allocateOldestFirst(invoices, amountCents) {
  let left = amountCents;
  const out = {};
  for (const inv of invoices) {
    const open = toCents(inv.outstandingAmount);
    const take = Math.min(left, open);
    if (take > 0) out[inv._id] = String(fromCents(take));
    left -= take;
    if (left <= 0) break;
  }
  return out;
}

export function PartyVoucherForm({ cfg, direction, onClose, onSaved }) {
  const { data: opts, error: optsError } = useBankingOptions();
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(todayInput());
  const [amount, setAmount] = useState("");
  const [alloc, setAlloc] = useState({});
  const [narration, setNarration] = useState("");
  const [payment, setPayment] = useState(emptyPayment());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const parties = useAsync(() => axiosInstance.get(cfg.partyPath).then((r) => r.data?.data || []), [cfg.partyPath]);
  const invoices = useAsync(
    () => (partyId
      ? axiosInstance.get("/transactions/transactions", { params: { type: cfg.docType, partyId, status: "APPROVED", limit: 200 } })
          .then((r) => (r.data?.data || []).filter((d) => d.outstandingAmount > 0.005).sort((a, b) => new Date(a.date) - new Date(b.date)))
      : Promise.resolve([])),
    [partyId, cfg.docType]
  );
  const partyOptions = useMemo(() => (parties.data || []).map((p) => ({ value: p._id, label: p[cfg.nameKey], hint: p[cfg.idKey] })), [parties.data, cfg]);
  const party = (parties.data || []).find((p) => p._id === partyId);
  const open = invoices.data || [];

  const total = toCents(amount);
  const allocated = Object.values(alloc).reduce((t, v) => t + toCents(v), 0);
  const onAccount = total - allocated;

  const changeAmount = (raw) => {
    const v = raw.replace(/,/g, "");
    if (!/^\d*(\.\d{0,2})?$/.test(v)) return;
    setAmount(v);
    setAlloc(allocateOldestFirst(open, toCents(v))); // the oldest invoices are settled first
  };
  const changeParty = (id) => { setPartyId(id); setAlloc({}); setAmount(""); };
  const setAllocation = (inv, raw) => {
    const v = raw.replace(/,/g, "");
    if (!/^\d*(\.\d{0,2})?$/.test(v)) return;
    const next = { ...alloc, [inv._id]: v };
    if (!toCents(v)) delete next[inv._id];
    setAlloc(next);
    const sum = Object.values(next).reduce((t, x) => t + toCents(x), 0);
    if (sum > total) setAmount(String(fromCents(sum))); // paying more on invoices raises the amount
  };

  async function save() {
    const e = {};
    if (!partyId) e.partyId = `Choose the ${cfg.noun.toLowerCase()}`;
    if (!(total > 0)) e.amount = "Enter the amount";
    for (const inv of open) if (toCents(alloc[inv._id]) > toCents(inv.outstandingAmount)) e[inv._id] = `More than the ${money(toCents(inv.outstandingAmount))} open`;
    if (onAccount < 0) e.amount = "The invoices add up to more than the amount";
    Object.assign(e, validatePayment(payment, { direction, options: opts, voucherDate: date }));
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await vouchers.create({
        voucherType: cfg.voucherType, [cfg.partyField]: partyId, date, totalAmount: total / 100, narration: narration.trim() || undefined,
        linkedInvoices: open.filter((i) => toCents(alloc[i._id]) > 0).map((i) => ({
          invoiceId: i._id, amount: toCents(alloc[i._id]) / 100, balance: (toCents(i.outstandingAmount) - toCents(alloc[i._id])) / 100,
        })),
        ...paymentPayload(payment),
      });
      onSaved(`${cfg.one[0].toUpperCase() + cfg.one.slice(1)} ${saved.voucherNo} posted`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="xl" onClose={onClose} title={`New ${cfg.one} voucher`} description="Ctrl+Enter posts."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Posting…" : `Post ${cfg.one}`}</Button></>}
    >
      <div onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }} className="space-y-5">
        <ErrorNote error={optsError || parties.error || problem} />
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_12rem]">
          <Field label={cfg.noun} required error={errors.partyId}>
            <SearchSelect value={partyId} onChange={changeParty} options={partyOptions} loading={parties.loading} autoFocus placeholder={`Search ${cfg.noun.toLowerCase()}s…`} invalid={Boolean(errors.partyId)} noOptionsText={`No ${cfg.noun.toLowerCase()} matches`} />
          </Field>
          <Field label={cfg.amountLabel} required error={errors.amount}>
            <TextInput inputMode="decimal" className="text-end tabular-nums" value={amount} onChange={(e) => changeAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Date" required><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>

        {partyId && (
          <section aria-label="Open invoices">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">Open invoices of {party?.[cfg.nameKey]}</h3>
              {open.length > 0 && total > 0 && <Button type="button" variant="outline" size="sm" onClick={() => setAlloc(allocateOldestFirst(open, total))}><Wand2 className="h-3.5 w-3.5" aria-hidden="true" />Oldest first</Button>}
            </div>
            {invoices.loading && <Spinner label="Loading invoices" />}
            {!invoices.loading && open.length === 0 && <p className="rounded-xl border border-dashed border-input px-4 py-3 text-sm text-muted-foreground">Nothing is open for {party?.[cfg.nameKey]}. The amount is kept on account.</p>}
            {open.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-4 py-2 text-start">Invoice</th><th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-end">Total</th><th className="px-3 py-2 text-end">Open</th><th className="px-4 py-2 text-end">This voucher</th></tr>
                  </thead>
                  <tbody>
                    {open.map((inv) => (
                      <tr key={inv._id} className="border-t border-border">
                        <td className="px-4 py-1.5 font-mono text-xs font-semibold">{inv.transactionNo}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">{formatDateGB(inv.date)}</td>
                        <td className="px-3 py-1.5 text-end tabular-nums text-muted-foreground">{money(toCents(inv.totalAmount))}</td>
                        <td className="px-3 py-1.5 text-end tabular-nums">{money(toCents(inv.outstandingAmount))}</td>
                        <td className="w-40 px-3 py-1">
                          <TextInput aria-label={`Amount against ${inv.transactionNo}`} inputMode="decimal" className="h-9 text-end tabular-nums" placeholder="0.00" value={alloc[inv._id] || ""} onChange={(e) => setAllocation(inv, e.target.value)} aria-invalid={errors[inv._id] ? true : undefined} />
                          {errors[inv._id] && <p className="mt-0.5 text-xs text-status-danger">{errors[inv._id]}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-secondary/40 text-sm">
                    <tr><td colSpan={4} className="px-4 py-2 text-end">Against invoices</td><td className="px-4 py-2 text-end tabular-nums">{money(allocated)}</td></tr>
                    <tr className="font-semibold"><td colSpan={4} className="px-4 py-2 text-end">{direction === "receipt" ? "Kept on account (advance from customer)" : "Kept on account (advance to vendor)"}</td><td className={onAccount < 0 ? "px-4 py-2 text-end text-status-danger tabular-nums" : "px-4 py-2 text-end tabular-nums"}>{money(Math.max(onAccount, 0))}</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}

        {opts && <PaymentModeFields value={payment} onChange={setPayment} direction={direction} options={opts} errors={errors} voucherDate={date} amount={total / 100} />}
        <Field label="Narration"><Textarea rows={2} value={narration} onChange={(e) => setNarration(e.target.value)} maxLength={200} placeholder="Optional note on this voucher" /></Field>
      </div>
    </Modal>
  );
}
