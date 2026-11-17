import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, MapPin } from "lucide-react";
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync } from "../accounting/kit.jsx";
import { fleet } from "../../lib/vanSalesApi";
import { distanceText, quietText, vanErrorText } from "../../lib/vanSales";
import { formatCurrencyAED, formatTime } from "../../utils/format";
import { StatusPill, Tile } from "./vanShared";

// Van sales > Board: every van loading, out, or counted in and waiting to be settled, for the supervisor. Where each
// one is on its route, what it has sold and holds in cash, when it last did anything, and the flags worth a call: a
// van quiet for two hours with stops still to go, cash over its limit, a sale or visit far from the shop. Read again
// every two minutes, like the approvals count.
const REFRESH_MS = 120000;

function VanCard({ row }) {
  const t = row.totals || {};
  const pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
  return (
    <li className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/van-sales/trips?open=${row.id}`} className="flex min-h-10 items-center font-semibold hover:underline"><span className="truncate">{row.vanCode} · {row.salesmanName}</span></Link>
          <p className="truncate text-sm text-muted-foreground">{row.tripNo}{row.routeName ? ` · ${row.routeName}` : ""}</p>
        </div>
        <StatusPill status={row.status} />
      </div>
      {row.total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>{row.done} of {row.total} stops</span><span>{row.next ? `Next: ${row.next.name}` : "Route done"}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.vanCode} route progress`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><p className="text-xs text-muted-foreground">Sold</p><p className="whitespace-nowrap font-medium">{formatCurrencyAED(t.sales || 0)}</p></div>
        <div><p className="text-xs text-muted-foreground">Cash in hand</p><p className={`whitespace-nowrap font-medium ${t.cashOverLimit ? "text-status-danger" : ""}`}>{formatCurrencyAED(t.cashInHand ?? t.cash ?? 0)}</p></div>
      </div>
      <ul className="grid gap-1 text-xs">
        <li className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{row.lastAt ? `Last activity ${formatTime(row.lastAt)}` : "Nothing done yet"}</li>
        {row.quiet && <li className="flex items-center gap-1.5 font-medium text-status-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Quiet for {quietText(row.quietMinutes)} with stops to go</li>}
        {t.cashOverLimit && <li className="flex items-center gap-1.5 font-medium text-status-danger"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Carrying more cash than its {formatCurrencyAED(t.cashLimit)} limit</li>}
        {row.far.map((f, i) => (
          <li key={i} className="flex items-center gap-1.5 text-status-warning"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">{f.kind === "visit" ? "Visit" : f.kind === "collect" ? "Payment" : "Sale"} {f.ref} {distanceText(f.distanceM)} from the shop</span></li>
        ))}
      </ul>
    </li>
  );
}

export default function BoardPage() {
  const board = useAsync(() => fleet.board(), []);
  useEffect(() => {
    const id = setInterval(() => board.reload(), REFRESH_MS);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const b = board.data;
  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Board" description={b ? `Every van out today, read at ${formatTime(b.at)}. Refreshed every two minutes.` : "Every van out today."} />
      {board.loading && !b && <Spinner label="Reading the vans" />}
      {board.error && <ErrorNote error={new Error(vanErrorText(board.error))} onRetry={board.reload} />}
      {b && (
        <div className="mt-6 grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Out on the road" value={b.counts.out} sub={b.counts.loading ? `${b.counts.loading} loading` : undefined} />
            <Tile label="Sold today" value={formatCurrencyAED(b.sales)} />
            <Tile label="To settle" value={b.counts.toSettle} />
            <Tile label="Needs a look" value={b.counts.quiet + b.counts.overCash + b.counts.far} warn={b.counts.quiet + b.counts.overCash + b.counts.far > 0} sub={[b.counts.quiet && `${b.counts.quiet} quiet`, b.counts.overCash && `${b.counts.overCash} over cash`, b.counts.far && `${b.counts.far} far from a shop`].filter(Boolean).join(", ") || "All clear"} />
          </div>
          {b.rows.length === 0 ? (
            <Panel><EmptyState title="No vans out" text="Open a trip and load a van on Trips. It shows here once it is loading." /></Panel>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{b.rows.map((r) => <VanCard key={r.id} row={r} />)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
