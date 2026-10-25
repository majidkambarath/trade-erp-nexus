import React, { useMemo, useState } from "react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Spinner, useAsync } from "../accounting/kit.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import { jobCards } from "../../lib/garageApi";
import { JOB_STATUS, INVOICE_STATUS_LABEL } from "../../lib/garage";
import { formatDate } from "../../utils/format";

// Inventory > Garage > Job cards: every live and finished job, searchable by number, plate or customer, filtered
// by status. Opening a card (the detail view, with check-in, the estimate, tasks and the invoice) is not built
// yet in this first pass - the board (GarageBoard.jsx) is where a job is actually worked day to day.
const STATUS_OPTIONS = Object.keys(JOB_STATUS).map((k) => [k, JOB_STATUS[k].label]);

export default function JobCardsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const list = useAsync(() => jobCards.list({ status: status || undefined, search: search || undefined }), [status, search]);
  const rows = useMemo(() => (Array.isArray(list.data) ? list.data : []), [list.data]);
  const filtersOn = Boolean(status || search);

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
    { key: "received", header: "Received", card: "meta", cell: (r) => (r.receivedAt ? formatDate(r.receivedAt) : "–") },
    { key: "promised", header: "Promised", card: "meta", cell: (r) => (r.promisedAt ? formatDate(r.promisedAt) : "–") },
    { key: "total", header: "Estimate", align: "end", card: "amount", cell: (r) => (r.estimate?.total ? r.estimate.total.toFixed(2) : "–") },
  ];

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Job cards" description="Every vehicle checked in, from complaint to invoice. Opened and worked day to day on the Board." />

      <div className="mt-6">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Search a job number, plate or customer…"
          searchLabel="Search job cards"
          active={filtersOn}
          onClear={() => { setStatus(""); setSearch(""); }}
        >
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        </FilterBar>
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        {list.loading && !list.data && <Spinner label="Reading the job cards" />}
        {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && (
          <EmptyState
            title={filtersOn ? "Nothing matches" : "No job cards yet"}
            text={filtersOn ? "Clear the filters to see the rest." : "A vehicle checked in on the Board becomes a job card, and appears here."}
          />
        )}
        {list.data && rows.length > 0 && (
          <DataTable className="table-pin-first" caption="Job cards" rows={rows} rowKey={(r) => r._id} columns={columns} />
        )}
      </Panel>
    </div>
  );
}
