import React, { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import Can from "../shell/Can.jsx";
import { trips } from "../../lib/vanSalesApi";
import { TRIP_STATUS, nextStep } from "../../lib/vanSales";
import { useRecordRoute } from "../../lib/useRecordRoute";
import { formatCurrencyAED, formatDate, formatDateTime } from "../../utils/format";
import TripDialogHost from "./TripDialogHost";
import { OnVanList, StatusPill, TripActions, TripTiles } from "./vanShared";

// Van sales > Trips: every van trip, and the full view of one with its loads, what is on the van, the count at
// unload and the settlement. What is open lives in the URL (?open=<id>), like every other document screen.
const STATUS_OPTIONS = Object.entries(TRIP_STATUS).map(([k, v]) => [k, v.label]);

export function TripView({ id, notify, onClose, onChanged }) {
  const trip = useAsync(() => trips.get(id), [id]);
  const log = useAsync(() => trips.activity(id), [id]);
  const [dialog, setDialog] = useState(null);
  const t = trip.data;
  const reload = () => { trip.reload(); log.reload(); onChanged?.(); };

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All trips</button>
      {trip.loading && !t && <Spinner label="Reading the trip" />}
      {trip.error && <ErrorNote error={trip.error} onRetry={trip.reload} />}
      {t && (
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold">{t.tripNo}</h1>
              <p className="text-sm text-muted-foreground">{t.vanCode} {t.vanName} · {t.salesmanName} · {formatDate(t.date)}{t.routeName ? ` · ${t.routeName}` : ""}</p>
            </div>
            <StatusPill status={t.status} />
          </div>
          <p className="text-sm text-muted-foreground">{nextStep(t)}</p>
          <TripActions trip={t} ask={(kind) => setDialog({ kind })} />
          <TripTiles trip={t} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="On the van" bodyClassName="p-0"><OnVanList trip={t} /></Panel>
            <Panel title="Loads" bodyClassName="p-0">
              {t.loads?.length ? (
                <ul className="divide-y divide-border">
                  {t.loads.map((l) => (
                    <li key={l.no} className="px-4 py-2.5 text-sm">
                      <p className="font-medium">{l.no === 1 ? "First load" : `Top-up ${l.no - 1}`} <span className="font-normal text-muted-foreground">· {formatDateTime(l.at)}</span></p>
                      <p className="text-muted-foreground">{l.lines.map((x) => `${x.itemName} ${x.qty}`).join(", ")}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-4 py-6 text-sm text-muted-foreground">Nothing loaded yet.</p>}
            </Panel>
          </div>

          {t.unload && (
            <Panel title="Counted back in" description={`${formatDateTime(t.unload.at)}${t.unload.byName ? ` by ${t.unload.byName}` : ""}`} bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {t.unload.lines.map((l) => (
                  <li key={l.stockId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{l.itemName}</span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                      {l.countedGood} of {l.expectedGood}{l.countedDamaged ? ` + ${l.countedDamaged} damaged` : ""}
                      {l.difference ? <span className="ml-2 font-medium text-red-600">{l.difference > 0 ? `+${l.difference}` : l.difference}</span> : null}
                    </span>
                  </li>
                ))}
                {!t.unload.lines.length && <li className="px-4 py-3 text-sm text-muted-foreground">Nothing was left on the van.</li>}
              </ul>
            </Panel>
          )}

          {t.settlement && (
            <Panel title="Settlement" description={`${formatDateTime(t.settlement.at)}${t.settlement.byName ? ` by ${t.settlement.byName}` : ""}`}>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Cash taken</dt><dd className="font-medium">{formatCurrencyAED(t.settlement.cashExpected)}</dd></div>
                <div><dt className="text-muted-foreground">Cash handed in</dt><dd className="font-medium">{formatCurrencyAED(t.settlement.cashHanded)}</dd></div>
                <div><dt className="text-muted-foreground">Cash difference</dt><dd className={`font-medium ${t.settlement.cashVariance < 0 ? "text-red-600" : ""}`}>{formatCurrencyAED(t.settlement.cashVariance)}</dd></div>
                <div><dt className="text-muted-foreground">Stock difference</dt><dd className="font-medium">{formatCurrencyAED(t.settlement.stockVarianceValue)}</dd></div>
              </dl>
              {t.settlement.notes && <p className="mt-3 text-sm text-muted-foreground">{t.settlement.notes}</p>}
            </Panel>
          )}

          {Array.isArray(log.data) && log.data.length > 0 && (
            <Panel title="History" bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {log.data.map((a) => (
                  <li key={a._id || a.id} className="px-4 py-2 text-sm">
                    <span>{a.summary || a.action}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(a.createdAt || a.timestamp)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
      <TripDialogHost trip={t} dialog={dialog} onClose={() => setDialog(null)} onChanged={reload} notify={notify} />
    </div>
  );
}

export default function TripsPage() {
  const route = useRecordRoute();
  const { notify, toastNode } = useToasts();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const list = useAsync(() => trips.list({ status: status || undefined }), [status]);
  const rows = useMemo(() => {
    const all = Array.isArray(list.data) ? list.data : [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((r) => `${r.tripNo} ${r.vanCode} ${r.vanName} ${r.salesmanName} ${r.routeName}`.toLowerCase().includes(q)) : all;
  }, [list.data, search]);
  const filtersOn = Boolean(status || search);

  const columns = [
    { key: "no", header: "Trip", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.tripNo}</span> },
    { key: "van", header: "Van", card: "title", cell: (r) => <div className="min-w-0"><p className="truncate font-medium">{r.vanCode}</p><p className="truncate text-xs text-muted-foreground">{r.vanName}</p></div> },
    { key: "salesman", header: "Salesman", card: "meta", cell: (r) => r.salesmanName || "–" },
    { key: "route", header: "Route", card: "meta", cell: (r) => r.routeName || "–" },
    { key: "date", header: "Date", card: "meta", cell: (r) => formatDate(r.date) },
    { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill status={r.status} /> },
    { key: "units", header: "Loaded", align: "end", card: "amount", cell: (r) => <span className="whitespace-nowrap">{r.loadedUnits} units</span> },
  ];

  if (route.recordId) {
    return (
      <>
        <TripView id={route.recordId} notify={notify} onClose={() => route.close()} onChanged={() => list.reload()} />
        {toastNode}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Trips" description="Each van's day: loaded, sent out, counted back in and settled."
        actions={<Can permission="vansales.load"><button type="button" data-shortcut="new" onClick={() => setDialog({ kind: "open" })} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" aria-hidden="true" /> New trip</button></Can>} />
      <div className="mt-6">
        <FilterBar search={search} onSearch={setSearch} placeholder="Search a trip, van or salesman…" searchLabel="Search trips" active={filtersOn} onClear={() => { setStatus(""); setSearch(""); }}>
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        </FilterBar>
      </div>
      <div className="mt-4">
        <Panel bodyClassName="p-0">
          {list.loading && !list.data && <Spinner label="Reading the trips" />}
          {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
          {list.data && rows.length === 0 && <EmptyState title={filtersOn ? "Nothing matches" : "No trips yet"} text={filtersOn ? "Clear the filters to see the rest." : "Open a trip, load a van and send it out."} />}
          {list.data && rows.length > 0 && <DataTable className="table-pin-first" caption="Van trips" rows={rows} rowKey={(r) => r.id} onRowClick={(r) => route.open(r.id)} columns={columns} />}
        </Panel>
      </div>
      <TripDialogHost trip={null} dialog={dialog} onClose={() => setDialog(null)} onChanged={() => list.reload()} notify={notify} />
      {toastNode}
    </div>
  );
}
