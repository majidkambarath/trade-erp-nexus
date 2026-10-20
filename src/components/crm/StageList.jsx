// The pipeline's stages as rows you can drag into order. Each is ONE line until you ask for more: the three things you
// change all the time (name, chance, what moves a deal there) are on the row, and the timing (follow-up days, quiet
// days, kind) is one tap away, summarised in words so you rarely need to open it.
//
// The shape is a grid so the columns line up down the page on a wide screen and stack naturally on a phone. The same
// template is used by the heading row, so a column can never drift from its label.
import React from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Trash2 } from "lucide-react";
import { Field, Select, TextInput } from "../accounting/kit.jsx";
import { UnitInput } from "./setupParts.jsx";
import * as rules from "../../lib/crm";

// A row, left to right: grip, colour dot, name, chance, what moves a deal here, timing, remove. The select and the timing
// summary are the two long things, so they get the room: name is the one that can afford to be narrow.
const COLUMNS = "lg:grid-cols-[2rem_0.75rem_minmax(0,0.9fr)_6rem_minmax(0,1.5fr)_minmax(0,1.6fr)_2.75rem]";

// What the "moves here when" select SAYS. rules.ADVANCE_EVENTS reads as full sentences elsewhere ("Happens by itself: the
// customer accepted the quotation"), but inputs are 16px on a phone (a smaller one makes iOS zoom in on focus) and the select gets
// about 175px of text there: the full sentence was cut to "The customer acc", and even 23 characters lost its last word. Same values, same order; an event added later falls back to its full label.
const WHEN = { "": "Nothing - by hand", quotation_sent: "Quotation sent", quotation_accepted: "Quotation accepted", invoice_approved: "Invoice approved" };

// A row can only move up and down: the list is a column, and a drag that wandered sideways would look broken.
const lockToY = ({ transform }) => ({ ...transform, x: 0 });

