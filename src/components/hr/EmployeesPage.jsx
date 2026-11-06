// Employees (HRMS > People): the organisation's own directory, grown from the older Staff screen
// (/staff-records, still there and untouched) into the record labour costing reads. On the list platform
// (ListPage + useListView), like Vehicles and Contacts. Opening a row opens the employee's own page
// (EmployeeView.jsx), where their contracts and cost rate live; Edit of the record itself is from here.
import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Pill, useAsync, useToasts } from "../accounting/kit.jsx";
import ListPage from "../lists/ListPage";
import { FilterSelect } from "../lists/FilterBar.jsx";
import { useListView } from "../../lib/useListView";
import Can from "../shell/Can.jsx";
import { employees } from "../../lib/hrApi";
import { formatDate } from "../../utils/format";
import EmployeeForm from "./EmployeeForm";
import { useNavigate } from "react-router-dom";

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { notify, toastNode } = useToasts();
  const list = useListView("hr-people", { filters: { status: "" } });
  const query = useMemo(() => ({ search: list.search, status: list.filters.status, limit: 500 }), [list.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error, reload } = useAsync(() => employees.list(query), [query]);
  const rows = data || [];
  const [editing, setEditing] = useState(null); // null closed, {} new employee

  return (
    <>
      <ListPage
        title="People"
        description="Everyone on the organisation's own payroll. Open a row for their cost rate and the labour it has fed into."
        actions={
          <Can permission="hr.manage">
            <button
              type="button"
              data-shortcut="new"
              onClick={() => setEditing({})}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> New employee
            </button>
          </Can>
        }
        list={list}
        noun="employees"
        searchLabel="Search employees"
        placeholder="Search a name, designation or employee code…"
        filterChildren={
          <FilterSelect
            label="Status"
            value={list.filters.status}
            onChange={(v) => list.setFilter("status", v)}
            allLabel="Any"
            options={[
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ]}
          />
        }
        caption="Employees"
        rows={rows}
        rowKey={(r) => r._id}
        onRowClick={(r) => navigate(`/hr/people/${r._id}`)}
        loading={loading}
        loadingLabel="Reading the employees"
        error={error}
        onRetry={reload}
        emptyTitle="No employees yet"
        emptyText="Add the first person on the organisation's own payroll."
        columns={[
          { key: "staffId", header: "Code", card: "meta", cell: (r) => <span className="whitespace-nowrap font-mono text-xs">{r.staffId}</span> },
          {
            key: "name",
            header: "Name",
            sortable: true,
            card: "primary",
            cell: (r) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.designation}{r.department ? ` · ${r.department}` : ""}</p>
              </div>
            ),
          },
          { key: "contactNo", header: "Contact", card: "meta", cell: (r) => r.contactNo || "–" },
          { key: "joiningDate", header: "Joined", sortable: true, card: "meta", cell: (r) => (r.joiningDate ? formatDate(r.joiningDate) : "–") },
          { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={r.status === "Inactive" ? "neutral" : "success"}>{r.status === "Inactive" ? "Inactive" : "Active"}</Pill> },
        ]}
      />
      {editing && (
        <EmployeeForm
          employee={editing._id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(e, message) => { setEditing(null); notify(message); reload(); }}
        />
      )}
      {toastNode}
    </>
  );
}
