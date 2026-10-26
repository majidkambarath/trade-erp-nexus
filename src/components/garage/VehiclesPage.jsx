// Vehicles: the organisation's own master of every car it has ever worked on, like Customers or Vendors - a
// vehicle's service history is the reason a workshop buys this, and it has to outlive any one owner. On the
// list platform (ListPage + useListView) for the same reason ContactsPage.jsx is: a master list earns saved
// views and sorting. Opening a row opens its service history (VehicleView.jsx); Edit is inside that.
import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Pill, useAsync, useToasts } from "../accounting/kit.jsx";
import ListPage from "../lists/ListPage";
import { FilterSelect } from "../lists/FilterBar.jsx";
import { useListView } from "../../lib/useListView";
import Can from "../shell/Can.jsx";
import { vehicles } from "../../lib/garageApi";
import { formatDate } from "../../utils/format";
import VehicleForm from "./VehicleForm";
import VehicleView from "./VehicleView";

export default function VehiclesPage() {
  const { notify, toastNode } = useToasts();
  const list = useListView("garage-vehicles", { filters: { status: "" } });
  const query = useMemo(() => ({ search: list.search, status: list.filters.status, limit: 300 }), [list.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error, reload } = useAsync(() => vehicles.list(query), [query]);
  const rows = data || [];
  const [editing, setEditing] = useState(null); // null closed, {} new vehicle
  const [viewing, setViewing] = useState(null); // an existing vehicle's id - its service history

  return (
    <>
      <ListPage
        title="Vehicles"
        description="Every car this workshop has worked on. Found again by its plate or chassis, however it is typed."
        actions={
          <Can permission="garage.create">
            <button
              type="button"
              data-shortcut="new"
              onClick={() => setEditing({})}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> New vehicle
            </button>
          </Can>
        }
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
        onRowClick={(r) => setViewing(r._id)}
        loading={loading}
        loadingLabel="Reading the vehicles"
        error={error}
        onRetry={reload}
        emptyTitle="No vehicles yet"
        emptyText="Add the first car this workshop has worked on."
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
      {editing && (
        <VehicleForm
          vehicle={editing._id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(v, message) => { setEditing(null); notify(message); reload(); }}
        />
      )}
      {viewing && (
        <VehicleView
          id={viewing}
          onClose={() => setViewing(null)}
          onChanged={(message) => { notify(message); reload(); }}
        />
      )}
      {toastNode}
    </>
  );
}
