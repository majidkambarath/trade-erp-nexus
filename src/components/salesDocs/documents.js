// A quotation, a delivery note and a pick list as the printed page shows them. Pure, like
// PurchaseOrder/shared/invoiceDocuments.js, so what appears on the paper is tested without rendering.
//
// The totals on a quotation come from the server's `pricing` (documentTotals), never from summing the
// lines here, so the offer shows what the invoice will show.

import { documentTotals } from "../../utils/documentTotals";
import { isReverseCharge } from "../../lib/reverseCharge";
import { companyBlock } from "../PurchaseOrder/shared/invoiceModel";
import { contactLines, dateOf, sheetFor } from "../PurchaseOrder/shared/invoiceDocuments";

const SOURCE_LABEL = { sales_order: "Sales order", quotation: "Quotation" };

export const buildQuotationDocument = (q, customer, company, currency) => {
  // invoiceLines reads `rate` as the line value after discount: on a quotation that is taxableAmount
  const items = (q.items || []).map((l) => ({ ...l, rate: l.taxableAmount }));
  const sheet = sheetFor(
    { ...q, items },
    {
      title: "Quotation",
      numberLabel: "Quotation no.",
      number: q.quotationNo,
      party: {
        heading: "Quotation for",
        name: customer.customerName || "",
        code: customer.customerId || "",
        address: customer.billingAddress || "",
        contact: contactLines(customer),
        trn: customer.trnNumber || customer.vat?.trn || "",
      },
      meta: [
        ["Date", dateOf(q.date)],
        ["Valid until", dateOf(q.validUntil)],
        ["Customer ref.", q.reference || ""],
        ["Payment terms", customer.paymentTerms || ""],
      ],
      company, // sheetFor builds the company block from the profile itself
      currency,
      notice: `This is a quotation, not a tax invoice. Prices are valid until ${dateOf(q.validUntil)}.`,
      receipt: false,
      reverseChargeSide: "supplier", // an offer on a reverse-charge line tells the customer the VAT is theirs to account for
    }
  );
  return {
    fileName: `Quotation_${q.quotationNo}`,
    status: q.displayStatus || q.status,
    missingTrn: false,
    sheet: { ...sheet, terms: q.terms || "", acceptance: true },
  };
};

const unitOf = (l) => l.stockDetails?.unit || "";

export const buildDeliveryNoteDocument = (dn, customer, company, currency, { showPrices = false } = {}) => {
  const delivered = dn.status === "DELIVERED";
  const lines = (dn.items || []).map((l, i) => {
    const got = delivered ? l.deliveredQty ?? l.qty : undefined;
    return {
      no: i + 1,
      code: l.itemCode || "",
      description: l.description || "",
      unit: unitOf(l),
      qty: l.qty,
      deliveredQty: got,
      short: delivered && got < l.qty ? Math.round((l.qty - got) * 1000) / 1000 : 0,
      shortReason: l.shortReason || "",
      unitPrice: l.price || 0,
      vatPercent: l.vatPercent ?? 0,
      reverseCharge: isReverseCharge(l) && !(Number(l.vatAmount) > 0), // no VAT is charged on it: "RC" stands where the rate would be
      total: l.lineTotal || 0,
    };
  });
  const source = dn.source?.no ? `${SOURCE_LABEL[dn.source.kind] || ""} ${dn.source.no}`.trim() : "";
  const sheet = {
    layout: "delivery",
    mode: "delivery",
    title: "Delivery note",
    number: { label: "Delivery note no.", value: dn.deliveryNoteNo },
    company: companyBlock(company),
    party: {
      heading: "Deliver to",
      name: customer.customerName || "",
      code: customer.customerId || "",
      address: dn.deliveryAddress || customer.shippingAddress || customer.billingAddress || "",
      contact: [dn.contactPerson, dn.contactPhone].filter(Boolean),
    },
    meta: [
      ["Date", dateOf(dn.date)],
      ["Against", source],
      ["Customer LPO", dn.reference || ""],
      ["Delivered on", delivered ? dateOf(dn.deliveredAt) : ""],
      ["Vehicle", dn.vehicleNo || ""],
    ].filter(([, v]) => v),
    lines,
    showPrices,
    totals: showPrices ? documentTotals(dn) : null,
    currency,
    notes: dn.notes || "",
    notice: "This is a delivery note, not a tax invoice. Please check the goods on receipt and write any shortage or damage on this note before signing.",
    signatures: {
      deliveredBy: [["Driver", dn.driverName], ["Phone", dn.driverPhone], ["Vehicle", dn.vehicleNo]],
      receivedBy: delivered ? [["Name", dn.receivedBy], ["Date", dateOf(dn.deliveredAt)], ["Note", dn.proofNote]] : [],
    },
  };
  return {
    fileName: `Delivery-note_${dn.deliveryNoteNo}`,
    status: dn.status,
    copies: ["Customer copy", "Office copy"],
    sheet,
  };
};

// `pick` is the server's pick list for a note: batches suggested first-expiry-first-out, or the ones
// an approved order already took.
export const buildPickListDocument = (pick, dn, customer, company) => {
  const basis = pick.lines.find((l) => l.basis)?.basis;
  return {
    fileName: `Pick-list_${pick.deliveryNoteNo}`,
    status: dn.status,
    copies: ["Warehouse copy"],
    sheet: {
      layout: "delivery",
      mode: "pick",
      title: "Pick list",
      number: { label: "Delivery note", value: pick.deliveryNoteNo },
      company: companyBlock(company),
      party: { heading: "Customer", name: customer.customerName || pick.customer || "", code: customer.customerId || "", address: "", contact: [] },
      meta: [
        ["Date", dateOf(pick.date)],
        ["Shelf life", pick.minShelfLifeDays > 0 ? `at least ${pick.minShelfLifeDays} days left` : ""],
      ].filter(([, v]) => v),
      lines: pick.lines.map((l, i) => ({
        no: i + 1,
        code: l.itemCode || "",
        description: l.description || "",
        unit: l.unit || "",
        qty: l.qty,
        unallocated: l.unallocated || 0,
        batches: (l.batches || []).map((b) => ({ batchNumber: b.batchNumber, expiryText: b.expiryDate ? dateOf(b.expiryDate) : "", qty: b.qty })),
      })),
      showPrices: false,
      currency: "",
      notes: "",
      notice:
        basis === "allocated"
          ? "For the warehouse only. The batches shown are the ones already taken by the sales order."
          : "For the warehouse only. Batches are suggested first-expiry-first-out from stock on hand; the invoice records the batches actually taken.",
      signatures: null,
    },
  };
};
