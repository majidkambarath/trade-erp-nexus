// Vehicles: the organisation's own master of every car it has ever worked on, like Customers or Vendors - a
// vehicle's service history is the reason a workshop buys this, and it has to outlive any one owner. On the
// list platform (ListPage + useListView) for the same reason ContactsPage.jsx is: a master list earns saved
// views and sorting. Opening a vehicle (its service history) and adding one are not built yet in this first
// pass - the vehicle is created from the job card's own check-in screen, which is not built either.
import React, { useMemo } from "react";
import { Pill, useAsync } from "../accounting/kit.jsx";
import ListPage from "../lists/ListPage";
import { FilterSelect } from "../lists/FilterBar.jsx";
import { useListView } from "../../lib/useListView";
import { vehicles } from "../../lib/garageApi";
import { formatDate } from "../../utils/format";

export default function VehiclesPage() {
  const list = useListView("garage-vehicles", { filters: { status: "" } });
  const query = useMemo(() => ({ search: list.search, status: list.filters.status, limit: 300 }), [list.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error, reload } = useAsync(() => vehicles.list(query), [query]);
  const rows = data || [];

  return (
    <ListPage
      title="Vehicles"
      description="Every car this workshop has worked on. Found again by its plate or chassis, however it is typed."
      list={list}
      noun="vehicles"
      searchLabel="Search vehicles"
      placeholder="Search a plate, a chassis, a make or a model…"
      filterChildren={
        <FilterSelect
          label="Status"
          value={list.filters.status}
          onChange={(v) => list.setFilter("status", v)}
          allLabel="Any"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      }
      caption="Vehicles"
      rows={rows}
      rowKey={(r) => r._id}
      loading={loading}
      loadingLabel="Reading the vehicles"
      error={error}
      onRetry={reload}
      emptyTitle="No vehicles yet"
      emptyText="A vehicle is added when it is first checked in for a job."
      columns={[
        {
          key: "plateNumber",
          header: "Plate",
          sortable: true,
          card: "primary",
          cell: (r) => <span className="whitespace-nowrap font-medium">{r.plateNumber || r.chassisNo || "–"}</span>,
        },
        {
          key: "vehicle",
          header: "Vehicle",
          sortable: true,
          card: "title",
          cell: (r) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{[r.make, r.model, r.variant].filter(Boolean).join(" ")}</p>
              <p className="truncate text-xs text-muted-foreground">{[r.year, r.colour].filter(Boolean).join(" · ")}</p>
            </div>
          ),
        },
        { key: "chassisNo", header: "Chassis", card: "meta", cell: (r) => r.chassisNo || "" },
        { key: "odometer", header: "Odometer", align: "end", card: "meta", cell: (r) => (r.odometer ? `${r.odometer} km` : "–") },
        { key: "registration", header: "Registration expiry", card: "meta", cell: (r) => (r.registrationExpiry ? formatDate(r.registrationExpiry) : "–") },
        { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={r.status === "inactive" ? "neutral" : "success"}>{r.status === "inactive" ? "Inactive" : "Active"}</Pill> },
      ]}
    />
  );
}
