import React from "react";
import { money } from "../../../lib/yearEnd";
import { formatDate } from "../../../utils/format";
import { Pill } from "../kit";

// Stock against the Inventory account of the ledger at the day a month or year closes, with where the difference comes
// from. The server decides (StockReportsService.ledgerCheck, the same reconciliation the stock valuation screen shows);
// this only shows it, and says plainly whether the figure is exact (today) or worked out from the movements (a day gone).

const eps = 0.005;

function Row({ label, children, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{children}</dd>
    </div>
  );
}

export default function StockAgainstLedger({ stock, currency }) {
  if (!stock) return null;
  if (stock.error) {
    return (
      <section aria-label="Stock against the ledger" className="rounded-xl border border-border p-4 text-sm">
        <h3 className="mb-1 font-semibold">Stock against the ledger</h3>
        <p className="text-muted-foreground">{stock.reason}</p>
      </section>
    );
  }
  if (!stock.available) return null;
  // a company with no stock and nothing on the Inventory account has nothing to compare
  if (Math.abs(stock.stockValue || 0) < eps && Math.abs(stock.ledgerBalance || 0) < eps) return null;

  const sources = (stock.sources || []).filter((s) => Math.abs(s.difference) >= eps);
  return (
    <section aria-label="Stock against the ledger" className="rounded-xl border border-border p-4 text-sm">
      <h3 className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
        Stock against the ledger
        {stock.reconciles ? <Pill tone="success">Agrees</Pill> : <Pill tone="warning">Differs</Pill>}
      </h3>
      <p className="mb-1 text-xs text-muted-foreground">As at {formatDate(stock.asOn)}</p>
      <dl className="divide-y divide-border/60">
        <Row label="Stock value">{money(stock.stockValue, currency)}</Row>
        <Row label={`${stock.accountName || "Inventory"} in the ledger`}>{money(stock.ledgerBalance, currency)}</Row>
        <Row label={stock.reconciles ? "Difference" : `Difference (stock is ${stock.difference > 0 ? "higher" : "lower"})`} strong>{money(stock.difference, currency)}</Row>
      </dl>
      {sources.length > 0 && (
        <ul aria-label="Where the difference comes from" className="mt-2 space-y-1 text-xs">
          {sources.map((s) => (
            <li key={s.key || s.label} className="flex justify-between gap-4">
              <span>{s.label}</span>
              <span className="tabular-nums text-muted-foreground">stock {money(s.stock)}, ledger {money(s.ledger)}</span>
            </li>
          ))}
        </ul>
      )}
      {stock.note && <p className="mt-2 text-xs text-muted-foreground">{stock.note}</p>}
    </section>
  );
}
