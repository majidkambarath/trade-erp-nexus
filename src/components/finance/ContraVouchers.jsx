import React, { useMemo, useState } from "react";
import { ArrowRight, Eye, Pencil, Plus } from "lucide-react";
import { Button } from "../ui/button";
import Can from "../shell/Can";
import { DataTable, DateInput, ErrorNote, Field, Modal, PageHeader, Panel, Pill, SearchSelect, Spinner, TextInput, useToasts } from "../accounting/kit";
import { ListBody, ListToolbar, StatusPill, VoucherView, todayInput, useBankingOptions, useVoucherList } from "./shared";
import { vouchers } from "../../lib/bankingApi";
import { money, savedVerb, toCents } from "../../lib/voucherForms";
import { CURRENCY, formatDateGB, formatNumber } from "../../utils/format";

// Contra vouchers: cash and bank moving between themselves - a deposit, a withdrawal, a transfer
// between two banks.

export default function ContraVouchers() {
  const list = useVoucherList("contra");
  const { notify, toastNode } = useToasts();
  const [form, setForm] = useState(null);
  const [viewing, setViewing] = useState(null);
  const leg = (v, side) => v.entries?.find((e) => e[side] > 0)?.accountName || "";

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Contra vouchers"
        description="Cash deposited to the bank, cash drawn from it, or money moved between two bank accounts."
        actions={<Can permission="finance.create"><Button onClick={() => setForm({})}><Plus className="h-4 w-4" aria-hidden="true" />New contra</Button></Can>}
      />
      <ListToolbar filters={list.filters} set={list.set} />
      <Panel bodyClassName="p-0">
        <ListBody list={list} emptyTitle="No contra vouchers" emptyText="Record a deposit or a transfer with New contra.">
          <DataTable
            caption="Contra vouchers"
            rows={list.rows}
            rowKey={(v) => v._id}
            onRowClick={(v) => setViewing(v._id)}
            columns={[
              { key: "no", header: "Voucher", card: "primary", className: "whitespace-nowrap font-mono text-xs font-semibold", cell: (v) => <>{v.voucherNo}{!v.ledgerBased && <Pill className="ms-2">Older format</Pill>}</> },
              { key: "date", header: "Date", card: "meta", className: "whitespace-nowrap", cell: (v) => formatDateGB(v.date) },
              { key: "transfer", header: "Transfer", card: "title", cell: (v) => leg(v, "creditAmount") ? <span className="inline-flex flex-wrap items-center gap-1.5">{leg(v, "creditAmount")}<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="to" />{leg(v, "debitAmount")}</span> : <span className="text-muted-foreground">{v.narration}</span> },
              { key: "amount", header: "Amount", align: "end", card: "amount", className: "font-medium tabular-nums", cell: (v) => money(toCents(v.totalAmount)) },
              { key: "status", header: "Status", card: "badge", cell: (v) => <StatusPill status={v.status} doc={v} /> },
              { key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", className: "whitespace-nowrap", cell: (v) => (<><button type="button" aria-label={`View ${v.voucherNo}`} onClick={() => setViewing(v._id)} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" aria-hidden="true" /></button>{v.ledgerBased && ["approved", "pending"].includes(v.status) && <Can permission="finance.edit"><button type="button" aria-label={`Edit ${v.voucherNo}`} onClick={() => setForm(v)} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden="true" /></button></Can>}</>) },
            ]}
          />
        </ListBody>
      </Panel>
      {form && <ContraForm voucher={form._id ? form : null} onClose={() => setForm(null)} onSaved={(msg) => { setForm(null); notify(msg); list.reload(); }} />}
      {viewing && <VoucherView id={viewing} onChanged={list.reload}title="Contra voucher" onClose={() => setViewing(null)} onDeleted={() => { setViewing(null); notify("Contra deleted and reversed"); list.reload(); }} />}
      {toastNode}
    </div>
  );
}

