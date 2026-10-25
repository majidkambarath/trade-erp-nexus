import React, { useState } from "react";
import { AlertTriangle, CalendarClock, Car, CheckCircle2, Clock, Hourglass, PlayCircle, Truck } from "lucide-react";
import { Button } from "../ui/button";
import { jobCards } from "../../lib/garageApi";
import { DUE_LABEL, DUE_TONE, garageErrorText, jobCardLabel } from "../../lib/garage";
import { formatDate } from "../../utils/format";
import { EmptyState, ErrorNote, Field, Modal, Panel, Pill, PageSpinner, TextInput, useAsync, useToasts } from "../accounting/kit";

// Inventory > Garage > Board: what is in the workshop right now - waiting for approval, in progress, ready
// for collection, delivered but not yet invoiced - where every live job card is (a column per current task),
// and the technician's own work. Worked out by the server from the live job cards (GET /garage/job-cards/board);
// nothing here is stored. The layout follows Inventory > Production > Board (ProcessBoard.jsx) for the same
// reasons: counts the owner glances at, a column per place work is held up, "my work" with one-tap actions.

const TILES = [
  { key: "jobs", label: "Jobs in the workshop", icon: Car },
  { key: "awaitingApproval", label: "Waiting for approval", icon: Hourglass },
  { key: "inProgress", label: "In progress", icon: PlayCircle },
  { key: "overdue", label: "Overdue", icon: AlertTriangle, danger: true, list: "overdue" },
  { key: "dueToday", label: "Due today", icon: Clock, list: "dueToday" },
  { key: "dueTomorrow", label: "Due tomorrow", icon: CalendarClock, list: "dueTomorrow" },
  { key: "ready", label: "Ready for collection", icon: CheckCircle2 },
  { key: "deliveredNotInvoiced", label: "Delivered, not invoiced", icon: Truck, danger: true },
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

function CompleteTaskDialog({ jobCardId, task, onClose, onDone }) {
  const [hours, setHours] = useState("");
  const [skip, setSkip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      await jobCards.completeTask(jobCardId, task.taskId, skip ? { skip: true } : { actualHours: hours === "" ? undefined : Number(hours) });
      onDone(`${task.taskName} ${skip ? "skipped" : "done"}.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={task.taskName}
      description={`On ${task.jobNo}, ${task.vehicle}.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : skip ? "Mark skipped" : "Mark done"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        {!skip && (
          <Field label="Hours actually taken" hint="Leave blank to use the standard hours for this task.">
            <TextInput type="number" min="0" step="any" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours actually taken" autoFocus />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          The customer declined this job after the card was released - skip it instead
        </label>
      </div>
    </Modal>
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

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Where the work stands">
        {TILES.map((t) => {
          const Icon = t.icon;
          const n = d.counts[t.key] || 0;
          const pressed = t.list && list === t.list;
          const Tag = t.list ? "button" : "div";
          return (
            <li key={t.key} className="grid">
              <Tag
                {...(t.list ? { type: "button", onClick: () => setList(pressed ? null : t.list), "aria-pressed": pressed } : {})}
                className={`rounded-xl border bg-card p-3 text-start ${t.list ? "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""} ${pressed ? "border-primary" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t.label}</span>
                  <Icon className={`h-4 w-4 ${t.danger && n ? "text-destructive" : ""}`} aria-hidden="true" />
                </div>
                <div className={`mt-1 text-2xl font-semibold tabular-nums ${t.danger && n ? "text-destructive" : ""}`}>{n}</div>
              </Tag>
            </li>
          );
        })}
      </ul>

      {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}

      {chosen && (
        <Panel title={`${TILES.find((t) => t.list === list).label} (${chosen.length})`} actions={<Button size="sm" variant="outline" onClick={() => setList(null)}>Close</Button>}>
          {chosen.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here.</p> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{chosen.map((c) => <JobCard key={c.jobCardId} card={c} onOpen={() => {}} />)}</div>
          )}
        </Panel>
      )}

      {d.mine.length > 0 && (
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
      )}

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
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{col.cards.map((c) => <JobCard key={c.jobCardId} card={c} onOpen={() => {}} />)}</div>
              </section>
            ))}
          </div>
        )}
      </Panel>

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
