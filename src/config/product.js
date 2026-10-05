// The product's own identity, kept apart from the client brand pack (src/config/brands.js).
//
// The brand pack (src/config/brands.js) carries only what differs per installation: locale,
// currency, timezone and colours. No customer's name is compiled into the product; the company
// a person works for is entered in Settings > Company.
// This file carries the PRODUCT, which is the same for every installation.
//
// It leads wherever the system names itself: the sign-in page, the top bar inside the app, the
// browser tab and the sign-in footer. The client's own name follows it in a quieter style, so a
// person always knows both which system they are in and whose data they are looking at.

export const PRODUCT_NAME = "Zarvia";

/** One line under the product name on the sign-in panel. */
export const PRODUCT_TAGLINE = "Trade & Finance Platform";

/** Shown in the sign-in footer beside the product name. */
export const PRODUCT_VERSION = "1.0";
