// The three sheets a garage prints, built on the same DeliverySheet layout every delivery note and pick list
// already use (CLAUDE.md garage plan, Phase 1/4: "Print sheets on the existing InvoiceScreen ... the
// DeliverySheet layout"). Pure, like salesDocs/documents.js - what is on the paper is a function of the job
// card, never a server call of its own.
import { companyBlock } from "../PurchaseOrder/shared/invoiceModel";
import { dateOf } from "../PurchaseOrder/shared/invoiceDocuments";
import { formatDate } from "../../utils/format";

const lineRow = (l, i, { withPrice } = {}) => ({
  no: i + 1,
  code: l.kind ? l.kind.toUpperCase() : "",
  description: l.description || "",
  unit: "",
  qty: l.qty,
  unitPrice: withPrice ? l.price || 0 : undefined,
  vatPercent: 0,
  total: withPrice ? l.lineTotal || 0 : undefined,
});

// The job card itself: what the shop floor works from - complaints, approved tasks and who/where, no prices.
// Not a tax document, so it carries no VAT and no totals (plan 1.2 step 7 - this is the working document, the
// estimate below is what the customer sees).
export function buildJobCardDocument(card, company, currency) {
  const lines = (card.lines || []).map((l, i) => lineRow(l, i, { withPrice: false }));
  const tasksText = (card.tasks || []).map((t) => `${t.stage}. ${t.name} (${t.mode === "sublet" ? t.vendorName || "sent out" : t.staffName || "unassigned"}${t.bayName ? `, ${t.bayName}` : ""})`).join("\n");
  return {
    fileName: `Job-card_${card.jobNo || "draft"}`,
    status: card.status,
    copies: ["Workshop copy"],
    sheet: {
      layout: "delivery",
      mode: "delivery",
      title: "Job card",
      number: { label: "Job card no.", value: card.jobNo || "(draft)" },
      company: companyBlock(company),
      party: {
        heading: "Customer",
        name: card.customer?.name || "",
        code: "",
        address: "",
        contact: [card.customer?.phone].filter(Boolean),
      },
      meta: [
        ["Vehicle", `${card.vehicle?.plateNumber || card.vehicle?.chassisNo || ""} - ${[card.vehicle?.make, card.vehicle?.model].filter(Boolean).join(" ")}`],
        ["Received", dateOf(card.receivedAt)],
        ["Promised", dateOf(card.promisedAt)],
        ["Odometer in", card.odometerIn ? `${card.odometerIn} km` : ""],
        ["Fuel", card.fuelLevelIn || ""],
      ].filter(([, v]) => v),
      lines: lines.map((l) => ({ ...l, batches: [], unallocated: 0 })),
      showPrices: false,
      currency,
      notes: [
        "What the customer reported:",
        ...(card.complaints || []).map((c) => `- ${c.concern}${c.cause ? ` / found: ${c.cause}` : ""}${c.correction ? ` / done: ${c.correction}` : ""}`),
        tasksText ? "\nTasks:\n" + tasksText : "",
      ].join("\n"),
      notice: "Workshop copy. Not a tax invoice.",
      signatures: null,
    },
  };
}

// The estimate, priced, for the customer or the insurer to approve - the document this module's whole approval
// step turns on (plan 1.2 step 6). Shows every line, approved or not, so a partial approval is seen next to
// what was declined.
export function buildEstimateDocument(card, company, currency) {
  const lines = (card.lines || []).map((l, i) => ({ ...lineRow(l, i, { withPrice: true }), batches: [], unallocated: 0, description: `${l.description || ""}${l.approved === false ? " (not approved)" : ""}` }));
  return {
    fileName: `Estimate_${card.jobNo || "draft"}`,
    status: card.status,
    copies: ["Customer copy"],
    sheet: {
      layout: "delivery",
      mode: "delivery",
      title: "Estimate",
      number: { label: "Job card no.", value: card.jobNo || "(draft)" },
      company: companyBlock(company),
      party: {
        heading: "Estimate for",
        name: card.customer?.name || "",
        code: "",
        address: "",
        contact: [card.customer?.phone].filter(Boolean),
      },
      meta: [
        ["Vehicle", `${card.vehicle?.plateNumber || card.vehicle?.chassisNo || ""} - ${[card.vehicle?.make, card.vehicle?.model].filter(Boolean).join(" ")}`],
        ["Date", dateOf(card.estimate?.sentAt || new Date())],
        ["Version", card.estimate?.version ? `v${card.estimate.version}` : ""],
      ].filter(([, v]) => v),
      lines,
      showPrices: true,
      totals: { gross: card.totals?.total || 0, vat: 0, grandTotal: card.totals?.total || 0 },
      currency,
      notes: "",
      notice: "This is an estimate, not a tax invoice. Work starts only on the lines approved.",
      signatures: { deliveredBy: [], receivedBy: [["Name", ""], ["Signature", ""], ["Date", ""]] },
    },
  };
}

// The gate pass: what the car had with it coming in, confirmed again going out, the odometer and the warranty
// it leaves with (plan 1.2 step 13). The "lines" are the walk-around's own checklist, not a priced estimate.
export function buildGatePassDocument(card, company, currency) {
  const items = card.checkIn?.itemsPresent || [];
  const lines = items.map((it, i) => ({ no: i + 1, code: "", description: it, unit: "", qty: 1, batches: [], unallocated: 0 }));
  return {
    fileName: `Gate-pass_${card.jobNo || "draft"}`,
    status: card.status,
    copies: ["Customer copy", "Gate copy"],
    sheet: {
      layout: "delivery",
      mode: "delivery",
      title: "Gate pass",
      number: { label: "Job card no.", value: card.jobNo || "(draft)" },
      company: companyBlock(company),
      party: {
        heading: "Released to",
        name: card.delivery?.handedTo || card.customer?.name || "",
        code: "",
        address: "",
        contact: [card.customer?.phone].filter(Boolean),
      },
      meta: [
        ["Vehicle", `${card.vehicle?.plateNumber || card.vehicle?.chassisNo || ""} - ${[card.vehicle?.make, card.vehicle?.model].filter(Boolean).join(" ")}`],
        ["Released", card.delivery?.gatePassAt ? formatDate(card.delivery.gatePassAt) : ""],
        ["Odometer out", card.delivery?.odometerOut ? `${card.delivery.odometerOut} km` : ""],
        ["Warranty", card.warranty?.until ? `Until ${dateOf(card.warranty.until)}` : card.warranty?.untilOdometer ? `Until ${card.warranty.untilOdometer} km` : "None recorded"],
      ].filter(([, v]) => v),
      lines,
      showPrices: false,
      currency,
      notes: "Please check the items above and the vehicle's condition before leaving.",
      notice: "This pass permits the vehicle to leave the premises.",
      signatures: {
        deliveredBy: [["Released by", card.delivery?.releasedBy || ""]],
        receivedBy: [["Name", card.delivery?.handedTo || ""], ["Signature", ""], ["Date", card.delivery?.gatePassAt ? formatDate(card.delivery.gatePassAt) : ""]],
      },
    },
  };
}
