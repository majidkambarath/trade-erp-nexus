import React, { useMemo } from "react";
import { Banknote, Building2, CreditCard, FileText, Landmark } from "lucide-react";
import { cn } from "../../lib/utils";
import { Field, SearchSelect, TextInput } from "../accounting/kit";
import { PAYMENT_MODES } from "../../lib/voucherForms";
import { formatNumber } from "../../utils/format";

const MODE_ICON = { cash: Banknote, bank: Landmark, transfer: Building2, cheque: FileText, card: CreditCard };

const accountOptions = (accounts) =>
  accounts.map((a) => ({
    value: a._id,
    label: a.accountName,
    hint: a.bank?.bankName ? `${a.bank.bankName}${a.bank.accountNumberMasked ? ` ${a.bank.accountNumberMasked}` : ""}` : a.accountCode,
    searchText: `${a.accountCode} ${a.bank?.bankName || ""} ${a.bank?.accountNumber || ""} ${a.bank?.iban || ""}`,
  }));

// How the money moved on a receipt or payment: cash, bank, transfer, cheque or card, with the
// fields that mode needs. `value` is the form state (see emptyPayment); `onChange` receives a
// patch. `options` is what the server offers (accounts, banks, cards). `amount` lets a card
// receipt show the processor's fee.
export default function PaymentModeFields({ value, onChange, direction, options, errors = {}, voucherDate, amount }) {
  const isReceipt = direction === "receipt";
  const set = (patch) => onChange({ ...value, ...patch });
  const bankAccounts = useMemo(() => accountOptions(options?.bankAccounts || []), [options]);
  const cashAccounts = useMemo(() => accountOptions(options?.cashAccounts || []), [options]);
  const banks = useMemo(() => (options?.banks || []).map((b) => ({ value: b._id, label: b.bankName, hint: b.bankCode })), [options]);
  const cards = useMemo(
    () => (options?.cards || []).filter((c) => (isReceipt ? c.forReceipt : c.forPayment)).map((c) => ({
      value: c._id, label: c.label,
      hint: [c.cardTypeName, c.last4 && `•••• ${c.last4}`].filter(Boolean).join(" "),
      searchText: `${c.cardTypeName} ${c.kind} ${c.last4 || ""}`,
    })),
    [options, isReceipt]
  );
  const card = (options?.cards || []).find((c) => c._id === value.cardId);
  const fee = isReceipt && card && Number(amount) > 0 ? Math.round(Number(amount) * (card.effectiveFeePercent || 0)) / 100 : 0;
  const isPDC = value.mode === "cheque" && value.chequeDate && voucherDate && value.chequeDate > voucherDate;
  const accountLabel = isReceipt ? "Deposit to" : "Pay from";
  const single = bankAccounts.length === 1;

  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-sm font-medium text-foreground">{isReceipt ? "Received by" : "Paid by"}</legend>
      <div role="radiogroup" aria-label={isReceipt ? "Received by" : "Paid by"} className="flex flex-wrap gap-2">
        {PAYMENT_MODES.map((m) => {
          const Icon = MODE_ICON[m.value];
          const on = value.mode === m.value;
          return (
            <label
              key={m.value}
              className={cn(
                "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring",
                on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-accent"
              )}
            >
              <input type="radio" name="payment-mode" value={m.value} checked={on} onChange={() => set({ mode: m.value })} className="sr-only" />
              <Icon className="h-4 w-4" aria-hidden="true" />
              {m.label}
            </label>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {value.mode === "cash" && cashAccounts.length > 1 && (
          <Field label="Cash account" className="sm:col-span-2">
            <SearchSelect value={value.accountId} onChange={(v) => set({ accountId: v })} options={cashAccounts} clearable placeholder={`Default: ${cashAccounts[0].label}`} />
          </Field>
        )}
        {value.mode === "cash" && cashAccounts.length <= 1 && (
          <p className="text-sm text-muted-foreground sm:col-span-2">{isReceipt ? "Goes into" : "Comes out of"} {cashAccounts[0]?.label || "the cash account"}.</p>
        )}

        {["bank", "transfer", "cheque"].includes(value.mode) && (
          <Field label={value.mode === "cheque" ? (isReceipt ? "Deposit cheque to" : "Cheque drawn on") : accountLabel} required={!single} error={errors.accountId} className="sm:col-span-2">
            <SearchSelect
              value={value.accountId || (single ? bankAccounts[0].value : "")} onChange={(v) => set({ accountId: v })}
              options={bankAccounts} placeholder="Search bank accounts…" noOptionsText="No bank account yet. Add one in the chart of accounts." invalid={Boolean(errors.accountId)}
            />
          </Field>
        )}

        {value.mode === "bank" && (
          <Field label="Slip or reference" hint="Optional.">
            <TextInput value={value.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={60} />
          </Field>
        )}

        {value.mode === "transfer" && (
          <>
            <Field label="Transfer reference" required error={errors.reference}>
              <TextInput value={value.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={60} placeholder="Bank's reference number" />
            </Field>
            <Field label="Transfer date">
              <TextInput type="date" value={value.referenceDate || voucherDate || ""} onChange={(e) => set({ referenceDate: e.target.value })} />
            </Field>
          </>
        )}

        {value.mode === "cheque" && (
          <>
            <Field label="Cheque number" required error={errors.chequeNo}>
              <TextInput value={value.chequeNo} onChange={(e) => set({ chequeNo: e.target.value })} maxLength={20} inputMode="numeric" />
            </Field>
            <Field label="Cheque date" required error={errors.chequeDate} hint={isPDC ? "Post-dated: it waits in cheques in hand until it clears." : undefined}>
              <TextInput type="date" value={value.chequeDate} onChange={(e) => set({ chequeDate: e.target.value })} />
            </Field>
            {isReceipt && (
              <>
                <Field label="Drawn on bank" required error={errors.drawnOnBankId}>
                  <SearchSelect
                    value={value.drawnOnBankId} onChange={(v) => set({ drawnOnBankId: v, drawnOnBankName: v ? "" : value.drawnOnBankName })} clearable
                    options={banks} placeholder="Search the bank master…" noOptionsText="Not in the bank master" invalid={Boolean(errors.drawnOnBankId)}
                  />
                </Field>
                {!value.drawnOnBankId && (
                  <Field label="or type the bank's name" hint="For a bank that is not in the master.">
                    <TextInput value={value.drawnOnBankName} onChange={(e) => set({ drawnOnBankName: e.target.value })} maxLength={100} />
                  </Field>
                )}
              </>
            )}
          </>
        )}

        {value.mode === "card" && (
          <>
            <Field label={isReceipt ? "Card terminal" : "Company card"} required error={errors.cardId} className="sm:col-span-2">
              <SearchSelect
                value={value.cardId} onChange={(v) => set({ cardId: v })} options={cards}
                placeholder="Search cards…" noOptionsText={isReceipt ? "No merchant terminal set up. Add one under Cards." : "No company card set up. Add one under Cards."} invalid={Boolean(errors.cardId)}
              />
            </Field>
            <Field label={isReceipt ? "Approval code" : "Slip or approval code"} required={isReceipt} error={errors.approvalCode} hint={isReceipt ? "From the card slip." : "Optional."}>
              <TextInput value={value.approvalCode} onChange={(e) => set({ approvalCode: e.target.value })} maxLength={20} />
            </Field>
            {card && (
              <p className="self-end pb-2 text-sm text-muted-foreground">
                {isReceipt
                  ? `Processor fee ${card.effectiveFeePercent}%${fee ? ` · ${formatNumber(fee, 2)} AED` : ""}${fee ? `, ${formatNumber(Number(amount) - fee, 2)} AED reaches the bank` : ""}`
                  : card.kind === "credit" ? `${formatNumber(card.owed || 0, 2)} of ${formatNumber(card.creditLimit, 2)} AED used` : ""}
              </p>
            )}
          </>
        )}
      </div>
    </fieldset>
  );
}
