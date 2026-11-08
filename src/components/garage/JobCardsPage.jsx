import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Spinner, useAsync, useToasts } from "../accounting/kit.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import Can from "../shell/Can.jsx";
import { jobCards } from "../../lib/garageApi";
import { JOB_STATUS, INVOICE_STATUS_LABEL, JOB_TYPES, JOB_TYPE_LABEL, AGE_BAND_LABEL, AGE_BAND_TONE } from "../../lib/garage";
import { formatDate } from "../../utils/format";
import { useRecordRoute } from "../../lib/useRecordRoute";
import JobCardForm from "./JobCardForm";
import JobCardView from "./JobCardView";

// Inventory > Garage > Job cards: every live and finished job, searchable by number, plate or customer, filtered
// by status. The board (GarageBoard.jsx) is where a job is worked day to day; this is the full register.
//
// What is open lives in the URL (?open=<id>), not component state - useRecordRoute, the same hook every
// other document screen uses: opening a card pushes history (Back returns to the list), it survives a
// reload, and it can be linked to. The list's own useAsync sits ABOVE the early return for the card view,
// so it keeps its data while a card is open and the list reappears with no spinner when one is closed
// (the CrmPipeline precedent). ONE useToasts() lives here and is handed to JobCardView as `notify` -
// GoodsReceivedPage.jsx is the house precedent for that: a second toast system owned by the detail view
// would also mean its own "{toastNode}" unmounting the instant this page swaps views, which is exactly
// the bug a naive `if (route.recordId) return <JobCardView .../>` would have reintroduced.
const STATUS_OPTIONS = Object.keys(JOB_STATUS).map((k) => [k, JOB_STATUS[k].label]);
const JOB_TYPE_OPTIONS = JOB_TYPES.map((k) => [k, JOB_TYPE_LABEL[k]]);
const AGE_BAND_OPTIONS = Object.keys(AGE_BAND_LABEL).map((k) => [k, AGE_BAND_LABEL[k]]);

export default function JobCardsPage() {
  const route = useRecordRoute();
  const { notify, toastNode } = useToasts();
  const [status, setStatus] = useState("");
  const [jobType, setJobType] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  // A list of dated documents, so the house period control applies (CLAUDE.md "What a list remembers" /
  // ListPage.jsx's own header comment: a period control is exactly the case ListPage does not cover, so
  // this stays on FilterBar + DataTable directly rather than useListView, which no screen in the product
  // combines with a period).
  const periodFilter = usePeriodFilter();
  const { period } = periodFilter;
  const list = useAsync(
    () =>
      jobCards.list({
        status: status || undefined,
        jobType: jobType || undefined,
        ageBand: ageBand || undefined,
        search: search || undefined,
        from: period.from || undefined,
        to: period.to || undefined,
      }),
    [status, jobType, ageBand, search, period.key]
  );
  const rows = useMemo(() => (Array.isArray(list.data) ? list.data : []), [list.data]);
  const filtersOn = Boolean(status || jobType || ageBand || search);

  const columns = [
    {
      key: "jobNo",
      header: "Job card",
      card: "primary",
      cell: (r) => <span className="whitespace-nowrap font-medium">{r.jobNo || "(draft)"}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      card: "title",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.vehicle?.plateNumber || r.vehicle?.chassisNo || "–"}</p>
          <p className="truncate text-xs text-muted-foreground">{[r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(" ")}</p>
        </div>
      ),
    },
    { key: "customer", header: "Customer", card: "meta", cell: (r) => r.customer?.name || "–" },
    { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={JOB_STATUS[r.status]?.tone || "neutral"}>{JOB_STATUS[r.status]?.label || r.status}</Pill> },
    { key: "invoice", header: "Invoicing", card: "meta", cell: (r) => INVOICE_STATUS_LABEL[r.invoiceStatus] || r.invoiceStatus },
    {
      key: "received",
      header: "Received",
      card: "meta",
      cell: (r) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>{r.receivedAt ? formatDate(r.receivedAt) : "–"}</span>
          {r.ageBand && <Pill tone={AGE_BAND_TONE[r.ageBand] || "neutral"}>{AGE_BAND_LABEL[r.ageBand]}</Pill>}
        </div>
      ),
    },
    { key: "promised", header: "Promised", card: "meta", cell: (r) => (r.promisedAt ? formatDate(r.promisedAt) : "–") },
    { key: "total", header: "Estimate", align: "end", card: "amount", cell: (r) => (r.estimate?.total ? r.estimate.total.toFixed(2) : "–") },
  ];

  if (route.recordId) {
    return (
      <>
        <JobCardView
          id={route.recordId}
          notify={notify}
          onClose={() => route.close()}
          onChanged={() => list.reload()}
          onRemoved={() => { route.close(); list.reload(); }}
        />
        {toastNode}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Job cards"
        description="Every vehicle checked in, from complaint to invoice. Opened and worked day to day on the Board."
        actions={
          <Can permission="garage.create">
            <button
              type="button"
              data-shortcut="new"
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> New job card
            </button>
          </Can>
        }
      />

      <div className="mt-6">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Search a job number, plate or customer…"
          searchLabel="Search job cards"
          active={filtersOn}
          onClear={() => { setStatus(""); setJobType(""); setAgeBand(""); setSearch(""); }}
        >
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
          <FilterSelect label="Job type" value={jobType} onChange={setJobType} options={JOB_TYPE_OPTIONS} allLabel="Any job type" />
          <FilterSelect label="Age in workshop" value={ageBand} onChange={setAgeBand} options={AGE_BAND_OPTIONS} allLabel="Any age" />
          <PeriodSelect filter={periodFilter} labelled />
        </FilterBar>
        <PeriodNote filter={periodFilter} count={list.data ? rows.length : null} noun="job cards" one="job card" extra={filtersOn ? "filtered" : undefined} className="mt-3" />
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        {list.loading && !list.data && <Spinner label="Reading the job cards" />}
        {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && (
          <EmptyState
            title={filtersOn ? "Nothing matches" : period.all ? "No job cards yet" : `No job cards received in ${period.label.toLowerCase()}`}
            text={filtersOn ? "Clear the filters to see the rest." : period.all ? "Check a vehicle in and it appears here." : "Widen the period, or check a vehicle in."}
          />
        )}
        {list.data && rows.length > 0 && (
          <DataTable className="table-pin-first" caption="Job cards" rows={rows} rowKey={(r) => r._id} onRowClick={(r) => route.open(r._id)} columns={columns} />
        )}
      </Panel>

      {creating && (
        <JobCardForm
          onClose={() => setCreating(false)}
          onSaved={(c, message) => { setCreating(false); notify(message); list.reload(); route.open(c._id); }}
        />
      )}
      {toastNode}
    </div>
  );
}
