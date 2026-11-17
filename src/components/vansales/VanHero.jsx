import React from "react";
import { Check, Navigation, Route as RouteIcon, Truck, XCircle } from "lucide-react";
import { nextStep, stopDone } from "../../lib/vanSales";
import { StatusPill } from "./vanShared";
import { tripTitle, tripWhen } from "./printSale";

// The day at a glance: which van, which route, how far along it the salesman is and who is next. Graphite with the
// brand's gold; the progress bar grows in once (GSAP, never under reduced motion), and its width in the markup is
// always the real one.
export function VanHero({ trip, detail, heading = false }) {
  const route = trip.route || [];
  const done = route.filter(stopDone).length;
  const next = route.find((c) => !stopDone(c));
  const pct = route.length ? Math.round((done / route.length) * 100) : 0;
  return (
    <section data-reveal="" aria-label="Today's trip" className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/25 blur-3xl" /><div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-accent-teal/20 blur-3xl" /></div>
      <div className="relative grid grid-cols-1 gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span data-truck="" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-primary"><Truck className="h-6 w-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              {heading ? <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{tripTitle(trip)}</h1> : <p className="truncate text-lg font-semibold tracking-tight sm:text-xl">{tripTitle(trip)}</p>}
              <p className="truncate text-sm opacity-75">{[detail, tripWhen(trip), trip.routeName].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <StatusPill status={trip.status} />
        </div>
        {route.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 opacity-80"><RouteIcon className="h-4 w-4" aria-hidden="true" />{done} of {route.length} stops done</span>
              <span className="flex min-w-0 items-center gap-1.5 font-medium"><Navigation className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span className="truncate">{next ? `Next: ${next.name}` : "Route done"}</span></span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Route progress">
              <div data-meter="" className="h-full origin-left rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <p className="text-sm opacity-75">{nextStep(trip)}</p>
      </div>
    </section>
  );
}

// One stop on the route, drawn as a step on a line: done in green, the next one ringed in gold, the rest quiet.
export function StopBadge({ c, isNext }) {
  if (c.sold || c.collected) return <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-status-success text-white shadow-sm"><Check className="h-4 w-4" aria-label="Visited" /></span>;
  if (c.visit) return <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><XCircle className="h-4 w-4" aria-label="Visited, no sale" /></span>;
  return <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 bg-card text-xs font-semibold ${isNext ? "border-brand text-foreground ring-4 ring-brand/20" : "border-border text-muted-foreground"}`}>{c.seq + 1}</span>;
}

