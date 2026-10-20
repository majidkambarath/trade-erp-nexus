// The CRM's own front page, built from the same pieces as the home dashboard: the house chart colours, RankedBars,
// CountUp, and figures that are read, not decorated.
//
// It answers four questions in order: how big is the pipeline, where is it stuck, what has it done for six months,
// and what do I owe today. The panel that matters most is "Moved by itself" - the deals the documents advanced with
// nobody touching them. That is the module's whole argument, so it gets the width.
//
// Every chart here is single-series on purpose, so none needs a legend (the title names it) and no colour carries
// meaning on its own. Numbers count up; nothing else moves.
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlarmClock, ArrowRight, Handshake, Sparkles, Target, TrendingUp } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, EmptyState, useAsync } from "../accounting/kit.jsx";
import StatCard from "../ui/stat-card.jsx";
import { RankedBars } from "../Dashborad/FlowCharts.jsx";
import { CountUp } from "../Dashborad/CountUp.jsx";
import { compactAmount, ink, monthLabel, tip } from "../Dashborad/helpers";
import { formatCurrencyAED, formatDate, formatNumber } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import { DuePill, KindIcon, Tag } from "./crmShared.jsx";

const plural = (n, one, many) => `${formatNumber(n, 0)} ${n === 1 ? one : many}`;

/** A panel that says what it would show, rather than drawing an empty chart. */
const Nothing = ({ title, text }) => (
  <div className="grid min-h-44 place-items-center px-4 py-8">
    <EmptyState title={title} text={text} />
  </div>
);

