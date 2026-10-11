import React from "react";
import { paymentStatus } from "../../lib/paymentStatus";
import { statusClasses } from "../../lib/status";
import { formatNumber } from "../../utils/format";
import { cn } from "../../lib/utils";

// "Unpaid", "Partly paid" or "Paid" beside a posted invoice's status. It is derived from the document's
// amounts (lib/paymentStatus.js), so it stays right when a receipt or payment is entered, edited or
// deleted, and it is never saved into `status`. A draft, or a row without its amounts, shows nothing.
//
// Text is always the signal, never colour alone; the title says how much of the total has been settled.
export default function PaymentBadge({ doc, className }) {
  const p = paymentStatus(doc);
  if (!p) return null;
  const title =
    p.paid === null || p.total === null
      ? p.label
      : `${p.label}: ${formatNumber(p.paid, 2)} of ${formatNumber(p.total, 2)} settled${p.outstanding > 0.005 ? `, ${formatNumber(p.outstanding, 2)} outstanding` : ""}`;
  return (
    <span
      title={title}
      data-payment-status={p.key}
      className={cn("inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium", statusClasses(p.key), className)}
    >
      {p.label}
    </span>
  );
}
