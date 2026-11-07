import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { employeeApi, employeeError } from "./employeeApi";

const STATUS_LABEL = { present: "Present", half_day: "Half day", absent: "Absent", on_leave: "On leave", holiday: "Holiday", weekly_off: "Weekly off" };

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

export default function EmployeeHome() {
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function reload() {
    setLoading(true);
    try {
      setToday(await employeeApi.todayAttendance());
    } catch (err) {
      setError(employeeError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function punch() {
    setBusy(true);
    setError(null);
    try {
      const day = new Date().toISOString().slice(0, 10);
      const checkedIn = today?.checkIn && !today?.checkOut;
      const body = checkedIn
        ? { checkIn: today.checkIn, checkOut: `${day}T${nowTime()}:00` }
        : { checkIn: `${day}T${nowTime()}:00` };
      await employeeApi.punch(body);
      await reload();
    } catch (err) {
      setError(employeeError(err));
    } finally {
      setBusy(false);
    }
  }

  const checkedIn = Boolean(today?.checkIn && !today?.checkOut);
  const done = Boolean(today?.checkIn && today?.checkOut);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold text-foreground">Today</h1>
      {error && <p role="alert" className="mb-4 rounded-lg border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-xl border border-border p-5 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          {today ? (
            <>
              <p className="text-sm text-muted-foreground">{STATUS_LABEL[today.status] || today.status}</p>
              {today.checkIn && <p className="mt-1 text-xs text-muted-foreground">In {today.checkIn.slice(11, 16)}{today.checkOut ? ` · Out ${today.checkOut.slice(11, 16)}` : ""}</p>}
              {today.hoursWorked != null && <p className="mt-1 text-sm font-medium text-foreground">{today.hoursWorked}h worked</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not marked yet today.</p>
          )}
          <Button className="mt-4 w-full" disabled={busy || done} onClick={punch}>
            {busy ? "Saving…" : done ? "Done for today" : checkedIn ? "Check out" : "Check in"}
          </Button>
        </div>
      )}
    </div>
  );
}
