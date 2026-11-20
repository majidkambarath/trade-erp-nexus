import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, CheckCircle2, ClipboardCheck, Clock, PackagePlus, Plus, Scale, Truck, Wallet } from "lucide-react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import Can from "../shell/Can.jsx";
import { trips } from "../../lib/vanSalesApi";
import { TRIP_STATUS } from "../../lib/vanSales";
import { useRecordRoute } from "../../lib/useRecordRoute";
import { formatCurrencyAED, formatDate, formatDateTime } from "../../utils/format";
import TripDialogHost from "./TripDialogHost";
import { VanHero } from "./VanHero";
import { useVanMotion } from "./useVanMotion";
import { OnVanList, StatusPill, Tile, TripActions, TripTiles } from "./vanShared";

// Van sales > Trips: every van trip, and the full view of one with its loads, what is on the van, the count at
// unload and the settlement. What is open lives in the URL (?open=<id>), like every other document screen.
const STATUS_OPTIONS = Object.entries(TRIP_STATUS).map(([k, v]) => [k, v.label]);

// A load on the trip's timeline: the first load, a top-up, or goods handed to or taken from another van.
function loadLabel(l) {
  if (l.kind === "transfer_in") return { text: `From ${l.peerTripNo}`, Icon: ArrowLeftRight, tone: "bg-accent-plum-soft text-accent-plum-on-soft" };
  if (l.kind === "transfer_out") return { text: `To ${l.peerTripNo}`, Icon: ArrowLeftRight, tone: "bg-accent-rose-soft text-accent-rose-on-soft" };
  return l.no === 1 ? { text: "First load", Icon: Truck, tone: "bg-brand-soft text-brand-on-soft" } : { text: "Top-up", Icon: PackagePlus, tone: "bg-accent-teal-soft text-accent-teal-on-soft" };
}

// One row on a vertical timeline: a coloured dot with an icon, a line down to the next row.
function TimelineRow({ icon, tone, last, children }) {
  const Icon = icon;
  return (
    <li data-reveal="" className="relative flex gap-3 px-4 py-3">
      {!last && <span aria-hidden="true" className="absolute left-[2.15rem] top-11 h-[calc(100%-2rem)] w-px bg-border" />}
      <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </li>
  );
}

