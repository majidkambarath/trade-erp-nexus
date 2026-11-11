import React, { useMemo, useState } from "react";
import { Check, Pencil, RefreshCw, Send, ClipboardList, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import InvoiceScreen from "../PurchaseOrder/shared/InvoiceScreen";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { DateInput, ErrorNote, Field, Panel, Spinner, Textarea, TextInput, useAsync } from "../accounting/kit";
import RowMenu from "../lists/RowMenu";
import { quotations } from "../../lib/salesDocumentsApi";
import { expiresSoon, lineageOf, statusLabel, validityText } from "../../lib/salesDocuments";
import { todayInput, formatDate } from "../../utils/format";
import { buildQuotationDocument } from "./documents";
import { ActionModal, ActivityList, DocLink, Note } from "./parts";
import { useDocumentAction } from "./hooks";
import { useOrganisation } from "../shell/OrganisationContext";
import { quotationActions } from "../../lib/salesDocuments";
import { orgCurrency } from "../../utils/orgLocale";
import { useDocumentTitle } from "../../lib/useRecordRoute";
import { PRODUCT_NAME } from "../../config/product";

const TB = "inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 lg:h-10";
const PRIMARY = "erp-btn-primary";
const ITEM = "w-full px-3 py-2 text-left text-sm hover:bg-secondary";

// The dialog each action opens (`edit` is the only one that leaves for the form instead).
const DIALOG = { send: "send", accept: "accept", convertToOrder: "order", convert: "convert", deliveryNote: "delivery", reject: "reject", revise: "revise", delete: "delete" };
const ICON = { edit: Pencil, send: Send, accept: Check, convertToOrder: ClipboardList, convert: ShoppingCart, deliveryNote: Truck, revise: RefreshCw, reject: X, delete: Trash2 };

// One quotation: the page the customer gets, the actions that move it along, and what has happened to it.
// Which actions exist comes from the server (q.actions), so a rule is decided in one place.
export default function QuotationView({ id, onBack, onEdit, onOpenQuotation, onChanged, notify }) {
  const { me, featureOn } = useOrganisation();
  const company = useCompanyProfile();
  const currency = orgCurrency();
  const { data: q, loading, error, reload } = useAsync(() => quotations.get(id), [id]);
  const activity = useAsync(() => quotations.activity(id), [id]);
  useDocumentTitle(q ? `${q.quotationNo} · Quotations · ${PRODUCT_NAME}` : null);
  const [dialog, setDialog] = useState(null); // send | accept | reject | order | convert | delivery | revise | delete
  const [form, setForm] = useState({ acceptedBy: "", reason: "", date: todayInput(), expectedDate: "", deliveryAddress: "" });

  const refresh = async () => {
    await Promise.all([reload(), activity.reload()]);
    onChanged?.();
  };
  const action = useDocumentAction({ notify, reload: refresh });
  const open = (name) => { setForm({ acceptedBy: "", reason: "", date: todayInput(), expectedDate: "", deliveryAddress: "" }); action.clear(); setDialog(name); };
  const close = () => { setDialog(null); action.clear(); };

  const doc = useMemo(() => (q ? buildQuotationDocument(q, q.party || {}, company, currency) : null), [q, company, currency]);

  if (loading && !q) return <div className="p-8"><Spinner label="Loading quotation" /></div>;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorNote error={error} onRetry={reload} /></div>;
  if (!q) return null;

  // One loud button for the step the offer is waiting for, everything else behind "More actions" - the
  // six-button row (Accept, two conversions, a delivery note, Reject, Revise, beside the copy toggle and
  // the print buttons InvoiceScreen adds) read as a wall and wrapped to several lines on a phone.
  // "Create delivery note" is drawn only where the organisation HOLDS delivery notes: it used to ride on
  // `convert`, the invoice's own flag, so an organisation without the feature was offered a document it
  // cannot have (and the server now refuses).
  const { primary, overflow } = quotationActions(q, me, { deliveryNotes: featureOn("deliveryNotes") });
  const finish = async (promise, message, after) => {
    // an action that leaves this screen (a delete, a revision) has nothing here left to refresh
    const out = await action.run(() => promise(), message, { refresh: !after });
    if (out) { close(); after?.(out); }
  };

  const run = (key) => (key === "edit" ? onEdit(q._id) : open(DIALOG[key]));
  const PrimaryIcon = primary ? ICON[primary.key] : null;

  const actions = !primary && !overflow.length ? null : (
    <>
      {primary && (
        <button type="button" onClick={() => run(primary.key)} className={PRIMARY}>
          <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
          {primary.label}
        </button>
      )}
      {overflow.length > 0 && (
        <RowMenu label="More actions" buttonText="More actions" buttonClassName={TB} menuClassName="w-56 rounded-2xl border border-border bg-card py-1 shadow-lg">
          {overflow.map((a) => (
            <button key={a.key} type="button" onClick={() => run(a.key)} className={`${ITEM} ${a.danger ? "text-destructive" : "text-muted-foreground"}`}>
              {a.label}
            </button>
          ))}
        </RowMenu>
      )}
    </>
  );

  const lineage = lineageOf(q);
  const banner = (
    <div className="space-y-2">
      {q.expired && (
        <Note tone="warning">
          This offer ran out on {formatDate(q.validUntil)}, so it can no longer be accepted or converted. Revise it to offer it again at today's prices.
        </Note>
      )}
      {!q.expired && expiresSoon(q) && <Note tone="warning">{validityText(q)}. If the customer is still deciding, now is the time to call.</Note>}
      {lineage.map((l) => (
        <Note key={l.text}>
          {l.text.split(" ").slice(0, -1).join(" ")}{" "}
          <DocLink kind={l.kind} id={l.id} no={l.text.split(" ").pop()} onOpenQuotation={onOpenQuotation} />
        </Note>
      ))}
      {q.status === "REJECTED" && q.rejectionReason && <Note>Rejected: {q.rejectionReason}</Note>}
      {q.status === "ACCEPTED" && q.acceptedBy && <Note>Accepted by {q.acceptedBy}.</Note>}
    </div>
  );

  const footer = (
    <Panel title="Activity" description="Everything that has been done to this quotation, and by whom.">
      {activity.loading && !activity.data ? <Spinner label="Loading activity" /> : <ActivityList rows={activity.data?.rows} />}
    </Panel>
  );

  return (
    <>
      <InvoiceScreen
        sheet={doc.sheet}
        fileName={doc.fileName}
        status={q.displayStatus}
        statusLabel={statusLabel(q.displayStatus)}
        onBack={onBack}
        actions={actions}
        banner={banner}
        footer={footer}
      />

      {dialog === "send" && (
        <ActionModal
          title={`Mark ${q.quotationNo} as sent?`} confirmLabel="Mark as sent" busy={action.busy} problem={action.problem} onClose={close}
          description="This records that the offer has gone to the customer. It can no longer be edited; to change it, revise it."
          onConfirm={() => finish(() => quotations.send(q._id), `${q.quotationNo} marked as sent`)}
        >
          <Note>Sending it by email from here is not available yet. Download the PDF or print it first, then mark it as sent.</Note>
        </ActionModal>
      )}

      {dialog === "accept" && (
        <ActionModal
          title={`${q.quotationNo} accepted`} confirmLabel="Record acceptance" busy={action.busy} problem={action.problem} onClose={close}
          description="The customer said yes. You can then convert it to a sales order, or deliver first and invoice after."
          onConfirm={() => finish(() => quotations.accept(q._id, { acceptedBy: form.acceptedBy }), `${q.quotationNo} accepted`)}
        >
          <Field label="Accepted by" hint="Who at the customer, or their LPO number. Optional.">
            <TextInput value={form.acceptedBy} onChange={(e) => setForm({ ...form, acceptedBy: e.target.value })} placeholder="e.g. Mr Ali, LPO 991" />
          </Field>
        </ActionModal>
      )}

      {dialog === "reject" && (
        <ActionModal
          title={`${q.quotationNo} rejected`} confirmLabel="Record rejection" danger busy={action.busy} problem={action.problem} onClose={close}
          description="The customer said no. Keeping the reason tells you why offers are lost."
          onConfirm={() => finish(() => quotations.reject(q._id, { reason: form.reason }), `${q.quotationNo} rejected`)}
        >
          <Field label="Reason" hint="Price, timing, a competitor, no longer needed. Optional.">
            <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
        </ActionModal>
      )}

      {dialog === "order" && (
        <ActionModal
          title="Convert to a sales order" confirmLabel="Create sales order" busy={action.busy} problem={action.problem} onClose={close}
          description={`${q.quotationNo} becomes a draft sales order with the same lines, prices and discounts. It commits nothing to the accounts.`}
          onConfirm={() => finish(() => quotations.toTradeOrder(q._id, { date: form.date, expectedDate: form.expectedDate || undefined }), (r) => `${r.tradeOrder.orderNo} created from ${q.quotationNo}`)}
        >
          <Field label="Order date" hint="Priced at the tax rates in force on this date.">
            <DateInput value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Delivery date the customer asked for" hint="Optional.">
            <DateInput value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
          </Field>
          <Note>Confirm the order, then deliver against it in as many parts as you like. The invoice is raised from what was actually delivered.</Note>
        </ActionModal>
      )}

      {dialog === "convert" && (
        <ActionModal
          title="Convert to an invoice" confirmLabel="Create invoice" busy={action.busy} problem={action.problem} onClose={close}
          description={`${q.quotationNo} becomes a draft sales invoice with the same lines, prices and discounts.`}
          onConfirm={() => finish(() => quotations.convert(q._id, { date: form.date }), (r) => `${r.salesOrder.transactionNo} created from ${q.quotationNo}`)}
        >
          <Field label="Invoice date" hint="Priced at the tax rates in force on this date.">
            <DateInput value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Note>Nothing moves in stock or the ledger until you approve it, which is when it becomes the tax invoice. For goods going out in stages, convert the offer to a sales order instead.</Note>
        </ActionModal>
      )}

      {dialog === "delivery" && (
        <ActionModal
          title="Deliver first, invoice after" confirmLabel="Create delivery note" busy={action.busy} problem={action.problem} onClose={close}
          description={`${q.quotationNo} becomes a delivery note for the goods to go out now.`}
          onConfirm={() => finish(() => quotations.toDeliveryNote(q._id, { date: form.date, deliveryAddress: form.deliveryAddress || undefined }), (r) => `${r.deliveryNote.deliveryNoteNo} created from ${q.quotationNo}`)}
        >
          <Field label="Delivery date"><DateInput value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Deliver to" hint="Leave blank to use the customer's address.">
            <Textarea rows={2} value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} />
          </Field>
          <Note tone="warning">A tax invoice is due within 14 days of delivery. For several deliveries against one offer, convert it to a sales order instead.</Note>
        </ActionModal>
      )}

      {dialog === "revise" && (
        <ActionModal
          title={`Revise ${q.quotationNo}?`} confirmLabel="Create revision" busy={action.busy} problem={action.problem} onClose={close}
          description="A new draft is made with the same lines, priced at today's rates and valid from today."
          onConfirm={() => finish(() => quotations.revise(q._id), (r) => `${r.quotationNo} created`, (r) => onOpenQuotation?.(r._id))}
        >
          <Note>This offer is marked Superseded so only one version can be accepted. If you discard the revision before sending it, this one comes back as it was.</Note>
        </ActionModal>
      )}

      {dialog === "delete" && (
        <ActionModal
          title={`Delete ${q.quotationNo}?`} confirmLabel="Delete draft" danger busy={action.busy} problem={action.problem} onClose={close}
          description={q.revisionOf ? `This revision is discarded and ${q.revisionOf.no} comes back as it was.` : "This draft has not gone to the customer. It is removed for good."}
          onConfirm={() => finish(() => quotations.remove(q._id), `${q.quotationNo} deleted`, () => onBack())}
        />
      )}
    </>
  );
}
