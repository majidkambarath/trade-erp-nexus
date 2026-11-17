import React from "react";
import { Check, Navigation, Route as RouteIcon, Target, Truck, XCircle } from "lucide-react";
import { nextStep, stopDone } from "../../lib/vanSales";
import { StatusPill } from "./vanShared";
import { formatCurrencyAED } from "../../utils/format";
import { tripTitle, tripWhen } from "./printSale";

// The day at a glance: which van, which route, how far along it the salesman is and who is next.
//
// A LIGHT card, on purpose. The product is graphite ink on light layered surfaces with the organisation's brand colour
// as an accent only (see the design-system decisions); a big filled dark block read as heavy and foreign to every
// other screen, and the owner asked for no decorative line or wash either. So: the plain card surface, graphite text, the van in a brand-soft badge, and the route's progress in teal (the product's data colour)
// with the share done as a figure. Every colour is a token, so it follows the organisation's own brand pack and dark
// mode. The bar grows in once (GSAP, never under reduced motion); its width in the markup is always the real one.
// Today's targets, when the van has any: what it should sell and how many customers it should call on, each as a
// bar with what is done and what is left. Reaching one says so in words; no target, nothing is drawn.
function TargetBars({ progress }) {
  const rows = [
    progress?.sales && { key: "sales", label: "Sales", done: formatCurrencyAED(progress.sales.done), goal: formatCurrencyAED(progress.sales.target), left: formatCurrencyAED(progress.sales.toGo), p: progress.sales },
    progress?.calls && { key: "calls", label: "Customers called on", done: String(progress.calls.done), goal: String(progress.calls.target), left: String(progress.calls.toGo), p: progress.calls },
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-muted/50 p-3.5 sm:p-4" aria-label="Today's targets">
      <p className="flex items-center gap-1.5 text-sm font-medium"><Target className="h-4 w-4 text-accent-teal" aria-hidden="true" />Today's target</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-8">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-1 gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="whitespace-nowrap font-medium">{r.done} <span className="font-normal text-muted-foreground">of {r.goal}</span></span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border/70" role="progressbar" aria-valuenow={Math.min(100, r.p.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.label} against today's target`}>
              <div data-meter="" className={`h-full origin-left rounded-full ${r.p.hit ? "bg-status-success" : "bg-accent-teal"}`} style={{ width: `${Math.max(0, Math.min(100, r.p.pct))}%` }} />
            </div>
            <p className={`text-xs ${r.p.hit ? "font-medium text-status-success" : "text-muted-foreground"}`}>{r.p.hit ? "Target reached" : `${r.left} to go`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VanHero({ trip, detail, heading = false }) {
  const route = trip.route || [];
  const done = route.filter(stopDone).length;
  const next = route.find((c) => !stopDone(c));
  const pct = route.length ? Math.round((done / route.length) * 100) : 0;
  return (
    <section data-reveal="" aria-label="Today's trip" className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="relative grid grid-cols-1 gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span data-truck="" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-on-soft ring-1 ring-brand/20"><Truck className="h-6 w-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              {heading ? <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{tripTitle(trip)}</h1> : <p className="truncate text-lg font-semibold tracking-tight sm:text-xl">{tripTitle(trip)}</p>}
              <p className="truncate text-sm text-muted-foreground">{[detail, tripWhen(trip), trip.routeName].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <StatusPill status={trip.status} />
        </div>
        {route.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 rounded-xl bg-muted/50 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight">{pct}%</span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><RouteIcon className="h-4 w-4" aria-hidden="true" />{done} of {route.length} stops done</span>
              </span>
              <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${next ? "bg-card text-foreground ring-1 ring-border" : "bg-status-success-soft text-status-success"}`}>
                {next ? <Navigation className="h-4 w-4 shrink-0 text-accent-teal" aria-hidden="true" /> : <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span className="truncate">{next ? `Next: ${next.name}` : "Route done"}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border/70" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Route progress">
              <div data-meter="" className="h-full origin-left rounded-full bg-gradient-to-r from-accent-teal to-accent-teal/80" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <TargetBars progress={trip.totals?.progress} />
        <p className="text-sm text-muted-foreground">{nextStep(trip)}</p>
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

