import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Car, CheckCircle2, Clock, Hourglass, PlayCircle, Truck } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { CountUp } from "../Dashborad/CountUp";
import { JobMixRing } from "./garageCharts";
import { useGarageReveal } from "./useGarageReveal";
import { Progress } from "../ui/progress";
import { CompleteTaskDialog } from "./garageShared";
import { jobCards } from "../../lib/garageApi";
import { DUE_LABEL, DUE_TONE, garageErrorText, INVOICE_STATUS_LABEL, jobCardLabel, vehiclePlateText } from "../../lib/garage";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { EmptyState, ErrorNote, PageHeader, Panel, Pill, PageSpinner, useAsync, useToasts } from "../accounting/kit";

// Inventory > Garage > Board: what is in the workshop right now - waiting for approval, in progress, ready
// for collection, delivered but not yet invoiced - where every live job card is (a column per current task),
// and the technician's own work. Worked out by the server from the live job cards (GET /garage/job-cards/board);
// nothing here is stored. The layout follows Inventory > Production > Board (ProcessBoard.jsx): counts the
// owner glances at, a column per place work is held up, "my work" with one-tap actions - with a ring reading
// the workshop's health at a glance and a short arrival stagger (useGarageReveal), the same restraint the home
// dashboard and the CRM already use: the board is read, not watched, so nothing moves twice.

const TILES = [
  { key: "jobs", label: "Jobs in the workshop", icon: Car, tone: "neutral" },
  { key: "awaitingApproval", label: "Waiting for approval", icon: Hourglass, tone: "warning" },
  { key: "inProgress", label: "In progress", icon: PlayCircle, tone: "teal" },
  { key: "overdue", label: "Overdue", icon: AlertTriangle, tone: "danger", danger: true, list: "overdue" },
  { key: "dueToday", label: "Due today", icon: Clock, tone: "warning", list: "dueToday" },
  { key: "dueTomorrow", label: "Due tomorrow", icon: CalendarClock, tone: "neutral", list: "dueTomorrow" },
  { key: "ready", label: "Ready for collection", icon: CheckCircle2, tone: "olive" },
  { key: "deliveredNotInvoiced", label: "Delivered, not invoiced", icon: Truck, tone: "danger", danger: true },
];

// The health reading: four states that say whether the workshop is on top of its work, not merely busy with
// it. Status tokens, not categorical hues - CLAUDE.md's own reasoning for why an age scale takes colour
// applies here word for word: this is a state, not a group.
// Every live card lands in exactly one of these five (counts.jobs is their sum, D17): a DRAFT card, or one
// with no open task, used to be in none of them, so the ring's own total disagreed with the "Jobs in the
// workshop" tile beside it.
const RING_ROWS = [
  { key: "notStarted", name: "Not started", color: "var(--muted-foreground)" },
  { key: "awaitingApproval", name: "Waiting for approval", color: "var(--status-warning)" },
  { key: "inProgress", name: "In progress", color: "var(--chart-2)" },
  { key: "ready", name: "Ready for collection", color: "var(--status-success)" },
  { key: "deliveredNotInvoiced", name: "Delivered, not invoiced", color: "var(--status-danger)" },
];

