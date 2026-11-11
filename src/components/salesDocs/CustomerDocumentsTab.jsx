import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CircleDot, Minus, X } from "lucide-react";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { ConfirmDialog, EmptyState, ErrorNote, Pill, Spinner, useAsync, useToasts } from "../accounting/kit";
import { documentFlow, orderClose } from "../../lib/salesDocumentsApi";
import { CLOCK_TONE, clockText } from "../../lib/salesDocuments";
import { FLOW_FILTERS, STAGE_LABEL, STAGE_TONE, canCloseShort, canReopenShort, dealGroup, paymentPill, sendPill, dealSteps, dealTitle, defaultFilter, filterDeals, flowCounts, leftText, nextAction } from "../../lib/documentFlow";
import { formatDate, formatNumber, CURRENCY } from "../../utils/format";
import { cn } from "../../lib/utils";
import { Note, PillTabs } from "./parts";
import CloseShortDialog from "./CloseShortDialog";
import { useDocumentAction } from "./hooks";
import { useOrganisation } from "../shell/OrganisationContext";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { isTaxInvoice } from "../PurchaseOrder/shared/invoiceDocuments";

// One customer's deals, each as a stepper from the offer to the invoice, with the one thing to do next.
// The server joins the documents (GET /document-flow/customer/:id); lib/documentFlow.js decides how a deal
// reads. Opens on the deals that need someone, because a customer with forty old deals is not the point.

// A step's word and its marker. Colour is never alone: every state has its own icon and its own word.
const STATE = {
  done: { word: "Done", Icon: Check, bar: "border-status-success", marker: "bg-status-success-soft text-status-success" },
  doing: { word: "In hand", Icon: CircleDot, bar: "border-status-info", marker: "bg-status-info-soft text-status-info" },
  stopped: { word: "Ended", Icon: X, bar: "border-status-danger", marker: "bg-status-danger-soft text-status-danger" },
  todo: { word: "To come", Icon: null, bar: "border-border", marker: "border border-dashed border-border text-muted-foreground" },
  none: { word: "", Icon: Minus, bar: "border-border/60", marker: "text-muted-foreground" },
};

