import { describe, expect, it } from "vitest";
import {
  REGISTER_CSV_HEADERS, convertToBaseCents, currencyOptions, currencyState, decimalPlaces, deviationPercent, emptyFx, foreignForBase,
  formatForeign, formatRate, fxLine, fxPayload, fxProvenance, hasForeignOptions, isForeign, rateCheck, registerCsvRows, typedAmount, typedRate,
  validateCurrencyForm, validateForeign, validateRateForm, validateTolerance,
} from "../currencyForms";

const LIST = [
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, isActive: true, latestRate: 3.6725 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2, isBase: true, isActive: true, latestRate: 1 },
  { code: "EUR", name: "Euro", decimals: 2, isActive: true, latestRate: null },
  { code: "GBP", name: "Pound Sterling", decimals: 2, isActive: false, latestRate: 4.6 },
  { code: "KWD", name: "Kuwaiti Dinar", decimals: 3, isActive: true, latestRate: 11.95 },
];

describe("converting a foreign amount to AED", () => {
  it("is exact and rounds half up to the cent, as the server does", () => {
    expect(convertToBaseCents(1000, 3.6725)).toBe(367250);
    expect(convertToBaseCents("1,000.50".replace(/,/g, ""), 3.6725)).toBe(367434); // 3674.33625
    expect(convertToBaseCents(0.1 + 0.2, 10)).toBe(300);
    expect(convertToBaseCents(10.5, 11.95, 3)).toBe(12548); // 125.475 is a half: up
    expect(convertToBaseCents(5000, 1.234567)).toBe(617284);
    expect(convertToBaseCents(123456789.12, 3.6725)).toBe(45339505804);
  });

  it("is zero until there is an amount and a rate", () => {
    expect(convertToBaseCents("", 3.6725)).toBe(0);
    expect(convertToBaseCents(100, "")).toBe(0);
    expect(convertToBaseCents(-5, 3.6725)).toBe(0);
  });

  it("finds the foreign amount that covers an AED sum, no more than a unit too much", () => {
    expect(foreignForBase(367250, 3.6725)).toBe(1000);
    const f = foreignForBase(100000, 3.6725); // AED 1,000
    expect(convertToBaseCents(f, 3.6725)).toBeGreaterThanOrEqual(100000);
    expect(convertToBaseCents(f - 0.01, 3.6725)).toBeLessThan(100000);
    expect(foreignForBase(0, 3.6725)).toBe(0);
    expect(foreignForBase(1000, 0)).toBe(0);
  });
});

describe("typing amounts and rates", () => {
  it("allows as many decimals as the currency has", () => {
    expect(typedAmount("1,000.5", 2)).toBe("1000.5");
    expect(typedAmount("10.123", 2)).toBeNull();
    expect(typedAmount("10.123", 3)).toBe("10.123");
    expect(typedAmount("10.5", 0)).toBeNull();
    expect(typedAmount("abc", 2)).toBeNull();
    expect(typedAmount("", 2)).toBe("");
  });
  it("allows a rate to six decimals", () => {
    expect(typedRate("3.672500")).toBe("3.672500");
    expect(typedRate("3.6725001")).toBeNull();
    expect(typedRate("-1")).toBeNull();
  });
  it("counts decimal places", () => {
    expect(decimalPlaces(3.6725)).toBe(4);
    expect(decimalPlaces(1e-7)).toBe(7);
    expect(decimalPlaces(100)).toBe(0);
  });
});

describe("a typed rate against the rate on file", () => {
  it("needs no reason inside the tolerance", () => {
    const c = rateCheck({ rate: "3.7", masterRate: 3.6725, tolerancePercent: 5 });
    expect(c).toMatchObject({ deviation: 0.75, differs: true, outside: false, reasonMissing: false });
  });
  it("needs a reason outside it, and a short one does not count", () => {
    expect(rateCheck({ rate: "3.9", masterRate: 3.6725, tolerancePercent: 5 })).toMatchObject({ deviation: 6.19, outside: true, reasonMissing: true });
    expect(rateCheck({ rate: "3.9", masterRate: 3.6725, tolerancePercent: 5, reason: "x" }).reasonMissing).toBe(true);
    expect(rateCheck({ rate: "3.9", masterRate: 3.6725, tolerancePercent: 5, reason: "Agreed" }).reasonMissing).toBe(false);
  });
  it("is the master rate when equal, and says nothing without one", () => {
    expect(rateCheck({ rate: "3.6725", masterRate: 3.6725 })).toMatchObject({ differs: false, outside: false });
    expect(rateCheck({ rate: "3.9", masterRate: null }).outside).toBe(false);
    expect(rateCheck({ rate: "", masterRate: 3.6725 }).outside).toBe(false);
  });
  it("measures from the rate on file and honours a tolerance of zero", () => {
    expect(deviationPercent(3.5, 4)).toBe(12.5);
    expect(rateCheck({ rate: "3.673", masterRate: 3.6725, tolerancePercent: 0 }).outside).toBe(true);
  });
});

