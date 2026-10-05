// Brand packs: everything that differs per client besides colour.
// Colour lives in src/styles/brands/<id>.css; locale and money live here.
//
// The product ships with the "default" pack only. It carries NO client name: the company a
// person works for is entered in Settings > Company and read from there, so no customer's
// name is ever compiled into the product.
//
// To add a client:
//   1. add a pack below
//   2. add src/styles/brands/<id>.css (light AND dark tokens) and @import it in index.css
//   3. set data-brand="<id>" on <html> in index.html
// No component changes are needed.

export const DEFAULT_BRAND_ID = "default";

export const BRANDS = {
  default: {
    id: "default",
    // Shown only where a company name is wanted and Settings has none yet. Never a client's name.
    name: "Your company",
    // Shown beside the product name in the top bar. Empty on the default pack: the product
    // names itself, and the company's own name is in Settings.
    shortName: "",
    locale: "en-GB", // DD/MM/YYYY and 1,234,567.89 grouping
    currencyLocale: "en-AE",
    currency: "AED",
    timezone: "Asia/Dubai",
    weekendDays: [6, 0], // Saturday, Sunday (0 = Sunday)
  },
};

export const getBrandId = () =>
  (typeof document !== "undefined" && document.documentElement.dataset.brand) ||
  DEFAULT_BRAND_ID;

// Unknown or missing brand ids fall back to the default pack instead of throwing,
// so a typo in index.html degrades to the shipped look rather than a blank page.
export const getBrand = () => BRANDS[getBrandId()] ?? BRANDS[DEFAULT_BRAND_ID];
