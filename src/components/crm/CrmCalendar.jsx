// The calendar: follow-ups, deals closing and enquiries arriving, on the days they fall on.
//
// What the market does, and what this follows: the MONTH is for orientation, the DAY is for detail (tap a day and its
// agenda opens beside or below the grid), and the noisiest layer - enquiries - starts switched off so the month reads
// clean. A follow-up that is still open can be dragged to another day, which is the ordinary follow-up edit; a
// finished one is history and a deal's close date is changed on the deal, where the reason can be recorded - so
// neither of those can be picked up.
//
// Dragging is never the only way: every open follow-up in the day's agenda carries its own date field, and on a phone
// (where the grid shows dots rather than chips, because seven columns cannot hold a sentence) that is the way.
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Handshake, Target } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, EmptyState, DateInput, useAsync, useToasts } from "../accounting/kit.jsx";
import Can from "../shell/Can.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";
import { pageSession } from "../../lib/pageSession";
import { formatCurrencyAED, formatDate, todayInput } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { DuePill, KindIcon } from "./crmShared.jsx";

const session = pageSession("crm-calendar");
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const FULL_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const monthTitle = (key) => MONTH.format(new Date(`${key}-01T00:00:00Z`));
const dayTitle = (day) => FULL_DAY.format(new Date(`${day}T00:00:00Z`));

// Each layer has a colour AND an icon, so the type of an entry is never carried by colour alone.
const LOOK = {
  activity: { tint: "bg-accent-teal-soft text-accent-teal", dot: "bg-accent-teal" },
  deal: { tint: "bg-accent-plum-soft text-accent-plum", dot: "bg-accent-plum" },
  lead: { tint: "bg-accent-olive-soft text-accent-olive", dot: "bg-accent-olive" },
};
const OVERDUE = "bg-status-danger-soft text-status-danger";
const DONE = "bg-secondary text-muted-foreground line-through";

const tintOf = (item) => (item.status === "DONE" ? DONE : item.overdue ? OVERDUE : LOOK[item.type].tint);
const dotOf = (item) => (item.overdue ? "bg-status-danger" : LOOK[item.type].dot);

function Icon({ item }) {
  if (item.type === "deal") return <Handshake className="h-3 w-3 shrink-0" aria-hidden="true" />;
  if (item.type === "lead") return <Target className="h-3 w-3 shrink-0" aria-hidden="true" />;
  return <KindIcon kind={item.kind} className="h-3 w-3 shrink-0" />;
}

const hrefOf = (item) =>
  item.type === "deal" ? `/crm/pipeline?deal=${item.id}` : item.type === "lead" ? `/crm/leads?lead=${item.id}` : item.regarding?.kind === "opportunity" ? `/crm/pipeline?deal=${item.regarding.id}` : item.regarding?.kind === "lead" ? `/crm/leads?lead=${item.regarding.id}` : item.regarding?.kind === "contact" ? `/crm/contacts?contact=${item.regarding.id}` : "/crm/follow-ups";

const collide = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

/** One entry on the grid. An open follow-up is draggable; everything else is a plain, clickable chip. */
function Chip({ item, canMove, onPick }) {
  const draggable = canMove && item.movable;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, disabled: !draggable, data: { item } });
  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={() => onPick(item.day)}
      title={item.title}
      className={`flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-start text-[11px] font-medium leading-4 ${tintOf(item)} ${draggable ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${isDragging ? "opacity-30" : ""}`}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <Icon item={item} />
      <span className="truncate">{item.title}</span>
    </button>
  );
}

