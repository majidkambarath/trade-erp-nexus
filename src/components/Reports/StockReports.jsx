import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, TriangleAlert } from "lucide-react";
import { stockReports } from "../../lib/stockReportsApi";
import { downloadCSV, formatDate, formatNumber, formatQty, todayInput } from "../../utils/format";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { EmptyState, ErrorNote, Field, PageHeader, Panel, Pill, SearchSelect, TextInput, useAsync } from "../accounting/kit";
import { DateRange, Frame, monthStart, yearStart } from "./reportKit";

// Stock reports, read from the stock movements, the item master, the batches and the approved
// documents. Valuation and Movement are checked against the Inventory account of the ledger.

const money = (n) => formatNumber(n, 2);
const rate = (n) => formatNumber(n, 4);
const qty = (n) => formatQty(n, 3);
const pct = (n) => (n === null || n === undefined ? "–" : `${formatNumber(n, 1)}%`);
const whole = (n) => formatNumber(n, 0);

const TABS = [
  { id: "valuation", label: "Valuation" },
  { id: "movement", label: "Movement" },
  { id: "ledger", label: "Item ledger" },
  { id: "sales", label: "Sales analysis" },
  { id: "expiry", label: "Expiry" },
  { id: "slow", label: "Slow stock" },
  { id: "reorder", label: "Reorder" },
];
const TAB_IDS = TABS.map((t) => t.id);

function defaultFilters() {
  const today = todayInput();
  return {
    valuation: { asOn: today, categoryId: "", search: "", groupBy: "item" },
    movement: { range: { from: monthStart(today), to: today }, categoryId: "", search: "", view: "qty" },
    ledger: { range: { from: yearStart(today), to: today }, itemId: "" },
    sales: { range: { from: monthStart(today), to: today }, direction: "sales", groupBy: "item", categoryId: "", search: "" },
    expiry: { withinDays: "30", categoryId: "", search: "" },
    slow: { days: "90", categoryId: "", search: "" },
    reorder: { categoryId: "", search: "" },
  };
}

