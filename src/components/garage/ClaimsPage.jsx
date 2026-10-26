import React, { useMemo, useState } from "react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import { claims } from "../../lib/garageApi";
import { CLAIM_STATUS } from "../../lib/garage";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import ClaimView from "./ClaimView";

// Inventory > Garage > Claims: every insurance claim, from the first submission through the insurer's
// decision to the invoices it raises. A claim is opened from its own job card (JobCardView.jsx) - this is
// the register for tracking what is waiting on an insurer and what has been settled.
const STATUS_OPTIONS = Object.keys(CLAIM_STATUS).map((k) => [k, CLAIM_STATUS[k].label]);

export default function ClaimsPage() {
  const { notify, toastNode } = useToasts();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);
  const list = useAsync(() => claims.list({ status: status || undefined, search: search || undefined }), [status, search]);
  const rows = useMemo(() => (Array.isArray(list.data) ? list.data : []), [list.data]);
  const filtersOn = Boolean(status || search);

  const columns = [
    { key: "claimNo", header: "Claim", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.claimNo || "(draft)"}</span> },
    { key: "insurer", header: "Insurer", card: "title", cell: (r) => <div className="min-w-0"><p className="truncate font-medium text-foreground">{r.insurer?.name || "–"}</p><p className="truncate text-xs text-muted-foreground">Policy {r.policyNo}</p></div> },
    { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={CLAIM_STATUS[r.status]?.tone || "neutral"}>{CLAIM_STATUS[r.status]?.label || r.status}</Pill> },
    { key: "accident", header: "Accident", card: "meta", cell: (r) => (r.accidentDate ? formatDate(r.accidentDate) : "–") },
    { key: "lpo", header: "LPO", card: "meta", cell: (r) => r.approval?.lpoNo || "–" },
    { key: "approved", header: "Approved", align: "end", card: "amount", cell: (r) => (r.approval?.approvedAmount ? formatCurrencyAED(r.approval.approvedAmount) : "–") },
  ];

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Claims" description="Every insurance claim, from submission to the invoices it raises. Opened from the job card it is for." />

      <div className="mt-6">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Search a claim number, policy or insurer…"
          searchLabel="Search claims"
          active={filtersOn}
          onClear={() => { setStatus(""); setSearch(""); }}
        >
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        </FilterBar>
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        {list.loading && !list.data && <Spinner label="Reading the claims" />}
        {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && (
          <EmptyState
            title={filtersOn ? "Nothing matches" : "No claims yet"}
            text={filtersOn ? "Clear the filters to see the rest." : "Open a claim from an insurance job card, and it appears here."}
          />
        )}
        {list.data && rows.length > 0 && (
          <DataTable className="table-pin-first" caption="Claims" rows={rows} rowKey={(r) => r._id} onRowClick={(r) => setOpen(r._id)} columns={columns} />
        )}
      </Panel>

      {open && (
        <ClaimView
          id={open}
          onClose={() => setOpen(null)}
          onChanged={(m) => { notify(m); list.reload(); }}
          onRemoved={(m) => { setOpen(null); notify(m); list.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
