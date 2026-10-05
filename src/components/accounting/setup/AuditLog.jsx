import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { Button } from "../../ui/button";
import { EmptyState, ErrorNote, Field, Panel, Spinner, TextInput, formatDateTime, useAsync, DateInput } from "../kit";

// Who changed what. Configuration changes are recorded alongside documents, because those are what
// an auditor asks about. The log is append-only: nothing here can be edited or deleted.
export default function AuditLog() {
  const [filters, setFilters] = useState({ entity: "", action: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState({});
  const { data, loading, error, reload } = useAsync(
    () => accounting.auditLog({ ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)), page, limit: 25 }),
    [applied, page]
  );
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const apply = (e) => { e.preventDefault(); setPage(1); setApplied(filters); };

  return (
    <Panel title="Audit log" description="Newest first. Dates are shown in Dubai time." bodyClassName="p-0">
      <form onSubmit={apply} className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
        <Field label="What"><TextInput value={filters.entity} onChange={set("entity")} placeholder="e.g. FiscalYear" className="w-44" /></Field>
        <Field label="Action"><TextInput value={filters.action} onChange={set("action")} placeholder="e.g. PERIOD_CLOSED" className="w-52" /></Field>
        <Field label="From"><DateInput value={filters.from} onChange={set("from")} /></Field>
        <Field label="To"><DateInput value={filters.to} onChange={set("to")} /></Field>
        <Button type="submit" size="sm">Filter</Button>
      </form>
      {loading && !data && <Spinner />}
      {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
      {data?.rows.length === 0 && <EmptyState title="Nothing logged" text="Changes to accounts, tax codes, fiscal years, mappings and e-invoice settings appear here." />}
      {data?.rows.length > 0 && (
        <ul className="divide-y divide-border">
          {data.rows.map((r) => {
            const has = r.before || r.after;
            const expanded = open[r._id];
            return (
              <li key={r._id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {has ? (
                    <button type="button" onClick={() => setOpen((o) => ({ ...o, [r._id]: !o[r._id] }))} aria-expanded={!!expanded} aria-label={`${expanded ? "Hide" : "Show"} details of ${r.action}`} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent">
                      {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  ) : <span className="w-6" />}
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">{r.action}</span>
                  <span className="text-muted-foreground">{r.entity}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{r.summary}</span>
                  <span className="text-xs text-muted-foreground">{r.username || "system"} · {formatDateTime(r.at)}</span>
                </div>
                {expanded && (
                  <div className="mt-2 grid gap-2 ps-9 sm:grid-cols-2">
                    {r.before && <pre className="erp-scroll max-h-56 overflow-auto rounded-lg bg-secondary/60 p-3 text-xs"><strong className="block pb-1 font-sans">Before</strong>{JSON.stringify(r.before, null, 2)}</pre>}
                    {r.after && <pre className="erp-scroll max-h-56 overflow-auto rounded-lg bg-secondary/60 p-3 text-xs"><strong className="block pb-1 font-sans">After</strong>{JSON.stringify(r.after, null, 2)}</pre>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
          <span className="text-muted-foreground">Page {data.page} of {data.pages} · {data.total} entries</span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </span>
        </div>
      )}
    </Panel>
  );
}
