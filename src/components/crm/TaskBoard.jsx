// The follow-ups as a board you can move things on: by WHEN (drag a card to another day) or by WHO (drag it to
// somebody else). The same rows as the list beside it - this is a second way to read and change them, not a second
// set of data - and every change is the ordinary follow-up edit (PUT /crm/activities/:id), so there is no special
// endpoint and a person without crm.edit simply gets a board that cannot be dragged.
//
// Three things worth knowing before changing it:
//  - A card is dragged by its HANDLE, not by the whole card. The card holds buttons and a select, and a finger that
//    lands on a card must still be able to scroll the page; only the handle claims the gesture.
//  - Dragging is never the only way. Every card carries a "Move to" select, because a drag is clumsy on a phone and
//    impossible without a pointer, and the board has to work for both.
//  - A drop sets ONE named day, printed in the column's header ("Within a week - Tue 27 Oct"), and that day falls back
//    inside the column it was dropped on (a test pins it). Late takes no drops: nobody reschedules INTO being late.
import React, { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, rectIntersection,
  useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { formatDate } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { PillTabs } from "../salesDocs/parts.jsx";
import { DuePill, KindIcon } from "./crmShared.jsx";

const MODES = [
  ["when", "By day"],
  ["who", "By person"],
];

// The pointer decides first; where it is over nothing (a drag that ends in a gutter) the rectangles are consulted.
const collide = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

// What a card LOOKS like, with no dnd-kit in it. The lifted copy that follows the pointer (DragOverlay) is drawn from
// this alone: an overlay that called useDraggable with the same id as the card it copies would register a second
// draggable under one id and overwrite the original's measured node, which dnd-kit's own docs warn against.
function CardFace({ row, handle, footer }) {
  return (
    <>
      <div className="flex items-start gap-1.5">
        {handle}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <KindIcon kind={row.kind} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{row.subject}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatDate(row.dueAt)}</span>
            <DuePill state={row.dueState} />
            {row.ownerName ? <span className="truncate">· {row.ownerName}</span> : null}
          </p>
        </div>
      </div>
      {footer}
    </>
  );
}

function Card({ row, canEdit, destinations, current, onMove, onDone }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row._id, disabled: !canEdit });
  return (
    <li ref={setNodeRef} className={`rounded-xl border border-border bg-card p-2.5 shadow-card ${isDragging ? "opacity-40" : ""}`}>
      <CardFace
        row={row}
        handle={
          canEdit ? (
            <button
              type="button"
              aria-label={`Drag ${row.subject}`}
              className="-ms-1 grid h-11 w-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground hover:bg-accent active:cursor-grabbing lg:h-8 lg:w-7"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null
        }
        footer={
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canEdit && destinations.length > 0 && (
              <label className="min-w-0 flex-1">
                <span className="sr-only">Move {row.subject} to</span>
                <select
                  value={current}
                  onChange={(e) => e.target.value !== current && onMove(row, e.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground lg:h-9"
                >
                  {destinations.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canEdit && (
              <button type="button" onClick={() => onDone(row)} className="h-11 rounded-lg border border-input px-3 text-xs font-medium hover:bg-accent lg:h-9">
                Done
              </button>
            )}
          </div>
        }
      />
    </li>
  );
}

function Column({ column, rows, canEdit, destinations, onMove, onDone }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key, disabled: !column.droppable });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.label}
      className={`flex min-h-40 min-w-0 flex-col rounded-2xl border bg-secondary/40 p-2.5 transition-colors ${
        isOver && column.droppable ? "border-brand bg-brand-soft/40" : "border-border"
      }`}
    >
      <header className="mb-2 px-1">
        <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
          <span className="truncate">{column.label}</span>
          <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{rows.length}</span>
        </h3>
        <p className="mt-0.5 min-h-4 text-xs text-muted-foreground">{column.hint}</p>
      </header>
      <ul className="flex flex-1 flex-col gap-2">
        {rows.map((row) => (
          <Card key={row._id} row={row} canEdit={canEdit} destinations={destinations} current={column.key} onMove={onMove} onDone={onDone} />
        ))}
        {rows.length === 0 && (
          <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
            {column.droppable ? "Drop one here" : "Nothing here"}
          </li>
        )}
      </ul>
    </section>
  );
}

