import React from "react";
import { cn } from "../../lib/utils";

// KPI card used across the voucher, account and report screens. It replaces nine
// copy-pasted versions that each coloured a card with its own bright palette
// (emerald, blue, purple, red) and a "View Details" link that did nothing.
//
// Colour now means something: neutral by default, red only for amounts that need action.

// Categorical tones (teal/plum/rose/olive) group the tiles in a row; they carry no meaning
// beyond "these are different things". Status tones (warning/danger) do carry meaning, so
// the value text is coloured only for those.
const TONES = {
  neutral: { tile: "bg-secondary text-muted-foreground", value: "text-foreground" },
  teal: { tile: "bg-accent-teal-soft text-accent-teal", value: "text-foreground" },
  plum: { tile: "bg-accent-plum-soft text-accent-plum", value: "text-foreground" },
  rose: { tile: "bg-accent-rose-soft text-accent-rose", value: "text-foreground" },
  olive: { tile: "bg-accent-olive-soft text-accent-olive", value: "text-foreground" },
  warning: { tile: "bg-status-warning-soft text-status-warning", value: "text-status-warning" },
  danger: { tile: "bg-status-danger-soft text-status-danger", value: "text-status-danger" },
};

// Existing call sites still pass their old colour props (textColor="text-red-700", ...).
// Read those only to keep "this card is a warning" meaning; every other colour is dropped.
// Remove this once the call sites stop passing them.
const legacyTone = (textColor = "") => {
  if (/red|rose/.test(textColor)) return "danger";
  if (/amber|yellow|orange/.test(textColor)) return "warning";
  return "neutral";
};

export function StatCard({ title, count, icon, subText, trend, tone, textColor, onClick, className }) {
  const t = TONES[tone ?? legacyTone(textColor)];
  const interactive = typeof onClick === "function";
  const Root = interactive ? "button" : "div";

  return (
    <Root
      {...(interactive ? { type: "button", onClick } : {})}
      className={cn(
        "flex w-full flex-col rounded-xl border border-border bg-card p-4 text-start shadow-card sm:p-5",
        interactive &&
          "transition-shadow hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</h3>
        {icon && (
          <span
            aria-hidden="true"
            className={cn("grid h-10 w-10 shrink-0 place-items-center lg:h-8 lg:w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4 sm:h-9 sm:w-9 sm:[&>svg]:h-[18px] sm:[&>svg]:w-[18px]", t.tile)}
          >
            {icon}
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-xl font-bold tracking-tight tabular-nums sm:mt-3 sm:text-2xl", t.value)}>{count}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        {subText && <p className="text-xs text-muted-foreground">{subText}</p>}
        {trend && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
            {trend}
          </span>
        )}
      </div>
    </Root>
  );
}

export default StatCard;
