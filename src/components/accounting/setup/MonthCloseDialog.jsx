import React, { useState } from "react";
import { accounting } from "../../../lib/accountingApi";
import { closedToast, reopenedToast } from "../../../lib/periodClose";
import { acknowledged, canConfirm, outstanding } from "../../../lib/yearEnd";
import { formatDate } from "../../../utils/format";
import { Button } from "../../ui/button";
import { ErrorNote, Modal, Spinner, useAsync } from "../kit";
import StockAgainstLedger from "./StockAgainstLedger";
import { Check } from "./YearEndDialog";

// Closing or reopening one month of an open fiscal year (services/financial/periodCloseService.js decides; this only shows
// it). The dialog reads what would happen before it asks, lists everything that stands in the way, and makes the person
// tick each warning by name - the same way closing a year does, because a month close is the same kind of decision: it
// posts nothing, it locks every branch's dates up to the month end until the month is reopened.

// `mode` is "close", "reopen" or "preview" - looking at what closing this month would check,
// without closing it (F14, finance QA review 1 Nov 2026: the Close button, and so the checklist,
// used to be offered only on the single next month in line to close).
export default function MonthCloseDialog({ year, month, mode, onClose, onDone }) {
  const closing = mode === "close";
  const reopening = mode === "reopen";
  const previewOnly = mode === "preview";
  const preview = useAsync(() => accounting.monthEnd(year._id, month.key), [year._id, month.key]);
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
        const out = await accounting.closeMonth(year._id, month.key, { acknowledge: acknowledged(ticked) });
        onDone(closedToast(month.label, out?.year?.lockedThrough || month.endDay));
      } else {
        const out = await accounting.reopenMonth(year._id, month.key);
        onDone(reopenedToast(month.label, out?.year?.lockedThrough));
      }
    } catch (e) {
      setError(e);
      setBusy(false);
      preview.reload(); // what stood in the way may have changed
    }
  }

  const ready = closing ? canConfirm(data, ticked) : reopening ? Boolean(data?.reopen?.canReopen) : false;
  const left = closing ? outstanding(data, ticked).length : 0;

  return (
    <Modal
      dirty={false} // the ticks beside the warnings are a decision to act, not unsaved work
      size="md" title={closing ? `Close ${month.label}?` : reopening ? `Reopen ${month.label}?` : `${month.label} checklist`}
      description={`${formatDate(month.startDay)} to ${formatDate(month.endDay)}`} onClose={onClose}
      footer={
        previewOnly ? (
          <Button type="button" onClick={onClose} data-autofocus>Done</Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" variant={closing ? "destructive" : "default"} disabled={!ready || busy} onClick={confirm}>
              {busy ? "Working…" : closing ? "Close month" : "Reopen month"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {closing ? (
          <p className="text-sm text-muted-foreground">
            Nothing dated on or before {formatDate(month.endDay)} can be created, approved, edited, deleted or reversed, in any branch, until the month is reopened.
            Closing a month posts nothing and moves no profit: that happens when the year is closed.
          </p>
        ) : reopening ? (
          <p className="text-sm text-muted-foreground">Documents dated in this month can be changed again. The reopening is recorded in the audit log.</p>
        ) : (
          <p className="text-sm text-muted-foreground">What closing {month.label} would check. Nothing here closes or changes anything.</p>
        )}
        <ErrorNote error={error} />
        {preview.loading && !data && <Spinner />}
        {preview.error && !data && <ErrorNote error={preview.error} onRetry={preview.reload} />}

        {data && (closing || previewOnly) && (
          <>
            <ul aria-label="Checks before closing" className="space-y-3">
              {(data.checks || []).map((c) => <Check key={c.code} check={c} ticked={ticked} onTick={tick} readOnly={previewOnly} />)}
            </ul>
            <StockAgainstLedger stock={data.stock} currency={data.currency} />
            {!previewOnly && data.canClose && left > 0 && <p role="status" className="text-sm text-status-warning">Tick {left === 1 ? "the warning" : `the ${left} warnings`} above to close the month.</p>}
          </>
        )}

        {data && reopening && (
          <ul aria-label="Checks before reopening" className="space-y-3">
            {(data.reopen?.canReopen ? [{ code: "CAN_REOPEN", level: "ok", title: `${month.label} can be reopened` }] : data.reopen?.blockers || []).map((c) => <Check key={c.code} check={c} ticked={ticked} onTick={tick} />)}
          </ul>
        )}
      </div>
    </Modal>
  );
}
