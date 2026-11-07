// HRMS > Overview (/hr/overview): the HR MIS dashboard, led by what labour COSTS.
//
// Nothing here computes a figure. The server answers the whole screen in one read, every number coming
// from the service that owns it (payroll's own totals, the expiry report, the coverage check), so a card
// can never disagree with the page it links to. The shaping is in src/lib/hrDashboard.js, tested without
// rendering; the motion rules are in ./useHrReveal.js.
//
// MONEY IS THE SERVER'S DECISION. A reader without hr.confidential is answered without the divisible
// figures at all, so they arrive `undefined` - which is how this screen tells "hidden from you" from
// "none". It never asks what the reader may see; it draws what it was given, as a dash.
//
// THE LAYOUT IS THE POINT, and it was wrong once. The first version was full-bleed with a five-across
// tile row (nothing else in this product is five-across) that FILTERED cards out, so a reader without
// hr.confidential got three cards in a five-column grid with two dead tracks - and then four identical
// half-width rows of nine equal panels, with nothing to say where to look. It read as a first draft
// because it was shaped like one. Now: the house shell, four tiles that are always four, and bands with
// deliberate weight - the money story first at full width, then the one panel every reference calls the
// strongest thing on an HR dashboard (headcount against departures on the same axes), then the smaller
// readings three across. Gratuity and Emiratisation are NOT here: HR Reports owns them, and carrying
// them twice spent two panels of weight on nothing new.
import React, { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarCheck, Clock, Download, FileWarning, RefreshCw, TrendingUp, UserMinus, Users, Wallet } from "lucide-react";
import StatCard from "../ui/stat-card";
import { Button } from "../ui/button";
import { EmptyState, ErrorNote, PageHeader, Panel, PageSpinner, useAsync } from "../accounting/kit";
import { RankedBars } from "../Dashborad/FlowCharts";
import { CountUp } from "../Dashborad/CountUp";
import { Skeleton } from "../Dashborad/widgets";
import { compactAmount, monthLabel, signed } from "../Dashborad/helpers";
import { Progress } from "../ui/progress";
import { hrDashboard } from "../../lib/hrApi";
import * as rules from "../../lib/hrDashboard";
import { CURRENCY, formatCurrencyAED, formatDate, formatNumber, downloadCSV } from "../../utils/format";
import { MonthlyCost, MonthlyFlow, SplitRing } from "./hrCharts";
import { useHrReveal } from "./useHrReveal";

const ICONS = { cost: Wallet, perEmployee: TrendingUp, headcount: Users, attendance: CalendarCheck };
const shortMonth = (m) => monthLabel(m);
const CHART_H = 260;

/** A panel that arrives with the rest (useHrReveal finds `data-reveal`); `min-w-0` so a long name
 * cannot widen a grid track - the lesson the deal page paid for. */
const R = ({ className = "", children }) => (
  <div data-reveal className={`min-w-0 ${className}`}>{children}</div>
);

/** One headline figure, and a way in to the page that holds it in full. */
function Headline({ card }) {
  const navigate = useNavigate();
  const Icon = ICONS[card.key] || Users;
  const format =
    card.kind === "money" ? (n) => formatCurrencyAED(n)
      : card.kind === "percent" ? (n) => `${formatNumber(n, 1)}%`
        : (n) => formatNumber(n, 0);
  return (
    <StatCard
      icon={<Icon />}
      title={card.title}
      // A withheld or not-yet-known figure is a dash, never a zero that would read as a real answer -
      // and the card STAYS, so the row never has a hole in it.
      count={card.value === null ? <span className="text-muted-foreground">—</span> : <CountUp value={card.value} format={format} />}
      subText={card.subText || undefined}
      trend={card.trendPct === null || card.trendPct === undefined ? undefined : <span className="text-xs font-semibold text-muted-foreground tabular-nums">{signed(card.trendPct)}</span>}
      onClick={card.to ? () => navigate(card.to) : undefined}
      fit
    />
  );
}

/** A panel's own "nothing here yet", in the words of what is missing - at the height the chart would
 * have been, so two panels side by side still end level (the house rule in Dashborad/widgets.jsx). */
const Nothing = ({ title, text, height = CHART_H }) => (
  <div className="grid place-items-center px-4 py-6" style={{ minHeight: height }}>
    <EmptyState title={title} text={text} />
  </div>
);

/** A caption that breaks the page into its two halves, in the shape the home dashboard uses. */
const Section = ({ title, text }) => (
  <div data-reveal className="mt-8 min-w-0">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
    {text && <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>}
  </div>
);

