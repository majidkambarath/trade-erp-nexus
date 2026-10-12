// A sales or purchase order and a goods received note as the printed page shows them. Pure, like salesDocs/documents.js, so
// what appears on the paper is tested without rendering. Totals come from the server's `pricing` (documentTotals), never
// from summing the lines here, so the order shows what the invoice will show.

import { documentTotals } from "../../utils/documentTotals";
import { isReverseCharge } from "../../lib/reverseCharge";
import { companyBlock } from "../PurchaseOrder/shared/invoiceModel";
import { contactLines, dateOf, partyVatStatus, sheetFor } from "../PurchaseOrder/shared/invoiceDocuments";

export const buildTradeOrderDocument = (order, party, company, currency) => {
  const sales = order.kind === "sales";
  // invoiceLines reads `rate` as the line value after discount: on an order that is taxableAmount
  const items = (order.items || []).map((l) => ({ ...l, rate: l.taxableAmount }));
  const trn = sales ? party.trnNumber || party.vat?.trn || "" : party.trnNO || party.vat?.trn || "";
  const name = sales ? party.customerName : party.vendorName;
  // A registered customer or supplier is shown the Tax invoice heading (as on the invoice pages); an unregistered one gets
  // the plain order heading. The number stays "Order no." and the notice says nothing is posted until the invoice is approved.
  const registered = partyVatStatus(party, trn, name) === "Registered";
  const sheet = sheetFor(
    { ...order, items },
    {
      title: registered ? "Tax invoice" : sales ? "Sales order" : "Purchase order",
      numberLabel: "Order no.",
      number: order.orderNo,
      party: {
        heading: sales ? "Customer" : "Supplier",
        name: name || "",
        code: (sales ? party.customerId : party.vendorId) || "",
        address: (sales ? party.billingAddress : party.address) || "",
        contact: contactLines(party),
        trn,
        vatStatus: partyVatStatus(party, trn, name),
      },
      meta: [
        ["Date", dateOf(order.date)],
        [sales ? "Delivery date" : "Expected delivery", dateOf(order.expectedDate)],
        [sales ? "Customer LPO" : "Vendor reference", order.reference || ""],
        ["Payment terms", party.paymentTerms || ""],
      ],
      company,
      currency,
      notice: registered
        ? `Order ${order.orderNo}. Nothing is posted until the invoice made from it is approved.`
        : sales
          ? "This is a sales order, not an invoice. The invoice is issued from what is delivered."
          : "This is a purchase order, not an invoice. Please deliver the goods listed and send your invoice with them.",
      receipt: false,
      reverseChargeSide: sales ? "supplier" : "recipient",
    }
  );
  return {
    fileName: `${registered ? "Tax-invoice" : sales ? "Sales-order" : "Purchase-order"}_${order.orderNo}`,
    status: order.status,
    missingTrn: false,
    sheet: { ...sheet, terms: order.terms || "" },
  };
};

// The paper that says what a vendor's goods turned out to be. It prints on the delivery layout: what was expected beside what
// was taken in, and a box for who took it.
export const buildGoodsReceivedDocument = (gr, vendor, company, currency, { showPrices = false } = {}) => {
  const received = gr.status === "RECEIVED";
  const lines = (gr.items || []).map((l, i) => {
    const got = received ? l.receivedQty ?? l.qty : undefined;
    return {
      no: i + 1,
      code: l.itemCode || "",
      description: l.description || "",
      unit: l.stockDetails?.unit || "",
      qty: l.qty,
      deliveredQty: got,
      short: received && got < l.qty ? Math.round((l.qty - got) * 1000) / 1000 : 0,
      shortReason: l.shortReason || "",
      unitPrice: l.price || 0,
      vatPercent: l.vatPercent ?? 0,
      reverseCharge: isReverseCharge(l) && !(Number(l.vatAmount) > 0),
      total: l.lineTotal || 0,
    };
  });
  const sheet = {
    layout: "delivery",
    mode: "delivery",
    title: "Goods received note",
    number: { label: "GRN no.", value: gr.receiptNo },
    company: companyBlock(company),
    party: {
      heading: "Received from",
      name: vendor.vendorName || "",
      code: vendor.vendorId || "",
      address: vendor.address || "",
      contact: contactLines(vendor),
    },
    meta: [
      ["Date", dateOf(gr.date)],
      ["Against", gr.source?.no ? `Purchase order ${gr.source.no}` : ""],
      ["Vendor delivery note / invoice", gr.vendorDeliveryNo || ""],
      ["Received on", received ? dateOf(gr.receivedAt) : ""],
      ["Vehicle", gr.vehicleNo || ""],
    ].filter(([, v]) => v),
    lines,
    showPrices,
    totals: showPrices ? documentTotals(gr) : null,
    currency,
    notes: gr.notes || "",
    notice: "This is a goods received note, not an invoice. It records what arrived and in what condition.",
    signatures: {
      deliveredBy: [["Driver", gr.driverName], ["Vehicle", gr.vehicleNo]],
      receivedBy: received ? [["Name", gr.receivedBy], ["Date", dateOf(gr.receivedAt)], ["Note", gr.proofNote]] : [],
    },
  };
  return { fileName: `Goods-received_${gr.receiptNo}`, status: gr.status, copies: ["Office copy", "Store copy"], sheet };
};
