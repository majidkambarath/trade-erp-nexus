import React from "react";
import { formatNumber, CURRENCY } from "../../utils/format";

// The "Status overview" card of the order screens, in two parts that never mix:
//
//   Document   where each document is in its life (draft, pending, approved, rejected): a share of every document in the period.
//   Payment    what has become of the approved invoices (unpaid, partly paid, paid, and how many are past due): a share of the
//              APPROVED invoices only, with the money still open. A draft owes nothing, so it is not in this part's base.
//
// They used to be one list of seven rows measured against the same total, so a screen with three approved invoices read
// "Approved 100%" and "Unpaid 100%" side by side as though they were alternatives. Payment is derived from the amounts
// (lib/paymentStatus.js), not a status the document carries.
//
//   document   { total, rows: [{ label, value, hint? }] }
//   payment    { base, rows: [{ label, value, amount?, tone? }], open }      `base` is how many approved invoices there are
//   noun       "order" | "purchase order", for the empty line
export default function StatusOverview({ document, payment, noun = "order" }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card" aria-label="Status overview">
      <header className="border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-semibold text-foreground">Status overview</h3>
      </header>
      <div className="space-y-6 px-5 py-4">
        <Group title="Document" subtitle={`${document.total} in this period`} rows={document.rows} base={document.total} />
        <Group
          title="Payment"
          subtitle={payment.base ? `${payment.base} approved ${payment.base === 1 ? "invoice" : "invoices"}` : "no approved invoices yet"}
          rows={payment.rows}
          base={payment.base}
          footer={payment.base > 0 ? `${CURRENCY} ${formatNumber(Number(payment.open) || 0, 2)} still open` : null}
        />
        {document.total === 0 && <p className="text-xs text-muted-foreground">Nothing to show until the first {noun} is created.</p>}
      </div>
    </section>
  );
}

const TONE_BAR = { default: "bg-brand", success: "bg-status-success", warning: "bg-status-warning", danger: "bg-status-danger" };

function Group({ title, subtitle, rows, base, footer }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="space-y-3.5">
        {rows.map((row) => {
          const value = Number(row.value) || 0;
          const share = base ? Math.min(100, (value / base) * 100) : 0;
          return (
            <div key={row.label} data-overview-row={row.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm text-foreground">
                  {row.label}
                  {row.hint && <span className="ms-1.5 text-xs text-muted-foreground">{row.hint}</span>}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {value} · {share.toFixed(0)}%
                  {row.amount != null && value > 0 && <span className="ms-2">{CURRENCY} {formatNumber(Number(row.amount) || 0, 2)}</span>}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className={`h-full rounded-full transition-all duration-500 ease-out ${TONE_BAR[row.tone || "default"]}`} style={{ width: `${share}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {footer && <p className="mt-3 text-xs font-medium text-foreground">{footer}</p>}
    </div>
  );
}
