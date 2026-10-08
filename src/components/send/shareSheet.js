// The frozen copy of a document, drawn as the sheet it was sent as. Pure. The server hands over the
// records (whitelisted, utils/shareSnapshot.js on the backend) and the sheet is built by the SAME
// builders the signed-in screens and the PDF attachment use, so the page, the attachment and the print
// cannot disagree about what the document says.
import { buildSalesDocument } from "../PurchaseOrder/shared/invoiceDocuments";

const BUILDERS = {
  tax_invoice: (p) => buildSalesDocument(p.document, p.party || {}, p.company || {}, p.currency || "AED"),
};

// The copies a customer sees: only theirs. The internal copy is ours and never leaves.
const CUSTOMER_COPY = ["Customer copy"];

export function buildFromShare(payload) {
  const build = BUILDERS[payload?.kind];
  if (!build) return null;
  const doc = build(payload);
  return { sheet: doc.sheet, fileName: doc.fileName, copies: CUSTOMER_COPY, title: doc.sheet.title, number: doc.sheet.number?.value || "", company: payload.company || {} };
}

// The sheet is a fixed A4 page, 210mm at 96dpi. On a phone it is scaled down to the width of the screen so
// the whole page is in view and can be pinched, instead of the customer scrolling sideways across it. Never
// scaled UP: on a wide screen the page keeps its true size.
export const SHEET_DESIGN_WIDTH = 794;
export const fitScale = (available, design = SHEET_DESIGN_WIDTH) => {
  const a = Number(available);
  return Number.isFinite(a) && a > 0 ? Math.min(1, a / design) : 1;
};
