import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import axiosInstance from "../../axios/axios";
import { tradeReports } from "../../lib/tradeReportsApi";
import { stockReports } from "../../lib/stockReportsApi";
import { VIEWS, monthLabel, monthOfRange, monthRange, movementExport, recentMonths, registerExport, summaryExport } from "../../lib/tradeReports";
import { CURRENCY, downloadCSV, formatDate, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { EmptyState, Field, PageHeader, Panel, Pill, SearchSelect, Select, Spinner, TextInput, useAsync } from "../accounting/kit";
import { DateRange, Frame, monthStart } from "./reportKit";
import { useOrganisation } from "../shell/OrganisationContext";
import { taxWord } from "../../lib/taxTerms";

const money = (n) => formatNumber(n, 2);
const qty = (n) => formatNumber(n, 3).replace(/\.?0+$/, "");

// Sales and purchases by customer / vendor and by item, who bought which items, a month-by-month view, the line register,
// and receivables / payables movement per party. Everything reads approved documents (a draft is not in the books) with
// returns taken off; see services/reports/tradeReportsService.js. Date range and month are the organisation's own days.
const TABS = ["sales", "purchases", "receivables", "payables"];

export default function TradeReports() {
  const [params, setParams] = useSearchParams();
  // what customers owe and vendors are owed is the books, which a person who may only read reports does not hold
  const { canAny } = useOrganisation();
  const mayBooks = canAny(["reports.financial", "finance.view"]);
  const asked = params.get("tab");
  const tab = TABS.includes(asked) && (mayBooks || !["receivables", "payables"].includes(asked)) ? asked : "sales";
  const today = todayInput();
  const [range, setRange] = useState({ from: monthStart(today), to: today });
  const month = monthOfRange(range.from, range.to);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Sales and purchase analysis"
        description="Which customers bought which items, which vendors supplied them, and what each party owes or is owed, by date or month. Approved documents only, with returns taken off."
      />
      <div className="flex flex-wrap items-end gap-x-4">
        <DateRange value={range} onChange={setRange} />
        <Field label="Month" className="mb-4 w-full sm:mb-5 sm:w-44">
          <Select value={month} onChange={(e) => e.target.value && setRange(monthRange(e.target.value))}>
            <option value="">Custom range</option>
            {recentMonths(today, 24).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </Select>
        </Field>
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="erp-scroll table-pin-first overflow-x-auto">
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            {mayBooks && <TabsTrigger value="receivables">Receivables</TabsTrigger>}
            {mayBooks && <TabsTrigger value="payables">Payables</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="sales">{tab === "sales" && <Trade direction="sales" range={range} />}</TabsContent>
        <TabsContent value="purchases">{tab === "purchases" && <Trade direction="purchases" range={range} />}</TabsContent>
        <TabsContent value="receivables">{tab === "receivables" && <Movement type="customer" range={range} />}</TabsContent>
        <TabsContent value="payables">{tab === "payables" && <Movement type="vendor" range={range} />}</TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ sales / purchases
function Trade({ direction, range }) {
  const sales = direction === "sales";
  const who = sales ? "customer" : "vendor";
  const [view, setView] = useState("party");
  const [monthly, setMonthly] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [itemId, setItemId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const lookups = useAsync(() => stockReports.lookups(), []);
  const parties = useAsync(() => axiosInstance.get(sales ? "/customers/customers" : "/vendors/vendors").then((r) => r.data?.data || []), [direction]);
  const partyOptions = useMemo(
    () => (parties.data || []).map((p) => ({ value: p._id, label: sales ? p.customerName : p.vendorName })).sort((a, b) => String(a.label).localeCompare(String(b.label))),
    [parties.data, sales]
  );
  const itemOptions = useMemo(() => (lookups.data?.items || []).map((i) => ({ value: i.id, label: `${i.name}${i.sku ? ` · ${i.sku}` : ""}` })), [lookups.data]);
  const categoryOptions = useMemo(() => (lookups.data?.categories || []).map((c) => ({ value: c.id, label: c.name })), [lookups.data]);

  const filters = { direction, from: range.from, to: range.to, partyId, itemId, categoryId, search: search.trim() };
  const isRegister = view === "register";
  const state = useAsync(
    () => (isRegister ? tradeReports.register({ ...filters, page, limit: 100 }) : tradeReports.summary({ ...filters, groupBy: view, monthly })),
    [direction, range.from, range.to, partyId, itemId, categoryId, search, view, monthly, page]
  );

  const reset = (fn) => (v) => { fn(v); setPage(1); };
  const drillParty = (id) => { setPartyId(id); setView("party_item"); setPage(1); };
  const drillItem = (id) => { setItemId(id); setView("party_item"); setPage(1); };
  const filtersOn = Boolean(partyId || itemId || categoryId || search);
  const clear = () => { setPartyId(""); setItemId(""); setCategoryId(""); setSearch(""); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="erp-scroll table-pin-first overflow-x-auto">
        <div role="tablist" aria-label="Report view" className="inline-flex rounded-full border border-border bg-card p-1">
          {VIEWS(direction).map((v) => (
            <button
              key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => { setView(v.id); setPage(1); }}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium lg:min-h-0 ${view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label={sales ? "Customer" : "Vendor"} className="w-full sm:w-64">
          <SearchSelect value={partyId} onChange={reset(setPartyId)} options={partyOptions} clearable placeholder={`All ${who}s`} loading={parties.loading} />
        </Field>
        <Field label="Item" className="w-full sm:w-64">
          <SearchSelect value={itemId} onChange={reset(setItemId)} options={itemOptions} clearable placeholder="All items" loading={lookups.loading} />
        </Field>
        <Field label="Category" className="w-full sm:w-52">
          <SearchSelect value={categoryId} onChange={reset(setCategoryId)} options={categoryOptions} clearable placeholder="All categories" loading={lookups.loading} />
        </Field>
        <Field label="Search" className="w-full sm:w-56">
          <TextInput type="search" aria-label="Search the report" placeholder="Name, code or number…" value={search} onChange={(e) => reset(setSearch)(e.target.value)} />
        </Field>
        {!isRegister && (
          <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
            <input type="checkbox" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
            Month by month
          </label>
        )}
        {filtersOn && <Button type="button" variant="outline" onClick={clear}>Clear filters</Button>}
      </div>

      <Frame state={state} label="Working out the report">
        {(data) => {
          // while the other view's figures load, the previous answer is still in hand: do not hand it to the wrong table
          if (Boolean(data.pagination) !== isRegister) return <Spinner label="Working out the report" />;
          return isRegister
            ? <Register data={data} page={page} setPage={setPage} />
            : <Summary data={data} view={view} partyLabel={sales ? "Customer" : "Vendor"} sales={sales} onParty={drillParty} onItem={drillItem} />;
        }}
      </Frame>
    </div>
  );
}

function Summary({ data: given, view, partyLabel, sales, onParty, onItem }) {
  const data = { ...given, rows: given.rows || [], months: given.months || [] };
  const t = { quantity: 0, gross: 0, returns: 0, net: 0, vat: 0, total: 0, documents: 0, parties: 0, items: 0, ...(given.totals || {}) };
  const months = data.monthly ? data.months : [];
  const exportCsv = () => {
    const [headers, rows] = summaryExport(data, partyLabel);
    downloadCSV(`${sales ? "sales" : "purchases"}-${view}-${data.from}-to-${data.to}.csv`, headers, rows);
  };
  if (!data.rows.length) return <EmptyState title="Nothing in this period" text="No approved documents match these dates and filters." />;
  const by = data.groupBy;
  const showParty = by === "party" || by === "party_item";
  const showItem = by === "item" || by === "party_item";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title={sales ? "Sales (net)" : "Purchases (net)"} count={money(t.net)} subText={`${CURRENCY} · ${taxWord()} ${money(t.vat)} · total ${money(t.total)}`} tone="teal" />
        <StatCard title="Returns" count={money(t.returns)} subText={`${CURRENCY} taken off`} tone={t.returns > 0 ? "warning" : "neutral"} />
        <StatCard title={sales ? "Customers" : "Vendors"} count={String(t.parties)} subText={`${t.documents} document${t.documents === 1 ? "" : "s"}`} tone="plum" />
        <StatCard title="Items" count={String(t.items)} subText={`${qty(t.quantity)} units net`} tone="neutral" />
      </div>
      {data.truncated && <p className="rounded-lg border border-status-warning/40 bg-status-warning-soft px-3 py-2 text-sm">This period holds more lines than a report reads at once. Narrow the dates or add a filter for complete figures.</p>}
      <Panel
        title={`${data.rows.length} ${data.rows.length === 1 ? "row" : "rows"}`}
        actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}
        bodyClassName="p-0"
      >
        <div className="erp-scroll table-pin-first overflow-x-auto">
          <table className="w-full text-sm" aria-label="Report">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {by === "month" && <th className="px-3 py-2 text-start">Month</th>}
                {showParty && <th className="px-3 py-2 text-start">{partyLabel}</th>}
                {showItem && <th className="px-3 py-2 text-start">Item</th>}
                <th className="px-3 py-2 text-end">Documents</th>
                <th className="px-3 py-2 text-end">Quantity</th>
                <th className="px-3 py-2 text-end">Avg price</th>
                <th className="px-3 py-2 text-end">Returns</th>
                <th className="px-3 py-2 text-end">Net</th>
                <th className="px-3 py-2 text-end">{taxWord()}</th>
                <th className="px-3 py-2 text-end">Total</th>
                <th className="px-3 py-2 text-end">Share</th>
                {months.map((m) => <th key={m} className="whitespace-nowrap px-3 py-2 text-end">{monthLabel(m)}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  {by === "month" && <td className="whitespace-nowrap px-3 py-2 font-medium">{monthLabel(r.month)}</td>}
                  {showParty && (
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => onParty(r.partyId)} className="text-start font-medium underline decoration-dotted underline-offset-2 hover:text-foreground" title="See the items">
                        {r.partyName}
                      </button>
                      <span className="block text-xs text-muted-foreground">{[r.partyCode, r.vatStatus === "registered" ? `${taxWord()} registered` : r.vatStatus === "unregistered" ? "Not registered" : r.vatStatus].filter(Boolean).join(" · ")}</span>
                    </td>
                  )}
                  {showItem && (
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => onItem(r.itemId)} className="text-start font-medium underline decoration-dotted underline-offset-2 hover:text-foreground" title={sales ? "See who bought it" : "See who supplied it"}>
                        {r.itemName}
                      </button>
                      <span className="block text-xs text-muted-foreground">{[r.itemCode, r.category].filter(Boolean).join(" · ")}</span>
                    </td>
                  )}
                  <td className="px-3 py-2 text-end tabular-nums">{r.documents}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{qty(r.quantity)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{r.avgPrice === null ? "-" : money(r.avgPrice)}</td>
                  <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{r.returns ? money(r.returns) : "-"}</td>
                  <td className="px-3 py-2 text-end font-medium tabular-nums">{money(r.net)}</td>
                  <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{money(r.vat)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{money(r.total)}</td>
                  <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{r.sharePct === null ? "-" : `${r.sharePct.toFixed(1)}%`}</td>
                  {months.map((m) => <td key={m} className="px-3 py-2 text-end tabular-nums text-muted-foreground">{r.monthly?.[m]?.net ? money(r.monthly[m].net) : "-"}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                <td className="px-3 py-2" colSpan={(by === "month" ? 1 : 0) + (showParty ? 1 : 0) + (showItem ? 1 : 0)}>Total</td>
                <td className="px-3 py-2 text-end tabular-nums">{t.documents}</td>
                <td className="px-3 py-2 text-end tabular-nums">{qty(t.quantity)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-end tabular-nums">{money(t.returns)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(t.net)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(t.vat)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(t.total)}</td>
                <td className="px-3 py-2" />
                {months.map((m) => (
                  <td key={m} className="px-3 py-2 text-end tabular-nums">{money(data.rows.reduce((s, r) => s + (r.monthly?.[m]?.net || 0), 0))}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Register({ data: given, page, setPage }) {
  const data = { ...given, rows: given.rows || [], pagination: given.pagination || { page: 1, pages: 1, total: 0 } };
  const t = { lines: 0, quantity: 0, net: 0, vat: 0, total: 0, ...(given.totals || {}) };
  const exportCsv = () => {
    const [headers, rows] = registerExport(data);
    downloadCSV(`${data.direction}-register-${data.from}-to-${data.to}.csv`, headers, rows);
  };
  if (!data.rows.length) return <EmptyState title="Nothing in this period" text="No approved documents match these dates and filters." />;
  return (
    <Panel
      title={`${t.lines} line${t.lines === 1 ? "" : "s"} · net ${money(t.net)} ${CURRENCY}`}
      actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV (this page)</Button>}
      bodyClassName="p-0"
    >
      <div className="erp-scroll table-pin-first overflow-x-auto">
        <table className="w-full text-sm" aria-label="Line register">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">Date</th>
              <th className="px-3 py-2 text-start">Document</th>
              <th className="px-3 py-2 text-start">{data.partyLabel}</th>
              <th className="px-3 py-2 text-start">Item</th>
              <th className="px-3 py-2 text-end">Quantity</th>
              <th className="px-3 py-2 text-end">Price</th>
              <th className="px-3 py-2 text-end">Net</th>
              <th className="px-3 py-2 text-end">{taxWord()}</th>
              <th className="px-3 py-2 text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={`${r.documentNo}-${r.itemId}-${i}`} className="border-t border-border">
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(r.date)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="font-mono text-xs font-semibold">{r.documentNo}</span>
                  {r.kind === "return" && <Pill tone="warning" className="ms-2">Return</Pill>}
                </td>
                <td className="px-3 py-2">{r.partyName}</td>
                <td className="px-3 py-2">
                  <span className="font-medium">{r.itemName}</span>
                  <span className="block text-xs text-muted-foreground">{[r.itemCode, r.category].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-3 py-2 text-end tabular-nums">{qty(r.quantity)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(r.price)}</td>
                <td className="px-3 py-2 text-end font-medium tabular-nums">{money(r.net)}</td>
                <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{money(r.vat)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
              <td className="px-3 py-2" colSpan={4}>Total of all {t.lines} lines</td>
              <td className="px-3 py-2 text-end tabular-nums">{qty(t.quantity)}</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-end tabular-nums">{money(t.net)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{money(t.vat)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{money(t.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {data.pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Page {data.pagination.page} of {data.pagination.pages}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= data.pagination.pages} onClick={() => setPage(page + 1)}>Next</Button>
          </span>
        </div>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------ receivables / payables
function Movement({ type, range }) {
  const customer = type === "customer";
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [includeZero, setIncludeZero] = useState(false);
  const state = useAsync(
    () => tradeReports.partyMovement({ type, from: range.from, to: range.to, search: search.trim(), includeZero }),
    [type, range.from, range.to, search, includeZero]
  );
  const label = customer ? "Customer" : "Vendor";
  const open = (r) => r.partyId && navigate(`/${customer ? "credit-accounts/customer" : "debit-accounts/vendor"}/${r.partyId}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Search" className="w-full sm:w-72">
          <TextInput type="search" aria-label={`Search ${label.toLowerCase()}s`} placeholder="Name, code or TRN…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
          <input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />
          Include parties with nothing in the period
        </label>
      </div>
      <Frame state={state} label="Working out the balances">
        {(given) => {
          const data = { ...given, rows: given.rows || [] };
          const t = { opening: 0, invoiced: 0, returns: 0, settled: 0, other: 0, closing: 0, overdue: 0, parties: 0, ...(given.totals || {}) };
          const exportCsv = () => {
            const [headers, rows] = movementExport(data, label);
            downloadCSV(`${customer ? "receivables" : "payables"}-${data.from}-to-${data.to}.csv`, headers, rows);
          };
          if (!data.rows.length) return <EmptyState title={`No ${customer ? "receivables" : "payables"} in this period`} text="Nothing was invoiced, settled or owed in these dates." />;
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title="Opening" count={money(t.opening)} subText={`${CURRENCY} at ${formatDate(data.from)}`} tone="neutral" />
                <StatCard title={customer ? "Invoiced" : "Purchased"} count={money(t.invoiced)} subText={`${CURRENCY} in the period`} tone="teal" />
                <StatCard title={customer ? "Received" : "Paid"} count={money(t.settled)} subText={`${CURRENCY} · returns ${money(t.returns)}`} tone="plum" />
                <StatCard title="Closing" count={money(t.closing)} subText={`${CURRENCY} · overdue ${money(t.overdue)}`} tone={t.overdue > 0 ? "warning" : "neutral"} />
              </div>
              <Panel
                title={`${t.parties} ${customer ? (t.parties === 1 ? "customer" : "customers") : (t.parties === 1 ? "vendor" : "vendors")}`}
                actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}
                bodyClassName="p-0"
              >
                <div className="erp-scroll table-pin-first overflow-x-auto">
                  <table className="w-full text-sm" aria-label={customer ? "Receivables" : "Payables"}>
                    <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-start">{label}</th>
                        <th className="px-3 py-2 text-end">Opening</th>
                        <th className="px-3 py-2 text-end">{customer ? "Invoiced" : "Purchased"}</th>
                        <th className="px-3 py-2 text-end">Returns</th>
                        <th className="px-3 py-2 text-end">{customer ? "Received" : "Paid"}</th>
                        <th className="px-3 py-2 text-end">Other</th>
                        <th className="px-3 py-2 text-end">Closing</th>
                        <th className="px-3 py-2 text-end">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.partyName} className="border-t border-border">
                          <td className="px-3 py-2">
                            {r.partyId ? (
                              <button type="button" onClick={() => open(r)} className="text-start font-medium underline decoration-dotted underline-offset-2 hover:text-foreground">{r.partyName}</button>
                            ) : <span className="font-medium">{r.partyName}</span>}
                            <span className="block text-xs text-muted-foreground">{[r.partyCode, r.vatStatus === "registered" ? `${taxWord()} registered` : "Not registered", r.paymentTerms].filter(Boolean).join(" · ")}</span>
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{money(r.opening)}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{money(r.invoiced)}</td>
                          <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{r.returns ? money(r.returns) : "-"}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{r.settled ? money(r.settled) : "-"}</td>
                          <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">{r.other ? money(r.other) : "-"}</td>
                          <td className="px-3 py-2 text-end font-medium tabular-nums">{money(r.closing)}</td>
                          <td className={`px-3 py-2 text-end tabular-nums ${r.overdue > 0 ? "font-medium text-status-danger" : "text-muted-foreground"}`}>{r.overdue ? money(r.overdue) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(t.opening)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(t.invoiced)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(t.returns)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(t.settled)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(t.other)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(t.closing)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(t.overdue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Panel>
              <p className="text-xs text-muted-foreground">
                Opening + {customer ? "invoiced" : "purchased"} − returns − {customer ? "received" : "paid"} ± other = closing. It is read from the ledger's {customer ? "customer" : "vendor"} accounts, so it agrees with{" "}
                <Link to="/party-balances" className="underline underline-offset-2">party balances</Link> and the <Link to="/ageing" className="underline underline-offset-2">ageing</Link>.
              </p>
            </>
          );
        }}
      </Frame>
    </div>
  );
}
