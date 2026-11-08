import React from "react";
import { EmptyState, ErrorNote, Panel, Pill, Spinner, useAsync } from "../accounting/kit.jsx";
import { claims } from "../../lib/garageApi";
import { CLAIM_AGE_BUCKET_LABEL, CLAIM_AGE_BUCKET_TONE } from "../../lib/garage";
import { formatCurrencyAED } from "../../utils/format";

// Garage > Claims > Ageing: every open claim (not yet decided, or decided but not invoiced), by how long
// it has been waiting - the register the QA report asked for (CLM-03) and the one thing this screen is
// for: an insurer that is taking too long to answer shows up here, with the money at stake, not merely
// how many claims exist. GET /garage/claims/ageing (InsuranceClaimService.ageing / utils/insuranceClaims.js
// claimAgeing) already returns {buckets, total, count} - this only draws it.
const BUCKET_ORDER = ["0-7", "8-14", "15-30", "30+"];

export default function ClaimsAgeing({ onOpen }) {
  const ageing = useAsync(() => claims.ageing(), []);

  if (ageing.loading && !ageing.data) return <Spinner label="Reading the claims ageing" />;
  if (ageing.error) return <ErrorNote error={ageing.error} onRetry={ageing.reload} />;
  const data = ageing.data || { buckets: {}, total: 0, count: 0 };

  if (!data.count) {
    return (
      <Panel>
        <EmptyState title="Nothing waiting" text="Every open claim is accounted for. A submitted or surveyed claim appears here while it waits on the insurer." />
      </Panel>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {data.count} open claim{data.count === 1 ? "" : "s"}, {formatCurrencyAED(data.total)} at stake across all of them.
      </p>
      {BUCKET_ORDER.map((key) => {
        const bucket = data.buckets[key] || { count: 0, total: 0, rows: [] };
        if (bucket.count === 0) return null;
        return (
          <Panel
            key={key}
            title={CLAIM_AGE_BUCKET_LABEL[key]}
            description={`${bucket.count} claim${bucket.count === 1 ? "" : "s"} · ${formatCurrencyAED(bucket.total)}`}
          >
            <ul className="divide-y rounded-lg border text-sm">
              {bucket.rows.map((r) => (
                <li key={r.claimId}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.claimId)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-start hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{r.claimNo || "(draft)"}</span>
                      <span className="text-muted-foreground"> · {r.insurer || "–"}</span>
                      {r.jobNo && <span className="text-muted-foreground"> · {r.jobNo}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{formatCurrencyAED(r.amount)}</span>
                      <Pill tone={CLAIM_AGE_BUCKET_TONE[key]}>{r.days}d</Pill>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}