describe("the foreign part of a voucher form", () => {
  const master = { rate: 3.6725, tolerancePercent: 5 };
  const fx = (over) => ({ ...emptyFx(), currency: "USD", foreignAmount: "1000", rate: "3.6725", ...over });

  it("asks for nothing in AED", () => {
    expect(validateForeign({ fx: emptyFx(), master: null })).toEqual({});
    expect(fxPayload(emptyFx(), null)).toEqual({});
  });
  it("needs an amount and a rate on file", () => {
    expect(validateForeign({ fx: fx({ foreignAmount: "" }), master }).foreignAmount).toBe("Enter the amount in USD");
    expect(validateForeign({ fx: fx(), master: null, masterError: "No USD rate on or before 04/10/2026. Add one under Currencies." }).exchangeRate).toMatch(/^No USD rate/);
    expect(validateForeign({ fx: fx(), master: null }).exchangeRate).toMatch(/still loading/);
    expect(validateForeign({ fx: fx({ rate: "" }), master }).exchangeRate).toBe("Enter the exchange rate");
    expect(validateForeign({ fx: fx(), master })).toEqual({});
  });
  it("asks for the reason only when the rate is further away than allowed", () => {
    expect(validateForeign({ fx: fx({ rate: "3.7" }), master })).toEqual({});
    expect(validateForeign({ fx: fx({ rate: "3.9" }), master }).rateOverrideReason).toMatch(/6\.19% away/);
    expect(validateForeign({ fx: fx({ rate: "3.9", reason: "Agreed with customer" }), master })).toEqual({});
  });
  it("sends the currency, amount and rate, and the reason only when it was needed", () => {
    expect(fxPayload(fx(), master)).toEqual({ currency: "USD", foreignAmount: 1000, exchangeRate: 3.6725 });
    expect(fxPayload(fx({ rate: "3.7", reason: "ignored" }), master)).toEqual({ currency: "USD", foreignAmount: 1000, exchangeRate: 3.7 });
    expect(fxPayload(fx({ rate: "3.9", reason: " Agreed with customer " }), master)).toEqual({ currency: "USD", foreignAmount: 1000, exchangeRate: 3.9, rateOverrideReason: "Agreed with customer" });
  });
});

describe("which currencies a voucher may use", () => {
  it("offers AED first, then active currencies that have a rate", () => {
    expect(currencyOptions(LIST).map((o) => o.value)).toEqual(["AED", "KWD", "USD"]);
    expect(currencyOptions(LIST)[0]).toMatchObject({ value: "AED", hint: "UAE Dirham" });
  });
  it("offers nothing to choose while only AED is usable", () => {
    expect(hasForeignOptions(LIST)).toBe(true);
    expect(hasForeignOptions([LIST[1]])).toBe(false);
    expect(hasForeignOptions(LIST.filter((c) => c.code !== "USD" && c.code !== "KWD"))).toBe(false);
    expect(hasForeignOptions(null)).toBe(false);
    expect(currencyOptions(undefined)).toEqual([]);
    expect(currencyOptions([{ _id: "i1", transactionNo: "SO-1" }])).toEqual([]); // not a currency list at all
  });
});

