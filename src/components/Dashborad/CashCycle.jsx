import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { formatCurrencyAED, formatDate, formatNumber } from "@/utils/format";
import { motionOK, useInView } from "./motion";
import { CountUp } from "./CountUp";
import { CYCLE_PARTS as ROWS, cycleStory } from "./helpers";

// The cash conversion cycle: how many days money is tied up between paying a vendor and collecting from a customer.
//   stock sits (DIO) + customers pay (DSO) - vendors wait (DPO)
// Drawn as two bars on one scale of days: what your cash is waiting for, and how long your vendors carry you.

const days = (n) => `${formatNumber(n, n % 1 === 0 ? 0 : 1)} ${Math.abs(n) === 1 ? "day" : "days"}`;

export default function CashCycle({ cycle }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  const timeline = useRef(null);
  const story = cycleStory(cycle);

  const stockAndCustomers = (cycle.dio || 0) + (cycle.dso || 0);
  const scale = Math.max(stockAndCustomers, cycle.dpo || 0, 1);
  const widthOf = (n) => `${Math.max(n > 0 ? 2 : 0, (n / scale) * 100)}%`;
  const figureKey = `${cycle.dio}|${cycle.dso}|${cycle.dpo}`;

  useLayoutEffect(() => {
    if (!motionOK() || !ref.current) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("[data-seg]", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.7, ease: "power3.out", stagger: 0.12 });
      timeline.current = tl;
    }, ref);
    return () => {
      timeline.current = null;
      ctx.revert();
    };
  }, [figureKey]);

  useLayoutEffect(() => {
    if (inView) timeline.current?.play();
  }, [inView, figureKey]);

  return (
    <div ref={ref}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Cash conversion cycle</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">
            {cycle.cycleDays === null ? "—" : <CountUp value={cycle.cycleDays} format={(v) => days(Math.round(v * 10) / 10)} />}
          </p>
        </div>
        <p className="max-w-[55%] text-right text-xs text-muted-foreground">
          {formatDate(cycle.from)} to {formatDate(cycle.to)} · {cycle.days} {cycle.days === 1 ? "day" : "days"}
        </p>
      </div>

      <div className="mt-4 space-y-2" aria-hidden="true">
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-secondary/70">
          {cycle.dio !== null && <span data-seg className="block h-full" style={{ width: widthOf(cycle.dio), background: ROWS[0].colour, marginRight: 2 }} />}
          {cycle.dso !== null && <span data-seg className="block h-full" style={{ width: widthOf(cycle.dso), background: ROWS[1].colour }} />}
        </div>
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-secondary/70">
          {cycle.dpo !== null && <span data-seg className="block h-full" style={{ width: widthOf(cycle.dpo), background: ROWS[2].colour }} />}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {ROWS.map((r) => (
          <li key={r.key} className="flex items-start justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-start gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm" style={{ background: r.colour }} />
              <span className="min-w-0">
                <span className="font-semibold">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.help}</span>
              </span>
            </span>
            <span className="shrink-0 font-semibold">{cycle[r.key] === null ? "—" : <CountUp value={cycle[r.key]} format={(v) => days(Math.round(v * 10) / 10)} />}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-2xl bg-secondary/60 px-3 py-2 text-sm" data-story={story.tone}>{story.text}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Customers owe {formatCurrencyAED(cycle.receivables)} and vendors are owed {formatCurrencyAED(cycle.payables)}; stock is worth {formatCurrencyAED(cycle.stockValue)}.
      </p>
    </div>
  );
}
