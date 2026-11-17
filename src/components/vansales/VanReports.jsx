import React, { useState } from "react";
import { DataTable, DateInput, EmptyState, ErrorNote, Field, PageHeader, Panel, Spinner, useAsync } from "../accounting/kit.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import { reports } from "../../lib/vanSalesApi";
import { vanErrorText } from "../../lib/vanSales";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { StatusPill, Tile } from "./vanShared";

// Van sales > Reports: what the vans did over a period - sales, returns, money taken and how each day settled - one
// row per trip, and rolled up by van and by salesman. Read from the documents themselves.
const money = (r) => formatCurrencyAED(r || 0);

export default function VanReports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState("trips");
  const data = useAsync(() => reports.summary({ from: from || undefined, to: to || undefined }), [from, to]);
  const d = data.data;

  const rollCols = (label) => [
    { key: "name", header: label, card: "primary", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "trips", header: "Trips", align: "end", card: "meta", cell: (r) => r.trips },
    { key: "sales", header: "Sales", align: "end", card: "amount", cell: (r) => money(r.sales) },
    { key: "returned", header: "Returned", align: "end", card: "meta", cell: (r) => money(r.returned) },
    { key: "cash", header: "Cash", align: "end", card: "meta", cell: (r) => money(r.cash) },
    { key: "cheques", header: "Cheques", align: "end", card: "meta", cell: (r) => money(r.cheques) },
    { key: "var", header: "Cash difference", align: "end", card: "meta", cell: (r) => <span className={r.cashVariance < 0 ? "text-red-600" : ""}>{money(r.cashVariance)}</span> },
  ];
  const tripCols = [
    { key: "no", header: "Trip", card: "primary", cell: (r) => <span className="whitespace-nowrap font-medium">{r.tripNo}</span> },
    { key: "van", header: "Van", card: "title", cell: (r) => r.vanCode },
    { key: "salesman", header: "Salesman", card: "meta", cell: (r) => r.salesmanName },
    { key: "date", header: "Date", card: "meta", cell: (r) => formatDate(r.date) },
    { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill status={r.status} /> },
    { key: "sales", header: "Sales", align: "end", card: "amount", cell: (r) => money(r.sales) },
    { key: "cash", header: "Cash", align: "end", card: "meta", cell: (r) => money(r.cash) },
    { key: "var", header: "Cash difference", align: "end", card: "meta", cell: (r) => (r.cashVariance == null ? "–" : <span className={r.cashVariance < 0 ? "text-red-600" : ""}>{money(r.cashVariance)}</span>) },
  ];

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Reports" description="What the vans sold and took over a period, and how each day settled." />
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Field label="From"><DateInput value={from || d?.from || ""} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><DateInput value={to || d?.to || ""} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {data.loading && !d && <Spinner label="Reading the report" />}
      {data.error && <ErrorNote error={new Error(vanErrorText(data.error))} onRetry={data.reload} />}
      {d && (
        <div className="mt-4 grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Sales" value={money(d.total.sales)} sub={`${d.total.invoices} invoices on ${d.total.trips} trips`} />
            <Tile label="Cash taken" value={money(d.total.cash)} />
            <Tile label="Cheques" value={money(d.total.cheques)} />
            <Tile label="Cash difference" value={money(d.total.cashVariance)} />
          </div>
          <PillTabs label="Report view" tabs={[["trips", "Trips"], ["vans", "By van"], ["salesmen", "By salesman"]]} value={view} onChange={setView} />
          <Panel bodyClassName="p-0">
            {d.rows.length === 0 && <EmptyState title="No trips in this period" text="Widen the dates, or send a van out." />}
            {d.rows.length > 0 && view === "trips" && <DataTable caption="Van trips" rows={d.rows} rowKey={(r) => r.id} columns={tripCols} />}
            {d.rows.length > 0 && view === "vans" && <DataTable caption="Sales by van" rows={d.byVan} rowKey={(r) => r.id} columns={rollCols("Van")} />}
            {d.rows.length > 0 && view === "salesmen" && <DataTable caption="Sales by salesman" rows={d.bySalesman} rowKey={(r) => r.id} columns={rollCols("Salesman")} />}
          </Panel>
        </div>
      )}
    </div>
  );
}
