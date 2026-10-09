import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { acknowledged, canConfirm, closedToast, money, outstanding, profitWords } from "../../../lib/yearEnd";
import { formatDate } from "../../../utils/format";
import { Button } from "../../ui/button";
import { ErrorNote, Modal, Pill, Spinner, useAsync } from "../kit";

// Closing or reopening a fiscal year (services/financial/yearEndService.js decides; this only shows it). Closing is a
// decision with consequences: the dialog reads what would happen before it asks, lists everything that stands in the
// way, makes the person tick each warning by name, and says in figures where the profit goes and what the next year
// opens with.

const ICON = { ok: CheckCircle2, warning: AlertTriangle, blocker: XCircle };
const ICON_TONE = { ok: "text-status-success", warning: "text-status-warning", blocker: "text-status-danger" };

function Check({ check, ticked, onTick }) {
  const Icon = ICON[check.level] || CheckCircle2;
  const body = (
    <>
      <span className="block font-medium">{check.title}</span>
      {check.detail && <span className="block text-muted-foreground">{check.detail}</span>}
    </>
  );
  return (
    <li className="flex items-start gap-3 text-sm" data-level={check.level}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_TONE[check.level]}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {check.level === "warning" ? (
          <label className="flex cursor-pointer items-start gap-2">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={ticked.has(check.code)} onChange={() => onTick(check.code)} />
            <span className="min-w-0">
              {body}
              <span className="block text-xs text-muted-foreground">Tick to accept this and close anyway</span>
            </span>
          </label>
        ) : (
          body
        )}
      </div>
      <span className="sr-only">{check.level === "ok" ? "Passed" : check.level === "warning" ? "Warning" : "Blocks closing"}</span>
    </li>
  );
}

function Row({ label, children, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{children}</dd>
    </div>
  );
}

function Figures({ preview }) {
  const f = preview.figures || {};
  const cur = preview.currency;
  const target = preview.retained?.accountName || "Retained Earnings";
  return (
    <section aria-label="What closing does" className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
      <h3 className="mb-1 font-semibold">{preview.willPost ? `Moved to ${target}` : "Closing entry"}</h3>
      {f.accounts === 0 ? (
        <p className="text-muted-foreground">There is no income or expense to carry over, so no closing entry is posted.</p>
      ) : (
        <>
          <dl className="divide-y divide-border/60">
            <Row label="Income">{money(f.income, cur)}</Row>
            <Row label="Expenses">{money(f.expenses, cur)}</Row>
            <Row label={f.profit >= 0 ? "Profit" : "Loss"} strong>{money(f.profit, cur)}</Row>
          </dl>
          {f.broughtForward !== 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {money(f.broughtForward, cur)} of this was earned before {preview.year.code} and never closed to equity (a year locked before year-end closing existed). It goes to {target} now.
            </p>
          )}
          {!preview.willPost && <p className="mt-2 text-xs text-muted-foreground">Ledger posting is off, so nothing will be posted: the year is only locked.</p>}
          {preview.branches?.length > 1 && (
            <ul aria-label="By branch" className="mt-3 space-y-1 text-xs">
              {preview.branches.map((b) => (
                <li key={b.branchId} className="flex justify-between gap-4">
                  <span>{b.name}</span>
                  <span className="tabular-nums text-muted-foreground">{profitWords(b.profit, cur)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Carried({ preview }) {
  const c = preview.figures?.carriedForward;
  if (!c || !preview.next?.code) return null;
  const cur = preview.currency;
  return (
    <section aria-label="What the next year opens with" className="rounded-xl border border-border p-4 text-sm">
      <h3 className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
        {preview.next.code} opens with
        {c.balanced ? <Pill tone="success">In balance</Pill> : <Pill tone="danger">Out of balance</Pill>}
      </h3>
      <dl className="divide-y divide-border/60">
        <Row label="Assets">{money(c.assets, cur)}</Row>
        <Row label="Liabilities">{money(c.liabilities, cur)}</Row>
        <Row label="Equity, with the profit">{money(c.equity, cur)}</Row>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Income and expense start {preview.next.code} at zero. {preview.next.exists ? "" : `${preview.next.code} (${formatDate(preview.next.startDay)} to ${formatDate(preview.next.endDay)}) is created for you.`}
      </p>
    </section>
  );
}

export default function YearEndDialog({ year, mode, onClose, onDone }) {
  const closing = mode === "close";
  const preview = useAsync(() => accounting.yearEnd(year._id), [year._id]);
  const [ticked, setTicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const data = preview.data;

  const tick = (code) => setTicked((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      if (closing) {
        const out = await accounting.closeFiscalYear(year._id, { acknowledge: acknowledged(ticked) });
        onDone(closedToast(year.code, out?.closing, out?.currency));
      } else {
        await accounting.reopenFiscalYear(year._id);
        onDone(`${year.code} reopened`);
      }
    } catch (e) {
      setError(e);
      setBusy(false);
      preview.reload(); // what stood in the way may have changed
    }
  }

  const ready = closing ? canConfirm(data, ticked) : Boolean(data?.reopen?.canReopen);
  const left = closing ? outstanding(data, ticked).length : 0;

  return (
    <Modal
      size="md" title={closing ? `Close ${year.code}?` : `Reopen ${year.code}?`}
      description={`${formatDate(year.startDate)} to ${formatDate(year.endDate)}`} onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant={closing ? "destructive" : "default"} disabled={!ready || busy} onClick={confirm}>
            {busy ? "Working…" : closing ? "Close year" : "Reopen year"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {closing ? (
          <p className="text-sm text-muted-foreground">
            No order or voucher dated in this year can be created, approved, edited, deleted or reversed until it is reopened. Costs of earlier sales are never restated.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Documents dated in this year can be changed again. The reopening is recorded in the audit log.</p>
        )}
        <ErrorNote error={error} />
        {preview.loading && !data && <Spinner />}
        {preview.error && !data && <ErrorNote error={preview.error} onRetry={preview.reload} />}

        {data && closing && (
          <>
            <ul aria-label="Checks before closing" className="space-y-3">
              {(data.checks || []).map((c) => <Check key={c.code} check={c} ticked={ticked} onTick={tick} />)}
            </ul>
            <Figures preview={data} />
            <Carried preview={data} />
            {data.canClose && left > 0 && <p role="status" className="text-sm text-status-warning">Tick {left === 1 ? "the warning" : `the ${left} warnings`} above to close the year.</p>}
          </>
        )}

        {data && !closing && (
          <>
            {data.closing?.posted ? (
              <p className="text-sm">
                Closing entry <strong>{data.closing.voucherNo}</strong> ({profitWords(data.closing.profit, data.currency)} moved to {data.closing.retainedAccountName || "Retained Earnings"}) is reversed, so the year's income and
                expense stand in the books again. The entry and its reversal stay on record.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">There is no closing entry to reverse: this year was only locked.</p>
            )}
            {data.closing?.nextYear && <p className="text-sm text-muted-foreground">{data.closing.nextYear} stays as it is{data.closing.nextYearCreated ? ", and anything posted in it is not affected" : ""}.</p>}
            <ul aria-label="Checks before reopening" className="space-y-3">
              {(data.reopen?.canReopen ? [{ code: "CAN_REOPEN", level: "ok", title: `${year.code} can be reopened` }] : data.reopen?.blockers || []).map((c) => <Check key={c.code} check={c} ticked={ticked} onTick={tick} />)}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}

