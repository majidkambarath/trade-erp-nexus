import React from "react";
import { Panel } from "../accounting/kit";

// An e-invoice makes two journeys that succeed or fail separately: delivery to the buyer, and the report to the tax authority (FTA).
// Each is one bar cut into segments. Every segment is named in words with its count (colour never stands alone).
const DELIVERY = [
  { key: "delivered", label: "Delivered", bar: "bg-status-success" },
  { key: "inProgress", label: "In progress", bar: "bg-status-info" },
  { key: "ftaOnly", label: "Tax authority only", bar: "bg-muted-foreground" },
  { key: "failed", label: "Not reached", bar: "bg-status-warning" },
  { key: "rejected", label: "Rejected", bar: "bg-status-danger" },
];
const FTA = [
  { key: "reported", label: "Reported", bar: "bg-status-success" },
  { key: "reporting", label: "Being reported", bar: "bg-status-info" },
  { key: "notReported", label: "Not reported (test mode)", bar: "bg-muted-foreground" },
  { key: "withdrawn", label: "Withdrawn", bar: "bg-status-warning" },
  { key: "unresolved", label: "Unresolved", bar: "bg-status-warning" },
  { key: "rejected", label: "Rejected", bar: "bg-status-danger" },
];

function Bar({ title, parts, counts, note }) {
  const total = parts.reduce((t, p) => t + (counts[p.key] || 0), 0);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{total} {total === 1 ? "invoice" : "invoices"}</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${title}: ${parts.filter((p) => counts[p.key]).map((p) => `${counts[p.key]} ${p.label.toLowerCase()}`).join(", ") || "nothing yet"}`}>
        {total > 0 && parts.filter((p) => counts[p.key]).map((p) => <span key={p.key} className={p.bar} style={{ width: `${(counts[p.key] / total) * 100}%` }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.filter((p) => counts[p.key]).map((p) => (
          <li key={p.key} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${p.bar}`} aria-hidden="true" /><span className="text-muted-foreground">{p.label}</span><span className="font-semibold tabular-nums">{counts[p.key]}</span></li>
        ))}
        {total === 0 && <li className="text-muted-foreground">Nothing sent in this period.</li>}
      </ul>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function LegsPanel({ pipeline, sandbox }) {
  return (
    <Panel title="Where the invoices are" description="Delivery to the buyer and the report to the tax authority are separate journeys.">
      <div className="space-y-6">
        <Bar title="Buyer delivery" parts={DELIVERY} counts={pipeline.delivery} />
        <Bar title="Tax authority (FTA)" parts={FTA} counts={pipeline.fta}
          note={sandbox ? "Test mode: Wafeq's sandbox never reports to the tax authority, so sent invoices stop at Delivered. This is expected." : undefined} />
      </div>
    </Panel>
  );
}
