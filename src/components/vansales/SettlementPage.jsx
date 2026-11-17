import React, { useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Scale, Truck, Wallet } from "lucide-react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import Can from "../shell/Can.jsx";
import { trips } from "../../lib/vanSalesApi";
import { formatCurrencyAED, formatDate, formatDateTime } from "../../utils/format";
import TripDialogHost from "./TripDialogHost";
import { useVanMotion } from "./useVanMotion";
import { StatusPill, Tile, VarianceBadge } from "./vanShared";

// Van sales > Settlement: the vans that are back and counted in, waiting for their day to be settled - the cash handed
// in, the shortage booked, the stock difference put right. Below them, the last settled trips and how each came out:
// exact, short or over. Every figure here is read from the trips; nothing is worked out that the settlement does not.
const count = (n) => String(Math.round(n));
const near = (v) => Math.abs(Number(v) || 0) < 0.005;

function VanCell({ r }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span data-truck="" className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-on-soft md:grid"><Truck className="h-4 w-4" aria-hidden="true" /></span>
      <div className="min-w-0"><p className="truncate font-medium">{r.vanCode}</p>{r.vanName && <p className="truncate text-xs text-muted-foreground">{r.vanName}</p>}</div>
    </div>
  );
}

// How the recent days came out, as one bar split three ways and the three counts under it.
function Outcomes({ rows }) {
  const exact = rows.filter((r) => near(r.settlement?.cashVariance)).length;
  const short = rows.filter((r) => Number(r.settlement?.cashVariance) < -0.005).length;
  const over = rows.length - exact - short;
  const part = (n) => `${rows.length ? (n / rows.length) * 100 : 0}%`;
  return (
    <div className="grid grid-cols-1 gap-4 p-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${exact} exact, ${short} short, ${over} over`}>
        <div data-meter="" className="h-full origin-left bg-status-success" style={{ width: part(exact) }} />
        <div data-meter="" className="h-full origin-left bg-status-danger" style={{ width: part(short) }} />
        <div data-meter="" className="h-full origin-left bg-brand" style={{ width: part(over) }} />
      </div>
      {/* three short counts side by side even on a phone (three equal columns, measured at 390px by the sweep) */}
      <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center">
        {[["Exact", exact, "text-status-success"], ["Short", short, "text-status-danger"], ["Over", over, "text-brand-on-soft"]].map(([label, n, tone]) => (
          <div key={label} data-reveal="" className="rounded-lg bg-muted/50 p-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`text-xl font-semibold ${tone}`}>{n}</dd></div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">The cash each van handed in against what it took, over its last {rows.length} settled day{rows.length === 1 ? "" : "s"}.</p>
    </div>
  );
}

export default function SettlementPage() {
  const waiting = useAsync(() => trips.list({ status: "UNLOADED" }), []);
  const done = useAsync(() => trips.list({ status: "SETTLED", limit: 20 }), []);
  const { notify, toastNode } = useToasts();
  const [open, setOpen] = useState(null);
  const scope = useRef(null);
  const reload = () => { waiting.reload(); done.reload(); };
  useVanMotion(scope, waiting.data && done.data ? "settlement" : null);

  const w = useMemo(() => (Array.isArray(waiting.data) ? waiting.data : []), [waiting.data]);
  const d = useMemo(() => (Array.isArray(done.data) ? done.data : []), [done.data]);
  const sums = useMemo(() => ({
    handed: d.reduce((t, r) => t + (Number(r.settlement?.cashHanded) || 0), 0),
    variance: d.reduce((t, r) => t + (Number(r.settlement?.cashVariance) || 0), 0),
    stock: d.reduce((t, r) => t + (Number(r.settlement?.stockVarianceValue) || 0), 0),
  }), [d]);
  const differences = (r) => (r.unload?.lines || []).filter((l) => Number(l.difference)).length;

  const waitingCols = [
    { key: "no", header: "Trip", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.tripNo}</span> },
    { key: "van", header: "Van", card: "title", cell: (r) => <VanCell r={r} /> },
    { key: "salesman", header: "Salesman", card: "meta", cell: (r) => r.salesmanName },
    { key: "date", header: "Date", card: "meta", cell: (r) => formatDate(r.date) },
    { key: "in", header: "Counted in", card: "meta", cell: (r) => (r.unload?.at ? formatDateTime(r.unload.at) : null) },
    { key: "diff", header: "Stock count", card: "meta", cell: (r) => {
      const n = differences(r);
      return n ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-status-warning/15 px-2 py-0.5 text-xs font-medium text-status-warning"><Scale className="h-3.5 w-3.5" aria-hidden="true" />{n} item{n === 1 ? "" : "s"} differ</span> : <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-status-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Agrees</span>;
    } },
    { key: "do", header: "", card: "actions", cell: (r) => (
      <Can permission="vansales.settle">
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(r); }} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">Settle</button>
      </Can>
    ) },
  ];
  const doneCols = [
    { key: "no", header: "Trip", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.tripNo}</span> },
    { key: "van", header: "Van", card: "title", cell: (r) => <VanCell r={r} /> },
    { key: "salesman", header: "Salesman", card: "meta", cell: (r) => r.salesmanName },
    { key: "when", header: "Settled", card: "meta", cell: (r) => (r.settlement?.at ? formatDate(r.settlement.at) : formatDate(r.date)) },
    { key: "cash", header: "Cash handed in", align: "end", card: "amount", cell: (r) => <span className="whitespace-nowrap font-medium">{formatCurrencyAED(r.settlement?.cashHanded || 0)}</span> },
    { key: "var", header: "Cash difference", align: "end", card: "meta", cell: (r) => <VarianceBadge value={r.settlement?.cashVariance} /> },
    { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <div ref={scope} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settlement" description="Close each van's day: take the cash, book what is short, put the stock right." />
      {waiting.data && done.data && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Tile label="Waiting to settle" icon={ClipboardCheck} tone="rose" amount={w.length} format={count} value={count(w.length)} sub={w.length ? `${w.filter((r) => differences(r)).length} with a stock difference` : "All settled"} />
          <Tile label="Settled recently" icon={CheckCircle2} tone="teal" amount={d.length} format={count} value={count(d.length)} sub={d.length ? (near(sums.stock) ? "Stock counts agreed" : `Stock ${formatCurrencyAED(sums.stock)} at cost`) : undefined} />
          <Tile label="Cash handed in" icon={Wallet} tone="brand" amount={sums.handed} value={formatCurrencyAED(sums.handed)} sub="Over those days" />
          <Tile label="Cash short or over" icon={Scale} tone="olive" amount={sums.variance} value={formatCurrencyAED(sums.variance)} warn={sums.variance < -0.005} sub={!d.length ? undefined : near(sums.variance) ? "Every day came out exact" : sums.variance < 0 ? (d.length === 1 ? "Short on the last day" : `Short over the last ${d.length} days`) : (d.length === 1 ? "Over on the last day" : `Over across the last ${d.length} days`)} />
        </div>
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5">
        <div data-reveal="" className={w.length ? "rounded-xl ring-2 ring-brand/40" : undefined}>
          <Panel title={<span className="flex items-center gap-2">{w.length > 0 && <span className="relative flex h-2.5 w-2.5" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 [animation-iteration-count:4] motion-reduce:animate-none" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" /></span>}Waiting to be settled</span>}
            description={w.length ? `${w.length} van${w.length === 1 ? " is" : "s are"} back and counted in.` : undefined} bodyClassName="p-0">
            {waiting.loading && !waiting.data && <Spinner label="Reading the trips" />}
            {waiting.error && <ErrorNote error={waiting.error} onRetry={waiting.reload} />}
            {waiting.data && w.length === 0 && <EmptyState title="Nothing to settle" text="A van appears here once it is back and counted in." />}
            {waiting.data && w.length > 0 && <DataTable caption="Trips waiting to be settled" rows={w} rowKey={(r) => r.id} columns={waitingCols} />}
          </Panel>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <Panel title="Recently settled" bodyClassName="p-0">
            {done.data && d.length === 0 && <EmptyState title="No settled trips yet" text="" />}
            {done.data && d.length > 0 && <DataTable caption="Settled trips" rows={d} rowKey={(r) => r.id} columns={doneCols} />}
          </Panel>
          {d.length > 0 && <Panel title="How the days came out" bodyClassName="p-0"><Outcomes rows={d} /></Panel>}
        </div>
      </div>
      <TripDialogHost trip={open} dialog={open ? { kind: "settle" } : null} onClose={() => setOpen(null)} onChanged={reload} notify={notify} />
      {toastNode}
    </div>
  );
}
