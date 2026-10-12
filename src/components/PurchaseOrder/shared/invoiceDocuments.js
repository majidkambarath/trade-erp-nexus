// The sales and purchase documents as the sheet shows them. Pure: the rules behind the printed
// page (which title, which number, which rows, which warnings) are testable without rendering.

import { documentTotals } from "../../../utils/documentTotals";
import { formatDateGB, formatNumber } from "../../../utils/format";
import { SUPPLIER_STATEMENT, recipientStatement } from "../../../lib/reverseCharge";
import {
  bankRows,
  companyBlock,
  invoiceLines,
  rowsWithValue,
  vatBreakdown,
  withChargesVat,
} from "./invoiceModel";

// Approved orders are the invoices; a draft or pending order is only an order.
const INVOICED = ["APPROVED", "INVOICED"];

// An invoice is a TAX invoice when the SELLER is VAT-registered, which is to say when the company has a TRN (Settings >
// Business rules > Tax identity, the same TRN the VAT return uses). The buyer's registration does not change the heading;
// it decides whether the buyer's own TRN is expected on the document (see partyVatStatus). A company with no TRN issues a
// plain "Invoice": calling it a tax invoice would claim a registration the company has not recorded.
//
// The heading does not wait for approval. This screen's document IS the invoice (the sales / purchase ORDER is a separate,
// non-posting document with its own heading), so a draft reads "Tax invoice" too and says in its number label and its
// notice that it is a draft: a title of "Sales order" on the invoice page told people the wrong thing.
export const isTaxInvoice = (company) => Boolean(String(company?.vatNumber ?? "").trim());

// How a customer's or vendor's VAT registration reads on a document. The master stores one of registered / unregistered /
// exempt / designated_zone (and a record saved before that block existed has none, so a TRN decides). A party that was not
// found says nothing rather than "Unregistered".
const VAT_STATUS_LABEL = { registered: "Registered", unregistered: "Unregistered", exempt: "Exempt", designated_zone: "Designated zone" };
export const partyVatStatus = (record, trn, name) => {
  const stored = record?.vat?.status;
  if (VAT_STATUS_LABEL[stored]) return VAT_STATUS_LABEL[stored];
  if (trn) return VAT_STATUS_LABEL.registered;
  return name ? VAT_STATUS_LABEL.unregistered : "";
};

export const contactLines = (p) =>
  [p.phone && `Tel: ${p.phone}`, p.email && `Email: ${p.email}`].filter(Boolean);

// What a document with a reverse-charge line must say about it, or null when it has none.
//   supplier   a sale (or its credit note): the supplier charges no VAT, and the invoice must state that the recipient accounts for it
//              (Executive Regulation Art. 59(1)(l)). The amount the customer assesses is the customer's own figure and is not printed.
//   recipient  a purchase (or its return): our own document. The VAT we assess is shown beside the total, never in it.
export const reverseChargeNote = (lines, totals, side, currency) => {
  if (!lines.some((l) => l.reverseCharge)) return null;
  if (side !== "supplier" && side !== "recipient") return null; // a document that does not say which side it is on says nothing
  if (side === "supplier") return { statement: SUPPLIER_STATEMENT };
  const amount = totals.rcmVat || lines.reduce((t, l) => t + (l.rcmVat || 0), 0);
  return {
    statement: recipientStatement(`${currency} ${formatNumber(amount)}`),
    amountLabel: "VAT self-assessed (reverse charge)",
    amount,
  };
};

// The sheet fields every document shares: what is printed, from which saved document.
export const sheetFor = (doc, { title, numberLabel, number, party, meta, company, currency, notice, receipt, reverseChargeSide }) => {
  const lines = invoiceLines(doc.items);
  const totals = documentTotals(doc);
  return {
    title,
    number: { label: numberLabel, value: number },
    company: companyBlock(company),
    party,
    meta: rowsWithValue(meta),
    lines,
    totals,
    breakdown: withChargesVat(vatBreakdown(lines), totals.vat),
    bank: bankRows(company),
    currency,
    notice,
    receipt,
    reverseCharge: reverseChargeNote(lines, totals, reverseChargeSide, currency),
  };
};

