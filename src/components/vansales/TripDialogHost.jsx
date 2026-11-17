import React, { useState } from "react";
import { Button } from "../ui/button";
import { ConfirmDialog, Modal } from "../accounting/kit.jsx";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { trips } from "../../lib/vanSalesApi";
import { vanErrorText } from "../../lib/vanSales";
import { formatCurrencyAED } from "../../utils/format";
import { CollectDialog, LoadDialog, OpenTripDialog, ReturnDialog, SellDialog, SettleDialog, UnloadDialog } from "./tripDialogs";
import { PrintButton } from "./vanShared";
import { printSale } from "./printSale";

// Renders whichever dialog `ask(kind)` named for a trip, runs the quick acts (send out, cancel) itself, and tells the
// page what happened so it can reload. `customerId` pre-fills the customer for a stop on the route.
export default function TripDialogHost({ trip, dialog, onClose, onChanged, notify }) {
  const company = useCompanyProfile();
  const [sold, setSold] = useState(null);
  const [busy, setBusy] = useState(false);
  const kind = dialog?.kind;

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
    const { invoice, receipt, customerName } = sold;
    return (
      <Modal size="sm" title="Sold" onClose={() => { setSold(null); onClose(); onChanged?.(); }}
        footer={<Button onClick={() => { setSold(null); onClose(); onChanged?.(); }}>Done</Button>}>
        <div className="grid gap-3 text-sm">
          <p><span className="font-medium">{invoice.transactionNo}</span> for {customerName}: <span className="font-medium">{formatCurrencyAED(invoice.totalAmount)}</span>{receipt ? `, ${formatCurrencyAED(receipt.totalAmount)} received (${receipt.voucherNo})` : ", on credit"}.</p>
          <div><PrintButton onClick={() => printSale({ company, invoice, customerName, trip, paid: receipt?.totalAmount || 0 })} /></div>
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
    case "settle": return <SettleDialog trip={trip} onClose={onClose} onDone={() => finish(`${trip.tripNo} settled.`)} />;
    case "depart":
      return <ConfirmDialog title="Send the van out?" text="From now the salesman can sell from it." confirmLabel="Send out" busy={busy} onClose={onClose} onConfirm={() => quick(() => trips.depart(trip.id), "The van is out.")} />;
    case "cancel":
      return <ConfirmDialog title="Cancel this trip?" text="Only possible while nothing has been sold or collected. What was loaded stops counting as on the van." confirmLabel="Cancel trip" danger busy={busy} onClose={onClose} onConfirm={() => quick(() => trips.cancel(trip.id), "Trip cancelled.")} />;
    default: return null;
  }
}