export default function TaskBoard({ rows = [], today, owners = [], canEdit = false, notify, onChanged, onDone }) {
  const [mode, setMode] = useState("when");
  // What has just been dragged, applied at once so the card does not snap back while the server answers. It is
  // dropped again when the list is re-read, or put back at once if the server refuses.
  const [pending, setPending] = useState({});
  const [lifted, setLifted] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // A touch must be HELD before it becomes a drag, or a finger swiping to scroll would pick a card up.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const shown = useMemo(() => rows.map((r) => (pending[r._id] ? { ...r, ...pending[r._id] } : r)), [rows, pending]);

  const columns = useMemo(() => {
    if (mode === "when") {
      const grouped = rules.groupTasks(shown, today);
      return rules.TASK_BUCKETS.map((b) => {
        const target = rules.bucketTarget(b.key, today);
        return {
          key: b.key,
          label: b.label,
          droppable: target !== null,
          hint: target ? `Dropped here: ${formatDate(target)}` : "Move these on",
          rows: grouped[b.key],
          patch: target ? { dueAt: target } : null,
        };
      });
    }
    const grouped = rules.groupByPerson(shown, owners);
    return [
      ...owners.map((o) => ({ key: o.id, label: o.name, droppable: true, hint: "Dropped here: given to them", rows: grouped[o.id], patch: { ownerId: o.id } })),
      // The server cannot un-assign, so "nobody" is somewhere a card can be READ but not dropped.
      { key: "__nobody__", label: "Nobody", droppable: false, hint: "Not given to anyone", rows: grouped.__nobody__, patch: null },
    ];
  }, [mode, shown, owners, today]);

  const destinations = columns.filter((c) => c.droppable).map((c) => ({ key: c.key, label: c.label }));
  const bucketOf = (row) => (mode === "when" ? rules.taskBucket(row, today) : row.ownerId && owners.some((o) => o.id === row.ownerId) ? row.ownerId : "__nobody__");

  const move = async (row, toKey) => {
    const column = columns.find((c) => c.key === toKey);
    if (!column?.patch || bucketOf(row) === toKey) return;
    const patch = column.patch;
    setPending((p) => ({ ...p, [row._id]: { ...patch, ...(patch.ownerId ? { ownerName: column.label } : {}) } }));
    try {
      await crm.updateActivity(row._id, patch);
      notify?.(mode === "when" ? `${row.subject} is now due ${formatDate(patch.dueAt)}` : `${row.subject} is now ${column.label}'s`);
      await onChanged?.();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      // Whether it worked (the list has just been re-read) or not (the card goes back), the overlay has done its job.
      setPending((p) => {
        const next = { ...p };
        delete next[row._id];
        return next;
      });
    }
  };

  const onDragEnd = ({ active, over }) => {
    setLifted(null);
    const row = shown.find((r) => r._id === active.id);
    if (row && over) move(row, String(over.id));
  };

  const liftedRow = lifted ? shown.find((r) => r._id === lifted) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs tabs={MODES} value={mode} onChange={setMode} label="How to arrange the board" />
        <p className="text-xs text-muted-foreground">
          {canEdit ? "Drag a card by its handle, or use the Move to menu on it." : "You can read the board; changing it needs permission to edit."}
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collide}
        onDragStart={({ active }) => setLifted(active.id)}
        onDragCancel={() => setLifted(null)}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable: "To pick up a follow-up, press space. Move with the arrow keys to another column, then press space again to drop it, or escape to cancel.",
          },
        }}
      >
        <div className={`mt-4 grid gap-3 ${mode === "when" ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
          {columns.map((c) => (
            <Column key={c.key} column={c} rows={c.rows} canEdit={canEdit} destinations={destinations} onMove={move} onDone={onDone} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {liftedRow ? (
            <ul>
              <li className="rounded-xl border border-border bg-card p-2.5 shadow-elevated">
                <CardFace row={liftedRow} />
              </li>
            </ul>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
