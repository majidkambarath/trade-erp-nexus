import React from "react";
import { EmptyState, ErrorNote, Panel, Pill, Spinner, useAsync } from "../accounting/kit.jsx";
import { RankedBars } from "../Dashborad/FlowCharts";
import { claims } from "../../lib/garageApi";
import { CLAIM_AGE_BUCKET_COLOR, CLAIM_AGE_BUCKET_LABEL, CLAIM_AGE_BUCKET_TONE } from "../../lib/garage";
import { formatCurrencyAED, formatCurrencyCompact } from "../../utils/format";

// Garage > Claims > Ageing: every open claim (not yet decided, or decided but not invoiced), by how long
// it has been waiting - the register the QA report asked for (CLM-03) and the one thing this screen is
// for: an insurer that is taking too long to answer shows up here, with the money at stake, not merely
// how many claims exist. GET /garage/claims/ageing (InsuranceClaimService.ageing / utils/insuranceClaims.js
// claimAgeing) already returns {buckets, total, count} - this only draws it.
//
// It used to draw a PANEL PER BUCKET, each wrapping its own list: four nested boxes that ate a screen to
// show four numbers, and left the one question this report exists to answer - where is the money stuck -
// to be worked out in the reader's head. Now the buckets are one chart (the comparison, at a glance) and
// the claims are one list (oldest first, because that is the one you ring about today).
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

  const buckets = BUCKET_ORDER.map((key) => ({ key, ...(data.buckets[key] || { count: 0, total: 0, rows: [] }) }));
  // Chronological, NOT largest-first: the shape of an ageing report across time is the point, and
  // re-ordering it by size would hide whether the money is drifting into the older buckets.
  const bars = buckets
    .filter((b) => b.count > 0)
    .map((b) => ({ key: b.key, name: CLAIM_AGE_BUCKET_LABEL[b.key], value: b.total, color: CLAIM_AGE_BUCKET_COLOR[b.key] }));
  // One list, oldest first. Each row still says which bucket it is in, so nothing is lost by dropping
  // the four separate panels that used to carry that in their headings.
  const rows = [...buckets].reverse().flatMap((b) => b.rows.map((r) => ({ ...r, bucket: b.key })));
  const worst = [...buckets].reverse().find((b) => b.count > 0);

  return (
    <div className="grid gap-4">
      <Panel
        title="Where the money is waiting"
        description={`${data.count} open claim${data.count === 1 ? "" : "s"}, ${formatCurrencyAED(data.total)} at stake across all of them.`}
      >
        <RankedBars
          rows={bars}
          height={Math.max(140, bars.length * 40 + 30)}
          valueText={formatCurrencyCompact}
          describe={(r) => {
            const b = buckets.find((x) => x.key === r.key);
            return `${b.count} claim${b.count === 1 ? "" : "s"} · ${formatCurrencyAED(b.total)} waiting ${CLAIM_AGE_BUCKET_LABEL[r.key].toLowerCase()}`;
          }}
        />
        {worst && worst.key !== "0-7" && (
          <p className="mt-2 text-sm text-muted-foreground">
            The oldest {formatCurrencyAED(worst.total)} has been waiting{" "}
            <span className="font-medium text-foreground">{CLAIM_AGE_BUCKET_LABEL[worst.key].toLowerCase()}</span>.
          </p>
        )}
      </Panel>

      <Panel title="Open claims" description="Oldest first - the one to ring about today is at the top." bodyClassName="p-0">
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.claimId}>
              <button
                type="button"
                onClick={() => onOpen(r.claimId)}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-start hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:min-h-0"
              >
                <span className="min-w-0">
                  <span className="font-medium">{r.claimNo || "(draft)"}</span>
                  <span className="text-muted-foreground"> · {r.insurer || "–"}</span>
                  {r.jobNo && <span className="text-muted-foreground"> · {r.jobNo}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums">{formatCurrencyAED(r.amount)}</span>
                  <Pill tone={CLAIM_AGE_BUCKET_TONE[r.bucket]}>{r.days}d</Pill>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
