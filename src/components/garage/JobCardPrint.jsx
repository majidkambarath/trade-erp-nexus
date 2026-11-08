import React, { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "../ui/button";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { downloadSheetsPdf, printMarkup, sheetMarkup } from "../PurchaseOrder/shared/documentPdf";
import { readAccent } from "../PurchaseOrder/shared/invoiceModel";
import { orgCurrency } from "../../utils/orgLocale";
import { buildEstimateDocument, buildGatePassDocument, buildJobCardDocument } from "./garageDocuments";

// Print/download a sheet without leaving the dialog: the same markup InvoiceScreen's own buttons draw
// (documentPdf.js), just invoked directly rather than through that full page-navigation screen.
function PrintRow({ card }) {
  const company = useCompanyProfile();
  const currency = orgCurrency();
  const accent = readAccent();
  const [busy, setBusy] = useState(null);
  const DOCS = [
    ["jobcard", "Job card", buildJobCardDocument],
    ["estimate", "Estimate", buildEstimateDocument],
    ...(card.delivery?.gatePassAt ? [["gatepass", "Gate pass", buildGatePassDocument]] : []),
  ];
  async function download(key, build) {
    setBusy(key);
    try {
      const doc = build(card, company, currency);
      await downloadSheetsPdf([sheetMarkup(doc.sheet, { copy: doc.copies[0], accent })], doc.fileName);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Print</span>
      {DOCS.map(([key, label, build]) => (
        <React.Fragment key={key}>
          <Button type="button" variant="outline" size="sm" onClick={() => { const doc = build(card, company, currency); printMarkup(sheetMarkup(doc.sheet, { copy: doc.copies[0], accent })); }}>
            <Printer className="me-1 h-3.5 w-3.5" /> {label}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy === key} onClick={() => download(key, build)} aria-label={`Download ${label} PDF`}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
}

export default PrintRow;
