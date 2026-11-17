import React from "react";
import { ArrowLeftRight, Banknote, Fuel, ClipboardCheck, PackagePlus, Printer, RotateCcw, Send, ShoppingCart, Truck, X } from "lucide-react";
import { Pill } from "../accounting/kit.jsx";
import Can from "../shell/Can.jsx";
import { statusOf } from "../../lib/vanSales";
import { formatCurrencyAED } from "../../utils/format";

// What the van sales screens share: the trip's figures, what is on the van, and the buttons a trip offers at each
// step. The buttons follow the trip's status AND the person's permission; the server refuses anything else.

export const StatusPill = ({ status }) => {
  const s = statusOf(status);
  return <Pill tone={s.tone}>{s.label}</Pill>;
};

export function Tile({ label, value, sub, warn = false }) {
  return (
    <div className={`rounded-xl border bg-card p-3 ${warn ? "border-status-danger" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-lg font-semibold">{value}</p>
      {sub && <p className={`text-xs ${warn ? "font-medium text-status-danger" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}

export function TripTiles({ trip }) {
  const t = trip.totals || {};
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile label="Sold" value={formatCurrencyAED(t.sales || 0)} sub={`${t.invoices || 0} invoice${t.invoices === 1 ? "" : "s"}`} />
      <Tile label="Cash taken" value={formatCurrencyAED(t.cash || 0)} sub={t.cashOverLimit ? `Over the ${formatCurrencyAED(t.cashLimit)} limit` : t.expenses ? `${formatCurrencyAED(t.expenses)} spent, ${formatCurrencyAED(t.cashInHand)} in hand` : t.cashLimit != null ? `Limit ${formatCurrencyAED(t.cashLimit)}` : undefined} warn={t.cashOverLimit} />
      <Tile label="Cheques" value={formatCurrencyAED(t.cheques || 0)} />
      <Tile label="Returned" value={formatCurrencyAED(t.returned || 0)} sub={`${t.returns || 0} return${t.returns === 1 ? "" : "s"}`} />
    </div>
  );
}

/** What is on the van now: the sellable goods with how many, and the damaged ones apart. */
export function OnVanList({ trip }) {
  const sellable = trip.sellable || [];
  const damaged = trip.damaged || [];
  if (!sellable.length && !damaged.length) return <p className="px-4 py-6 text-sm text-muted-foreground">{trip.status === "LOADING" && !trip.loads?.length ? "Nothing is loaded yet." : "Nothing is left on the van."}</p>;
  return (
    <ul className="divide-y divide-border">
      {sellable.map((l) => (
        <li key={l.stockId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="min-w-0 truncate">{l.itemName}</span>
          <span className="shrink-0 whitespace-nowrap font-medium">{l.qty}</span>
        </li>
      ))}
      {damaged.map((l) => (
        <li key={`d${l.stockId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-muted-foreground">
          <span className="min-w-0 truncate">{l.itemName} (damaged)</span>
          <span className="shrink-0 whitespace-nowrap">{l.qty}</span>
        </li>
      ))}
    </ul>
  );
}

const btn = "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted";
const primary = "inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90";

/**
 * The actions a trip offers right now. `ask(kind)` opens the matching dialog; the page owns the dialogs.
 * `mine` limits it to the salesman's own tools (the My van screen); the supervisor's view shows the rest too.
 */
export function TripActions({ trip, ask, mine = false, offline = false }) {
  const s = trip.status;
  return (
    <div className="flex flex-wrap gap-2">
      {s === "ON_ROUTE" && (
        <Can permission="vansales.sell">
          <button type="button" className={primary} onClick={() => ask("sell")}><ShoppingCart className="h-4 w-4" aria-hidden="true" /> Sell</button>
          <button type="button" className={btn} onClick={() => ask("collect")}><Banknote className="h-4 w-4" aria-hidden="true" /> Collect money</button>
          {!offline && <button type="button" className={btn} onClick={() => ask("return")}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Take goods back</button>}
          {!offline && <button type="button" className={btn} onClick={() => ask("expense")}><Fuel className="h-4 w-4" aria-hidden="true" /> Road expense</button>}
        </Can>
      )}
      {["LOADING", "ON_ROUTE"].includes(s) && !mine && (
        <Can permission="vansales.load">
          <button type="button" className={btn} onClick={() => ask("load")}><PackagePlus className="h-4 w-4" aria-hidden="true" /> {trip.loads?.length ? "Top up" : "Load the van"}</button>
        </Can>
      )}
      {s === "ON_ROUTE" && !mine && (
        <Can permission="vansales.load">
          <button type="button" className={btn} onClick={() => ask("transfer")}><ArrowLeftRight className="h-4 w-4" aria-hidden="true" /> Hand goods to another van</button>
        </Can>
      )}
      {s === "LOADING" && !mine && (
        <Can permission="vansales.load">
          <button type="button" className={primary} disabled={!trip.loads?.length} onClick={() => ask("depart")}><Send className="h-4 w-4" aria-hidden="true" /> Send the van out</button>
        </Can>
      )}
      {s === "ON_ROUTE" && !offline && (
        <Can permission={["vansales.load", "vansales.sell"]}>
          <button type="button" className={btn} onClick={() => ask("unload")}><ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Count the van back in</button>
        </Can>
      )}
      {s === "UNLOADED" && (
        <Can permission="vansales.settle">
          <button type="button" className={primary} onClick={() => ask("settle")}><Truck className="h-4 w-4" aria-hidden="true" /> Settle the day</button>
        </Can>
      )}
      {["LOADING", "ON_ROUTE"].includes(s) && !mine && (
        <Can permission="vansales.load">
          <button type="button" className={btn} onClick={() => ask("cancel")}><X className="h-4 w-4" aria-hidden="true" /> Cancel trip</button>
        </Can>
      )}
    </div>
  );
}

export const PrintButton = ({ onClick }) => (
  <button type="button" className={btn} onClick={onClick}><Printer className="h-4 w-4" aria-hidden="true" /> Print slip</button>
);
