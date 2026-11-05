import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { History } from "lucide-react";
import { ErrorNote, Spinner, useAsync } from "../accounting/kit";
import { vouchers } from "../../lib/bankingApi";
import { CURRENCY } from "../../utils/format";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import InvoiceScreen from "../PurchaseOrder/shared/InvoiceScreen";
import { VoucherAuditTrail } from "../audit/AuditTrail";
import { voucherFileName, voucherListPath, voucherPage, voucherSheet, voucherStatusLabel } from "./voucherModel";

// One voucher read as a DOCUMENT: the A4 sheet on screen, the copy switch, Print and Download PDF -
// the same page a sales or purchase invoice opens on, because it IS that page. `InvoiceScreen` is
// reused rather than copied, so a voucher cannot drift away from the invoice in layout, wording or
// behaviour; the only thing it brings of its own is the sheet (registered as `layout: "voucher"` in
// documentPdf.jsx) and its own audit trail.
//
// It serves all six finance screens from one component. The route carries the id and nothing else,
// and the TYPE is read from the loaded voucher - so a link typed with the wrong screen's path still
// shows the document it really is, named and titled honestly, rather than a receipt's heading over a
// journal. "Back to list" follows the same reading.
//
// The audit trail is passed as an `action` rather than through `InvoiceScreen`'s own `auditId`: that
// prop opens `DocumentAuditTrail`, which reads a trade document, and a voucher needs
// `VoucherAuditTrail`. Passing it as a button needs no change to the shared screen at all.

// The toolbar button, duplicated here as every other document view duplicates it
// (orderDocs/GoodsReceivedView.jsx, TradeOrderView.jsx): 44px on touch, 40px from lg up.
const TB =
  "inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 lg:h-10";

export default function VoucherDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: voucher, loading, error } = useAsync(() => vouchers.get(id), [id]);
  const profile = useCompanyProfile();
  const [audit, setAudit] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1000px] p-4 sm:p-6 lg:p-8">
        <Spinner label="Loading the voucher" />
      </div>
    );
  }

  // A voucher that is gone, or an id that never was one, says so and offers the way back - it must
  // not render an empty sheet under a letterhead, which would read as a real but blank document.
  if (error || !voucher) {
    return (
      <div className="mx-auto max-w-[1000px] space-y-4 p-4 sm:p-6 lg:p-8">
        <ErrorNote error={error || new Error("This voucher could not be found. It may have been deleted.")} />
        <button type="button" className={TB} onClick={() => navigate("/receipt-voucher")}>
          Back to vouchers
        </button>
      </div>
    );
  }

  const title = voucherPage(voucher)?.title || "Voucher";
  const sheet = voucherSheet(voucher, { title, profile, currency: CURRENCY });

  return (
    <>
      <InvoiceScreen
        sheet={sheet}
        copies={sheet.copies}
        fileName={voucherFileName(voucher, title)}
        status={voucher.status}
        statusLabel={voucherStatusLabel(voucher.status)}
        onBack={() => navigate(voucherListPath(voucher))}
        actions={
          <button type="button" className={TB} onClick={() => setAudit(true)}>
            <History className="h-4 w-4" aria-hidden="true" />
            Audit trail
          </button>
        }
      />
      {audit && <VoucherAuditTrail id={id} voucherNo={voucher.voucherNo} onClose={() => setAudit(false)} />}
    </>
  );
}
