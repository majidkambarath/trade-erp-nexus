import React from "react";
import { History, Plus, RotateCcw, Wallet } from "lucide-react";
import { formatCurrencyAED, formatDate, formatDateTime } from "../../utils/format";

// What a salesman should know at the door, above the lines of a sale: what the customer owes, what they bought last
// time and what they usually buy, each a tap away. All of it is read from their own invoices and cut to what the van
// carries now (the server does that); nothing here is a guess beyond their history. Hidden for a new customer and
// with no signal (the offline pack holds no history).
const chip = "inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm hover:bg-muted";

export function SellInsight({ insight, onRepeat, onAdd, cut, asOf }) {
  if (!insight) return null;
  const { lastOrder, usual = [], notLately = [], position } = insight;
  const owed = Number(position?.owed) || 0;
  if (!lastOrder && owed <= 0) return null;
  return (
    <section aria-label="About this customer" className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <div className="grid min-w-0 grid-cols-1 gap-1">
          {lastOrder && <p className="flex items-center gap-1.5"><History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="min-w-0">Last order <span className="font-medium">{lastOrder.number}</span>, {formatDate(lastOrder.date)} · {lastOrder.lines.length} item{lastOrder.lines.length === 1 ? "" : "s"}</span></p>}
          {owed > 0 && <p className="flex items-center gap-1.5 font-medium text-status-danger"><Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />Owes {formatCurrencyAED(owed)}{position.open?.length > 1 ? ` on ${position.open.length} invoices` : ""}</p>}
        </div>
        {lastOrder && lastOrder.lines.some((l) => l.onVan > 0) && (
          <button type="button" onClick={onRepeat} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"><RotateCcw className="h-4 w-4" aria-hidden="true" />Repeat last order</button>
        )}
      </div>
      {asOf && <p className="text-xs text-muted-foreground">From figures read at {formatDateTime(asOf)}; what they owe is not shown with no signal.</p>}
      {cut && <p role="status" className="text-xs text-muted-foreground">Held to what the van carries: {cut}.</p>}
      {usual.length > 0 && (
        <div className="grid min-w-0 grid-cols-1 gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Usually buys</p>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {usual.map((x) => <li key={x.stockId} className="max-w-full"><button type="button" onClick={() => onAdd(x)} aria-label={`Add ${x.avgQty} ${x.name}`} className={chip}><Plus className="h-3.5 w-3.5 shrink-0 text-accent-teal" aria-hidden="true" /><span className="min-w-0 truncate">{x.name}</span><span className="shrink-0 text-xs text-muted-foreground">{x.avgQty}</span></button></li>)}
          </ul>
        </div>
      )}
      {notLately.length > 0 && (
        <div className="grid min-w-0 grid-cols-1 gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Used to buy, not lately</p>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {notLately.map((x) => <li key={x.stockId} className="max-w-full"><button type="button" onClick={() => onAdd(x)} aria-label={`Add ${x.avgQty} ${x.name}`} className={chip}><Plus className="h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden="true" /><span className="min-w-0 truncate">{x.name}</span><span className="shrink-0 text-xs text-muted-foreground">{x.avgQty}</span></button></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
