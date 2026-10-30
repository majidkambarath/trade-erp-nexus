import React, { useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Car, CheckCircle2, Clock, Hourglass, PlayCircle, Truck } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { CountUp } from "../Dashborad/CountUp";
import { JobMixRing } from "./garageCharts";
import { useGarageReveal } from "./useGarageReveal";
import JobCardView from "./JobCardView";
import { CompleteTaskDialog } from "./garageShared";
import { jobCards } from "../../lib/garageApi";
import { DUE_LABEL, DUE_TONE, garageErrorText, jobCardLabel } from "../../lib/garage";
import { formatDate } from "../../utils/format";
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

function JobCard({ card, onOpen }) {
  const state = jobCardLabel(card);
  return (
    <button
      type="button"
      onClick={() => onOpen(card.jobCardId)}
      className={`w-full rounded-lg border bg-card p-3 text-start text-sm shadow-sm transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${card.dueState === "overdue" ? "border-destructive/60" : ""}`}
      aria-label={`${card.jobNo}: ${card.vehicle}, ${state.label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-medium" title={card.vehicle}>{card.plate || card.vehicle}</span>
          <span className="block font-mono text-xs text-muted-foreground">{card.jobNo || "(draft)"}</span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Pill tone={state.tone}>{state.label}</Pill>
        {DUE_LABEL[card.dueState] && <Pill tone={DUE_TONE[card.dueState]}>{DUE_LABEL[card.dueState]}</Pill>}
      </div>
      <div className="mt-2 truncate text-xs text-muted-foreground">
        {card.customer}
        {card.who ? ` · ${card.who}` : ""}
        {card.due ? ` · due ${formatDate(card.due)}` : ""}
      </div>
    </button>
  );
}

export default function GarageBoard() {
  const board = useAsync(() => jobCards.board(), []);
  const { notify, toastNode } = useToasts();
  const [list, setList] = useState(null);
  const [starting, setStarting] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [failure, setFailure] = useState(null);
  const [open, setOpen] = useState(null); // the job card id shown in JobCardView, like ProcessOrderView on ProcessBoard
  const raw = board.data;
  const d = raw && { counts: raw.counts || {}, columns: raw.columns || [], mine: raw.mine || [], overdue: raw.overdue || [], dueToday: raw.dueToday || [], dueTomorrow: raw.dueTomorrow || [] };
  const scope = useRef(null);
  useGarageReveal(scope, Boolean(d));

  if (board.loading && !raw) return <PageSpinner label="Loading the board" />;
  if (board.error) return <ErrorNote error={board.error} onRetry={board.reload} />;
  if (!d) return null;

  const openCard = setOpen;

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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{chosen.map((c) => <JobCard key={c.jobCardId} card={c} onOpen={openCard} />)}</div>
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
                    <span className="font-medium">{c.taskName}</span> · {c.plate || c.vehicle} <span className="text-muted-foreground">({c.jobNo})</span>
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
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{col.cards.map((c) => <JobCard key={c.jobCardId} card={c} onOpen={openCard} />)}</div>
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
      {open && (
        <JobCardView
          id={open}
          onClose={() => setOpen(null)}
          onChanged={(m) => { notify(m); board.reload(); }}
          onRemoved={(m) => { setOpen(null); notify(m); board.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
