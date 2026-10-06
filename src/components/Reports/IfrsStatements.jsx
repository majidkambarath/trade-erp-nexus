import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Printer, TriangleAlert } from "lucide-react";
import { ifrs } from "../../lib/ifrsApi";
import {
  COMPARE_OPTIONS, TABS, buildDocument, documentCsv, fileSlug, formatAmount, isAsAtTab, isTab, keyFigures, printDocument, requestFor, warnings,
} from "../../lib/ifrsStatements";
import { downloadCSV, formatDate, todayInput } from "../../utils/format";
import { getBrand } from "../../config/brands";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Balance, DateInput, ErrorNote, Field, PageHeader, Panel, Select, Spinner, useAsync, useToasts } from "../accounting/kit";

const thisYear = () => todayInput().slice(0, 4);
const monthStart = () => `${todayInput().slice(0, 7)}-01`;
const GRID = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };

// The IFRS statement pack: financial position, profit or loss, changes in equity, cash flows and
// notes, all read from the general ledger with a comparative column. What each line is made of is
// in lib/ifrsStatements.js; this file only fetches, lays out, exports and prints.
export default function IfrsStatements() {
  const [params, setParams] = useSearchParams();
  const tab = isTab(params.get("tab")) ? params.get("tab") : "position";
  const [range, setRange] = useState({ from: `${thisYear()}-01-01`, to: todayInput() });
  const [compare, setCompare] = useState("prior-year");
  const [detail, setDetail] = useState(false);
  const asAt = isAsAtTab(tab);
  const hasDetail = tab === "position" || tab === "pl";
  const set = (k) => (e) => e.target.value && setRange((r) => ({ ...r, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="IFRS statements"
        description="Statement of financial position, profit or loss, changes in equity, cash flows and notes, prepared from the general ledger with a comparative period."
      />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        {!asAt && <Field label="From"><DateInput value={range.from} max={range.to} onChange={set("from")} className="w-44" /></Field>}
        <Field label={asAt ? "As at" : "To"}><DateInput value={range.to} min={asAt ? undefined : range.from} onChange={set("to")} className="w-44" /></Field>
        <Field label="Comparative" className="w-44">
          <Select value={compare} onChange={(e) => setCompare(e.target.value)}>
            {COMPARE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        {!asAt && (
          <>
            <Button variant="outline" size="sm" onClick={() => setRange({ from: monthStart(), to: todayInput() })}>This month</Button>
            <Button variant="outline" size="sm" onClick={() => setRange({ from: `${thisYear()}-01-01`, to: todayInput() })}>This year</Button>
            <Button variant="outline" size="sm" onClick={() => setRange({ from: `${Number(thisYear()) - 1}-01-01`, to: `${Number(thisYear()) - 1}-12-31` })}>Last year</Button>
          </>
        )}
        {hasDetail && (
          <label className="inline-flex h-10 items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} className="h-5 w-5 rounded lg:h-4 lg:w-4 border-input accent-[var(--primary)]" />
            Show account detail
          </label>
        )}
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="erp-scroll table-pin-first overflow-x-auto">
          <TabsList aria-label="IFRS statements">
            {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </div>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {tab === t.value && <StatementTab tab={t.value} range={range} compare={compare} detail={hasDetail && detail} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// One statement: fetch, headline figures, warnings, the tables, and the CSV / Print buttons.
// It is mounted per tab, so data from one statement is never laid out as another.
function StatementTab({ tab, range, compare, detail }) {
  const { method, params } = requestFor(tab, { ...range, compare });
  const key = JSON.stringify([method, params]);
  const state = useAsync(() => ifrs[method](params), [key]);
  const { toastNode, notify } = useToasts();
  const data = state.data;
  const doc = useMemo(() => (data ? buildDocument(tab, data, { detail }) : null), [tab, data, detail]);

  if (state.loading && !data) return <Spinner label="Preparing the statement" />;
  if (state.error && !data) return <ErrorNote error={state.error} onRetry={state.reload} />;
  if (!doc) return null;

  const company = data.entity?.name || getBrand().name;
  const exportCsv = () => {
    const { headers, rows } = documentCsv(doc);
    downloadCSV(`ifrs-${fileSlug(tab)}-${data.asAt || data.to}.csv`, headers, rows);
  };
  const print = () => {
    if (!printDocument(doc, { company, trn: data.entity?.trn, currency: data.currency })) notify("Allow pop-ups for this site to print the statement.", "error");
  };
  const figures = keyFigures(tab, data);
  const problems = warnings(tab, data);
  const pending = state.loading;

  return (
    <div className="space-y-4" aria-busy={pending || undefined}>
      {state.error && <ErrorNote error={state.error} onRetry={state.reload} />}
      {problems.map((text) => (
        <div key={text} role="alert" className="flex items-start gap-3 rounded-xl border border-status-danger/25 bg-status-danger-soft p-4 text-sm text-status-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{text}</p>
        </div>
      ))}
      {figures.length > 0 && (
        <div className={cn("grid grid-cols-2 gap-3", GRID[figures.length])}>
          {figures.map((f) => <StatCard key={f.title} title={f.title} count={formatAmount(f.value, { zero: "0.00" })} subText={f.sub} tone={f.tone} />)}
        </div>
      )}
      <Panel
        bodyClassName="p-0"
        title={doc.title}
        description={`${company} · ${doc.period} · Amounts in ${data.currency || "AED"}`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>
            <Button size="sm" variant="outline" onClick={print}><Printer className="h-3.5 w-3.5" aria-hidden="true" />Print</Button>
          </>
        }
      >
        <div className={cn("divide-y divide-border", pending && "opacity-60")}>
          {doc.blocks.map((b, i) => <Block key={i} block={b} caption={doc.title} />)}
          {tab === "notes" && (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Property, plant and equipment movements, related parties, commitments and contingencies: Coming soon.
            </p>
          )}
        </div>
      </Panel>
      {toastNode}
    </div>
  );
}

// The server writes dates into note text as YYYY-MM-DD; they are shown the way the user reads dates.
const readableDates = (text) => String(text ?? "").replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => formatDate(iso) || iso);

function Block({ block, caption }) {
  if (block.type === "footnote") return <p className="px-5 py-3 text-xs text-muted-foreground">{readableDates(block.text)}</p>;
  if (block.type === "text") {
    return (
      <section className="px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">{block.title}</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{readableDates(block.text)}</p>
      </section>
    );
  }
  return <StatementTable block={block} caption={block.title || caption} />;
}

const ROW = {
  heading: "bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
  label: "text-muted-foreground",
  line: "",
  detail: "text-[13px] text-muted-foreground",
  subtotal: "border-t border-border font-semibold",
  total: "border-y-2 border-border bg-secondary/60 font-semibold",
};

function StatementTable({ block, caption }) {
  const columns = block.columns;
  const strong = (r) => r.kind === "subtotal" || r.kind === "total";
  return (
    <div>
      {block.title && <h3 className="px-5 pb-1 pt-4 text-sm font-semibold text-foreground">{block.title}</h3>}
      <div className="erp-scroll table-pin-first overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="px-5 py-2 text-start font-medium"><span className="sr-only">Line item</span></th>
              {columns.map((c, j) => <th key={j} scope="col" className="whitespace-nowrap px-5 py-2 text-end font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i} className={ROW[r.kind]}>
                {r.kind === "heading" ? (
                  <td colSpan={columns.length + 1} className="py-2 pe-5" style={{ paddingInlineStart: 20 + (r.level || 0) * 18 }}>{r.label}</td>
                ) : (
                  <>
                    <th scope="row" className="py-2 pe-3 text-start" style={{ paddingInlineStart: 20 + (r.level || 0) * 18, fontWeight: "inherit" }}>
                      {r.code && <span className="me-2 font-mono text-xs text-muted-foreground">{r.code}</span>}
                      {r.label}
                    </th>
                    {columns.map((c, j) => (
                      <td key={j} className="whitespace-nowrap px-5 py-2 text-end tabular-nums">
                        {block.signed
                          ? r.values[j] !== null && r.values[j] !== undefined && <Balance net={r.values[j]} />
                          : formatAmount(r.values[j], { zero: strong(r) ? "0.00" : "–" })}
                      </td>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
