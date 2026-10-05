// The product's identity is its own thing, and no customer's name may be compiled into it.
// Both are easy to get wrong, and the mistake only shows on a second client's installation.
import { describe, it, expect } from "vitest";
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_VERSION } from "../product";
import { BRANDS, DEFAULT_BRAND_ID, getBrand } from "../brands";

describe("product identity", () => {
  it("has a name, a tagline and a version", () => {
    expect(PRODUCT_NAME).toBe("Zarvia");
    expect(PRODUCT_TAGLINE).toBeTruthy();
    expect(PRODUCT_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it("ships one neutral brand pack carrying no customer's name", () => {
    expect(Object.keys(BRANDS)).toEqual([DEFAULT_BRAND_ID]);
    const brand = getBrand();
    expect(brand.id).toBe("default");
    expect(brand.shortName).toBe("");
    expect(brand.name).toBe("Your company");
  });

  it("is not any brand's name, so a client never inherits it", () => {
    for (const brand of Object.values(BRANDS)) {
      expect(brand.shortName).not.toBe(PRODUCT_NAME);
      expect(brand.name).not.toBe(PRODUCT_NAME);
    }
  });

  it("keeps the settings a client installation still needs", () => {
    const brand = getBrand();
    expect(brand.currency).toBe("AED");
    expect(brand.timezone).toBe("Asia/Dubai");
    expect(brand.locale).toBe("en-GB");
  });
});
