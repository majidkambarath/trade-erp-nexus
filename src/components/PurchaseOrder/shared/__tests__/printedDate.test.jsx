import { describe, it, expect } from "vitest";
import { FONT_HREF, frameHtml, sheetMarkup } from "../documentPdf";
import { buildQuotationDocument } from "../../../salesDocs/documents";
import { readAccent } from "../invoiceModel";
import { setDateFormat } from "../../../../utils/format";

// A printed quotation showed its date as "09/11 /2026": the day and month clotted, an odd gap
// before the last slash. The string itself was always exactly "09/11/2026" - the gaps came from
// the print frame, which is built from a bare srcdoc and so inherited no font from the app. Inter
// fell back to Arial, whose slash has a narrow left and a wide right sidebearing, and html2canvas
// then baked that into a JPEG. These tests pin both halves of the fix.

const quotation = {
  quotationNo: "QT-2026-0001",
  date: "2026-11-09T00:00:00.000Z",
  validUntil: "2026-12-09T00:00:00.000Z",
  status: "SENT",
  items: [{ itemName: "Shop supplies & consumables", quantity: 5, price: 50, rate: 250, vatPercent: 5, vatAmount: 12.5, lineTotal: 262.5 }],
  pricing: { subTotal: 250, totalVat: 12.5, grandTotal: 262.5 },
};
const customer = { customerName: "Golden Arrow Auto Repair Workshop - L.L.C -S.P.C", paymentTerms: "Net 30" };
const company = { companyName: "Golden Arrow Auto Repair Workshop - L.L.C -S.P.C", vatNumber: "100123456700003" };

// buildQuotationDocument returns { fileName, status, sheet }; the sheet is what is printed.
const sheetOf = () => buildQuotationDocument(quotation, customer, company, "AED").sheet;
const metaValue = (sheet, key) => sheet.meta.find(([k]) => k === key)?.[1];

describe("the date on a printed document", () => {
  it("is the plain format with no stray spacing", () => {
    setDateFormat("DD/MM/YYYY");
    const sheet = sheetOf();
    expect(metaValue(sheet, "Date")).toBe("09/11/2026");
    expect(metaValue(sheet, "Valid until")).toBe("09/12/2026");
    // the shape of the bug: no space may creep in beside a slash
    expect(metaValue(sheet, "Date")).not.toMatch(/\s/);
  });

  it("reaches the paper unchanged, and the frame carries the font that draws it evenly", () => {
    setDateFormat("DD/MM/YYYY");
    const sheet = sheetOf();
    const html = frameHtml(sheetMarkup(sheet, { copy: "Customer copy", accent: readAccent() }));

    expect(html).toContain("09/11/2026");
    // without this link the frame has no Inter and falls back to Arial - the whole bug
    expect(html).toContain(`href="${FONT_HREF}"`);
    expect(FONT_HREF).toContain("family=Inter");
    // and the figures in that column are drawn at a fixed width so they line up
    expect(html).toContain("tabular-nums");
  });
});
