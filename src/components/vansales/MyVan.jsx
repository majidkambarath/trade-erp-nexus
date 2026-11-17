import React, { useState } from "react";
import { Banknote, Check, ShoppingCart } from "lucide-react";
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import { trips } from "../../lib/vanSalesApi";
import { nextStep, visitReasonLabel } from "../../lib/vanSales";
import TripDialogHost from "./TripDialogHost";
import { useVanOffline } from "./useVanOffline";
import { visitReasonLabel as reasonText } from "../../lib/vanSales";
import { formatDateTime } from "../../utils/format";
import { OnVanList, StatusPill, TripActions, TripTiles } from "./vanShared";
import { tripTitle, tripWhen } from "./printSale";

// Van sales > My van: the salesman's own screen, built for a phone. The trip they are out on, what is on the van,
// the customers on their route in order with a Sell and a Collect for each, and the money so far. A supervisor opens
// the trip and loads the van (Trips); this is where the day is worked.
// No signal, or work waiting on the phone: said plainly, with the time the figures were read, and a way to send.
function OfflineBar({ off }) {
  const { online, pack, view, syncing, sync, queue, discard } = off;
  const refused = queue.filter((o) => o.state === "refused");
  if (online && !view.waiting && !refused.length) return null;
  return (
    <div role="status" className={`mt-4 grid gap-2 rounded-lg border px-3 py-2 text-sm ${online ? "border-border" : "border-status-warning bg-status-warning/10"}`}>
      {!online && <p className="font-medium">No signal. {pack ? `Working from figures read at ${formatDateTime(pack.at)}.` : "Open this screen once with signal to work offline."}</p>}
      {view.waiting > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{view.waiting} done on the phone, waiting to send.</span>
          {online && <button type="button" onClick={sync} disabled={syncing} className="inline-flex h-10 items-center rounded-lg border border-border px-3 font-medium hover:bg-muted disabled:opacity-50">{syncing ? "Sending…" : "Send now"}</button>}
        </div>
      )}
      {refused.map((o) => (
        <div key={o.clientId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-status-danger px-2 py-1.5">
          <span className="min-w-0 flex-1 text-status-danger">{o.kind === "visit" ? `Visit (${reasonText(o.body?.reason)})` : o.kind === "collect" ? "Payment" : "Sale"} not accepted: {o.error?.message || "refused"}</span>
          <button type="button" onClick={() => discard(o.clientId)} className="inline-flex h-10 items-center rounded-lg border border-border px-3 hover:bg-muted">Discard</button>
        </div>
      ))}
    </div>
  );
}

export default function MyVan() {
  const mine = useAsync(() => trips.mine(), []);
  const { notify, toastNode } = useToasts();
  const [dialog, setDialog] = useState(null);
  const list = Array.isArray(mine.data) ? mine.data : [];
  // the one being worked: out on the road first, then counted in, then still loading
  const live = ["ON_ROUTE", "UNLOADED", "LOADING"].map((s) => list.find((t) => t.status === s)).find(Boolean);
  const off = useVanOffline(live);
  // with no signal the screen works from the pack kept on the phone, less what was sold since it was read
  const trip = off.active ? { ...off.pack.trip, sellable: off.view.sellable } : live || (off.pack && !off.online ? off.pack.trip : undefined);
  const ask = (kind, extra = {}) => setDialog({ kind, ...extra });

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="My van" description="Today's trip: what is on the van, who to call on, what has been sold and collected." />
      {mine.loading && !mine.data && <Spinner label="Reading your trip" />}
      {mine.error && !trip && <ErrorNote error={mine.error} onRetry={mine.reload} />}
      <OfflineBar off={off} />
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
          <TripActions trip={trip} ask={ask} mine offline={off.active} />

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
      <TripDialogHost trip={trip} dialog={dialog} onClose={() => setDialog(null)} onChanged={() => { mine.reload(); off.refresh(); }} notify={notify} offline={off} />
      {toastNode}
    </div>
  );
}