// The text in a search box reaches the server a moment after the person stops typing.
function useDebounced(value, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export default function StockReports() {
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get("tab")) ? params.get("tab") : "valuation";
  const [filters, setFilters] = useState(defaultFilters);
  const lookups = useAsync(() => stockReports.lookups(), []);
  const setFor = (id) => (patch) => setFilters((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  const shared = (id) => ({ f: filters[id], set: setFor(id), lookups });

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader
        title="Stock reports"
        description="What is in stock and what it is worth, how it moved, what sold at what margin, and what needs attention. Valuation and movement are checked against the Inventory account of the ledger."
      />
      {lookups.error && (
        <div className="mb-4"><ErrorNote error={new Error("The item and category lists could not be loaded.")} onRetry={lookups.reload} /></div>
      )}
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="overflow-x-auto">
          <TabsList aria-label="Stock reports">
            {TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent value="valuation">{tab === "valuation" && <Valuation {...shared("valuation")} />}</TabsContent>
        <TabsContent value="movement">{tab === "movement" && <Movement {...shared("movement")} />}</TabsContent>
        <TabsContent value="ledger">{tab === "ledger" && <ItemLedger {...shared("ledger")} />}</TabsContent>
        <TabsContent value="sales">{tab === "sales" && <SalesAnalysis {...shared("sales")} />}</TabsContent>
        <TabsContent value="expiry">{tab === "expiry" && <Expiry {...shared("expiry")} />}</TabsContent>
        <TabsContent value="slow">{tab === "slow" && <SlowStock {...shared("slow")} />}</TabsContent>
        <TabsContent value="reorder">{tab === "reorder" && <Reorder {...shared("reorder")} />}</TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------ shared pieces

const FilterRow = ({ children }) => <div className="mb-5 flex flex-wrap items-end gap-3">{children}</div>;
const Cards = ({ children }) => <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;

function CategoryField({ value, onChange, lookups }) {
  const options = useMemo(() => (lookups.data?.categories || []).map((c) => ({ value: c.id, label: c.name })), [lookups.data]);
  return (
    <Field label="Category" className="w-full sm:w-56">
      <SearchSelect value={value} onChange={onChange} options={options} clearable placeholder="All categories" loading={lookups.loading} />
    </Field>
  );
}

function SearchField({ value, onChange }) {
  return (
    <Field label="Search" className="w-full sm:w-64">
      <TextInput type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Item name, code or SKU" autoComplete="off" />
    </Field>
  );
}

// A few mutually exclusive choices. Plain buttons with aria-pressed, so Tab and Enter work.
function Segmented({ label, value, options, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div role="group" aria-label={label} className="inline-flex h-10 items-center rounded-full bg-secondary/80 p-1">
        {options.map((o) => (
          <button
            key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// A whole number of days with a few common choices next to it.
function DaysField({ label, value, onChange, choices, valid, invalidText }) {
  return (
    <>
      <Field label={label} className="w-full sm:w-44" error={valid ? undefined : invalidText}>
        <TextInput type="number" inputMode="numeric" min={0} step={1} value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2 pb-1" role="group" aria-label="Quick choices">
        {choices.map((c) => <Button key={c} type="button" variant="outline" size="sm" onClick={() => onChange(String(c))}>{c} days</Button>)}
      </div>
    </>
  );
}

// Columns: { key, header, cell(row), align: "end", total (footer node) }
function ReportTable({ caption, columns, rows, rowKey, head, foot, hasTotal = true }) {
  const pad = (i) => (i === 0 ? "ps-5 pe-3" : i === columns.length - 1 ? "ps-3 pe-5" : "px-3");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((c, i) => (
              <th key={c.key} scope="col" className={cn("py-2 font-medium", pad(i), c.align === "end" ? "text-end" : "text-start")}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {head}
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-t border-border hover:bg-accent/40">
              {columns.map((c, i) => (
                <td key={c.key} className={cn("py-2", pad(i), c.align === "end" && "text-end tabular-nums", c.className)}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
          {foot}
        </tbody>
        {hasTotal && (
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
              {columns.map((c, i) => (
                <td key={c.key} className={cn("py-2.5", pad(i), c.align === "end" && "text-end tabular-nums")}>{c.total ?? ""}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function ReportPanel({ title, description, onCsv, csvDisabled, children }) {
  return (
    <Panel
      bodyClassName="p-0" title={title} description={description}
      actions={<Button size="sm" variant="outline" onClick={onCsv} disabled={csvDisabled}><Download className="h-3.5 w-3.5" aria-hidden="true" />Export CSV</Button>}
    >
      {children}
    </Panel>
  );
}

const ItemCell = ({ r }) => (
  <span className="inline-flex flex-wrap items-baseline gap-x-2">
    <span className="font-medium text-foreground">{r.itemName ?? r.name}</span>
    {(r.sku || r.code) && <span className="font-mono text-xs text-muted-foreground">{r.sku || r.code}</span>}
  </span>
);

// Does the stock value agree with the Inventory account? When it does not, the difference is split
// by source so it can be put right.
function Reconciliation({ rec, label }) {
  if (!rec) return null;
  if (!rec.available) {
    return (
      <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-status-warning/25 bg-status-warning-soft px-4 py-3 text-sm text-status-warning">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Stock cannot be compared with the ledger</p>
          <p>{rec.reason}</p>
        </div>
      </div>
    );
  }
  const ok = rec.reconciles;
  const lines = rec.lines || [];
  const diff = Math.abs(rec.difference);
  return (
    <section aria-label="Ledger reconciliation" className={cn("mb-4 rounded-xl border", ok ? "border-status-success/25" : "border-status-warning/25")}>
      <div role="status" className={cn("flex items-start gap-3 rounded-t-xl px-4 py-3 text-sm", ok ? "bg-status-success-soft text-status-success" : "bg-status-warning-soft text-status-warning")}>
        {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
        <div className="min-w-0">
          <p className="font-semibold">
            {ok ? "Stock value agrees with the Inventory account" : `Stock value differs from the Inventory account by AED ${money(diff)}`}
          </p>
          <p>
            {ok
              ? `AED ${money(rec.stockValue)} ${label} in stock and in ${rec.account.name} (${rec.account.code || "ledger"}).`
              : `Stock AED ${money(rec.stockValue)}, ${rec.account.name} AED ${money(rec.ledgerBalance)} ${label}. Stock is ${rec.difference > 0 ? "higher" : "lower"} than the ledger.`}
          </p>
          {rec.warning && <p className="mt-1 font-medium">{rec.warning}</p>}
        </div>
      </div>
      <details open={!ok} className="px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">{ok ? "How this was checked" : "Where the difference comes from"}</summary>
        {rec.filtered && <p className="mt-2 text-xs text-muted-foreground">The comparison always covers every item, not only the ones filtered below.</p>}
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Stock value and ledger balance by source</caption>
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th scope="col" className="py-1.5 pe-3 text-start font-medium">Source</th><th scope="col" className="px-3 py-1.5 text-end font-medium">Stock</th><th scope="col" className="px-3 py-1.5 text-end font-medium">Ledger</th><th scope="col" className="py-1.5 ps-3 text-end font-medium">Difference</th></tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-t border-border">
                  <td className="py-1.5 pe-3">
                    {l.label}
                    {l.difference !== 0 && l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-end tabular-nums">{money(l.stock)}</td>
                  <td className="px-3 py-1.5 text-end tabular-nums">{money(l.ledger)}</td>
                  <td className={cn("py-1.5 ps-3 text-end tabular-nums", l.difference !== 0 && "font-semibold text-status-warning")}>{money(l.difference)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-1.5 pe-3">Total</td>
                <td className="px-3 py-1.5 text-end tabular-nums">{money(rec.stockValue)}</td>
                <td className="px-3 py-1.5 text-end tabular-nums">{money(rec.ledgerBalance)}</td>
                <td className="py-1.5 ps-3 text-end tabular-nums">{money(rec.difference)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </section>
  );
}

// ------------------------------------------------------------------ 1. valuation

function Valuation({ f, set, lookups }) {
  const search = useDebounced(f.search);
  const state = useAsync(
    () => stockReports.valuation({ asOn: f.asOn, categoryId: f.categoryId, search, groupBy: f.groupBy }),
    [f.asOn, f.categoryId, search, f.groupBy]
  );
  return (
    <>
      <DateRange value={{ from: "", to: f.asOn }} onChange={(v) => v.to && set({ asOn: v.to })} asAt />
      <FilterRow>
        <CategoryField value={f.categoryId} onChange={(categoryId) => set({ categoryId })} lookups={lookups} />
        <SearchField value={f.search} onChange={(s) => set({ search: s })} />
        <Segmented label="Group by" value={f.groupBy} onChange={(groupBy) => set({ groupBy })} options={[{ value: "item", label: "Item" }, { value: "category", label: "Category" }]} />
      </FilterRow>
      <Frame state={state} label="Valuing the stock">{(d) => <ValuationBody d={d} />}</Frame>
    </>
  );
}

function ValuationBody({ d }) {
  const rec = d.reconciliation;
  const byItem = d.groupBy === "item";
  const attention = d.totals.negativeItems + d.totals.outOfSyncItems;
  const columns = byItem
    ? [
        {
          key: "item", header: "Item", total: "Total",
          cell: (r) => (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <ItemCell r={r} />
              {r.negative && <Pill tone="danger">Negative stock</Pill>}
              {r.outOfSync && <Pill tone="warning">Item record shows {qty(r.recordedQty)}</Pill>}
            </span>
          ),
        },
        { key: "category", header: "Category", cell: (r) => r.categoryName, className: "text-muted-foreground" },
        { key: "qty", header: "Quantity", align: "end", cell: (r) => <>{qty(r.qty)}{r.unit && <span className="ms-1 text-xs text-muted-foreground">{r.unit}</span>}</> },
        { key: "avg", header: "Average cost", align: "end", cell: (r) => rate(r.avgCost) },
        { key: "value", header: "Value (AED)", align: "end", cell: (r) => money(r.value), total: money(d.totals.value) },
        { key: "share", header: "Share", align: "end", cell: (r) => pct(r.sharePct), className: "text-muted-foreground" },
      ]
    : [
        { key: "category", header: "Category", cell: (r) => <span className="font-medium text-foreground">{r.categoryName}</span>, total: "Total" },
        { key: "items", header: "Items", align: "end", cell: (r) => whole(r.items), total: whole(d.totals.items) },
        { key: "value", header: "Value (AED)", align: "end", cell: (r) => money(r.value), total: money(d.totals.value) },
        { key: "share", header: "Share", align: "end", cell: (r) => pct(r.sharePct), className: "text-muted-foreground" },
      ];

  function exportCsv() {
    const heads = byItem ? ["Code", "Item", "Category", "Unit", "Quantity", "Average cost", "Value", "Share %"] : ["Category", "Items", "Value", "Share %"];
    const rows = byItem
      ? d.rows.map((r) => [r.sku || r.itemId, r.itemName, r.categoryName, r.unit, r.qty, r.avgCost, r.value, r.sharePct ?? ""])
      : d.rows.map((r) => [r.categoryName, r.items, r.value, r.sharePct ?? ""]);
    const valueAt = heads.indexOf("Value");
    const pad = (label, v) => Array.from({ length: heads.length }, (_, i) => (i === 0 ? label : i === valueAt ? v : ""));
    downloadCSV(`stock-valuation-${d.asOn}.csv`, heads, [
      ...rows,
      pad("Total", d.totals.value),
      ...(rec?.available ? [pad("Inventory account in the ledger", rec.ledgerBalance), pad("Difference (stock less ledger)", rec.difference)] : []),
    ]);
  }

  return (
    <div>
      <Cards>
        <StatCard title="Stock value" count={money(d.totals.value)} subText={`AED as at ${formatDate(d.asOn)}`} tone="teal" />
        <StatCard title="Items in stock" count={whole(d.totals.items)} subText={attention ? `${whole(attention)} need a look` : "with stock on hand"} tone={attention ? "warning" : "neutral"} />
        <StatCard title="Inventory account" count={rec?.available ? money(rec.ledgerBalance) : "–"} subText={rec?.available ? "AED per the ledger" : "Not set up"} tone="plum" />
        <StatCard title="Difference" count={rec?.available ? money(rec.difference) : "–"} subText={rec?.available ? (rec.reconciles ? "Stock agrees with the ledger" : "AED, stock less ledger") : "Cannot compare"} tone={rec?.available && !rec.reconciles ? "warning" : "olive"} />
      </Cards>
      <Reconciliation rec={rec} label="as at this date" />
      <ReportPanel title={byItem ? "Stock by item" : "Stock by category"} onCsv={exportCsv} csvDisabled={!d.rows.length}>
        {d.rows.length === 0 ? (
          <EmptyState title="No stock on hand" text="Nothing was in stock on this date for the chosen filters." />
        ) : (
          <ReportTable caption={byItem ? "Stock valuation by item" : "Stock valuation by category"} columns={columns} rows={d.rows} rowKey={(r) => r.stockId || r.itemId || r.categoryId || r.categoryName} />
        )}
      </ReportPanel>
    </div>
  );
}

// ------------------------------------------------------------------ 2. movement

const MOVES = [
  { key: "purchases", label: "Purchases", sign: 1 },
  { key: "salesReturns", label: "Sales returns", sign: 1 },
  { key: "purchaseReturns", label: "Purchase returns", sign: -1 },
  { key: "sales", label: "Sales", sign: -1 },
  { key: "writeOffs", label: "Write-offs", sign: -1 },
  { key: "adjustments", label: "Adjustments", sign: 1 },
];

const SIGN = Object.fromEntries(MOVES.map((m) => [m.key, m.sign]));

function Movement({ f, set, lookups }) {
  const search = useDebounced(f.search);
  const state = useAsync(
    () => stockReports.movement({ from: f.range.from, to: f.range.to, categoryId: f.categoryId, search }),
    [f.range.from, f.range.to, f.categoryId, search]
  );
  return (
    <>
      <DateRange value={f.range} onChange={(range) => set({ range })} />
      <FilterRow>
        <CategoryField value={f.categoryId} onChange={(categoryId) => set({ categoryId })} lookups={lookups} />
        <SearchField value={f.search} onChange={(s) => set({ search: s })} />
        <Segmented label="Show" value={f.view} onChange={(view) => set({ view })} options={[{ value: "qty", label: "Quantity" }, { value: "value", label: "Value" }]} />
      </FilterRow>
      <Frame state={state} label="Working out the movement">{(d) => <MovementBody d={d} view={f.view} />}</Frame>
    </>
  );
}

function MovementBody({ d, view }) {
  const isQty = view === "qty";
  const fmt = isQty ? qty : money;
  const pick = (x, key) => x[key][isQty ? "qty" : "value"];
  const columns = [
    { key: "item", header: "Item", cell: (r) => <ItemCell r={r} />, total: "Total" },
    { key: "opening", header: "Opening", align: "end", cell: (r) => fmt(pick(r, "opening")), total: fmt(pick(d.totals, "opening")) },
    ...MOVES.map((m) => ({
      key: m.key, header: m.label, align: "end",
      cell: (r) => { const v = pick(r, m.key) * m.sign; return v === 0 ? "–" : fmt(v); },
      total: fmt(pick(d.totals, m.key) * m.sign),
    })),
    { key: "closing", header: "Closing", align: "end", cell: (r) => <span className="font-medium text-foreground">{fmt(pick(r, "closing"))}</span>, total: fmt(pick(d.totals, "closing")) },
  ];

  function exportCsv() {
    const keys = ["opening", ...MOVES.map((m) => m.key), "closing"];
    const names = ["Opening", ...MOVES.map((m) => m.label), "Closing"];
    const heads = ["Code", "Item", "Category", ...names.map((n) => `${n} qty`), ...names.map((n) => `${n} value`)];
    const cells = (x) => [...keys.map((k) => x[k].qty * (SIGN[k] ?? 1) || 0), ...keys.map((k) => x[k].value * (SIGN[k] ?? 1) || 0)];
    downloadCSV(`stock-movement-${d.from}-${d.to}.csv`, heads, [
      ...d.rows.map((r) => [r.sku || r.itemId, r.itemName, r.categoryName, ...cells(r)]),
      ["", "Total", "", ...cells(d.totals)],
    ]);
  }

  const t = d.totals;
  return (
    <div>
      <Cards>
        <StatCard title="Opening stock" count={money(t.opening.value)} subText={`AED on ${formatDate(d.from)}`} tone="neutral" />
        <StatCard title="Purchases" count={money(t.purchases.value)} subText="AED received from vendors" tone="olive" />
        <StatCard title="Cost of goods sold" count={money(t.sales.value)} subText="AED at average cost" tone="rose" />
        <StatCard title="Closing stock" count={money(t.closing.value)} subText={`AED on ${formatDate(d.to)}`} tone="teal" />
      </Cards>
      <Reconciliation rec={d.reconciliation} label={`on ${formatDate(d.to)}`} />
      <ReportPanel
        title={isQty ? "Quantity movement" : "Value movement (AED)"}
        description="Opening plus what came in, less what went out, is the closing figure. Outflows are shown as negatives."
        onCsv={exportCsv} csvDisabled={!d.rows.length}
      >
        {d.rows.length === 0 ? (
          <EmptyState title="No stock movement" text="There was no stock on hand and no movement in this period for the chosen filters." />
        ) : (
          <ReportTable caption="Stock movement by item" columns={columns} rows={d.rows} rowKey={(r) => r.stockId || r.itemId} />
        )}
      </ReportPanel>
    </div>
  );
}

// ------------------------------------------------------------------ 3. item ledger

function ItemLedger({ f, set, lookups }) {
  const options = useMemo(
    () => (lookups.data?.items || []).filter((i) => i.id).map((i) => ({ value: i.id, label: i.name, hint: i.sku || i.code, searchText: `${i.code} ${i.sku}` })),
    [lookups.data]
  );
  const state = useAsync(
    () => (f.itemId ? stockReports.itemLedger({ itemId: f.itemId, from: f.range.from, to: f.range.to }) : Promise.resolve(null)),
    [f.itemId, f.range.from, f.range.to]
  );
  return (
    <>
      <FilterRow>
        <Field label="Item" className="w-full sm:w-80">
          <SearchSelect value={f.itemId} onChange={(itemId) => set({ itemId })} options={options} placeholder="Choose an item" loading={lookups.loading} />
        </Field>
      </FilterRow>
      <DateRange value={f.range} onChange={(range) => set({ range })} />
      {!f.itemId ? (
        <Panel><EmptyState title="Choose an item" text="Pick an item to see every movement of it, with the running quantity and value." /></Panel>
      ) : (
        <Frame state={state} label="Reading the item ledger">{(d) => <LedgerBody d={d} />}</Frame>
      )}
    </>
  );
}

function LedgerBody({ d }) {
  const unit = d.item.unit ? ` ${d.item.unit}` : "";
  const columns = [
    { key: "date", header: "Date", cell: (r) => formatDate(r.date), total: "Closing balance", className: "whitespace-nowrap" },
    { key: "doc", header: "Document", cell: (r) => <span className="font-mono text-xs">{r.documentNo}</span> },
    { key: "type", header: "Type", cell: (r) => r.typeLabel },
    { key: "party", header: "Party", cell: (r) => r.partyName || "–", className: "text-muted-foreground" },
    { key: "batch", header: "Batch", cell: (r) => r.batchNo || "–", className: "text-muted-foreground" },
    { key: "in", header: "Qty in", align: "end", cell: (r) => (r.qtyIn ? qty(r.qtyIn) : ""), total: qty(d.totals.qtyIn) },
    { key: "out", header: "Qty out", align: "end", cell: (r) => (r.qtyOut ? qty(r.qtyOut) : ""), total: qty(d.totals.qtyOut) },
    { key: "cost", header: "Unit cost", align: "end", cell: (r) => rate(r.unitCost) },
    { key: "bq", header: "Balance qty", align: "end", cell: (r) => qty(r.balanceQty), total: qty(d.closing.qty) },
    { key: "bv", header: "Balance value", align: "end", cell: (r) => money(r.balanceValue), total: money(d.closing.value) },
  ];
  const opening = (
    <tr className="border-t border-border bg-secondary/30 font-medium">
      <td className="ps-5 pe-3 py-2" colSpan={8}>Opening balance{d.from ? ` on ${formatDate(d.from)}` : ""}</td>
      <td className="px-3 py-2 text-end tabular-nums">{qty(d.opening.qty)}</td>
      <td className="pe-5 ps-3 py-2 text-end tabular-nums">{money(d.opening.value)}</td>
    </tr>
  );

  function exportCsv() {
    downloadCSV(
      `item-ledger-${d.item.sku || d.item.itemId}-${d.from || "start"}-${d.to}.csv`,
      ["Date", "Document", "Type", "Party", "Batch", "Qty in", "Qty out", "Unit cost", "Balance qty", "Balance value"],
      [
        ["", "Opening balance", "", "", "", "", "", "", d.opening.qty, d.opening.value],
        ...d.rows.map((r) => [formatDate(r.date), r.documentNo, r.typeLabel, r.partyName, r.batchNo, r.qtyIn || "", r.qtyOut || "", r.unitCost, r.balanceQty, r.balanceValue]),
        ["", "Closing balance", "", "", "", d.totals.qtyIn, d.totals.qtyOut, d.closing.avgCost, d.closing.qty, d.closing.value],
      ]
    );
  }

  return (
    <div>
      <Cards>
        <StatCard title="Opening" count={`${qty(d.opening.qty)}${unit}`} subText={`AED ${money(d.opening.value)}`} tone="neutral" />
        <StatCard title="Received" count={qty(d.totals.qtyIn)} subText={`AED ${money(d.totals.valueIn)}`} tone="olive" />
        <StatCard title="Issued" count={qty(d.totals.qtyOut)} subText={`AED ${money(d.totals.valueOut)}`} tone="rose" />
        <StatCard title="Closing" count={`${qty(d.closing.qty)}${unit}`} subText={`AED ${money(d.closing.value)} at ${rate(d.closing.avgCost)} each`} tone="teal" />
      </Cards>
      <ReportPanel title={d.item.itemName} description={`${d.item.sku ? `${d.item.sku} · ` : ""}${d.item.categoryName}. Reversed documents are not listed: they cancel out.`} onCsv={exportCsv}>
        <ReportTable caption={`Stock ledger of ${d.item.itemName}`} columns={columns} rows={d.rows} rowKey={(r) => r.id} head={opening} />
        {d.rows.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No movement in this period.</p>}
        {d.truncated && <p className="px-5 py-3 text-xs text-muted-foreground">Only the first {whole(d.rows.length)} movements are listed. Narrow the dates to see the rest; the totals cover them all.</p>}
      </ReportPanel>
    </div>
  );
}

// ------------------------------------------------------------------ 4. sales / purchase analysis

function SalesAnalysis({ f, set, lookups }) {
  const search = useDebounced(f.search);
  const state = useAsync(
    () => stockReports.salesAnalysis({ from: f.range.from, to: f.range.to, groupBy: f.groupBy, direction: f.direction, categoryId: f.categoryId, search }),
    [f.range.from, f.range.to, f.groupBy, f.direction, f.categoryId, search]
  );
  const sales = f.direction === "sales";
  return (
    <>
      <DateRange value={f.range} onChange={(range) => set({ range })} />
      <FilterRow>
        <Segmented label="Direction" value={f.direction} onChange={(direction) => set({ direction })} options={[{ value: "sales", label: "Sales" }, { value: "purchases", label: "Purchases" }]} />
        <Segmented
          label="Group by" value={f.groupBy} onChange={(groupBy) => set({ groupBy })}
          options={[{ value: "item", label: "Item" }, { value: "category", label: "Category" }, { value: "customer", label: sales ? "Customer" : "Vendor" }]}
        />
        <CategoryField value={f.categoryId} onChange={(categoryId) => set({ categoryId })} lookups={lookups} />
        <SearchField value={f.search} onChange={(s) => set({ search: s })} />
      </FilterRow>
      <Frame state={state} label="Analysing documents">{(d) => <AnalysisBody d={d} />}</Frame>
    </>
  );
}

function AnalysisBody({ d }) {
  const sales = d.direction === "sales";
  const groupLabel = { item: "Item", category: "Category", customer: "Customer", vendor: "Vendor" }[d.groupBy];
  const t = d.totals;
  const nameCell = (r) => (d.groupBy === "item" ? <ItemCell r={r} /> : <span className="font-medium text-foreground">{r.name}</span>);
  const marginTone = (v) => (v !== null && v < 0 ? "text-status-danger" : "");

  const columns = sales
    ? [
        { key: "name", header: groupLabel, cell: nameCell, total: "Total" },
        { key: "qty", header: "Net quantity", align: "end", cell: (r) => qty(r.quantity), total: qty(t.quantity) },
        { key: "rev", header: "Net revenue", align: "end", cell: (r) => money(r.netRevenue), total: money(t.netRevenue) },
        { key: "cogs", header: "Cost of goods sold", align: "end", cell: (r) => money(r.cogs), total: money(t.cogs) },
        { key: "gp", header: "Gross profit", align: "end", cell: (r) => <span className={r.grossProfit < 0 ? "text-status-danger" : ""}>{money(r.grossProfit)}</span>, total: money(t.grossProfit) },
        { key: "margin", header: "Margin", align: "end", cell: (r) => <span className={marginTone(r.marginPct)}>{pct(r.marginPct)}</span>, total: pct(t.marginPct) },
        { key: "share", header: "Share", align: "end", cell: (r) => pct(r.sharePct), className: "text-muted-foreground" },
      ]
    : [
        { key: "name", header: groupLabel, cell: nameCell, total: "Total" },
        { key: "qty", header: "Net quantity", align: "end", cell: (r) => qty(r.quantity), total: qty(t.quantity) },
        { key: "val", header: "Net purchases", align: "end", cell: (r) => money(r.netValue), total: money(t.netValue) },
        { key: "avg", header: "Average price paid", align: "end", cell: (r) => (r.avgPrice === null ? "–" : rate(r.avgPrice)), total: t.avgPrice === null ? "–" : rate(t.avgPrice) },
        ...(d.groupBy === "vendor" ? [] : [{ key: "vendors", header: "Vendors", align: "end", cell: (r) => whole(r.vendors), total: whole(t.vendors) }]),
        { key: "share", header: "Share", align: "end", cell: (r) => pct(r.sharePct), className: "text-muted-foreground" },
      ];

  function exportCsv() {
    const heads = sales
      ? [groupLabel, "Code", "Net quantity", "Net revenue", "Cost of goods sold", "Gross profit", "Margin %", "Share %"]
      : [groupLabel, "Code", "Net quantity", "Net purchases", "Average price paid", ...(d.groupBy === "vendor" ? [] : ["Vendors"]), "Share %"];
    const rows = d.rows.map((r) =>
      sales
        ? [r.name, r.code, r.quantity, r.netRevenue, r.cogs, r.grossProfit, r.marginPct ?? "", r.sharePct ?? ""]
        : [r.name, r.code, r.quantity, r.netValue, r.avgPrice ?? "", ...(d.groupBy === "vendor" ? [] : [r.vendors]), r.sharePct ?? ""]
    );
    const total = sales
      ? ["Total", "", t.quantity, t.netRevenue, t.cogs, t.grossProfit, t.marginPct ?? "", ""]
      : ["Total", "", t.quantity, t.netValue, t.avgPrice ?? "", ...(d.groupBy === "vendor" ? [] : [t.vendors]), ""];
    downloadCSV(`${sales ? "sales" : "purchase"}-analysis-${d.groupBy}-${d.from}-${d.to}.csv`, heads, [...rows, total]);
  }

  return (
    <div>
      <Cards>
        {sales ? (
          <>
            <StatCard title="Net revenue" count={money(t.netRevenue)} subText="AED, VAT excluded, returns deducted" tone="olive" />
            <StatCard title="Cost of goods sold" count={money(t.cogs)} subText="AED, actual cost of the stock sold" tone="rose" />
            <StatCard title="Gross profit" count={money(t.grossProfit)} subText="AED" tone={t.grossProfit < 0 ? "danger" : "teal"} />
            <StatCard title="Margin" count={pct(t.marginPct)} subText={`${whole(t.documents)} ${t.documents === 1 ? "document" : "documents"}`} tone={t.marginPct !== null && t.marginPct < 0 ? "danger" : "plum"} />
          </>
        ) : (
          <>
            <StatCard title="Net purchases" count={money(t.netValue)} subText="AED, VAT excluded, returns deducted" tone="olive" />
            <StatCard title="Returned to vendors" count={money(t.returned)} subText="AED" tone="rose" />
            <StatCard title="Average price paid" count={t.avgPrice === null ? "–" : rate(t.avgPrice)} subText="AED per unit, all items" tone="teal" />
            <StatCard title="Vendors" count={whole(t.vendors)} subText={`${whole(t.documents)} ${t.documents === 1 ? "document" : "documents"}`} tone="plum" />
          </>
        )}
      </Cards>
      <ReportPanel
        title={`${sales ? "Sales" : "Purchases"} by ${groupLabel.toLowerCase()}`}
        description={sales ? "Revenue excludes VAT and is net of sales returns. Cost is the actual cost stamped on each stock movement, not an estimate." : "Values exclude VAT and are net of purchase returns."}
        onCsv={exportCsv} csvDisabled={!d.rows.length}
      >
        {d.rows.length === 0 ? (
          <EmptyState title={sales ? "No sales" : "No purchases"} text="No approved documents match this period and these filters." />
        ) : (
          <ReportTable caption={`${sales ? "Sales" : "Purchases"} by ${groupLabel.toLowerCase()}`} columns={columns} rows={d.rows} rowKey={(r) => r.key} />
        )}
      </ReportPanel>
    </div>
  );
}

// ------------------------------------------------------------------ 5. expiry

function Expiry({ f, set, lookups }) {
  const search = useDebounced(f.search);
  const valid = /^\d+$/.test(f.withinDays);
  const state = useAsync(
    () => (valid ? stockReports.expiry({ withinDays: f.withinDays, categoryId: f.categoryId, search }) : Promise.resolve(null)),
    [valid, f.withinDays, f.categoryId, search]
  );
  return (
    <>
      <FilterRow>
        <DaysField label="Expiring within (days)" value={f.withinDays} onChange={(withinDays) => set({ withinDays })} choices={[7, 30, 60, 90]} valid={valid} invalidText="Enter a whole number of days, 0 or more" />
        <CategoryField value={f.categoryId} onChange={(categoryId) => set({ categoryId })} lookups={lookups} />
        <SearchField value={f.search} onChange={(s) => set({ search: s })} />
      </FilterRow>
      {valid ? <Frame state={state} label="Checking batches">{(d) => <ExpiryBody d={d} />}</Frame> : null}
    </>
  );
}

function ExpiryBody({ d }) {
  const t = d.totals;
  const dayPill = (r) => {
    if (r.expired) return <Pill tone="danger">{r.daysToExpiry === 0 ? "Expired today" : `Expired ${whole(Math.abs(r.daysToExpiry))} ${Math.abs(r.daysToExpiry) === 1 ? "day" : "days"} ago`}</Pill>;
    return <Pill tone={r.daysToExpiry <= 7 ? "warning" : "neutral"}>{r.daysToExpiry === 0 ? "Today" : `${whole(r.daysToExpiry)} ${r.daysToExpiry === 1 ? "day" : "days"}`}</Pill>;
  };
  const columns = [
    { key: "batch", header: "Batch", cell: (r) => <span className="font-mono text-xs">{r.batchNumber}</span>, total: "Total" },
    { key: "item", header: "Item", cell: (r) => <ItemCell r={r} /> },
    { key: "qty", header: "On hand", align: "end", cell: (r) => <>{qty(r.qtyOnHand)}{r.unit && <span className="ms-1 text-xs text-muted-foreground">{r.unit}</span>}</> },
    { key: "date", header: "Expiry date", cell: (r) => formatDate(r.expiryDate), className: "whitespace-nowrap" },
    { key: "days", header: "Time left", cell: (r) => dayPill(r) },
    { key: "cost", header: "Unit cost", align: "end", cell: (r) => rate(r.unitCost) },
    { key: "value", header: "Value at cost (AED)", align: "end", cell: (r) => money(r.valueAtCost), total: money(t.value) },
    { key: "fefo", header: "Sell order", align: "end", cell: (r) => `#${r.fefoRank}`, className: "text-muted-foreground" },
  ];

  function exportCsv() {
    downloadCSV(
      `batch-expiry-within-${d.withinDays}-days-${d.asOn}.csv`,
      ["Batch", "Code", "Item", "Quantity on hand", "Expiry date", "Days to expiry", "Expired", "Unit cost", "Value at cost", "Sell order (FEFO)", "Received on document"],
      [
        ...d.rows.map((r) => [r.batchNumber, r.sku || r.itemId, r.itemName, r.qtyOnHand, formatDate(r.expiryDate), r.daysToExpiry, r.expired ? "Yes" : "No", r.unitCost, r.valueAtCost, r.fefoRank, r.sourceTransactionNo]),
        ["Total", "", "", "", "", "", "", "", t.value, "", ""],
      ]
    );
  }

  return (
    <div>
      <Cards>
        <StatCard title="Expired, value at risk" count={money(t.expired.value)} subText={`AED in ${whole(t.expired.batches)} ${t.expired.batches === 1 ? "batch" : "batches"}`} tone={t.expired.value > 0 ? "danger" : "neutral"} />
        <StatCard title={`Expiring within ${whole(d.withinDays)} days`} count={money(t.expiring.value)} subText={`AED in ${whole(t.expiring.batches)} ${t.expiring.batches === 1 ? "batch" : "batches"}`} tone={t.expiring.value > 0 ? "warning" : "neutral"} />
        <StatCard title="Batches listed" count={whole(t.batches)} subText={`across ${whole(t.items)} ${t.items === 1 ? "item" : "items"}`} tone="neutral" />
        <StatCard title="Total value at cost" count={money(t.value)} subText="AED, expired and expiring" tone="teal" />
      </Cards>
      <ReportPanel
        title="Batches by expiry"
        description="Soonest expiry first, which is the order stock is sold. Value is quantity at the item's current average cost, what writing it off would cost."
        onCsv={exportCsv} csvDisabled={!d.rows.length}
      >
        {d.rows.length === 0 ? (
          <EmptyState title="Nothing expiring" text={`No batch with stock on hand has expired or expires within ${whole(d.withinDays)} days.`} />
        ) : (
          <ReportTable caption="Batches expiring or expired" columns={columns} rows={d.rows} rowKey={(r) => r.batchId} />
        )}
      </ReportPanel>
    </div>
  );
}

// ------------------------------------------------------------------ 6. slow stock

function SlowStock({ f, set, lookups }) {
  const search = useDebounced(f.search);
  const valid = /^[1-9]\d*$/.test(f.days);
  const state = useAsync(
    () => (valid ? stockReports.slowMoving({ days: f.days, categoryId: f.categoryId, search }) : Promise.resolve(null)),
    [valid, f.days, f.categoryId, search]
  );
  return (
    <>
      <FilterRow>
        <DaysField label="No sale in (days)" value={f.days} onChange={(days) => set({ days })} choices={[30, 60, 90, 180]} valid={valid} invalidText="Enter a whole number of days, 1 or more" />
        <CategoryField value={f.categoryId} onChange={(categoryId) => set({ categoryId })} lookups={lookups} />
        <SearchField value={f.search} onChange={(s) => set({ search: s })} />
      </FilterRow>
      {valid ? <Frame state={state} label="Looking for slow stock">{(d) => <SlowBody d={d} />}</Frame> : null}
    </>
  );
}

function SlowBody({ d }) {
  const t = d.totals;
  const columns = [
    { key: "rank", header: "#", cell: (r) => d.rows.indexOf(r) + 1, className: "text-muted-foreground", total: "Total" },
    { key: "item", header: "Item", cell: (r) => <ItemCell r={r} /> },
    { key: "category", header: "Category", cell: (r) => r.categoryName, className: "text-muted-foreground" },
    { key: "qty", header: "On hand", align: "end", cell: (r) => <>{qty(r.qty)}{r.unit && <span className="ms-1 text-xs text-muted-foreground">{r.unit}</span>}</> },
    { key: "cost", header: "Average cost", align: "end", cell: (r) => rate(r.avgCost) },
    { key: "value", header: "Value (AED)", align: "end", cell: (r) => money(r.value), total: money(t.value) },
    { key: "last", header: "Last sale", cell: (r) => (r.neverSold ? <Pill tone="warning">Never sold</Pill> : formatDate(r.lastSaleDate)), className: "whitespace-nowrap" },
    { key: "since", header: "Days idle", align: "end", cell: (r) => (r.daysSince === null ? "–" : whole(r.daysSince)), total: "" },
  ];

  function exportCsv() {
    downloadCSV(
      `slow-stock-${d.days}-days-${d.asOn}.csv`,
      ["Rank", "Code", "Item", "Category", "Unit", "Quantity", "Average cost", "Value", "Last sale", "Never sold", "Days idle"],
      [
        ...d.rows.map((r, i) => [i + 1, r.sku || r.itemId, r.itemName, r.categoryName, r.unit, r.qty, r.avgCost, r.value, r.lastSaleDate ? formatDate(r.lastSaleDate) : "", r.neverSold ? "Yes" : "No", r.daysSince ?? ""]),
        ["", "", "Total", "", "", "", "", t.value, "", "", ""],
      ]
    );
  }

  return (
    <div>
      <Cards>
        <StatCard title="Slow stock value" count={money(t.value)} subText={`AED, no sale in ${whole(d.days)} days`} tone={t.value > 0 ? "warning" : "neutral"} />
        <StatCard title="Items" count={whole(t.items)} subText="with stock and no recent sale" tone="neutral" />
        <StatCard title="Never sold" count={whole(t.neverSold)} subText="aged from their first receipt" tone="plum" />
        <StatCard title="Share of stock value" count={pct(t.pctOfStockValue)} subText={`of AED ${money(t.stockValue)} in stock`} tone="teal" />
      </Cards>
      <ReportPanel title="Slow-moving stock" description="Largest value first. An item that has never sold counts from the day it was first received." onCsv={exportCsv} csvDisabled={!d.rows.length}>
        {d.rows.length === 0 ? (
          <EmptyState title="No slow stock" text={`Every item with stock on hand has sold, or arrived, within the last ${whole(d.days)} days.`} />
        ) : (
          <ReportTable caption="Slow-moving stock" columns={columns} rows={d.rows} rowKey={(r) => r.stockId || r.itemId} />
        )}
      </ReportPanel>
    </div>
  );
}

// ------------------------------------------------------------------ 7. reorder

const STATUS = { out: { tone: "danger", label: "Out of stock" }, below: { tone: "warning", label: "Below level" }, at: { tone: "neutral", label: "At level" } };

function Reorder({ f, set, lookups }) {
  const search = useDebounced(f.search);
  const state = useAsync(() => stockReports.reorder({ categoryId: f.categoryId, search }), [f.categoryId, search]);
  return (
    <>
      <FilterRow>
        <CategoryField value={f.categoryId} onChange={(categoryId) => set({ categoryId })} lookups={lookups} />
        <SearchField value={f.search} onChange={(s) => set({ search: s })} />
      </FilterRow>
      <Frame state={state} label="Checking reorder levels">{(d) => <ReorderBody d={d} />}</Frame>
    </>
  );
}

function ReorderBody({ d }) {
  const t = d.totals;
  const columns = [
    { key: "item", header: "Item", cell: (r) => <ItemCell r={r} />, total: "Total" },
    { key: "category", header: "Category", cell: (r) => r.categoryName, className: "text-muted-foreground" },
    { key: "qty", header: "On hand", align: "end", cell: (r) => <>{qty(r.qty)}{r.unit && <span className="ms-1 text-xs text-muted-foreground">{r.unit}</span>}</> },
    { key: "level", header: "Reorder level", align: "end", cell: (r) => qty(r.reorderLevel) },
    { key: "short", header: "Shortfall", align: "end", cell: (r) => qty(r.shortfall) },
    { key: "cost", header: "Average cost", align: "end", cell: (r) => rate(r.avgCost) },
    { key: "value", header: "Shortfall at cost (AED)", align: "end", cell: (r) => money(r.shortfallValue), total: money(t.shortfallValue) },
    { key: "vendor", header: "Usual vendor", cell: (r) => r.vendorName || "–", className: "text-muted-foreground" },
    { key: "status", header: "Status", cell: (r) => <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill> },
  ];

  function exportCsv() {
    downloadCSV(
      "reorder.csv",
      ["Code", "Item", "Category", "Unit", "On hand", "Reorder level", "Shortfall", "Average cost", "Shortfall at cost", "Usual vendor", "Status"],
      [
        ...d.rows.map((r) => [r.sku || r.itemId, r.itemName, r.categoryName, r.unit, r.qty, r.reorderLevel, r.shortfall, r.avgCost, r.shortfallValue, r.vendorName, STATUS[r.status].label]),
        ["", "Total", "", "", "", "", "", "", t.shortfallValue, "", ""],
      ]
    );
  }

  return (
    <div>
      <Cards>
        <StatCard title="Items to reorder" count={whole(t.items)} subText="at or below their reorder level" tone={t.items ? "warning" : "neutral"} />
        <StatCard title="Out of stock" count={whole(t.outOfStock)} subText="with a reorder level set" tone={t.outOfStock ? "danger" : "neutral"} />
        <StatCard title="Shortfall at cost" count={money(t.shortfallValue)} subText="AED to get back to the level" tone="teal" />
      </Cards>
      <ReportPanel title="Items to reorder" description="Quantity on the item record against the reorder level set on it. Items without a level are not listed." onCsv={exportCsv} csvDisabled={!d.rows.length}>
        {d.rows.length === 0 ? (
          <EmptyState title="Nothing to reorder" text="Every active item with a reorder level is above it." />
        ) : (
          <ReportTable caption="Items at or below their reorder level" columns={columns} rows={d.rows} rowKey={(r) => r.stockId || r.itemId} />
        )}
      </ReportPanel>
    </div>
  );
}
