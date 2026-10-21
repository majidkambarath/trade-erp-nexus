// The CRM's own chart shapes, beside the ones the home dashboard already shares (RankedBars, Waterfall).
//
// Two of them, for two jobs the bar charts cannot do: a ring, which answers "what is the pipeline MADE of" rather
// than "how big is each part", and a day strip, which answers "is the team actually working" at a glance.
//
// Both follow the house rules: colours assigned in a fixed order and never cycled, a legend whenever there is more
// than one series, text in text tokens rather than in the series colour, and no animation that would hide a figure.
import React, { useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactAmount, dayLabel, ink, tip } from "../Dashborad/helpers";
import { CURRENCY, formatCurrencyAED, formatNumber } from "../../utils/format";


// The ring's hole is about 130px across, and the figure in it has to stay inside the ring's inner edge or it prints
// over the coloured band (an exact "AED 499,000.00" at 18px is ~140px and did exactly that). So the centre shows a
// COMPACT figure - the exact amounts are in the legend, where there is room - and its size steps down with its length.
const figureSize = (text) => (text.length <= 4 ? "text-2xl" : text.length <= 6 ? "text-xl" : text.length <= 8 ? "text-lg" : "text-base");

/**
 * What the pipeline is made of. A ring rather than a pie: the hole carries the total, which is the figure people
 * actually want, and it gives the share without pretending the slices are comparable in length.
 */
export function Ring({ rows = [], total = 0, label = "in the pipeline", format = formatCurrencyAED, centreText = null }) {
  const [active, setActive] = useState(null);
  const parts = rows.filter((r) => r.value > 0);
  if (!parts.length) return null;
  const shown = active ? parts.find((p) => p.key === active) : null;
  // Money is shown compactly in the centre (499k), anything else (a count) as it is.
  const money = format === formatCurrencyAED;
  const figure = (centreText || (money ? compactAmount : format))(shown ? shown.value : total);

  return (
    // The layout follows the width of the PANEL this sits in, not of the screen: on a wide screen the ring is often in
    // a narrow column, and a screen-width breakpoint put the legend beside it with no room for either.
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
                {parts.map((p) => (
                  <Cell key={p.key} fill={p.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tip} formatter={(v, n) => [format(v), n]} />
            </PieChart>
          </ResponsiveContainer>
          {/* The centre becomes whatever is hovered, so there is no floating tooltip covering the figure. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div className="max-w-[6.5rem]">
              <p className={`${figureSize(figure)} whitespace-nowrap font-semibold tabular-nums text-foreground`}>{figure}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-muted-foreground">
                {money ? `${CURRENCY} · ` : ""}
                {shown ? shown.name : label}
              </p>
            </div>
          </div>
        </div>

        {/* The legend is also the table: identity is never colour alone. */}
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
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatNumber(share, 1)}%</span>
                <span className="w-24 shrink-0 text-end text-sm tabular-nums text-foreground">{format(p.value)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Two weeks of finished follow-ups, one bar a day. Quiet days are bars of nothing rather than gaps: whether the team
 * is actually working is the question this answers, and a gap would read as "no data" rather than "no calls".
 * Today is the accent and the rest are ink, so the eye lands on now.
 */
export function PulseStrip({ rows = [] }) {
  if (!rows.length) return null;
  const total = rows.reduce((t, r) => t + r.count, 0);
  return (
    <div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={4}>
          <XAxis dataKey="day" tickFormatter={(d) => dayLabel(d).split(" ")[0]} tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
          <YAxis hide allowDecimals={false} domain={[0, (max) => Math.max(3, max)]} />
          <Tooltip
            cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
            contentStyle={tip}
            labelFormatter={dayLabel}
            formatter={(v) => [`${formatNumber(v, 0)} finished`, "Follow-ups"]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} minPointSize={2}>
            {rows.map((r, i) => (
              <Cell key={r.day} fill={i === rows.length - 1 ? "var(--chart-2)" : ink} fillOpacity={r.count ? 1 : 0.25} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-muted-foreground">
        {total ? `${formatNumber(total, 0)} finished in the last two weeks.` : "Nothing finished in the last two weeks."}
      </p>
    </div>
  );
}
