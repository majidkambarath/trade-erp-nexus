import React, { useMemo, useState } from "react";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { DataTable, EmptyState, ErrorNote, Field, Modal, PageHeader, Panel, Pill, SearchSelect, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import { useOrganisation } from "../shell/OrganisationContext";
import { banking } from "../../lib/bankingApi";
import { cn } from "../../lib/utils";
import { CURRENCY, formatNumber } from "../../utils/format";

// The cards the company transacts through.
//   Merchant terminal  customers pay us by card; the processor settles into a bank account less its fee
//   Credit card        the company's own card; paying a vendor with it creates a debt, up to the limit
//   Debit card         draws on one of the company's bank accounts
//   Prepaid card       money loaded on a card
// Only the last four digits are kept. The full number and the security code are never stored.

const KINDS = [
  ["terminal", "Merchant terminal", "Customers pay you by card"],
  ["credit", "Credit card", "Your own card, with a limit"],
  ["debit", "Debit card", "Draws on a bank account"],
  ["prepaid", "Prepaid card", "Money loaded on a card"],
];
const KIND_LABEL = Object.fromEntries(KINDS.map(([k, l]) => [k, l]));
const blank = () => ({
  kind: "terminal", label: "", cardTypeId: "", bankId: "", holderName: "", terminalId: "", last4: "",
  expiryMonth: "", expiryYear: "", creditLimit: "", feePercent: "", accountId: "", isActive: true,
});

export default function CardMaster() {
  const cards = useAsync(() => banking.cards(), []);
  const { notify, toastNode } = useToasts();
  const { canAny } = useOrganisation();
  const canManage = canAny("banking.manage"); // adding and editing cards: the server asks the same
  const [editing, setEditing] = useState(null);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Cards" description="Merchant terminals that take customer cards, and the company's own credit, debit and prepaid cards." actions={canManage && <Button onClick={() => setEditing(blank())}><Plus className="h-4 w-4" aria-hidden="true" />New card</Button>} />
      <Panel bodyClassName="p-0">
        {cards.loading && !cards.data && <Spinner label="Loading cards" />}
        {cards.error && <div className="p-5"><ErrorNote error={cards.error} onRetry={cards.reload} /></div>}
        {cards.data?.length === 0 && <EmptyState title="No cards yet" text={canManage ? "Add a merchant terminal to take card payments, or your company card to pay with." : "None have been set up yet."} />}
        {cards.data?.length > 0 && (
          <DataTable
            caption="Cards"
            rows={cards.data}
            rowKey={(c) => c._id}
            columns={[
              { key: "card", header: "Card", card: "primary", cell: (c) => <><span className="font-medium">{c.label}</span><span className="block text-xs font-normal text-muted-foreground">{[c.last4 && `•••• ${c.last4}`, c.holderName, c.terminalId && `terminal ${c.terminalId}`].filter(Boolean).join(" · ")}</span></> },
              { key: "kind", header: "Kind", card: "badge", cell: (c) => <Pill tone={c.kind === "terminal" ? "info" : "neutral"}>{KIND_LABEL[c.kind]}</Pill> },
              { key: "type", header: "Type", card: "title", cell: (c) => <>{c.cardTypeName}{c.bankName && <span className="ms-1 text-xs text-muted-foreground">{c.bankName}</span>}</> },
              { key: "account", header: "Account", card: "meta", cell: (c) => <><span>{c.accountName}</span><span className="ms-1 font-mono text-xs text-muted-foreground">{c.accountCode}</span></> },
              { key: "limit", header: "Limit / fee", align: "end", card: "amount", className: "tabular-nums", cell: (c) => c.kind === "credit" ? <>{formatNumber(c.owed || 0, 2)} <span className="font-normal text-muted-foreground">of {formatNumber(c.creditLimit, 2)}</span></> : c.kind === "terminal" ? `${c.effectiveFeePercent}% fee` : "" },
              { key: "status", header: "Status", card: "meta", cell: (c) => c.isActive ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill> },
              // no edit column at all for someone who may only look (DataTable drops a false entry)
              canManage && { key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", cell: (c) => <button type="button" aria-label={`Edit ${c.label}`} onClick={() => setEditing({ ...blank(), ...c, creditLimit: c.creditLimit ? String(c.creditLimit) : "", feePercent: c.feePercent ?? "", expiryMonth: c.expiryMonth ?? "", expiryYear: c.expiryYear ?? "", bankId: c.bankId || "" })} className="inline-grid h-10 w-10 place-items-center lg:h-8 lg:w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden="true" /></button> },
            ]}
          />
        )}
      </Panel>
      {editing && <CardForm card={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); notify(msg); cards.reload(); }} />}
      {toastNode}
    </div>
  );
}

