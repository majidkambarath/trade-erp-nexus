import React, { useMemo, useRef, useState } from "react";
import { CalendarRange, FileCheck2, Gauge, Layers, Receipt, Scale, ShoppingBasket, TrendingUp, Truck, Users, Wallet } from "lucide-react";
import { DataTable, DateInput, EmptyState, ErrorNote, Field, PageHeader, Panel, Select, Spinner, useAsync } from "../accounting/kit.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import { reports } from "../../lib/vanSalesApi";
import { strikeText, vanErrorText } from "../../lib/vanSales";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { useVanMotion } from "./useVanMotion";
import { BarList, StatusPill, Tile, VarianceBadge } from "./vanShared";

// Van sales > Reports: what the vans did over a period - sales, returns, money taken and how each day settled - one
// row per trip, and rolled up by van and by salesman. Read from the documents themselves. The bars and tiles are the
// same figures as the tables under them, ranked; nothing is computed here that the server did not send.
const money = (r) => formatCurrencyAED(r || 0);
const top = (rows, value, sub, n = 5) => [...(rows || [])].sort((a, b) => value(b) - value(a)).slice(0, n).map((r) => ({ key: r.id ?? r.key ?? r.name, label: r.name, value: value(r), sub: sub?.(r) }));

const dash = (v, fmt) => (v === null || v === undefined ? "–" : fmt(v));
const dayName = (d) => formatDate(`${d}T00:00:00.000Z`);

