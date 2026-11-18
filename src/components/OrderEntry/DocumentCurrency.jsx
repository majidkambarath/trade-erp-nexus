import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Field, SearchSelect, TextInput, useAsync } from "../accounting/kit";
import { currencies } from "../../lib/currencyApi";
import { currencyOptions, formatRate, hasForeignOptions, rateCheck, typedRate } from "../../lib/currencyForms";
import { CURRENCY, formatDate } from "../../utils/format";

// The currency a sales or purchase invoice is made in. Everything on the form is typed and shown in this currency; the server converts the
// document to the organisation's base currency at the rate below when it is saved (utils/fxDocument.js), so the books are unchanged.
// Nothing is drawn until a foreign currency has been switched on and has a rate (Accounting setup -> Currencies).
//   `locked`: a return follows the invoice it returns - it is shown, not chosen.
export default function DocumentCurrency({ formData, setHeader, locked = false, id }) {
  const list = useAsync(() => currencies.list().catch(() => []), []);
  const options = useMemo(() => currencyOptions(list.data), [list.data]);
  const base = (list.data || []).find((c) => c?.isBase)?.code || CURRENCY;
  const code = formData.currency || "";
  const date = formData.date || "";
  const master = useAsync(() => (code && date ? currencies.rate(code, date).catch(() => null) : Promise.resolve(null)), [code, date]);
  const m = code && master.data && master.data.code === code ? master.data : null;
  const rate = formData.exchangeRate ?? (m ? String(m.rate) : "");
  const check = rateCheck({ rate, masterRate: m?.rate, tolerancePercent: m?.tolerancePercent ?? 5, reason: formData.rateOverrideReason });

  if (locked) {
    if (!code) return null;
    return (
      <Field id={id} label="Currency" hint={`Made in ${code} at ${formatRate(formData.exchangeRate)}, like the invoice it returns`}>
        <TextInput readOnly value={`${code} (${formatRate(formData.exchangeRate)} ${base} per 1 ${code})`} className="bg-secondary text-muted-foreground" />
      </Field>
    );
  }
  if (!hasForeignOptions(list.data) && !code) return null;

  const change = (next) => {
    const c = next === base ? "" : next;
    setHeader("currency", c);
    setHeader("exchangeRate", undefined); // follow the rate on file for the new currency and day
    setHeader("rateOverrideReason", "");
  };

  return (
    <>
      <Field id={id} label="Currency">
        <SearchSelect value={code || base} onChange={change} options={options} placeholder="Currency" noOptionsText="No currency matches" />
      </Field>
      {code && (
        <Field
          id={`${id}-rate`} label={`Exchange rate (${base} per 1 ${code})`}
          hint={m ? `Rate on file for ${formatDate(date)}: ${formatRate(m.rate)}` : master.loading ? "Looking up the rate…" : "No rate on file for this day - add one under Currencies"}
        >
          <TextInput
            inputMode="decimal" className="text-end tabular-nums" value={rate}
            onChange={(e) => { const v = typedRate(e.target.value); if (v !== null) setHeader("exchangeRate", v); }}
          />
        </Field>
      )}
      {code && check.outside && (
        <div className="space-y-2 sm:col-span-2 xl:col-span-3">
          <p role="alert" className="flex items-start gap-2 text-sm text-status-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            This rate is {check.deviation}% away from the rate on file ({formatRate(m.rate)}); up to {m.tolerancePercent}% is allowed without a reason.
          </p>
          <Field id={`${id}-reason`} label="Reason for this rate">
            <TextInput value={formData.rateOverrideReason || ""} maxLength={250} onChange={(e) => setHeader("rateOverrideReason", e.target.value)} placeholder="For example: rate agreed with the customer" />
          </Field>
        </div>
      )}
    </>
  );
}
