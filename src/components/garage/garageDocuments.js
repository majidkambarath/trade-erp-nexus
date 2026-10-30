// The three sheets a garage prints, built on the same DeliverySheet layout every delivery note and pick list
// already use (CLAUDE.md garage plan, Phase 1/4: "Print sheets on the existing InvoiceScreen ... the
// DeliverySheet layout"). Pure, like salesDocs/documents.js - what is on the paper is a function of the job
// card, never a server call of its own.
import { companyBlock } from "../PurchaseOrder/shared/invoiceModel";
import { dateOf } from "../PurchaseOrder/shared/invoiceDocuments";
import { formatDate, formatDateTime } from "../../utils/format";

// A stored promisedAt may be a bare day (UTC midnight, no time ever given) or a real wall-clock time in
// the organisation's zone (jobCardService.js promisedInstant, D07). UTC midnight prints as the day alone,
// never as a fabricated "00:00" nobody actually promised.
function promisedText(promisedAt) {
  if (!promisedAt) return "";
  const d = new Date(promisedAt);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return dateOf(promisedAt);
  return formatDateTime(d);
}

// `vatPercent`/`taxableAmount`/`vatAmount` are the pricing engine's own figures, stamped onto the
// stored line by jobCardService#priceAndStampLines and declared on jobCardModel's lineSchema so
// they actually persist (they did not, before - see D01/jobCardModel.js). A line priced before
// that fix has none of them and reads as 0, which is honest for an old record, not a bug here.
// The row's total is taxable + VAT, computed here rather than read from `l.lineTotal`: JobCardService
// .present() OVERWRITES lineTotal on every read with rules.lineValue(l), the PRE-VAT figure jobTotals
// and the board use - reading it here would print a VAT-exclusive total beside a VAT-inclusive rate.
// Matches JobCardForm.jsx's FUEL_LEVELS - "1/4"/"1/2"/"3/4" already read as their own label.
const FUEL_LABEL = { E: "Empty", F: "Full" };

const lineRow = (l, i, { withPrice } = {}) => {
  const taxable = Number(l.taxableAmount) || 0;
  const vatAmount = Number(l.vatAmount) || 0;
  return {
    no: i + 1,
    code: l.kind ? l.kind.toUpperCase() : "",
    description: l.description || "",
    unit: "",
    qty: l.qty,
    unitPrice: withPrice ? l.price || 0 : undefined,
    vatPercent: withPrice ? l.vatPercent || 0 : 0,
    total: withPrice ? taxable + vatAmount : undefined,
  };
};

// The job card itself: what the shop floor works from - complaints, approved tasks and who/where, no prices.
// Not a tax document, so it carries no VAT and no totals (plan 1.2 step 7 - this is the working document, the
// estimate below is what the customer sees).
export function buildJobCardDocument(card, company, currency) {
  const lines = (card.lines || []).map((l, i) => lineRow(l, i, { withPrice: false }));
  const tasksText = (card.tasks || []).map((t) => `${t.stage}. ${t.name} (${t.mode === "sublet" ? t.vendorName || "sent out" : t.staffName || "unassigned"}${t.bayName ? `, ${t.bayName}` : ""})`).join("\n");
  // The walk-around (D08): saved but never printed before. The gate pass already shows the items-present
  // checklist as its own "lines"; here it is text, beside the damage marks and the condition notes, since
  // this is the workshop's defence against "the car arrived undamaged" and must be on the one document the
  // car physically travels with from the start.
  const checkInText = [
    card.checkIn?.itemsPresent?.length ? `With them: ${card.checkIn.itemsPresent.join(", ")}` : "",
    card.checkIn?.damagePoints?.length
      ? "Noted on arrival:\n" + card.checkIn.damagePoints.map((d) => `- ${d.panel}: ${d.kind}${d.notes ? ` (${d.notes})` : ""}`).join("\n")
      : "",
    card.checkIn?.notes ? `Condition: ${card.checkIn.notes}` : "",
  ].filter(Boolean).join("\n");
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
        ["Promised", promisedText(card.promisedAt)],
        ["Odometer in", card.odometerIn ? `${card.odometerIn} km` : ""],
        ["Fuel", FUEL_LABEL[card.fuelLevelIn] || card.fuelLevelIn || ""],
      ].filter(([, v]) => v),
      lines: lines.map((l) => ({ ...l, batches: [], unallocated: 0 })),
      showPrices: false,
      currency,
      notes: [
        ...(checkInText ? ["Check-in:\n" + checkInText, ""] : []),
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
  const rawLines = card.lines || [];
  const lines = rawLines.map((l, i) => ({ ...lineRow(l, i, { withPrice: true }), batches: [], unallocated: 0, description: `${l.description || ""}${l.approved === false ? " (not approved)" : ""}` }));
  // The net and VAT of every line shown, approved or not - not card.totals (jobTotals), which is the
  // APPROVED-only pre-VAT figure the board and the invoice warning use. The estimate's own total must
  // equal what the rows above it add up to, whole estimate included.
  const gross = rawLines.reduce((t, l) => t + (Number(l.taxableAmount) || 0), 0);
  const vat = rawLines.reduce((t, l) => t + (Number(l.vatAmount) || 0), 0);
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
      totals: { gross, vat, grandTotal: gross + vat },
      currency,
      notes: "",
      notice: "This is an estimate, not a tax invoice. Work starts only on the lines approved.",
      // No signature boxes: DeliverySheet always draws BOTH ("Delivered by" / "Received by"), which reads
      // oddly on a document nothing has been delivered against yet. The approval itself is recorded
      // electronically (recordApproval) with who gave it and how (WhatsApp, a call, an LPO...).
      signatures: null,
    },
  };
}

// Both limits, when both are set - the rule (utils/garage.js warrantyUntil) is whichever runs out first, so
// printing only one invites an argument the other would have settled.
function warrantyText(w) {
  const parts = [];
  if (w?.until) parts.push(`Until ${dateOf(w.until)}`);
  if (w?.untilOdometer) parts.push(`${w.untilOdometer} km`);
  return parts.length ? parts.join(" or ") : "None recorded";
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
        // Whichever runs out first ends the warranty (utils/garage.js warrantyUntil) - print both when both
        // are set, not one or the other (D09).
        ["Warranty", warrantyText(card.warranty)],
      ].filter(([, v]) => v),
      lines,
      showPrices: false,
      currency,
      notes: "Please check the items above and the vehicle's condition before leaving.",
      notice: "This pass permits the vehicle to leave the premises.",
      signatures: {
        // releasedByName is resolved server-side (JobCardService.getById, D09); a raw account id is never
        // printed - "Unknown user" is the frontend's own wording for an account removed since (the house
        // rule: InventoryManagement.jsx whoText), never the server's.
        deliveredBy: [["Released by", card.delivery?.releasedBy ? card.delivery.releasedByName || "Unknown user" : ""]],
        receivedBy: [["Name", card.delivery?.handedTo || ""], ["Signature", ""], ["Date", card.delivery?.gatePassAt ? formatDate(card.delivery.gatePassAt) : ""]],
      },
    },
  };
}
