// HRMS > Reports (/hr/reports): one route, PillTabs - the same call CRM made for its own seven reports (the
// 88px rail cannot hold the growth, and the sweep opens role="tab" panels by itself). Gratuity and
// Emiratisation today; later waves' reports (payroll register, attendance) add tabs here, not rail items.
import React, { useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { PillTabs } from "../salesDocs/parts.jsx";
import { Button } from "../ui/button";
import { ErrorNote, Pill, Spinner, useAsync, useToasts } from "../accounting/kit";
import Can from "../shell/Can.jsx";
import { gratuity, emiratisation } from "../../lib/hrApi";
import { CURRENCY, formatNumber } from "../../utils/format";

function GratuityPanel() {
  const { notify, toastNode } = useToasts();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const preview = useAsync(() => gratuity.preview(month), [month]);
  const accruals = useAsync(() => gratuity.accruals(), []);
  const [busy, setBusy] = useState(false);

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
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Month</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
        </label>
        <Can permission="hr.confidential">
          <Button onClick={accrue} disabled={busy || preview.loading}>{busy ? "Working…" : "Accrue this month"}</Button>
        </Can>
      </div>

      {preview.loading && <Spinner />}
      {preview.error && <ErrorNote error={preview.error} onRetry={preview.reload} />}
      {!preview.loading && !preview.error && p && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Liability as at {p.day}</p>
            <p className="text-xl font-semibold text-foreground">{CURRENCY} {formatNumber(p.cumulativeLiability)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Movement this month</p>
            <p className="text-xl font-semibold text-foreground">{CURRENCY} {formatNumber(p.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Employees costed</p>
            <p className="text-xl font-semibold text-foreground">{p.employeeCount}</p>
            {(p.missingCount > 0 || p.missing?.length > 0) && (
              <p className="text-xs text-status-warning">{p.missingCount ?? p.missing.length} cannot be costed yet</p>
            )}
          </div>
        </div>
      )}
      <Can permission="hr.confidential">
        {p?.employees?.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-foreground">By employee</h3>
            {p.employees.map((e) => (
              <div key={e._id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <span>{e.name}</span>
                <span className="text-muted-foreground">{CURRENCY} {formatNumber(e.owed)}</span>
              </div>
            ))}
          </div>
        )}
      </Can>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold text-foreground">Accrual history</h3>
        {(accruals.data || []).map((a) => (
          <div key={a._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
            <span className="font-medium">{a.month}</span>
            <span className="text-muted-foreground">{CURRENCY} {formatNumber(a.amount)}</span>
            {a.reversedAt ? <Pill tone="neutral">Reversed</Pill> : a.voucherNo ? (
              <Can permission="hr.confidential">
                <Button variant="outline" size="sm" onClick={() => reverse(a._id)} disabled={busy}>Reverse</Button>
              </Can>
            ) : <Pill tone="neutral">No movement</Pill>}
          </div>
        ))}
        {!accruals.loading && (accruals.data || []).length === 0 && <p className="text-sm text-muted-foreground">No accrual run yet.</p>}
      </div>
      {toastNode}
    </div>
  );
}

function EmiratisationPanel() {
  const status = useAsync(() => emiratisation(), []);
  if (status.loading) return <Spinner />;
  if (status.error) return <ErrorNote error={status.error} onRetry={status.reload} />;
  const s = status.data;
  if (!s) return <p className="text-sm text-muted-foreground">Emiratisation applies to UAE organisations only.</p>;
  if (!s.configured) return <p className="text-sm text-muted-foreground">The quota percentage and the fine per position have not been set up yet (HRMS &gt; Setup).</p>;
  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
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
              <p className="text-xl font-semibold text-status-warning">AED {formatNumber(s.monthlyExposure)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const TABS = [["gratuity", "Gratuity liability"], ["emiratisation", "Emiratisation"]];

export default function ReportsPage() {
  const [tab, setTab] = useState("gratuity");
  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Reports</h1>
      <p className="mb-4 text-sm text-muted-foreground">Compliance figures that do not wait for payroll.</p>
      <PillTabs tabs={TABS} value={tab} onChange={setTab} label="HR reports" />
      <div className="mt-4">
        {tab === "gratuity" && <GratuityPanel />}
        {tab === "emiratisation" && <EmiratisationPanel />}
      </div>
    </div>
  );
}