export function CardForm({ card, onClose, onSaved }) {
  const editing = Boolean(card._id);
  const types = useAsync(() => banking.cardTypes({ active: "true" }), []);
  const banks = useAsync(() => banking.banks({ active: "true" }), []);
  const opts = useAsync(() => banking.options(), []);
  const [f, setF] = useState(card);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (p) => setF((s) => ({ ...s, ...p }));

  const typeOptions = useMemo(() => (types.data || []).map((t) => ({ value: t._id, label: t.name, hint: `${t.feePercent}% fee` })), [types.data]);
  const bankOptions = useMemo(() => (banks.data || []).map((b) => ({ value: b._id, label: b.bankName, hint: b.bankCode })), [banks.data]);
  const accountOptions = useMemo(() => (opts.data?.bankAccounts || []).map((a) => ({ value: a._id, label: a.accountName, hint: a.bank?.bankName || a.accountCode, searchText: a.accountCode })), [opts.data]);
  const needsAccount = f.kind === "terminal" || f.kind === "debit";
  const isCompanyCard = f.kind !== "terminal";

  async function save() {
    const e = {};
    if (!f.label.trim()) e.label = "Give the card a name";
    if (!f.cardTypeId) e.cardTypeId = "Choose the card type";
    if (needsAccount && !f.accountId) e.accountId = f.kind === "terminal" ? "Choose the bank account it settles into" : "Choose the bank account it draws on";
    if (isCompanyCard && !f.holderName.trim()) e.holderName = "Enter the card holder's name";
    if (f.last4 && !/^\d{4}$/.test(f.last4)) e.last4 = "Only the last four digits";
    if (f.kind === "credit" && !(Number(f.creditLimit) > 0)) e.creditLimit = "A credit card needs a limit";
    if ((f.expiryMonth && !f.expiryYear) || (!f.expiryMonth && f.expiryYear)) e.expiry = "Enter both the month and the year";
    if (f.expiryMonth && (Number(f.expiryMonth) < 1 || Number(f.expiryMonth) > 12)) e.expiry = "The month is 1 to 12";
    if (f.feePercent !== "" && f.feePercent != null && !(Number(f.feePercent) >= 0 && Number(f.feePercent) <= 100)) e.feePercent = "A percentage between 0 and 100";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = {
        kind: f.kind, label: f.label.trim(), cardTypeId: f.cardTypeId, bankId: f.bankId || null, holderName: f.holderName.trim(), terminalId: f.terminalId.trim(),
        last4: f.last4, expiryMonth: f.expiryMonth ? Number(f.expiryMonth) : null, expiryYear: f.expiryYear ? Number(f.expiryYear) : null,
        creditLimit: f.kind === "credit" ? Number(f.creditLimit) : 0, feePercent: f.kind === "terminal" && f.feePercent !== "" ? Number(f.feePercent) : null,
        isActive: f.isActive, ...(needsAccount ? { accountId: f.accountId } : {}),
      };
      const saved = editing ? await banking.updateCard(card._id, body) : await banking.createCard(body);
      onSaved(`${saved.label} ${editing ? "updated" : "added"}`);
    } catch (err) {
      setProblem(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg" onClose={onClose} title={editing ? `Edit ${card.label}` : "New card"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add card"}</Button></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4">
        <ErrorNote error={problem} />
        <fieldset disabled={editing} className="min-w-0">
          <legend className="mb-2 text-sm font-medium">Kind of card</legend>
          <div role="radiogroup" aria-label="Kind of card" className="grid gap-2 sm:grid-cols-4">
            {KINDS.map(([k, label, text]) => (
              <label key={k} className={cn("cursor-pointer rounded-xl border p-3 text-sm focus-within:ring-2 focus-within:ring-ring", f.kind === k ? "border-primary bg-brand-soft" : "border-input hover:bg-accent", editing && "cursor-not-allowed opacity-70")}>
                <input type="radio" name="card-kind" value={k} checked={f.kind === k} onChange={() => set({ kind: k, accountId: "" })} className="sr-only" />
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs text-muted-foreground">{text}</span>
              </label>
            ))}
          </div>
          {editing && <p className="mt-1 text-xs text-muted-foreground">A card's kind cannot change once it has been used. Add a new card instead.</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.label}><TextInput value={f.label} onChange={(e) => set({ label: e.target.value })} maxLength={100} data-autofocus placeholder={f.kind === "terminal" ? "e.g. Emirates NBD POS 1" : "e.g. Company Visa"} /></Field>
          <Field label="Card type" required error={errors.cardTypeId}><SearchSelect value={f.cardTypeId} onChange={(v) => set({ cardTypeId: v })} options={typeOptions} placeholder="Visa, Mastercard…" invalid={Boolean(errors.cardTypeId)} noOptionsText="Add card types first" loading={types.loading} /></Field>
          <Field label="Issuing / acquiring bank"><SearchSelect value={f.bankId} onChange={(v) => set({ bankId: v })} options={bankOptions} clearable placeholder="Optional" loading={banks.loading} /></Field>
          {needsAccount && (
            <Field label={f.kind === "terminal" ? "Settles into" : "Draws on"} required error={errors.accountId}>
              <SearchSelect value={f.accountId} onChange={(v) => set({ accountId: v })} options={accountOptions} placeholder="Search bank accounts…" invalid={Boolean(errors.accountId)} loading={opts.loading} disabled={editing} />
            </Field>
          )}
          {isCompanyCard && <Field label="Card holder" required error={errors.holderName}><TextInput value={f.holderName} onChange={(e) => set({ holderName: e.target.value })} maxLength={150} /></Field>}
          {f.kind === "terminal" && <Field label="Terminal / merchant ID"><TextInput value={f.terminalId} onChange={(e) => set({ terminalId: e.target.value })} maxLength={40} /></Field>}
          {f.kind === "terminal" && <Field label="Processing fee (%)" error={errors.feePercent} hint="Leave empty to use the card type's fee."><TextInput inputMode="decimal" className="text-end tabular-nums" value={f.feePercent} onChange={(e) => set({ feePercent: e.target.value })} /></Field>}
          {f.kind === "credit" && <Field label={`Credit limit (${CURRENCY})`} required error={errors.creditLimit}><TextInput inputMode="decimal" className="text-end tabular-nums" value={f.creditLimit} onChange={(e) => set({ creditLimit: e.target.value })} /></Field>}
          {isCompanyCard && (
            <>
              <Field label="Last four digits" error={errors.last4}><TextInput inputMode="numeric" value={f.last4} onChange={(e) => set({ last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} maxLength={4} placeholder="1234" /></Field>
              <Field label="Expires (month / year)" error={errors.expiry}>
                <div className="flex gap-2">
                  <TextInput aria-label="Expiry month" inputMode="numeric" placeholder="MM" maxLength={2} value={f.expiryMonth} onChange={(e) => set({ expiryMonth: e.target.value.replace(/\D/g, "") })} className="w-20" />
                  <TextInput aria-label="Expiry year" inputMode="numeric" placeholder="YYYY" maxLength={4} value={f.expiryYear} onChange={(e) => set({ expiryYear: e.target.value.replace(/\D/g, "") })} />
                </div>
              </Field>
            </>
          )}
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />The full card number and the security code are never stored. Only the last four digits are kept, to tell cards apart.{!editing && f.kind === "credit" && " A ledger account for this card is created for you."}{!editing && f.kind === "prepaid" && " A ledger account for this card is created for you."}</p>
        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
            Active
          </label>
        )}
        <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
      </form>
    </Modal>
  );
}