describe("showing a foreign voucher", () => {
  const v = { currency: "USD", foreignAmount: 1000, exchangeRate: 3.6725, totalAmount: 3672.5, rateDate: "2026-10-01T00:00:00Z", rateSource: "cbuae" };
  it("reads USD 1,000.00 @ 3.6725 = AED 3,672.50", () => {
    expect(fxLine(v)).toBe("USD 1,000.00 @ 3.6725 = AED 3,672.50");
    expect(isForeign(v)).toBe(true);
  });
  it("keeps three decimals for dinars and four decimals on a rate at least", () => {
    expect(formatForeign(10.5, "KWD")).toBe("KWD 10.50");
    expect(formatForeign(10.125, "KWD")).toBe("KWD 10.125");
    expect(formatRate(3.7)).toBe("3.7000");
    expect(formatRate(3.123456)).toBe("3.123456");
  });
  it("says nothing for an AED voucher", () => {
    expect(isForeign({ currency: "AED", totalAmount: 100 })).toBe(false);
    expect(fxLine({ currency: "AED", exchangeRate: 1, totalAmount: 100 })).toBe("");
    expect(fxProvenance({ currency: "AED" })).toBe("");
    expect(isForeign(null)).toBe(false);
  });
  it("says where the rate came from and why it was overridden", () => {
    expect(fxProvenance(v)).toBe("Rate of 01/10/2026 (Central Bank of the UAE)");
    expect(fxProvenance({ ...v, rateSource: "voucher", rateOverridden: true, rateOverrideReason: "Agreed with customer" })).toBe("Rate of 01/10/2026 (Typed on the voucher). Overrode the rate on file: Agreed with customer");
  });
});

describe("the currencies page", () => {
  it("names the state of each row", () => {
    expect(currencyState({ isBase: true })).toMatchObject({ key: "base", label: "Base currency" });
    expect(currencyState({ isActive: false, latestRate: 3.6 })).toMatchObject({ key: "off", label: "Off" });
    expect(currencyState({ isActive: true, latestRate: null })).toMatchObject({ key: "norate", label: "No rate yet", tone: "warning" });
    expect(currencyState({ isActive: true, latestRate: 3.6 })).toMatchObject({ key: "ready" });
  });
  it("checks a new rate", () => {
    expect(validateRateForm({ rate: "", effectiveDate: "2026-10-04" }).rate).toMatch(/greater than zero/);
    expect(validateRateForm({ rate: "0", effectiveDate: "2026-10-04" }).rate).toMatch(/greater than zero/);
    expect(validateRateForm({ rate: "3.6725", effectiveDate: "" }).effectiveDate).toBeTruthy();
    expect(validateRateForm({ rate: "3.6725", effectiveDate: "2026-10-04" })).toEqual({});
  });
  it("checks a new currency against the list", () => {
    const ok = { code: "jod", name: "Jordanian Dinar", decimals: "3" };
    expect(validateCurrencyForm(ok, [])).toEqual({});
    expect(validateCurrencyForm({ ...ok, code: "JO" }, []).code).toBeTruthy();
    expect(validateCurrencyForm({ ...ok, code: "usd" }, [{ code: "USD" }]).code).toMatch(/already in the list/);
    expect(validateCurrencyForm({ ...ok, name: " " }, []).name).toBeTruthy();
    expect(validateCurrencyForm({ ...ok, decimals: "5" }, []).decimals).toBeTruthy();
  });
  it("checks the tolerance", () => {
    expect(validateTolerance("5")).toBe("");
    expect(validateTolerance("0")).toBe("");
    expect(validateTolerance("2.5")).toBe("");
    expect(validateTolerance("")).toBeTruthy();
    expect(validateTolerance("101")).toBeTruthy();
    expect(validateTolerance("-1")).toBeTruthy();
    expect(validateTolerance("1.234")).toBeTruthy();
  });
});

describe("the register's CSV", () => {
  it("has plain figures a spreadsheet can read", () => {
    const rows = [{ date: "2026-10-04T08:00:00Z", voucherNo: "RV-2026-0001", voucherType: "receipt", partyName: "Al Noor, Trading", currency: "USD", foreignAmount: 1000, exchangeRate: 3.6725, totalAmount: 3672.5, paymentMode: "cash", status: "approved" }];
    expect(REGISTER_CSV_HEADERS).toHaveLength(10);
    expect(registerCsvRows(rows, () => "Cash")).toEqual([["04/10/2026", "RV-2026-0001", "Receipt", "Al Noor, Trading", "USD", "1000.00", "3.6725", "3672.50", "Cash", "Posted"]]);
  });
});