// What board() already sends and the card used to throw away: doneTasks/taskCount (a progress bar - the
// single biggest readability gain the bodyshop-tracker reference offers over a bare status pill), the
// estimate value, the bay, and the invoice state. None of this is a new server call - it rides on the
// same GET /garage/job-cards/board payload the counts and columns already come from.
function JobCard({ card }) {
  const state = jobCardLabel(card);
  const hasTasks = card.taskCount > 0;
  const pct = hasTasks ? Math.round((card.doneTasks / card.taskCount) * 100) : 0;
  // The full plate (G7: emirate · code · number, the same helper VehicleView and the register use) when
  // the card carries one, else the vehicle's make and model - never both, there is no room for it here.
  // The board's own card shape names the number `plate`, not `plateNumber` (unlike Vehicle/VehicleView
  // and the job-cards register), so it is handed across under the name vehiclePlateText expects.
  const plateText = vehiclePlateText({ plateNumber: card.plate, plateCode: card.plateCode, plateEmirate: card.plateEmirate }) || card.vehicle;
  return (
    <Link
      to={`/garage/job-cards?open=${card.jobCardId}`}
      className={`block w-full rounded-lg border bg-card p-3 text-start text-sm shadow-sm transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${card.dueState === "overdue" ? "border-destructive/60" : ""}`}
      aria-label={`${card.jobNo}: ${card.vehicle}, ${state.label}${hasTasks ? `, ${card.doneTasks} of ${card.taskCount} tasks done` : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-medium" title={plateText}>{plateText}</span>
          <span className="block font-mono text-xs text-muted-foreground">{card.jobNo || "(draft)"}</span>
        </span>
        {card.total > 0 && <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums">{formatCurrencyAED(card.total)}</span>}
      </div>
      {hasTasks && (
        <div className="mt-2">
          <Progress
            value={pct}
            className="h-1.5"
            indicatorClassName={card.dueState === "overdue" ? "bg-status-danger" : undefined}
            aria-hidden="true"
          />
          <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">{card.doneTasks}/{card.taskCount} tasks</span>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Pill tone={state.tone}>{state.label}</Pill>
        {DUE_LABEL[card.dueState] && <Pill tone={DUE_TONE[card.dueState]}>{DUE_LABEL[card.dueState]}</Pill>}
        {card.invoiceStatus !== "NONE" && <Pill tone="neutral">{INVOICE_STATUS_LABEL[card.invoiceStatus] || card.invoiceStatus}</Pill>}
      </div>
      <div className="mt-2 truncate text-xs text-muted-foreground">
        {card.customer}
        {card.who ? ` · ${card.who}` : ""}
        {card.bay ? ` · ${card.bay}` : ""}
        {card.due ? ` · due ${formatDate(card.due)}` : ""}
      </div>
    </Link>
  );
}

export default function GarageBoard() {
  const board = useAsync(() => jobCards.board(), []);
  const { notify, toastNode } = useToasts();
  const [list, setList] = useState(null);
  const [starting, setStarting] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [failure, setFailure] = useState(null);
  const raw = board.data;
  const d = raw && { counts: raw.counts || {}, columns: raw.columns || [], mine: raw.mine || [], overdue: raw.overdue || [], dueToday: raw.dueToday || [], dueTomorrow: raw.dueTomorrow || [] };
  const scope = useRef(null);
  useGarageReveal(scope, Boolean(d));

  if (board.loading && !raw) return <PageSpinner label="Loading the board" />;
  if (board.error) return <ErrorNote error={board.error} onRetry={board.reload} />;
  if (!d) return null;


  const start = async (card) => {
    setFailure(null);
    setStarting(card.jobCardId);
    try {
      await jobCards.startTask(card.jobCardId, card.taskId);
      notify(`${card.taskName} started on ${card.jobNo}.`);
      board.reload();
    } catch (err) {
      setFailure(err);
    } finally {
      setStarting(null);
    }
  };
  const chosen = list ? d[list] : null;
  const ringRows = RING_ROWS.map((r) => ({ ...r, value: d.counts[r.key] || 0 }));
  const ringTotal = ringRows.reduce((t, r) => t + r.value, 0);

  return (
    <div ref={scope} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Garage" description="The workshop today: what is waiting, what is in progress, and what is ready to go out." />

      <ul data-reveal className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Where the work stands">
        {TILES.map((t) => {
          const n = d.counts[t.key] || 0;
          const pressed = t.list && list === t.list;
          return (
            <li key={t.key}>
              <StatCard
                title={t.label}
                icon={<t.icon aria-hidden="true" />}
                tone={t.tone}
                count={<CountUp value={n} format={(v) => String(Math.round(v))} />}
                onClick={t.list ? () => setList(pressed ? null : t.list) : undefined}
                className={pressed ? "ring-2 ring-ring" : undefined}
              />
            </li>
          );
        })}
      </ul>

      {failure && <div className="mt-4"><ErrorNote error={new Error(garageErrorText(failure))} /></div>}

      {chosen && (
        <div data-reveal className="mt-6">
          <Panel title={`${TILES.find((t) => t.list === list).label} (${chosen.length})`} actions={<Button size="sm" variant="outline" onClick={() => setList(null)}>Close</Button>}>
            {chosen.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here.</p> : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{chosen.map((c) => <JobCard key={c.jobCardId} card={c} />)}</div>
            )}
          </Panel>
        </div>
      )}

      {ringTotal > 0 && (
        <div data-reveal className="mt-6">
          <Panel title="The workshop's health" description="What every live job is made of, at a glance.">
            <JobMixRing rows={ringRows} total={ringTotal} />
          </Panel>
        </div>
      )}

      {d.mine.length > 0 && (
        <div data-reveal className="mt-6">
          <Panel title="My work" description="Tasks given to you. Start one when you begin, and mark it done with the hours it took.">
            <ul className="divide-y rounded-lg border">
              {d.mine.map((c) => (
                <li key={`${c.jobCardId}-${c.taskId}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{c.taskName}</span> · {vehiclePlateText({ plateNumber: c.plate, plateCode: c.plateCode, plateEmirate: c.plateEmirate }) || c.vehicle} <span className="text-muted-foreground">({c.jobNo})</span>
                    {DUE_LABEL[c.dueState] && <span className="ms-2"><Pill tone={DUE_TONE[c.dueState]}>{DUE_LABEL[c.dueState]}</Pill></span>}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {c.taskStatus === "READY" && <Button size="sm" variant="outline" onClick={() => start(c)} disabled={starting === c.jobCardId}>Start</Button>}
                    <Button size="sm" onClick={() => setCompleting(c)}>Done</Button>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <div data-reveal className="mt-6">
        <Panel title="Where every job is" description="A column per task. A job sits in the column of the task it is at; red is overdue.">
          {d.columns.length === 0 ? (
            <EmptyState title="Nothing in the workshop" text="Open a job card and send its estimate: once approved, it appears here at its first task." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {d.columns.map((col) => (
                <section key={col.name} aria-label={col.name} className="min-w-0 rounded-xl bg-muted/40 p-3">
                  <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
                    <span>{col.name}</span>
                    <span className="rounded-full bg-card px-2 text-xs tabular-nums text-muted-foreground">{col.cards.length}</span>
                  </h3>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{col.cards.map((c) => <JobCard key={c.jobCardId} card={c} />)}</div>
                </section>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {completing && (
        <CompleteTaskDialog
          jobCardId={completing.jobCardId}
          task={completing}
          onClose={() => setCompleting(null)}
          onDone={(m) => { setCompleting(null); notify(m); board.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
