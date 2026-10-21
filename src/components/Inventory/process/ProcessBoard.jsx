import React, { useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Factory, Hourglass, PlayCircle, Truck } from "lucide-react";
import { Button } from "../../ui/button";
import { processOrders } from "../../../lib/processOrderApi";
import { DUE_LABEL, DUE_TONE, processErrorText, stepLabel } from "../../../lib/processOrders";
import { formatDate, formatNumber } from "../../../utils/format";
import { orgCurrency } from "../../../utils/orgLocale";
import { EmptyState, ErrorNote, Panel, Pill, PageSpinner, useAsync, useToasts } from "../../accounting/kit";
import { CompleteStepDialog, ProcessOrderView } from "./ProcessOrdersTab";

// The owner's board (Inventory > Production > Board): what is pending, in progress, late, due today or tomorrow, where
// every open order is (a column per step), what is on my own list, and what is out with job workers. Worked out by the
// server from the open process orders and challans (GET /process-orders/board); nothing here is stored.

const qty = (n) => formatNumber(n ?? 0, 3).replace(/\.?0+$/, "");

const TILES = [
  { key: "orders", label: "Orders in process", icon: Factory },
  { key: "pending", label: "Pending", icon: Hourglass },
  { key: "inProgress", label: "In progress", icon: PlayCircle },
  { key: "overdue", label: "Overdue", icon: AlertTriangle, danger: true, list: "overdue" },
  { key: "dueToday", label: "Due today", icon: Clock, list: "dueToday" },
  { key: "dueTomorrow", label: "Due tomorrow", icon: CalendarClock, list: "dueTomorrow" },
  { key: "readyToFinish", label: "Ready to finish", icon: CheckCircle2 },
  { key: "doneToday", label: "Steps done today", icon: CheckCircle2 },
];

