import React, { useRef, useState } from "react";
import { Banknote, ClipboardList, MapPin, Search, ShoppingCart } from "lucide-react";
import { StopBadge, VanHero } from "./VanHero";
import { useVanMotion } from "./useVanMotion";
import { currentLocation } from "../../lib/geo";
import { vanErrorText } from "../../lib/vanSales";
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import { trips } from "../../lib/vanSalesApi";
import { stopDone, visitReasonLabel } from "../../lib/vanSales";
import TripDialogHost from "./TripDialogHost";
import { useVanOffline } from "./useVanOffline";
import { visitReasonLabel as reasonText } from "../../lib/vanSales";
import { formatDateTime } from "../../utils/format";
import { OnVanList, TripActions, TripTiles } from "./vanShared";

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
  const scope = useRef(null);
  const [find, setFind] = useState("");
  useVanMotion(scope, trip?.id);
  // orders customers gave for this visit: delivered by selling against them (online only: the order is closed by the sale)
  const preorders = useAsync(() => (trip?.id && trip.routeId && !off.active ? trips.preorders(trip.id).catch(() => []) : Promise.resolve([])), [trip?.id, off.active]);
  const ordersFor = (customerId) => (preorders.data || []).filter((p) => p.customerId === customerId);
  // pin a shop where the van is standing, once: later sales and visits far from it are flagged for the supervisor
  const [pinning, setPinning] = useState("");
  async function pin(c) {
    setPinning(c.customerId);
    try {
      const here = await currentLocation();
      if (!here) throw new Error("The phone did not give a location. Switch location on and try again outside.");
      await trips.pin(trip.id, c.customerId, { location: here });
      notify(`${c.name} pinned where you are.`);
      mine.reload();
    } catch (err) {
      notify(vanErrorText(err), "error");
    } finally {
      setPinning("");
    }
  }

  const nextStop = trip?.route?.find((c) => !stopDone(c));
  const shown = (trip?.route || []).filter((c) => !find.trim() || c.name.toLowerCase().includes(find.trim().toLowerCase()));
  return (
    <div ref={scope} className={`mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 ${nextStop && trip?.status === "ON_ROUTE" ? "pb-32 lg:pb-8" : ""}`}>
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
        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5">
          <VanHero trip={trip} waiting={off.active ? off.view.waiting : 0} />
          {trip.totals?.cashOverLimit && <p role="status" className="rounded-lg border border-status-danger px-3 py-2 text-sm text-status-danger">The van is carrying more cash than its limit. Hand some in at the depot.</p>}
          <TripTiles trip={trip} />
          <div data-reveal="" className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <TripActions trip={trip} ask={ask} mine offline={off.active} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          {trip.route?.length > 0 ? (
            <Panel title="Your route" description="In the order you call." bodyClassName="p-0">
              {trip.route.length > 6 && (
                <div className="border-b border-border p-3">
                  <label className="relative block">
                    <span className="sr-only">Find a customer on your route</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a customer on your route…" className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-base sm:text-sm" />
                  </label>
                </div>
              )}
              {shown.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No customer on this route matches “{find}”.</p>}
              <ol className="relative">
                {shown.map((c, i) => {
                  const isNext = trip.route.find((x) => !stopDone(x))?.customerId === c.customerId;
                  return (
                  <li key={c.customerId} data-reveal="" className={`relative flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors ${isNext ? "bg-brand-soft/40" : "hover:bg-muted/40"}`}>
                    {i < shown.length - 1 && <span aria-hidden="true" className="absolute left-8 top-11 h-[calc(100%-1.75rem)] w-px bg-border" />}
                    <StopBadge c={c} isNext={isNext} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.sold ? "Sold" : c.collected ? "Money collected" : c.visit ? `No sale: ${visitReasonLabel(c.visit.reason)}` : isNext ? "Next stop" : "To visit"}
                        {c.sold && c.collected ? " · money collected" : ""}{c.pinned ? " · pinned" : ""}
                      </span>
                      {ordersFor(c.customerId).map((p) => (
                        <button key={p.id} type="button" onClick={() => ask("sell", { customerId: c.customerId, customerName: c.name, preorder: p })} className="mt-1 inline-flex h-10 max-w-full items-center rounded-lg border border-primary/40 px-2.5 text-xs font-medium text-primary hover:bg-primary/5"><span className="truncate">{p.source === "customer_link" ? "Deliver their request" : "Deliver order"} {p.orderNo}</span></button>
                      ))}
                    </span>
                    {trip.status === "ON_ROUTE" && (
                      <div className="flex w-full flex-wrap gap-1.5 pl-11">
                        <button type="button" aria-label={`Sell to ${c.name}`} onClick={() => ask("sell", { customerId: c.customerId, customerName: c.name })} className={`inline-flex h-10 items-center gap-1 rounded-lg px-2.5 text-sm font-medium ${isNext ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border hover:bg-muted"}`}><ShoppingCart className="h-4 w-4" aria-hidden="true" /> Sell</button>
                        <button type="button" aria-label={`No sale at ${c.name}`} onClick={() => ask("visit", { customerId: c.customerId, customerName: c.name })} className="inline-flex h-10 items-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted">No sale</button>
                        {!off.active && !c.pinned && <button type="button" aria-label={`Pin ${c.name} here`} disabled={pinning === c.customerId} onClick={() => pin(c)} className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-muted disabled:opacity-50"><MapPin className="h-4 w-4" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Pin</span></button>}
                        {!off.active && <button type="button" aria-label={`Order for next visit from ${c.name}`} onClick={() => ask("preorder", { customerId: c.customerId, customerName: c.name })} className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-muted"><ClipboardList className="h-4 w-4" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Order</span></button>}
                        <button type="button" aria-label={`Collect from ${c.name}`} onClick={() => ask("collect", { customerId: c.customerId })} className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-2.5 text-sm hover:bg-muted"><Banknote className="h-4 w-4" aria-hidden="true" /> Collect</button>
                      </div>
                    )}
                  </li>
                  );
                })}
              </ol>
            </Panel>
          ) : (
            <Panel title="Your route"><p className="text-sm text-muted-foreground">This trip has no route. Sell to any customer with the Sell button above.</p></Panel>
          )}
            <Panel title="On the van" description={`${(trip.sellable || []).length} item${(trip.sellable || []).length === 1 ? "" : "s"} to sell, and what is left of what was loaded`} bodyClassName="p-0"><OnVanList trip={trip} /></Panel>
          </div>
        </div>
      )}
      {trip?.status === "ON_ROUTE" && nextStop && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 px-3 lg:hidden" role="region" aria-label="Next stop">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-3.5 shadow-lg">
            <div className="min-w-0 flex-1"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Next stop</p><p className="truncate text-sm font-semibold">{nextStop.name}</p></div>
            <button type="button" aria-label={`Sell to ${nextStop.name} (next stop)`} onClick={() => ask("sell", { customerId: nextStop.customerId, customerName: nextStop.name })} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><ShoppingCart className="h-4 w-4" aria-hidden="true" />Sell</button>
            <button type="button" aria-label={`Collect from ${nextStop.name} (next stop)`} onClick={() => ask("collect", { customerId: nextStop.customerId })} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3.5 text-sm font-medium"><Banknote className="h-4 w-4" aria-hidden="true" />Collect</button>
          </div>
        </div>
      )}
      <TripDialogHost trip={trip} dialog={dialog} onClose={() => setDialog(null)} onChanged={() => { mine.reload(); off.refresh(); preorders.reload(); }} notify={notify} offline={off} />
      {toastNode}
    </div>
  );
}
