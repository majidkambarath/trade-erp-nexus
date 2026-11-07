// HRMS > Overview (/hr/overview): the HR MIS dashboard, led by what labour COSTS.
//
// This screen used to be three stat cards, and its own header said why: attendance, leave and payroll had
// no tiles "because none of them exist yet - an empty card standing in for a module nobody built is
// exactly the 'form that saves nothing' CLAUDE.md's own convention refuses". They exist now, so the cards
// are real figures, and that rule still governs every panel below: a panel with nothing behind it says so
// in words rather than drawing a confident zero.
//
// Nothing here computes a figure. The server answers the whole screen in one read, every number coming
// from the service that owns it (payroll's own totals, the gratuity accrual, the expiry report), so a card
// can never disagree with the page it links to. The shaping is in src/lib/hrDashboard.js, tested without
// rendering; the motion rules are in ./useHrReveal.js.
//
// MONEY IS THE SERVER'S DECISION. A reader without hr.confidential is answered without the divisible
// figures at all, so they arrive `undefined` - which is how this screen tells "hidden from you" from
// "none". It never asks what the reader may see; it draws what it was given.
import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarCheck, Clock, Download, FileWarning, TrendingUp, UserMinus, Users, Wallet } from "lucide-react";
import StatCard from "../ui/stat-card";
import { Button } from "../ui/button";
import { EmptyState, ErrorNote, Panel, Pill, Spinner, useAsync } from "../accounting/kit";
import { RankedBars } from "../Dashborad/FlowCharts";
import { CountUp } from "../Dashborad/CountUp";
import { compactAmount, monthLabel } from "../Dashborad/helpers";
import { hrDashboard } from "../../lib/hrApi";
import * as rules from "../../lib/hrDashboard";
import { CURRENCY, formatCurrencyAED, formatNumber, downloadCSV } from "../../utils/format";
import { MonthlyFlow, ShareBar, SplitRing } from "./hrCharts";
import { useHrReveal } from "./useHrReveal";

const ICONS = { cost: Wallet, perEmployee: TrendingUp, headcount: Users, attendance: CalendarCheck, documents: FileWarning };
const shortMonth = (m) => monthLabel(m);

/** One headline figure. `kind` decides the formatting here, where the currency and locale live. */
function Headline({ card }) {
  const Icon = ICONS[card.key] || Users;
  const format =
    card.kind === "money" ? (n) => formatCurrencyAED(n)
      : card.kind === "percent" ? (n) => `${formatNumber(n, 1)}%`
        : (n) => formatNumber(n, 0);
  return (
    <StatCard
      icon={<Icon />}
      title={card.title}
      // A withheld or not-yet-known figure is a dash, never a zero that would read as a real answer.
      count={card.value === null ? <span className="text-muted-foreground">—</span> : <CountUp value={card.value} format={format} />}
      subText={card.subText || undefined}
      tone={card.tone}
      fit
    />
  );
}

