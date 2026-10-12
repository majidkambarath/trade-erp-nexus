import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, FileText, PackageCheck, Pencil, Trash2 } from "lucide-react";
import InvoiceScreen from "../PurchaseOrder/shared/InvoiceScreen";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { ErrorNote, Panel, Spinner, useAsync } from "../accounting/kit";
import { goodsReceipts } from "../../lib/orderDocumentsApi";
import { allowReceiptActions, receiptStatusLabel } from "../../lib/orderDocuments";
import { buildGoodsReceivedDocument } from "./documents";
import { ActionModal, ActivityList, Note } from "../salesDocs/parts";
import { CancelReceiptDialog, ReceiptInvoiceDialog, ReceiveDialog } from "./ReceiptDialogs";
import { useDocumentAction } from "./hooks";
import { useOrganisation } from "../shell/OrganisationContext";
import { orgCurrency } from "../../utils/orgLocale";
import { createThenApprove, invoiceNote } from "../../lib/invoiceFlow";

const TB = "inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 lg:h-10";
const PRIMARY = "erp-btn-primary";

// One goods receipt: the paper, the actions that move it along (confirm what arrived, invoice it, withdraw it), and what has
// happened to it. Which actions exist comes from the server (receipt.actions), so a rule is decided in one place.
export default function GoodsReceivedView({ id, onBack, onEdit, onChanged, notify }) {
  const navigate = useNavigate();
  const { me } = useOrganisation();
  const company = useCompanyProfile();
  const currency = orgCurrency();
  const { data: receipt, loading, error, reload } = useAsync(() => goodsReceipts.get(id), [id]);
  const activity = useAsync(() => goodsReceipts.activity(id), [id]);
  const [dialog, setDialog] = useState(null); // receive | cancel | invoice | delete

  const refresh = async () => {
    await Promise.all([reload(), activity.reload()]);
    onChanged?.();
  };
  const action = useDocumentAction({ notify, reload: refresh });
  const open = (name) => { action.clear(); setDialog(name); };
  const close = () => { setDialog(null); action.clear(); };

  const doc = useMemo(() => (receipt ? buildGoodsReceivedDocument(receipt, receipt.party || {}, company, currency, { showPrices: true }) : null), [receipt, company, currency]);

  if (loading && !receipt) return <div className="p-8"><Spinner label="Loading goods receipt" /></div>;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorNote error={error} onRetry={reload} /></div>;
  if (!receipt) return null;

  const A = allowReceiptActions(receipt.actions, me);
  const finish = async (promise, message, after) => {
    const out = await action.run(() => promise(), message, { refresh: !after });
    if (out) { close(); after?.(out); }
  };
  const next = A.receive ? "receive" : A.invoice ? "invoice" : null;
  const btn = (name, label, Icon, onClick) => (
    <button key={name} type="button" onClick={onClick} className={next === name ? PRIMARY : TB}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
  const actions = (
    <>
      {A.edit && btn("edit", "Edit", Pencil, () => onEdit(receipt))}
      {A.receive && btn("receive", "Confirm goods received", PackageCheck, () => open("receive"))}
      {A.invoice && btn("invoice", "Create purchase invoice", FileText, () => open("invoice"))}
      {A.cancel && btn("cancel", "Cancel", Ban, () => open("cancel"))}
      {A.delete && btn("delete", "Delete", Trash2, () => open("delete"))}
    </>
  );

  const banner = (
    <div className="space-y-2">
      {receipt.status === "DRAFT" && <Note>This receipt is a draft. Confirm what actually arrived when the goods are in; until then it counts as on the way.</Note>}
      {receipt.status === "RECEIVED" && receipt.invoiceStatus === "NONE" && (
        <Note tone="warning">These goods have been received but not invoiced. Nothing is in the accounts until a purchase invoice made from them is approved.</Note>
      )}
      {receipt.invoice?.no && (
        <Note>
          {receipt.invoiceStatus === "INVOICED" ? "Invoiced on" : "On the draft purchase invoice"}{" "}
          <Link to={`/purchase-order?search=${encodeURIComponent(receipt.invoice.no)}`} className="font-semibold underline underline-offset-2">{receipt.invoice.no}</Link>.
        </Note>
      )}
      {receipt.source?.no && (
        <Note>
          Against purchase order{" "}
          <Link to={`/purchase-orders?open=${receipt.source.id}`} className="font-semibold underline underline-offset-2">{receipt.source.no}</Link>.
        </Note>
      )}
    </div>
  );

  const footer = (
    <Panel title="Activity" description="Everything that has been done to this receipt, and by whom.">
      {activity.loading && !activity.data ? <Spinner label="Loading activity" /> : <ActivityList rows={activity.data?.rows} />}
    </Panel>
  );

  return (
    <>
      <InvoiceScreen
        sheet={doc.sheet}
        fileName={doc.fileName}
        status={receipt.status}
        statusLabel={receiptStatusLabel(receipt.status)}
        copies={doc.copies}
        onBack={onBack}
        actions={actions}
        banner={banner}
        footer={footer}
      />

      {dialog === "receive" && (
        <ReceiveDialog
          receipt={receipt} busy={action.busy} problem={action.problem} onClose={close}
          onConfirm={(body) => finish(() => goodsReceipts.receive(receipt._id, body), `${receipt.receiptNo} received`)}
        />
      )}
      {dialog === "cancel" && (
        <CancelReceiptDialog
          receipt={receipt} busy={action.busy} problem={action.problem} onClose={close}
          onConfirm={(body) => finish(() => goodsReceipts.cancel(receipt._id, body), `${receipt.receiptNo} cancelled`)}
        />
      )}
      {dialog === "invoice" && (
        <ReceiptInvoiceDialog
          receipts={[{ ...receipt, party: { name: receipt.party?.vendorName } }]} busy={action.busy} problem={action.problem} onClose={close}
          onConfirm={(body) =>
            finish(
              () => createThenApprove((payload) => goodsReceipts.invoice(payload), body, (r) => r.purchaseInvoice),
              (r) => invoiceNote(r.purchaseInvoice.transactionNo, receipt.receiptNo, r.approval),
              (r) => { onChanged?.(); navigate(`/purchase-order?search=${encodeURIComponent(r.purchaseInvoice.transactionNo)}`); }
            )
          }
        />
      )}
      {dialog === "delete" && (
        <ActionModal
          title={`Delete ${receipt.receiptNo}?`} confirmLabel="Delete draft" danger busy={action.busy} problem={action.problem} onClose={close}
          description="This draft was never confirmed as received. It is removed for good."
          onConfirm={() => finish(() => goodsReceipts.remove(receipt._id), `${receipt.receiptNo} deleted`, () => onBack())}
        />
      )}
    </>
  );
}
