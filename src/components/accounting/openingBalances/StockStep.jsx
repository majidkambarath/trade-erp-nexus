import React, { useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "../../ui/button";
import { StatCard } from "../../ui/stat-card";
import EntryGrid from "../../finance/EntryGrid";
import { ConfirmDialog, DateInput, EmptyState, ErrorNote, Panel, SearchSelect, Spinner, TextInput, useAsync } from "../kit";
import { openingBalances } from "../../../lib/openingBalanceApi";
import { money } from "../../../lib/voucherForms";
import { emptyStockRow, fmt, itemAverages, stockPayload, stockRowCents, stockTotals, validateStockRows } from "../../../lib/openingBalanceForms";
import { formatDate, formatNumber, formatQty } from "../../../utils/format";
import { FooterRow, NeedsDate, Note, StatusPill } from "./parts";

const QTY = /^\d*(\.\d{0,3})?$/;
const COST = /^\d*(\.\d{0,5})?$/;
const clean = (v) => v.replace(/,/g, "");
const blankRows = () => [emptyStockRow(), emptyStockRow(), emptyStockRow()];
// an average cost with as many decimals as it needs, from 2 to 5
const avgText = (n) => formatNumber(n, Math.min(5, Math.max(2, (String(Number(n.toFixed(5))).split(".")[1] || "").length)));

// Step 5 - opening stock: quantity and unit cost per item, with the batch number and expiry for
// batch-tracked items. The same costing and batch path as a purchase receipt, dated the go-live day;
// the value goes to the Inventory account against Opening Balance Equity.
export default function StockStep({ goLive, notify, onChanged, goToDate }) {
  const data = useAsync(() => openingBalances.stock(), []);
  const grid = useRef(null);
  const [rows, setRows] = useState(blankRows);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});
  const [confirm, setConfirm] = useState(null); // { kind: "post" } | { kind: "reverse", voucher }
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const items = useMemo(() => data.data?.items || [], [data.data]);
  const options = useMemo(
    () => items.filter((i) => i.canEnter && !i.entered).map((i) => ({ value: i._id, label: i.itemName, hint: `${i.sku || i.itemId}${i.unit ? ` · ${i.unit}` : ""}${i.batchTracked ? " · batch" : ""}`, searchText: `${i.itemId} ${i.sku || ""}` })),
    [items]
  );
  const locked = items.filter((i) => !i.canEnter && !i.entered).length;
  const totals = useMemo(() => stockTotals(rows), [rows]);
  const averages = useMemo(() => itemAverages(rows, items), [rows, items]);
  if (!goLive) return <NeedsDate onGo={goToDate} />;

  // a row that is being corrected no longer shows the mistake it was flagged for (the next Post checks it again)
  const clearError = (i) => setErrors((e) => {
    if (!e[i] && !e._) return e;
    const next = { ...e };
    delete next[i];
    delete next._;
    return next;
  });
  const patch = (i, p) => {
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...p } : r)));
    clearError(i);
  };
  const setNumber = (i, key, raw, pattern) => {
    const v = clean(raw);
    if (pattern.test(v)) patch(i, { [key]: v });
  };
  const itemOf = (row) => items.find((i) => String(i._id) === String(row.itemId));

  function review() {
    const found = validateStockRows(rows, items, goLive);
    setErrors(found.errors);
    setWarnings(found.warnings);
    setProblem(null);
    if (!Object.keys(found.errors).length) setConfirm({ kind: "post" });
  }

  async function run() {
    setBusy(true);
    try {
      if (confirm.kind === "post") {
        const res = await openingBalances.postStock(stockPayload({ date: goLive, rows }));
        notify(`${res.voucherNo} posted: ${res.rows} rows, value ${fmt(res.totalValue)}${res.warnings?.length ? `. ${res.warnings.length} warning${res.warnings.length === 1 ? "" : "s"}: ${res.warnings[0].message}` : ""}`);
        setRows(blankRows());
        setWarnings({});
      } else {
        const res = await openingBalances.reverseStock(confirm.voucher._id);
        notify(`${res.voucherNo} reversed`);
      }
      setConfirm(null);
      await data.reload();
      onChanged();
    } catch (e) {
      setConfirm(null);
      setProblem(e);
    } finally {
      setBusy(false);
    }
  }

  const vouchers = data.data?.vouchers || [];
  const posted = vouchers.filter((v) => v.status === "posted");
  const warned = Object.entries(warnings);

  return (
    <div className="space-y-5">
      {data.data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Opening stock vouchers" count={posted.length} subText={`${posted.reduce((t, v) => t + v.rows.length, 0)} rows`} />
          <StatCard title="Value entered" count={fmt(posted.reduce((t, v) => t + v.totalValue, 0))} subText="Dr Inventory, Cr Opening Balance Equity" />
          <StatCard title="Items that cannot take it" count={locked} subText="Already have stock movements" />
        </div>
      )}

      <Panel
        title="Opening stock"
        description={`Enter the quantity and the cost of each item as at ${formatDate(goLive)}. Add a row per batch; an item with several rows is costed at the weighted average of them.`}
        actions={<Button onClick={review} disabled={busy || !totals.count}>Post opening stock</Button>}
      >
        {data.loading && !data.data && <Spinner label="Loading items" />}
        <ErrorNote error={data.error || problem} />
        {data.data && (
          <div className="space-y-3" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); review(); } }}>
            <EntryGrid
              ref={grid} ariaLabel="Opening stock" rows={rows} rowErrors={errors} minRows={1} addLabel="Add item"
              columns={[
                { key: "item", label: "Item", className: "min-w-64 w-[28%]" },
                { key: "qty", label: "Quantity", align: "end", className: "w-32" },
                { key: "unitCost", label: "Unit cost", align: "end", className: "w-32" },
                { key: "batchNo", label: "Batch no.", className: "min-w-32" },
                { key: "expiryDate", label: "Expiry date", className: "w-44" },
                { key: "value", label: "Value", align: "end", className: "w-36" },
              ]}
              onAdd={() => setRows((rs) => [...rs, emptyStockRow()])}
              onRemove={(i) => setRows((rs) => rs.filter((_, n) => n !== i))}
              renderCell={(row, i, col) => {
                const item = itemOf(row);
                switch (col.key) {
                  case "item":
                    return (
                      <SearchSelect
                        aria-label={`Item, row ${i + 1}`} value={row.itemId} options={options}
                        onChange={(v) => { patch(i, { itemId: v }); setTimeout(() => grid.current?.focusCell(i, "qty"), 0); }}
                        placeholder="Search item…" noOptionsText="No item matches" invalid={Boolean(errors[i] && !row.itemId)}
                      />
                    );
                  case "qty":
                    return <TextInput aria-label={`Quantity, row ${i + 1}`} inputMode="decimal" className="text-end tabular-nums" placeholder="0" value={row.qty} onChange={(e) => setNumber(i, "qty", e.target.value, QTY)} />;
                  case "unitCost":
                    return <TextInput aria-label={`Unit cost, row ${i + 1}`} inputMode="decimal" className="text-end tabular-nums" placeholder="0.00" value={row.unitCost} onChange={(e) => setNumber(i, "unitCost", e.target.value, COST)} />;
                  case "batchNo":
                    return <TextInput aria-label={`Batch no., row ${i + 1}`} value={row.batchNo} maxLength={60} placeholder={item?.batchTracked ? "Required" : "Optional"} onChange={(e) => patch(i, { batchNo: e.target.value })} />;
                  case "expiryDate":
                    return <DateInput aria-label={`Expiry date, row ${i + 1}`} value={row.expiryDate} placeholder={item?.batchTracked ? "Required" : "Optional"} onChange={(e) => patch(i, { expiryDate: e.target.value })} />;
                  default:
                    // computed, but focusable so Enter flows on to the next row
                    return <TextInput aria-label={`Value, row ${i + 1}`} readOnly tabIndex={-1} className="border-transparent bg-transparent text-end tabular-nums" value={stockRowCents(row) ? money(stockRowCents(row)) : ""} placeholder="0.00" />;
                }
              }}
              footer={<FooterRow span={5} strong label={`Total (${totals.count} ${totals.count === 1 ? "row" : "rows"}, ${totals.items} ${totals.items === 1 ? "item" : "items"})`} cells={[money(totals.cents)]} />}
            />
            {errors._ && <p role="alert" className="text-sm font-medium text-status-danger">{errors._}</p>}
            {warned.length > 0 && (
              <Note tone="warning" role="status">
                {warned.map(([i, w]) => <p key={i}>Row {Number(i) + 1}: {w}.</p>)}
              </Note>
            )}
            {averages.some((a) => a.qty > 0) && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Average cost after posting:{" "}
                {averages.map((a) => `${a.itemName} ${formatQty(a.qty, 3)} at ${avgText(a.avg)}`).join(" · ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter moves across the row; Alt+N adds a row; Ctrl+Enter posts. Items that already have stock movements are not listed: use a stock adjustment for them.
              The same item can be entered only once; a batch-tracked item needs its batch number and expiry date.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Entered" description="Each submission is one voucher. It can be reversed only while no other movement exists for its items." bodyClassName="p-0">
        {data.data && vouchers.length === 0 && <EmptyState title="Nothing entered yet" text="Opening stock you post appears here, with its batches." />}
        {vouchers.map((v) => (
          <section key={v._id} className="border-t border-border first:border-t-0">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-semibold">{v.voucherNo}</span>
                <span className="text-sm text-muted-foreground">{formatDate(v.date)}</span>
                <StatusPill status={v.status} />
                <span className="text-sm font-medium tabular-nums">{fmt(v.totalValue)}</span>
              </div>
              {v.status === "posted" && (
                v.canReverse
                  ? <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "reverse", voucher: v })}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reverse</Button>
                  : <span className="text-xs text-muted-foreground">Cannot be reversed: {v.blockedBy.join(", ")} {v.blockedBy.length === 1 ? "has" : "have"} later stock movements</span>
              )}
            </header>
            <div className="erp-scroll table-pin-first overflow-x-auto">
              <table className="w-full text-sm" aria-label={`Rows of ${v.voucherNo}`}>
                <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-2 text-start">Item</th><th className="px-3 py-2 text-end">Quantity</th><th className="px-3 py-2 text-end">Unit cost</th><th className="px-3 py-2 text-start">Batch</th><th className="px-3 py-2 text-start">Expiry</th><th className="px-5 py-2 text-end">Value</th></tr>
                </thead>
                <tbody>
                  {v.rows.map((r, n) => (
                    <tr key={n} className="border-t border-border">
                      <td className="px-5 py-2 font-medium">{r.itemName}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatQty(r.qty, 3)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{fmt(r.unitCost)}</td>
                      <td className="px-3 py-2">{r.batchNumber}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.expiryDate ? formatDate(r.expiryDate) : ""}</td>
                      <td className="px-5 py-2 text-end tabular-nums">{fmt(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </Panel>

      {confirm?.kind === "post" && (
        <ConfirmDialog
          title="Post the opening stock?" confirmLabel="Post stock" busy={busy} onConfirm={run} onClose={() => setConfirm(null)}
          text={`${totals.count} ${totals.count === 1 ? "row" : "rows"} for ${totals.items} ${totals.items === 1 ? "item" : "items"}, value ${money(totals.cents)}, dated ${formatDate(goLive)}. Each item's quantity and weighted-average cost are set from these rows and a batch is created per row. ${money(totals.cents)} is posted Dr Inventory, Cr Opening Balance Equity. An item cannot be entered again afterwards; the voucher can be reversed only while no other movement exists for its items.`}
        />
      )}
      {confirm?.kind === "reverse" && (
        <ConfirmDialog
          title={`Reverse ${confirm.voucher.voucherNo}?`} confirmLabel="Reverse stock entry" danger busy={busy} onConfirm={run} onClose={() => setConfirm(null)}
          text={`The ${confirm.voucher.rows.length} rows of this voucher are taken back out of stock (a matching reversal movement is recorded for each), their batches are removed and ${money(Math.round(confirm.voucher.totalValue * 100))} is taken out of Inventory and Opening Balance Equity. The items can then be entered again.`}
        />
      )}
    </div>
  );
}
