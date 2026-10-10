import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, Eye } from "lucide-react";
import { Button } from "../ui/button";
import Can from "../shell/Can";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Spinner, useAsync, useToasts } from "../accounting/kit";
import { VoucherView } from "../finance/shared";
import { approvalQueue } from "../../lib/approvalsApi";
import { vouchers } from "../../lib/bankingApi";
import { FIRST_APPROVAL_MESSAGE } from "../../lib/approvals";
import { AWAITING_SECOND, ageText, approveKeyOf, approveRow, firstApprovalNote, stateText, stepText, whyNot } from "../../lib/approvalQueue";
import { formatDateGB, formatNumber } from "../../utils/format";

// What is waiting for a decision, from the point of view of the person looking: the orders and vouchers they could approve right
// now, then the ones that are waiting but are not theirs to approve, each with the reason. The server judges every row with the
// same rules as the approve routes (services/core/approvalQueueService.js), so this offers nothing that would be refused, and
// Approve here is the same call as on the document's own screen - a refusal shows the server's own sentence.

const DOCUMENT_TITLE = "Open the document in its list";

function RowName({ row }) {
  return (
    <>
      <span className="whitespace-nowrap font-mono text-xs font-semibold">{row.number}</span>
      <span className="block text-xs font-normal text-muted-foreground">{row.typeLabel}</span>
    </>
  );
}

const StateBadge = ({ row }) => (
  <span className="inline-flex flex-col items-end gap-0.5 md:items-start">
    <Pill tone={row.state === AWAITING_SECOND ? "warning" : "neutral"}>{stateText(row)}</Pill>
    {firstApprovalNote(row) && <span className="text-xs font-normal text-muted-foreground">{firstApprovalNote(row)}</span>}
    {stepText(row) && <span className="text-xs font-normal text-muted-foreground">{stepText(row)}</span>}
  </span>
);

// The columns both lists share. `card` places each on the phone's card (components/accounting/DataTable.jsx).
const shared = (extra = []) => [
  { key: "number", header: "Document", card: "primary", cell: (r) => <RowName row={r} /> },
  { key: "party", header: "For", card: "title", className: "font-medium", cell: (r) => r.party || r.narration || "-" },
  // who prepared it and its date share a column (a table of eight columns does not fit a tablet); on a card they read in one line
  {
    key: "prepared", header: "Prepared", card: "meta", className: "text-muted-foreground",
    cell: (r) => (
      <>
        <span>{r.preparedBy ? `By ${r.preparedBy}` : "-"}</span>
        <span aria-hidden="true" className="md:hidden"> · </span>
        <span className="whitespace-nowrap text-xs md:block">{formatDateGB(r.date)}</span>
      </>
    ),
  },
  { key: "age", header: "Waiting", card: "meta", className: "whitespace-nowrap", cell: (r) => ageText(r.ageDays) },
  { key: "amount", header: "Amount", align: "end", card: "amount", className: "whitespace-nowrap font-medium tabular-nums", cell: (r) => formatNumber(r.amount, 2) },
  { key: "state", header: "Status", card: "badge", cell: (r) => <StateBadge row={r} /> },
  ...extra,
];

export default function ApprovalsPage() {
  const { data, loading, error, reload } = useAsync(() => approvalQueue.waiting(), []);
  const { notify, toastNode } = useToasts();
  const [busy, setBusy] = useState(null); // the id being approved
  const [viewing, setViewing] = useState(null); // the voucher whose screen is open

  async function approve(row) {
    setBusy(row.id);
    const result = await approveRow(row, { vouchers });
    setBusy(null);
    if (result.outcome === "approved") notify(`${row.number} approved.`);
    else if (result.outcome === "waiting") notify(FIRST_APPROVAL_MESSAGE);
    else if (result.outcome === "cancelled") notify(`${row.number} was left as it was.`);
    else notify(result.reason || "It could not be approved.", "error");
    reload();
  }

  const open = (r) =>
    r.kind === "voucher" ? (
      <Button variant="outline" size="sm" onClick={() => setViewing(r)} aria-label={`Open ${r.number}`}><Eye className="h-3.5 w-3.5" aria-hidden="true" />Open</Button>
    ) : (
      <Button asChild variant="outline" size="sm">
        <Link to={r.link || "/"} title={DOCUMENT_TITLE} aria-label={`Open ${r.number}`}><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />Open</Link>
      </Button>
    );

  const mine = shared([
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", className: "whitespace-nowrap",
      cell: (r) => (
        <span className="flex flex-wrap justify-end gap-2">
          {open(r)}
          <Can permission={approveKeyOf(r)}>
            <Button size="sm" disabled={busy === r.id} onClick={() => approve(r)} aria-label={`Approve ${r.number}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />{busy === r.id ? "Approving…" : "Approve"}</Button>
          </Can>
        </span>
      ),
    },
  ]);
  const notMine = shared([
    { key: "why", header: "Why not you", label: "Why not you", className: "max-w-xs text-sm text-muted-foreground", cell: (r) => whyNot(r) },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "end", card: "actions", className: "whitespace-nowrap", cell: (r) => <span className="flex flex-wrap justify-end gap-2">{open(r)}</span> },
  ]);

  const forYou = data?.forYou || [];
  const others = data?.others || [];
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Approvals" description="Orders and vouchers waiting for a decision. The oldest are first." />
      {loading && !data && <Spinner label="Loading approvals" />}
      {error && <ErrorNote error={error} onRetry={reload} />}
      {data && (
        <>
          {data.capped && <p role="status" className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">More is waiting than is listed here: these are the oldest. Deciding them brings the rest up.</p>}
          <Panel
            title={`Waiting for you (${data.counts?.forYou ?? forYou.length})`}
            description="You hold the right to approve these, and the amount, who prepared them and who has approved them all allow you to."
            bodyClassName="p-0"
          >
            {forYou.length === 0 ? (
              <EmptyState title="Nothing is waiting for you" text="When an order or a voucher needs your approval it appears here." />
            ) : (
              <DataTable caption="Waiting for your approval" className="table-pin-first" rows={forYou} rowKey={(r) => `${r.kind}-${r.id}`} columns={mine} />
            )}
          </Panel>
          {others.length > 0 && (
            <Panel
              title={`Waiting, but not for you (${data.counts?.others ?? others.length})`}
              description="Each of these is waiting for someone else, and the last column says why."
              bodyClassName="p-0"
            >
              <DataTable caption="Waiting for someone else" className="table-pin-first" rows={others} rowKey={(r) => `${r.kind}-${r.id}`} columns={notMine} />
            </Panel>
          )}
        </>
      )}
      {viewing && <VoucherView id={viewing.id} title={viewing.typeLabel} onClose={() => setViewing(null)} onChanged={reload} onDeleted={() => { setViewing(null); reload(); }} />}
      {toastNode}
    </div>
  );
}
