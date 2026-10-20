// The CRM's reports: seven named answers, not one page of tables.
//
// They split on a line worth keeping: five read a PERIOD (what happened between two dates) and two are an "as at
// today" picture (Pipeline and Aging). Asking how old a deal was last month answers nothing anybody acts on, so
// those two deliberately ignore the date range rather than pretending to honour it.
//
// Every chart is the same RankedBars the home dashboard uses, so a figure here and a figure there are drawn the
// same way and read the same way.
import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, EmptyState, DataTable, TableScroll, useAsync, Field, DateInput } from "../accounting/kit.jsx";
import StatCard from "../ui/stat-card.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import { RankedBars } from "../Dashborad/FlowCharts.jsx";
import { compactAmount } from "../Dashborad/helpers";
import { pageSession } from "../../lib/pageSession";
import { formatCurrencyAED, formatDate, formatNumber, downloadCSV } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { hueFor, stageHues } from "../../lib/crm";
import { Ring, PulseStrip } from "./CrmCharts.jsx";
import { useReveal } from "./useReveal.js";
import { Tag } from "./crmShared.jsx";

const session = pageSession("crm-reports");
const PERIODLESS = new Set(["pipeline", "aging"]);

const pct = (v) => (v === null || v === undefined ? "–" : `${formatNumber(v, 1)}%`);
const days = (v) => (v === null || v === undefined ? "–" : `${formatNumber(v, 1)} days`);
const count = (v) => formatNumber(v || 0, 0);

const Nothing = ({ title, text }) => (
  <div className="grid min-h-40 place-items-center px-4 py-8">
    <EmptyState title={title} text={text} />
  </div>
);

/** A chart and the table behind it. The chart is how it is read; the table is how it is checked. */
function Chart({ rows, valueText = compactAmount, describe, empty }) {
  if (!rows?.length) return <Nothing title={empty.title} text={empty.text} />;
  return <RankedBars rows={rows} valueText={valueText} describe={describe} />;
}

/** One report's body. Its direct children (the tiles, then each panel) arrive in a short stagger - see useReveal. */
function Stage({ children, ready = true }) {
  const ref = useRef(null);
  useReveal(ref, ready, ":scope > *");
  return (
    <div ref={ref} className="space-y-4">
      {children}
    </div>
  );
}

const Grid = ({ children }) => <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;

function Pipeline({ data }) {
  const all = data?.funnel || [];
  const stages = all.filter((s) => s.type !== "won" && s.type !== "lost");
  const hues = stageHues(all);
  const live = stages.filter((s) => s.count > 0);
  return (
    <Stage>
      <Grid>
        <StatCard title="Open deals" count={count(data?.deals?.open)} />
        <StatCard title="In the pipeline" fit count={formatCurrencyAED(data?.deals?.openValue)} />
        <StatCard title="Likely to close" fit count={formatCurrencyAED(data?.deals?.weightedValue)} tone="teal" subText="Weighted by stage" />
        <StatCard title="Stages" count={count(stages.length)} subText="Set up under Setup" />
      </Grid>
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Where the deals stand" description="Open deals by stage, at the value they are worth." bodyClassName="px-2 pb-2">
          <Chart
            rows={live.map((s) => ({ key: s.key, name: s.name, value: s.value, color: hues[s.key] }))}
            describe={(r) => {
              const s = stages.find((x) => x.name === r.name);
              return `${count(s?.count)} deals · ${formatCurrencyAED(s?.weighted)} likely`;
            }}
            empty={{ title: "Nothing in the pipeline", text: "Qualify an enquiry and the deal appears on the first stage." }}
          />
        </Panel>
        <Panel className="lg:col-span-2" title="What it is made of" description="Each stage's share of the open value." bodyClassName="p-4">
          {live.length === 0 ? (
            <Nothing title="Nothing to divide" text="The pipeline is empty." />
          ) : (
            <Ring rows={live.map((s) => ({ key: s.key, name: s.name, value: s.value, color: hues[s.key] }))} total={data?.deals?.openValue || 0} />
          )}
        </Panel>
      </div>
      <Panel bodyClassName="p-0">
        <DataTable
          caption="Pipeline by stage"
          rows={stages}
          rowKey={(r) => r.key}
          columns={[
            { key: "name", header: "Stage", card: "primary", cell: (r) => r.name },
            { key: "probability", header: "Chance", card: "meta", align: "end", cell: (r) => `${r.probability}%` },
            { key: "count", header: "Deals", card: "meta", align: "end", cell: (r) => count(r.count) },
            { key: "value", header: "Value", card: "amount", align: "end", cell: (r) => formatCurrencyAED(r.value) },
            { key: "weighted", header: "Likely", card: "hidden", align: "end", cell: (r) => formatCurrencyAED(r.weighted) },
          ]}
        />
      </Panel>
    </Stage>
  );
}

