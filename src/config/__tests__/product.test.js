// The product's identity is its own thing, and no customer's name may be compiled into it.
// Both are easy to get wrong, and the mistake only shows on a second client's installation.
import { describe, it, expect } from "vitest";
import pkg from "../../../package.json";
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_VERSION } from "../product";
import { BRANDS, DEFAULT_BRAND_ID, getBrand } from "../brands";

describe("product identity", () => {
  it("has a name, a tagline and a version", () => {
    expect(PRODUCT_NAME).toBe("Zarvia");
    expect(PRODUCT_TAGLINE).toBeTruthy();
    // major.minor, with an optional patch and build: 1.0, 1.0.0, 1.0.0.1
    expect(PRODUCT_VERSION).toMatch(/^\d+\.\d+(\.\d+){0,2}$/);
  });

  // The sign-in page and the service worker's cache name read PRODUCT_VERSION, and it is typed by hand. It was left at 1.6.0.1
  // through three releases because nothing compared it with the version that is actually released.
  it("is the version this package is released as", () => {
    expect(PRODUCT_VERSION).toBe(pkg.version);
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
  // The product was called "Trade ERP" before it was Zarvia. The rename missed src/components/NotFound.jsx,
  // and that page - the one a mistyped address lands on - went on showing the old name to a live client for
  // months, because nothing looked. Matched case-sensitively, and with the BACKEND REPO'S OWN DIRECTORY NAME
  // ("trade ERP node", which comments cite constantly) taken out first: 17 files name that path and none of
  // them is the brand. Test files are skipped - they name the old brand on purpose, to pin that it is gone.
  it("has no trace of the name the product used to have", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    // globalThis.process, not a bare `process`: Vite rewrites import.meta.url to an http:// URL under
    // vitest, so fileURLToPath refuses it, and the lint config declares no bare Node globals.
    const src = join(globalThis.process.cwd(), "src");
    const offenders = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") walk(full);
        } else if (/\.(js|jsx)$/.test(entry.name)) {
          const text = readFileSync(full, "utf8").replace(/trade ERP node/gi, "");
          if (/Trade ERP/.test(text)) offenders.push(full);
        }
      }
    };
    walk(src);
    expect(offenders).toEqual([]);
  });
});
