import { afterEach, describe, it, expect } from "vitest";
import {
  bankRows,
  companyBlock,
  localityOf,
  invoiceLines,
  rowsWithValue,
  tint,
  totalInWords,
  vatBreakdown,
  withChargesVat,
} from "../invoiceModel";
import { resetOrgLocale, setOrgLocale } from "../../../../utils/orgLocale";

describe("tint", () => {
  it("mixes the accent with white by the share given", () => {
    expect(tint("#000000", 0.5)).toBe("#808080");
    expect(tint("#ffffff", 0.1)).toBe("#ffffff");
  });
});

describe("invoiceLines", () => {
  it("derives the unit price from the line value and quantity", () => {
    const [line] = invoiceLines([{ itemCode: "QA 1", description: "Dates", qty: 23, rate: 227.7, vatAmount: 11.39, vatPercent: 5 }]);
    expect(line.unitPrice).toBeCloseTo(9.9, 2);
    expect(line.total).toBeCloseTo(239.09, 2);
  });

  it("keeps a stored 0% rate as 0 (it used to print 5)", () => {
    const [line] = invoiceLines([{ qty: 1, rate: 100, vatAmount: 0, vatPercent: 0 }]);
    expect(line.vatPercent).toBe(0);
  });

  it("treats a line with no stored rate as the standard 5%", () => {
    const [line] = invoiceLines([{ qty: 1, rate: 100, vatAmount: 5 }]);
    expect(line.vatPercent).toBe(5);
  });

  it("reads numeric strings from older documents", () => {
    const [line] = invoiceLines([{ qty: "2", rate: "200", vatAmount: "10", vatPercent: "5" }]);
    expect(line.unitPrice).toBe(100);
    expect(line.total).toBe(210);
  });
});

describe("vatBreakdown", () => {
  it("groups the lines by rate, highest rate first", () => {
    const lines = invoiceLines([
      { qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 },
      { qty: 1, rate: 50, vatAmount: 0, vatPercent: 0 },
      { qty: 1, rate: 25, vatAmount: 1.25, vatPercent: 5 },
    ]);
    expect(vatBreakdown(lines)).toEqual([
      { rate: 5, taxable: 125, vat: 6.25 },
      { rate: 0, taxable: 50, vat: 0 },
    ]);
  });

  it("adds a charges row when the charges carry VAT, so the breakdown adds up to the total VAT", () => {
    const rows = vatBreakdown(invoiceLines([{ qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 }]));
    const withCharges = withChargesVat(rows, 6.5);
    expect(withCharges.at(-1)).toEqual({ rate: null, label: "Charges", taxable: 0, vat: 1.5 });
  });

  it("adds no charges row when the lines already account for the VAT", () => {
    const rows = vatBreakdown(invoiceLines([{ qty: 1, rate: 100, vatAmount: 5, vatPercent: 5 }]));
    expect(withChargesVat(rows, 5)).toHaveLength(1);
  });
});

describe("placeholders are never printed", () => {
  it("leaves the company block empty when Settings has nothing", () => {
    const c = companyBlock({});
    expect(c.nameEn).toBe("");
    expect(c.address).toEqual([]);
    expect(c.contact).toEqual([]);
    expect(c.trn).toBe("");
  });

  it("prints only the contact details that are set", () => {
    const c = companyBlock({ phoneNumber: "+971 4 000 0000", email: "" });
    expect(c.contact).toEqual(["Tel: +971 4 000 0000"]);
  });

  it("drops empty bank rows, so an unset account is not printed", () => {
    expect(bankRows({ bankName: "", accountNumber: "", ibanNumber: "AE07 0331" })).toEqual([["IBAN", "AE07 0331"]]);
    expect(bankRows({})).toEqual([]);
  });

  it("drops rows without a value", () => {
    expect(rowsWithValue([["A", "1"], ["B", ""], ["C", null], ["D", undefined], ["E", 0]])).toEqual([["A", "1"], ["E", 0]]);
  });
});

