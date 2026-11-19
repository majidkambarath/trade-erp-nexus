import React from "react";
import { CalendarClock } from "lucide-react";
import { DateInput, Field } from "../accounting/kit";
import { FREQUENCY_LABELS, previewDates } from "../../lib/recurring";
import { formatDate } from "../../utils/format";
import { cn } from "../../lib/utils";

const box = (bad) =>
  cn(
    "h-11 w-full rounded-lg border bg-background px-3 text-base sm:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10",
    bad ? "border-status-danger" : "border-input"
  );

// The schedule of a recurring invoice, drawn inside the shared order form's Details card (OrderForm `extraSection`).
// Each invoice is made as a DRAFT on its day, dated that day; nobody is billed until somebody approves it.
export default function ScheduleFields({ formData, setHeader, errors = {}, fid }) {
  const next = previewDates(formData, 3);
  const noun = { weekly: "weeks", monthly: "months", quarterly: "quarters", yearly: "years" }[formData.frequency || "monthly"];
  return (
    <fieldset className="sm:col-span-2 xl:col-span-3 grid gap-x-4 gap-y-3 rounded-lg border border-border p-3 sm:grid-cols-2 xl:grid-cols-3">
      <legend className="px-1 text-sm font-medium">Schedule</legend>
      <Field label="How often" error={errors.frequency}>
        <select id={fid("frequency")} name="frequency" value={formData.frequency || "monthly"} onChange={(e) => setHeader("frequency", e.target.value)} className={box(errors.frequency)}>
          {Object.entries(FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label={`Every how many ${noun}`} error={errors.interval}>
        <input id={fid("interval")} name="interval" type="number" min="1" max="12" step="1" inputMode="numeric" value={formData.interval ?? "1"} onChange={(e) => setHeader("interval", e.target.value)} className={box(errors.interval)} />
      </Field>
      <Field label="First invoice on" error={errors.startDay}>
        <DateInput id={fid("startDay")} name="startDay" value={formData.startDay || ""} onChange={(e) => setHeader("startDay", e.target.value)} aria-invalid={Boolean(errors.startDay) || undefined} />
      </Field>
      <Field label="Stop after" hint="Optional: the last date an invoice may be made" error={errors.endDay}>
        <DateInput id={fid("endDay")} name="endDay" value={formData.endDay || ""} onChange={(e) => setHeader("endDay", e.target.value)} aria-invalid={Boolean(errors.endDay) || undefined} />
      </Field>
      <Field label="Or after this many invoices" hint="Optional" error={errors.maxCount}>
        <input id={fid("maxCount")} name="maxCount" type="number" min="1" max="1000" step="1" inputMode="numeric" value={formData.maxCount ?? ""} onChange={(e) => setHeader("maxCount", e.target.value)} className={box(errors.maxCount)} />
      </Field>
      <p className="flex items-start gap-2 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3" data-testid="schedule-preview">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {next.length
            ? `Next invoices: ${next.map((d) => formatDate(d)).join(", ")}. Each is made as a draft on its day for you to review and approve; a date already past is made at once.`
            : "Choose when the first invoice is due to see the dates."}
        </span>
      </p>
    </fieldset>
  );
}