/** A panel's own "nothing here yet", in the words of what is missing. */
const Nothing = ({ title, text }) => (
  <div className="grid min-h-40 place-items-center px-4 py-6">
    <EmptyState title={title} text={text} />
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
  const costNote = rules.changeNote(d?.cost?.changePct);

  function exportCsv() {
    const { headers, rows } = rules.dashboardCsv(d, { label: shortMonth });
    downloadCSV(`hr-dashboard-${d?.period?.month || "current"}.csv`, headers, rows);
  }

  if (read.loading) return <div className="p-6"><Spinner label="Reading the figures" /></div>;
  if (read.error) return <div className="p-6"><ErrorNote error={read.error} onRetry={read.reload} /></div>;

  return (
    <div ref={page} className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">
            What the organisation employs, what its work costs, and what needs attention
            {d?.period?.month ? ` — ${shortMonth(d.period.month)}` : ""}.
          </p>
        </div>
        {flow.length > 0 && (
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> Export
          </Button>
        )}
      </div>

      {rules.isEmpty(d) ? (
        <Nothing title="No employees yet" text="Add the first employee under People, and this page fills itself in." />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Band 1 - the headline figures, cost first. */}
          <div data-reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map((card) => <Headline key={card.key} card={card} />)}
          </div>

          {/* Band 2 - cost, the point of the screen. */}
          <div data-reveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Payroll by month" description={costNote || "Posted runs only — a reversed run is not a cost."}>
              {costTrend.length ? (
                <RankedBars
                  rows={costTrend}
                  valueText={(v) => formatCurrencyAED(v)}
                  axisText={compactAmount}
                  describe={(r) => (r.employees ? `${formatNumber(r.employees, 0)} paid` : null)}
                />
              ) : (
                <Nothing
                  title={seesMoney ? "No payroll run yet" : "Payroll figures are hidden"}
                  text={seesMoney ? "Post a run under Payroll and the months appear here." : "You do not hold the permission to see pay."}
                />
              )}
            </Panel>

            <Panel title="Cost by department" description={seesMoney ? "This month's posted payroll, split by where people work." : undefined}>
              {costDepts.length ? (
                <RankedBars
                  rows={costDepts}
                  valueText={(v) => formatCurrencyAED(v)}
                  axisText={compactAmount}
                  describe={(r) => (r.people ? `${formatNumber(r.people, 0)} paid` : null)}
                />
              ) : (
                <Nothing
                  title={seesMoney ? "Nothing to split yet" : "Hidden"}
                  text={seesMoney ? "A posted payroll run splits itself by department here." : "A department's pay bill names the pay of a department of one, so it needs the confidential permission."}
                />
              )}
            </Panel>
          </div>

          {/* Labour on work costed in the period. Deliberately narrow: see utils/hrDashboard.js labourFlow
              for why there is no organisation-wide idle figure to show. */}
          {/* Panel takes a fixed prop list and does not spread the rest, so data-reveal goes on a wrapper -
              put on the Panel itself it would be dropped and this one would never join the stagger. */}
          {d?.labour?.hasWork && (
            <div data-reveal>
            <Panel title="Labour on work costed this month" description="Not all labour — only what was booked to a process order or a job card.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Hours booked</p><p className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(d.labour.bookedHours, 1)}</p></div>
                <div><p className="text-xs text-muted-foreground">Hours not booked</p><p className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(d.labour.idleHours, 1)}</p></div>
                <div>
                  <p className="text-xs text-muted-foreground">Idle share</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">{d.labour.idleShare === null ? "—" : `${formatNumber(d.labour.idleShare, 1)}%`}</p>
                </div>
              </div>
              {d.labour.idleShare !== null && <div className="mt-3"><ShareBar value={d.labour.idleShare} tone="var(--chart-5)" label="of paid hours did not reach a product or a job" /></div>}
            </Panel>
            </div>
          )}

          {/* Band 3 - operations. */}
          <div data-reveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Joiners and leavers" description="Leavers point downwards; the line is the headcount at each month end.">
              {flow.length ? <MonthlyFlow rows={flow} label={shortMonth} /> : <Nothing title="No movement yet" text="Joiners and leavers appear here as people come and go." />}
            </Panel>

            <Panel title="Attendance this month" description={d?.attendance?.rate === null ? "Nothing marked yet." : `${formatNumber(d?.attendance?.rate, 1)}% of the days people were expected.`}>
              {attendance.length ? (
                <SplitRing rows={attendance} total={rules.attendanceTotal(d)} label="days marked" />
              ) : (
                <Nothing title="Nothing marked this month" text="Mark the muster under Attendance and the month splits itself here." />
              )}
            </Panel>
          </div>

          <div data-reveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Headcount by department">
              {headDepts.length ? (
                <RankedBars rows={headDepts} valueText={(v) => formatNumber(v, 0)} axisText={(v) => formatNumber(v, 0)} describe={(r) => `${formatNumber(r.value, 0)} active`} />
              ) : (
                <Nothing title="Nobody assigned yet" text="Set a department on an employee and they appear here." />
              )}
            </Panel>

            <Panel title="Needs attention">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <Row to="/hr/people" icon={AlertTriangle} tone={d?.headcount?.missingCostRate > 0 ? "warning" : undefined}
                  label="No cost rate" value={d?.headcount?.missingCostRate}
                  note="Their work cannot be costed until a contract gives them one." />
                {/* "Renew documents", not "Documents expiring": the headline card above already carries
                    that figure under that name, and one screen saying the same words twice reads as a
                    mistake. A card is a figure; a row in this list is something to go and do. */}
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
          </div>

          {/* Compliance, where it applies. Gratuity is a liability the books carry; Emiratisation is UAE
              only and the server simply does not send it elsewhere. */}
          {(d?.gratuity || d?.emiratisation) && (
            <div data-reveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {d?.gratuity && (
                <Panel title="Gratuity liability" description="What end-of-service would cost if everybody left today.">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {rules.shown(d.gratuity.liability) ? `${CURRENCY} ${formatNumber(d.gratuity.liability, 2)}` : "Hidden"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accrued to {shortMonth(d.gratuity.month)}
                    {d.gratuity.employeeCount ? ` · ${formatNumber(d.gratuity.employeeCount, 0)} employees` : ""}
                  </p>
                  <Link to="/hr/reports" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">See the breakdown</Link>
                </Panel>
              )}
              {d?.emiratisation && (
                <Panel title="Emiratisation" description={d.emiratisation.configured === false ? "The statutory rules are not set yet." : undefined}>
                  {d.emiratisation.configured === false ? (
                    <Link to="/hr/setup" className="text-sm font-medium text-primary hover:underline">Set the rate and the fine under Setup</Link>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {/* The fields are the compliance rule's own: nationals, headcount, required,
                          shortfall, monthlyExposure. There is no "actual percent" - it is derived here
                          from the two counts, so the figure and the counts can never disagree. */}
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-semibold tabular-nums text-foreground">
                          {formatNumber(d.emiratisation.nationals, 0)}
                          <span className="text-base font-normal text-muted-foreground"> of {formatNumber(d.emiratisation.headcount, 0)}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(d.emiratisation.required, 0)} needed at {formatNumber(d.emiratisation.requiredPercent ?? 0, 1)}%
                        </p>
                      </div>
                      {d.emiratisation.compliant ? (
                        <Pill tone="success">Meeting the quota</Pill>
                      ) : (
                        <Pill tone="warning">
                          {formatNumber(d.emiratisation.shortfall, 0)} more Emirati {d.emiratisation.shortfall === 1 ? "employee" : "employees"} needed
                        </Pill>
                      )}
                      {/* The reason this tracker earns its place: what standing still costs per month. */}
                      {d.emiratisation.monthlyExposure > 0 && (
                        <p className="text-xs text-muted-foreground">
                          About {CURRENCY} {formatNumber(d.emiratisation.monthlyExposure, 2)} a month in fines if nothing changes.
                        </p>
                      )}
                      <Link to="/hr/reports" className="text-sm font-medium text-primary hover:underline">See the tracker</Link>
                    </div>
                  )}
                </Panel>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
