import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, Clock, MapPin, Navigation, Receipt, Truck, Wallet } from "lucide-react";
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync } from "../accounting/kit.jsx";
import { fleet } from "../../lib/vanSalesApi";
import { distanceText, quietText, vanErrorText } from "../../lib/vanSales";
import { formatCurrencyAED, formatTime } from "../../utils/format";
import { useVanMotion } from "./useVanMotion";
import { StatusPill, Tile } from "./vanShared";

// Van sales > Board: every van loading, out, or counted in and waiting to be settled, for the supervisor. Where each
// one is on its route, what it has sold and holds in cash, when it last did anything, and the flags worth a call: a
// van quiet for two hours with stops still to go, cash over its limit, a sale or visit far from the shop. Read again
// every two minutes, like the approvals count; the motion plays once, never on a refresh.
const REFRESH_MS = 120000;

function VanCard({ row }) {
  const t = row.totals || {};
  const pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
  const cash = t.cashInHand ?? t.cash ?? 0;
  const cashPct = t.cashLimit ? Math.max(0, Math.min(100, Math.round((cash / t.cashLimit) * 100))) : null;
  return (
    <li data-reveal="" className={`relative grid grid-cols-1 gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span data-truck="" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-on-soft"><Truck className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <Link to={`/van-sales/trips?open=${row.id}`} className="flex min-h-10 items-center font-semibold hover:underline"><span className="truncate">{row.vanCode} · {row.salesmanName}</span></Link>
            <p className="-mt-1 truncate text-xs text-muted-foreground">{row.tripNo}{row.routeName ? ` · ${row.routeName}` : ""}</p>
          </div>
        </div>
        <StatusPill status={row.status} />
      </div>
      {row.total > 0 && (
        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
            <span className="font-medium">{row.done} of {row.total} stops</span>
            <span className="flex min-w-0 items-center gap-1 text-muted-foreground"><Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{row.next ? `Next: ${row.next.name}` : "Route done"}</span></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.vanCode} route progress`}>
            <div data-meter="" className="h-full origin-left rounded-full bg-accent-teal" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Receipt className="h-3.5 w-3.5" aria-hidden="true" />Sold</p>
          <p className="whitespace-nowrap font-semibold">{formatCurrencyAED(t.sales || 0)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" aria-hidden="true" />Cash in hand</p>
          <p className={`whitespace-nowrap font-semibold ${t.cashOverLimit ? "text-status-danger" : ""}`}>{formatCurrencyAED(cash)}</p>
          {cashPct != null && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div data-meter="" className={`h-full origin-left rounded-full ${t.cashOverLimit ? "bg-status-danger" : cashPct > 80 ? "bg-status-warning" : "bg-brand"}`} style={{ width: `${cashPct}%` }} />
            </div>
          )}
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 text-xs">
        <li className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{row.lastAt ? `Last activity ${formatTime(row.lastAt)}` : "Nothing done yet"}</li>
        {row.quiet && <li className="flex items-center gap-1.5 rounded-md bg-status-warning/10 px-2 py-1 font-medium text-status-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Quiet for {quietText(row.quietMinutes)} with stops to go</li>}
        {t.cashOverLimit && <li className="flex items-center gap-1.5 rounded-md bg-status-danger-soft px-2 py-1 font-medium text-status-danger"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Carrying more cash than its {formatCurrencyAED(t.cashLimit)} limit</li>}
        {row.far.map((f, i) => (
          <li key={i} className="flex items-center gap-1.5 rounded-md bg-status-warning/10 px-2 py-1 text-status-warning"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">{f.kind === "visit" ? "Visit" : f.kind === "collect" ? "Payment" : "Sale"} {f.ref} {distanceText(f.distanceM)} from the shop</span></li>
        ))}
      </ul>
    </li>
  );
}

export default function BoardPage() {
  const board = useAsync(() => fleet.board(), []);
  const scope = useRef(null);
  useEffect(() => {
    const id = setInterval(() => board.reload(), REFRESH_MS);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const b = board.data;
  useVanMotion(scope, b ? "board" : null);
  const look = b ? b.counts.quiet + b.counts.overCash + b.counts.far : 0;
  return (
    <div ref={scope} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Board" description={b ? `Every van out today, read at ${formatTime(b.at)}. Refreshed every two minutes.` : "Every van out today."} />
      {board.loading && !b && <Spinner label="Reading the vans" />}
      {board.error && <ErrorNote error={new Error(vanErrorText(board.error))} onRetry={board.reload} />}
      {b && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Tile label="Out on the road" icon={Truck} tone="teal" amount={b.counts.out} format={(v) => String(Math.round(v))} value={b.counts.out} sub={b.counts.loading ? `${b.counts.loading} loading` : undefined} />
            <Tile label="Sold today" icon={Receipt} tone="brand" amount={b.sales} value={formatCurrencyAED(b.sales)} />
            <Tile label="To settle" icon={ClipboardCheck} tone="rose" amount={b.counts.toSettle} format={(v) => String(Math.round(v))} value={b.counts.toSettle} />
            <Tile label="Needs a look" icon={AlertTriangle} tone="olive" amount={look} format={(v) => String(Math.round(v))} value={look} warn={look > 0} sub={[b.counts.quiet && `${b.counts.quiet} quiet`, b.counts.overCash && `${b.counts.overCash} over cash`, b.counts.far && `${b.counts.far} far from a shop`].filter(Boolean).join(", ") || "All clear"} />
          </div>
          {b.rows.length === 0 ? (
            <Panel><EmptyState title="No vans out" text="Open a trip and load a van on Trips. It shows here once it is loading." /></Panel>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">{b.rows.map((r) => <VanCard key={r.id} row={r} />)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