function Row({ stage, index, total, errors, may, hue, defaultQuietDays, open, onToggle, onChange, onMove, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.uid, disabled: !may });
  const closed = stage.type === "won" || stage.type === "lost";
  const name = stage.name?.trim() || "this stage";
  const err = (key) => errors[`${index}.${key}`];
  const set = (key) => (event) => onChange(index, key, event?.target ? event.target.value : event);

  return (
    <li
      ref={setNodeRef}
      data-reveal
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-xl border bg-card transition-shadow ${isDragging ? "relative z-20 border-brand shadow-elevated" : "border-border"}`}
    >
      <div className={`grid grid-cols-[2.75rem_0.75rem_minmax(0,1fr)_2.75rem] items-start gap-x-2 gap-y-2 p-2.5 ${COLUMNS}`}>
        {may ? (
          <button
            type="button"
            aria-label={`Reorder ${name}`}
            className="grid h-11 w-11 cursor-grab touch-none place-items-center rounded-lg lg:w-8 text-muted-foreground hover:bg-accent active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <span />
        )}
        <span className="grid h-11 place-items-center lg:h-10" aria-hidden="true">
          <span className="h-3 w-3 rounded-full" style={{ background: hue }} />
        </span>
        {/* The name field is found by data-stage-name, not by id: <Field> gives its control an id of its own and would
            overwrite one set here (which is how "go to this stage" once silently did nothing). */}
        <Field label="Name" required error={err("name")} labelClassName="sr-only" className="min-w-0">
          <TextInput data-stage-name={stage.uid} value={stage.name} onChange={set("name")} placeholder="Name this stage" disabled={!may} />
        </Field>
        {may ? (
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={() => onRemove(index)}
            className="grid h-11 w-11 place-items-center rounded-lg text-status-danger hover:bg-status-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:order-last lg:h-10 lg:w-11"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <span />
        )}
        {/* Chance and what moves a deal here share a line on a phone and take a column each on a wide screen. */}
        <div className="col-span-4 grid grid-cols-[5rem_minmax(0,1fr)] gap-2 lg:contents">
          <Field label="Chance" error={err("probability")} labelClassName="text-[11px] lg:sr-only" className="lg:col-start-4 lg:row-start-1">
            <UnitInput unit="%" min="0" max="100" value={stage.probability} onChange={set("probability")} disabled={!may} />
          </Field>
          <Field label="It moves here when" error={err("advanceOn")} labelClassName="text-[11px] lg:sr-only" className="lg:col-start-5 lg:row-start-1">
            <Select value={stage.advanceOn || ""} onChange={set("advanceOn")} disabled={!may}>
              {rules.ADVANCE_EVENTS.map(([value, label]) => (
                <option key={value || "none"} value={value}>
                  {WHEN[value] ?? label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`stage-details-${stage.uid}`}
          onClick={() => onToggle(stage.uid)}
          title={rules.stageSummary(stage, { defaultQuietDays })}
          className="col-span-4 flex h-11 min-w-0 items-center justify-between gap-2 rounded-lg border border-input px-3 text-start text-xs text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-1 lg:col-start-6 lg:row-start-1 lg:h-10"
        >
          <span className="min-w-0 truncate">{rules.stageSummary(stage, { defaultQuietDays })}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {/* The timing. Collapsed it takes no room and cannot be tabbed into (inert); opening it animates the height
          rather than snapping, which is most of why this feels smooth. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open}>
          <div id={`stage-details-${stage.uid}`} className="grid gap-3 border-t border-border/70 p-3 sm:grid-cols-3">
            <Field label="Next follow-up in" hint={closed ? "A closed stage has nothing to chase" : "0 means due the same day"}>
              <UnitInput unit="days" min="0" max="365" value={stage.followUpDays} onChange={set("followUpDays")} disabled={!may || closed} />
            </Field>
            <Field label="Call it quiet after" hint={closed ? "Nothing goes quiet once closed" : defaultQuietDays ? `0 means the usual ${defaultQuietDays} days` : "0 means the usual time"}>
              <UnitInput unit="days" min="0" max="365" value={stage.staleDays} onChange={set("staleDays")} disabled={!may || closed} />
            </Field>
            <Field label="Kind" hint="Won and lost close a deal">
              <Select value={stage.type} onChange={set("type")} disabled={!may}>
                <option value="open">Open - still being worked on</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </Select>
            </Field>
            {may && (
              <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                <button
                  type="button"
                  aria-label={`Move ${name} up`}
                  disabled={index === 0}
                  onClick={() => onMove(index, index - 1)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-40 lg:h-9"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> Move up
                </button>
                <button
                  type="button"
                  aria-label={`Move ${name} down`}
                  disabled={index === total - 1}
                  onClick={() => onMove(index, index + 1)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-40 lg:h-9"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> Move down
                </button>
                <span className="text-xs text-muted-foreground">Or drag the handle on the left.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function StageList({ stages, errors = {}, may, hues, defaultQuietDays, openUids, onToggle, onChange, onReorder, onRemove }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // A touch has to be HELD before it becomes a drag, or a finger swiping to scroll would pick a row up.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const uids = stages.map((s) => s.uid);
  const nameOf = (id) => stages.find((s) => s.uid === id)?.name?.trim() || "this stage";
  const place = (id) => `position ${uids.indexOf(id) + 1} of ${uids.length}`;

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onReorder(uids.indexOf(active.id), uids.indexOf(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[lockToY]}
      onDragEnd={onDragEnd}
      // What a screen reader says while a stage is moved: its NAME and place, not the internal id the library would read.
      accessibility={{
        screenReaderInstructions: {
          draggable: "To move a stage, press space on its handle, use the up and down arrow keys, then press space again to drop it. Escape cancels.",
        },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, ${place(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is over ${nameOf(over.id)}, ${place(over.id)}.` : undefined),
          onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped at ${place(over.id)}.` : `${nameOf(active.id)} was put back.`),
          onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
        },
      }}
    >
      {/* The headings use the rows' own column template, so a column can never drift from its label. Narrow screens stack
          each row and label its fields themselves, so there is no heading row there. */}
      <div aria-hidden="true" className={`hidden items-center gap-x-2 px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid ${COLUMNS}`}>
        <span />
        <span />
        <span>Stage</span>
        <span>Chance</span>
        <span>A deal moves here when</span>
        <span>Timing</span>
        <span />
      </div>
      <SortableContext items={uids} strategy={verticalListSortingStrategy}>
        <ol className="grid gap-2">
          {stages.map((stage, index) => (
            <Row
              key={stage.uid}
              stage={stage}
              index={index}
              total={stages.length}
              errors={errors}
              may={may}
              hue={hues[index]}
              defaultQuietDays={defaultQuietDays}
              open={openUids.has(stage.uid)}
              onToggle={onToggle}
              onChange={onChange}
              onMove={onReorder}
              onRemove={onRemove}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