export default function OverviewPage() {
  const page = useRef(null);
  const read = useAsync(() => hrDashboard(), []);
  const d = read.data;
  useHrReveal(page, Boolean(d));

  const cards = rules.headlineCards(d);
  const costTrend = rules.costTrendRows(d, { label: shortMonth });
  const costDepts = rules.costDepartmentRows(d);
  const headDepts = rules.headcountDepartmentRows(d);
  const flow = rules.headcountFlowRows(d);
  const attendance = rules.attendanceRows(d);
  const seesMoney = rules.seesMoney(d);

  function exportCsv() {
    const { headers, rows } = rules.dashboardCsv(d, { label: shortMonth });
    downloadCSV(`hr-dashboard-${d?.period?.month || "current"}.csv`, headers, rows);
  }

  // Only the FIRST load takes the page away; a refresh keeps what is on screen (the house guard).
  if (read.loading && !d) return <PageSpinner label="Reading the figures" />;
  if (read.error) return <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8"><ErrorNote error={read.error} onRetry={read.reload} /></div>;

  return (
    <div ref={page} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Overview"
        description={`What the organisation employs and what its work costs${d?.period?.month ? `, ${shortMonth(d.period.month)}` : ""}${d?.generatedAt ? ` · as at ${formatDate(d.generatedAt)}` : ""}.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={read.reload} disabled={read.loading} aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${read.loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> Export
            </Button>
          </>
        }
      />

      {rules.isEmpty(d) ? (
        <div className="mt-6"><Nothing title="No employees yet" text="Add the first employee under People, and this page fills itself in." /></div>
      ) : (
        <>
          {/* Four tiles, always four, each one a way in. */}
          <div className="mt-6 grid gap-3 grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => <R key={card.key}><Headline card={card} /></R>)}
          </div>

          <Section title="What the work costs" text="Posted payroll runs only — a reversed run is not a cost." />

          {/* The lead: the money story, at full width because it is the point of the screen. */}
          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <R className="lg:col-span-3">
              <Panel title="Payroll by month" bodyClassName="px-2 pb-2">
                {read.loading && !costTrend.length ? <Skeleton style={{ height: CHART_H }} />
                  : rules.costTrendHasAny(costTrend) ? (
                    <MonthlyCost rows={costTrend} height={CHART_H} money={(n) => formatCurrencyAED(n)} axis={compactAmount} />
                  ) : (
                    <Nothing
                      title={seesMoney ? "No payroll run yet" : "Payroll figures are hidden"}
                      text={seesMoney ? "Post a run under Payroll and the months fill in here." : "You do not hold the permission to see pay."}
                    />
                  )}
              </Panel>
            </R>
            <R className="lg:col-span-2">
              <Panel title="Cost by department" bodyClassName="px-2 pb-2">
                {costDepts.length ? (
                  <RankedBars
                    rows={costDepts}
                    height={CHART_H}
                    valueText={(v) => formatCurrencyAED(v)}
                    axisText={compactAmount}
                    describe={(r) => (r.people ? `${formatNumber(r.people, 0)} paid` : null)}
                  />
                ) : (
                  <Nothing
                    title={seesMoney ? "Nothing to split yet" : "Hidden"}
                    text={seesMoney ? "A posted run splits itself by department here." : "A department of one names that one person's pay, so this needs the confidential permission."}
                  />
                )}
              </Panel>
            </R>
          </div>

          {/* Labour on work costed in the period - only when there is any. */}
          {d?.labour?.hasWork && (
            <div className="mt-4">
              <R>
                <Panel title="Labour on work costed this month" description="Not all labour — only what was booked to a process order or a job card.">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Figure label="Hours booked" value={formatNumber(d.labour.bookedHours, 1)} />
                    <Figure label="Hours not booked" value={formatNumber(d.labour.idleHours, 1)} />
                    <Figure label="Idle share" value={d.labour.idleShare === null ? "—" : `${formatNumber(d.labour.idleShare, 1)}%`} />
                  </div>
                  {d.labour.idleShare !== null && (
                    <div className="mt-4">
                      {/* Idle labour is a cost leaking away, so it reads as a warning rather than in the brand colour. */}
                      <Progress value={d.labour.idleShare} indicatorClassName="bg-status-warning" />
                      <p className="mt-1 text-xs text-muted-foreground">of paid hours did not reach a product or a job</p>
                    </div>
                  )}
                </Panel>
              </R>
            </div>
          )}

          <Section title="The people" text="Who is here, who arrived, who left, and who is in today." />

          {/* The strongest single panel on an HR dashboard: arrivals against departures, on one axis. */}
          <div className="mt-4">
            <R>
              <Panel title="Joiners and leavers" description="Leavers point downwards; the line is the headcount standing at each month end." bodyClassName="px-2 pb-2">
                {flow.length ? <MonthlyFlow rows={flow} label={shortMonth} height={280} /> : <Nothing title="No movement yet" text="Joiners and leavers appear here as people come and go." height={280} />}
              </Panel>
            </R>
          </div>

          {/* The smaller readings, three across. */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <R>
              <Panel title="Attendance this month" description={d?.attendance?.rate === null ? "Nothing marked yet." : `${formatNumber(d?.attendance?.rate, 1)}% of the days people were expected.`} bodyClassName="px-2 pb-2">
                {attendance.length ? (
                  <SplitRing rows={attendance} total={rules.attendanceTotal(d)} label="days marked" />
                ) : (
                  <Nothing title="Nothing marked this month" text="Mark the muster under Attendance and the month splits itself here." height={200} />
                )}
              </Panel>
            </R>
            <R>
              <Panel title="Headcount by department" bodyClassName="px-2 pb-2">
                {headDepts.length ? (
                  <RankedBars rows={headDepts} height={200} valueText={(v) => formatNumber(v, 0)} axisText={(v) => formatNumber(v, 0)} describe={(r) => `${formatNumber(r.value, 0)} active`} />
                ) : (
                  <Nothing title="Nobody assigned yet" text="Set a department on an employee and they appear here." height={200} />
                )}
              </Panel>
            </R>
            <R>
              <Panel title="Needs attention">
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <Row to="/hr/people" icon={AlertTriangle} tone={d?.headcount?.missingCostRate > 0 ? "warning" : undefined}
                    label="No cost rate" value={d?.headcount?.missingCostRate} note="Their work cannot be costed until a contract gives them one." />
                  <Row to="/hr/documents" icon={FileWarning} tone={d?.documents?.expired > 0 ? "danger" : d?.documents?.expiringSoon > 0 ? "warning" : undefined}
                    label="Renew documents" value={d?.documents?.expiringSoon} note={d?.documents?.expired ? `${d.documents.expired} already expired` : "Within 30 days"} />
                  <Row to="/hr/leave" icon={Clock} tone={d?.leave?.pending > 0 ? "warning" : undefined}
                    label="Leave to decide" value={d?.leave?.pending} note="Waiting for an approver." />
                  <Row to="/hr/attendance" icon={UserMinus} label="On leave today" value={d?.leave?.onLeaveToday} note="Approved and out today." />
                  {d?.checklists && (
                    <Row to="/hr/people" icon={CalendarCheck} tone={d.checklists.onboarding.late + d.checklists.exit.late > 0 ? "warning" : undefined}
                      label="Checklist items open" value={d.checklists.onboarding.open + d.checklists.exit.open}
                      note={d.checklists.onboarding.late + d.checklists.exit.late > 0 ? `${d.checklists.onboarding.late + d.checklists.exit.late} past their day` : "Onboarding and exit"} />
                  )}
                </div>
              </Panel>
            </R>
          </div>

          {/* Compliance lives on Reports, which already owns both panels in full. */}
          <div data-reveal className="mt-6 min-w-0 text-sm text-muted-foreground">
            Gratuity liability and Emiratisation are on <Link to="/hr/reports" className="font-medium text-primary hover:underline">Reports</Link>.
          </div>
        </>
      )}
    </div>
  );
}

/** One figure inside a panel, where a whole chart would be furniture around one number. */
const Figure = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
  </div>
);

/** One line of "needs attention": a count worth acting on, and where to go to act on it. */
function Row({ to, icon, label, value, note, tone }) {
  const Icon = icon;
  if (!rules.shown(value)) return null;
  const toneClass = tone === "danger" ? "text-status-danger" : tone === "warning" ? "text-status-warning" : "text-foreground";
  return (
    <Link to={to} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/40">
      <span className="flex min-w-0 items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${toneClass}`} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{label}</span>
          {note && <span className="block truncate text-xs text-muted-foreground">{note}</span>}
        </span>
      </span>
      <span className={`shrink-0 text-lg font-semibold tabular-nums ${toneClass}`}>{formatNumber(value, 0)}</span>
    </Link>
  );
}
