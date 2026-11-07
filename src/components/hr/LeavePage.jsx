// HRMS > Leave (/hr/leave): leave types' requests. A request is a THIRD KIND in the organisation's own
// Approvals page (D13) - deciding one here is the same server call, offered here too because this is the
// natural place to act on a team's leave without a detour through the general queue.
import React, { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { DateInput, ErrorNote, Field, Modal, Pill, Select, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import { SearchSelect } from "../accounting/kit";
import { PillTabs } from "../salesDocs/parts.jsx";
import Can from "../shell/Can.jsx";
import { employees as employeesApi, leaveTypes as leaveTypesApi, leaveRequests } from "../../lib/hrApi";
import { formatDate } from "../../utils/format";
import { today } from "../../utils/orgLocale";
import { coversDay, monthLabel, monthWeeks, shiftMonth } from "../../lib/hr";

const STATUS_TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function RequestForm({ employeeOptions, typeOptions, onClose, onSaved }) {
  const [form, setForm] = useState({ staffId: "", leaveTypeId: "", fromDay: today(), toDay: today(), reason: "" });
  const setField = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await leaveRequests.submit(form);
      onSaved(saved, `${saved.requestNo} submitted.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="New leave request"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Employee" required>
          <SearchSelect value={form.staffId} onChange={setField("staffId")} options={employeeOptions} placeholder="Choose an employee…" />
        </Field>
        <Field label="Leave type" required>
          <SearchSelect value={form.leaveTypeId} onChange={setField("leaveTypeId")} options={typeOptions} placeholder="Choose a leave type…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First day" required>
            <DateInput value={form.fromDay} onChange={setField("fromDay")} />
          </Field>
          <Field label="Last day" required>
            <DateInput value={form.toDay} onChange={setField("toDay")} />
          </Field>
        </div>
        <Field label="Reason" hint="Optional">
          <TextInput value={form.reason} onChange={setField("reason")} />
        </Field>
      </div>
    </Modal>
  );
}

function RejectDialog({ request, onClose, onDecided }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const row = await leaveRequests.decide(request._id, { action: "reject", reason });
      onDecided(row);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={`Reject ${request.requestNo}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={submit} disabled={busy}>{busy ? "Rejecting…" : "Reject"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Reason" hint="Shown to whoever submitted it">
          <TextInput value={reason} onChange={(e) => setReason(e?.target ? e.target.value : e)} autoFocus />
        </Field>
      </div>
    </Modal>
  );
}

function BalanceChecker({ employeeOptions, typeOptions }) {
  const [staffId, setStaffId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const balance = useAsync(() => (staffId && leaveTypeId ? leaveRequests.balance(staffId, leaveTypeId) : Promise.resolve(null)), [staffId, leaveTypeId]);

  return (
    <div className="rounded-xl border border-border p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Check a balance</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Employee">
          <SearchSelect value={staffId} onChange={setStaffId} options={employeeOptions} placeholder="Choose an employee…" clearable />
        </Field>
        <Field label="Leave type">
          <SearchSelect value={leaveTypeId} onChange={setLeaveTypeId} options={typeOptions} placeholder="Choose a leave type…" clearable />
        </Field>
      </div>
      {balance.loading && <Spinner label="Reading the balance" />}
      {balance.data && (
        <div className="mt-3 grid grid-cols-1 gap-3 text-center text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Accrued</p><p className="text-lg font-semibold text-foreground">{balance.data.accrued}</p></div>
          <div><p className="text-xs text-muted-foreground">Consumed</p><p className="text-lg font-semibold text-foreground">{balance.data.consumed}</p></div>
          <div><p className="text-xs text-muted-foreground">Available</p><p className="text-lg font-semibold text-foreground">{balance.data.available}</p></div>
        </div>
      )}
    </div>
  );
}

/** Who is on leave, by day - a month grid, APPROVED only (a pending request is not yet a fact worth showing
 * the whole team). Reads the newest 500 approved requests (LeaveRequestService.list has no date filter to
 * ask a narrower range of): on an organisation with more approved history than that, an old month at the
 * far edge of it could come back thin - acceptable for this product's scale, not hidden here. */
function LeaveCalendar() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const approved = useAsync(() => leaveRequests.list({ status: "APPROVED" }), []);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const todayDay = today();
  const onLeaveOn = (day) => (approved.data || []).filter((r) => coversDay(r, day));

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-2 sm:justify-start">
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
        <p className="w-40 text-center text-sm font-medium text-foreground">{monthLabel(month)}</p>
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
      {approved.loading && <Spinner label="Reading approved leave" />}
      {approved.error && <ErrorNote error={approved.error} onRetry={approved.reload} />}
      {!approved.loading && !approved.error && (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* A deliberate wide grid (seven columns, one per weekday): minmax(0,1fr) is what lets it shrink to
              fit a phone instead of overflowing, unlike a fixed-width column grid would. */}
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-border bg-secondary/60 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((w) => <div key={w} className="py-1.5">{w}</div>)}
          </div>
          {weeks.map((week) => (
            <div key={week[0].day} className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-border last:border-b-0 [&>div:last-child]:border-e-0">
              {week.map((cell) => {
                const onLeave = onLeaveOn(cell.day);
                const shown = onLeave.slice(0, 3);
                return (
                  <div key={cell.day} className={`min-h-16 border-e border-border p-1 sm:min-h-20 ${cell.inMonth ? "bg-card" : "bg-secondary/40"}`}>
                    <p className={`text-xs ${cell.day === todayDay ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{Number(cell.day.slice(8, 10))}</p>
                    <div className="mt-1 grid gap-0.5">
                      {shown.map((r) => (
                        <p key={r._id} title={`${r.staffName} - ${r.leaveTypeName}`} className="truncate rounded bg-status-info-soft px-1 text-[11px] font-medium text-status-info">
                          {r.staffName}
                        </p>
                      ))}
                      {onLeave.length > shown.length && <p className="text-[11px] text-muted-foreground">+{onLeave.length - shown.length} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeavePage() {
  const { notify, toastNode } = useToasts();
  const staffList = useAsync(() => employeesApi.list({ status: "Active", limit: 500 }), []);
  const types = useAsync(() => leaveTypesApi.list(), []);
  const [status, setStatus] = useState("PENDING");
  const requests = useAsync(() => leaveRequests.list(status ? { status } : undefined), [status]);
  const [adding, setAdding] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [view, setView] = useState("list");

  const employeeOptions = (staffList.data || []).map((s) => ({ value: s._id, label: s.name }));
  const typeOptions = (types.data || []).map((t) => ({ value: t._id, label: t.name }));

  async function decide(id, action, reason) {
    try {
      const row = await leaveRequests.decide(id, { action, reason });
      notify(`${row.requestNo}: ${row.status === "APPROVED" ? "approved" : "rejected"}.`);
      requests.reload();
    } catch (err) {
      notify(err.message || "Could not decide that request.", "error");
    }
  }

  async function cancel(id) {
    try {
      const row = await leaveRequests.cancel(id);
      notify(`${row.requestNo}: cancelled.`);
      requests.reload();
    } catch (err) {
      notify(err.message || "Could not cancel that request.", "error");
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leave</h1>
          <p className="text-sm text-muted-foreground">A request is approved exactly like a document or a voucher - the same approvals policy, the same Approvals page.</p>
        </div>
        <Can permission="hr.leave">
          <Button onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New request</Button>
        </Can>
      </div>

      <div className="mb-4">
        <PillTabs tabs={[["list", "Requests"], ["calendar", "Calendar"]]} value={view} onChange={setView} label="Leave view" />
      </div>

      {view === "calendar" ? (
        <LeaveCalendar />
      ) : (
        <>
          <div className="mb-4 w-48">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>

          {requests.loading && <Spinner label="Reading leave requests" />}
          {requests.error && <ErrorNote error={requests.error} onRetry={requests.reload} />}
          {!requests.loading && !requests.error && (
            <div className="mb-6 grid gap-2">
              {(requests.data || []).map((r) => (
                <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{r.staffName} · {r.leaveTypeName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(r.fromDay)} to {formatDate(r.toDay)}{r.reason ? ` · ${r.reason}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={STATUS_TONE[r.status] || "neutral"}>{r.status}</Pill>
                    {r.status === "PENDING" && (
                      <Can permission="hr.approve">
                        <Button variant="outline" size="sm" onClick={() => decide(r._id, "approve")}><Check className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setRejecting(r)}><X className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                      </Can>
                    )}
                    {r.status === "PENDING" && (
                      <Can permission="hr.leave">
                        <Button variant="ghost" size="sm" onClick={() => cancel(r._id)}>Cancel</Button>
                      </Can>
                    )}
                  </div>
                </div>
              ))}
              {(requests.data || []).length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  <CalendarDays className="h-6 w-6" aria-hidden="true" />
                  No requests here.
                </div>
              )}
            </div>
          )}
        </>
      )}

      <BalanceChecker employeeOptions={employeeOptions} typeOptions={typeOptions} />

      {adding && (
        <RequestForm
          employeeOptions={employeeOptions}
          typeOptions={typeOptions}
          onClose={() => setAdding(false)}
          onSaved={(_, message) => { setAdding(false); notify(message); requests.reload(); }}
        />
      )}
      {rejecting && (
        <RejectDialog
          request={rejecting}
          onClose={() => setRejecting(null)}
          onDecided={(row) => { setRejecting(null); notify(`${row.requestNo}: rejected.`); requests.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
