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
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ink, tip } from "../Dashborad/helpers";
import { formatNumber } from "../../utils/format";

// The hole is about 130px across, so the figure inside it steps down with its length rather than printing
// over the coloured band.
const figureSize = (text) => (text.length <= 4 ? "text-2xl" : text.length <= 6 ? "text-xl" : "text-lg");

/**
 * Payroll cost month by month, with the months along the X axis in time order.
 *
 * It replaces a RankedBars panel, which was the wrong grammar: that component's own contract is "one
 * measure per name, largest first" - a CATEGORY chart, with the names down the side and truncated at 17
 * characters. Months are not names, and a trend read top-to-bottom by magnitude is not a trend.
 *
 * A month nothing was run in keeps its place on the axis and simply has no bar, so the spacing never
 * lies - the rule the rest of the product states as "a month with nothing is a point on the line, not a
 * gap in it". The bar for the month in progress is drawn in the accent, so the eye lands on now.
 */
export function MonthlyCost({ rows = [], height = 260, money = (n) => formatNumber(n, 0), axis = (n) => formatNumber(n, 0) }) {
  if (!rows.length) return null;
  const last = rows[rows.length - 1]?.month;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={axis} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <Tooltip
          cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
          contentStyle={tip}
          formatter={(v, _n, p) => [v === null ? "Not run" : money(v), p?.payload?.employees ? `Paid ${formatNumber(p.payload.employees, 0)}` : "Payroll"]}
        />
        <Bar dataKey="gross" name="Payroll" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false}>
          {rows.map((r) => <Cell key={r.month} fill={r.month === last ? "var(--chart-2)" : ink} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

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

