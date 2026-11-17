import React, { useState } from "react";
import { Button } from "../ui/button";
import { ConfirmDialog, Modal } from "../accounting/kit.jsx";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { trips } from "../../lib/vanSalesApi";
import { vanErrorText } from "../../lib/vanSales";
import { formatCurrencyAED } from "../../utils/format";
import { CollectDialog, LoadDialog, OpenTripDialog, ReturnDialog, SellDialog, SettleDialog, UnloadDialog } from "./tripDialogs";
import { TransferDialog, VisitDialog } from "./phase2Dialogs";
import { MessageCircle } from "lucide-react";
import { TextInput } from "../accounting/kit.jsx";
import { PrintButton } from "./vanShared";
import { printSale } from "./printSale";

// Renders whichever dialog `ask(kind)` named for a trip, runs the quick acts (send out, cancel) itself, and tells the
// page what happened so it can reload. `customerId` pre-fills the customer for a stop on the route.
export default function TripDialogHost({ trip, dialog, onClose, onChanged, notify }) {
  const company = useCompanyProfile();
  const [sold, setSold] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const kind = dialog?.kind;

  // the invoice on WhatsApp, from the door: the organisation's own share link, opened in WhatsApp on the phone
  async function whatsapp(invoiceId) {
    setSending(true);
    try {
      const r = await trips.whatsapp(trip.id, invoiceId, phone ? { phone } : {});
      if (r?.waUrl) window.open(r.waUrl, "_blank", "noopener");
      notify?.(r?.duplicate ? "Already handed to the customer." : "Opening WhatsApp with the invoice link.");
    } catch (err) {
      notify?.(vanErrorText(err), "error");
    } finally {
      setSending(false);
    }
  }

  async function quick(act, done) {
    setBusy(true);
    try {
      await act();
      notify?.(done);
      onClose();
      onChanged?.();
    } catch (err) {
      notify?.(vanErrorText(err), "error");
      setBusy(false);
    }
  }
  const finish = (message) => { notify?.(message); onClose(); onChanged?.(); };

  if (sold) {
    const { invoice, receipt, customerName, customerTrn } = sold;
    return (
      <Modal size="sm" title="Sold" onClose={() => { setSold(null); onClose(); onChanged?.(); }}
        footer={<Button onClick={() => { setSold(null); onClose(); onChanged?.(); }}>Done</Button>}>
        <div className="grid gap-3 text-sm">
          <p><span className="font-medium">{invoice.transactionNo}</span> for {customerName}: <span className="font-medium">{formatCurrencyAED(invoice.totalAmount)}</span>{receipt ? `, ${formatCurrencyAED(receipt.totalAmount)} received (${receipt.voucherNo})` : ", on credit"}.</p>
          <div className="flex flex-wrap items-end gap-2">
            <PrintButton onClick={() => printSale({ company, invoice, customerName, customerTrn, trip, paid: receipt?.totalAmount || 0 })} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-1 text-sm"><span className="text-muted-foreground">WhatsApp number (blank = the one on file)</span><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+971 50 …" /></label>
            <button type="button" disabled={sending} onClick={() => whatsapp(invoice._id)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"><MessageCircle className="h-4 w-4" aria-hidden="true" /> {sending ? "Opening…" : "Send on WhatsApp"}</button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!trip && kind !== "open") return null;
  switch (kind) {
    case "open": return <OpenTripDialog onClose={onClose} onDone={(t) => finish(`Trip ${t.tripNo} opened.`)} />;
    case "load": return <LoadDialog trip={trip} onClose={onClose} onDone={() => finish("Load saved.")} />;
    case "sell": return <SellDialog trip={trip} customerId={dialog.customerId} onClose={onClose} onDone={(r) => setSold({ ...r, customerName: r.customerName || "the customer" })} />;
    case "collect": return <CollectDialog trip={trip} customerId={dialog.customerId} onClose={onClose} onDone={(r) => finish(`${r.receipt.voucherNo} taken.`)} />;
    case "return": return <ReturnDialog trip={trip} customerId={dialog.customerId} onClose={onClose} onDone={(r) => finish(`${r.creditNote.transactionNo} taken back.`)} />;
    case "unload": return <UnloadDialog trip={trip} onClose={onClose} onDone={() => finish("The van is counted in. A supervisor can settle it now.")} />;
    case "visit": return <VisitDialog trip={trip} customerId={dialog.customerId} customerName={dialog.customerName} onClose={onClose} onDone={() => finish("Visit recorded.")} />;
    case "transfer": return <TransferDialog trip={trip} onClose={onClose} onDone={() => finish("Goods handed over.")} />;
    case "settle": return <SettleDialog trip={trip} onClose={onClose} onDone={() => finish(`${trip.tripNo} settled.`)} />;
    case "depart":
      return <ConfirmDialog title="Send the van out?" text="From now the salesman can sell from it." confirmLabel="Send out" busy={busy} onClose={onClose} onConfirm={() => quick(() => trips.depart(trip.id), "The van is out.")} />;
    case "cancel":
      return <ConfirmDialog title="Cancel this trip?" text="Only possible while nothing has been sold or collected. What was loaded stops counting as on the van." confirmLabel="Cancel trip" danger busy={busy} onClose={onClose} onConfirm={() => quick(() => trips.cancel(trip.id), "Trip cancelled.")} />;
    default: return null;
  }
}
