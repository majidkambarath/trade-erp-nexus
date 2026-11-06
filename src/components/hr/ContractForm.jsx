// A new contract row (HRMS > an employee's own page, Contract tab). Always a NEW row - trade ERP node's
// utils/hr.js rule 2: a raise is a new row with its own effectiveFrom, and the row it supersedes is closed
// automatically by the server, never edited into the new figures. This form only ever creates.
import React, { useState } from "react";
import { Button } from "../ui/button";
import { contracts } from "../../lib/hrApi";
import { validateContractForm } from "../../lib/hr";
import { AmountInput, DateInput, ErrorNote, Field, Modal, TextInput } from "../accounting/kit";

export default function ContractForm({ staffId, onClose, onSaved }) {
  const [form, setForm] = useState({ effectiveFrom: "", costPerHour: "", basicPay: "", allowances: "", otherMonthlyCost: "", hoursPerMonth: "", notes: "" });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    const found = validateContractForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = { ...form, effectiveTo: form.effectiveTo || null };
      for (const f of ["costPerHour", "basicPay", "allowances", "otherMonthlyCost", "hoursPerMonth"]) {
        body[f] = body[f] === "" ? null : Number(body[f]);
      }
      const saved = await contracts.create(staffId, body);
      onSaved(saved, "Contract saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="New contract"
      description="Either a cost per hour outright, or basic pay (and whatever else the organisation carries) spread over the hours a month the role is for. Whichever is given, the new rate applies from this day on - it never changes what was already costed before it."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button data-shortcut="save" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Starts from" required error={errors.effectiveFrom}>
          <DateInput value={form.effectiveFrom} onChange={setField("effectiveFrom")} />
        </Field>
        <Field label="Cost per hour" error={errors.costPerHour} hint="Leave empty to work it out from the monthly package below">
          <AmountInput value={form.costPerHour} onChange={setField("costPerHour")} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Basic pay" error={errors.basicPay} hint="Per month">
            <AmountInput value={form.basicPay} onChange={setField("basicPay")} />
          </Field>
          <Field label="Allowances" error={errors.allowances} hint="Per month">
            <AmountInput value={form.allowances} onChange={setField("allowances")} />
          </Field>
          <Field label="Other monthly cost" error={errors.otherMonthlyCost} hint="Insurance, visa, etc.">
            <AmountInput value={form.otherMonthlyCost} onChange={setField("otherMonthlyCost")} />
          </Field>
        </div>
        <Field label="Hours a month" hint="Default 208 (8 hours × 26 days) if left empty">
          <AmountInput value={form.hoursPerMonth} onChange={setField("hoursPerMonth")} />
        </Field>
        <Field label="Notes" hint="Optional">
          <TextInput value={form.notes} onChange={setField("notes")} />
        </Field>
      </div>
    </Modal>
  );
}