export function TripView({ id, notify, onClose, onChanged }) {
  const trip = useAsync(() => trips.get(id), [id]);
  const log = useAsync(() => trips.activity(id), [id]);
  const [dialog, setDialog] = useState(null);
  const scope = useRef(null);
  const t = trip.data;
  useVanMotion(scope, t?.id || (t ? id : null));
  const reload = () => { trip.reload(); log.reload(); onChanged?.(); };
  const s = t?.settlement;

  return (
    <div ref={scope} className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <button type="button" onClick={onClose} className="mb-3 inline-flex h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All trips</button>
      {trip.loading && !t && <Spinner label="Reading the trip" />}
      {trip.error && <ErrorNote error={trip.error} onRetry={trip.reload} />}
      {t && (
        <div className="grid grid-cols-1 gap-4 sm:gap-5">
          <VanHero trip={{ ...t, tripNo: t.tripNo, vanCode: [t.vanCode, t.vanName].filter(Boolean).join(" ") }} detail={t.salesmanName} heading />
          {!["SETTLED", "CANCELLED"].includes(t.status) && <div data-reveal="" className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <TripActions trip={t} ask={(kind) => setDialog({ kind })} />
          </div>}
          <TripTiles trip={t} />
          {/* the cheques this van took, in the cheque register (it filters by trip) */}
          <Can permission={["banking.view", "finance.view"]}>
            <p className="text-sm"><Link to={`/cheques?vanTrip=${t.id || id}`} className="font-medium text-primary underline-offset-2 hover:underline">Cheques on this trip</Link></p>
          </Can>

          {/* grid-cols-1 below lg: an implicit auto column grows to the longest item name and pushes the page wide */}
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start">
            <Panel title="On the van" description="What is left of what was loaded" bodyClassName="p-0"><OnVanList trip={t} /></Panel>
            <Panel title="Loads" description={t.loads?.length ? `${t.loads.length} load${t.loads.length === 1 ? "" : "s"}, ${t.loads.reduce((n, l) => n + (l.lines || []).reduce((m, x) => m + (Number(x.qty) || 0), 0), 0)} units in all` : undefined} bodyClassName="p-0">
              {t.loads?.length ? (
                <ol>
                  {t.loads.map((l, i) => {
                    const { text, Icon, tone } = loadLabel(l);
                    return (
                      <TimelineRow key={l.no} icon={Icon} tone={tone} last={i === t.loads.length - 1}>
                        <p className="font-medium">{text} <span className="font-normal text-muted-foreground">· {formatDateTime(l.at)}</span></p>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {l.lines.map((x) => <li key={x.stockId} className="max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs">{x.itemName} <span className="font-semibold">{x.qty}</span></li>)}
                        </ul>
                      </TimelineRow>
                    );
                  })}
                </ol>
              ) : <p className="px-4 py-6 text-sm text-muted-foreground">Nothing loaded yet.</p>}
            </Panel>
          </div>

          {t.unload && (
            <Panel title="Counted back in" description={`${formatDateTime(t.unload.at)}${t.unload.byName ? ` by ${t.unload.byName}` : ""}`} bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {t.unload.lines.map((l) => (
                  <li key={l.stockId} data-reveal="" className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      {l.difference ? <Scale className="h-4 w-4 shrink-0 text-status-warning" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />}
                      <span className="min-w-0 truncate">{l.itemName}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                      {l.countedGood} of {l.expectedGood}{l.countedDamaged ? ` + ${l.countedDamaged} damaged` : ""}
                      {l.difference ? <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${l.difference < 0 ? "bg-status-danger-soft text-status-danger" : "bg-status-warning/15 text-status-warning"}`}>{l.difference > 0 ? `+${l.difference}` : l.difference}</span> : null}
                    </span>
                  </li>
                ))}
                {!t.unload.lines.length && <li className="px-4 py-3 text-sm text-muted-foreground">Nothing was left on the van.</li>}
              </ul>
            </Panel>
          )}

          {s && (
            <Panel title="Settlement" description={`${formatDateTime(s.at)}${s.byName ? ` by ${s.byName}` : ""}`}>
              <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                {[
                  ["Cash taken", s.cashExpected, ""],
                  ["Cash handed in", s.cashHanded, ""],
                  ["Cash difference", s.cashVariance, s.cashVariance < 0 ? "text-status-danger" : s.cashVariance > 0 ? "text-status-success" : ""],
                  ["Stock difference", s.stockVarianceValue, s.stockVarianceValue < 0 ? "text-status-danger" : ""],
                ].map(([label, value, tone]) => (
                  <div key={label} data-reveal="" className="rounded-lg bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className={`mt-0.5 whitespace-nowrap font-semibold ${tone}`}>{formatCurrencyAED(value)}</dd>
                  </div>
                ))}
              </dl>
              {s.notes && <p className="mt-3 text-sm text-muted-foreground">{s.notes}</p>}
            </Panel>
          )}

          {Array.isArray(log.data) && log.data.length > 0 && (
            <Panel title="History" bodyClassName="p-0">
              <ol>
                {log.data.map((a, i) => (
                  <TimelineRow key={a._id || a.id} icon={Clock} tone="bg-muted text-muted-foreground" last={i === log.data.length - 1}>
                    <p>{a.summary || a.action}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt || a.timestamp)}</p>
                  </TimelineRow>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      )}
      <TripDialogHost trip={t} dialog={dialog} onClose={() => setDialog(null)} onChanged={reload} notify={notify} />
    </div>
  );
}

// The tiles above the list double as filters: tap "Out on the road" to see only those; tap it again for all.
const SUMMARY = [
  { status: "ON_ROUTE", label: "Out on the road", icon: Truck, tone: "teal" },
  { status: "LOADING", label: "Loading", icon: PackagePlus, tone: "brand" },
  { status: "UNLOADED", label: "To settle", icon: ClipboardCheck, tone: "rose" },
  { status: "SETTLED", label: "Settled", icon: Wallet, tone: "olive" },
];

export default function TripsPage() {
  const route = useRecordRoute();
  const { notify, toastNode } = useToasts();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const scope = useRef(null);
  // every trip once, for the tiles; the table follows the filter
  const all = useAsync(() => trips.list({}), []);
  const list = useAsync(() => (status ? trips.list({ status }) : Promise.resolve(null)), [status]);
  const source = status ? list : all;
  useVanMotion(scope, all.data ? "trips" : null);
  const rows = useMemo(() => {
    const data = Array.isArray(source.data) ? source.data : [];
    const q = search.trim().toLowerCase();
    return q ? data.filter((r) => `${r.tripNo} ${r.vanCode} ${r.vanName} ${r.salesmanName} ${r.routeName}`.toLowerCase().includes(q)) : data;
  }, [source.data, search]);
  const counts = useMemo(() => {
    const m = {};
    for (const r of Array.isArray(all.data) ? all.data : []) m[r.status] = (m[r.status] || 0) + 1;
    return m;
  }, [all.data]);
  const filtersOn = Boolean(status || search);
  const reloadAll = () => { all.reload(); if (status) list.reload(); };

  const columns = [
    { key: "no", header: "Trip", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.tripNo}</span> },
    { key: "van", header: "Van", card: "title", cell: (r) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-on-soft md:grid"><Truck className="h-4 w-4" aria-hidden="true" /></span>
        <div className="min-w-0"><p className="truncate font-medium">{r.vanCode}</p><p className="truncate text-xs text-muted-foreground">{r.vanName}</p></div>
      </div>
    ) },
    { key: "salesman", header: "Salesman", card: "meta", cell: (r) => r.salesmanName || "–" },
    { key: "route", header: "Route", card: "meta", cell: (r) => r.routeName || "–" },
    { key: "date", header: "Date", card: "meta", cell: (r) => formatDate(r.date) },
    { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill status={r.status} /> },
    { key: "units", header: "Loaded", align: "end", card: "amount", cell: (r) => <span className="whitespace-nowrap">{r.loadedUnits} units</span> },
  ];

  if (route.recordId) {
    return (
      <>
        <TripView id={route.recordId} notify={notify} onClose={() => route.close()} onChanged={reloadAll} />
        {toastNode}
      </>
    );
  }

  return (
    <div ref={scope} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Trips" description="Each van's day: loaded, sent out, counted back in and settled."
        actions={<Can permission="vansales.load"><button type="button" data-shortcut="new" onClick={() => setDialog({ kind: "open" })} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" aria-hidden="true" /> New trip</button></Can>} />
      {all.data && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {SUMMARY.map((x) => (
            <button key={x.status} type="button" aria-pressed={status === x.status} onClick={() => setStatus(status === x.status ? "" : x.status)}
              className={`rounded-xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${status === x.status ? "ring-2 ring-brand" : ""}`}>
              <Tile label={x.label} icon={x.icon} tone={x.tone} amount={counts[x.status] || 0} format={(v) => String(Math.round(v))} value={String(counts[x.status] || 0)} sub={status === x.status ? "Showing only these" : "Tap to show only these"} />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4">
        <FilterBar search={search} onSearch={setSearch} placeholder="Search a trip, van or salesman…" searchLabel="Search trips" active={filtersOn} onClear={() => { setStatus(""); setSearch(""); }}>
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        </FilterBar>
      </div>
      <div className="mt-4">
        <Panel bodyClassName="p-0">
          {source.loading && !source.data && <Spinner label="Reading the trips" />}
          {source.error && <ErrorNote error={source.error} onRetry={source.reload} />}
          {source.data && rows.length === 0 && <EmptyState title={filtersOn ? "Nothing matches" : "No trips yet"} text={filtersOn ? "Clear the filters to see the rest." : "Open a trip, load a van and send it out."} />}
          {source.data && rows.length > 0 && <DataTable className="table-pin-first" caption="Van trips" rows={rows} rowKey={(r) => r.id} onRowClick={(r) => route.open(r.id)} columns={columns} />}
        </Panel>
      </div>
      <TripDialogHost trip={null} dialog={dialog} onClose={() => setDialog(null)} onChanged={reloadAll} notify={notify} />
      {toastNode}
    </div>
  );
}