export const dateOf = (value) => (value ? formatDateGB(value) : "");

export const buildSalesDocument = (so, customer, company, currency) => {
  const invoiced = INVOICED.includes(so.status);
  const customerTrn = customer.trnNumber || customer.vat?.trn || "";
  const vatStatus = partyVatStatus(customer, customerTrn, customer.customerName);
  // The heading follows who the document is for. A VAT-registered customer is given a "Tax invoice" (which needs the company's own
  // TRN: without one it is a plain "Invoice" and the screen says why). Any other customer is given a "Sales order", as asked for.
  const customerRegistered = vatStatus === "Registered";
  const companyRegistered = isTaxInvoice(company);
  const kind = customerRegistered ? (companyRegistered ? "Tax invoice" : "Invoice") : "Sales order";
  const taxInvoice = invoiced && kind === "Tax invoice"; // an ISSUED tax invoice (what sending and the e-invoice look at)
  const number = invoiced ? so.invoiceNumber || so.transactionNo : so.transactionNo;
  const isOrder = kind === "Sales order";
  const noun = kind.toLowerCase();
  return {
    fileName: `${invoiced ? "" : "Draft-"}${kind.replace(/ /g, "-")}_${number}`,
    status: so.status,
    // a registered customer with no company TRN gets a plain invoice, and the screen says why
    missingTrn: customerRegistered && !companyRegistered,
    taxInvoice,
    sheet: sheetFor(so, {
      title: kind,
      numberLabel: `${invoiced ? "" : "Draft "}${isOrder ? "order" : "invoice"} no.`.replace(/^./, (c) => c.toUpperCase()),
      number,
      party: {
        heading: "Bill to",
        name: customer.customerName || "",
        code: customer.customerId || "",
        address: customer.billingAddress || "",
        contact: contactLines(customer),
        trn: customerTrn,
        vatStatus,
      },
      meta: [
        ["Date", dateOf(so.date)],
        ["Delivery date", dateOf(so.deliveryDate)],
        ["LPO / reference", so.refNo ?? so.lpono ?? ""],
        ["Doc no.", so.docNo ?? so.docno ?? ""],
        ["Payment terms", customer.paymentTerms || ""],
      ],
      company,
      currency,
      notice: invoiced
        ? `This is a computer-generated ${noun}. No signature is required.`
        : `This is a draft ${noun}. Nothing is posted and no stock moves until it is approved.`,
      receipt: !invoiced,
      reverseChargeSide: "supplier",
    }),
  };
};

// A purchase document as it is recorded in our books. For a VAT-registered supplier it reads "Tax invoice" (that is what it is, and
// what input VAT is claimed on); for any other supplier it reads "Purchase order", as asked for, and says that no input VAT can be
// recovered on it. (The non-posting order in front of it is its own document, under Orders.)
export const buildPurchaseDocument = (po, vendor, company, currency) => {
  const invoiced = INVOICED.includes(po.status);
  const vendorTrn = vendor.trnNO || vendor.vat?.trn || "";
  const vatStatus = partyVatStatus(vendor, vendorTrn, vendor.vendorName);
  const registered = vatStatus === "Registered";
  const kind = registered ? "tax invoice" : "purchase order";
  return {
  fileName: `${invoiced ? "" : "Draft-"}${registered ? "Tax-invoice" : "Purchase-order"}_${po.transactionNo}`,
  status: po.status,
  missingTrn: false,
  sheet: sheetFor(po, {
    title: registered ? "Tax invoice" : "Purchase order",
    numberLabel: `${invoiced ? "" : "Draft "}${registered ? "invoice" : "order"} no.`.replace(/^./, (c) => c.toUpperCase()),
    number: po.transactionNo,
    party: {
      heading: "Supplier",
      name: vendor.vendorName || "",
      code: vendor.vendorId || "",
      address: vendor.address || "",
      contact: contactLines(vendor),
      trn: vendorTrn,
      vatStatus,
    },
    meta: [
      ["Date", dateOf(po.date)],
      ["Delivery date", dateOf(po.deliveryDate)],
      ["Vendor reference", po.vendorReference ?? po.refNo ?? ""],
      ["Payment terms", vendor.paymentTerms || ""],
    ],
    company,
    currency,
    notice: `${invoiced ? "This is a computer-generated" : "This is a draft"} ${kind}, recorded from the supplier's invoice.${
      registered ? "" : " The supplier is not VAT-registered, so no input VAT can be recovered on it."
    }${invoiced ? " No signature is required." : " Nothing is posted and no stock comes in until it is approved."}`,
    receipt: true,
    reverseChargeSide: "recipient",
  }),
  };
};

