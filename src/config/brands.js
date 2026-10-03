// Brand packs: everything that differs per client besides colour.
// Colour lives in src/styles/brands/<id>.css; locale and money live here.
//
// To add a client:
//   1. add a pack below
//   2. add src/styles/brands/<id>.css (light AND dark tokens) and @import it in index.css
//   3. set data-brand="<id>" on <html> in index.html
// No component changes are needed.

export const DEFAULT_BRAND_ID = "nhfoods-ae";

export const BRANDS = {
  "nhfoods-ae": {
    id: "nhfoods-ae",
    name: "NH Foods UAE",
    shortName: "NH FOODS", // shown in the top bar and the browser tab title
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
// so a typo in index.html degrades to the shipped client rather than a blank page.
export const getBrand = () => BRANDS[getBrandId()] ?? BRANDS[DEFAULT_BRAND_ID];
