import React, { useMemo, useState } from "react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { claims } from "../../lib/garageApi";
import { CLAIM_STATUS } from "../../lib/garage";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import ClaimView from "./ClaimView";
import ClaimsAgeing from "./ClaimsAgeing";

// Inventory > Garage > Claims: every insurance claim, from the first submission through the insurer's
// decision to the invoices it raises. A claim is opened from its own job card (JobCardView.jsx) - this is
// the register for tracking what is waiting on an insurer and what has been settled.
//
// Two tabs, one shared ClaimView: "Claims" is the full register (filterable, every status, and - like any
// list of dated documents - a period, by submittedAt, the same date Ageing's own buckets count from),
// "Ageing" is only what is still open, grouped by how long it has waited (the register the 30 Oct QA
// report asked for and nothing built until now - claims.ageing() has had no caller since the route
// shipped) - it has no period of its own, since it is "what is open right now", not a dated range. Both
// tabs open the same modal, so a claim found either way behaves identically.
//
// No separate insurer filter: the search box already matches insurer.name server-side (insuranceClaimService.js
// list()), so a dropdown beside it would be a second control for the one thing the first already does.
const STATUS_OPTIONS = Object.keys(CLAIM_STATUS).map((k) => [k, CLAIM_STATUS[k].label]);

export default function ClaimsPage() {
  const { notify, toastNode } = useToasts();
  const [tab, setTab] = useState("list");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);
  const periodFilter = usePeriodFilter();
  const { period } = periodFilter;
  const list = useAsync(
    () => claims.list({ status: status || undefined, search: search || undefined, from: period.from || undefined, to: period.to || undefined }),
    [status, search, period.key]
  );
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

      <div className="mt-6"><PillTabs tabs={[["list", "Claims"], ["ageing", "Ageing"]]} value={tab} onChange={setTab} label="Claims view" /></div>

      {tab === "list" ? (
        <>
          <div className="mt-4">
            <FilterBar
              search={search}
              onSearch={setSearch}
              placeholder="Search a claim number, policy or insurer…"
              searchLabel="Search claims"
              active={filtersOn}
              onClear={() => { setStatus(""); setSearch(""); }}
            >
              <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
              <PeriodSelect filter={periodFilter} labelled />
            </FilterBar>
            <PeriodNote filter={periodFilter} count={list.data ? rows.length : null} noun="claims" one="claim" extra={filtersOn ? "filtered" : undefined} className="mt-3" />
          </div>

          <Panel className="mt-4" bodyClassName="p-0">
            {list.loading && !list.data && <Spinner label="Reading the claims" />}
            {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
            {list.data && rows.length === 0 && (
              <EmptyState
                title={filtersOn ? "Nothing matches" : period.all ? "No claims yet" : `No claims submitted in ${period.label.toLowerCase()}`}
                text={filtersOn ? "Clear the filters to see the rest." : period.all ? "Open a claim from an insurance job card, and it appears here." : "Widen the period, or open a claim from an insurance job card."}
              />
            )}
            {list.data && rows.length > 0 && (
              <DataTable className="table-pin-first" caption="Claims" rows={rows} rowKey={(r) => r._id} onRowClick={(r) => setOpen(r._id)} columns={columns} />
            )}
          </Panel>
        </>
      ) : (
        <div className="mt-4"><ClaimsAgeing onOpen={setOpen} /></div>
      )}

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
