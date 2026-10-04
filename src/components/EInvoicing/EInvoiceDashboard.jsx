import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileCheck2, Inbox, Percent, Send } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { formatNumber } from "../../utils/format";
import StatCard from "../ui/stat-card";
import { EmptyState, ErrorNote, Panel, Spinner, formatDateTime, useAsync } from "../accounting/kit";
import { StatusPill } from "./shared";
import MandateTimeline from "./MandateTimeline";

export default function EInvoiceDashboard({ settings }) {
  const { data, loading, error, reload } = useAsync(() => einvoice.dashboard(), []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const o = data.outbound;
  const inboundWaiting = data.inbound.RECEIVED || 0;

  return (
    <div className="space-y-5">
      {!settings?.enabled && (
        <div role="note" className="flex flex-wrap items-center gap-3 rounded-2xl border border-status-warning/25 bg-status-warning-soft px-5 py-3 text-sm text-status-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">E-invoicing is switched off, so nothing can be sent yet.</span>
          <Link to="/e-invoicing?tab=readiness" className="font-semibold underline underline-offset-2">Check readiness</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Invoices sent" count={o.total} subText={`AED ${formatNumber(o.payable, 2)} payable`} tone="teal" icon={<Send />} />
        <StatCard title="Reported to FTA" count={o.byStatus.REPORTED || 0} subText={o.successRate == null ? "none yet" : `${o.successRate}% of those attempted`} tone="olive" icon={<CheckCircle2 />} />
        <StatCard title="Need attention" count={o.needsAttention} subText="failed or rejected" tone={o.needsAttention ? "danger" : "neutral"} icon={<AlertTriangle />} />
        <StatCard title="Received to review" count={inboundWaiting} subText="supplier invoices" tone={inboundWaiting ? "warning" : "neutral"} icon={<Inbox />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Panel title="Recent activity" bodyClassName="p-0">
          {data.recent.length === 0 && <EmptyState title="Nothing sent yet" text="Send an approved sales invoice from the Outbound tab." />}
          <ul className="divide-y divide-border">
            {data.recent.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-mono text-xs font-semibold">{r.documentNo}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.buyerName}</span>
                <StatusPill status={r.status} />
                <span className="text-xs text-muted-foreground">{formatDateTime(r.updatedAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Tax on invoices sent">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Net</dt><dd className="text-end tabular-nums">{formatNumber(o.net, 2)}</dd>
            <dt className="text-muted-foreground">VAT</dt><dd className="text-end tabular-nums">{formatNumber(o.tax, 2)}</dd>
            <dt className="font-semibold">Payable</dt><dd className="text-end font-semibold tabular-nums">{formatNumber(o.payable, 2)}</dd>
          </dl>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />AED, invoices that were sent, delivered or reported.</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Percent className="h-3.5 w-3.5" aria-hidden="true" />Success rate counts reported invoices out of all attempted.</p>
        </Panel>
      </div>

      <MandateTimeline />
    </div>
  );
}
