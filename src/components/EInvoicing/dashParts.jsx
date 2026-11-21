import React, { useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Minus, Send } from "lucide-react";
import { motionOK } from "../Dashborad/motion";
import { ago } from "../Dashborad/helpers";
import { CURRENCY, formatNumber } from "../../utils/format";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";
import { STATUS } from "./shared";

// The e-invoicing dashboard is drawn in the Home dashboard's own language (Dashborad/OverviewTab.jsx): the same card, the same type
// scale, the same gold "needs attention" card, the same entrance. Those pieces live inline in OverviewTab, so they are written here.
export const cardClass = "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]";

// Home's entrance (Dashborad/index.jsx): the hero drops in, the bento cards rise in a short stagger; meters grow from nothing to the
// width already written in their style. Once per period. Rules of Dashborad/motion.js: nothing under reduced motion or in tests,
// fromTo with clearProps (never from()), a gsap.context reverted when the period changes or the page goes away.
export function useDashMotion(scope, key) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!key || !root || !motionOK()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-anim='hero']", { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out", clearProps: "opacity,transform" });
      gsap.fromTo("[data-anim='bento']", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: { amount: 0.6 }, delay: 0.08, ease: "power3.out", clearProps: "opacity,transform" });
      gsap.fromTo("[data-meter]", { scaleX: 0 }, { scaleX: 1, duration: 1, delay: 0.35, ease: "power3.out", stagger: 0.05, clearProps: "transform" });
    }, root);
    return () => ctx.revert();
  }, [scope, key]);
}

/** A card in Home's style, with an optional heading row. */
export function BentoCard({ title, description, actions, className, bodyClassName, children, ...rest }) {
  return (
    <Card data-anim="bento" className={cn(cardClass, "gap-0 py-0", className)} {...rest}>
      <CardContent className={cn("p-6", bodyClassName)}>
        {(title || actions) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && <h2 className="text-base font-bold">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

const pct = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null);

/** How a figure moved against the period before, as an arrow AND words (colour is never the only cue). `upIsGood` says which way is good. */
export function Delta({ now, before, upIsGood = true }) {
  if (before === undefined || before === null) return null;
  const c = pct(now, before);
  if (c === null) return <span className="text-xs text-muted-foreground">nothing to compare</span>;
  if (c === 0) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" aria-hidden="true" />no change</span>;
  const up = c > 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${good ? "bg-status-success-soft text-status-success" : "bg-status-danger-soft text-status-danger"}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />{formatNumber(Math.abs(c), 1)}% {up ? "up" : "down"}
    </span>
  );
}

/** A bar that grows in (GSAP), its width the share already written. */
export const Meter = ({ value, className, barClassName, label }) => (
  <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-secondary", className)} role="img" aria-label={label}>
    <div data-meter className={cn("h-full origin-left rounded-full bg-[var(--chart-1)]", barClassName)} style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
  </div>
);

const toneDot = { ok: "bg-status-success", warn: "bg-status-warning", danger: "bg-status-danger", muted: "bg-muted-foreground" };
const toneBadge = {
  ok: "bg-status-success-soft text-status-success",
  warn: "bg-status-warning-soft text-status-warning",
  danger: "bg-status-danger-soft text-status-danger",
  muted: "bg-secondary text-muted-foreground",
};

/** Home's "Ops status" rows: a dot, what it is, how many, and a word for its state. Each opens its list, already filtered. */
export function OpsRows({ rows }) {
  const navigate = useNavigate();
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => navigate(r.link)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", toneDot[r.tone])} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.value}</span>
              </span>
            </span>
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", toneBadge[r.tone])}>{r.tag}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Home's gold card: what needs a person now, each row opening its list. */
export function AttentionCard({ todo }) {
  const navigate = useNavigate();
  const open = todo.filter((t) => t.count > 0);
  const first = open[0];
  return (
    <Card data-anim="bento" className={cn(cardClass, "gap-0 overflow-hidden border border-border bg-brand-soft py-0 text-foreground")}>
      <CardContent className="p-6">
        <p className="text-sm font-semibold opacity-80">Needs attention</p>
        <p className="mt-2 text-xl font-extrabold leading-snug tracking-tight">
          {first ? `${first.count} ${first.label.toLowerCase()}` : "All clear."}
        </p>
        {!first && <p className="mt-1 text-sm opacity-80">Nothing is waiting to be sent, fixed or reviewed.</p>}
        {open.length > 0 && (
          <ul className="mt-4 space-y-2">
            {open.map((t) => (
              <li key={t.key}>
                <button type="button" onClick={() => navigate(t.link)}
                  className="flex w-full items-center gap-2 rounded-xl bg-card/60 px-3 py-2 text-start text-sm font-medium transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1">
                    <span className="block">{t.label}</span>
                    <span className="block text-xs font-normal opacity-75">{[t.amount ? `${CURRENCY} ${formatNumber(t.amount, 2)}` : null, t.hint].filter(Boolean).join(" · ") || "Open the list"}</span>
                  </span>
                  <span className="text-base font-extrabold tabular-nums">{t.count}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const docLink = (r) => `${r.invoiceTypeCode === "381" ? "/sales-return" : "/sales-order"}?search=${encodeURIComponent(r.documentNo)}`;
const ICON = (status) => (["FAILED", "REJECTED"].includes(status) ? AlertCircle : ["ACKNOWLEDGED", "REPORTED"].includes(status) ? CheckCircle2 : Send);

/** Home's "Recent activity": a round icon, the document and party, when, and a small state pill. */
export function RecentList({ rows }) {
  if (!rows.length) return <p className="py-6 text-sm text-muted-foreground">Nothing sent yet. Send an approved sales invoice from Outbound.</p>;
  return (
    <ul className="space-y-1">
      {rows.slice(0, 6).map((r, i) => {
        const Icon = ICON(r.status);
        const bad = ["FAILED", "REJECTED"].includes(r.status);
        return (
          <li key={r._id} className={i >= 5 ? "xl:hidden" : undefined}>
            <Link to={docLink(r)} className="flex gap-3 rounded-lg p-1.5 hover:bg-secondary/60">
              <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", bad ? "bg-status-danger-soft text-status-danger" : "bg-secondary")}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-semibold leading-snug">{r.documentNo} · {r.buyerName}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{ago(r.updatedAt)}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{STATUS[r.status]?.label || r.status}</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** One journey as a single segmented meter with its rate written out, and a legend of the parts that have any. */
export function Journey({ title, rate, rateWord, rateNote, parts, note }) {
  const total = parts.reduce((t, p) => t + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm tabular-nums">{rate == null ? <span className="text-xs text-muted-foreground">{rateNote || "nothing sent"}</span> : <><strong className="text-lg font-extrabold">{formatNumber(rate, 1)}%</strong> <span className="text-xs text-muted-foreground">{rateWord}</span></>}</span>
      </div>
      <div className="mt-2 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${title}: ${shown.map((p) => `${p.value} ${p.name.toLowerCase()}`).join(", ") || "nothing yet"}`}>
        {total > 0 && shown.map((p) => <span key={p.key} data-meter className="h-full origin-left first:rounded-s-full last:rounded-e-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {shown.map((p) => <li key={p.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" /><span className="text-muted-foreground">{p.name}</span><span className="font-semibold tabular-nums">{p.value}</span></li>)}
      </ul>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
