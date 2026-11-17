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

/**
 * The slip printed for a sale made with no signal. The tax on the lines is worked out by the server when the sale is
 * sent, so this is not a tax invoice and does not pretend to be: it is a delivery slip carrying the invoice number
 * the van reserved (when it has one), and the tax invoice follows.
 */
export function printDeliverySlip({ company, number, items, total, customerName, trip, paid }) {
  const invoice = { transactionNo: number || "(given when sent)", date: new Date().toISOString(), totalAmount: total, items: items.map((l) => ({ description: l.name || l.description || "", qty: l.qty, price: l.price, lineTotal: l.qty * l.price })) };
  return printMarkup(vanReceiptMarkup({ company, invoice, customerName, tripNo: trip?.tripNo, salesmanName: trip?.salesmanName, paid, taxInvoice: false, provisional: true, taxWord: taxWord(), uae: isUae() }));
}

export const tripTitle = (t) => `${t.tripNo || "Trip"} · ${t.vanCode || ""}`;
export const tripWhen = (t) => (t.date ? formatDate(t.date) : "");
