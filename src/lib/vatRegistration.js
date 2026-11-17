// Whether the organisation is registered for VAT, as the server states it (server: utils/vatRegistration.js, the twin of this file).
//
// `status.vatRegistration` is { governs, registered, from }: `governs` is true only for a UAE organisation, which is the only place the rule
// applies; `registered` is today's answer. Anything missing reads as "registered / not governed", so a screen that has not heard from the
// server (or an older server) changes nothing - the server is the lock, the screen only decides what to offer.

/** Is VAT switched off for what this organisation SELLS? (not registered, in a country where that is decided by registration) */
export const salesWithoutVat = (status) => Boolean(status?.vatRegistration?.governs) && status.vatRegistration.registered === false;

/** The code a line carries when no VAT applies: the organisation's own "out of scope" code, else none. */
export const noVatCodeOf = (taxCodes = []) => taxCodes.find((c) => c.kind === "out_of_scope" && c.isActive !== false) || null;

/** The registration day as "YYYY-MM-DD", or "" when there is none. */
export const registeredFrom = (company) => String(company?.vatRegisteredFrom || "").slice(0, 10);

const dayOf = (date) => {
  if (!date) return "";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

/**
 * Was the organisation registered when this document was made? The server stamps a document with its own answer (`stamp`: true / false /
 * absent). The stamp wins; without one (a document from before the rule) the company's own details decide as they always did, plus the
 * registration date when it has one.
 */
export const registeredFor = (company, date, stamp) => {
  if (stamp === true) return Boolean(String(company?.vatNumber ?? "").trim());
  if (stamp === false) return false;
  if (!String(company?.vatNumber ?? "").trim() || company?.vatRegistered === false) return false;
  const from = registeredFrom(company);
  const day = dayOf(date);
  return !from || !day || day >= from;
};
