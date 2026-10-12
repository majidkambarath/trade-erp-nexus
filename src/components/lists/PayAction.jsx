import React from "react";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import Can from "../shell/Can";
import { paymentStatus } from "../../lib/paymentStatus";
import { cn } from "../../lib/utils";

// "Receive payment" on an approved sales invoice that is still owed, "Make payment" on a purchase invoice: one press goes to the
// receipt / payment screen with the party, this invoice and what is outstanding already filled in. Shown only while something is
// still owed (lib/paymentStatus.js), and only to someone who may add a receipt or payment.
//
//   variant "icon"   a round icon button for a table row        variant "card"   a labelled button for a card
export function payHref({ sales, partyId, invoiceId, outstanding }) {
  const q = new URLSearchParams({ party: String(partyId) });
  if (invoiceId) q.set("invoice", String(invoiceId));
  if (Number(outstanding) > 0) q.set("amount", String(Number(outstanding)));
  return `/${sales ? "receipt-voucher" : "payment-voucher"}?${q.toString()}`;
}

// Inside the router the press is a client-side move (nothing reloads); a list rendered outside one (a test, an embedded view) falls
// back to a plain address change, so the button works wherever the row does.
function Routed(props) {
  const navigate = useNavigate();
  return <Button {...props} go={(href) => navigate(href)} />;
}
const Plain = (props) => <Button {...props} go={(href) => window.location.assign(href)} />;

export default function PayAction(props) {
  return useInRouterContext() ? <Routed {...props} /> : <Plain {...props} />;
}

function Button({ doc, sales, partyId, variant = "icon", className, go: move }) {
  const p = paymentStatus(doc);
  const id = doc?.id ?? doc?._id;
  if (!p || p.key === "PAID" || !(p.outstanding > 0.005) || !partyId || String(doc?.status).toUpperCase() !== "APPROVED") return null;
  const no = doc.displayTransactionNo || doc.transactionNo;
  const label = sales ? "Receive payment" : "Make payment";
  const go = (e) => {
    e?.stopPropagation?.();
    move(payHref({ sales, partyId, invoiceId: id, outstanding: p.outstanding }));
  };
  return (
    <Can permission="finance.create">
      {variant === "card" ? (
        <button
          type="button" onClick={go} aria-label={`${label} for ${no}`}
          className={cn("flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border", className)}
        >
          <Wallet className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">{label}</span>
        </button>
      ) : (
        <button
          type="button" onClick={go} aria-label={`${label} for ${no}`} title={label}
          className={cn("grid min-h-10 min-w-10 place-items-center p-1.5 text-foreground hover:bg-secondary rounded-full lg:min-h-0 lg:min-w-0 transition-colors", className)}
        >
          <Wallet className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </Can>
  );
}
