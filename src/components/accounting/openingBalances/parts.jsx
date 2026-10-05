import React from "react";
import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { Button } from "../../ui/button";
import { EmptyState, Panel, Pill } from "../kit";
import { cn } from "../../../lib/utils";

// Small pieces the Opening balances steps share.

// The steps need the go-live date: every opening entry is dated that day.
export function NeedsDate({ onGo }) {
  return (
    <Panel>
      <EmptyState
        title="Choose the go-live date first"
        text="Every opening balance is dated the go-live day, so it has to be set before anything is entered."
        action={<Button variant="outline" onClick={onGo}><CalendarClock className="h-4 w-4" aria-hidden="true" />Choose the date</Button>}
      />
    </Panel>
  );
}

const NOTE = {
  info: "border-status-info/25 bg-status-info-soft text-status-info",
  warning: "border-status-warning/25 bg-status-warning-soft text-status-warning",
  danger: "border-status-danger/25 bg-status-danger-soft text-status-danger",
  neutral: "border-border bg-secondary/60 text-muted-foreground",
};
export function Note({ tone = "neutral", children, className, ...rest }) {
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", NOTE[tone], className)} {...rest}>{children}</div>;
}

// One line of a table footer: a label that spans the leading cells, then the figure columns.
export function FooterRow({ span, label, cells, strong = false }) {
  return (
    <tr className={strong ? "font-semibold" : "font-medium"}>
      <td colSpan={span} className="px-3 py-2.5">{label}</td>
      {cells.map((c, i) => <td key={i} className="px-4 py-2.5 text-end tabular-nums">{c}</td>)}
      <td />
    </tr>
  );
}

export function StatusPill({ status }) {
  return status === "reversed" ? <Pill>Reversed</Pill> : <Pill tone="success">Posted</Pill>;
}

export const LedgerLink = () => (
  <Link to="/ledger" className="text-xs font-medium text-brand-on-soft underline underline-offset-2 hover:opacity-80">Open ledger</Link>
);
