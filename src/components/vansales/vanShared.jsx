import React from "react";
import { ArrowLeftRight, Banknote, FileCheck2, Fuel, Receipt, Wallet, ClipboardCheck, PackagePlus, Printer, RotateCcw, Send, ShoppingCart, Truck, X } from "lucide-react";
import { Pill } from "../accounting/kit.jsx";
import Can from "../shell/Can.jsx";
import { statusOf } from "../../lib/vanSales";
import { formatCurrencyAED } from "../../utils/format";
import { CountUp } from "../Dashborad/CountUp";

// What the van sales screens share: the trip's figures, what is on the van, and the buttons a trip offers at each
// step. The buttons follow the trip's status AND the person's permission; the server refuses anything else.

export const StatusPill = ({ status }) => {
  const s = statusOf(status);
  return <Pill tone={s.tone}>{s.label}</Pill>;
};

// A figure tile. `amount` (a number) counts up once with GSAP over the final text, which is always in the markup;
// `icon` and `tone` give it a soft coloured badge; `meter` (0-1) draws a thin bar under it (cash against its limit).
const TONES = {
  teal: "bg-accent-teal-soft text-accent-teal-on-soft",
  plum: "bg-accent-plum-soft text-accent-plum-on-soft",
  olive: "bg-accent-olive-soft text-accent-olive-on-soft",
  rose: "bg-accent-rose-soft text-accent-rose-on-soft",
  brand: "bg-brand-soft text-brand-on-soft",
};
export function Tile({ label, value, sub, warn = false, icon: Icon, tone = "brand", amount, format, meter }) {
  const fill = meter == null ? null : Math.max(0, Math.min(1, Number(meter) || 0));
  return (
    <div data-reveal="" className={`relative grid grid-cols-1 content-start gap-1 overflow-hidden rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4 ${warn ? "border-status-danger" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${warn ? "bg-status-danger-soft text-status-danger" : TONES[tone] || TONES.brand}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>}
      </div>
      <p className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
        {amount != null && Number.isFinite(Number(amount)) ? <CountUp value={amount} format={format || formatCurrencyAED} /> : value}
      </p>
      {sub && <p className={`text-xs ${warn ? "font-medium text-status-danger" : "text-muted-foreground"}`}>{sub}</p>}
      {fill != null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div data-meter="" className={`h-full origin-left rounded-full ${warn ? "bg-status-danger" : fill > 0.8 ? "bg-status-warning" : "bg-brand"}`} style={{ width: `${Math.round(fill * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export function TripTiles({ trip }) {
  const t = trip.totals || {};
  const cash = t.cashInHand ?? t.cash ?? 0;
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <Tile label="Sold" icon={Receipt} tone="teal" amount={t.sales || 0} value={formatCurrencyAED(t.sales || 0)} sub={`${t.invoices || 0} invoice${t.invoices === 1 ? "" : "s"}`} />
      <Tile label="Cash taken" icon={Wallet} tone="brand" amount={t.cash || 0} value={formatCurrencyAED(t.cash || 0)} sub={t.cashOverLimit ? `Over the ${formatCurrencyAED(t.cashLimit)} limit` : t.expenses ? `${formatCurrencyAED(t.expenses)} spent, ${formatCurrencyAED(t.cashInHand)} in hand` : t.cashLimit != null ? `Limit ${formatCurrencyAED(t.cashLimit)}` : undefined} warn={t.cashOverLimit} meter={t.cashLimit ? cash / t.cashLimit : undefined} />
      <Tile label="Cheques" icon={FileCheck2} tone="plum" amount={t.cheques || 0} value={formatCurrencyAED(t.cheques || 0)} />
      <Tile label="Returned" icon={RotateCcw} tone="olive" amount={t.returned || 0} value={formatCurrencyAED(t.returned || 0)} sub={`${t.returns || 0} return${t.returns === 1 ? "" : "s"}`} />
    </div>
  );
}

/** How many of each item went onto the van over the trip (loads, top-ups and transfers in or out). */
function loadedOf(trip) {
  const m = new Map();
  for (const load of trip.loads || []) for (const l of load.lines || []) m.set(String(l.stockId), (m.get(String(l.stockId)) || 0) + (Number(l.qty) || 0));
  return m;
}

/** What is on the van now: the sellable goods with how many (and a bar of what is left of what was loaded), the damaged apart. */
export function OnVanList({ trip }) {
  const sellable = trip.sellable || [];
  const damaged = trip.damaged || [];
  if (!sellable.length && !damaged.length) return <p className="px-4 py-6 text-sm text-muted-foreground">{trip.status === "LOADING" && !trip.loads?.length ? "Nothing is loaded yet." : "Nothing is left on the van."}</p>;
  const loaded = loadedOf(trip);
  return (
    <ul className="divide-y divide-border">
      {sellable.map((l) => {
        const of = loaded.get(String(l.stockId)) || 0;
        const left = of > 0 ? Math.max(0, Math.min(1, l.qty / of)) : null;
        return (
          <li key={l.stockId} data-reveal="" className="grid grid-cols-1 gap-1.5 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-medium">{l.itemName}</span>
              <span className="shrink-0 whitespace-nowrap"><span className="font-semibold">{l.qty}</span>{of > 0 && <span className="text-xs text-muted-foreground"> of {of}</span>}</span>
            </div>
            {left != null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div data-meter="" className={`h-full origin-left rounded-full ${left < 0.2 ? "bg-status-warning" : "bg-accent-teal"}`} style={{ width: `${Math.round(left * 100)}%` }} />
              </div>
            )}
          </li>
        );
      })}
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
          <button type="button" className={`${btn} sm:ml-auto`} onClick={() => ask("unload")}><ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Count the van back in</button>
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
