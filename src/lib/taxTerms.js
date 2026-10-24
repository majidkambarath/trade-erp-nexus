// What the tax and its registration number are called where the organisation is: VAT and TRN in the UAE, GST and GSTIN
// in India, VAT (or GST) and "VAT no." in the other VAT / GST countries, plain "Tax" elsewhere. Every label a person reads
// goes through these, so an Indian organisation never sees "VAT" or "TRN". The server's twin is trade ERP node
// utils/countryRules.js (taxTerms), which names the starter accounts and the server's messages the same way.
import { orgCountry } from "../utils/orgLocale.js";

const GST_COUNTRIES = new Set(["IN", "SG", "AU", "NZ"]);
const VAT_COUNTRIES = new Set(["AE", "SA", "BH", "OM", "GB", "IE", "DE", "FR", "NL", "BE", "IT", "ES", "PT", "AT", "SE", "DK", "FI", "PL", "CY", "MT", "ZA", "EG"]);

export function taxTerms(country = orgCountry()) {
  const c = String(country || "AE").toUpperCase();
  const tax = GST_COUNTRIES.has(c) ? "GST" : VAT_COUNTRIES.has(c) ? "VAT" : "Tax";
  const taxId = c === "AE" ? "TRN" : c === "IN" ? "GSTIN" : tax === "Tax" ? "Tax no." : `${tax} no.`;
  // The tax written out, for a heading that cannot use the initials ("Goods and services tax" over a note of GST rows).
  const taxName = tax === "GST" ? "Goods and services tax" : tax === "VAT" ? "Value added tax" : "Tax";
  return { country: c, tax, taxId, taxName, uae: c === "AE", india: c === "IN" };
}

/** "VAT" / "GST" / "Tax" for the organisation in scope. */
export const taxWord = () => taxTerms().tax;
/** "TRN" / "GSTIN" / "VAT no." / "Tax no." for the organisation in scope. */
export const taxIdWord = () => taxTerms().taxId;
/** "Value added tax" / "Goods and services tax" / "Tax" written out, for a heading. */
export const taxName = () => taxTerms().taxName;
/** True for a UAE organisation: UAE law text (the FTA, the reverse charge under Decree-Law No. 8) is printed only then. */
export const isUae = () => taxTerms().uae;
/** A sentence written with "VAT" / "TRN", in the organisation's words (for help texts kept in a table). */
export const say = (text) => String(text ?? "").replace(/\bVAT\b/g, taxWord()).replace(/\bTRN\b/g, taxIdWord());
