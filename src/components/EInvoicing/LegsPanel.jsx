import React from "react";
import { Ring } from "../crm/CrmCharts";
import { STATUS, STATUS_COLOR } from "./shared";
import { BentoCard, Journey } from "./dashParts";

// What state the period's invoices are in (a ring), and the two journeys each one makes - delivery to the buyer and the report to
// the tax authority (FTA) - as two meters. Wafeq's own advice is to show those two apart: one can succeed while the other fails.
// Every part is named with its count, so colour is never the only cue.
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

export function StatusMix({ pipeline }) {
  const counts = { ...pipeline.byStatus, NOT_SENT: pipeline.notSent || 0 };
  const mix = STATUS_ORDER.map((k) => ({ key: k, name: STATUS[k]?.label || k, color: STATUS_COLOR[k], value: counts[k] || 0 }));
  const total = mix.reduce((t, x) => t + x.value, 0);
  return (
    <BentoCard title="Status mix" description="Every invoice and credit note dated in the period." className="h-full">
      {total > 0 ? <Ring rows={mix} total={total} label="documents" format={count} /> : <p className="py-10 text-center text-sm text-muted-foreground">Nothing dated in this period.</p>}
    </BentoCard>
  );
}

export default function JourneysPanel({ pipeline, sandbox }) {
  return (
    <BentoCard title="Delivery and reporting" description="The two journeys of every invoice sent, read apart." className="h-full">
      <div className="space-y-6">
        <div role="group" aria-label="Buyer delivery">
          <Journey title="Buyer delivery" rate={pipeline.deliveredRate} rateWord="delivered" parts={rows(DELIVERY, pipeline.delivery)} />
        </div>
        <div role="group" aria-label="Tax authority (FTA)">
          <Journey title="Tax authority (FTA)" rate={sandbox ? null : pipeline.reportedRate} rateWord="reported" rateNote={sandbox ? "not reported in test mode" : undefined} parts={rows(FTA, pipeline.fta)}
            note={sandbox ? "Test mode: Wafeq's sandbox never reports to the tax authority, so sent invoices stop at Delivered. This is expected." : undefined} />
        </div>
      </div>
    </BentoCard>
  );
}
