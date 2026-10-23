import React, { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { formatDateTime } from "../../../utils/format";
import { Button } from "../../ui/button";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import { DataTable, EmptyState, ErrorNote, Field, Panel, Pill, Select, Spinner, useAsync } from "../kit";
import { PillTabs } from "../../salesDocs/parts.jsx";
import VoucherTypeModal from "./VoucherTypeModal";
import { GAP_LABELS, KIND_LABELS, KIND_ORDER, previewNumber, scopeLabel, summaryOf } from "../../../lib/voucherTypeForms";

const VIEWS = [["types", "Voucher types"], ["counters", "Counters"], ["deleted", "Deleted & gaps"]];

// How every kind of document is named and numbered, what each counter stands at, and - the part that
// matters when somebody asks why there is no invoice 41 - every number that was given out and deleted,
// with the reason it went.
export default function Numbering({ notify }) {
  const [view, setView] = useState("types");
  return (
    <div className="space-y-4">
      <PillTabs tabs={VIEWS} value={view} onChange={setView} label="Numbering views" />
      {view === "types" && <VoucherTypes notify={notify} />}
      {view === "counters" && <Counters />}
      {view === "deleted" && <DeletedNumbers />}
    </div>
  );
}

function VoucherTypes({ notify }) {
  const types = useAsync(() => accounting.voucherTypes(), []);
  const [modal, setModal] = useState(null);
  const { canAny } = useOrganisation();
  const canManage = canAny("accounts.manage");

  const rows = types.data?.types || [];
  const branches = types.data?.branches || [];
  // Grouped the way a person thinks about them, with the system-written series last. Keyed on the
  // response, not on `rows`: that is a fresh array every render, so the memo would never hold.
  const grouped = useMemo(() => {
    const byKind = new Map(KIND_ORDER.map((k) => [k, []]));
    for (const r of types.data?.types || []) {
      if (!byKind.has(r.kind)) byKind.set(r.kind, []);
      byKind.get(r.kind).push(r);
    }
    return [...byKind.entries()].filter(([, list]) => list.length);
  }, [types.data]);

  const columns = [
    { key: "name", header: "Document", card: "primary", className: "font-medium", cell: (t) => (
      <>
        {t.name}
        {t.parentKey && <Pill tone="info" className="ms-1">Variant of {t.parentKey}</Pill>}
        {t.statutory && <Pill className="ms-1">Tax document</Pill>}
      </>
    ) },
    { key: "next", header: "A number reads", card: "title", className: "whitespace-nowrap font-mono text-xs", cell: (t) => previewNumber(t) },
    { key: "rule", header: "Counter", card: "meta", className: "text-xs text-muted-foreground", cell: (t) => summaryOf(t) },
    { key: "status", header: "Status", card: "badge", cell: (t) => (t.isActive === false ? <Pill>Switched off</Pill> : <Pill tone="success">In use</Pill>) },
    ...(canManage
      ? [{ key: "edit", header: <span className="sr-only">Edit</span>, align: "end", card: "actions", cell: (t) => (
          <button type="button" onClick={() => setModal({ row: t })} aria-label={`Edit ${t.name}`} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent lg:h-8 lg:w-8">
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        ) }]
      : []),
  ];

  return (
    <Panel
      title="Voucher types" bodyClassName="p-0"
      description="What each kind of document is called and how its number is built. Changing a prefix or a width applies to the next number given out; the numbers already issued never change."
      actions={<Can permission="accounts.manage"><Button size="sm" onClick={() => setModal({})}><Plus className="h-4 w-4" aria-hidden="true" />New voucher type</Button></Can>}
    >
      {types.loading && !types.data && <Spinner label="Reading the voucher types" />}
      {types.error && <div className="p-5"><ErrorNote error={types.error} onRetry={types.reload} /></div>}
      {types.data && !rows.length && <EmptyState title="No voucher types yet" text="They appear the first time this page is opened." />}
      {grouped.map(([kind, list]) => (
        <div key={kind} className="border-t border-border first:border-t-0">
          <h3 className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABELS[kind] || kind}</h3>
          <DataTable caption={`${KIND_LABELS[kind] || kind} numbering`} rows={list} rowKey={(t) => t.key} columns={columns} />
        </div>
      ))}
      {modal && (
        <VoucherTypeModal
          {...modal}
          types={rows}
          branches={branches}
          onClose={() => setModal(null)}
          onSaved={(m) => { setModal(null); notify(m); types.reload(); }}
        />
      )}
    </Panel>
  );
}

