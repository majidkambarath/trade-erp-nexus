// HRMS > Attendance (/hr/attendance): the muster. The plan's own decision - a 31xN matrix stays a table
// with table-pin-first above md; below it, a 31-column table cannot read on a phone, so it becomes "pick a
// day, get people with status chips" instead (the CRM calendar's own reading). One or the other, chosen by
// a live matchMedia match, never both - the same switch DataTable itself makes. Marking a day is
// hr.attendance, separate from hr.manage: a muster clerk need not redesign shifts.
import React, { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { DateInput, ErrorNote, Field, Modal, Pill, Select, Spinner, TableScroll, TextInput, useAsync, useToasts } from "../accounting/kit";
import { WIDE, useMediaQuery } from "../accounting/DataTable";
import Can from "../shell/Can.jsx";
import { useOrganisation } from "../shell/OrganisationContext";
import { employees as employeesApi, attendance } from "../../lib/hrApi";
import { today } from "../../utils/orgLocale";
import { daysOfMonth, monthKeyOf, monthLabel, shiftMonth } from "../../lib/hr";

const STATUS_TONE = { present: "success", half_day: "warning", absent: "danger", on_leave: "info", holiday: "neutral", weekly_off: "neutral" };
const STATUS_LABEL = { present: "Present", half_day: "Half day", absent: "Absent", on_leave: "On leave", holiday: "Holiday", weekly_off: "Weekly off" };
// A cell must never carry only colour (the CRM calendar's own rule): a letter goes inside the tone too.
const STATUS_LETTER = { present: "P", half_day: "D", absent: "A", on_leave: "L", holiday: "H", weekly_off: "W" };
// What the matrix asks the server for: a whole month of every employee. It mirrors
// AttendanceService.MAX_MUSTER_ROWS (the server clamps to that, so asking for more would be refused down to
// it anyway) and is what the truncation note below is measured against - at ~645 employees a 31-day month
// fills it, and the screen then says the month is only partly shown rather than drawing the missing days as
// "Not marked", which is what the old flat 2000-row cap did silently from about 65 employees upwards.
const MONTH_ROW_LIMIT = 20000;
const CELL_TONE = {
  present: "bg-status-success-soft text-status-success",
  half_day: "bg-status-warning-soft text-status-warning",
  absent: "bg-status-danger-soft text-status-danger",
  on_leave: "bg-status-info-soft text-status-info",
  holiday: "bg-secondary text-muted-foreground",
  weekly_off: "bg-secondary text-muted-foreground",
};

function MarkDialog({ staff, day, row, onClose, onSaved }) {
  const [status, setStatus] = useState(row?.status && row.status !== "absent" ? row.status : "present");
  const [checkIn, setCheckIn] = useState(row?.checkIn ? row.checkIn.slice(11, 16) : "");
  const [checkOut, setCheckOut] = useState(row?.checkOut ? row.checkOut.slice(11, 16) : "");
  const [notes, setNotes] = useState(row?.notes || "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const body = { staffId: staff._id, day, notes };
      if (status === "present" && checkIn && checkOut) {
        body.checkIn = `${day}T${checkIn}:00`;
        body.checkOut = `${day}T${checkOut}:00`;
      } else {
        body.status = status;
      }
      const saved = await attendance.markDay(body);
      onSaved(saved, `${staff.name}: marked ${STATUS_LABEL[saved.status] || saved.status}.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={`Mark ${staff.name}`}
      description={day}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e?.target ? e.target.value : e)}>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="on_leave">On leave</option>
          </Select>
        </Field>
        {status === "present" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check in" hint="Optional - leave blank for a plain Present mark">
              <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm lg:h-10" />
            </Field>
            <Field label="Check out">
              <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm lg:h-10" />
            </Field>
          </div>
        )}
        <Field label="Notes" hint="Optional">
          <TextInput value={notes} onChange={(e) => setNotes(e?.target ? e.target.value : e)} />
        </Field>
      </div>
    </Modal>
  );
}

/** The month, as a table: employees down the side (pinned), every day of the month across the top. A cell
 * is a plain button carrying both the tone AND a letter (never colour alone), opening the same MarkDialog
 * the day view uses. Read-only for someone without hr.attendance - a cell they cannot act on is still worth
 * seeing. */
function MonthMatrix({ month, onPrevMonth, onNextMonth, staff, byKey, canMark, onCellClick }) {
  const days = useMemo(() => daysOfMonth(month), [month]);
  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-2 sm:justify-start">
        <Button variant="outline" size="icon" onClick={onPrevMonth} aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
        <p className="w-40 text-center text-sm font-medium text-foreground">{monthLabel(month)}</p>
        <Button variant="outline" size="icon" onClick={onNextMonth} aria-label="Next month"><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
      <TableScroll label="Attendance for the month">
        <table className="table-pin-first w-full border-collapse text-sm">
          <caption className="sr-only">Attendance for {monthLabel(month)}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="bg-card px-3 py-2 text-start font-medium text-muted-foreground">Employee</th>
              {days.map((d) => (
                <th key={d} scope="col" className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">{Number(d.slice(8, 10))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s._id} className="border-b border-border">
                <th scope="row" className="whitespace-nowrap bg-card px-3 py-1.5 text-start font-medium text-foreground">{s.name}</th>
                {days.map((d) => {
                  const row = byKey.get(`${s._id}|${d}`);
                  const label = row ? (STATUS_LABEL[row.status] || row.status) : "Not marked";
                  const cls = `grid h-7 w-7 place-items-center rounded text-xs font-semibold ${row ? CELL_TONE[row.status] || "bg-secondary text-muted-foreground" : "bg-transparent text-muted-foreground/50"}`;
                  return (
                    <td key={d} className="p-0.5 text-center">
                      {canMark ? (
                        <button type="button" title={`${s.name}, ${d}: ${label}`} onClick={() => onCellClick(s, d, row)} className={`${cls} mx-auto hover:opacity-80`}>
                          {row ? STATUS_LETTER[row.status] || "?" : "·"}
                        </button>
                      ) : (
                        <span title={`${s.name}, ${d}: ${label}`} className={`${cls} mx-auto`}>{row ? STATUS_LETTER[row.status] || "?" : "·"}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {staff.length === 0 && (
        <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <CalendarClock className="h-6 w-6" aria-hidden="true" />
          No active employees to mark.
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const { notify, toastNode } = useToasts();
  const { canAny } = useOrganisation();
  const canMark = canAny("hr.attendance");
  const wide = useMediaQuery(WIDE);
  const [day, setDay] = useState(() => today());
  const month = monthKeyOf(day);
  const [markingDay, setMarkingDay] = useState(day); // the day a matrix cell was clicked for, separate from the day picker
  const staffList = useAsync(() => employeesApi.list({ status: "Active", limit: 500 }), []);
  const monthDays = useMemo(() => daysOfMonth(month), [month]);
  const muster = useAsync(
    () => (wide
      ? attendance.muster({ from: monthDays[0], to: monthDays[monthDays.length - 1], limit: MONTH_ROW_LIMIT })
      : attendance.forDay(day)),
    [wide, day, month]
  );
  // The read came back full, so there may be days of this month the server did not send. Say so - a matrix
  // that quietly draws a marked day as "Not marked" is worse than one that admits it is incomplete.
  const truncated = wide && (muster.data || []).length >= MONTH_ROW_LIMIT;
  const [marking, setMarking] = useState(null); // the employee being marked, or null

  const byStaff = useMemo(() => {
    const map = new Map();
    if (!wide) for (const row of muster.data || []) map.set(String(row.staffId), row);
    return map;
  }, [muster.data, wide]);

  const byKey = useMemo(() => {
    const map = new Map();
    if (wide) for (const row of muster.data || []) map.set(`${row.staffId}|${row.day}`, row);
    return map;
  }, [muster.data, wide]);

  const rows = (staffList.data || []).map((s) => ({ staff: s, row: byStaff.get(String(s._id)) || null }));

  function openCell(staff, cellDay) {
    setMarkingDay(cellDay);
    setMarking(staff);
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">The muster, stamped at write time - a half-day cutoff changed next month never rewrites a past day.</p>
        </div>
        {!wide && (
          <div className="w-44">
            <DateInput value={day} onChange={(e) => { const v = e?.target ? e.target.value : e; setDay(v); setMarkingDay(v); }} />
          </div>
        )}
      </div>

      {(staffList.loading || muster.loading) && <Spinner label="Reading the muster" />}
      {staffList.error && <ErrorNote error={staffList.error} onRetry={staffList.reload} />}
      {muster.error && <ErrorNote error={muster.error} onRetry={muster.reload} />}

      {!staffList.loading && !muster.loading && !staffList.error && !muster.error && (
        wide ? (
          <>
            {truncated && (
              <p className="mb-3 rounded-lg border border-status-warning/25 bg-status-warning-soft p-3 text-sm text-status-warning">
                This month has more attendance than one read returns, so the earliest days may be missing from
                the grid below. Open a single day on a narrower screen, or ask for a shorter period, to see them.
              </p>
            )}
            <MonthMatrix
              month={month}
              onPrevMonth={() => setDay(`${shiftMonth(month, -1)}-01`)}
              onNextMonth={() => setDay(`${shiftMonth(month, 1)}-01`)}
              staff={staffList.data || []}
              byKey={byKey}
              canMark={canMark}
              onCellClick={openCell}
            />
          </>
        ) : (
          <div className="grid gap-2">
            {rows.map(({ staff, row }) => (
              <div key={staff._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{staff.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {staff.designation}
                    {row?.checkIn && row?.checkOut ? ` · ${row.checkIn.slice(11, 16)}–${row.checkOut.slice(11, 16)}` : ""}
                    {row?.hoursWorked != null ? ` · ${row.hoursWorked}h` : ""}
                    {row?.overtimeHours ? ` (${row.overtimeHours}h overtime)` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row ? (
                    <Pill tone={STATUS_TONE[row.status] || "neutral"}>{STATUS_LABEL[row.status] || row.status}</Pill>
                  ) : (
                    <Pill tone="neutral">Not marked</Pill>
                  )}
                  <Can permission="hr.attendance">
                    <Button variant="outline" size="sm" onClick={() => openCell(staff, day)}>
                      {row ? "Edit" : <><Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Mark</>}
                    </Button>
                  </Can>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <CalendarClock className="h-6 w-6" aria-hidden="true" />
                No active employees to mark.
              </div>
            )}
          </div>
        )
      )}

      {marking && (
        <MarkDialog
          staff={marking}
          day={markingDay}
          row={wide ? byKey.get(`${marking._id}|${markingDay}`) : byStaff.get(String(marking._id))}
          onClose={() => setMarking(null)}
          onSaved={(_, message) => { setMarking(null); notify(message); muster.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