function Step({ step }) {
  const s = STATE[step.state];
  const Icon = s.Icon;
  return (
    <li
      aria-current={step.current ? "step" : undefined}
      className={cn("min-w-0 border-s-2 pb-4 ps-3 last:pb-0 md:border-s-0 md:border-t-2 md:pb-0 md:pe-1 md:ps-0 md:pt-3", s.bar)}
    >
      <div className="flex items-center gap-2">
        <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full", s.marker)} aria-hidden="true">
          {Icon && <Icon className="h-3 w-3" />}
        </span>
        <span className={cn("text-sm", step.current ? "font-semibold text-foreground" : "font-medium text-foreground")}>{step.label}</span>
        {s.word && <span className="text-xs text-muted-foreground">{s.word}</span>}
      </div>
      <div className="mt-1.5 space-y-1.5 md:ps-7">
        {step.docs.map((d) => {
          // A document whose feature the organisation no longer has is still SHOWN - it exists, and hiding it
          // would be a lie about this customer's history - but it is not a link, because the screen behind it
          // answers "not included in your plan" (lib/documentFlow.js gives `to: null`).
          const body = (
            <>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-xs font-semibold text-foreground">{d.no}</span>
                <Pill tone={d.tone}>{d.status}</Pill>
              </span>
              {d.meta && <span className="mt-0.5 block text-xs text-muted-foreground">{d.meta}</span>}
            </>
          );
          const box = "block rounded-lg border border-border bg-background px-2.5 py-1.5";
          return d.to ? (
            <Link key={`${d.kind}-${d.no}`} to={d.to} className={cn(box, "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>{body}</Link>
          ) : (
            <div key={`${d.kind}-${d.no}`} className={box}>{body}</div>
          );
        })}
        {!step.docs.length && step.hint && <p className="text-xs text-muted-foreground">{step.hint}</p>}
        {step.docs.length > 0 && step.hint && <p className="text-xs text-muted-foreground">{step.hint}</p>}
      </div>
    </li>
  );
}

function Deal({ deal, notify, reload, opts }) {
  const [dialog, setDialog] = useState(null); // "close" | "reopen"
  const action = useDocumentAction({ notify, reload });
  const title = dealTitle(deal, opts);
  const steps = dealSteps(deal, opts);
  const next = nextAction(deal, Date.now(), opts);
  const pill = sendPill(deal, Date.now(), opts);
  const money = paymentPill(deal);
  const group = dealGroup(deal, Date.now(), opts);
  // literal class names: Tailwind only builds the ones it can read
  const grid = steps.length === 5 ? "md:grid-cols-5" : steps.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3";
  const cs = deal.closeShort;
  const offerClose = canCloseShort(deal);
  const closeDialog = () => {
    setDialog(null);
    action.clear();
  };
  return (
    <article aria-label={`${title.kind} ${title.no}`} className="rounded-xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title.kind}</p>
          <p className="font-mono text-sm font-semibold text-foreground">{title.no}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {deal.invoiceClock && <Pill tone={CLOCK_TONE[deal.invoiceClock.clock]} className="whitespace-normal text-start">{clockText(deal.invoiceClock)}</Pill>}
          {deal.expiresInDays !== null && deal.expiresInDays !== undefined && (
            <Pill tone="warning">Offer expires {deal.expiresInDays === 0 ? "today" : `in ${deal.expiresInDays} day${deal.expiresInDays === 1 ? "" : "s"}`}</Pill>
          )}
          {pill && <Pill tone={pill.tone}>{pill.text}</Pill>}
          {cs && <Pill tone="warning">Closed short</Pill>}
          <Pill tone={STAGE_TONE[deal.stage]}>{STAGE_LABEL[deal.stage]}</Pill>
          {money && <Pill tone={money.tone}>{money.text}</Pill>}
          <span className="text-sm font-semibold tabular-nums text-foreground">{formatNumber(deal.amount, 2)} <span className="text-xs font-normal text-muted-foreground">{CURRENCY}</span></span>
        </div>
      </header>
      <ol className={cn("grid px-4 py-4 sm:px-5 md:gap-4", grid)} aria-label="Steps of this deal">
        {steps.map((s) => <Step key={s.key} step={s} />)}
      </ol>
      {cs && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
          <Note className="min-w-0 flex-1">
            Closed short on {formatDate(cs.at)}: {leftText(cs.left)} will not be delivered. Reason: {cs.reason}.
            {cs.trimmed ? " The order was cut down to what was delivered." : " The invoice was not changed."}
          </Note>
          {canReopenShort(deal) && <Button size="sm" variant="outline" onClick={() => setDialog("reopen")}>Reopen</Button>}
        </div>
      )}
      {(next || offerClose) && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/40 px-4 py-3 sm:px-5">
          <p className="min-w-0 text-sm text-muted-foreground">{next && <><span className="font-medium text-foreground">Next:</span> {next.why}</>}</p>
          <div className="flex flex-wrap items-center gap-2">
            {offerClose && <Button size="sm" variant="outline" onClick={() => setDialog("close")}>Close order short</Button>}
            {next?.to && (
              <Button asChild size="sm" variant={group === "action" ? "default" : "outline"}>
                <Link to={next.to}>{next.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </Button>
            )}
          </div>
        </footer>
      )}
      {dialog === "close" && (
        <CloseShortDialog
          orderId={deal.order._id} orderNo={deal.order.transactionNo} busy={action.busy} problem={action.problem} onClose={closeDialog}
          onConfirm={async (body) => {
            const done = await action.run(() => orderClose.closeShort(deal.order._id, body), `${deal.order.transactionNo} closed short`);
            if (done) setDialog(null);
          }}
        />
      )}
      {dialog === "reopen" && (
        <ConfirmDialog
          title={`Reopen ${deal.order.transactionNo}`} confirmLabel="Reopen order" busy={action.busy} onClose={closeDialog}
          text={cs?.trimmed ? "The order goes back to the quantities it had before it was closed short, and what is left can be delivered again." : "The order is open again, and what is left can be delivered."}
          onConfirm={async () => {
            const done = await action.run(() => orderClose.reopen(deal.order._id), `${deal.order.transactionNo} reopened`);
            if (done) setDialog(null);
          }}
        />
      )}
    </article>
  );
}

export default function CustomerDocumentsTab({ customerId }) {
  const { data, loading, error, reload } = useAsync(() => documentFlow.customer(customerId), [customerId]);
  const { notify, toastNode } = useToasts();
  const { mayUse, featureOn } = useOrganisation();
  const company = useCompanyProfile();
  // What this organisation and this person can do, worked out once and handed to every pure rule, so the
  // steps, the next action and the counts cannot disagree with each other (lib/documentFlow.js).
  //   canSend      "Send the invoice" is an ACTION: it needs the role AND the Send documents feature
  //   taxInvoice   "Tax invoice" is a claim about OUR registration, and this list cannot see the company
  const opts = useMemo(
    () => ({
      canSend: mayUse("sales.send", "messaging"),
      deliveryNotes: featureOn("deliveryNotes"),
      quotations: featureOn("quotations"),
      taxInvoice: isTaxInvoice(company),
    }),
    [mayUse, featureOn, company]
  );
  const [filter, setFilter] = useState(null); // null until the person chooses: then the default decides
  const chains = useMemo(() => data?.chains || [], [data]);
  const counts = useMemo(() => flowCounts(chains, opts), [chains, opts]);

  if (loading && !data) return <div className="py-10"><Spinner label="Loading documents" /></div>;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const s = data.summary;
  const active = filter ?? defaultFilter(counts);
  const shown = filterDeals(chains, active, opts);
  const amount = (x) => formatNumber(x.value, 2);

  return (
    <div className="space-y-5">
      {toastNode}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Out with the customer" count={amount(s.outWithCustomer)} subText={`${s.outWithCustomer.count} offer${s.outWithCustomer.count === 1 ? "" : "s"} still valid`} tone="teal" />
        <StatCard title="Accepted, not ordered" count={amount(s.acceptedNotOrdered)} subText={`${s.acceptedNotOrdered.count} waiting to be converted`} tone="plum" />
        <StatCard title="Orders to approve" count={amount(s.ordersToApprove)} subText={`${s.ordersToApprove.count} draft${s.ordersToApprove.count === 1 ? "" : "s"}, not yet invoiced`} tone="olive" />
        <StatCard
          title="Delivered, not invoiced" count={amount(s.deliveredNotInvoiced)} tone={s.pastInvoiceWindow ? "danger" : s.deliveredNotInvoiced.count ? "warning" : "neutral"}
          subText={s.pastInvoiceWindow ? `${s.pastInvoiceWindow} past the 14-day window` : `${s.deliveredNotInvoiced.count} note${s.deliveredNotInvoiced.count === 1 ? "" : "s"} waiting for an invoice`}
        />
      </div>

      {data.truncated && <Note tone="warning">Only the latest documents are listed. Older quotations, orders and delivery notes are not shown here.</Note>}

      {chains.length === 0 ? (
        <EmptyState
          title={opts.quotations ? "No quotations, orders or delivery notes yet" : "No orders or invoices yet"}
          text={opts.quotations
            ? "Start with a quotation. It can become the order, the delivery and the invoice, and the whole story shows here."
            : "Start with a sales order. It becomes the invoice, and the whole story shows here."}
          action={opts.quotations ? <Button asChild><Link to="/quotations">New quotation</Link></Button> : null}
        />
      ) : (
        <>
          <PillTabs tabs={FLOW_FILTERS} value={active} counts={counts} label="Deals" onChange={setFilter} />
          {shown.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              {active === "action" ? "Nothing needs doing for this customer." : "No deals here."}
            </p>
          ) : (
            <div className="space-y-4">{shown.map((d) => <Deal key={d.key} deal={d} notify={notify} reload={reload} opts={opts} />)}</div>
          )}
        </>
      )}
    </div>
  );
}
