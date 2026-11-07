// HRMS > Payroll (/hr/payroll): plan a period, see the exceptions BEFORE anybody is paid (assessClose's
// own shape - blockers refuse outright, warnings are ticked by name), post it as one run for the whole
// organisation (D14 - the same closing-entry pattern gratuity's monthly accrual already uses), and reverse
// one cleanly if it was wrong. Planning strips every figure unless the caller holds hr.confidential - the
// server decides this, not the screen.
import React, { useMemo, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import { Button } from "../ui/button";
import { ErrorNote, Pill, Spinner, useAsync, useToasts } from "../accounting/kit";
import Can from "../shell/Can.jsx";
import { payroll } from "../../lib/hrApi";
import { CURRENCY, formatNumber } from "../../utils/format";
import { today } from "../../utils/orgLocale";

const money = (n) => `${CURRENCY} ${formatNumber(n ?? 0)}`;

function RunHistory({ runs, onReverse }) {
  if (!runs?.length) return <p className="text-sm text-muted-foreground">No runs posted yet.</p>;
  return (
    <div className="grid gap-2">
      {runs.map((r) => (
        <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{r.period} · {r.voucherNo}</p>
            <p className="text-xs text-muted-foreground">{r.employeeCount} people · net {money(r.totalNet)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={r.status === "REVERSED" ? "neutral" : "success"}>{r.status === "REVERSED" ? "Reversed" : "Posted"}</Pill>
            {r.status === "POSTED" && (
              <Can permission="hr.payroll">
                <Button variant="ghost" size="sm" onClick={() => onReverse(r)}>Reverse</Button>
              </Can>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PayrollPage() {
  const { notify, toastNode } = useToasts();
  const [period, setPeriod] = useState(() => today().slice(0, 7));
  const planQuery = useAsync(() => payroll.plan(period), [period]);
  const runsQuery = useAsync(() => payroll.runs(), []);
  const [acknowledged, setAcknowledged] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  const plan = planQuery.data;
  const blockers = plan?.assessment?.blockers || [];
  const unacknowledged = useMemo(() => (plan?.assessment?.warnings || []).filter((w) => !acknowledged.has(w.code)), [plan, acknowledged]);
  const warnings = plan?.assessment?.warnings || [];
  const canPost = blockers.length === 0 && !plan?.alreadyPosted;

  function toggle(code) {
    setAcknowledged((prev) => { const next = new Set(prev); next.has(code) ? next.delete(code) : next.add(code); return next; });
  }

  async function post() {
    setBusy(true);
    setFailure(null);
    try {
      await payroll.post(period, [...acknowledged]);
      notify(`${period} posted.`);
      setAcknowledged(new Set());
      planQuery.reload();
      runsQuery.reload();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  }

  async function reverse(run) {
    try {
      await payroll.reverse(run._id, "Reversed from the Payroll screen");
      notify(`${run.period} reversed.`);
      planQuery.reload();
      runsQuery.reload();
    } catch (err) {
      notify(err.message || "Could not reverse that run.", "error");
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground">Gross pay plus every active deduction, for the whole organisation at once.</p>
        </div>
        <input type="month" value={period} onChange={(e) => { setPeriod(e.target.value); setAcknowledged(new Set()); }} className="h-11 rounded-lg border border-input bg-background px-3 text-sm lg:h-10" />
      </div>

      {planQuery.loading && <Spinner label="Planning the period" />}
      {planQuery.error && <ErrorNote error={planQuery.error} onRetry={planQuery.reload} />}

      {plan && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Employees</p><p className="text-lg font-semibold text-foreground">{plan.totals.employeeCount}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Gross</p><p className="text-lg font-semibold text-foreground">{money(plan.totals.gross)}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Deductions</p><p className="text-lg font-semibold text-foreground">{money(plan.totals.deductions)}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Net</p><p className="text-lg font-semibold text-foreground">{money(plan.totals.net)}</p></div>
          </div>

          {plan.alreadyPosted && <p className="mb-3 text-sm text-status-warning">This period has already been posted. Reverse it below before posting again.</p>}

          {blockers.length > 0 && (
            <div className="mb-3 grid gap-2">
              {blockers.map((b) => (
                <div key={b.code} className="flex items-start gap-2 rounded-lg border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div><p className="font-medium">{b.title}</p>{b.detail && <p className="text-xs">{b.detail}</p>}</div>
                </div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mb-3 grid gap-2">
              {warnings.map((w) => (
                <label key={w.code} className="flex items-start gap-2 rounded-lg border border-status-warning/25 bg-status-warning-soft p-3 text-sm text-status-warning">
                  <input type="checkbox" className="mt-0.5" checked={acknowledged.has(w.code)} onChange={() => toggle(w.code)} />
                  <div><p className="font-medium">{w.title}</p>{w.detail && <p className="text-xs">{w.detail}</p>}</div>
                </label>
              ))}
            </div>
          )}

          {failure && <div className="mb-3"><ErrorNote error={failure} /></div>}

          <Can permission="hr.payroll">
            <div className="mb-6">
              <Button onClick={post} disabled={busy || !canPost || unacknowledged.length > 0}>
                <Wallet className="mr-1.5 h-4 w-4" aria-hidden="true" /> {busy ? "Posting…" : `Post ${period}`}
              </Button>
              {unacknowledged.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Tick every warning above first.</p>}
            </div>
          </Can>

          {plan.employees?.length > 0 && (
            <div className="mb-6 grid gap-2">
              <h2 className="text-sm font-semibold text-foreground">Who is being paid</h2>
              {plan.employees.map((e) => (
                <div key={e.staffId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{e.staffName}</p>
                    {(e.joinedMidPeriod || e.exitedMidPeriod) && <p className="text-xs text-muted-foreground">{e.joinedMidPeriod ? "Joined" : "Left"} during this period</p>}
                  </div>
                  {e.hasContract ? <span className="font-medium text-foreground">{money(e.netPay)}</span> : <Pill tone="warning">No contract</Pill>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">Past runs</h2>
      {runsQuery.loading && <Spinner />}
      {runsQuery.error && <ErrorNote error={runsQuery.error} onRetry={runsQuery.reload} />}
      {!runsQuery.loading && !runsQuery.error && <RunHistory runs={runsQuery.data} onReverse={reverse} />}
      {toastNode}
    </div>
  );
}