function Conversion({ data }) {
  const rows = data?.bySource || [];
  const total = data?.leads?.total || 0;
  // The funnel the whole module exists to widen: how many enquiries became customers, and how many of THOSE were won.
  // Three bars, each a share of the first, so a leak is visible as a step that drops away.
  const steps = [
    { key: "enquiries", name: "Enquiries", value: total, color: hueFor(0) },
    { key: "customers", name: "Became customers", value: data?.leads?.converted || 0, color: hueFor(1) },
    { key: "won", name: "Deals won", value: data?.deals?.won || 0, color: hueFor(2) },
  ];
  return (
    <Stage>
      <Grid>
        <StatCard title="Enquiries" count={count(total)} />
        <StatCard title="Became customers" count={count(data?.leads?.converted)} tone="teal" />
        <StatCard title="Conversion" count={pct(data?.leads?.conversionRate)} subText={`${count(data?.leads?.lost)} came to nothing`} />
        <StatCard title="Still in hand" count={count(data?.leads?.open)} />
      </Grid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="The funnel" description="Where enquiries drop away on the way to a won deal." bodyClassName="px-2 pb-2">
          <Chart
            rows={steps}
            valueText={(v) => `${count(v)}${total ? ` · ${formatNumber((v / total) * 100, 0)}%` : ""}`}
            describe={(r) => `${count(r.value)} of ${count(total)} enquiries`}
            empty={{ title: "No enquiries in this period", text: "Widen the dates, or take one." }}
          />
        </Panel>
        <Panel title="Where they come from" description="Enquiries by source." bodyClassName="p-4">
          {rows.length === 0 ? (
            <Nothing title="No enquiries in this period" text="Widen the dates, or take one." />
          ) : (
            <Ring
              rows={rows.map((r, i) => ({ key: r.source, name: r.label, value: r.leads, color: hueFor(i) }))}
              total={total}
              label="enquiries"
              format={(n) => count(n)}
            />
          )}
        </Panel>
      </div>
      <Panel title="Which sources actually convert" description="The share of each source's enquiries that became customers." bodyClassName="px-2 pb-2">
        <Chart
          rows={rows.filter((r) => r.conversionRate !== null).map((r, i) => ({ key: r.source, name: r.label, value: r.conversionRate, color: hueFor(i) }))}
          valueText={(v) => pct(v)}
          axisText={(v) => `${v}%`}
          describe={(r) => {
            const s = rows.find((x) => x.label === r.name);
            return `${count(s?.converted)} of ${count(s?.leads)} converted · ${formatCurrencyAED(s?.value)} enquired for`;
          }}
          empty={{ title: "Nothing to compare", text: "A source needs at least one enquiry." }}
        />
      </Panel>
      <Panel bodyClassName="p-0">
        <DataTable
          caption="Lead conversion by source"
          rows={rows}
          rowKey={(r) => r.source}
          columns={[
            { key: "label", header: "Source", card: "primary", cell: (r) => r.label },
            { key: "leads", header: "Enquiries", card: "meta", align: "end", cell: (r) => count(r.leads) },
            { key: "converted", header: "Converted", card: "meta", align: "end", cell: (r) => count(r.converted) },
            { key: "rate", header: "Rate", card: "badge", align: "end", cell: (r) => pct(r.conversionRate) },
            { key: "value", header: "Enquired for", card: "amount", align: "end", cell: (r) => formatCurrencyAED(r.value) },
          ]}
        />
      </Panel>
    </Stage>
  );
}

