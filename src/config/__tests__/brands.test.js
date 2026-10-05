import { describe, it, expect, afterEach } from "vitest";
import { BRANDS, DEFAULT_BRAND_ID, getBrand, getBrandId } from "../brands";

afterEach(() => {
  delete document.documentElement.dataset.brand;
});

describe("brand packs", () => {
  it("the default brand exists and carries locale and money", () => {
    const b = BRANDS[DEFAULT_BRAND_ID];
    expect(b).toBeDefined();
    for (const key of ["locale", "currencyLocale", "currency", "timezone", "weekendDays"]) {
      expect(b[key], key).toBeTruthy();
    }
  });

  it("falls back to the default when no brand is set", () => {
    expect(getBrandId()).toBe(DEFAULT_BRAND_ID);
    expect(getBrand().id).toBe(DEFAULT_BRAND_ID);
  });

  it("reads the brand from <html data-brand>", () => {
    document.documentElement.dataset.brand = "default";
    expect(getBrandId()).toBe("default");
  });

  // A typo in index.html should degrade to the shipped client, not a blank page.
  it("falls back to the default for an unknown brand id", () => {
    document.documentElement.dataset.brand = "does-not-exist";
    expect(getBrand().id).toBe(DEFAULT_BRAND_ID);
  });

  it("every pack's id matches its key", () => {
    for (const [key, pack] of Object.entries(BRANDS)) expect(pack.id).toBe(key);
  });
});
