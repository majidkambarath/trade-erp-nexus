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

// Approved orders are the tax invoices; a draft or pending order is only an order.
const INVOICED = ["APPROVED", "INVOICED"];

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
  const number = invoiced ? so.invoiceNumber || so.transactionNo : so.transactionNo;
  return {
    fileName: `${invoiced ? "Tax-invoice" : "Sales-order"}_${number}`,
    status: so.status,
    missingTrn: invoiced && !company.vatNumber,
    sheet: sheetFor(so, {
      title: invoiced ? "Tax invoice" : "Sales order",
      numberLabel: invoiced ? "Invoice no." : "Order no.",
      number,
      party: {
        heading: "Bill to",
        name: customer.customerName || "",
        code: customer.customerId || "",
        address: customer.billingAddress || "",
        contact: contactLines(customer),
        trn: customer.trnNumber || customer.vat?.trn || "",
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
        ? "This is a computer-generated tax invoice. No signature is required."
        : "This is a sales order, not a tax invoice. The tax invoice is issued when the order is approved.",
      receipt: !invoiced,
      reverseChargeSide: "supplier",
    }),
  };
};

export const buildPurchaseDocument = (po, vendor, company, currency) => ({
  fileName: `Purchase-order_${po.transactionNo}`,
  status: po.status,
  missingTrn: false,
  sheet: sheetFor(po, {
    title: "Purchase order",
    numberLabel: "PO no.",
    number: po.transactionNo,
    party: {
      heading: "Supplier",
      name: vendor.vendorName || "",
      code: vendor.vendorId || "",
      address: vendor.address || "",
      contact: contactLines(vendor),
      trn: vendor.trnNO || vendor.vat?.trn || "",
    },
    meta: [
      ["Date", dateOf(po.date)],
      ["Delivery date", dateOf(po.deliveryDate)],
      ["Vendor reference", po.vendorReference ?? po.refNo ?? ""],
      ["Payment terms", vendor.paymentTerms || ""],
    ],
    company,
    currency,
    notice: "This is a computer-generated purchase order. No signature is required.",
    receipt: true,
    reverseChargeSide: "recipient",
  }),
});

// A sales return: goods coming back from the customer. It is a credit, not a sale, so it is never
// titled as a tax invoice.
export const buildSalesReturnDocument = (so, customer, company, currency) => ({
  fileName: `Sales-return_${so.transactionNo}`,
  status: so.status,
  missingTrn: false,
  sheet: sheetFor(so, {
    title: "Sales return",
    numberLabel: "Return no.",
    number: so.transactionNo,
    party: {
      heading: "Customer",
      name: customer.customerName || so.customerName || "",
      code: customer.customerId || "",
      address: customer.billingAddress || "",
      contact: contactLines(customer),
      trn: customer.trnNumber || customer.vat?.trn || "",
    },
    meta: [
      ["Date", dateOf(so.date)],
      ["Return date", dateOf(so.deliveryDate)],
      ["Original invoice", so.refNo ?? so.lpono ?? ""],
    ],
    company,
    currency,
    notice: "This is a sales return note. It credits the goods returned to the customer.",
    receipt: true,
    reverseChargeSide: "supplier",
  }),
});

// A purchase return: goods sent back to the vendor.
export const buildPurchaseReturnDocument = (po, vendor, company, currency) => ({
  fileName: `Purchase-return_${po.transactionNo}`,
  status: po.status,
  missingTrn: false,
  sheet: sheetFor(po, {
    title: "Purchase return",
    numberLabel: "Return no.",
    number: po.transactionNo,
    party: {
      heading: "Supplier",
      name: vendor.vendorName || "",
      code: vendor.vendorId || "",
      address: vendor.address || "",
      contact: contactLines(vendor),
      trn: vendor.trnNO || vendor.vat?.trn || "",
    },
    meta: [
      ["Date", dateOf(po.date)],
      ["Return date", dateOf(po.deliveryDate)],
      ["Vendor reference", po.vendorReference ?? ""],
    ],
    company,
    currency,
    notice: "This is a purchase return note. It records the goods sent back to the vendor.",
    receipt: true,
    reverseChargeSide: "recipient",
  }),
});
