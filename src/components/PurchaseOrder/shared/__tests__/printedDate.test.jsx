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
    // and the date is drawn with PROPORTIONAL figures. This is the whole of the visible fix:
    // tabular figures pad the narrow "1" out to a full digit slot and the padding lands as
    // whitespace before the slash - measured in Chrome, Inter's "1" goes from 41.5 to 64.8 units
    // under tabular-nums. That is what printed "11 /11 /2026". Arial (the fallback when the
    // webfont does not load) is tabular BY DEFAULT, which is why this is named rather than
    // simply left off: Inter's default is already proportional, Arial's is not.
    expect(html).toContain("proportional-nums");
  });

  // The failure the user photographed, as a test: a date of all ones is the worst case for
  // tabular figures - four narrow "1"s, each padded, so a gap appears before every slash.
  it("renders a date of all ones without padding any digit", () => {
    setDateFormat("DD/MM/YYYY");
    const allOnes = { ...quotation, date: "2026-11-11T00:00:00.000Z", validUntil: "2026-11-11T00:00:00.000Z" };
    const sheet = buildQuotationDocument(allOnes, customer, company, "AED").sheet;
    expect(metaValue(sheet, "Date")).toBe("11/11/2026");
    const html = frameHtml(sheetMarkup(sheet, { copy: "Customer copy", accent: readAccent() }));
    expect(html).toContain("11/11/2026");
    expect(html).toContain("proportional-nums");
  });
});
