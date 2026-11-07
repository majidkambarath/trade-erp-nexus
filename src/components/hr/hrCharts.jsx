// The HR dashboard's own two chart shapes, beside the ones the home dashboard shares (RankedBars,
// Waterfall, CountUp). Its own file per the convention in ../garage/garageCharts.jsx: the shared layer is
// FlowCharts/motion/CountUp/helpers, and a ring belongs to the module that draws it.
//
// Two jobs the bar charts cannot do: a ring, which answers "what was the month MADE of" rather than "how
// big is each part"; and a month strip with two series facing each other, which answers "are we growing or
// shrinking" in one glance - a single-series chart cannot show joiners against leavers at all.
//
// House rules both follow: colours assigned in a FIXED order and never cycled (so "absent" is the same
// colour every month and on every organisation's screen), a legend whenever there is more than one series,
// identity never carried by colour alone, text in text tokens rather than in a series colour, and
// isAnimationActive={false} everywhere because recharts draws a bar's labels only after its entrance
// animation - the figures would be missing from a screenshot or a print.
import React, { useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ink, tip } from "../Dashborad/helpers";
import { formatNumber } from "../../utils/format";

// The hole is about 130px across, so the figure inside it steps down with its length rather than printing
// over the coloured band.
const figureSize = (text) => (text.length <= 4 ? "text-2xl" : text.length <= 6 ? "text-xl" : "text-lg");

/**
 * What a month's attendance was made of. The centre becomes whatever is hovered, so there is no floating
 * tooltip sitting over the very figure it is explaining.
 */
export function SplitRing({ rows = [], total = 0, label = "days marked", format = (n) => formatNumber(n, 0) }) {
  const [active, setActive] = useState(null);
  const parts = rows.filter((r) => r.value > 0);
  if (!parts.length) return null;
  const hovered = active ? parts.find((p) => p.key === active) : null;
  const figure = format(hovered ? hovered.value : total);

  return (
    // Follows the width of the PANEL, not the screen: on a wide screen this often sits in a narrow column,
    // and a screen-width breakpoint put the legend beside it with no room for either.
    <div className="@container">
      <div className="flex flex-col items-center gap-4 @lg:flex-row">
        <div className="relative h-52 w-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={parts}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
                onMouseEnter={(_, i) => setActive(parts[i]?.key)}
                onMouseLeave={() => setActive(null)}
              >
                {parts.map((p) => <Cell key={p.key} fill={p.color} />)}
              </Pie>
              <Tooltip contentStyle={tip} formatter={(v, n) => [format(v), n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div className="max-w-[6.5rem]">
              <p className={`${figureSize(figure)} whitespace-nowrap font-semibold tabular-nums text-foreground`}>{figure}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-muted-foreground">{hovered ? hovered.name : label}</p>
            </div>
          </div>
        </div>

        {/* The legend is also the table: a status is named, not just coloured. */}
        <ul className="min-w-0 flex-1 space-y-1.5">
          {parts.map((p) => {
            const share = total > 0 ? Math.round((p.value / total) * 1000) / 10 : 0;
            return (
              <li
                key={p.key}
                onMouseEnter={() => setActive(p.key)}
                onMouseLeave={() => setActive(null)}
                className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${active === p.key ? "bg-accent" : ""}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatNumber(share, 1)}%</span>
                <span className="w-16 shrink-0 text-end text-sm tabular-nums text-foreground">{format(p.value)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Joiners against leavers, month by month, with the headcount standing at each month end drawn over them.
 *
 * Leavers are drawn DOWNWARDS (as a negative) so growth and shrinkage read as two directions rather than
 * two colours somebody has to remember - and the axis and the tooltip both show them as plain positive
 * counts, because "-2 leavers" is not a thing anybody says.
 */
export function MonthlyFlow({ rows = [], height = 240, label = (m) => m }) {
  if (!rows.length) return null;
  const data = rows.map((r) => ({ ...r, name: label(r.month), down: -Math.abs(r.leavers) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => String(Math.abs(v))} />
        <Tooltip
          contentStyle={tip}
          formatter={(v, n) => [Math.abs(Number(v)), n === "down" ? "Leavers" : n === "joiners" ? "Joiners" : "Headcount"]}
        />
        <Legend
          formatter={(n) => (n === "down" ? "Leavers" : n === "joiners" ? "Joiners" : "Headcount at month end")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="joiners" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="down" fill="var(--chart-5)" radius={[0, 0, 4, 4]} maxBarSize={22} isAnimationActive={false} />
        <Line dataKey="headcount" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** A plain horizontal meter for a share, where a whole chart would be too much furniture for one number. */
export function ShareBar({ value, tone = ink, label }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
      </div>
      {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