function WinLoss({ data }) {
  const reasons = data?.lostReasons || [];
  const won = data?.deals?.wonValue || 0;
  const lost = data?.deals?.lostValue || 0;
  return (
    <Stage>
      <Grid>
        <StatCard title="Won" count={count(data?.deals?.won)} tone="teal" subText={formatCurrencyAED(won)} />
        <StatCard title="Lost" count={count(data?.deals?.lost)} tone={data?.deals?.lost ? "danger" : undefined} subText={formatCurrencyAED(lost)} />
        <StatCard title="Win rate" count={pct(data?.deals?.winRate)} subText="Of the deals that closed" />
        <StatCard title="Days to win" count={days(data?.deals?.averageDaysToWin)} subText="On average" />
      </Grid>
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2" title="Won against lost" description="By value, in this period." bodyClassName="p-4">
          {won + lost === 0 ? (
            <Nothing title="Nothing closed in this period" text="Widen the dates, or close a deal." />
          ) : (
            <Ring
              rows={[
                { key: "won", name: "Won", value: won, color: "var(--status-success)" },
                { key: "lost", name: "Lost", value: lost, color: "var(--status-danger)" },
              ]}
              total={won + lost}
              label="closed"
            />
          )}
        </Panel>
        <Panel
          className="lg:col-span-3"
          title="Why deals are lost"
          description="The reason is required when a deal is marked lost, which is what makes this worth reading."
          bodyClassName="px-2 pb-2"
        >
          <Chart
            rows={reasons.map((r, i) => ({ key: r.reason, name: r.label, value: r.value, color: hueFor(i) }))}
            describe={(r) => {
              const s = reasons.find((x) => x.label === r.name);
              return `${count(s?.deals)} deals · ${formatCurrencyAED(s?.value)}`;
            }}
            empty={{ title: "Nothing lost in this period", text: "Every deal that closed was won." }}
          />
        </Panel>
      </div>
    </Stage>
  );
}

function Performance({ data }) {
  const rows = data?.byOwner || [];
  return (
    <Stage>
      <Grid>
        <StatCard title="People selling" count={count(rows.filter((r) => r.ownerId).length)} />
        <StatCard title="Won between them" fit count={formatCurrencyAED(rows.reduce((t, r) => t + (r.wonValue || 0), 0))} tone="teal" />
        <StatCard title="Follow-ups done" count={count(data?.activity?.done)} />
        <StatCard title="Still owed" count={count(data?.activity?.open)} tone={data?.activity?.overdue ? "warning" : undefined} subText={`${count(data?.activity?.overdue)} late`} />
      </Grid>
      <Panel title="Who is selling" description="Value won in this period." bodyClassName="px-2 pb-2">
        <Chart
          rows={rows.map((r, i) => ({ key: r.ownerId || "unassigned", name: r.name, value: r.wonValue, color: hueFor(i), muted: !r.ownerId }))}
          describe={(r) => {
            const s = rows.find((x) => x.name === r.name);
            return `${count(s?.won)} won of ${count(s?.deals)} · ${count(s?.activities)} follow-ups · ${pct(s?.winRate)}`;
          }}
          empty={{ title: "Nothing won in this period", text: "Widen the dates, or win something." }}
        />
      </Panel>
      <Panel bodyClassName="p-0">
        <TableScroll label="Who is selling">
          <DataTable
            className="table-pin-first"
            caption="Sales performance"
            rows={rows}
            rowKey={(r) => r.ownerId || "unassigned"}
            columns={[
              { key: "name", header: "Person", card: "primary", cell: (r) => (r.ownerId ? r.name : <Tag tone="warning">Unassigned</Tag>) },
              { key: "leads", header: "Enquiries", card: "meta", align: "end", cell: (r) => count(r.leads) },
              { key: "deals", header: "Deals", card: "meta", align: "end", cell: (r) => count(r.deals) },
              { key: "won", header: "Won", card: "meta", align: "end", cell: (r) => count(r.won) },
              { key: "lost", header: "Lost", card: "hidden", align: "end", cell: (r) => count(r.lost) },
              { key: "rate", header: "Win rate", card: "badge", align: "end", cell: (r) => pct(r.winRate) },
              { key: "activities", header: "Follow-ups", card: "hidden", align: "end", cell: (r) => count(r.activities) },
              { key: "wonValue", header: "Won value", card: "amount", align: "end", cell: (r) => formatCurrencyAED(r.wonValue) },
            ]}
          />
        </TableScroll>
      </Panel>
    </Stage>
  );
}

