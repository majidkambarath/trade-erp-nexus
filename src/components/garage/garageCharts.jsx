// The garage's own chart shape: a ring that answers "what is in the workshop MADE of", the same visual recipe
// as the CRM's own Ring (components/crm/CrmCharts.jsx) - a donut whose centre becomes whatever is hovered, so
// no floating tooltip covers the figure, and whose legend is also the table (identity is never colour alone).
// Garage keeps its own copy rather than importing the CRM's, following the house pattern of each module owning
// its own small chart file (the CRM's Ring and the dashboard's SplitRing are two separate implementations of
// the same idea, not one shared component).
//
// Unlike the CRM's ring (money, categorical hues), these four states carry real meaning - awaiting approval,
// in progress, ready and "delivered but not invoiced" are a HEALTH reading of the workshop, not an arbitrary
// grouping - so they take the STATUS tokens, the same reasoning the CRM's own age scale uses colour for: age
// (there) and workshop health (here) are both a state, not a category.
import React, { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const tip = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  color: "var(--foreground)",
  boxShadow: "var(--shadow-elevated)",
  fontFamily: "var(--font-sans)",
};

const figureSize = (text) => (String(text).length <= 2 ? "text-3xl" : String(text).length <= 4 ? "text-2xl" : "text-xl");

export function JobMixRing({ rows = [], total = 0, label = "jobs in the workshop" }) {
  const [active, setActive] = useState(null);
  const parts = rows.filter((r) => r.value > 0);
  if (!parts.length) return null;
  const shown = active ? parts.find((p) => p.key === active) : null;
  const figure = String(shown ? shown.value : total);

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @lg:flex-row">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={parts}
                dataKey="value"
                nameKey="name"
                innerRadius="64%"
                outerRadius="94%"
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
              <Tooltip contentStyle={tip} formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div className="max-w-[6rem]">
              <p className={`${figureSize(figure)} whitespace-nowrap font-semibold tabular-nums text-foreground`}>{figure}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-muted-foreground">{shown ? shown.name : label}</p>
            </div>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {parts.map((p) => {
            const share = total > 0 ? Math.round((p.value / total) * 100) : 0;
            return (
              <li
                key={p.key}
                onMouseEnter={() => setActive(p.key)}
                onMouseLeave={() => setActive(null)}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${active === p.key ? "bg-accent" : ""}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{p.value}</span>
                <span className="w-10 shrink-0 text-end tabular-nums text-xs text-muted-foreground">{share}%</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
