// HRMS > Reports (/hr/reports): one route, PillTabs - the same call CRM made for its own seven reports
// (the 88px rail cannot hold the growth, and the mobile sweep opens role="tab" panels by itself).
//
// WHAT CHANGED, AND WHY IT HAD TO. This screen shipped as two compliance tabs with a note promising the
// payroll and attendance reports "in a later wave", and it carried four defects that made it state things
// that were not true:
//
//   1. The gratuity month opened in the UTC month, not the organisation's, so for the first four hours of
//      every month in Dubai it previewed the month just ended. PayrollPage next door already used
//      today() from utils/orgLocale; this did not.
//   2. A FAILED accrual-history read rendered as "No accrual run yet" - a server error reading as a
//      reassurance, on a compliance report. attendanceService.js says it best: a silent wrong answer is
//      the worst failure a muster can have.
//   3. Accrue and Reverse were gated on hr.confidential alone, but the controller also asserts
//      finance.create / finance.deletePosted - so an HR manager with no finance keys was shown a button
//      that answered 403. Can() resolves a list through canAny, so an AND is two nested Can.
//   4. The Emiratisation tab was drawn for an organisation outside the UAE, whose only content was a
//      sentence saying the report did not apply to it.
//   5. No page shell and a hand-rolled <h1> - the same two the Overview had: bare p-4 with no
//      mx-auto max-w, so three figures stretched the width of a monitor.
//
// AND THREE MORE THAT ONLY A SCREENSHOT COULD HAVE FOUND. This page had NO stub in scripts/shoot-mobile.mjs,
// so check:mobile rendered six error states and reported them clean. With the stubs added, the sweep
// immediately failed on a six-tab strip 833px wide against an 820px pane (PillTabs stops scrolling at sm,
// so the labels are short now), and reading the shots showed "Employees costed 3.00" - formatNumber's two
// decimals applied to a headcount - and phone cards reading "20 / 1 / 1 / 6" with no headings, because a
// `card: "meta"` cell is drawn bare while an UNTAGGED column becomes a labelled line.
//
// Which tabs exist at all is lib/hrReports.js reportTabs, because the six reports do NOT share one gate.
import React, { useMemo, useState } from "react";
import { AlertTriangle, Download, Users } from "lucide-react";
import { PillTabs } from "../salesDocs/parts.jsx";
import { Button } from "../ui/button";
import { DataTable, EmptyState, ErrorNote, PageHeader, Panel, Pill, Spinner, useAsync, useToasts } from "../accounting/kit";
import Can from "../shell/Can.jsx";
import { useOrganisation } from "../shell/OrganisationContext";
import { useExportPreamble } from "../Reports/reportKit.jsx";
import { emiratisation, employeeDocuments, gratuity, hrReports, payroll } from "../../lib/hrApi";
import { attendanceCsv, documentsCsv, firstTab, gratuityCsv, leaveBalancesCsv, payrollRegisterCsv, reportLabel, reportTabs } from "../../lib/hrReports";
import { isUae } from "../../lib/taxTerms";
import { CURRENCY, downloadCSV, formatDate, formatNumber } from "../../utils/format";
import { today } from "../../utils/orgLocale";

// A figure that is not known is a dash, never a zero - the same grammar the Overview's tiles use.
const DASH = "—";
const money = (n) => (n === null || n === undefined ? DASH : `${CURRENCY} ${formatNumber(n)}`);
// formatNumber defaults to two decimals, which is right for money and wrong for people: "Employees
// costed 3.00" and "Service days 640.00" is what that looked like. A whole number prints whole; a real
// fraction (half a leave day accrued) keeps its decimals.
const count = (n) => (n === null || n === undefined ? DASH : formatNumber(n, Number.isInteger(Number(n)) ? 0 : 2));
// One decimal: a percentage to two reads as a precision an attendance figure does not have ("89.40%").
const rate = (n) => (n === null || n === undefined ? DASH : `${formatNumber(n, 1)}%`);
const monthNow = () => today().slice(0, 7); // the ORGANISATION's month (defect 1)

/** The export control every tab carries, so a saved file says whose figures they are and as of when. */
function ExportButton({ onClick, disabled }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled} data-shortcut="export">
      <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
      Export
    </Button>
  );
}