// A sales return: goods coming back from the customer. It is a credit, never a sale, so it is never titled as a tax invoice. For a
// registered customer it reads "Tax credit note" (what the customer is given for the goods), for any other a plain "Sales return".
// The invoice it returns is named, and an approved return is set against it (the invoice owes that much less).
export const buildSalesReturnDocument = (so, customer, company, currency) => {
  const trn = customer.trnNumber || customer.vat?.trn || "";
  const name = customer.customerName || so.customerName || "";
  const vatStatus = partyVatStatus(customer, trn, name);
  const registered = vatStatus === "Registered";
  const original = so.returnOf?.transactionNo || so.refNo || so.lpono || "";
  const issued = INVOICED.includes(so.status);
  return {
    fileName: `${registered ? "Tax-credit-note" : "Sales-return"}_${so.transactionNo}`,
    status: so.status,
    missingTrn: false,
    sheet: sheetFor(so, {
      title: registered ? "Tax credit note" : "Sales return",
      numberLabel: registered ? "Credit note no." : "Return no.",
      number: so.transactionNo,
      party: {
        heading: "Customer",
        name,
        code: customer.customerId || "",
        address: customer.billingAddress || "",
        contact: contactLines(customer),
        trn,
        vatStatus,
      },
      meta: [
        ["Date", dateOf(so.date)],
        ["Return date", dateOf(so.deliveryDate)],
        ["Original invoice", original],
      ],
      company,
      currency,
      notice: `${issued ? "This is a computer-generated" : "This is a draft"} ${registered ? "tax credit note" : "sales return note"}. It credits the goods returned${original ? ` against ${original}` : ""}.${issued ? "" : " Nothing is posted and no stock moves until it is approved."}`,
      receipt: true,
      reverseChargeSide: "supplier",
    }),
  };
};

// A purchase return: goods sent back to the vendor. For a registered supplier it reads "Debit note" (what the supplier is asked to
// credit us for the goods), for any other a plain "Purchase return". An approved return is set against the invoice it returns.
export const buildPurchaseReturnDocument = (po, vendor, company, currency) => {
  const trn = vendor.trnNO || vendor.vat?.trn || "";
  const vatStatus = partyVatStatus(vendor, trn, vendor.vendorName);
  const registered = vatStatus === "Registered";
  const original = po.returnOf?.transactionNo || "";
  const issued = INVOICED.includes(po.status);
  return {
    fileName: `${registered ? "Debit-note" : "Purchase-return"}_${po.transactionNo}`,
    status: po.status,
    missingTrn: false,
    sheet: sheetFor(po, {
      title: registered ? "Debit note" : "Purchase return",
      numberLabel: registered ? "Debit note no." : "Return no.",
      number: po.transactionNo,
      party: {
        heading: "Supplier",
        name: vendor.vendorName || "",
        code: vendor.vendorId || "",
        address: vendor.address || "",
        contact: contactLines(vendor),
        trn,
        vatStatus,
      },
      meta: [
        ["Date", dateOf(po.date)],
        ["Return date", dateOf(po.deliveryDate)],
        ["Original invoice", original],
        ["Vendor reference", po.vendorReference ?? ""],
      ],
      company,
      currency,
      notice: `${issued ? "This is a computer-generated" : "This is a draft"} ${registered ? "debit note" : "purchase return note"}. It records the goods sent back to the vendor${original ? ` against ${original}` : ""}.${issued ? "" : " Nothing is posted and no stock moves until it is approved."}`,
      receipt: true,
      reverseChargeSide: "recipient",
    }),
  };
};
