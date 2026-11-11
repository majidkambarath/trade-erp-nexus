import React, { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "../ui/button";
import { useCompanyProfile } from "../PurchaseOrder/shared/useCompanyProfile";
import { downloadSheetsPdf, printMarkup, sheetMarkup } from "../PurchaseOrder/shared/documentPdf";
import { readAccent } from "../PurchaseOrder/shared/invoiceModel";
import { orgCurrency } from "../../utils/orgLocale";
import { buildEstimateDocument, buildGatePassDocument, buildJobCardDocument } from "./garageDocuments";

// Print/download a sheet without leaving the dialog: the same markup InvoiceScreen's own buttons draw
// (documentPdf.js), just invoked directly rather than through that full page-navigation screen.
//
// One pair of buttons per COPY, not per document. A sheet that declares two copies has two different
// things to hand out, and this row used to print `copies[0]` and nothing else - so the gate pass's
// "Gate copy" was unreachable from anywhere in the product, although garageDocuments.js has always
// declared it. A document with a single copy reads exactly as it did.
function PrintRow({ card }) {
  const company = useCompanyProfile();
  const currency = orgCurrency();
  const accent = readAccent();
  const [busy, setBusy] = useState(null);

  const sheets = useMemo(() => {
    const docs = [
      ["jobcard", "Job card", buildJobCardDocument],
      ["estimate", "Estimate", buildEstimateDocument],
      ...(card.delivery?.gatePassAt ? [["gatepass", "Gate pass", buildGatePassDocument]] : []),
    ];
    return docs.flatMap(([key, label, build]) => {
      const doc = build(card, company, currency);
      const copies = doc.copies?.length ? doc.copies : [undefined];
      // The copy's own name only earns a place in the label when there is a choice to make.
      return copies.map((copy, i) => ({ key: `${key}-${i}`, label: copies.length > 1 ? `${label} · ${copy}` : label, doc, copy }));
    });
  }, [card, company, currency]);

  async function download(s) {
    setBusy(s.key);
    try {
      await downloadSheetsPdf([sheetMarkup(s.doc.sheet, { copy: s.copy, accent })], s.doc.fileName);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Print</span>
      {sheets.map((s) => (
        <React.Fragment key={s.key}>
          <Button type="button" variant="outline" size="sm" onClick={() => printMarkup(sheetMarkup(s.doc.sheet, { copy: s.copy, accent }))}>
            <Printer className="me-1 h-3.5 w-3.5" /> {s.label}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy === s.key} onClick={() => download(s)} aria-label={`Download ${s.label} PDF`}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
}

export default PrintRow;
