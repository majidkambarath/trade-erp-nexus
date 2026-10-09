import React, { useState } from "react";
import { Button } from "../ui/button";
import { ConfirmDialog, EmptyState, ErrorNote, Modal, Spinner, errorMessage, useAsync } from "../accounting/kit";
import { documentSends } from "../../lib/sendDocumentsApi";
import { useOrganisation } from "../shell/OrganisationContext";
import { formatDateTime } from "../../utils/format";
import { NEXT_STEP, SendStatusPill, sendStateOf } from "./shared";

// Every time a document went to a customer: who, to whom, when, and what became of it. A timeline, not a
// table, because a table inside a dialog cannot scroll sideways and these rows are long. The one thing a
// person can undo is here: a link sent to the wrong address can be withdrawn, and from then on it opens
// a page saying so.
function linkState(share) {
  if (!share) return null;
  if (share.revokedAt) return { text: "Link withdrawn", tone: "danger", withdrawn: true };
  if (new Date(share.expiresAt) <= new Date()) return { text: `Link expired ${formatDateTime(share.expiresAt)}`, tone: "muted", withdrawn: true };
  return { text: `Link works until ${formatDateTime(share.expiresAt)}`, tone: "muted", withdrawn: false };
}

export default function SendHistory({ sourceType, sourceId, title, notify, onClose, onChanged }) {
  const { canAny } = useOrganisation();
  const maySend = canAny("sales.send"); // the history is for whoever can see the document; trying again and withdrawing a link need sales.send
  const list = useAsync(() => documentSends.history(sourceType, sourceId), [sourceType, sourceId]);
  const [withdrawing, setWithdrawing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const rows = list.data?.rows || [];

  const act = async (fn, message) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      notify?.(message);
      await list.reload();
      return true;
    } catch (e) {
      setProblem(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const retry = async (row) => {
    if (await act(() => documentSends.retry(row._id), "Emailed on a retry")) onChanged?.();
  };

  return (
    <>
      <Modal size="lg" title={`Send history, ${title}`} description="Each time this went to a customer, newest first." onClose={onClose}
        footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
        <div className="space-y-4">
          <ErrorNote error={problem ? new Error(errorMessage(problem)) : null} />
          {list.loading && !list.data && <Spinner label="Loading the history" />}
          {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
          {list.data && rows.length === 0 && <EmptyState title="Not sent yet" text="Nothing has gone to the customer from here." />}
          <ol className="space-y-3">
            {rows.map((r) => {
              const state = sendStateOf({ status: r.status, openedAt: r.openedAt, provider: r.provider });
              const link = linkState(r.share);
              const where = r.channel === "whatsapp" ? `WhatsApp +${r.phone}` : (r.to || []).join(", ");
              return (
                <li key={r._id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SendStatusPill send={{ status: r.status, openedAt: r.openedAt }} />
                    <span className="text-sm font-medium text-foreground">{where}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(r.sentAt || r.failedAt || r.createdAt)} by {r.sentByName || "someone"}
                    {r.attachment?.fileName ? ` · ${r.attachment.fileName}` : ""}
                    {r.attempts > 1 ? ` · ${r.attempts} attempts` : ""}
                  </p>
                  {r.status === "FAILED" && r.lastError && <p className="mt-1.5 text-sm text-status-danger">{r.lastError}</p>}
                  {r.status === "FAILED" && r.nextRetryAt && <p className="mt-1 text-xs text-muted-foreground">It will try again automatically at {formatDateTime(r.nextRetryAt)}.</p>}
                  <p className="mt-1.5 text-xs text-muted-foreground">{NEXT_STEP[state]}</p>
                  {r.share && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {link.text}
                      {r.share.viewCount ? ` · opened ${r.share.viewCount} time${r.share.viewCount === 1 ? "" : "s"}, first ${formatDateTime(r.share.firstViewedAt)}` : ""}
                    </p>
                  )}
                  {maySend && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.status === "FAILED" && r.retryable && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => retry(r)}>Try again now</Button>
                      )}
                      {r.share && !link.withdrawn && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setWithdrawing(r)}>Withdraw link</Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </Modal>

      {withdrawing && (
        <ConfirmDialog
          title="Withdraw this link?" confirmLabel="Withdraw link" danger busy={busy} onClose={() => setWithdrawing(null)}
          text="Anyone who opens it from now on sees a page saying it was withdrawn. The email itself cannot be taken back, and a PDF already attached stays with the customer."
          onConfirm={async () => {
            const ok = await act(() => documentSends.withdraw(withdrawing.share._id || withdrawing.shareLinkId, "Withdrawn from the send history"), "The link was withdrawn");
            if (ok) setWithdrawing(null);
          }}
        />
      )}
    </>
  );
}
