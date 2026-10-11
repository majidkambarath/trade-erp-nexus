import React, { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CURRENCY, formatCurrencyAED, formatNumber } from "@/utils/format";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { compactAmount, flowNumber, SPLIT, tip } from "./helpers";

// Three ways to see where revenue went, one card. The ring answers "where does every AED 100 go, and is that changing";
// the columns answer "is it getting better or worse, month by month"; the flow diagram (FlowSankey) shows the path.


// "up 3.1 points on the period before", or nothing when there is nothing to compare with or nothing changed
function Change({ now, was }) {
  if (was === undefined || was === null || !Number.isFinite(was)) return null;
  const points = Math.round((now - was) * 10) / 10;
  if (points === 0) return <span>level with the period before</span>;
  const Icon = points > 0 ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {points > 0 ? "up" : "down"} {formatNumber(Math.abs(points), 1)} points on the period before
    </span>
  );
}

// parts: [{ key, label, value, share, was, colour, opacity }]; net and margin are the profit figure the ring's centre shows
// until a part is hovered, focused or tapped (a row or a slice): then the centre is that part.
export function SplitRing({ parts, net, margin }) {
  const [picked, setPicked] = useState(null);
  const drawn = parts.filter((p) => p.value > 0);
  const focus = parts.find((p) => p.key === picked) || null;
  const summary = parts.map((p) => `${p.label} ${formatCurrencyAED(p.value)}, ${formatNumber(p.share, 1)}% of revenue`).join("; ");
  // a tap on a touch screen has no hover to undo: tapping the same part again lets go of it
  const toggle = (key) => setPicked((now) => (now === key ? null : key));

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,230px)_minmax(0,1fr)]">
      <div className="relative mx-auto h-[220px] w-full max-w-[230px]" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={drawn}
              dataKey="value"
              nameKey="label"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={drawn.length > 1 ? 2 : 0}
              cornerRadius={3}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_, i) => setPicked(drawn[i]?.key ?? null)}
              onMouseLeave={() => setPicked(null)}
              onClick={(_, i) => toggle(drawn[i]?.key)}
            >
              {drawn.map((p) => (
                <Cell key={p.key} fill={p.colour} fillOpacity={picked && picked !== p.key ? p.opacity * 0.3 : p.opacity} style={{ cursor: "pointer", transition: "fill-opacity 160ms ease" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* the centre: the profit, or the part being looked at */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center" aria-live="polite">
          {focus ? (
            <>
              <span className="text-xs font-medium text-muted-foreground">{focus.label}</span>
              <span className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums">{flowNumber(focus.value)}</span>
              <span className="text-xs text-muted-foreground">
                {CURRENCY} · {formatNumber(focus.share, 1)}% of revenue
              </span>
            </>
          ) : (
            <>
              <span className="text-xs font-medium text-muted-foreground">{net >= 0 ? "Net profit" : "Net loss"}</span>
              <span className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums">
                <CountUp value={Math.abs(net)} format={flowNumber} />
              </span>
              <span className="text-xs text-muted-foreground">
                {CURRENCY} · {formatNumber(margin, 1)}% of revenue
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="space-y-1" aria-label={`Where every ${CURRENCY} 100 goes`}>
        {parts.map((p) => (
          <li
            key={p.key}
            tabIndex={0}
            onMouseEnter={() => setPicked(p.key)}
            onMouseLeave={() => setPicked(null)}
            onFocus={() => setPicked(p.key)}
            onBlur={() => setPicked(null)}
            onClick={() => toggle(p.key)}
            className={cn(
              "flex cursor-default items-start justify-between gap-4 rounded-2xl px-3 py-3 outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring",
              picked === p.key ? "bg-secondary/70" : "hover:bg-secondary/40",
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: p.colour, opacity: p.opacity }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatNumber(p.share, 1)}% of revenue
                  {p.was !== undefined && p.was !== null && (
                    <>
                      {" · "}
                      <Change now={p.share} was={p.was} />
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums">
                {CURRENCY} {formatNumber(p.value, 0)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {CURRENCY} {formatNumber(p.per100, 2)} per 100
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthTip({ active, payload }) {
  const m = active ? payload?.[0]?.payload : null;
  if (!m) return null;
  return (
    <div style={{ ...tip, padding: "8px 12px", maxWidth: 260 }} className="text-sm">
      <p className="font-semibold">{m.full}</p>
      <p className="mt-0.5 text-muted-foreground">Revenue {formatCurrencyAED(m.revenue)}</p>
      <ul className="mt-1.5 space-y-0.5 text-xs">
        <li className="flex justify-between gap-4"><span className="text-muted-foreground">Goods you sold</span><span className="font-semibold">{formatCurrencyAED(m.goods)}</span></li>
        <li className="flex justify-between gap-4"><span className="text-muted-foreground">Running the business</span><span className="font-semibold">{formatCurrencyAED(m.running)}</span></li>
        <li className="flex justify-between gap-4">
          <span className="text-muted-foreground">{m.net < 0 ? "Loss" : "Profit"}</span>
          <span className="font-semibold">{formatCurrencyAED(Math.abs(m.net))}</span>
        </li>
      </ul>
      {m.margin !== null && <p className="mt-1.5 text-xs text-muted-foreground">Net margin {formatNumber(m.margin, 1)}%</p>}
    </div>
  );
}

// rows: [{ month, label, full, revenue, goods, running, profit, net, margin }] - a column is the month's revenue, cut into
// what the goods cost, what running the business cost, and what is left (a loss month is taller than its revenue and has
// no profit segment: the tooltip says it is a loss)
export function MonthlySplit({ rows }) {
  const summary = rows.map((r) => `${r.full}: revenue ${formatCurrencyAED(r.revenue)}, ${r.net < 0 ? "loss" : "profit"} ${formatCurrencyAED(Math.abs(r.net))}`).join("; ");
  return (
    <div role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} tickFormatter={compactAmount} />
          <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.5 }} content={<MonthTip />} />
          <Bar dataKey="goods" stackId="month" fill={SPLIT.goods.colour} fillOpacity={SPLIT.goods.opacity} isAnimationActive={false} />
          <Bar dataKey="running" stackId="month" fill={SPLIT.running.colour} fillOpacity={SPLIT.running.opacity} isAnimationActive={false} />
          <Bar dataKey="profit" stackId="month" fill={SPLIT.profit.colour} radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// A small segmented control: which of the views is showing. A radio group (choose one), arrow keys move between them.
export function ViewSwitch({ value, onChange, options, label = "How to see it" }) {
  const move = (event, index) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = options[(index + (event.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(next.key);
    event.currentTarget.parentElement?.querySelector(`[data-view="${next.key}"]`)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-full bg-secondary/80 p-1 text-xs font-semibold">
      {options.map((o, i) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            data-view={o.key}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "min-h-10 rounded-full px-3 py-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0",
              selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
