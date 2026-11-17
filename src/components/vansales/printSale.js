import { printMarkup } from "../PurchaseOrder/shared/documentPdf.jsx";
import { isTaxInvoice } from "../PurchaseOrder/shared/invoiceDocuments";
import { vanReceiptMarkup } from "../../lib/vanReceipt";
import { isUae, taxWord } from "../../lib/taxTerms";
import { formatDate } from "../../utils/format";

/** Prints the slip for a sale made from the van. */
export function printSale({ company, invoice, customerName, customerTrn, trip, paid }) {
  const markup = vanReceiptMarkup({
    company, invoice, customerName, customerTrn, uae: isUae(), tripNo: trip?.tripNo, salesmanName: trip?.salesmanName, paid,
    taxInvoice: isTaxInvoice(company, invoice?.date, invoice?.vatRegistered), taxWord: taxWord(),
  });
  return printMarkup(markup);
}

export const tripTitle = (t) => `${t.tripNo || "Trip"} · ${t.vanCode || ""}`;
export const tripWhen = (t) => (t.date ? formatDate(t.date) : "");