export function ContraForm({ voucher, onClose, onSaved }) {
  const { data: opts, loading, error } = useBankingOptions();
  const [f, setF] = useState({
    date: voucher ? new Date(voucher.date).toISOString().slice(0, 10) : todayInput(),
    fromAccountId: voucher?.fromAccountId || "", toAccountId: voucher?.toAccountId || "",
    amount: voucher ? String(voucher.totalAmount) : "", narration: voucher?.narration || "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const all = useMemo(() => [...(opts?.cashAccounts || []), ...(opts?.bankAccounts || [])], [opts]);
  const options = useMemo(
    () => all.map((a) => ({ value: a._id, label: a.accountName, hint: `${formatNumber(a.balance || 0, 2)} ${CURRENCY}`, searchText: `${a.accountCode} ${a.bank?.bankName || ""}` })),
    [all]
  );
  const set = (p) => setF((s) => ({ ...s, ...p }));
  const from = all.find((a) => a._id === f.fromAccountId);
  const isCash = (opts?.cashAccounts || []).some((a) => a._id === f.fromAccountId);

  async function save() {
    const e = {};
    if (!f.fromAccountId) e.fromAccountId = "Choose where the money comes from";
    if (!f.toAccountId) e.toAccountId = "Choose where it goes";
    if (f.fromAccountId && f.fromAccountId === f.toAccountId) e.toAccountId = "The two accounts must be different";
    if (!(toCents(f.amount) > 0)) e.amount = "Enter the amount";
    else if (isCash && from && toCents(f.amount) > toCents(from.balance)) e.amount = `Only ${formatNumber(from.balance, 2)} ${CURRENCY} in ${from.accountName}`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = { voucherType: "contra", ledgerBased: true, date: f.date, fromAccountId: f.fromAccountId, toAccountId: f.toAccountId, totalAmount: toCents(f.amount) / 100, narration: f.narration.trim() || undefined };
      const saved = voucher ? await vouchers.update(voucher._id, body) : await vouchers.create(body);
      onSaved(`Contra ${saved.voucherNo} ${savedVerb(saved, { updated: Boolean(voucher) })}`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg" onClose={onClose} title={voucher ? `Edit ${voucher.voucherNo}` : "New contra voucher"} description="Money moving between cash and bank accounts. Ctrl+Enter posts."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Posting…" : voucher ? "Save changes" : "Post contra"}</Button></>}
    >
      <div onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }} className="grid gap-4 sm:grid-cols-2">
        {loading && <div className="sm:col-span-2"><Spinner label="Loading accounts" /></div>}
        <div className="sm:col-span-2"><ErrorNote error={error || problem} /></div>
        <Field label="From" required error={errors.fromAccountId} hint="Where the money leaves.">
          <SearchSelect value={f.fromAccountId} onChange={(v) => set({ fromAccountId: v })} options={options} autoFocus placeholder="Search cash or bank…" invalid={Boolean(errors.fromAccountId)} />
        </Field>
        <Field label="To" required error={errors.toAccountId} hint="Where it arrives.">
          <SearchSelect value={f.toAccountId} onChange={(v) => set({ toAccountId: v })} options={options.filter((o) => o.value !== f.fromAccountId)} placeholder="Search cash or bank…" invalid={Boolean(errors.toAccountId)} />
        </Field>
        <Field label={`Amount (${CURRENCY})`} required error={errors.amount}>
          <TextInput inputMode="decimal" className="text-end tabular-nums" value={f.amount} onChange={(e) => /^\d*(\.\d{0,2})?$/.test(e.target.value.replace(/,/g, "")) && set({ amount: e.target.value.replace(/,/g, "") })} placeholder="0.00" />
        </Field>
        <Field label="Date" required><DateInput value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Narration" className="sm:col-span-2"><TextInput value={f.narration} onChange={(e) => set({ narration: e.target.value })} maxLength={200} placeholder="e.g. Cash deposited at Emirates NBD" /></Field>
      </div>
    </Modal>
  );
}
