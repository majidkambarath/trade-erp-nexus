import React from "react";
import { cn } from "@/lib/utils";

// The loading, empty and failed states of a widget on the home dashboard.

export function Skeleton({ className, style }) {
  return <span aria-hidden="true" style={style} className={cn("block animate-pulse rounded-2xl bg-secondary/70", className)} />;
}

// What a chart area says when there is nothing to draw: the same size as the chart, in the same card.
export function Empty({ children, height = 200, className }) {
  return (
    <div
      data-empty=""
      style={{ minHeight: height }}
      className={cn("flex items-center justify-center rounded-2xl bg-secondary/50 px-4 text-center text-sm text-muted-foreground", className)}
    >
      {children}
    </div>
  );
}

// The body of a chart card. `state` is { data, error } of the part the chart comes from: a skeleton
// while it loads, a plain note if it failed, the empty note when there is nothing to draw, else the chart.
export function ChartArea({ state, empty, emptyText, height = 200, children }) {
  if (!state.data) return state.error ? <Empty height={height}>This could not be loaded.</Empty> : <Skeleton style={{ height }} />;
  if (empty) return <Empty height={height}>{emptyText}</Empty>;
  return children;
}
