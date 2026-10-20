// The CRM's own front page, built from the same pieces as the home dashboard: the house chart colours, RankedBars,
// CountUp, and figures that are read, not decorated.
//
// It answers four questions in order: how big is the pipeline, where is it stuck, what has it done for six months,
// and what do I owe today. The panel that matters most is "Moved by itself" - the deals the documents advanced with
// nobody touching them. That is the module's whole argument, so it gets the width.
//
// Every chart here is single-series on purpose, so none needs a legend (the title names it) and no colour carries
// meaning on its own. Numbers count up; nothing else moves.
import React, { useRef } from "react";
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
import { hueFor, stageHues } from "../../lib/crm";
import { Ring, PulseStrip } from "./CrmCharts.jsx";
import { useReveal } from "./useReveal.js";
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
    // min-w-0: a grid track's floor is its content's min-width, so without this a long deal name makes the card
    // wider than the column and it bleeds off a phone.
    <li className="min-w-0 rounded-xl border border-border bg-card p-3.5">
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


/** A panel that arrives with the rest (useReveal finds `data-reveal`); `min-w-0` so a long name cannot widen a grid track. */
const R = ({ className = "", children }) => (
  <div data-reveal className={`min-w-0 ${className}`}>
    {children}
  </div>
);

export default function CrmDashboard() {
  const navigate = useNavigate();
  const page = useRef(null);
  const { data, loading, error, reload } = useAsync(() => crm.dashboard(), []);
  useReveal(page, Boolean(data));

  if (loading && !data) return <Spinner label="Reading the pipeline" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const { late = [], mine = [], moved = [], topDeals = [], byOwner = [], trend = [], pulse = [], leadSources = [], funnel = [] } = data;
  const stages = funnel.filter((f) => f.type !== "won" && f.type !== "lost" && f.count > 0);
  const hues = stageHues(funnel);
  const doneTwoWeeks = pulse.reduce((t, d) => t + d.count, 0);
  const sourceTotal = leadSources.reduce((t, s) => t + s.value, 0);

  return (
    <div ref={page} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="CRM" description={`Where every enquiry stands, as at ${formatDate(data.today)}.`} />

      {/* Each tile is a way in, not only a figure: the number and the screen behind it are the same thing. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <R>
          <StatCard
            title="Open enquiries"
            count={<CountUp value={data.openLeads} format={(n) => formatNumber(n, 0)} />}
            icon={<Target />}
            subText="Not yet a customer"
            onClick={() => navigate("/crm/leads")}
          />
        </R>
        <R>
          <StatCard
            title="Deals in play"
            count={<CountUp value={data.openDeals} format={(n) => formatNumber(n, 0)} />}
            icon={<Handshake />}
            subText={formatCurrencyAED(data.pipelineValue)}
            onClick={() => navigate("/crm/pipeline")}
          />
        </R>
        <R>
          <StatCard
            title="Likely to close"
            fit
            count={<CountUp value={data.weightedValue} format={formatCurrencyAED} />}
            icon={<TrendingUp />}
            tone="teal"
            subText="Weighted by stage"
          />
        </R>
        <R>
          <StatCard
            title="Late"
            count={<CountUp value={data.overdue} format={(n) => formatNumber(n, 0)} />}
            icon={<AlarmClock />}
            tone={data.overdue ? "danger" : "teal"}
            subText={data.overdue ? "Ring these first" : "Nothing is late"}
            onClick={() => navigate("/crm/follow-ups")}
          />
        </R>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <R className="lg:col-span-3">
          <Panel title="Where the pipeline sits" description="Open deals by stage, at the value they are worth." bodyClassName="px-2 pb-2">
            {stages.length === 0 ? (
              <Nothing title="Nothing in the pipeline" text="Qualify an enquiry and the deal appears on the first stage." />
            ) : (
              <RankedBars
                rows={stages.map((s) => ({ key: s.key, name: s.name, value: s.value, color: hues[s.key] }))}
                valueText={compactAmount}
                describe={(r) => {
                  const s = stages.find((x) => x.name === r.name);
                  return `${plural(s?.count || 0, "deal", "deals")} · ${formatCurrencyAED(s?.weighted || 0)} likely`;
                }}
              />
            )}
          </Panel>
        </R>
        <R className="lg:col-span-2">
          <Panel title="Won, six months" description="What the invoices closed." bodyClassName="px-2 pb-2">
            <WonTrend rows={trend} />
          </Panel>
        </R>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <R>
          <Panel title="Where the enquiries come from" description="The last three months, by source." bodyClassName="p-4">
            {sourceTotal === 0 ? (
              <Nothing title="No enquiries yet" text="The first one you take shows where it came from." />
            ) : (
              <Ring
                rows={leadSources.map((s, i) => ({ ...s, color: hueFor(i) }))}
                total={sourceTotal}
                label="enquiries"
                format={(n) => formatNumber(n, 0)}
              />
            )}
          </Panel>
        </R>
        <R>
          <Panel title="Is the team working?" description="Follow-ups finished, a day at a time." bodyClassName="p-4">
            <PulseStrip rows={pulse} />
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
              {[
                ["Finished", doneTwoWeeks, "in two weeks"],
                ["Due today", data.dueToday, "to do"],
                ["Late", data.overdue, data.overdue ? "ring these" : "none"],
              ].map(([label, value, hint]) => (
                <div key={label}>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">{formatNumber(value || 0, 0)}</dd>
                  <dt className="text-xs text-muted-foreground">
                    {label} · {hint}
                  </dt>
                </div>
              ))}
            </dl>
          </Panel>
        </R>
      </div>

      <R className="mt-4">
        <Panel
          title="Moved by itself"
          description="Deals the documents advanced this week. Nobody dragged a card."
          actions={<Link to="/crm/pipeline" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:underline lg:min-h-0">The board</Link>}
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
      </R>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <R>
          <Panel title="Worth the most" description="Open deals, weighted for the stage they stand on." bodyClassName="px-2 pb-2">
            {topDeals.length === 0 ? (
              <Nothing title="No deals yet" text="Qualify an enquiry and it appears here." />
            ) : (
              <RankedBars
                rows={topDeals.map((d) => ({ key: d._id, name: d.title, value: d.weighted, color: hues[d.stageKey] }))}
                valueText={compactAmount}
                describe={(r) => {
                  const d = topDeals.find((x) => x.title === r.name);
                  return `${d?.customerName || ""} · ${d?.stageName || ""} · ${formatCurrencyAED(d?.value || 0)} in full`;
                }}
              />
            )}
          </Panel>
        </R>
        <R>
          <Panel title="Who is carrying what" description="Open deals by the person they were given to." bodyClassName="px-2 pb-2">
            {byOwner.length === 0 ? (
              <Nothing title="Nobody is carrying anything yet" text="A new enquiry is given an owner the moment it arrives." />
            ) : (
              <RankedBars
                rows={byOwner.map((o, i) => ({ key: o.key, name: o.name, value: o.value, color: hueFor(i), muted: o.name === "Unassigned" }))}
                valueText={compactAmount}
                describe={(r) => {
                  const o = byOwner.find((x) => x.name === r.name);
                  return `${plural(o?.deals || 0, "deal", "deals")} · ${formatCurrencyAED(o?.weighted || 0)} likely`;
                }}
              />
            )}
          </Panel>
        </R>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <R>
          <Panel
            title="What is late"
            description="Across the team, oldest first."
            actions={<Link to="/crm/follow-ups" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:underline lg:min-h-0">All follow-ups</Link>}
            bodyClassName="p-0"
          >
            {late.length === 0 ? (
              <Nothing title="Nothing is late" text="Every follow-up is either done or still has time." />
            ) : (
              <ul>{late.map((row) => <WorkRow key={row._id} row={row} showOwner />)}</ul>
            )}
          </Panel>
        </R>
        <R>
          <Panel title="My follow-ups" description="What you owe this week." bodyClassName="p-0">
            {mine.length === 0 ? (
              <Nothing title="Nothing on your list" text="When a deal moves, the next follow-up appears here by itself." />
            ) : (
              <ul>{mine.map((row) => <WorkRow key={row._id} row={row} />)}</ul>
            )}
          </Panel>
        </R>
      </div>
    </div>
  );
}