// Where each counter stands. Read-only: a counter is moved by issuing documents, never by hand - winding
// one back is the one way a number could be given to two documents, and the register refuses it.
function Counters() {
  const series = useAsync(() => accounting.numberSeries(), []);
  return (
    <Panel
      title="Counters" bodyClassName="p-0"
      description="One counter per document type, branch and year. A gap means a number was given out and its document did not survive - the Deleted & gaps view says which, and why."
    >
      {series.loading && !series.data && <Spinner label="Reading the counters" />}
      {series.error && <div className="p-5"><ErrorNote error={series.error} onRetry={series.reload} /></div>}
      {series.data?.length === 0 && <EmptyState title="No numbers issued yet" text="A counter appears here the first time a document of that kind is created." />}
      {series.data?.length > 0 && (
        <DataTable
          caption="Number series"
          rows={series.data}
          rowKey={(r) => r._id}
          columns={[
            { key: "series", header: "Series", card: "primary", className: "font-mono text-xs font-semibold", cell: (r) => r.series },
            { key: "scope", header: "Counts under", card: "title", cell: (r) => r.scope || scopeLabel(r.fiscalYear) },
            { key: "branch", header: "Branch", card: "meta", cell: (r) => r.branchId },
            { key: "prefix", header: "Prefix", card: "meta", className: "font-mono text-xs", cell: (r) => r.prefix },
            { key: "next", header: "Last number issued", align: "end", card: "amount", className: "tabular-nums", cell: (r) => r.next },
          ]}
        />
      )}
    </Panel>
  );
}

// The answer to "why is there no invoice 41?". Every number that was given out and then deleted, whether
// it went back to be used again or was retired for good, and who did it.
function DeletedNumbers() {
  const [series, setSeries] = useState("");
  const types = useAsync(() => accounting.voucherTypes(), []);
  const deleted = useAsync(() => accounting.numberRegister({ status: "ended", series: series || undefined, limit: 100 }), [series]);
  const gaps = useAsync(() => (series ? accounting.numberGaps({ series }) : Promise.resolve(null)), [series]);

  const options = (types.data?.types || []).map((t) => ({ value: t.key, label: t.name }));
  const rows = deleted.data?.rows || [];

  return (
    <div className="space-y-4">
      <Panel
        title="Deleted numbers" bodyClassName="p-0"
        description="A document that is deleted leaves its number on record with the reason it went, so a hole in a sequence can always be explained."
        actions={
          <div className="w-full sm:w-64">
            <Field label="Document type">
              <Select value={series} onChange={(e) => setSeries(e.target.value)}>
                <option value="">All types</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
          </div>
        }
      >
        {deleted.loading && !deleted.data && <Spinner label="Reading the register" />}
        {deleted.error && <div className="p-5"><ErrorNote error={deleted.error} onRetry={deleted.reload} /></div>}
        {deleted.data && !rows.length && <EmptyState title="Nothing has been deleted" text="Every number given out is still on the document it was given to." />}
        {rows.length > 0 && (
          <DataTable
            caption="Deleted numbers"
            rows={rows}
            rowKey={(r) => r._id}
            columns={[
              { key: "number", header: "Number", card: "primary", className: "whitespace-nowrap font-mono text-xs font-semibold", cell: (r) => r.number },
              { key: "type", header: "Document", card: "title", cell: (r) => r.typeName },
              { key: "what", header: "What happened", card: "badge", cell: (r) => (r.status === "released" ? <Pill tone="info">Handed back</Pill> : <Pill>Retired</Pill>) },
              { key: "reason", header: "Reason", card: "meta", cell: (r) => r.reason || "—" },
              { key: "when", header: "Deleted", align: "end", card: "meta", className: "whitespace-nowrap text-xs text-muted-foreground", cell: (r) => (r.endedAt ? formatDateTime(r.endedAt) : "—") },
            ]}
          />
        )}
      </Panel>

      {series && gaps.data && (
        <Panel title="Is the sequence unbroken?" description="One counter at a time: that is the only thing a sequence means. A tax authority asking for the numbers you did not use is asking for this.">
          {gaps.loading && !gaps.data && <Spinner />}
          {!gaps.data.scopes?.length && <EmptyState title="Nothing issued yet" text="No number of this kind has been given out." />}
          <div className="space-y-4">
            {gaps.data.scopes?.map((s) => (
              <div key={`${s.branchId}-${s.label}`} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.scope}</p>
                    <p className="text-xs text-muted-foreground">Branch {s.branchId} · {s.issued} in use · counter at {s.counter}</p>
                  </div>
                  {s.continuous ? <Pill tone="success">Unbroken</Pill> : <Pill tone="warning">{s.gaps.length} gap{s.gaps.length === 1 ? "" : "s"}</Pill>}
                </div>
                {!s.continuous && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {s.gaps.map((g) => (
                      <li key={g.seq} className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs tabular-nums">#{g.seq}</span>
                        <Pill>{GAP_LABELS[g.code] || g.code}</Pill>
                        <span className="text-muted-foreground">{g.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
