import React, { useMemo, useState } from "react";
import { ArrowLeft, History } from "lucide-react";
import { Button } from "../ui/button";
import { jobCards, filesFor } from "../../lib/garageApi";
import { JOB_STATUS, INVOICE_STATUS_LABEL, JOB_TABS, defaultJobTab, garageErrorText } from "../../lib/garage";
import { useGarageMasters, CompleteTaskDialog } from "./garageShared";
import JobCardForm from "./JobCardForm";
import ClaimView from "./ClaimView";
import CheckInDialog from "./CheckInDialog";
import { formatDate } from "../../utils/format";
import { ConfirmDialog, ErrorNote, Field, Modal, PageSpinner, Pill, TextInput, useAsync } from "../accounting/kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { JobTab, EstimateTab, WorkTab, MoneyTab } from "./jobCardTabs";
import JobCardActions from "./JobCardActions";
import { ApprovalDialog, ReviseEstimateDialog, CreateInvoiceDialog, ReleaseDialog, RaisePurchaseOrderDialog, NewClaimDialog } from "./jobCardDialogs";
import PrintRow from "./JobCardPrint";
import { SimpleActivityTrail } from "../audit/AuditTrail.jsx";
import { useDocumentTitle } from "../../lib/useRecordRoute";

// The job card's own page ("?open=<id>" on /garage/job-cards; GarageBoard's cards and a vehicle's job
// history both link here the same way). Used to be a Modal with thirteen sections in one scroll and a
// nine-button footer - replaced with a persistent header (status, the progress the board already shows,
// Print), four tabs for the sections, and one primary action plus a "More actions" menu for the rest.
//
// `onClose` means "go back to the list" and `onChanged` means "the list may need to refetch". `notify` is
// the CALLER's own useToasts() (GoodsReceivedPage.jsx is the house precedent: one toast system at the top
// of the page, passed down, never a second one owned by the detail it shows) - this view calls it itself
// rather than carrying a message on `onChanged`, which is why that prop now takes none.
export default function JobCardView({ id, notify, onClose, onChanged, onRemoved }) {
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
  const [showActivity, setShowActivity] = useState(false);
  const c = one.data;
  const shortages = useAsync(() => (c ? jobCards.shortages(c._id) : Promise.resolve([])), [c?._id, c?.status]);
  const checkInFiles = useMemo(() => (c?._id ? filesFor("jobcard", c._id) : null), [c?._id]);
  useDocumentTitle(c ? `${c.jobNo || "Job card"} · Job cards` : null);

  async function run(fn, message) {
    setBusy(true);
    setFailure(null);
    try {
      const r = await fn();
      setConfirm(null);
      notify(typeof message === "function" ? message(r) : message);
      onChanged();
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
    notify(message);
    onChanged();
    await one.reload();
  };

  // Dispatches a key from the primary button or the overflow menu (JobCardActions.jsx) to the same state
  // this view has always used to open its own dialogs - the hierarchy changed, not what each one does.
  function onAction(key) {
    if (key === "delete") setConfirm("delete");
    else if (key === "sendEstimate") setConfirm("sendEstimate");
    else if (key === "cancel") setConfirm("cancel");
    else if (key === "checkIn") setCheckingIn(true);
    else if (key === "edit") setEditing(true);
    else if (key === "recordApproval") setApproving(true);
    else if (key === "reviseEstimate") setRevising(true);
    else if (key === "createInvoice") setInvoicing(true);
    else if (key === "release") setReleasing(true);
  }

  if (one.loading && !c) return <PageSpinner label="Loading the job card" />;
  if (one.error) return <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8"><ErrorNote error={one.error} onRetry={one.reload} /></div>;
  if (!c) return null;

  const shortageCount = shortages.data?.length || 0;

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onClose} className="-ms-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:min-h-0">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Job cards
        </button>
        <JobCardActions card={c} onAction={onAction} />
      </div>

      <h1 className="text-2xl font-semibold text-foreground">{c.jobNo || "(draft)"}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {c.vehicle?.plateNumber || c.vehicle?.chassisNo || ""} · {[c.vehicle?.make, c.vehicle?.model].filter(Boolean).join(" ")} · {c.customer?.name || ""}
      </p>

      {failure && <div className="mb-4"><ErrorNote error={new Error(garageErrorText(failure))} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Pill tone={JOB_STATUS[c.status]?.tone || "neutral"}>{JOB_STATUS[c.status]?.label || c.status}</Pill>
        <Pill tone="neutral">{INVOICE_STATUS_LABEL[c.invoiceStatus] || c.invoiceStatus}</Pill>
        {c.comebackOf && <Pill tone="warning">Comeback</Pill>}
        {c.promisedAt && <span className="text-xs text-muted-foreground">Promised {formatDate(c.promisedAt)}</span>}
        {c.odometerIn != null && <span className="text-xs text-muted-foreground">In at {c.odometerIn} km</span>}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <PrintRow card={c} />
        {/* Not one of jobOverflowActions's status-driven actions (it is always available, never gated
            by card.actions) - a plain button beside Print, the same "secondary, always there" weight. */}
        <Button type="button" variant="outline" size="sm" onClick={() => setShowActivity(true)}>
          <History className="me-1 h-3.5 w-3.5" aria-hidden="true" /> Audit trail
        </Button>
      </div>

      {shortageCount > 0 && (
        <p className="mb-4 rounded-lg border border-status-warning/40 bg-status-warning-soft px-3 py-2 text-sm text-status-warning">
          {shortageCount} part{shortageCount === 1 ? "" : "s"} short of stock - see The work.
        </p>
      )}

      <Tabs defaultValue={defaultJobTab(c.status)}>
        <TabsList aria-label="Job card">
          {JOB_TABS.map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
              {key === "work" && shortageCount > 0 && (
                <>
                  {" "}
                  <span className="ms-1.5 rounded-full bg-status-warning-soft px-1.5 text-xs tabular-nums text-status-warning">({shortageCount})</span>
                </>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="job"><JobTab card={c} checkInFiles={checkInFiles} /></TabsContent>
        <TabsContent value="estimate"><EstimateTab card={c} /></TabsContent>
        <TabsContent value="work">
          <WorkTab
            card={c}
            shortages={shortages.data}
            busy={busy}
            onStartTask={(t) => run(() => jobCards.startTask(c._id, t._id), `${t.name} started.`)}
            onCompleteTask={setCompleting}
            onRaisePO={() => setRaisingPO(true)}
          />
        </TabsContent>
        <TabsContent value="money">
          <MoneyTab card={c} onViewClaim={() => setViewingClaim(true)} onOpenClaim={() => setOpeningClaim(true)} />
        </TabsContent>
      </Tabs>

      {confirm === "delete" && (
        <ConfirmDialog title="Delete this draft?" text="Nothing has moved. It is deleted for good." confirmLabel="Delete" danger busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => run(() => jobCards.remove(c._id), "Job card deleted.").then((r) => { if (r) onRemoved(); })} />
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
          onDone={async (_r, m) => { setRaisingPO(false); notify(m); onChanged(); await one.reload(); await shortages.reload(); }}
        />
      )}
      {completing && (
        <CompleteTaskDialog
          jobCardId={c._id}
          task={completing}
          onClose={() => setCompleting(null)}
          onDone={async (m) => { setCompleting(null); notify(m); onChanged(); await one.reload(); }}
        />
      )}
      {openingClaim && (
        <NewClaimDialog
          jobCardId={c._id}
          masters={masters}
          onClose={() => setOpeningClaim(false)}
          onDone={async (_claim, m) => { setOpeningClaim(false); notify(m); onChanged(); await one.reload(); }}
        />
      )}
      {viewingClaim && (
        <ClaimView
          id={c.claimId}
          onClose={() => setViewingClaim(false)}
          onChanged={async (m) => { notify(m); onChanged(); await one.reload(); }}
          onRemoved={async (m) => { setViewingClaim(false); notify(m); onChanged(); await one.reload(); }}
        />
      )}
      {showActivity && (
        <SimpleActivityTrail
          title={`Audit trail${c.jobNo ? ` - ${c.jobNo}` : ""}`}
          description="Saving, check-in, estimate decisions, tasks, invoicing and release - who did it and when."
          fetch={jobCards.activity}
          id={id}
          onClose={() => setShowActivity(false)}
        />
      )}
    </div>
  );
}
