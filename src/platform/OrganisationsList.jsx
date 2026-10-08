import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Select, Spinner, TextInput, useAsync } from "../components/accounting/kit";
import { formatDate } from "../utils/format";
import { platform } from "./platformApi";
import { stateLabel } from "./platformForms";

const STATUSES = [
  { value: "", label: "Every status" },
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "closed", label: "Closed" },
];

// Every organisation on the product, with where its subscription stands. A row opens the organisation.
export default function OrganisationsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useAsync(() => platform.organisations({ search: search.trim() || undefined, status: status || undefined, limit: 100 }), [search, status]);
  const rows = data?.rows || [];

  const columns = [
    {
      key: "name",
      header: "Organisation",
      card: "primary",
      cell: (o) => (
        <div className="min-w-0">
          <Link to={`/platform/organisations/${o.code}`} className="font-medium text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
            {o.legalName}
          </Link>
          <p className="text-xs text-muted-foreground">{o.code}</p>
        </div>
      ),
    },
    { key: "books", header: "Country / books", card: "meta", cell: (o) => `${o.country} · ${o.baseCurrency}` },
    { key: "plan", header: "Plan", card: "meta", cell: (o) => o.planCode },
    {
      key: "state",
      header: "State",
      card: "badge",
      cell: (o) => {
        const s = stateLabel(o.state);
        return <Pill tone={s.tone}>{s.text}</Pill>;
      },
    },
    { key: "ends", header: "Subscription ends", card: "meta", cell: (o) => (o.subscription?.endsAt ? formatDate(o.subscription.endsAt) : "Never") },
  ];

  return (
    <>
      <PageHeader
        title="Organisations"
        description="Every customer on the product. Open one to change its plan, features, limits and subscription, or to add people and branches."
        actions={
          <Link to="/platform/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground lg:h-10">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New organisation
          </Link>
        }
      />
      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <TextInput type="search" aria-label="Search organisations" placeholder="Search by name or code" className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
        {error && <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div>}
        {loading && !data && <Spinner label="Loading organisations" />}
        {data && rows.length === 0 && (
          <EmptyState
            title={search || status ? "No organisation matches" : "No organisations yet"}
            text={search || status ? "Try a different search." : "Create the first customer to get started."}
          />
        )}
        {rows.length > 0 && <DataTable caption="Organisations" columns={columns} rows={rows} rowKey={(o) => o.code} rowHref={(o) => `/platform/organisations/${o.code}`} onRowClick={(o) => navigate(`/platform/organisations/${o.code}`)} />}
      </Panel>
    </>
  );
}
