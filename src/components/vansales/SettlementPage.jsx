import React, { useState } from "react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import Can from "../shell/Can.jsx";
import { trips } from "../../lib/vanSalesApi";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import TripDialogHost from "./TripDialogHost";
import { StatusPill } from "./vanShared";

// Van sales > Settlement: the vans that are back and counted in, waiting for their day to be settled - the cash handed
// in, the shortage booked, the stock difference put right. Below them, the last settled trips and how each came out.
export default function SettlementPage() {
  const waiting = useAsync(() => trips.list({ status: "UNLOADED" }), []);
  const done = useAsync(() => trips.list({ status: "SETTLED", limit: 20 }), []);
  const { notify, toastNode } = useToasts();
  const [open, setOpen] = useState(null);
  const reload = () => { waiting.reload(); done.reload(); };

  const waitingCols = [
    { key: "no", header: "Trip", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.tripNo}</span> },
    { key: "van", header: "Van", card: "title", cell: (r) => `${r.vanCode} ${r.vanName || ""}` },
    { key: "salesman", header: "Salesman", card: "meta", cell: (r) => r.salesmanName },
    { key: "date", header: "Date", card: "meta", cell: (r) => formatDate(r.date) },
    { key: "do", header: "", card: "actions", cell: (r) => (
      <Can permission="vansales.settle">
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(r); }} className="inline-flex h-10 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">Settle</button>
      </Can>
    ) },
  ];
  const doneCols = [
    { key: "no", header: "Trip", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.tripNo}</span> },
    { key: "van", header: "Van", card: "title", cell: (r) => r.vanCode },
    { key: "salesman", header: "Salesman", card: "meta", cell: (r) => r.salesmanName },
    { key: "cash", header: "Cash handed in", align: "end", card: "amount", cell: (r) => formatCurrencyAED(r.settlement?.cashHanded || 0) },
    { key: "var", header: "Cash difference", align: "end", card: "meta", cell: (r) => <span className={r.settlement?.cashVariance < 0 ? "text-red-600" : ""}>{formatCurrencyAED(r.settlement?.cashVariance || 0)}</span> },
    { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settlement" description="Close each van's day: take the cash, book what is short, put the stock right." />
      <div className="mt-6 grid gap-6">
        <Panel title="Waiting to be settled" bodyClassName="p-0">
          {waiting.loading && !waiting.data && <Spinner label="Reading the trips" />}
          {waiting.error && <ErrorNote error={waiting.error} onRetry={waiting.reload} />}
          {waiting.data && waiting.data.length === 0 && <EmptyState title="Nothing to settle" text="A van appears here once it is back and counted in." />}
          {waiting.data && waiting.data.length > 0 && <DataTable caption="Trips waiting to be settled" rows={waiting.data} rowKey={(r) => r.id} columns={waitingCols} />}
        </Panel>
        <Panel title="Recently settled" bodyClassName="p-0">
          {done.data && done.data.length === 0 && <EmptyState title="No settled trips yet" text="" />}
          {done.data && done.data.length > 0 && <DataTable caption="Settled trips" rows={done.data} rowKey={(r) => r.id} columns={doneCols} />}
        </Panel>
      </div>
      <TripDialogHost trip={open} dialog={open ? { kind: "settle" } : null} onClose={() => setOpen(null)} onChanged={reload} notify={notify} />
      {toastNode}
    </div>
  );
}
