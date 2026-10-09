import React, { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { batches } from "../../lib/accountingApi";
import { formatDateGB, formatNumber, CURRENCY } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { DataTable, EmptyState, errorMessage, ErrorNote, Field, Modal, PageHeader, Panel, Pill, Select, Spinner, Textarea, TextInput, useAsync, useToasts } from "../accounting/kit";

const WINDOWS = [{ v: "", l: "All batches in stock" }, { v: "0", l: "Expired" }, { v: "7", l: "Expire within 7 days" }, { v: "30", l: "Expire within 30 days" }, { v: "90", l: "Expire within 90 days" }];
const qtyFmt = (n) => formatNumber(n, 3).replace(/\.?0+$/, "");

function ExpiryPill({ b }) {
  if (b.daysToExpiry == null) return <Pill>No expiry</Pill>;
  if (b.expired) return <Pill tone="danger">Expired {Math.abs(b.daysToExpiry)} day{Math.abs(b.daysToExpiry) === 1 ? "" : "s"} ago</Pill>;
  if (b.daysToExpiry <= 7) return <Pill tone="danger">{b.daysToExpiry} day{b.daysToExpiry === 1 ? "" : "s"} left</Pill>;
  if (b.daysToExpiry <= 30) return <Pill tone="warning">{b.daysToExpiry} days left</Pill>;
  return <Pill tone="success">{b.daysToExpiry} days left</Pill>;
}

// Stock by batch and expiry. A batch belongs to a receipt, so the same item can sit here several
// times with different dates. Sales take the soonest-expiring batch first; expired stock is never
// sold, and is written off here.
export default function BatchManagement() {
  const [window_, setWindow] = useState("");
  const { data, loading, error, reload } = useAsync(
    () => batches.list(window_ === "" ? {} : { expiringWithinDays: window_ }),
    [window_]
  );
  const { notify, toastNode } = useToasts();
  const [writing, setWriting] = useState(null);

  const stats = useMemo(() => {
    const rows = data || [];
    const expired = rows.filter((b) => b.expired);
    return {
      count: rows.length,
      soon: rows.filter((b) => !b.expired && b.daysToExpiry != null && b.daysToExpiry <= 30).length,
      expired: expired.length,
      expiredQty: expired.reduce((t, b) => t + b.qtyOnHand, 0),
    };
  }, [data]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Batches and expiry" description="Each delivery is tracked as a batch with its own expiry date. Sales take the soonest-expiring batch first, and expired stock is never sold." />
      {data && window_ === "" && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Batches in stock" count={stats.count} tone="teal" />
          <StatCard title="Expiring in 30 days" count={stats.soon} tone={stats.soon ? "warning" : "neutral"} />
          <StatCard title="Expired, still on hand" count={stats.expired} tone={stats.expired ? "danger" : "neutral"} />
          <StatCard title="Quantity to write off" count={qtyFmt(stats.expiredQty)} subText="units in expired batches" tone={stats.expiredQty ? "danger" : "neutral"} />
        </div>
      )}
      <Panel bodyClassName="p-0" title="Batches"
        actions={<Select aria-label="Show" value={window_} onChange={(e) => setWindow(e.target.value)} className="h-9 w-52 rounded-full">{WINDOWS.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}</Select>}>
        {loading && !data && <Spinner label="Loading batches" />}
        {error && <div className="p-5"><ErrorNote error={error} onRetry={reload} /></div>}
        {data?.length === 0 && <EmptyState title="No batches" text={window_ === "" ? "Batches are created when a purchase order is approved. Give each line a batch number and expiry date." : "Nothing matches that filter."} />}
        {data?.length > 0 && (
          <div className="relative overflow-x-auto">
            <DataTable
              caption="Batches"
              rows={data}
              rowKey={(b) => b._id}
              columns={[
                { key: "batch", header: "Batch", card: "primary", cell: (b) => <><span className="font-mono text-xs font-semibold">{b.batchNumber}</span>{b.sourceTransactionNo && <span className="block text-xs font-normal text-muted-foreground">{b.sourceTransactionNo}</span>}</> },
                { key: "item", header: "Item", card: "title", cell: (b) => <><span className="font-medium">{b.itemName || b.itemCode}</span><span className="ms-1 text-xs text-muted-foreground">{b.sku}</span></> },
                { key: "received", header: "Received", card: "meta", className: "whitespace-nowrap", cell: (b) => formatDateGB(b.receivedAt) },
                { key: "expiry", header: "Expiry", card: "badge", cell: (b) => <><span className="me-2 whitespace-nowrap">{b.expiryDate ? formatDateGB(b.expiryDate) : "—"}</span><ExpiryPill b={b} /></> },
                { key: "onhand", header: "On hand", align: "end", card: "amount", className: "tabular-nums", cell: (b) => <>{qtyFmt(b.qtyOnHand)} <span className="text-xs font-normal text-muted-foreground">of {qtyFmt(b.receivedQty)}</span></> },
                { key: "action", header: <span className="sr-only">Action</span>, align: "end", card: "actions", cell: (b) => <Button size="sm" variant={b.expired ? "default" : "outline"} onClick={() => setWriting(b)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Write off</Button> },
              ]}
            />
          </div>
        )}
      </Panel>
      {writing && <WriteOffModal batch={writing} onClose={() => setWriting(null)} onDone={(m) => { setWriting(null); notify(m); reload(); }} />}
      {toastNode}
    </div>
  );
}

export function WriteOffModal({ batch, onClose, onDone }) {
  const [qty, setQty] = useState(String(batch.qtyOnHand));
  const [reason, setReason] = useState(batch.expired ? "expiry" : "damage");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev) {
    ev.preventDefault();
    const n = Number(qty);
    if (!(n > 0)) return setFieldError("Enter a quantity above zero");
    if (n > batch.qtyOnHand) return setFieldError(`Only ${qtyFmt(batch.qtyOnHand)} left in this batch`);
    setFieldError(null);
    setBusy(true);
    try {
      const r = await batches.writeOff(batch._id, { qty: n, reason, note: note.trim() || undefined });
      onDone(`${r.number}: ${qtyFmt(r.qty)} written off, cost ${CURRENCY} ${formatNumber(r.cost, 2)}${r.posted ? "" : " (ledger posting is off; not booked)"}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Modal size="sm" onClose={onClose} title="Write off stock" description={`${batch.itemName || batch.itemCode} · batch ${batch.batchNumber}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="writeoff-form" variant="destructive" disabled={busy}>{busy ? "Writing off…" : "Write off"}</Button></>}>
      <form id="writeoff-form" onSubmit={submit} noValidate className="grid gap-4">
        <ErrorNote error={error && new Error(errorMessage(error))} />
        <Field label="Quantity" required error={fieldError} hint={`${qtyFmt(batch.qtyOnHand)} on hand`}>
          <TextInput type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} data-autofocus />
        </Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}><option value="expiry">Expired</option><option value="damage">Damaged or lost</option></Select>
        </Field>
        <Field label="Note" hint="Optional."><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
        <p className="text-xs text-muted-foreground">The stock leaves at its average cost and the loss is booked to the {reason === "expiry" ? "expiry" : "damage"} write-off account. This cannot be undone.</p>
      </form>
    </Modal>
  );
}
