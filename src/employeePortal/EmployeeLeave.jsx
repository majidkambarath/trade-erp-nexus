import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { employeeApi, employeeError } from "./employeeApi";

const STATUS_TONE = {
  PENDING: "border-status-warning/25 bg-status-warning-soft text-status-warning",
  APPROVED: "border-status-success/25 bg-status-success-soft text-status-success",
  REJECTED: "border-status-danger/25 bg-status-danger-soft text-status-danger",
  CANCELLED: "border-border bg-secondary text-muted-foreground",
};

function RequestForm({ leaveTypes, onClose, onSaved }) {
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?._id || "");
  const [fromDay, setFromDay] = useState(new Date().toISOString().slice(0, 10));
  const [toDay, setToDay] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await employeeApi.submitLeaveRequest({ leaveTypeId, fromDay, toDay, reason });
      onSaved();
    } catch (err) {
      setError(employeeError(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-xl bg-background p-4 sm:max-w-sm sm:rounded-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Request leave</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></button>
        </div>
        {error && <p role="alert" className="mb-3 rounded-lg border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Leave type</span>
          <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base">
            {leaveTypes.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </label>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">First day</span>
            <input type="date" value={fromDay} onChange={(e) => setFromDay(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">Last day</span>
            <input type="date" value={toDay} onChange={(e) => setToDay(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base" />
          </label>
        </div>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium text-foreground">Reason (optional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base" />
        </label>
        <Button className="w-full" disabled={busy || !leaveTypeId} onClick={submit}>{busy ? "Submitting…" : "Submit"}</Button>
      </div>
    </div>
  );
}

export default function EmployeeLeave() {
  const [requests, setRequests] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  async function reload() {
    try {
      const [r, t] = await Promise.all([employeeApi.leaveRequests(), employeeApi.leaveTypes()]);
      setRequests(r);
      setLeaveTypes(t);
    } catch (err) {
      setError(employeeError(err));
    }
  }

  useEffect(() => { reload(); }, []);

  async function cancel(id) {
    try {
      await employeeApi.cancelLeaveRequest(id);
      reload();
    } catch (err) {
      setError(employeeError(err));
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Leave</h1>
        <Button size="sm" onClick={() => setAdding(true)} disabled={!leaveTypes.length}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> New
        </Button>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
      {requests === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <div className="grid gap-2">
          {requests.map((r) => (
            <div key={r._id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{r.leaveTypeName}</p>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[r.status] || ""}`}>{r.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.fromDay} to {r.toDay}{r.reason ? ` · ${r.reason}` : ""}</p>
              {r.status === "PENDING" && (
                <button type="button" onClick={() => cancel(r._id)} className="mt-2 text-xs font-medium text-muted-foreground underline">Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
      {adding && (
        <RequestForm
          leaveTypes={leaveTypes}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); reload(); }}
        />
      )}
    </div>
  );
}
