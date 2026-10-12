import React from "react";
import { Link } from "react-router-dom";
import { Check, Wallet } from "lucide-react";
import { Panel } from "../accounting/kit";
import PaymentBadge from "../lists/PaymentBadge";
import { formatDate, formatNumber } from "../../utils/format";

// The invoices made from this order, where each one stands, and the next press for each: Approve a draft, or take / make the
// payment for an approved one. They used to be found only by hunting on the invoices page.
export default function OrderInvoices({ invoices, sales, canApprove, approving, onApprove, onPay }) {
  if (!invoices?.length) return null;
  const page = sales ? "/sales-order" : "/purchase-order";
  return (
    <Panel title="Invoices made from this order" description="Approving an invoice is what updates stock and the books." bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {invoices.map((inv) => {
          const draft = String(inv.status).toUpperCase() === "DRAFT";
          const approved = String(inv.status).toUpperCase() === "APPROVED";
          const open = Number(inv.outstandingAmount) || 0;
          return (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <Link to={`${page}?search=${encodeURIComponent(inv.no)}`} className="font-mono text-xs font-semibold underline underline-offset-2">{inv.no}</Link>
                <span className="ms-2 text-muted-foreground">{formatDate(inv.date)} · {formatNumber(inv.totalAmount, 2)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {draft && <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">Draft: not in the books yet</span>}
                {approved && <PaymentBadge doc={{ status: "APPROVED", totalAmount: inv.totalAmount, paidAmount: inv.paidAmount, outstandingAmount: inv.outstandingAmount, creditedAmount: inv.creditedAmount }} />}
                {draft && canApprove && (
                  <button
                    type="button" disabled={approving === inv.id} onClick={() => onApprove(inv)}
                    className="erp-btn-primary"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {approving === inv.id ? "Approving…" : "Approve"}
                  </button>
                )}
                {approved && open > 0.005 && (
                  <button type="button" onClick={() => onPay(inv)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-accent">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    {sales ? "Receive payment" : "Make payment"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
