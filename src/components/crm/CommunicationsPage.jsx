// Communications: one log of everything that was ever said to anybody.
//
// It is the same CrmActivity rows the Follow-ups worklist draws, asked a different question. The worklist asks "what
// do I still owe", so it reads OPEN, soonest first. The log asks "what happened", so it reads everything, newest
// first. Two screens, one collection, one query path (the server's ActivityService.list takes status=all&sort=recent).
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, EmptyState, DataTable, useAsync, useToasts } from "../accounting/kit.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import Can from "../shell/Can.jsx";
import { pageSession } from "../../lib/pageSession";
import { formatDateTime, downloadCSV } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { DoneDialog, DuePill, KindIcon, OwnerSelect, Tag, useOwners } from "./crmShared.jsx";

const session = pageSession("crm-communications");

const SCOPES = [
  ["", "Everyone"],
  ["mine", "Mine"],
];

const ABOUT = {
  lead: { label: "Enquiry", href: (r) => `/crm/leads?lead=${r.regarding?.id}` },
  opportunity: { label: "Deal", href: (r) => `/crm/pipeline?deal=${r.regarding?.id}` },
  contact: { label: "Person", href: (r) => `/crm/contacts?contact=${r.regarding?.id}` },
  customer: { label: "Customer", href: (r) => `/credit-accounts/customer/${r.regarding?.id}?tab=crm` },
};

export default function CommunicationsPage() {
  const { notify, toastNode } = useToasts();
  const owners = useOwners();
  const [kind, setKind] = useState(() => session.get("kind", "all"));
  const [scope, setScope] = useState(() => session.get("scope", ""));
  const [status, setStatus] = useState(() => session.get("status", "all"));
  const [ownerId, setOwnerId] = useState(() => session.get("ownerId", ""));
  const [reload, setReload] = useState(0);
  const [doing, setDoing] = useState(null);
  const again = () => setReload((n) => n + 1);
  const keep = (setter, key) => (value) => {
    session.set(key, value);
    setter(value);
  };

  const query = useMemo(
    () => ({ status, sort: "recent", limit: 300, ...(kind !== "all" ? { kind } : {}), ...(scope ? { scope } : {}), ...(ownerId ? { ownerId } : {}) }),
    [kind, scope, status, ownerId]
  );
  const { data, loading, error, reload: retry } = useAsync(() => crm.activities(query), [query, reload]);
  const rows = data || [];
  const filtered = Boolean(scope || ownerId || status !== "all" || kind !== "all");

  const columns = [
    { key: "kind", header: "", label: "How", card: "badge", cell: (r) => <KindIcon kind={r.kind} /> },
    {
      key: "subject",
      header: "What",
      card: "primary",
      cell: (r) => (
        <span className="font-medium">
          {r.subject}
          {r.auto ? <Tag tone="default" className="ms-2">Automatic</Tag> : null}
        </span>
      ),
    },
    {
      key: "about",
      header: "About",
      card: "title",
      cell: (r) => {
        const about = ABOUT[r.regarding?.kind];
        if (!about || !r.regarding?.id) return "";
        return (
          <Link to={about.href(r)} className="text-muted-foreground hover:underline">
            {about.label}
          </Link>
        );
      },
    },
    { key: "owner", header: "Whose", card: "meta", cell: (r) => r.ownerName || "Nobody" },
    {
      key: "when",
      header: "When",
      card: "meta",
      cell: (r) => (r.status === "DONE" && r.completedAt ? formatDateTime(r.completedAt) : formatDateTime(r.createdAt)),
    },
    {
      key: "state",
      header: "State",
      card: "amount",
      cell: (r) =>
        r.status === "OPEN" ? (
          <DuePill state={r.dueState} />
        ) : r.outcome ? (
          <Tag tone="success">{rules.outcomeLabel(r.outcome)}</Tag>
        ) : (
          <Tag tone="default">{r.status === "CANCELLED" ? "Dropped" : "Done"}</Tag>
        ),
    },
    {
      key: "do",
      header: "",
      label: "",
      card: "actions",
      cell: (r) =>
        r.status === "OPEN" ? (
          <Can permission="crm.edit">
            <button type="button" onClick={() => setDoing(r)} className="h-9 rounded-lg border border-input px-3 text-sm hover:bg-accent">
              Done
            </button>
          </Can>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Communications"
        description="Every call, visit, message and note, newest first. What is still owed is on Follow-ups."
        actions={
          <>
            {/* No "log something" button here on purpose: a call is always ABOUT an enquiry, a deal or a person, so
                it is logged from one of those. This screen is the reading of them. */}
            <button
              type="button"
              onClick={() => {
                const csv = rules.communicationsCsv(rows);
                downloadCSV(`crm-communications-${new Date().toISOString().slice(0, 10)}.csv`, csv.headers, csv.rows);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-sm hover:bg-accent"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Export
            </button>
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PillTabs tabs={rules.COMM_TABS} value={kind} onChange={keep(setKind, "kind")} label="How" />
        <PillTabs tabs={SCOPES} value={scope} onChange={keep(setScope, "scope")} label="Whose" />
      </div>

      <div className="mt-4">
        <FilterBar
          active={filtered}
          onClear={() => {
            for (const key of ["kind", "scope", "status", "ownerId"]) session.remove(key);
            setKind("all");
            setScope("");
            setStatus("all");
            setOwnerId("");
          }}
        >
          <FilterSelect
            label="State"
            value={status}
            onChange={keep(setStatus, "status")}
            options={[
              { value: "all", label: "Everything" },
              { value: "OPEN", label: "Still owed" },
              { value: "DONE", label: "Done" },
            ]}
          />
          <div className="w-full sm:w-56">
            <OwnerSelect id="comm-owner" value={ownerId} onChange={keep(setOwnerId, "ownerId")} owners={owners} placeholder="Anybody" />
          </div>
        </FilterBar>
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        {loading && !data && <Spinner label="Reading the log" />}
        {error && <ErrorNote error={error} onRetry={retry} />}
        {data && rows.length === 0 && (
          <EmptyState
            title="Nothing logged yet"
            text="Log a call from an enquiry, a deal or a person and it is read here, with everything else."
          />
        )}
        {rows.length > 0 && <DataTable caption="Communications" rows={rows} rowKey={(r) => r._id} columns={columns} />}
      </Panel>

      {doing && <DoneDialog activity={doing} notify={notify} onClose={() => setDoing(null)} onSaved={() => { setDoing(null); again(); }} />}
      {toastNode}
    </div>
  );
}
