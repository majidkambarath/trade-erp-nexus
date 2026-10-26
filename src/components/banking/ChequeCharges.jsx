import React, { useMemo } from "react";
import { AmountInput, Field, SearchSelect, TextInput, useAsync } from "../accounting/kit";
import { accounting } from "../../lib/accountingApi";
import { isReverseCharge } from "../../lib/reverseCharge";
import { accountOption } from "../../lib/voucherForms";

// The two optional charges on a bounce. They are separate components, mounted only when ticked, because each reads a list
// (tax codes, the chart) that an ordinary bounce has no use for - so an ordinary bounce makes no extra request.

export function FeeFields({ form, errs, set }) {
  const taxes = useAsync(() => accounting.taxCodes(), []);
  // an expense voucher takes VAT as the bank charged it: a reverse-charge code would book VAT nobody was paid
  const options = useMemo(
    () => (taxes.data || []).filter((t) => t.isActive !== false && !isReverseCharge(t)).map((t) => ({ value: t._id, label: t.name, hint: `${t.ratePercent}%` })),
    [taxes.data]
  );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Bank charge" required error={errs.feeAmount} hint="The full amount the bank took, VAT included.">
        <AmountInput value={form.feeAmount} onChange={(e) => set({ feeAmount: e.target.value })} min={0} />
      </Field>
      <Field label="VAT on the charge" hint="Optional. Splits the amount into the charge and its VAT.">
        <SearchSelect value={form.feeTaxCodeId} onChange={(v) => set({ feeTaxCodeId: v })} options={options} loading={taxes.loading} clearable placeholder="No VAT" aria-label="VAT on the charge" />
      </Field>
    </div>
  );
}

export function ChargeBackFields({ form, errs, set }) {
  const chart = useAsync(() => accounting.postableAccounts(), []);
  const income = useMemo(() => (chart.data || []).filter((a) => a.category === "INCOME").map(accountOption), [chart.data]);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Charge the customer" required error={errs.backAmount}>
        <AmountInput value={form.backAmount} onChange={(e) => set({ backAmount: e.target.value })} min={0} />
      </Field>
      <Field label="Credit it to" required error={errs.backAccountId} hint="The income account the recovered charge goes to.">
        <SearchSelect value={form.backAccountId} onChange={(v) => set({ backAccountId: v })} options={income} loading={chart.loading} placeholder="Choose an account" aria-label="Credit the charge to" />
      </Field>
      <Field label="Description" className="sm:col-span-2" hint="Optional. Shown on the debit note.">
        <TextInput value={form.backNote} maxLength={150} onChange={(e) => set({ backNote: e.target.value })} />
      </Field>
    </div>
  );
}
