import React, { useMemo, useState } from "react";
import { Button } from "../ui/button";
import Can from "../shell/Can.jsx";
import { jobCards, filesFor } from "../../lib/garageApi";
import AttachmentPanel from "../accounting/AttachmentPanel.jsx";
import { JOB_STATUS, TASK_STATUS, INVOICE_STATUS_LABEL, garageErrorText } from "../../lib/garage";
import { useGarageMasters, CompleteTaskDialog } from "./garageShared";
import JobCardForm from "./JobCardForm";
import ClaimView from "./ClaimView";
import CheckInDialog from "./CheckInDialog";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { ConfirmDialog, ErrorNote, Field, Modal, Pill, Spinner, TextInput, useAsync } from "../accounting/kit";
import { DocLink } from "../salesDocs/parts";
import { ApprovalDialog, ReviseEstimateDialog, CreateInvoiceDialog, ReleaseDialog, RaisePurchaseOrderDialog, NewClaimDialog } from "./jobCardDialogs";
import PrintRow from "./JobCardPrint";


function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function money(n) {
  return formatCurrencyAED(Number(n) || 0);
}


export default function JobCardView({ id, onClose, onChanged, onRemoved }) {
  const one = useAsync(() => jobCards.get(id), [id]);
  const masters = useGarageMasters();
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "delete" | "sendEstimate" | "cancel"
  const [cancelReason, setCancelReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [revising, setRevising] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [openingClaim, setOpeningClaim] = useState(false);
  const [viewingClaim, setViewingClaim] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [raisingPO, setRaisingPO] = useState(false);
  const c = one.data;
  // Keyed on status too (D21): cancelling the card changes nothing about c._id, and the server's own
  // CANCELLED refusal (an empty list) would otherwise sit unseen behind a list fetched before the cancel.
  const shortages = useAsync(() => (c ? jobCards.shortages(c._id) : Promise.resolve([])), [c?._id, c?.status]);
  // The check-in's own photos, uploaded through this same door by CheckInDialog - read-only here so they
  // are visible SOMEWHERE on the card, not only inside the dialog that took them (D08: "the check-in block
  // vanishes from the screen" once the dialog that recorded it is closed).
  const checkInFiles = useMemo(() => (c?._id ? filesFor("jobcard", c._id) : null), [c?._id]);

  async function run(fn, message) {
    setBusy(true);
    setFailure(null);
    try {
      const r = await fn();
      setConfirm(null);
      onChanged(typeof message === "function" ? message(r) : message);
      await one.reload();
      return r;
    } catch (err) {
      setFailure(err);
      setConfirm(null);
      setBusy(false);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const changed = async (_r, message) => {
    setApproving(false);
    setRevising(false);
    setInvoicing(false);
    setReleasing(false);
    onChanged(message);
    await one.reload();
  };

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={c ? `Job card ${c.jobNo || "(draft)"}` : "Job card"}
      description={c ? `${c.vehicle?.plateNumber || c.vehicle?.chassisNo || ""} · ${[c.vehicle?.make, c.vehicle?.model].filter(Boolean).join(" ")} · ${c.customer?.name || ""}` : undefined}
      footer={
        c && (
          <div className="flex flex-wrap justify-end gap-2">
            {c.actions?.delete && <Can permission="garage.delete"><Button variant="outline" onClick={() => setConfirm("delete")}>Delete</Button></Can>}
            {c.actions?.checkIn && <Can permission="garage.edit"><Button variant="outline" onClick={() => setCheckingIn(true)}>Check-in</Button></Can>}
            {c.actions?.edit && <Can permission="garage.edit"><Button variant="outline" onClick={() => setEditing(true)}>Edit</Button></Can>}
            {c.actions?.cancel && <Can permission="garage.edit"><Button variant="outline" onClick={() => setConfirm("cancel")}>Cancel job</Button></Can>}
            {c.actions?.sendEstimate && <Can permission="garage.edit"><Button variant="outline" onClick={() => setConfirm("sendEstimate")}>Send estimate</Button></Can>}
            {c.actions?.recordApproval && <Can permission="garage.approve"><Button onClick={() => setApproving(true)}>Record decision</Button></Can>}
            {c.actions?.reviseEstimate && <Can permission="garage.edit"><Button variant="outline" onClick={() => setRevising(true)}>Supplementary estimate</Button></Can>}
            {c.actions?.createInvoice && <Can permission="garage.invoice"><Button onClick={() => setInvoicing(true)}>Raise invoice</Button></Can>}
            {c.actions?.release && <Can permission="garage.approve"><Button onClick={() => setReleasing(true)}>Release vehicle</Button></Can>}
          </div>
        )
      }
    >
      {one.loading && !c && <Spinner label="Loading the job card" />}
      {one.error && <ErrorNote error={one.error} onRetry={one.reload} />}
      {failure && <div className="mb-4"><ErrorNote error={new Error(garageErrorText(failure))} /></div>}
      {c && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone={JOB_STATUS[c.status]?.tone || "neutral"}>{JOB_STATUS[c.status]?.label || c.status}</Pill>
            <Pill tone="neutral">{INVOICE_STATUS_LABEL[c.invoiceStatus] || c.invoiceStatus}</Pill>
            {c.comebackOf && <Pill tone="warning">Comeback</Pill>}
            {c.promisedAt && <span className="text-xs text-muted-foreground">Promised {formatDate(c.promisedAt)}</span>}
            {c.odometerIn != null && <span className="text-xs text-muted-foreground">In at {c.odometerIn} km</span>}
          </div>

          <PrintRow card={c} />

          {c.jobType === "insurance" && (
            <Section title="Insurance claim">
              {c.claimId ? (
                <Button variant="outline" size="sm" onClick={() => setViewingClaim(true)}>View claim</Button>
              ) : (
                <Can permission="garage.create">
                  <Button variant="outline" size="sm" onClick={() => setOpeningClaim(true)}>Open insurance claim</Button>
                </Can>
              )}
            </Section>
          )}

          {(c.checkIn?.damagePoints?.length > 0 || c.checkIn?.itemsPresent?.length > 0 || c.checkIn?.notes) && (
            <Section title="The walk-around">
              {c.checkIn.itemsPresent?.length > 0 && <p className="text-sm text-muted-foreground">With them: {c.checkIn.itemsPresent.join(", ")}</p>}
              {c.checkIn.damagePoints?.length > 0 && (
                <ul className="mt-1 grid gap-1 text-sm">
                  {c.checkIn.damagePoints.map((d, i) => (
                    <li key={i}>
                      <span className="font-medium">{d.panel}</span> - {d.kind}{d.notes ? `: ${d.notes}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {c.checkIn.notes && <p className="mt-1 text-sm text-muted-foreground">{c.checkIn.notes}</p>}
              {checkInFiles && <AttachmentPanel source={checkInFiles} label="Check-in photos" readOnly className="mt-2" />}
            </Section>
          )}

          <Section title="What the customer reported">
            {c.complaints?.length ? (
              <ul className="grid gap-1.5 text-sm">
                {c.complaints.map((comp) => (
                  <li key={comp._id} className="rounded-lg border px-3 py-2">
                    <span className="font-medium">{comp.concern}</span>
                    {comp.cause && <span className="text-muted-foreground"> · {comp.cause}</span>}
                    {comp.correction && <span className="text-muted-foreground"> · {comp.correction}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Nothing recorded.</p>}
          </Section>

          <Section title="The estimate">
            {c.lines?.length ? (
              <>
                <ul className="divide-y rounded-lg border text-sm">
                  {c.lines.map((l) => {
                    // `approved === false` means two different things (D21): declined at the first
                    // decision, or a later supplementary line nobody has decided on yet - and the two
                    // are told apart ONLY where it is unambiguous: a line from the ORIGINAL estimate
                    // (addedInVersion 1) once the card has moved past AWAITING_APPROVAL can only be
                    // declined, because the first decision settles every version-1 line, true or false,
                    // with nothing left pending from it. A later-version line that is still false stays
                    // "Pending" - it may yet be decided in the next round, and nothing on the line itself
                    // says which round last looked at it.
                    const declined = l.approved === false && (l.addedInVersion || 1) <= 1 && !["DRAFT", "AWAITING_APPROVAL"].includes(c.status);
                    const label = l.invoiced ? "Invoiced" : declined ? "Declined" : l.approved === false ? "Pending" : "Approved";
                    const tone = l.invoiced ? "info" : declined ? "neutral" : l.approved === false ? "warning" : "success";
                    return (
                      <li key={l._id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate">
                          <span className="me-2 rounded bg-secondary px-1.5 py-0.5 text-xs uppercase text-muted-foreground">{l.kind}</span>
                          {l.description}
                        </span>
                        <span className="shrink-0 tabular-nums">{money(l.lineTotal)}</span>
                        <Pill tone={tone}>{label}</Pill>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-end text-sm font-medium">Total (approved): {money(c.totals?.total)}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">No lines yet. Edit the card to add parts and labour.</p>}
          </Section>

          {/* D18: a supplementary estimate (reviseEstimate) was recorded on estimateHistory with nowhere
              on screen to show it, so "teardown found more" left no visible trail of what the FIRST
              estimate had asked for. */}
          {c.estimateHistory?.length > 0 && (
            <Section title="Estimate history">
              <ul className="divide-y rounded-lg border text-sm">
                {c.estimateHistory.map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      v{h.version} - sent {h.sentAt ? formatDate(h.sentAt) : ""}
                      {h.decidedAt && <span className="text-muted-foreground"> · decided {formatDate(h.decidedAt)} ({h.method})</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{money(h.total)}</span>
                  </li>
                ))}
                {c.estimate?.version && (
                  <li className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      v{c.estimate.version} (current) - sent {c.estimate.sentAt ? formatDate(c.estimate.sentAt) : ""}
                      {c.estimate.decidedAt && <span className="text-muted-foreground"> · decided {formatDate(c.estimate.decidedAt)} ({c.estimate.method})</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{money(c.totals?.total)}</span>
                  </li>
                )}
              </ul>
            </Section>
          )}

          {shortages.data?.length > 0 && (
            <Section title="Short of stock">
              <ul className="grid gap-1.5 text-sm">
                {shortages.data.map((s) => (
                  <li key={s.itemId} className="flex items-center justify-between gap-2 rounded-lg border border-status-warning/40 bg-status-warning-soft px-3 py-2">
                    <span>
                      {s.itemName} <span className="text-muted-foreground">- short {s.short} ({s.onHand} on hand)</span>
                      {s.vendorName && <span className="ms-1 text-xs text-muted-foreground">usually from {s.vendorName}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Can permission="garage.edit">
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setRaisingPO(true)}>Raise purchase order</Button>
              </Can>
            </Section>
          )}

          {c.purchaseOrders?.length > 0 && (
            <Section title="Purchase orders raised">
              <ul className="divide-y rounded-lg border text-sm">
                {c.purchaseOrders.map((po, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{po.no} <span className="text-muted-foreground">({po.vendorName})</span></span>
                    <span className="tabular-nums">{money(po.amount)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Tasks">
            {c.tasks?.length ? (
              <ul className="grid gap-2">
                {c.tasks.map((t) => {
                  const label = TASK_STATUS[t.status] || { label: t.status, tone: "neutral" };
                  return (
                    <li key={t._id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="font-medium">{t.stage}. {t.name}</span>
                          <span className="ms-2 text-xs text-muted-foreground">{t.mode === "sublet" ? t.vendorName : t.staffName || "Unassigned"}</span>
                        </span>
                        <Pill tone={label.tone}>{label.label}</Pill>
                      </div>
                      {(t.actions?.start || t.actions?.complete) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {t.actions.start && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => jobCards.startTask(c._id, t._id), `${t.name} started.`)}>Start</Button>}
                          {t.actions.complete && <Button size="sm" onClick={() => setCompleting(t)}>Done</Button>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No tasks yet.</p>}
          </Section>

          {c.invoices?.length > 0 && (
            <Section title="Invoices">
              <ul className="divide-y rounded-lg border text-sm">
                {c.invoices.map((inv, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {/* Approved only: a draft invoice has no printable tax invoice yet, and "/sales-order?search=" opens the
                          list filtered to this number either way, so a draft still lands somewhere useful. */}
                      <DocLink kind="sales_order" no={inv.no}>{inv.no}</DocLink> <span className="text-muted-foreground">({inv.billTo})</span>
                    </span>
                    <span className="tabular-nums">{money(inv.amount)}</span>
                    <Pill tone={inv.status === "APPROVED" ? "success" : "warning"}>{inv.status}</Pill>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {c.delivery?.gatePassAt && (
            <Section title="Delivery">
              <p className="text-sm text-muted-foreground">
                Released {formatDate(c.delivery.gatePassAt)}{c.delivery.handedTo ? ` to ${c.delivery.handedTo}` : ""}
                {c.warranty?.until ? ` · warranty until ${formatDate(c.warranty.until)}` : ""}
              </p>
            </Section>
          )}

          {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
        </div>
      )}

      {confirm === "delete" && (
        <ConfirmDialog title="Delete this draft?" text="Nothing has moved. It is deleted for good." confirmLabel="Delete" danger busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => jobCards.remove(c._id), "Job card deleted.").then(() => onRemoved("Job card deleted."))} />
      )}
      {confirm === "sendEstimate" && (
        <ConfirmDialog title="Send the estimate?" text="The card moves to waiting for approval." confirmLabel="Send" busy={busy}
          onClose={() => setConfirm(null)} onConfirm={() => run(() => jobCards.sendEstimate(c._id), "Estimate sent.")} />
      )}
      {confirm === "cancel" && (
        <Modal size="sm" onClose={() => setConfirm(null)} title={`Cancel ${c?.jobNo || "this job"}?`}
          footer={<><Button variant="outline" onClick={() => setConfirm(null)}>Back</Button><Button variant="destructive" disabled={busy || !cancelReason.trim()} onClick={() => run(() => jobCards.cancel(c._id, { reason: cancelReason }), "Job card cancelled.")}>{busy ? "Cancelling…" : "Cancel job"}</Button></>}
        >
          <Field label="Why" required><TextInput value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus /></Field>
        </Modal>
      )}
      {editing && <JobCardForm jobCard={c} onClose={() => setEditing(false)} onSaved={(r, m) => { setEditing(false); changed(r, m); }} />}
      {checkingIn && <CheckInDialog jobCardId={c._id} checkIn={c.checkIn} onClose={() => setCheckingIn(false)} onDone={(r, m) => { setCheckingIn(false); changed(r, m); }} />}
      {approving && <ApprovalDialog card={c} onClose={() => setApproving(false)} onDone={changed} />}
      {revising && <ReviseEstimateDialog card={c} masters={masters} onClose={() => setRevising(false)} onDone={changed} />}
      {invoicing && <CreateInvoiceDialog card={c} onClose={() => setInvoicing(false)} onDone={changed} />}
      {releasing && <ReleaseDialog card={c} onClose={() => setReleasing(false)} onDone={changed} />}
      {raisingPO && (
        <RaisePurchaseOrderDialog
          cardId={c._id}
          shortages={shortages.data || []}
          masters={masters}
          onClose={() => setRaisingPO(false)}
          onDone={async (_r, m) => { setRaisingPO(false); onChanged(m); await one.reload(); await shortages.reload(); }}
        />
      )}
      {completing && (
        <CompleteTaskDialog
          jobCardId={c._id}
          task={completing}
          onClose={() => setCompleting(null)}
          onDone={async (m) => { setCompleting(null); onChanged(m); await one.reload(); }}
        />
      )}
      {openingClaim && (
        <NewClaimDialog
          jobCardId={c._id}
          masters={masters}
          onClose={() => setOpeningClaim(false)}
          onDone={async (_claim, m) => { setOpeningClaim(false); onChanged(m); await one.reload(); }}
        />
      )}
      {viewingClaim && (
        <ClaimView
          id={c.claimId}
          onClose={() => setViewingClaim(false)}
          onChanged={onChanged}
          onRemoved={async (m) => { setViewingClaim(false); onChanged(m); await one.reload(); }}
        />
      )}
    </Modal>
  );
}
