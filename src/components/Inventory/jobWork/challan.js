// The paper our parts travel on to the job worker (a coater). Pure, so what is printed is tested without rendering; it
// prints on the delivery layout (PurchaseOrder/shared/DeliverySheet.jsx) through InvoiceScreen.
//
// India: a delivery challan under Rule 55 of the CGST Rules, 2017 for goods sent for job work under Section 143 of the
// CGST Act - not a supply, no GST charged, issued in triplicate, with the job worker's GSTIN, the quantity and the value
// of the goods, and back within a year. Elsewhere: a plain subcontracting dispatch note (our goods, not sold).
import { companyBlock } from "../../PurchaseOrder/shared/invoiceModel";
import { contactLines, dateOf } from "../../PurchaseOrder/shared/invoiceDocuments";
import { formatNumber } from "../../../utils/format";

const taxLabelOf = (country) => (country === "IN" ? "GSTIN" : country === "AE" ? "TRN" : "Tax no.");
const qtyText = (n) => formatNumber(n ?? 0, 3).replace(/\.?0+$/, "");

export function buildJobWorkChallan(job, company, { country = "AE", currency = "" } = {}) {
  const india = country === "IN";
  const taxLabel = taxLabelOf(country);
  const value = (job.lines || []).reduce((s, l) => s + (Number(l.qtySent) || 0) * (Number(l.unitValue) || 0), 0);
  const worker = job.jobWorker || {};
  const lines = (job.lines || []).map((l, i) => ({
    no: i + 1,
    code: l.rawItemId || "",
    description: `${l.rawName}${job.purpose ? ` - for ${job.purpose.toLowerCase()}` : ""}. Returns as ${l.finishedName}${Number(l.finishedPerRaw) !== 1 ? ` (${qtyText(l.finishedPerRaw)} per unit sent)` : ""}. Value ${currency} ${formatNumber((Number(l.qtySent) || 0) * (Number(l.unitValue) || 0), 2)}`,
    unit: "",
    qty: l.qtySent,
  }));
  const sheet = {
    layout: "delivery",
    mode: "delivery",
    title: india ? "Delivery challan - job work" : "Subcontracting dispatch note",
    number: { label: india ? "Challan no." : "Dispatch no.", value: job.jobWorkNo || "Draft" },
    company: { ...companyBlock(company), taxLabel },
    party: {
      heading: "Job worker",
      name: worker.name || "",
      code: worker.code || "",
      address: worker.address || "",
      contact: contactLines({ phone: worker.phone }),
      taxId: worker.taxId || "",
      taxLabel,
    },
    meta: [
      ["Date of dispatch", dateOf(job.date)],
      ["Purpose", job.purpose || "Job work"],
      ["Value of goods", `${currency} ${formatNumber(value, 2)}`],
      [india ? "To be returned by" : "Expected back by", job.returnBy ? dateOf(job.returnBy) : ""],
      ["Vehicle", job.vehicleNo || ""],
    ].filter(([, v]) => v),
    lines,
    showPrices: false,
    totals: null,
    currency,
    notes: job.notes || "",
    notice: india
      ? `Goods sent for job work under Section 143 of the CGST Act, 2017, on a challan under Rule 55 of the CGST Rules, 2017. Not a supply: no GST is charged. They remain ours and are to be returned${job.returnBy ? ` by ${dateOf(job.returnBy)}` : " within one year"}.`
      : "Our goods sent to you for processing. They remain our property and are not sold; please return them with the work done.",
    signatures: { deliveredBy: [["Driver", ""], ["Vehicle", job.vehicleNo || ""]], receivedBy: [] },
  };
  return {
    fileName: `${india ? "Job-work-challan" : "Dispatch-note"}_${job.jobWorkNo || "draft"}`,
    copies: india ? ["Original for the job worker", "Duplicate for the transporter", "Triplicate for us"] : ["Job worker copy", "Office copy"],
    sheet,
  };
}
