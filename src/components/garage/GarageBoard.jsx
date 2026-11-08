import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Hourglass, Truck } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { CountUp } from "../Dashborad/CountUp";
import { JobMixRing } from "./garageCharts";
import { useGarageReveal } from "./useGarageReveal";
import { Progress } from "../ui/progress";
import { CompleteTaskDialog } from "./garageShared";
import StatusChips, { chipsFrom } from "./StatusChips";
import { jobCards } from "../../lib/garageApi";
import { AGE_BAND_LABEL, AGE_BAND_TONE, DUE_LABEL, DUE_TONE, garageErrorText, INVOICE_STATUS_LABEL, JOB_STATUS, JOB_TYPE_LABEL, jobCardLabel, vehiclePlateText } from "../../lib/garage";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { EmptyState, ErrorNote, PageHeader, Panel, Pill, PageSpinner, useAsync, useToasts } from "../accounting/kit";

// Inventory > Garage > Board: what is in the workshop right now - waiting for approval, in progress, ready
// for collection, delivered but not yet invoiced - where every live job card is (a column per current task),
// and the technician's own work. Worked out by the server from the live job cards (GET /garage/job-cards/board);
// nothing here is stored. The layout follows Inventory > Production > Board (ProcessBoard.jsx): counts the
// owner glances at, a column per place work is held up, "my work" with one-tap actions - with a ring reading
// the workshop's health at a glance and a short arrival stagger (useGarageReveal), the same restraint the home
// dashboard and the CRM already use: the board is read, not watched, so nothing moves twice.

// The board is an OPERATIONAL screen, not an analytical one: it answers "what needs me now", read in
// seconds from across a workshop, and on a quiet day it should LOOK quiet. That is why the eight counts
// are no longer eight identical tiles - a flat grid gave "Due tomorrow: 0" exactly the weight of
// "Overdue: 2", so nothing stood out and the screen read the same whatever was happening.
//
// They are ranked instead, and nothing was dropped:
//   - the headline is context (how big is today, and are we moving),
//   - these tiles are the things somebody has to DO something about,
//   - the rest (in progress, due tomorrow) is flow state, read as a quiet line under them and in the
//     ring and the columns below, where it already was.
const TILES = [
  { key: "overdue", label: "Overdue", icon: AlertTriangle, tone: "danger", list: "overdue" },
  { key: "dueToday", label: "Due today", icon: Clock, tone: "warning", list: "dueToday" },
  { key: "awaitingApproval", label: "Waiting for approval", icon: Hourglass, tone: "warning" },
  { key: "ready", label: "Ready for collection", icon: CheckCircle2, tone: "olive" },
  { key: "deliveredNotInvoiced", label: "Delivered, not invoiced", icon: Truck, tone: "danger" },
];

// Flow state: true but not a call to action, so it reads as one quiet line rather than three tiles.
const QUIET = [
  { key: "inProgress", label: "In progress" },
  { key: "dueTomorrow", label: "Due tomorrow" },
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
      {/* Only what is NOT the ordinary case gets a pill. The age band and the job type both ride on the
          board payload already; showing "Under 5 days" and "Retail" on every card would be a row of
          pills that say nothing, which is the noise this screen is trying to get rid of. */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Pill tone={state.tone}>{state.label}</Pill>
        {DUE_LABEL[card.dueState] && <Pill tone={DUE_TONE[card.dueState]}>{DUE_LABEL[card.dueState]}</Pill>}
        {card.ageBand && card.ageBand !== "u5" && <Pill tone={AGE_BAND_TONE[card.ageBand] || "neutral"}>{AGE_BAND_LABEL[card.ageBand]}</Pill>}
        {card.jobType && card.jobType !== "retail" && <Pill tone="neutral">{JOB_TYPE_LABEL[card.jobType] || card.jobType}</Pill>}
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
  const [status, setStatus] = useState("");
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

  // Status chips with counts, that double as filters - the one pattern every garage-UI reference leads
  // with. They are built from the cards actually on the board rather than from `counts`, so a chip can
  // never offer a state that filters to nothing: what it counts is exactly what pressing it shows.
  const chips = chipsFrom(d.columns.flatMap((c) => c.cards), "status", JOB_STATUS);
  const columns = status
    ? d.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.status === status) })).filter((col) => col.cards.length)
    : d.columns;

  return (
    <div ref={scope} className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Garage" description="The workshop today: what is waiting, what is in progress, and what is ready to go out." />

      {/* The headline: how big today is, and whether the shop is moving. `doneToday` has been on the
          board payload all along and was never drawn - on an operational screen it is the one number
          that says the day is going well, so it belongs beside the total rather than nowhere. */}
      <div data-reveal className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums text-foreground">
            <CountUp value={d.counts.jobs || 0} format={(v) => String(Math.round(v))} />
          </span>
          <span className="text-sm text-muted-foreground">{(d.counts.jobs || 0) === 1 ? "job in the workshop" : "jobs in the workshop"}</span>
        </p>
        {(d.counts.doneToday || 0) > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-status-success">{d.counts.doneToday}</span> finished today
          </p>
        )}
      </div>

      <ul data-reveal className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Where the work stands">
        {TILES.map((t) => {
          const n = d.counts[t.key] || 0;
          const pressed = t.list && list === t.list;
          return (
            <li key={t.key}>
              <StatCard
                title={t.label}
                icon={<t.icon aria-hidden="true" />}
                // Nothing to act on is not news: a zero keeps the neutral tone so a calm day looks
                // calm and the saturated colour is left to mean something.
                tone={n === 0 ? "neutral" : t.tone}
                count={<CountUp value={n} format={(v) => String(Math.round(v))} />}
                className={[n === 0 ? "opacity-60" : "", pressed ? "ring-2 ring-ring" : ""].filter(Boolean).join(" ") || undefined}
                onClick={t.list ? () => setList(pressed ? null : t.list) : undefined}
              />
            </li>
          );
        })}
      </ul>

      <ul data-reveal className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Also on the board">
        {QUIET.map((q) => (
          <li key={q.key}>
            <span className="font-medium tabular-nums text-foreground">{d.counts[q.key] || 0}</span> {q.label.toLowerCase()}
          </li>
        ))}
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
                    {/* Where the job stands and which bay to walk to - both already on the row, neither
                        was drawn, and they are the two things a technician needs before starting. */}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.taskCount > 0 && <span className="tabular-nums">{c.doneTasks}/{c.taskCount} tasks</span>}
                      {c.taskCount > 0 && c.bay ? " · " : ""}
                      {c.bay}
                      {(c.taskCount > 0 || c.bay) && c.due ? " · " : ""}
                      {c.due ? `due ${formatDate(c.due)}` : ""}
                    </span>
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
          <StatusChips chips={chips} value={status} onChange={setStatus} label="Filter the board by status" className="mb-3" />
          {columns.length === 0 ? (
            <EmptyState
              title={status ? "Nothing at that status" : "Nothing in the workshop"}
              text={status ? "Press the chip again, or Show all, to see the rest of the board." : "Open a job card and send its estimate: once approved, it appears here at its first task."}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {columns.map((col) => (
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
