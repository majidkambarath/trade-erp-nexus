import React from "react";

// Status chips that carry a count and double as a filter - the one pattern every garage-UI reference
// leads with, and the reason is that it does two jobs at once: the mix is readable without touching
// anything (how much of the work is waiting on a customer?), and the thing you just read is also the
// thing you press to see it.
//
// THE RULE THAT MAKES IT HONEST: `chips` is built from the rows actually on screen, never from a
// separate counts payload. A chip can then never offer a state that filters to nothing, and the number
// on it is by construction exactly how many rows pressing it will leave.
//
// It is a button group, not a tablist: these filter a list that stays on screen, they do not swap
// panels, and `aria-pressed` is what says a filter is on (PillTabs is the tab-shaped thing, and it is
// used where a screen really does switch views - Claims list vs Ageing).
export function chipsFrom(rows, key, labels, tones = {}) {
  const counts = rows.reduce((acc, r) => {
    const k = typeof key === "function" ? key(r) : r[key];
    if (k) acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(labels)
    .filter((k) => counts[k])
    .map((k) => ({ key: k, label: labels[k]?.label ?? labels[k], tone: tones[k], count: counts[k] }));
}

export default function StatusChips({ chips, value, onChange, label = "Filter by status", className }) {
  if (!chips.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`} role="group" aria-label={label}>
      {chips.map((c) => {
        const on = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? "" : c.key)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0 lg:py-1.5 ${
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent"
            }`}
          >
            {c.label}
            <span className={`tabular-nums ${on ? "opacity-80" : "text-muted-foreground"}`}>{c.count}</span>
          </button>
        );
      })}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-muted-foreground underline hover:text-foreground lg:min-h-0"
        >
          Show all
        </button>
      )}
    </div>
  );
}
