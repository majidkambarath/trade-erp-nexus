import React, { useState } from "react";
import { Banknote, Check, ShoppingCart } from "lucide-react";
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import { trips } from "../../lib/vanSalesApi";
import { nextStep, visitReasonLabel } from "../../lib/vanSales";
import TripDialogHost from "./TripDialogHost";
import { OnVanList, StatusPill, TripActions, TripTiles } from "./vanShared";
import { tripTitle, tripWhen } from "./printSale";

// Van sales > My van: the salesman's own screen, built for a phone. The trip they are out on, what is on the van,
// the customers on their route in order with a Sell and a Collect for each, and the money so far. A supervisor opens
// the trip and loads the van (Trips); this is where the day is worked.
export default function MyVan() {
  const mine = useAsync(() => trips.mine(), []);
  const { notify, toastNode } = useToasts();
  const [dialog, setDialog] = useState(null);
  const list = Array.isArray(mine.data) ? mine.data : [];
  // the one being worked: out on the road first, then counted in, then still loading
  const trip = ["ON_ROUTE", "UNLOADED", "LOADING"].map((s) => list.find((t) => t.status === s)).find(Boolean);
  const ask = (kind, extra = {}) => setDialog({ kind, ...extra });

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="My van" description="Today's trip: what is on the van, who to call on, what has been sold and collected." />
      {mine.loading && !mine.data && <Spinner label="Reading your trip" />}
      {mine.error && <ErrorNote error={mine.error} onRetry={mine.reload} />}
      {mine.data && !trip && (
        <div className="mt-6">
          <EmptyState title="No van is out for you" text="A supervisor opens a trip and loads the van. It appears here once it is yours." />
        </div>
      )}
      {trip && (
        <div className="mt-6 grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-lg font-semibold">{tripTitle(trip)}</p>
              <p className="text-sm text-muted-foreground">{tripWhen(trip)}{trip.routeName ? ` · ${trip.routeName}` : ""}</p>
            </div>
            <StatusPill status={trip.status} />
          </div>
          <p className="text-sm text-muted-foreground">{nextStep(trip)}</p>
          {trip.totals?.cashOverLimit && <p role="status" className="rounded-lg border border-status-danger px-3 py-2 text-sm text-status-danger">The van is carrying more cash than its limit. Hand some in at the depot.</p>}
          <TripTiles trip={trip} />
          <TripActions trip={trip} ask={ask} mine />

          <Panel title="On the van" bodyClassName="p-0"><OnVanList trip={trip} /></Panel>

          {trip.route?.length > 0 && (
            <Panel title="Your route" description="In the order you call." bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {trip.route.map((c) => (
                  <li key={c.customerId} className="flex items-center gap-2 px-4 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs">{c.sold || c.collected ? <Check className="h-3.5 w-3.5 text-status-success" aria-label="Visited" /> : c.seq + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      {c.visit && !c.sold && <span className="block truncate text-xs text-muted-foreground">No sale: {visitReasonLabel(c.visit.reason)}</span>}
                    </span>
                    {trip.status === "ON_ROUTE" && (
                      <div className="flex shrink-0 gap-1.5">
                        <button type="button" aria-label={`Sell to ${c.name}`} onClick={() => ask("sell", { customerId: c.customerId, customerName: c.name })} className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-muted"><ShoppingCart className="h-4 w-4" aria-hidden="true" /> Sell</button>
                        <button type="button" aria-label={`No sale at ${c.name}`} onClick={() => ask("visit", { customerId: c.customerId, customerName: c.name })} className="inline-flex h-10 items-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted">No sale</button>
                        <button type="button" aria-label={`Collect from ${c.name}`} onClick={() => ask("collect", { customerId: c.customerId })} className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-muted"><Banknote className="h-4 w-4" aria-hidden="true" /> Collect</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
      <TripDialogHost trip={trip} dialog={dialog} onClose={() => setDialog(null)} onChanged={() => mine.reload()} notify={notify} />
      {toastNode}
    </div>
  );
}