function Day({ cell, items, today, selected, canMove, onPick }) {
  const past = cell.day < today;
  // A day before today takes no drops: nobody reschedules a follow-up INTO being late.
  const { setNodeRef, isOver } = useDroppable({ id: cell.day, disabled: !canMove || past });
  const shown = items.slice(0, 3);
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-16 min-w-0 flex-col gap-1 border-b border-e border-border p-1 sm:min-h-28 sm:p-1.5 ${cell.inMonth ? "bg-card" : "bg-secondary/40"} ${isOver && !past && canMove ? "bg-brand-soft/60" : ""}`}
    >
      {/* The tap target is the whole top of the cell (44px on touch); the number inside it stays small, so today's
          highlight is a circle and not a wide pill. */}
      <button
        type="button"
        onClick={() => onPick(cell.day)}
        aria-label={`${dayTitle(cell.day)}${items.length ? `, ${items.length} item${items.length === 1 ? "" : "s"}` : ""}`}
        aria-current={cell.day === today ? "date" : undefined}
        className="grid h-11 w-full place-items-center rounded-lg hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8 lg:w-8 lg:place-items-start lg:justify-items-start lg:rounded-full lg:hover:bg-transparent"
      >
        <span
          className={`grid h-7 w-7 place-items-center rounded-full text-xs font-medium tabular-nums ${
            cell.day === today ? "bg-brand text-primary-foreground" : selected ? "bg-accent text-foreground ring-2 ring-ring" : cell.inMonth ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {Number(cell.day.slice(8))}
        </span>
      </button>
      {/* Chips where there is room to read them; dots where there is not - seven columns on a phone hold a number, not a sentence. */}
      <div className="hidden min-w-0 flex-col gap-0.5 md:flex">
        {shown.map((item) => (
          <Chip key={`${item.type}:${item.id}`} item={item} canMove={canMove} onPick={onPick} />
        ))}
        {items.length > shown.length && (
          <button type="button" onClick={() => onPick(cell.day)} className="px-1 text-start text-[11px] text-muted-foreground hover:underline">
            +{items.length - shown.length} more
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-0.5 md:hidden" aria-hidden="true">
        {items.slice(0, 4).map((item) => (
          <span key={`${item.type}:${item.id}`} className={`h-1.5 w-1.5 rounded-full ${dotOf(item)}`} />
        ))}
      </div>
    </div>
  );
}

/** One day's detail: everything on it, each open follow-up with its own date field so it can be moved without a drag. */
function Agenda({ day, items, canMove, today, onReschedule }) {
  return (
    <Panel title={dayTitle(day)} description={items.length ? `${items.length} on this day.` : "Nothing on this day."} bodyClassName="p-0">
      {items.length === 0 ? (
        <div className="grid min-h-32 place-items-center px-4 py-8">
          <EmptyState title="A clear day" text="Follow-ups, deals due to close and enquiries that arrive on it are listed here." />
        </div>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${item.type}:${item.id}`} className="border-b border-border/60 px-4 py-3 last:border-0">
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tintOf(item)}`}>
                  <Icon item={item} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={hrefOf(item)} className={`block break-words text-sm font-medium hover:underline ${item.status === "DONE" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {item.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{item.type === "deal" ? "Expected to close" : item.type === "lead" ? "Enquiry came in" : item.sub}</span>
                    {item.type === "deal" && item.value ? <span>· {formatCurrencyAED(item.value)}</span> : null}
                    {item.sub && item.type !== "activity" ? <span>· {item.sub}</span> : null}
                    {item.ownerName ? <span>· {item.ownerName}</span> : null}
                    {item.type === "activity" && item.status === "OPEN" ? <DuePill state={item.overdue ? "overdue" : item.day === today ? "today" : "soon"} /> : null}
                    {item.status === "DONE" ? <span>· Done</span> : null}
                  </p>
                  {canMove && item.movable && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">Move to</span>
                      <span className="w-40">
                        <DateInput value={item.day} min={today} onChange={(e) => onReschedule(item, e?.target ? e.target.value : e)} aria-label={`New day for ${item.title}`} />
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function CrmCalendar() {
  const { can } = useOrganisation();
  const { notify, toastNode } = useToasts();
  const todayDay = todayInput(); // the organisation's own day, used until the server confirms it with the data
  const [month, setMonth] = useState(() => session.get("month", rules.monthKeyOf(todayDay)));
  const [picked, setPicked] = useState(() => session.get("day", todayDay));
  const [layers, setLayers] = useState(() => session.get("layers", Object.fromEntries(rules.CALENDAR_LAYERS.map((l) => [l.key, l.on]))));
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState({});
  const [lifted, setLifted] = useState(null);
  const canMove = can("crm.edit");

  const range = useMemo(() => rules.monthRange(month), [month]);
  const { data, loading, error, reload: retry } = useAsync(() => crm.calendar(range), [range.from, range.to, reload]);
  const today = data?.today || todayDay;

  const items = useMemo(
    () => (data?.items || []).map((i) => (pending[i.id] ? { ...i, ...pending[i.id] } : i)).filter((i) => layers[i.type]),
    [data, pending, layers]
  );
  const byDay = useMemo(() => rules.itemsByDay(items), [items]);
  const weeks = useMemo(() => rules.monthWeeks(month), [month]);

  const keep = (setter, key) => (value) => {
    session.set(key, value);
    setter(value);
  };

  const reschedule = async (item, day) => {
    if (!day || day === item.day) return;
    if (day < today) {
      notify("A follow-up cannot be moved into the past.", "error");
      return;
    }
    // Moved at once, so the chip does not snap back while the server answers; put back if it refuses.
    setPending((p) => ({ ...p, [item.id]: { day, overdue: false } }));
    try {
      await crm.updateActivity(item.id, { dueAt: day });
      notify(`${item.title} is now due ${formatDate(day)}`);
      setReload((n) => n + 1);
    } catch (problem) {
      notify(problem.message, "error");
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[item.id];
        return next;
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })
  );
  const liftedItem = lifted ? items.find((i) => i.id === lifted) : null;
  const onDragEnd = ({ active, over }) => {
    setLifted(null);
    const item = items.find((i) => i.id === active.id);
    if (item && over) reschedule(item, String(over.id));
  };
  const inView = picked >= range.from && picked <= range.to;
  const step = "grid h-11 w-11 place-items-center rounded-lg border border-input hover:bg-accent lg:h-10 lg:w-10";

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Calendar"
        description="Follow-ups, deals due to close and enquiries, on the days they fall on."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { keep(setMonth, "month")(rules.monthKeyOf(today)); keep(setPicked, "day")(today); }} className="h-11 rounded-lg border border-input px-3 text-sm hover:bg-accent lg:h-10">
              Today
            </button>
            <button type="button" aria-label="Previous month" onClick={() => keep(setMonth, "month")(rules.shiftMonth(month, -1))} className={step}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next month" onClick={() => keep(setMonth, "month")(rules.shiftMonth(month, 1))} className={step}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground" aria-live="polite">
          {monthTitle(month)}
        </h2>
        {/* The layers double as the legend: each carries its colour AND says what it is. */}
        <div role="group" aria-label="What to show" className="flex flex-wrap items-center gap-2">
          {rules.CALENDAR_LAYERS.map((layer) => (
            <button
              key={layer.key}
              type="button"
              aria-pressed={Boolean(layers[layer.key])}
              onClick={() => keep(setLayers, "layers")({ ...layers, [layer.key]: !layers[layer.key] })}
              className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium lg:h-9 ${
                layers[layer.key] ? `border-transparent ${LOOK[layer.key].tint}` : "border-input text-muted-foreground hover:bg-accent"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${LOOK[layer.key].dot} ${layers[layer.key] ? "" : "opacity-40"}`} aria-hidden="true" />
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNote error={error} onRetry={retry} />
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <DndContext sensors={sensors} collisionDetection={collide} onDragStart={({ active }) => setLifted(active.id)} onDragCancel={() => setLifted(null)} onDragEnd={onDragEnd}>
            <div role="grid" aria-label={monthTitle(month)} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div role="row" className="grid grid-cols-7 border-b border-border bg-secondary/60">
                {rules.WEEKDAYS(1).map((name) => (
                  <div key={name} role="columnheader" className="px-1 py-2 text-center text-xs font-semibold text-muted-foreground">
                    {name}
                  </div>
                ))}
              </div>
              {loading && !data && <Spinner label="Reading the month" />}
              {weeks.map((week) => (
                <div key={week[0].day} role="row" className="grid grid-cols-7 [&>div:last-child]:border-e-0">
                  {week.map((cell) => (
                    <Day key={cell.day} cell={cell} items={byDay[cell.day] || []} today={today} selected={cell.day === picked} canMove={canMove} onPick={keep(setPicked, "day")} />
                  ))}
                </div>
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {liftedItem ? (
                <div className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium shadow-elevated ${tintOf(liftedItem)}`}>
                  <Icon item={liftedItem} />
                  <span className="truncate">{liftedItem.title}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          <p className="mt-2 text-xs text-muted-foreground">
            {canMove ? "Drag an open follow-up to another day to reschedule it, or open the day and use its date field." : "You can read the calendar; moving things needs permission to edit."}
          </p>
        </div>

        <div className="min-w-0">
          {inView ? (
            <Agenda day={picked} items={byDay[picked] || []} canMove={canMove} today={today} onReschedule={reschedule} />
          ) : (
            <Panel title="Pick a day">
              <p className="text-sm text-muted-foreground">Choose a day in this month to see what is on it.</p>
            </Panel>
          )}
          <Can permission="crm.create">
            <p className="mt-2 text-xs text-muted-foreground">To add a follow-up, open a deal, an enquiry or a person and log it there.</p>
          </Can>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