/** A month box, used by the two reports that are about a month. */
function MonthField({ value, onChange, label = "Month" }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input type="month" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-11 rounded-lg border border-border bg-background px-3 text-base lg:h-10 lg:text-sm" />
    </label>
  );
}

// --------------------------------------------------------------------------------------------------
// Gratuity liability
// --------------------------------------------------------------------------------------------------

function GratuityPanel() {
  const { notify, toastNode } = useToasts();
  const [month, setMonth] = useState(monthNow);
  const preview = useAsync(() => gratuity.preview(month), [month]);
  const accruals = useAsync(() => gratuity.accruals(), []);
  const [busy, setBusy] = useState(false);
  const preamble = useExportPreamble("Gratuity liability");

  async function accrue() {
    setBusy(true);
    try {
      const { accrual, posted } = await gratuity.accrue(month);
      notify(posted ? `Accrued ${CURRENCY} ${formatNumber(accrual.amount)} for ${month}.` : `${month}: nothing to accrue.`);
      preview.reload();
      accruals.reload();
    } catch (err) {
      notify(err.message || "Could not accrue that month.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function reverse(id) {
    setBusy(true);
    try {
      await gratuity.reverse(id, "Reversed from the Reports screen");
      notify("Accrual reversed.");
      accruals.reload();
    } catch (err) {
      notify(err.message || "Could not reverse that accrual.", "error");
    } finally {
      setBusy(false);
    }
  }

  const p = preview.data;
  function exportCsv() {
    const { headers, rows } = gratuityCsv(p);
    downloadCSV(`gratuity-${month}.csv`, headers, rows, { preamble: preamble(`As at ${p?.day || month}`) });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <MonthField value={month} onChange={setMonth} />
        {/* Two gates, nested: the controller asserts finance.create on top of hr.confidential, so one
            Can() would draw a button that answers 403 (defect 3). */}
        <Can permission="hr.confidential">
          <Can permission="finance.create">
            <Button onClick={accrue} disabled={busy || preview.loading}>{busy ? "Working…" : "Accrue this month"}</Button>
          </Can>
        </Can>
      </div>

      {preview.loading && <Spinner />}
      {preview.error && <ErrorNote error={preview.error} onRetry={preview.reload} />}
      {!preview.loading && !preview.error && p && (
        <Panel title="What the books should already be carrying" description={`As at ${p.day}`} actions={<ExportButton onClick={exportCsv} />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Liability</p>
              <p className="text-xl font-semibold text-foreground">{money(p.cumulativeLiability)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Movement this month</p>
              <p className="text-xl font-semibold text-foreground">{money(p.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Employees costed</p>
              <p className="text-xl font-semibold text-foreground">{count(p.employeeCount)}</p>
              {(p.missingCount > 0 || p.missing?.length > 0) && (
                <p className="text-xs text-status-warning">{p.missingCount ?? p.missing.length} cannot be costed yet</p>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* Per employee, with each one's basic pay - absent entirely for a reader the server stripped it
          from (complianceController.js forReader), so this is belt and braces over the real decision. */}
      <Can permission="hr.confidential">
        {p?.employees?.length > 0 && (
          <DataTable
            caption="Gratuity by employee"
            rows={p.employees}
            rowKey={(r) => r._id}
            columns={[
              { key: "name", header: "Employee", card: "primary", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
              { key: "staffId", header: "Code", card: "meta", cell: (r) => <span className="whitespace-nowrap font-mono text-xs">{r.staffId}</span> },
              { key: "serviceDays", header: "Service days", align: "end", cell: (r) => count(r.serviceDays) },
              { key: "basicPay", header: "Basic pay", align: "end", cell: (r) => money(r.basicPay) },
              { key: "owed", header: "Owed", card: "amount", align: "end", cell: (r) => <span className="whitespace-nowrap font-medium">{money(r.owed)}</span> },
            ]}
          />
        )}
      </Can>

      {/* Accrual history. The error is drawn (defect 2): a failed read used to fall through to the empty
          state and tell the reader that nothing had ever been accrued. */}
      <Panel title="Accrual history" description="Each month this liability was posted to the ledger.">
        {accruals.error ? (
          <ErrorNote error={accruals.error} onRetry={accruals.reload} />
        ) : accruals.loading ? (
          <Spinner />
        ) : (accruals.data || []).length === 0 ? (
          <EmptyState title="No accrual run yet" text="Nothing has been posted for gratuity. Pick a month above and accrue it." />
        ) : (
          <div className="grid gap-2">
            {(accruals.data || []).map((a) => (
              <div key={a._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <span className="font-medium">{a.month}</span>
                <span className="text-muted-foreground">{money(a.amount)}</span>
                {a.reversedAt ? <Pill tone="neutral">Reversed</Pill> : a.voucherNo ? (
                  <Can permission="hr.confidential">
                    <Can permission="finance.deletePosted">
                      <Button variant="outline" size="sm" onClick={() => reverse(a._id)} disabled={busy}>Reverse</Button>
                    </Can>
                  </Can>
                ) : <Pill tone="neutral">No movement</Pill>}
              </div>
            ))}
          </div>
        )}
      </Panel>
      {toastNode}
    </div>
  );
}

// --------------------------------------------------------------------------------------------------
// Payroll register - who was paid what, for a run that has already been posted
// --------------------------------------------------------------------------------------------------

function PayrollRegisterPanel() {
  const runs = useAsync(() => payroll.runs(), []);
  const [runId, setRunId] = useState(null);
  const list = useMemo(() => runs.data || [], [runs.data]);
  // The newest POSTED run, unless the reader picked another. A reversed run is still a row (it is
  // history), but it is not what somebody opening this report wants to see first.
  const chosen = useMemo(() => list.find((r) => r._id === runId) || list.find((r) => r.status === "POSTED") || list[0] || null, [list, runId]);
  const slips = useAsync(() => (chosen ? payroll.payslips(chosen._id) : Promise.resolve([])), [chosen?._id]);
  const preamble = useExportPreamble("Payroll register");

  function exportCsv() {
    const { headers, rows } = payrollRegisterCsv(slips.data);
    downloadCSV(`payroll-register-${chosen?.period || "run"}.csv`, headers, rows, { preamble: preamble(chosen?.period) });
  }

  if (runs.loading) return <Spinner />;
  if (runs.error) return <ErrorNote error={runs.error} onRetry={runs.reload} />;
  if (!list.length) {
    return <EmptyState title="No payroll run posted yet" text="Plan and post a period on HRMS > Payroll, and the register of who was paid what appears here." />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Run</span>
          <select
            value={chosen?._id || ""}
            onChange={(e) => setRunId(e.target.value)}
            aria-label="Payroll run"
            className="h-11 rounded-lg border border-border bg-background px-3 text-base lg:h-10 lg:text-sm"
          >
            {list.map((r) => (
              <option key={r._id} value={r._id}>
                {r.period}{r.voucherNo ? ` · ${r.voucherNo}` : ""}{r.status === "REVERSED" ? " (reversed)" : ""}
              </option>
            ))}
          </select>
        </label>
        {chosen?.status === "REVERSED" && <Pill tone="neutral">This run was reversed</Pill>}
      </div>

      {chosen && (
        <Panel
          title={`What ${chosen.period} paid`}
          description={`${count(chosen.employeeCount)} people · gross ${money(chosen.totalGross)} · net ${money(chosen.totalNet)}`}
          actions={<ExportButton onClick={exportCsv} disabled={!slips.data?.length} />}
          bodyClassName="p-0 sm:p-0"
        >
          <DataTable
            caption="Payroll register"
            rows={slips.data || []}
            rowKey={(r) => r._id}
            loading={slips.loading}
            loadingLabel="Reading the payslips"
            error={slips.error}
            onRetry={slips.reload}
            emptyTitle="No payslips on this run"
            emptyText="The run was posted without anybody on it."
            columns={[
              { key: "staffName", header: "Employee", card: "primary", cell: (r) => <span className="font-medium text-foreground">{r.staffName || DASH}</span> },
              { key: "basicPay", header: "Basic", align: "end", cell: (r) => money(r.basicPay) },
              { key: "totalEarnings", header: "Earnings", align: "end", cell: (r) => money(r.totalEarnings) },
              { key: "totalDeductions", header: "Deductions", align: "end", cell: (r) => money(r.totalDeductions) },
              { key: "grossPay", header: "Gross", align: "end", cell: (r) => money(r.grossPay) },
              { key: "netPay", header: "Net", card: "amount", align: "end", cell: (r) => <span className="whitespace-nowrap font-medium">{money(r.netPay)}</span> },
              {
                key: "proratedFactor",
                header: "Part month",
                card: "badge",
                // Shown only when it IS a part month: it is the thing that explains a net which looks
                // wrong against the contract, and a column of "1" explains nothing.
                cell: (r) => (r.proratedFactor !== undefined && r.proratedFactor !== null && r.proratedFactor < 1
                  ? <Pill tone="warning">{Math.round(r.proratedFactor * 100)}%</Pill>
                  : <span className="text-muted-foreground">{DASH}</span>),
              },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------------------------------
// Attendance - a period's muster per employee, and the overtime nothing has ever displayed
// --------------------------------------------------------------------------------------------------

function AttendancePanel() {
  const [month, setMonth] = useState(monthNow);
  // A whole calendar month. The server counts it with a $group, so there is no row cap to fall foul of.
  const from = `${month}-01`;
  const to = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const d = new Date(`${next}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [month]);
  const report = useAsync(() => hrReports.attendance(from, to), [from, to]);
  const preamble = useExportPreamble("Attendance");
  const d = report.data;

  function exportCsv() {
    const { headers, rows } = attendanceCsv(d);
    downloadCSV(`attendance-${month}.csv`, headers, rows, { preamble: preamble(`${from} to ${to}`) });
  }

  const t = d?.totals;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <MonthField value={month} onChange={setMonth} />
      </div>

      {t && (
        <Panel title="The month in total" description={`${from} to ${to}`} actions={<ExportButton onClick={exportCsv} disabled={!d?.employees?.length} />}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Attendance</p>
              <p className="text-xl font-semibold text-foreground">{rate(t.rate)}</p>
              <p className="text-xs text-muted-foreground">{count(t.worked)} of {count(t.expected)} days expected</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hours worked</p>
              <p className="text-xl font-semibold text-foreground">{count(t.hours)}</p>
            </div>
            <div>
              {/* Computed since the attendance wave and shown for the first time here. */}
              <p className="text-xs text-muted-foreground">Overtime hours</p>
              <p className="text-xl font-semibold text-foreground">{count(t.overtime)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days marked</p>
              <p className="text-xl font-semibold text-foreground">{count(t.marked)}</p>
              {d.neverMarked?.length > 0 && (
                <p className="text-xs text-status-warning">{d.neverMarked.length} never marked</p>
              )}
            </div>
          </div>
        </Panel>
      )}

      <DataTable
        caption="Attendance by employee"
        rows={d?.employees || []}
        rowKey={(r) => r._id}
        loading={report.loading}
        loadingLabel="Counting the muster"
        error={report.error}
        onRetry={report.reload}
        emptyTitle="Nothing marked this month"
        emptyText="No attendance has been recorded for this period yet."
        columns={[
          {
            key: "name",
            header: "Employee",
            card: "primary",
            cell: (r) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.staffId}{r.department ? ` · ${r.department}` : ""}</p>
              </div>
            ),
          },
          { key: "present", header: "Present", align: "end", cell: (r) => count(r.present) },
          { key: "half_day", header: "Half day", card: "hidden", align: "end", cell: (r) => count(r.half_day) },
          { key: "on_leave", header: "Leave", align: "end", cell: (r) => count(r.on_leave) },
          { key: "absent", header: "Absent", align: "end", cell: (r) => count(r.absent) },
          { key: "hours", header: "Hours", align: "end", cell: (r) => count(r.hours) },
          { key: "overtime", header: "Overtime", align: "end", cell: (r) => count(r.overtime) },
          {
            key: "rate",
            header: "Attendance",
            card: "badge",
            // A dash, not 0%: nobody marked this person, so the figure is unknown. attendanceSplit
            // returns null rather than dividing by nothing, and this is what that null must look like.
            cell: (r) => (r.rate === null || r.rate === undefined
              ? <Pill tone="neutral">Not marked</Pill>
              : <Pill tone={r.rate >= 90 ? "success" : r.rate >= 75 ? "warning" : "danger"}>{rate(r.rate)}</Pill>),
          },
        ]}
      />
    </div>
  );
}

// --------------------------------------------------------------------------------------------------
// Leave balances - everybody, every active leave type, on a day
// --------------------------------------------------------------------------------------------------

function LeaveBalancesPanel() {
  const [day, setDay] = useState(today);
  const report = useAsync(() => hrReports.leaveBalances(day), [day]);
  const preamble = useExportPreamble("Leave balances");
  const d = report.data;

  function exportCsv() {
    const { headers, rows } = leaveBalancesCsv(d);
    downloadCSV(`leave-balances-${day}.csv`, headers, rows, { preamble: preamble(`As at ${day}`) });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">As at</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="As at" className="h-11 rounded-lg border border-border bg-background px-3 text-base lg:h-10 lg:text-sm" />
        </label>
        <ExportButton onClick={exportCsv} disabled={!d?.rows?.length} />
      </div>

      {d?.missing?.length > 0 && (
        <Panel title="Cannot be worked out yet" description="Nobody is shown a balance of nothing: these need a joining date or an accrual rate first.">
          <ul className="grid gap-1 text-sm">
            {d.missing.map((m) => (
              <li key={`${m._id}-${m.leaveTypeName || ""}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <span className="font-medium text-foreground">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.staffId}</span>
                <Pill tone="warning">{m.reason === "NO_JOINING_DATE" ? "No joining date" : `No accrual rate${m.leaveTypeName ? ` (${m.leaveTypeName})` : ""}`}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <DataTable
        caption="Leave balances"
        rows={d?.rows || []}
        rowKey={(r) => r._id}
        loading={report.loading}
        loadingLabel="Working out the balances"
        error={report.error}
        onRetry={report.reload}
        emptyTitle="No leave balances to show"
        emptyText="Add a leave type with an accrual rate on HRMS > Setup, and every employee's balance appears here."
        footer={d?.rows?.length ? (
          <tr className="font-medium">
            <td className="px-3 py-3.5">Total</td>
            <td className="px-3 py-3.5" />
            <td className="px-3 py-3.5 text-end">{count(d.totals.accrued)}</td>
            <td className="px-3 py-3.5 text-end">{count(d.totals.consumed)}</td>
            <td className="px-3 py-3.5 text-end">{count(d.totals.available)}</td>
          </tr>
        ) : null}
        columns={[
          {
            key: "name",
            header: "Employee",
            card: "primary",
            cell: (r) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.staffCode}</p>
              </div>
            ),
          },
          { key: "leaveTypeName", header: "Leave type", card: "badge", cell: (r) => <Pill tone="neutral">{r.leaveTypeName}</Pill> },
          { key: "accrued", header: "Accrued", align: "end", cell: (r) => count(r.accrued) },
          { key: "consumed", header: "Taken", align: "end", cell: (r) => count(r.consumed) },
          { key: "available", header: "Available", card: "amount", align: "end", cell: (r) => <span className="whitespace-nowrap font-medium">{count(r.available)}</span> },
        ]}
      />
    </div>
  );
}

// --------------------------------------------------------------------------------------------------
// Documents expiring
// --------------------------------------------------------------------------------------------------

function DocumentsPanel() {
  const [withinDays, setWithinDays] = useState(60);
  const report = useAsync(() => employeeDocuments.expiring({ withinDays }), [withinDays]);
  const preamble = useExportPreamble("Employee documents expiring");
  const d = report.data;

  function exportCsv() {
    const { headers, rows } = documentsCsv(d);
    downloadCSV(`documents-expiring-${d?.asOf || "today"}.csv`, headers, rows, { preamble: preamble(`As at ${d?.asOf || ""}, within ${withinDays} days`) });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Expiring within</span>
          <select value={withinDays} onChange={(e) => setWithinDays(Number(e.target.value))} aria-label="Expiring within" className="h-11 rounded-lg border border-border bg-background px-3 text-base lg:h-10 lg:text-sm">
            {[30, 60, 90, 180].map((n) => <option key={n} value={n}>{n} days</option>)}
          </select>
        </label>
        <ExportButton onClick={exportCsv} disabled={!d?.rows?.length} />
        {d?.summary && (
          <div className="flex items-center gap-2">
            {d.summary.expired > 0 && <Pill tone="danger">{d.summary.expired} expired</Pill>}
            <Pill tone="warning">{d.summary.expiringSoon} expiring soon</Pill>
          </div>
        )}
      </div>

      <DataTable
        caption="Employee documents expiring"
        rows={d?.rows || []}
        rowKey={(r) => String(r.documentId)}
        loading={report.loading}
        loadingLabel="Reading the documents"
        error={report.error}
        onRetry={report.reload}
        emptyTitle="Nothing expiring"
        emptyText={`No employee document expires in the next ${withinDays} days.`}
        columns={[
          {
            key: "partyName",
            header: "Employee",
            card: "primary",
            cell: (r) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{r.partyName}</p>
                <p className="truncate text-xs text-muted-foreground">{r.partyCode}</p>
              </div>
            ),
          },
          { key: "documentType", header: "Document", cell: (r) => r.documentType || DASH },
          { key: "number", header: "Number", card: "hidden", cell: (r) => <span className="font-mono text-xs">{r.number || DASH}</span> },
          { key: "expiryDate", header: "Expires", cell: (r) => (r.expiryDate ? formatDate(r.expiryDate) : DASH) },
          {
            key: "status",
            header: "Status",
            card: "badge",
            cell: (r) => (r.status === "EXPIRED"
              ? <Pill tone="danger">Expired {Math.abs(r.daysLeft)}d ago</Pill>
              : <Pill tone="warning">{r.daysLeft}d left</Pill>),
          },
        ]}
      />
    </div>
  );
}

// --------------------------------------------------------------------------------------------------
// Emiratisation - UAE only, which is now decided before the tab is drawn (defect 4)
// --------------------------------------------------------------------------------------------------

function EmiratisationPanel() {
  const status = useAsync(() => emiratisation(), []);
  if (status.loading) return <Spinner />;
  if (status.error) return <ErrorNote error={status.error} onRetry={status.reload} />;
  const s = status.data;
  // Reached only if the country changed under the reader, since reportTabs leaves this tab out entirely
  // outside the UAE - the same way the VAT return screen is hidden rather than refused.
  if (!s) return <EmptyState title="Not applicable" text="Emiratisation applies to UAE organisations only." />;
  if (!s.configured) {
    return <EmptyState title="Not set up yet" text="The quota percentage and the fine per position have not been set up yet (HRMS > Setup)." />;
  }
  return (
    <Panel title="Where the organisation stands" description={`As at ${s.day} · quota ${s.requiredPercent}% of the workforce`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">UAE nationals / required</p>
            <p className="text-xl font-semibold text-foreground">{s.nationals} / {s.required}</p>
            <p className="text-xs text-muted-foreground">of {s.headcount} active employees</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {s.compliant ? (
            <Pill tone="success">Meeting the quota</Pill>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 text-status-warning" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Short by {s.shortfall} - monthly exposure</p>
                {/* AED by law, not the organisation's own currency: the fine is set in dirhams by the
                    UAE, and this report only exists for a UAE organisation. */}
                <p className="text-xl font-semibold text-status-warning">AED {formatNumber(s.monthlyExposure)}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------------------------------

const PANELS = {
  gratuity: GratuityPanel,
  payroll: PayrollRegisterPanel,
  attendance: AttendancePanel,
  leave: LeaveBalancesPanel,
  documents: DocumentsPanel,
  emiratisation: EmiratisationPanel,
};

export default function ReportsPage() {
  const { me } = useOrganisation();
  // isUae() reads the organisation's country, which arrives WITH the status rather than being there on
  // the first render. It needs no dependency of its own: Layout keys the whole page on `localeKey`
  // (Layout.jsx:237), so a change of country remounts this screen and the country is read again.
  const tabs = useMemo(() => reportTabs(me, { uae: isUae() }), [me]);
  const [asked, setAsked] = useState(null);
  // Never a fixed default: a muster clerk holds hr.attendance and not hr.view, and would have landed on
  // a gratuity tab that is not drawn.
  const tab = firstTab(tabs, asked);
  const Panel_ = tab ? PANELS[tab] : null;

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Reports"
        description="What the books should already be carrying, what was paid, and who was here."
      />
      {tabs.length === 0 ? (
        <EmptyState title="No reports for your role" text="Ask an administrator for the HR permissions the reports you need are behind." />
      ) : (
        <>
          <PillTabs tabs={tabs} value={tab} onChange={setAsked} label="HR reports" />
          <div className="mt-4" role="region" aria-label={reportLabel(tab)}>
            {Panel_ && <Panel_ />}
          </div>
        </>
      )}
    </div>
  );
}
