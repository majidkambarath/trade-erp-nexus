import { describe, it, expect, afterEach } from "vitest";
import { formatDate, getDateFormat } from "../format";
import { resetOrgLocale, setOrgLocale } from "../orgLocale";
import { buildQuotationDocument } from "../../components/salesDocs/documents";

// How a date is written is the ORGANISATION's, not the browser's.
//
// It used to be read from this browser's localStorage, which was wrong in three ways at once: two
// people printing the SAME invoice produced different dates (indistinguishable to the customer and
// material on a tax invoice); the customer's own copy at /d/:token rendered in THEIR browser's
// default; and nothing on screen said which you were looking at.

afterEach(() => { resetOrgLocale(); localStorage.clear(); });

const quotation = {
  quotationNo: "QT-2026-0001",
  date: "2026-11-09T00:00:00.000Z",
  validUntil: "2026-12-09T00:00:00.000Z",
  items: [{ itemName: "Oil filter", quantity: 1, price: 40, rate: 40, vatPercent: 5, vatAmount: 2, lineTotal: 42 }],
  pricing: { subTotal: 40, totalVat: 2, grandTotal: 42 },
};
const dateRow = () =>
  buildQuotationDocument(quotation, { customerName: "ashik12" }, { companyName: "Al Manara Auto Garage LLC" }, "AED")
    .sheet.meta.find(([k]) => k === "Date")[1];

describe("the date format belongs to the organisation", () => {
  it("follows the organisation, and the device's old preference no longer decides", () => {
    // a stale per-browser choice from before this change, which must now count for nothing
    localStorage.setItem("erp-date-format", "MM/DD/YYYY");
    setOrgLocale({ dateFormat: "DD/MM/YYYY" });
    expect(getDateFormat()).toBe("DD/MM/YYYY");
    expect(formatDate("2026-11-09T00:00:00.000Z")).toBe("09/11/2026");
    expect(dateRow()).toBe("09/11/2026");
  });

  it("changes the printed document the moment the organisation changes it", () => {
    setOrgLocale({ dateFormat: "DD/MM/YYYY" });
    expect(dateRow()).toBe("09/11/2026");
    setOrgLocale({ dateFormat: "MM/DD/YYYY" });
    expect(dateRow()).toBe("11/09/2026");
    setOrgLocale({ dateFormat: "YYYY-MM-DD" });
    expect(dateRow()).toBe("2026-11-09");
    setOrgLocale({ dateFormat: "DD MMM YYYY" });
    expect(dateRow()).toBe("09 Nov 2026");
  });

  // Two people in one organisation, two browsers, one invoice: the same date on both.
  it("gives two different browsers the same date for one invoice", () => {
    setOrgLocale({ dateFormat: "DD/MM/YYYY" });
    const ali = dateRow();
    localStorage.setItem("erp-date-format", "YYYY-MM-DD"); // Sara's old device setting
    const sara = dateRow();
    expect(sara).toBe(ali);
  });
});