/** One line of the two worklists. Deliberately not a DataTable: these are glanced at, not scanned. */
function WorkRow({ row, showOwner }) {
  return (
    <li className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
        <KindIcon kind={row.kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{row.subject}</span>
        {showOwner && <span className="block truncate text-xs text-muted-foreground">{row.ownerName || "Nobody"}</span>}
      </span>
      <DuePill state={row.dueState} />
    </li>
  );
}

/** Six months of deals won. A month with nothing is a point on the line, not a gap in it. */
function WonTrend({ rows }) {
  if (!rows?.some((r) => r.value > 0)) {
    return <Nothing title="Nothing won yet" text="When an approved invoice wins a deal, the months build up here." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="crm-won" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ink} stopOpacity={0.28} />
            <stop offset="100%" stopColor={ink} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickFormatter={compactAmount} tickLine={false} axisLine={false} fontSize={12} width={56} />
        <Tooltip
          contentStyle={tip}
          labelFormatter={monthLabel}
          formatter={(value, _name, item) => [`${formatCurrencyAED(value)} · ${plural(item?.payload?.deals || 0, "deal", "deals")}`, "Won"]}
        />
        <Area type="monotone" dataKey="value" stroke={ink} strokeWidth={2} fill="url(#crm-won)" isAnimationActive={false} dot={{ r: 3, fill: ink }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** One automatic move, as a card. The document that caused it is the point, so it is named in full. */
function MovedCard({ row }) {
  return (
    <li className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-teal-soft text-accent-teal">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/crm/pipeline?deal=${row.dealId}`} className="block truncate font-medium text-foreground hover:underline">
            {row.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{row.customerName}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{row.eventLabel}</span>
            {row.docNo && <Tag tone="default">{row.docNo}</Tag>}
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Tag tone="info">{row.stageName || row.to}</Tag>
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.at)}</span>
      </div>
    </li>
  );
}

export default function CrmDashboard() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => crm.dashboard(), []);

  if (loading && !data) return <Spinner label="Reading the pipeline" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const { late = [], mine = [], moved = [], topDeals = [], byOwner = [], trend = [], funnel = [] } = data;
  const stages = funnel.filter((f) => f.type !== "won" && f.type !== "lost" && f.count > 0);

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="CRM" description={`Where every enquiry stands, as at ${formatDate(data.today)}.`} />

      {/* Each tile is a way in, not only a figure: the number and the screen behind it are the same thing. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Open enquiries"
          count={<CountUp value={data.openLeads} format={(n) => formatNumber(n, 0)} />}
          icon={<Target />}
          subText="Not yet a customer"
          onClick={() => navigate("/crm/leads")}
        />
        <StatCard
          title="Deals in play"
          count={<CountUp value={data.openDeals} format={(n) => formatNumber(n, 0)} />}
          icon={<Handshake />}
          subText={formatCurrencyAED(data.pipelineValue)}
          onClick={() => navigate("/crm/pipeline")}
        />
        <StatCard
          title="Likely to close"
          fit
          count={<CountUp value={data.weightedValue} format={formatCurrencyAED} />}
          icon={<TrendingUp />}
          tone="teal"
          subText="Weighted by stage"
        />
        <StatCard
          title="Late"
          count={<CountUp value={data.overdue} format={(n) => formatNumber(n, 0)} />}
          icon={<AlarmClock />}
          tone={data.overdue ? "danger" : "teal"}
          subText={data.overdue ? "Ring these first" : "Nothing is late"}
          onClick={() => navigate("/crm/follow-ups")}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Where the pipeline sits"
          description="Open deals by stage, at the value they are worth."
          bodyClassName="px-2 pb-2"
        >
          {stages.length === 0 ? (
            <Nothing title="Nothing in the pipeline" text="Qualify an enquiry and the deal appears on the first stage." />
          ) : (
            <RankedBars
              rows={stages.map((s) => ({ key: s.key, name: s.name, value: s.value }))}
              valueText={compactAmount}
              describe={(r) => {
                const s = stages.find((x) => x.name === r.name);
                return `${plural(s?.count || 0, "deal", "deals")} · ${formatCurrencyAED(s?.weighted || 0)} likely`;
              }}
            />
          )}
        </Panel>

        <Panel className="lg:col-span-2" title="Won, six months" description="What the invoices closed." bodyClassName="px-2 pb-2">
          <WonTrend rows={trend} />
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Moved by itself"
        description="Deals the documents advanced this week. Nobody dragged a card."
        actions={<Link to="/crm/pipeline" className="text-sm text-muted-foreground hover:underline">The board</Link>}
        bodyClassName={moved.length ? "p-3 sm:p-4" : "p-0"}
      >
        {moved.length === 0 ? (
          <Nothing
            title="Nothing has moved this week"
            text="Send a quotation or approve an invoice and the deal in front of it moves here on its own."
          />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {moved.map((row) => (
              <MovedCard key={`${row.dealId}:${row.event}:${row.at}`} row={row} />
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Worth the most" description="Open deals, weighted for the stage they stand on." bodyClassName="px-2 pb-2">
          {topDeals.length === 0 ? (
            <Nothing title="No deals yet" text="Qualify an enquiry and it appears here." />
          ) : (
            <RankedBars
              rows={topDeals.map((d) => ({ key: d._id, name: d.title, value: d.weighted }))}
              valueText={compactAmount}
              describe={(r) => {
                const d = topDeals.find((x) => x.title === r.name);
                return `${d?.customerName || ""} · ${d?.stageName || ""} · ${formatCurrencyAED(d?.value || 0)} in full`;
              }}
            />
          )}
        </Panel>

        <Panel title="Who is carrying what" description="Open deals by the person they were given to." bodyClassName="px-2 pb-2">
          {byOwner.length === 0 ? (
            <Nothing title="Nobody is carrying anything yet" text="A new enquiry is given an owner the moment it arrives." />
          ) : (
            <RankedBars
              rows={byOwner.map((o) => ({ key: o.key, name: o.name, value: o.value, muted: o.name === "Unassigned" }))}
              valueText={compactAmount}
              describe={(r) => {
                const o = byOwner.find((x) => x.name === r.name);
                return `${plural(o?.deals || 0, "deal", "deals")} · ${formatCurrencyAED(o?.weighted || 0)} likely`;
              }}
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="What is late"
          description="Across the team, oldest first."
          actions={<Link to="/crm/follow-ups" className="text-sm text-muted-foreground hover:underline">All follow-ups</Link>}
          bodyClassName="p-0"
        >
          {late.length === 0 ? (
            <Nothing title="Nothing is late" text="Every follow-up is either done or still has time." />
          ) : (
            <ul>{late.map((row) => <WorkRow key={row._id} row={row} showOwner />)}</ul>
          )}
        </Panel>

        <Panel title="My follow-ups" description="What you owe this week." bodyClassName="p-0">
          {mine.length === 0 ? (
            <Nothing title="Nothing on your list" text="When a deal moves, the next follow-up appears here by itself." />
          ) : (
            <ul>{mine.map((row) => <WorkRow key={row._id} row={row} />)}</ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