// Sales by day as columns, tallest = the best day. Quiet days are there as nothing, so a gap reads as a gap. The
// figures are under each column's tooltip and summed in words above, so the picture is never the only way to read it.
function DayStrip({ days }) {
  if (!days?.length) return null;
  const best = days.reduce((a, b) => (b.sales > a.sales ? b : a), days[0]);
  const max = best.sales || 1;
  return (
    <Panel title="Sales by day" description={best.sales > 0 ? `Best day ${dayName(best.day)}: ${money(best.sales)} on ${best.invoices} invoice${best.invoices === 1 ? "" : "s"}` : "Nothing sold in this period yet"}>
      <div role="img" aria-label={`Sales for each of ${days.length} days; the best was ${dayName(best.day)} at ${money(best.sales)}`} className="flex h-28 items-end gap-px sm:gap-0.5">
        {days.map((x) => (
          <div key={x.day} title={`${dayName(x.day)}: ${money(x.sales)} (${x.invoices} invoice${x.invoices === 1 ? "" : "s"})`} className="flex h-full min-w-0 flex-1 items-end">
            <div data-grow="" className={`w-full origin-bottom rounded-t ${x.day === best.day && x.sales > 0 ? "bg-brand" : "bg-accent-teal/70"}`} style={{ height: `${x.sales > 0 ? Math.max(4, Math.round((x.sales / max) * 100)) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground"><span>{dayName(days[0].day)}</span><span>{dayName(days[days.length - 1].day)}</span></div>
    </Panel>
  );
}

// Salesmen ranked by what they sold, with the figures that say HOW: the size of a drop, the width of a basket, how
// often a call became a sale, and the days they reached their target. Read from the same rows as every other tab.
function Leaderboard({ rows }) {
  const cols = [
    { key: "rank", header: "#", card: "hidden", cell: (r) => <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${r._rank === 1 ? "bg-brand-soft text-brand-on-soft" : "bg-muted text-muted-foreground"}`}>{r._rank}</span> },
    { key: "name", header: "Salesman", card: "primary", cell: (r) => <span className="flex min-w-0 items-center gap-2"><span className="md:hidden text-xs text-muted-foreground">#{r._rank}</span><span className="truncate font-medium">{r.name}</span></span> },
    { key: "sales", header: "Sales", align: "end", card: "amount", cell: (r) => <span className="whitespace-nowrap font-semibold">{money(r.sales)}</span> },
    { key: "drop", header: "Average drop", align: "end", card: "meta", cell: (r) => dash(r.dropSize, money) },
    { key: "lines", header: "Lines per call", align: "end", card: "meta", cell: (r) => dash(r.linesPerCall, (v) => v.toFixed(1)) },
    { key: "strike", header: "Strike rate", align: "end", card: "meta", cell: (r) => <Strike rate={r.strikeRate} title={`${r.productive} of ${r.calls} customers called on bought`} /> },
    { key: "target", header: "Target reached", align: "end", card: "meta", cell: (r) => (r.daysWithTarget ? `${r.targetDays} of ${r.daysWithTarget} day${r.daysWithTarget === 1 ? "" : "s"}` : "No target") },
  ];
  const ranked = rows.map((r, i) => ({ ...r, _rank: i + 1 }));
  return <DataTable caption="Salesman leaderboard" rows={ranked} rowKey={(r) => r.id} columns={cols} />;
}

// Strike rate as words and a thin bar: how many of the customers called on bought.
function Strike({ rate, title }) {
  if (rate == null) return <span className="text-muted-foreground">–</span>;
  const pct = Math.max(0, Math.min(100, Math.round(Number(rate))));
  return (
    <span className="inline-flex items-center justify-end gap-2" title={title}>
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:inline-block" aria-hidden="true"><span data-meter="" className="block h-full origin-left rounded-full bg-accent-teal" style={{ width: `${pct}%` }} /></span>
      <span className="whitespace-nowrap">{strikeText(rate)}</span>
    </span>
  );
}

// What each route, salesman or van made over its settled trips: sales less returns and their cost, the goods written
// off, the road expenses and the cash short, per km where the odometer was read.
function RouteProfit({ from, to }) {
  const [by, setBy] = useState("route");
  const data = useAsync(() => reports.routeProfit({ from: from || undefined, to: to || undefined, by }), [from, to, by]);
  const d = data.data;
  const label = { route: "Route", salesman: "Salesman", van: "Van" }[by];
  const sum = (k) => (d?.rows || []).reduce((t, r) => t + (Number(r[k]) || 0), 0);
  const cols = [
    { key: "name", header: label, card: "primary", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "trips", header: "Trips", align: "end", card: "meta", cell: (r) => r.trips },
    { key: "net", header: "Sales less returns", align: "end", card: "meta", cell: (r) => money(r.netSales) },
    { key: "gm", header: "Gross margin", align: "end", card: "meta", cell: (r) => money(r.grossMargin) },
    { key: "off", header: "Written off", align: "end", card: "meta", cell: (r) => money(r.damaged) },
    { key: "exp", header: "Road expenses", align: "end", card: "meta", cell: (r) => money(r.expenses) },
    { key: "cash", header: "Cash short / over", align: "end", card: "meta", cell: (r) => <VarianceBadge value={r.cashVariance} /> },
    { key: "contribution", header: "Contribution", align: "end", card: "amount", cell: (r) => <span className={`whitespace-nowrap font-semibold ${r.contribution < 0 ? "text-status-danger" : ""}`}>{money(r.contribution)}</span> },
    { key: "pct", header: "Margin", align: "end", card: "meta", cell: (r) => (r.marginPct === null ? "–" : `${r.marginPct}%`) },
    { key: "km", header: "Per km", align: "end", card: "meta", cell: (r) => (r.perKm === null ? "–" : money(r.perKm)) },
  ];
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="By"><Select value={by} onChange={(e) => setBy(e.target.value)}><option value="route">Route</option><option value="salesman">Salesman</option><option value="van">Van</option></Select></Field>
        {d && <p className="pb-2 text-sm text-muted-foreground">From {d.trips} settled trip{d.trips === 1 ? "" : "s"}. A trip still out or not settled is left out: its figures can still change.</p>}
      </div>
      {data.loading && !d && <Spinner label="Reading the figures" />}
      {data.error && <ErrorNote error={new Error(vanErrorText(data.error))} onRetry={data.reload} />}
      {d?.rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Tile label="Sales less returns" icon={Receipt} tone="teal" amount={sum("netSales")} value={money(sum("netSales"))} />
            <Tile label="Gross margin" icon={TrendingUp} tone="brand" amount={sum("grossMargin")} value={money(sum("grossMargin"))} />
            <Tile label="Road expenses" icon={Truck} tone="plum" amount={sum("expenses")} value={money(sum("expenses"))} sub={sum("damaged") ? `${money(sum("damaged"))} written off` : undefined} />
            <Tile label="Contribution" icon={Scale} tone="olive" amount={sum("contribution")} value={money(sum("contribution"))} warn={sum("contribution") < 0} />
          </div>
          <Panel title={`Contribution by ${label.toLowerCase()}`} description="What is left after the goods, the write-offs, the road and the cash" bodyClassName="p-0">
            <BarList rows={top(d.rows, (r) => Number(r.contribution) || 0, (r) => (r.marginPct === null ? `${r.trips} trips` : `${r.marginPct}% margin on ${r.trips} trip${r.trips === 1 ? "" : "s"}`), 8)} tone="bg-brand" />
          </Panel>
        </>
      )}
      <Panel bodyClassName="p-0">
        {d?.rows.length === 0 && <EmptyState title="No settled trips in this period" text="Profit is worked out once a trip is settled." />}
        {d?.rows.length > 0 && <DataTable caption={`Profit by ${label.toLowerCase()}`} rows={d.rows} rowKey={(r) => r.key} columns={cols} />}
      </Panel>
    </div>
  );
}

export default function VanReports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState("trips");
  const scope = useRef(null);
  const data = useAsync(() => reports.summary({ from: from || undefined, to: to || undefined }), [from, to]);
  const d = data.data;
  useVanMotion(scope, d ? "reports" : null);
  const vans = useMemo(() => top(d?.byVan, (r) => Number(r.sales) || 0, (r) => `${r.trips} trip${r.trips === 1 ? "" : "s"}${r.strikeRate == null ? "" : ` · strike rate ${strikeText(r.strikeRate)}`}`), [d]);
  const people = useMemo(() => top(d?.bySalesman, (r) => Number(r.sales) || 0, (r) => `${r.trips} trip${r.trips === 1 ? "" : "s"}${r.strikeRate == null ? "" : ` · strike rate ${strikeText(r.strikeRate)}`}`), [d]);

  const rollCols = (label) => [
    { key: "name", header: label, card: "primary", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "trips", header: "Trips", align: "end", card: "meta", cell: (r) => r.trips },
    { key: "sales", header: "Sales", align: "end", card: "amount", cell: (r) => <span className="whitespace-nowrap font-semibold">{money(r.sales)}</span> },
    { key: "drop", header: "Average drop", align: "end", card: "meta", cell: (r) => dash(r.dropSize, money) },
    { key: "returned", header: "Returned", align: "end", card: "meta", cell: (r) => money(r.returned) },
    { key: "cash", header: "Cash", align: "end", card: "meta", cell: (r) => money(r.cash) },
    { key: "cheques", header: "Cheques", align: "end", card: "meta", cell: (r) => money(r.cheques) },
    { key: "var", header: "Cash difference", align: "end", card: "meta", cell: (r) => <VarianceBadge value={r.cashVariance} /> },
    { key: "strike", header: "Strike rate", align: "end", card: "meta", cell: (r) => <Strike rate={r.strikeRate} title={`${r.productive} of ${r.calls} customers called on bought`} /> },
  ];
  const tripCols = [
    { key: "no", header: "Trip", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.tripNo}</span> },
    { key: "van", header: "Van", card: "title", cell: (r) => r.vanCode },
    { key: "salesman", header: "Salesman", card: "meta", cell: (r) => r.salesmanName },
    { key: "date", header: "Date", card: "meta", cell: (r) => formatDate(r.date) },
    { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill status={r.status} /> },
    { key: "sales", header: "Sales", align: "end", card: "amount", cell: (r) => <span className="whitespace-nowrap font-semibold">{money(r.sales)}</span> },
    { key: "cash", header: "Cash", align: "end", card: "meta", cell: (r) => money(r.cash) },
    { key: "strike", header: "Strike rate", align: "end", card: "meta", cell: (r) => <Strike rate={r.strikeRate} /> },
    { key: "var", header: "Cash difference", align: "end", card: "meta", cell: (r) => (r.cashVariance == null ? "–" : <VarianceBadge value={r.cashVariance} />) },
  ];

  return (
    <div ref={scope} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Reports" description="What the vans sold and took over a period, and how each day settled." />
      <div data-reveal="" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-on-soft sm:grid" aria-hidden="true"><CalendarRange className="h-5 w-5" /></span>
        <Field label="From"><DateInput value={from || d?.from || ""} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><DateInput value={to || d?.to || ""} onChange={(e) => setTo(e.target.value)} /></Field>
        {d && <p className="pb-2 text-sm text-muted-foreground">{formatDate(d.from)} to {formatDate(d.to)}</p>}
      </div>
      {data.loading && !d && <Spinner label="Reading the report" />}
      {data.error && <ErrorNote error={new Error(vanErrorText(data.error))} onRetry={data.reload} />}
      {d && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Tile label="Sales" icon={Receipt} tone="teal" amount={d.total.sales} value={money(d.total.sales)} sub={`${d.total.invoices} invoice${d.total.invoices === 1 ? "" : "s"} on ${d.total.trips} trip${d.total.trips === 1 ? "" : "s"}`} />
            <Tile label="Cash taken" icon={Wallet} tone="brand" amount={d.total.cash} value={money(d.total.cash)} />
            <Tile label="Cheques" icon={FileCheck2} tone="plum" amount={d.total.cheques} value={money(d.total.cheques)} />
            <Tile label="Cash difference" icon={Scale} tone="olive" amount={d.total.cashVariance} value={money(d.total.cashVariance)} warn={d.total.cashVariance < -0.005} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Tile label="Average drop" icon={ShoppingBasket} tone="teal" value={dash(d.total.dropSize, money)} sub="One invoice, before VAT" />
            <Tile label="Lines per call" icon={Layers} tone="plum" value={dash(d.total.linesPerCall, (v) => v.toFixed(1))} sub="Items in a basket" />
            <Tile label="Strike rate" icon={Gauge} tone="brand" value={dash(d.total.strikeRate, (v) => `${v}%`)} sub={d.total.calls ? `${d.total.productive} of ${d.total.calls} calls bought` : undefined} />
            <Tile label="Cost per drop" icon={Truck} tone="olive" value={dash(d.total.costPerDrop, money)} sub="Road expenses per invoice" />
          </div>
          <DayStrip days={d.byDay} />
          {view !== "profit" && view !== "leaderboard" && d.rows.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
              <Panel title={<span className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />Top vans</span>} description="By sales in the period" bodyClassName="p-0"><BarList rows={vans} /></Panel>
              <Panel title={<span className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />Top salesmen</span>} description="By sales in the period" bodyClassName="p-0"><BarList rows={people} tone="bg-brand" /></Panel>
            </div>
          )}
          <PillTabs label="Report view" tabs={[["trips", "Trips"], ["vans", "By van"], ["salesmen", "By salesman"], ["leaderboard", "Leaderboard"], ["profit", "Profit by route"]]} value={view} onChange={setView} />
          {view === "profit" && <RouteProfit from={from} to={to} />}
          {view === "leaderboard" && <Panel bodyClassName="p-0">
            {d.bySalesman.length === 0 ? <EmptyState title="No salesmen in this period" text="Widen the dates, or send a van out." /> : <Leaderboard rows={d.bySalesman} />}
          </Panel>}
          {view !== "profit" && view !== "leaderboard" && <Panel bodyClassName="p-0">
            {d.rows.length === 0 && <EmptyState title="No trips in this period" text="Widen the dates, or send a van out." />}
            {d.rows.length > 0 && view === "trips" && <DataTable caption="Van trips" rows={d.rows} rowKey={(r) => r.id} columns={tripCols} />}
            {d.rows.length > 0 && view === "vans" && <DataTable caption="Sales by van" rows={d.byVan} rowKey={(r) => r.id} columns={rollCols("Van")} />}
            {d.rows.length > 0 && view === "salesmen" && <DataTable caption="Sales by salesman" rows={d.bySalesman} rowKey={(r) => r.id} columns={rollCols("Salesman")} />}
          </Panel>}
        </div>
      )}
    </div>
  );
}
