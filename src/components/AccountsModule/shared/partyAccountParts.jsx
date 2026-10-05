import React from "react";
import { cn } from "../../../lib/utils";
import { formatNumber } from "../../../utils/format";
import { Pill } from "../../accounting/kit";
import { CREDIT_STATUS } from "./partyAccountUtils";

// Small pieces shared by the customer / vendor account pages and their list pages.

/** A grey pulse standing in for content that is still loading. */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-secondary", className)} />;
}

/**
 * The share of the credit limit in use, as a bar. The state is always written out ("Near limit"),
 * never carried by colour alone, and the bar exposes the same figure to assistive technology.
 */
export function UsedBar({ utilisation, status, label = "Credit used", className }) {
  const s = CREDIT_STATUS[status] || CREDIT_STATUS.ok;
  const pct = Math.max(0, Math.min(100, Number(utilisation) || 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={`${formatNumber(utilisation, 1)}% of the credit limit used, ${s.label.toLowerCase()}`}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div className={cn("h-full rounded-full transition-all", s.fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A statement-style card with a utilisation bar; same frame as StatCard so a row of them lines up. */
export function CreditUsedCard({ credit }) {
  const s = CREDIT_STATUS[credit.status] || CREDIT_STATUS.ok;
  return (
    <div className="flex w-full flex-col rounded-xl border border-border bg-card p-5 text-start shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Credit used</h3>
        <Pill tone={s.tone}>{s.label}</Pill>
      </div>
      <p className={cn("mt-3 text-2xl font-semibold tracking-tight tabular-nums", s.text)}>{formatNumber(credit.utilisation, 1)}%</p>
      <UsedBar className="mt-3" utilisation={credit.utilisation} status={credit.status} />
      <p className="mt-2 text-xs text-muted-foreground">
        {credit.status === "over" ? `Over the limit by ${formatNumber(Math.abs(credit.available), 2)}` : `${formatNumber(credit.available, 2)} still available`}
      </p>
    </div>
  );
}

/** Label / value pairs for read-only details. A missing value says so instead of leaving a gap. */
export function DetailList({ items, className }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map(({ label, value, wide }) => (
        <div key={label} className={cn("min-w-0", wide && "sm:col-span-2")}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-words text-sm text-foreground">
            {value === null || value === undefined || value === "" ? <span className="text-muted-foreground">Not provided</span> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Page title (text-2xl), a line of context and the page's actions. */
export function PageTitle({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  );
}