function Aging() {
  const { data, loading, error, reload } = useAsync(() => crm.aging(), []);
  if (loading && !data) return <Spinner label="Reading the open deals" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const rows = data?.rows || [];
  return (
    <Stage>
      <Grid>
        <StatCard title="Oldest" count={data?.oldest ? `${count(data.oldest)} days` : "–"} subText="On its current stage" />
        <StatCard title="Average age" count={days(data?.average)} />
        <StatCard title="Gone quiet" count={count(data?.stale)} tone={data?.stale ? "warning" : undefined} subText="Past the stage's own limit" />
        <StatCard title="Past its close date" count={count(data?.overdueClose)} tone={data?.overdueClose ? "danger" : undefined} />
      </Grid>
      <Panel title="How long deals have stood still" description="Open deals, by days on their current stage." bodyClassName="px-2 pb-2">
        <Chart
          rows={(data?.bands || []).map((b, i) => ({ ...b, color: rules.AGE_HUES[i] })).filter((b) => b.deals > 0).map((b) => ({ key: b.key, name: b.label, value: b.value, color: b.color }))}
          describe={(r) => {
            const b = (data?.bands || []).find((x) => x.label === r.name);
            return `${count(b?.deals)} deals · ${formatCurrencyAED(b?.value)}`;
          }}
          empty={{ title: "No open deals", text: "Nothing is standing still because nothing is open." }}
        />
      </Panel>
      <Panel
        title="Every open deal, oldest first"
        actions={
          rows.length ? (
            <button
              type="button"
              onClick={() => {
                const csv = rules.agingCsv(rows);
                downloadCSV(`crm-aging-${new Date().toISOString().slice(0, 10)}.csv`, csv.headers, csv.rows);
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-input px-3 text-sm lg:h-10"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Export
            </button>
          ) : null
        }
        bodyClassName="p-0"
      >
        <DataTable
          className="table-pin-first"
          caption="Opportunity aging"
          rows={rows}
          rowKey={(r) => r.id}
          empty={<Nothing title="No open deals" text="" />}
          columns={[
            {
              key: "no",
              header: "Deal",
              card: "primary",
              cell: (r) => (
                <Link to={`/crm/pipeline?deal=${r.id}`} className="font-medium text-foreground hover:underline">
                  {r.opportunityNo}
                </Link>
              ),
            },
            { key: "title", header: "What", card: "title", cell: (r) => r.title },
            { key: "customer", header: "Customer", card: "meta", cell: (r) => r.customerName },
            { key: "stage", header: "Stage", card: "badge", cell: (r) => <Tag tone="info">{r.stageName}</Tag> },
            { key: "owner", header: "Owner", card: "hidden", cell: (r) => r.ownerName || "Nobody" },
            {
              key: "days",
              header: "Days here",
              card: "meta",
              align: "end",
              cell: (r) => <span className={r.stale ? "font-semibold text-status-warning" : ""}>{count(r.days)}</span>,
            },
            {
              key: "close",
              header: "Expected close",
              card: "hidden",
              cell: (r) => (r.expectedCloseDate ? <span className={r.overdueClose ? "text-status-danger" : ""}>{formatDate(r.expectedCloseDate)}</span> : "–"),
            },
            { key: "value", header: "Value", card: "amount", align: "end", cell: (r) => formatCurrencyAED(r.value) },
          ]}
        />
      </Panel>
    </Stage>
  );
}

/** The register: every deal, as a list. No chart - this one is for finding a particular deal, not for a shape. */
function Deals() {
  const { data, loading, error, reload } = useAsync(() => crm.deals({ limit: 300 }), []);
  if (loading && !data) return <Spinner label="Reading the deals" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const rows = data || [];
  return (
    <Panel
      title="Every deal"
      description={`${count(rows.length)} in all, newest first.`}
      actions={
        rows.length ? (
          <button
            type="button"
            onClick={() => {
              const csv = rules.dealsCsv(rows);
              downloadCSV(`crm-deals-${new Date().toISOString().slice(0, 10)}.csv`, csv.headers, csv.rows);
            }}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-input px-3 text-sm lg:h-10"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export
          </button>
        ) : null
      }
      bodyClassName="p-0"
    >
      <DataTable
        className="table-pin-first"
        caption="Every deal"
        rows={rows}
        rowKey={(r) => r._id}
        empty={<Nothing title="No deals yet" text="Qualify an enquiry and it appears here." />}
        columns={[
          {
            key: "no",
            header: "Deal",
            card: "primary",
            cell: (r) => (
              <Link to={`/crm/pipeline?deal=${r._id}`} className="font-medium text-foreground hover:underline">
                {r.opportunityNo}
              </Link>
            ),
          },
          { key: "title", header: "What", card: "title", cell: (r) => r.title },
          { key: "customer", header: "Customer", card: "meta", cell: (r) => r.customerName },
          { key: "stage", header: "Stage", card: "badge", cell: (r) => <Tag tone={r.status === "WON" ? "success" : r.status === "LOST" ? "danger" : "info"}>{r.stageName}</Tag> },
          { key: "owner", header: "Owner", card: "hidden", cell: (r) => r.ownerName || "Nobody" },
          { key: "close", header: "Expected close", card: "hidden", cell: (r) => (r.expectedCloseDate ? formatDate(r.expectedCloseDate) : "–") },
          { key: "value", header: "Value", card: "amount", align: "end", cell: (r) => formatCurrencyAED(r.value) },
        ]}
      />
    </Panel>
  );
}

function Communications({ from, to }) {
  const { data, loading, error, reload } = useAsync(() => crm.activityReport({ from, to }), [from, to]);
  if (loading && !data) return <Spinner label="Reading what was done" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const people = data?.byPerson || [];
  const kinds = data?.byKind || [];
  // Every day of the period, quiet ones included: whether the team is working is the question, and a gap in the
  // strip would read as "no data" rather than "no calls".
  const strip = rules.fillDays(data?.byDay || [], data?.period?.from, data?.period?.to);
  return (
    <Stage>
      <Grid>
        <StatCard title="Done" count={count(data?.done)} tone="teal" subText="In this period" />
        <StatCard title="Still owed" count={count(data?.open)} />
        <StatCard title="Late" count={count(data?.overdue)} tone={data?.overdue ? "danger" : undefined} />
        <StatCard title="Busiest day" count={count(Math.max(0, ...(data?.byDay || []).map((d) => d.count)))} subText="Follow-ups finished" />
      </Grid>
      <Panel title="Day by day" description="Follow-ups finished, over the period." bodyClassName="p-4">
        {strip.length === 0 ? <Nothing title="No period" text="" /> : <PulseStrip rows={strip} />}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Who is doing the chasing" description="Follow-ups finished in this period." bodyClassName="px-2 pb-2">
          <Chart
            rows={people.map((p, i) => ({ key: p.key, name: p.name, value: p.done, color: hueFor(i), muted: p.name === "Nobody" }))}
            valueText={(v) => count(v)}
            describe={(r) => {
              const p = people.find((x) => x.name === r.name);
              return `${count(p?.done)} done · ${count(p?.open)} still owed · ${count(p?.overdue)} late`;
            }}
            empty={{ title: "Nothing was done in this period", text: "Widen the dates, or log a call." }}
          />
        </Panel>
        <Panel title="How they were reached" description="Everything logged, by kind." bodyClassName="p-4">
          {kinds.length === 0 ? (
            <Nothing title="Nothing logged" text="Log a call from an enquiry, a deal or a person." />
          ) : (
            <Ring
              rows={kinds.map((k, i) => ({ key: k.kind, name: k.label, value: k.done + k.open, color: hueFor(i) }))}
              total={kinds.reduce((t, k) => t + k.done + k.open, 0)}
              label="logged"
              format={(n) => count(n)}
            />
          )}
        </Panel>
      </div>
      <Panel bodyClassName="p-0">
        <DataTable
          caption="Communication activity by kind"
          rows={kinds}
          rowKey={(r) => r.kind}
          empty={<Nothing title="Nothing logged" text="" />}
          columns={[
            { key: "label", header: "How", card: "primary", cell: (r) => r.label },
            { key: "done", header: "Done", card: "meta", align: "end", cell: (r) => count(r.done) },
            { key: "open", header: "Still owed", card: "meta", align: "end", cell: (r) => count(r.open) },
            { key: "overdue", header: "Late", card: "amount", align: "end", cell: (r) => (r.overdue ? <span className="font-semibold text-status-danger">{count(r.overdue)}</span> : "–") },
          ]}
        />
      </Panel>
    </Stage>
  );
}

export default function CrmReports() {
  const [report, setReport] = useState(() => session.get("report", "pipeline"));
  const [from, setFrom] = useState(() => session.get("from", ""));
  const [to, setTo] = useState(() => session.get("to", ""));
  const keep = (setter, key) => (value) => {
    session.set(key, value);
    setter(value);
  };

  const params = useMemo(() => ({ ...(from ? { from } : {}), ...(to ? { to } : {}) }), [from, to]);
  // Four of the seven read the same analysis, so it is fetched once and shared rather than four times over.
  const shared = useAsync(() => crm.analysis(params), [params]);
  const needsAnalysis = ["pipeline", "conversion", "winloss", "performance"].includes(report);
  const periodLess = PERIODLESS.has(report);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Reports"
        description={
          periodLess
            ? "How things stand today. The dates do not apply to this one."
            : shared.data?.period
              ? `${formatDate(shared.data.period.from)} to ${formatDate(shared.data.period.to)}`
              : "The last 30 days unless you say otherwise."
        }
      />

      <div className="mt-6">
        <PillTabs tabs={rules.REPORT_TABS} value={report} onChange={keep(setReport, "report")} label="Which report" />
      </div>

      {/* The range is drawn for every report so it does not jump about, and is simply disabled where it means
          nothing - saying so is kinder than hiding it and leaving a person to wonder where it went. */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="From" className="w-full sm:w-44">
          <DateInput value={from} onChange={keep(setFrom, "from")} disabled={periodLess} />
        </Field>
        <Field label="To" className="w-full sm:w-44">
          <DateInput value={to} onChange={keep(setTo, "to")} disabled={periodLess} />
        </Field>
        {periodLess && <p className="pb-2.5 text-xs text-muted-foreground">This report is as at today.</p>}
      </div>

      <div className="mt-4">
        {needsAnalysis && shared.loading && !shared.data && <Spinner label="Reading the CRM" />}
        {needsAnalysis && shared.error && <ErrorNote error={shared.error} onRetry={shared.reload} />}
        {needsAnalysis && shared.data && (
          <>
            {report === "pipeline" && <Pipeline data={shared.data} />}
            {report === "conversion" && <Conversion data={shared.data} />}
            {report === "winloss" && <WinLoss data={shared.data} />}
            {report === "performance" && <Performance data={shared.data} />}
          </>
        )}
        {report === "aging" && <Aging />}
        {report === "deals" && <Deals />}
        {report === "activity" && <Communications from={from} to={to} />}
      </div>

      {shared.data?.capped && (
        <p className="mt-4 text-xs text-muted-foreground">
          More than this period holds was read; the figures cover the newest of it.
        </p>
      )}
    </div>
  );
}
