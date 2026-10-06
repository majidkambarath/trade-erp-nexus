import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "../ui/button";
import { ErrorNote, Modal, Pill } from "../accounting/kit";
import { cn } from "../../lib/utils";
import { formatDateTime } from "../../utils/format";

// The segmented control the list screens use for a status filter. Scrolls rather than wraps on a phone,
// so it keeps its one-line shape. `counts` is optional, { value: n }.
export function PillTabs({ tabs, value, onChange, counts, label }) {
  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <div role="tablist" aria-label={label} className="inline-flex rounded-full border border-border bg-card p-1">
        {tabs.map(([v, name]) => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium lg:min-h-0",
              value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {name}
            {counts?.[v] > 0 && <span className={cn("ms-1.5 text-xs tabular-nums", value === v ? "opacity-80" : "text-muted-foreground")}>{counts[v]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// A sentence above a document: a warning to act on, or a fact worth knowing. Always words, never colour alone.
export function Note({ tone = "info", children, className }) {
  const warn = tone === "warning" || tone === "danger";
  const Icon = warn ? AlertTriangle : Info;
  return (
    <p
      role={warn ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm text-foreground",
        tone === "danger" ? "border-status-danger/40 bg-status-danger-soft" : warn ? "border-status-warning/40 bg-status-warning-soft" : "border-status-info/30 bg-status-info-soft",
        className
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "danger" ? "text-status-danger" : warn ? "text-status-warning" : "text-status-info")} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

// Where a document came from or went. A quotation opens inside its own screen; an order and a delivery
// note are other pages, reached by their number.
export function DocLink({ kind, id, no, onOpenQuotation, children }) {
  const cls = "font-semibold underline underline-offset-2";
  if (kind === "quotation" && onOpenQuotation) return <button type="button" onClick={() => onOpenQuotation(id)} className={cls}>{children || no}</button>;
  if (kind === "delivery_note") return <Link to={`/delivery-notes?open=${id}`} className={cls}>{children || no}</Link>;
  if (kind === "sales_order") return <Link to={`/sales-order?search=${encodeURIComponent(no)}`} className={cls}>{children || no}</Link>;
  return <span className="font-semibold">{children || no}</span>;
}

// Who did what, newest first: the document's own activity log.
const ACTION_TONE = { DELETED: "danger", CANCELLED: "neutral", REJECTED: "danger", DELIVERED: "success", ACCEPTED: "success", INVOICED: "info", CONVERTED: "info" };
export function ActivityList({ rows, empty = "Nothing has happened to this document yet." }) {
  if (!rows?.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const verb = String(r.action || "").split("_").pop();
        return (
          <li key={r._id} className="flex flex-col gap-0.5 border-s-2 border-border ps-3 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="text-xs tabular-nums text-muted-foreground sm:w-40 sm:shrink-0">{formatDateTime(r.at)}</span>
            <span className="min-w-0 text-sm text-foreground">
              <Pill tone={ACTION_TONE[verb] || "neutral"} className="me-2 align-middle">{verb.charAt(0) + verb.slice(1).toLowerCase()}</Pill>
              {r.summary}
              {r.username && <span className="text-muted-foreground"> · {r.username}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// A dialog that asks for a little and does one thing. The server's refusal is shown in the dialog,
// in the server's own words, and the dialog stays open so nothing typed is lost.
export function ActionModal({ title, description, confirmLabel, danger = false, busy = false, disabled = false, problem, size = "sm", onClose, onConfirm, children }) {
  return (
    <Modal
      size={size}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "destructive" : "default"} onClick={onConfirm} disabled={busy || disabled}>{busy ? "Working…" : confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote error={problem} />
        {children}
      </div>
    </Modal>
  );
}
