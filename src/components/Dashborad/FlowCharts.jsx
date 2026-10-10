import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrencyAED } from "@/utils/format";
import { axisScale, compactAmount, DECREASE, gold, ink, signedCompact, tip, waterfallSteps } from "./helpers";

// The two shapes the flow charts share. Both are horizontal: a name has the room it needs on a phone, and a
// profit-and-loss reads top to bottom the way the statement does.
//  - Waterfall: revenue -> net profit, opening stock -> closing stock. Totals are ink, a step that adds is the accent,
//    a step that takes away is the rose token; the sign is also written on the bar, so colour is never the only cue.
//  - RankedBars: one measure per name, largest first, the figure written at the end of the bar.
// Neither animates in: recharts draws a bar's labels only after its entrance animation, so the figures would arrive late
// (or not at all in a screenshot or a print), and a chart that is read for its numbers should have them at once.

const clipName = (v) => (String(v).length > 17 ? `${String(v).slice(0, 16)}…` : v);
const tipBox = { ...tip, padding: "8px 12px", maxWidth: 280 };

// The figure at the end of a bar, in text ink (never the series colour). Always to the right of the bar's far end, so a
// bar below zero does not push its figure over the names on the left.
const endOf = (x, width) => Math.max(x, x + width) + 6;

const colourOf = (s) => (s.value < 0 ? DECREASE : s.kind === "total" ? ink : gold);
const effectOf = (s) => (s.kind === "total" ? "Total" : s.value < 0 ? "Takes away" : s.value > 0 ? "Adds" : "No change");

function FlowTip({ active, payload }) {
  const s = active ? payload?.[0]?.payload : null;
  if (!s?.label) return null;
  return (
    <div style={tipBox} className="text-sm">
      <p className="font-semibold">{s.label}</p>
      <p className="mt-0.5 text-muted-foreground">
        {effectOf(s)} · {formatCurrencyAED(s.kind === "total" ? s.value : Math.abs(s.value))}
      </p>
      {s.kind !== "total" && <p className="text-muted-foreground">Running total {formatCurrencyAED(s.end)}</p>}
    </div>
  );
}

function FlowLabel({ x, y, width, height, index, rows }) {
  const s = rows[index];
  if (!s || x === undefined) return null;
  return (
    <text x={endOf(x, width)} y={y + height / 2 + 4} fontSize={12} fontWeight={600} fill="var(--foreground)" stroke="none">
      {s.kind === "total" ? (s.value < 0 ? signedCompact(s.value) : compactAmount(s.value)) : signedCompact(s.value)}
    </text>
  );
}

function ValueLabel({ x, y, width, height, index, rows, valueText }) {
  const r = rows[index];
  if (!r || x === undefined) return null;
  return (
    <text x={endOf(x, width)} y={y + height / 2 + 4} fontSize={12} fontWeight={600} fill="var(--foreground)" stroke="none">
      {valueText(r.value)}
    </text>
  );
}

const Swatch = ({ colour, children }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-sm" style={{ background: colour }} />
    {children}
  </span>
);

export function Waterfall({ steps, height }) {
  const rows = waterfallSteps(steps);
  const scale = axisScale(rows.flatMap((r) => r.range));
  const h = height || Math.max(180, rows.length * 38 + 36);
  const direction = (s) => (s.kind === "total" ? "" : s.value < 0 ? "minus " : s.value > 0 ? "plus " : "");
  const summary = rows.map((s) => `${s.label} ${direction(s)}${formatCurrencyAED(s.kind === "total" ? s.value : Math.abs(s.value))}`).join("; ");
  return (
    <div role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={scale.domain} ticks={scale.ticks} tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactAmount} />
          <YAxis type="category" dataKey="label" width={128} tickLine={false} axisLine={false} fontSize={12} />
          <ReferenceLine x={0} stroke="var(--border)" />
          <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.5 }} content={<FlowTip />} />
          <Bar dataKey="range" radius={4} maxBarSize={22} isAnimationActive={false}>
            {rows.map((s) => <Cell key={s.key} fill={colourOf(s)} />)}
            <LabelList dataKey="range" content={<FlowLabel rows={rows} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
        <Swatch colour={ink}>Total</Swatch>
        <Swatch colour={gold}>Adds</Swatch>
        <Swatch colour={DECREASE}>Takes away</Swatch>
      </div>
    </div>
  );
}

function RankTip({ active, payload, describe }) {
  const r = active ? payload?.[0]?.payload : null;
  if (!r?.name) return null;
  return (
    <div style={tipBox} className="text-sm">
      <p className="font-semibold">{r.name}</p>
      <p className="mt-0.5 text-muted-foreground">{describe(r)}</p>
    </div>
  );
}

// rows: [{ key, name, value, muted? }]. `reference` draws a dashed line to compare every bar against
// ({ value, label }). `valueText` writes the figure at the end of a bar, `describe` fills the tooltip.
export function RankedBars({ rows, height, valueText, axisText = compactAmount, describe, reference }) {
  const h = height || Math.max(160, rows.length * 40 + 34);
  const scale = axisScale([...rows.map((r) => r.value), ...(reference ? [reference.value] : [])]);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} layout="vertical" margin={{ top: reference ? 20 : 4, right: 56, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" domain={scale.domain} ticks={scale.ticks} tickLine={false} axisLine={false} fontSize={12} tickFormatter={axisText} />
        <YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} fontSize={12} tickFormatter={clipName} />
        <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.5 }} content={<RankTip describe={describe} />} />
        {reference && (
          <ReferenceLine
            x={reference.value}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{ value: reference.label, position: "top", fontSize: 11, fill: "var(--muted-foreground)" }}
          />
        )}
        <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={20} isAnimationActive={false}>
          {rows.map((r) => <Cell key={r.key} fill={r.muted ? "var(--muted-foreground)" : ink} />)}
          <LabelList dataKey="value" content={<ValueLabel rows={rows} valueText={valueText} />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
