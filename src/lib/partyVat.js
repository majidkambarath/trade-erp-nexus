// A customer's or vendor's VAT registration, and what it means for the document in front of the person. Pure.
//
// The master stores `vat.status` (registered / unregistered / exempt / designated_zone) and `vat.trn`; a record saved before
// that block existed has neither, and its TRN sits in `trnNumber` (customers) or `trnNO` (vendors). Registered means a TRN,
// so a party with a TRN and no stated status is registered, and one with neither is not.

export const VAT_LABEL = {
  registered: "VAT registered",
  unregistered: "Not VAT registered",
  exempt: "VAT exempt",
  designated_zone: "Designated zone",
};

const TONE = { registered: "success", unregistered: "neutral", exempt: "info", designated_zone: "info" };

/** { status, label, tone, trn, missingTrn } for a party record, or null when there is no party. */
export function partyVat(party) {
  if (!party) return null;
  const trn = String(party.vat?.trn || party.trnNumber || party.trnNO || "").trim();
  const given = party.vat?.status;
  const status = VAT_LABEL[given] ? given : trn ? "registered" : "unregistered";
  // a registered party's documents must carry its TRN, so a registration with no number is something to put right
  const missingTrn = (status === "registered" || status === "designated_zone") && !trn;
  return { status, label: VAT_LABEL[status], tone: TONE[status], trn, missingTrn };
}

/**
 * What to tell the person about this party on this document: [{ tone: "warning" | "info", text }].
 *   partyType   "Customer" (a sale) or "Vendor" (a purchase)
 *   vatAmount   the VAT on the document so far (0 when there is none)
 * Nothing here blocks anything; the server decides what it refuses.
 */
export function vatAdvice({ partyType, party, vatAmount = 0 }) {
  const v = partyVat(party);
  if (!v) return [];
  const vendor = partyType === "Vendor";
  const out = [];

  if (v.missingTrn) {
    out.push({
      tone: "warning",
      text: vendor
        ? "This vendor is marked VAT registered but has no TRN on file. VAT on this purchase can only be claimed back against an invoice that shows the vendor's TRN, so add it to the vendor."
        : "This customer is marked VAT registered but has no TRN on file. A tax invoice to a registered customer must show their TRN, so add it to the customer before you invoice.",
    });
  }

  if (v.status === "unregistered") {
    if (vendor && Number(vatAmount) > 0.005) {
      out.push({
        tone: "warning",
        text: "This vendor is not VAT registered, so it cannot charge VAT and the VAT on this purchase cannot be claimed back. Check the tax code on each line (use an out-of-scope or no-VAT code), or ask the vendor for a tax invoice with its TRN.",
      });
    } else if (vendor) {
      out.push({ tone: "info", text: "This vendor is not VAT registered: no VAT should be charged on this purchase, and none can be claimed back." });
    } else {
      out.push({ tone: "info", text: "This customer is not VAT registered, so no customer TRN is printed. VAT is charged on the sale as normal." });
    }
  }

  if (v.status === "exempt") {
    out.push({ tone: "info", text: `This ${vendor ? "vendor" : "customer"} is marked VAT exempt. Check the tax code on each line.` });
  }
  if (v.status === "designated_zone") {
    out.push({ tone: "info", text: `This ${vendor ? "vendor" : "customer"} is in a designated zone. Check the tax treatment of each line, because some supplies to and from a designated zone are treated differently.` });
  }
  return out;
}