function OrderCard({ card, onOpen }) {
  const s = stepLabel(card);
  return (
    <button
      type="button"
      onClick={() => onOpen(card.orderId)}
      className={`w-full rounded-lg border bg-card p-3 text-start text-sm shadow-sm transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${card.dueState === "overdue" ? "border-destructive/60" : ""}`}
      aria-label={`${card.processNo}: ${card.itemName}, ${card.stepName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-medium" title={card.itemName}>{card.itemName}</span>
          <span className="block font-mono text-xs text-muted-foreground">{card.processNo}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap tabular-nums">{qty(card.plannedQty)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Pill tone={s.tone}>{s.label}</Pill>
        {DUE_LABEL[card.dueState] && <Pill tone={DUE_TONE[card.dueState]}>{DUE_LABEL[card.dueState]}</Pill>}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {card.stepSeq ? `Step ${card.stepSeq} of ${card.stepCount}` : "All steps done"}
        {card.who ? ` · ${card.who}` : ""}
        {card.due ? ` · due ${formatDate(card.due)}` : ""}
        {card.jobWorkNo ? ` · ${card.jobWorkNo}` : ""}
      </div>
    </button>
  );
}

export default function ProcessBoard() {
  const board = useAsync(() => processOrders.board(), []);
  const { notify, toastNode } = useToasts();
  const [open, setOpen] = useState(null);
  const onOpen = setOpen;
  const [list, setList] = useState(null); // "overdue" | "dueToday" | "dueTomorrow"
  const [completing, setCompleting] = useState(null);
  const [failure, setFailure] = useState(null);
  const raw = board.data;
  // an older or partial answer must not blank the page: every part defaults to empty
  const d = raw && { counts: raw.counts || {}, columns: raw.columns || [], mine: raw.mine || [], overdue: raw.overdue || [], dueToday: raw.dueToday || [], dueTomorrow: raw.dueTomorrow || [], withJobWorkers: raw.withJobWorkers || [] };

  if (board.loading && !raw) return <PageSpinner label="Loading the board" />;
  if (board.error) return <ErrorNote error={board.error} onRetry={board.reload} />;
  if (!d) return null;

  const start = async (card) => {
    setFailure(null);
    try {
      await processOrders.startStep(card.orderId, card.stepId);
      notify(`${card.stepName} started on ${card.processNo}.`);
      board.reload();
    } catch (err) {
      setFailure(err);
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

      {failure && <ErrorNote error={new Error(processErrorText(failure))} />}

      {chosen && (
        <Panel title={`${TILES.find((t) => t.list === list).label} (${chosen.length})`} actions={<Button size="sm" variant="outline" onClick={() => setList(null)}>Close</Button>}>
          {chosen.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here.</p> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{chosen.map((c) => <OrderCard key={`${c.orderId}-${c.stepId}`} card={c} onOpen={onOpen} />)}</div>
          )}
        </Panel>
      )}

      {d.mine.length > 0 && (
        <Panel title="My work" description="Steps given to you. Start one when you begin, and mark it done with how many came out.">
          <ul className="divide-y rounded-lg border">
            {d.mine.map((c) => (
              <li key={`${c.orderId}-${c.stepId}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{c.stepName}</span> · {c.itemName} <span className="text-muted-foreground">({c.processNo}, {qty(c.plannedQty)})</span>
                  {DUE_LABEL[c.dueState] && <span className="ms-2"><Pill tone={DUE_TONE[c.dueState]}>{DUE_LABEL[c.dueState]}</Pill></span>}
                </span>
                <span className="flex flex-wrap gap-2">
                  {c.status === "READY" && <Button size="sm" variant="outline" onClick={() => start(c)}>Start</Button>}
                  <Button size="sm" onClick={() => setCompleting(c)}>Done</Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Where every order is" description="One column per step. An order sits in the column of the step it is at; red is late.">
        {d.columns.length === 0 ? (
          <EmptyState title="Nothing in process" text="Start a process order (Process orders > New process order) and release it: it appears here at its first step." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {d.columns.map((col) => (
              <section key={col.name} aria-label={col.name} className="min-w-0 rounded-xl bg-muted/40 p-3">
                <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
                  <span>{col.name}</span>
                  <span className="rounded-full bg-card px-2 text-xs tabular-nums text-muted-foreground">{col.cards.length}</span>
                </h3>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{col.cards.map((c) => <OrderCard key={`${c.orderId}-${c.stepId}`} card={c} onOpen={onOpen} />)}</div>
              </section>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="With job workers" description="Parts out on challans, how long they have been out, and their value. In India they must come back within a year.">
        {d.withJobWorkers.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is out with a job worker.</p> : (
          <ul className="divide-y rounded-lg border">
            {d.withJobWorkers.map((j) => (
              <li key={String(j.jobWorkId)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <Truck className="me-1 inline h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{j.worker}</span>{" "}
                  <span className="text-muted-foreground">· {j.jobWorkNo}{j.processNo ? ` (${j.processNo})` : ""} · {j.items.map((i) => `${qty(i.out)} ${i.name}`).join(", ")}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="tabular-nums">{j.daysOut} day{j.daysOut === 1 ? "" : "s"} out</span>
                  <span className="tabular-nums text-muted-foreground">{orgCurrency()} {formatNumber(j.value, 2)}</span>
                  {j.overdue && <Pill tone="danger">Past return-by</Pill>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {completing && (
        <CompleteStepDialog
          orderId={completing.orderId}
          step={{ _id: completing.stepId, name: completing.stepName, plannedQty: completing.plannedQty }}
          onClose={() => setCompleting(null)}
          onDone={(m) => { setCompleting(null); notify(m); board.reload(); }}
        />
      )}
      {open && (
        <ProcessOrderView
          id={open}
          onClose={() => { setOpen(null); board.reload(); }}
          onEdit={() => setOpen(null)}
          onChanged={(m) => { notify(m); board.reload(); }}
          onRemoved={(m) => { setOpen(null); notify(m); board.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
