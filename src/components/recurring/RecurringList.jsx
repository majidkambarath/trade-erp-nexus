import React, { useState } from "react";
import { FilePlus2, Pause, Pencil, Play, Repeat, Trash2, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { ConfirmDialog, DataTable, ErrorNote, PageHeader, Panel, Pill, Spinner, useAsync } from "../accounting/kit";
import { recurringInvoices } from "../../lib/recurringApi";
import { formatDate, formatNumber } from "../../utils/format";
import { useOrganisation } from "../shell/OrganisationContext";

const STATUS = { ACTIVE: ["Running", "success"], PAUSED: ["Paused", "warning"], ENDED: ["Finished", "neutral"] };

// The recurring invoices: what each makes, how often, when next, and the last draft it made. Making the invoices is the server's
// job (every few minutes, on each one's day); this screen sets them up, pauses, resumes, and can make the next one at once.
export default function RecurringList({ onNew, onEdit, notify, reloadKey }) {
  const { can } = useOrganisation();
  const { data, loading, error, reload } = useAsync(() => recurringInvoices.list(), [reloadKey]);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState("");
  const rows = Array.isArray(data) ? data : [];

  const act = async (row, what) => {
    setBusy(`${row._id}:${what}`);
    try {
      if (what === "pause") {
        await recurringInvoices.pause(row._id);
        notify(`${row.name} paused: no invoices are made until it is resumed`);
      } else if (what === "resume") {
        const t = await recurringInvoices.resume(row._id);
        notify(t.nextRunDay ? `${row.name} resumed: the next invoice is on ${formatDate(t.nextRunDay)}` : `${row.name} has nothing left to make`);
      } else if (what === "run") {
        const r = await recurringInvoices.run(row._id);
        notify(`Draft invoice ${r.invoice.transactionNo} made for ${formatDate(r.day)}. Review and approve it under Sales > Invoices.`);
      }
      reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      await recurringInvoices.remove(removing._id);
      notify(`${removing.name} deleted. The invoices it already made are kept.`);
      setRemoving(null);
      reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Recurring invoices"
        description="Invoices that repeat: rent, a maintenance contract, a subscription. Each one is made as a draft on its day for you to review and approve; nothing is posted or sent on its own."
        actions={can("sales.create") && <Button onClick={onNew} data-shortcut="new"><FilePlus2 className="h-4 w-4" aria-hidden="true" />New recurring invoice</Button>}
      />
      <Panel bodyClassName="p-0">
        {loading && !data && <Spinner label="Loading recurring invoices" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Repeat className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No recurring invoices yet</p>
            <p className="max-w-md text-sm text-muted-foreground">Set one up once and a draft invoice is ready for you on each date, with the same customer and lines.</p>
            {can("sales.create") && <Button onClick={onNew}>New recurring invoice</Button>}
          </div>
        )}
        {rows.length > 0 && (
          <DataTable
            caption="Recurring invoices"
            rows={rows}
            rowKey={(r) => r._id}
            onRowClick={can("sales.edit") ? (r) => onEdit(r._id) : undefined}
            columns={[
              {
                key: "name", header: "Name", card: "primary",
                cell: (r) => (
                  <>
                    <span className="font-medium">{r.name}</span>
                    {r.lastError?.message && r.status === "ACTIVE" && (
                      <span className="block whitespace-normal text-xs font-normal text-status-danger">Could not make the invoice for {formatDate(r.lastError.day)}: {r.lastError.message}</span>
                    )}
                  </>
                ),
              },
              { key: "party", header: "Customer", card: "title", cell: (r) => r.partyName || "-" },
              { key: "how", header: "How often", card: "meta", className: "whitespace-nowrap", cell: (r) => r.describe },
              {
                key: "next", header: "Next invoice", card: "meta", className: "whitespace-nowrap",
                cell: (r) => (r.status === "ACTIVE" && r.nextRunDay ? formatDate(r.nextRunDay) : "-"),
              },
              {
                key: "last", header: "Last made", card: "meta", className: "whitespace-nowrap",
                cell: (r) => (r.lastRun ? (
                  <Link to={`/sales-order?search=${encodeURIComponent(r.lastRun.transactionNo)}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline-offset-2 hover:underline">
                    {r.lastRun.transactionNo}
                  </Link>
                ) : <span className="text-muted-foreground">None yet</span>),
              },
              { key: "made", header: "Made", align: "end", card: "meta", className: "tabular-nums", cell: (r) => (r.maxCount ? `${r.made} of ${r.maxCount}` : `${r.made || 0} made`) },
              { key: "amount", header: "Amount", money: true, align: "end", card: "amount", className: "whitespace-nowrap font-medium tabular-nums", cell: (r) => formatNumber(r.totalAmount, 2) },
              { key: "status", header: "Status", card: "badge", cell: (r) => <Pill tone={STATUS[r.status]?.[1] || "neutral"}>{STATUS[r.status]?.[0] || r.status}</Pill> },
              {
                key: "actions", header: "", align: "end", card: "actions", className: "whitespace-nowrap",
                cell: (r) => (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {can("sales.edit") && <Button size="sm" variant="ghost" onClick={() => onEdit(r._id)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</Button>}
                    {can("sales.create") && r.status === "ACTIVE" && (
                      <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => act(r, "run")} title="Make the next invoice now, dated its scheduled day">
                        <Zap className="h-3.5 w-3.5" aria-hidden="true" />Make next now
                      </Button>
                    )}
                    {can("sales.edit") && r.status === "ACTIVE" && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => act(r, "pause")}><Pause className="h-3.5 w-3.5" aria-hidden="true" />Pause</Button>}
                    {can("sales.edit") && r.status === "PAUSED" && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => act(r, "resume")}><Play className="h-3.5 w-3.5" aria-hidden="true" />Resume</Button>}
                    {can("sales.delete") && <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete</Button>}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Panel>
      {removing && (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          text="No more invoices will be made from it. The invoices it already made are kept."
          confirmLabel="Delete"
          danger
          busy={busy === "remove"}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
