// HRMS > Attendance (/hr/attendance): the muster for one day. Every employee for the selected day, with
// their status as a chip - "pick a day, get people with status chips" (the plan's own decision for the
// muster, the CRM calendar's reading rather than a 31xN matrix that cannot read on a phone). Marking a day
// is hr.attendance, separate from hr.manage: a muster clerk need not redesign shifts.
import React, { useMemo, useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { Button } from "../ui/button";
import { DateInput, ErrorNote, Field, Modal, Pill, Select, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import Can from "../shell/Can.jsx";
import { employees as employeesApi, attendance } from "../../lib/hrApi";
import { today } from "../../utils/orgLocale";

const STATUS_TONE = { present: "success", half_day: "warning", absent: "danger", on_leave: "info", holiday: "neutral", weekly_off: "neutral" };
const STATUS_LABEL = { present: "Present", half_day: "Half day", absent: "Absent", on_leave: "On leave", holiday: "Holiday", weekly_off: "Weekly off" };

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

export default function AttendancePage() {
  const { notify, toastNode } = useToasts();
  const [day, setDay] = useState(() => today());
  const staffList = useAsync(() => employeesApi.list({ status: "Active", limit: 500 }), []);
  const muster = useAsync(() => attendance.forDay(day), [day]);
  const [marking, setMarking] = useState(null); // the employee being marked, or null

  const byStaff = useMemo(() => {
    const map = new Map();
    for (const row of muster.data || []) map.set(String(row.staffId), row);
    return map;
  }, [muster.data]);

  const rows = (staffList.data || []).map((s) => ({ staff: s, row: byStaff.get(String(s._id)) || null }));

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">The muster for one day, stamped at write time - a half-day cutoff changed next month never rewrites this day.</p>
        </div>
        <div className="w-44">
          <DateInput value={day} onChange={(e) => setDay(e?.target ? e.target.value : e)} />
        </div>
      </div>

      {(staffList.loading || muster.loading) && <Spinner label="Reading the muster" />}
      {staffList.error && <ErrorNote error={staffList.error} onRetry={staffList.reload} />}
      {muster.error && <ErrorNote error={muster.error} onRetry={muster.reload} />}

      {!staffList.loading && !muster.loading && !staffList.error && !muster.error && (
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
                  <Button variant="outline" size="sm" onClick={() => setMarking(staff)}>
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
      )}

      {marking && (
        <MarkDialog
          staff={marking}
          day={day}
          row={byStaff.get(String(marking._id))}
          onClose={() => setMarking(null)}
          onSaved={(_, message) => { setMarking(null); notify(message); muster.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
