import React from "react";
import { Ring } from "../crm/CrmCharts";
import { Panel } from "../accounting/kit";
import { STATUS, STATUS_COLOR } from "./shared";

// Three rings, read together: what state the period's invoices are in, and the two journeys each one makes - delivery to the
// buyer and the report to the tax authority (FTA). Wafeq's own advice is to show those two apart: one can succeed while the
// other fails. Every slice is named in the legend with its count and share, so colour is never the only cue.
const S = {
  success: "var(--color-status-success)", info: "var(--color-status-info)", warning: "var(--color-status-warning)",
  danger: "var(--color-status-danger)", muted: "var(--color-muted-foreground)", quiet: "var(--chart-4)",
};
const DELIVERY = [
  { key: "delivered", name: "Delivered", color: S.success },
  { key: "inProgress", name: "In progress", color: S.info },
  { key: "ftaOnly", name: "Tax authority only", color: S.quiet },
  { key: "failed", name: "Not reached", color: S.warning },
  { key: "rejected", name: "Rejected", color: S.danger },
];
const FTA = [
  { key: "reported", name: "Reported", color: S.success },
  { key: "reporting", name: "Being reported", color: S.info },
  { key: "notReported", name: "Not reported (test mode)", color: S.muted },
  { key: "withdrawn", name: "Withdrawn", color: S.quiet },
  { key: "unresolved", name: "Unresolved", color: S.warning },
  { key: "rejected", name: "Rejected", color: S.danger },
];
const STATUS_ORDER = ["NOT_SENT", "QUEUED", "SUBMITTED", "ACKNOWLEDGED", "REPORTED", "FAILED", "REJECTED"];

const count = (v) => String(Math.round(v));
const rows = (parts, counts) => parts.map((p) => ({ ...p, value: counts?.[p.key] || 0 }));
const sum = (r) => r.reduce((t, x) => t + x.value, 0);

function RingPanel({ title, description, data, label, empty, note }) {
  const total = sum(data);
  return (
    <Panel title={title} description={description} className="h-full">
      <div data-chart={title}>
        {total > 0 ? <Ring rows={data} total={total} label={label} format={count} /> : <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>}
      </div>
      {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
    </Panel>
  );
}

export default function JourneyRings({ pipeline, sandbox }) {
  const statusCounts = { ...pipeline.byStatus, NOT_SENT: pipeline.notSent || 0 };
  const mix = STATUS_ORDER.map((k) => ({ key: k, name: STATUS[k]?.label || k, color: STATUS_COLOR[k], value: statusCounts[k] || 0 }));
  const delivery = rows(DELIVERY, pipeline.delivery);
  const fta = rows(FTA, pipeline.fta);
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      <div data-reveal><RingPanel title="Status mix" description="Every invoice and credit note dated in the period." data={mix} label="documents" empty="Nothing dated in this period." /></div>
      <div data-reveal>
        <RingPanel title="Buyer delivery" description="Did it reach the buyer's provider?" data={delivery}
          label={pipeline.deliveredRate == null ? "sent" : `sent · ${pipeline.deliveredRate}% delivered`} empty="Nothing sent in this period." />
      </div>
      <div data-reveal>
        <RingPanel title="Tax authority (FTA)" description="Did the tax authority accept the report?" data={fta}
          label={sandbox ? "sent · test mode" : pipeline.reportedRate == null ? "sent" : `sent · ${pipeline.reportedRate}% reported`} empty="Nothing sent in this period."
          note={sandbox ? "Test mode: Wafeq's sandbox never reports to the tax authority, so sent invoices stop at Delivered. This is expected." : undefined} />
      </div>
    </div>
  );
}