describe("totalInWords", () => {
  it("writes the total in dirhams and fils", () => {
    expect(totalInWords(239.09, "AED")).toBe("Two Hundred Thirty Nine Dirhams and Nine Fils Only");
  });

  it("uses the code for a currency it does not know", () => {
    expect(totalInWords(10, "XYZ")).toContain("XYZ");
  });

  describe("in the organisation's currency", () => {
    afterEach(() => resetOrgLocale());

    it("defaults to the organisation's currency, read when called", () => {
      expect(totalInWords(5.5)).toBe("Five Dirhams and Fifty Fils Only");
      setOrgLocale({ currency: "GBP" });
      expect(totalInWords(5.5)).toBe("Five Pounds and Fifty Pence Only");
      setOrgLocale({ currency: "INR" });
      expect(totalInWords(5.5)).toBe("Five Rupees and Fifty Paise Only");
    });

    it("knows the Gulf riyals", () => {
      expect(totalInWords(2.25, "SAR")).toBe("Two Riyals and Twenty Five Halalas Only");
      expect(totalInWords(2.25, "QAR")).toBe("Two Riyals and Twenty Five Dirhams Only");
    });

    it("an explicit currency still wins over the organisation's", () => {
      setOrgLocale({ currency: "GBP" });
      expect(totalInWords(1, "USD")).toBe("One Dollars Only");
    });

    it("a currency with no entry does not crash and keeps its code", () => {
      setOrgLocale({ currency: "JPY" });
      expect(totalInWords(3)).toContain("JPY");
    });
  });
});

// The letterhead every printed document in the product shares. `companyBlock` feeds InvoiceSheet,
// DeliverySheet and VoucherSheet alike, so these cases guard the invoices, the delivery notes, the
// quotations, the orders, the garage sheets, the job-work challan and the finance vouchers at once.
describe("the whole address on the letterhead", () => {
  it("carries the city and the country, which the sheet never used to show", () => {
    const c = companyBlock({
      companyName: "Al Manara Auto Garage LLC",
      addressLine1: "Warehouse 7",
      city: "Dubai",
      country: "United Arab Emirates",
    });
    expect(c.address).toEqual(["Warehouse 7", "Dubai", "United Arab Emirates"]);
  });

  // A Dubai company has city "Dubai" AND emirate "Dubai". Printing both reads like a fault.
  it("says a repeated place once, whatever its case or spacing", () => {
    const c = companyBlock({ addressLine1: "Warehouse 7", city: "Dubai", state: " dubai ", country: "United Arab Emirates" });
    expect(c.address).toEqual(["Warehouse 7", "Dubai", "United Arab Emirates"]);
  });

  it("keeps a city and an emirate that really are different places", () => {
    const c = companyBlock({ city: "Jebel Ali", state: "Dubai", country: "United Arab Emirates" });
    expect(c.address).toEqual(["Jebel Ali", "Dubai", "United Arab Emirates"]);
  });

  // An organisation that has filled none of it in prints exactly what it printed before.
  it("invents nothing for a profile nobody has completed", () => {
    expect(companyBlock({ companyName: "X", addressLine1: "Deira" }).address).toEqual(["Deira"]);
    expect(companyBlock({}).address).toEqual([]);
  });
});

describe("where a party is", () => {
  // `Customer.eInvoice.countryCode` defaults to "AE" on every record, so a country with no city
  // beside it would print a bare "AE" under every customer the product has.
  it("says nothing for a country code with no city, which every customer has by default", () => {
    expect(localityOf({ eInvoice: { countryCode: "AE" } })).toBe("");
  });

  it("joins a customer's city and country, and is empty without them", () => {
    expect(localityOf({ eInvoice: { city: "Dubai", countryCode: "AE" } })).toBe("Dubai, AE");
    expect(localityOf({ eInvoice: { city: "Dubai" } })).toBe("Dubai");
    expect(localityOf({ customerName: "No e-invoice block" })).toBe("");
    expect(localityOf(undefined)).toBe("");
  });
});
