import React, { useMemo, useState } from "react";
import axiosInstance from "../../axios/axios";
import { Eye, Pencil, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { ErrorNote, Field, Modal, PageHeader, Panel, Pill, SearchSelect, Spinner, TextInput, Textarea, useAsync, useToasts, DateInput } from "../accounting/kit";
import PaymentModeFields from "./PaymentModeFields";
import { ListBody, ListToolbar, StatusPill, VoucherView, todayInput, useBankingOptions, useChartAccounts, useVoucherList } from "./shared";
import { accounting } from "../../lib/accountingApi";
import { vouchers } from "../../lib/bankingApi";
import { describePayment, emptyPayment, money, paymentFromVoucher, paymentPayload, toCents, validatePayment } from "../../lib/voucherForms";
import { formatDateGB } from "../../utils/format";

// Expense vouchers: an expense account of the chart, the VAT on it, and how it was paid - cash,
// bank, transfer, cheque or card, like any other payment.

const EXPENSE_ONLY = { categories: ["EXPENSE"] };

export default function ExpenseVouchers() {
  const list = useVoucherList("expense");
  const { notify, toastNode } = useToasts();
  const [form, setForm] = useState(null);
  const [viewing, setViewing] = useState(null);

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader
        title="Expense vouchers"
        description="Record what the business spent: rent, utilities, fuel. Pick the expense account, add the VAT, and say how it was paid."
        actions={<Button onClick={() => setForm({})}><Plus className="h-4 w-4" aria-hidden="true" />New expense</Button>}
      />
      <ListToolbar filters={list.filters} set={list.set} />
      <Panel bodyClassName="p-0">
        <ListBody list={list} emptyTitle="No expense vouchers" emptyText="Record the first one with New expense.">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-2 text-start">Voucher</th><th className="px-3 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Expense</th><th className="px-3 py-2 text-start">Paid by</th><th className="px-3 py-2 text-end">VAT</th><th className="px-3 py-2 text-end">Total</th><th className="px-3 py-2 text-start">Status</th><th className="px-5 py-2"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {list.rows.map((v) => (
                <tr key={v._id} className="border-t border-border hover:bg-accent/40">
                  <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs font-semibold">{v.voucherNo}{!v.ledgerBased && <Pill className="ms-2">Older format</Pill>}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDateGB(v.date)}</td>
                  <td className="px-3 py-2.5"><span className="font-medium">{v.expenseAccountName || v.expenseTypeName || v.transactorName}</span>{v.description && <span className="block max-w-xs truncate text-xs text-muted-foreground">{v.description}</span>}</td>
                  <td className="max-w-xs truncate px-3 py-2.5 text-muted-foreground">{describePayment(v)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-muted-foreground">{v.vatTotal ? money(toCents(v.vatTotal)) : ""}</td>
                  <td className="px-3 py-2.5 text-end font-medium tabular-nums">{money(toCents(v.totalAmount))}</td>
                  <td className="px-3 py-2.5"><StatusPill status={v.status} /></td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-end">
                    <button type="button" aria-label={`View ${v.voucherNo}`} onClick={() => setViewing(v._id)} className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" aria-hidden="true" /></button>
                    {v.ledgerBased && v.status === "approved" && v.paymentMode !== "cheque" && <button type="button" aria-label={`Edit ${v.voucherNo}`} onClick={() => setForm(v)} className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden="true" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListBody>
      </Panel>
      {form && <ExpenseForm voucher={form._id ? form : null} onClose={() => setForm(null)} onSaved={(msg) => { setForm(null); notify(msg); list.reload(); }} />}
      {viewing && <VoucherView id={viewing} title="Expense voucher" onClose={() => setViewing(null)} onDeleted={() => { setViewing(null); notify("Expense deleted and reversed"); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

export function ExpenseForm({ voucher, onClose, onSaved }) {
  const { options: expenseOptions, loading: loadingAccounts, error: accountsError } = useChartAccounts(EXPENSE_ONLY);
  const { data: opts, error: optsError } = useBankingOptions();
  const taxes = useAsync(() => accounting.taxCodes(), []);
  const vendors = useAsync(() => axiosInstance.get("/vendors/vendors").then((r) => r.data?.data || []), []);
  const [f, setF] = useState({
    date: voucher ? new Date(voucher.date).toISOString().slice(0, 10) : todayInput(),
    expenseAccountId: voucher?.expenseAccountId || "", description: voucher?.description || "",
    amount: voucher ? String(voucher.subtotal ?? voucher.totalAmount) : "", taxCodeId: voucher?.taxCodeId || "",
    vendorId: voucher?.partyType === "Vendor" ? voucher.partyId : "",
  });
  const [payment, setPayment] = useState(() => (voucher ? paymentFromVoucher(voucher) : emptyPayment()));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (p) => setF((s) => ({ ...s, ...p }));

  const taxList = (taxes.data || []).filter((t) => t.isActive !== false);
  const taxOptions = taxList.map((t) => ({ value: t._id, label: t.name, hint: `${t.ratePercent}%` }));
  const rate = Number(taxList.find((t) => t._id === f.taxCodeId)?.ratePercent) || 0;
  const net = toCents(f.amount);
  const vat = Math.round((net * rate) / 100);
  const total = net + vat;
  const vendorOptions = useMemo(() => (vendors.data || []).map((v) => ({ value: v._id, label: v.vendorName, hint: v.vendorId })), [vendors.data]);

  async function save() {
    const e = {};
    if (!f.expenseAccountId) e.expenseAccountId = "Choose the expense account";
    if (!f.description.trim()) e.description = "Describe the expense";
    if (!(net > 0)) e.amount = "Enter the amount";
    Object.assign(e, validatePayment(payment, { direction: "payment", options: opts, voucherDate: f.date }));
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = {
        voucherType: "expense", ledgerBased: true, date: f.date, expenseAccountId: f.expenseAccountId, description: f.description.trim(),
        amount: net / 100, taxCodeId: f.taxCodeId || undefined, vendorId: f.vendorId || undefined, ...paymentPayload(payment),
      };
      const saved = voucher ? await vouchers.update(voucher._id, body) : await vouchers.create(body);
      onSaved(`Expense ${saved.voucherNo} ${voucher ? "updated" : "posted"}`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg" onClose={onClose} title={voucher ? `Edit ${voucher.voucherNo}` : "New expense voucher"} description="Ctrl+Enter posts."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Posting…" : voucher ? "Save changes" : "Post expense"}</Button></>}
    >
      <div onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) ) { e.preventDefault(); save(); } }} className="space-y-5">
        {(loadingAccounts || taxes.loading) && <Spinner label="Loading" />}
        <ErrorNote error={accountsError || optsError || problem} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expense account" required error={errors.expenseAccountId} className="sm:col-span-2">
            <SearchSelect value={f.expenseAccountId} onChange={(v) => set({ expenseAccountId: v })} options={expenseOptions} autoFocus placeholder="Search expense accounts…" invalid={Boolean(errors.expenseAccountId)} noOptionsText="No expense account matches" />
          </Field>
          <Field label="Description" required error={errors.description} className="sm:col-span-2">
            <Textarea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={200} placeholder="e.g. Office rent - October" />
          </Field>
          <Field label="Amount before VAT (AED)" required error={errors.amount}>
            <TextInput inputMode="decimal" className="text-end tabular-nums" value={f.amount} onChange={(e) => /^\d*(\.\d{0,2})?$/.test(e.target.value.replace(/,/g, "")) && set({ amount: e.target.value.replace(/,/g, "") })} placeholder="0.00" />
          </Field>
          <Field label="Tax code" hint={rate ? `${rate}% = ${money(vat)} AED, total ${money(total)} AED` : "Leave empty for no VAT."}>
            <SearchSelect value={f.taxCodeId} onChange={(v) => set({ taxCodeId: v })} options={taxOptions} clearable placeholder="No VAT" />
          </Field>
          <Field label="Date" required><DateInput value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Paid to" hint="Optional: a vendor, for the record.">
            <SearchSelect value={f.vendorId} onChange={(v) => set({ vendorId: v })} options={vendorOptions} clearable placeholder="Search vendors…" loading={vendors.loading} />
          </Field>
        </div>
        {opts && <PaymentModeFields value={payment} onChange={setPayment} direction="payment" options={opts} errors={errors} voucherDate={f.date} amount={total / 100} />}
      </div>
    </Modal>
  );
}
