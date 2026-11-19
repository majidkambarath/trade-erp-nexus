import React, { useEffect, useMemo, useState } from "react";
import { accounting } from "../../lib/accountingApi";
import { Field, Select } from "./kit";

// The organisation's cost centres for a form. `uses` is false until at least one active centre exists, so a form draws no
// Cost centre field for an organisation that does not use them. `choices(keep)` lists the active centres plus any the
// document already carries (`keep`), which stay offered after being switched off.
export function useCostCentres() {
  const [centres, setCentres] = useState([]);
  useEffect(() => {
    let live = true;
    // a test double of the api may not know this call: no centres, and the form is as it always was
    Promise.resolve()
      .then(() => accounting.costCentres())
      .then((rows) => live && setCentres(Array.isArray(rows) ? rows : []))
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return useMemo(() => {
    const uses = centres.some((c) => c.isActive !== false);
    const choices = (keep = []) => {
      const held = new Set(keep.filter(Boolean).map(String));
      return centres
        .filter((c) => c.isActive !== false || held.has(String(c._id)))
        .map((c) => ({ value: String(c._id), label: `${c.code} · ${c.name}${c.isActive === false ? " (switched off)" : ""}` }));
    };
    return { centres, uses, choices };
  }, [centres]);
}

/** A cost centre picker: "None" (or `emptyLabel`) and the choices. */
export function CostCentrePicker({ value, onChange, choices, emptyLabel = "None", ...rest }) {
  return (
    <Select value={value || ""} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">{emptyLabel}</option>
      {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
    </Select>
  );
}

/** The labelled header field a voucher form shows once the organisation uses cost centres. */
export function CostCentreField({ cc, value, onChange, hint = "Every line of this voucher is reported under it." }) {
  if (!cc.uses) return null;
  return (
    <Field label="Cost centre" hint={hint}>
      <CostCentrePicker value={value} onChange={onChange} choices={cc.choices([value])} aria-label="Cost centre" />
    </Field>
  );
}
