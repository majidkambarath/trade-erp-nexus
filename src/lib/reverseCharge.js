// Reverse-charge VAT: the rules the screens share, without a component in sight.
//
// When a supplier charges no VAT (services bought from abroad, some local supplies) the BUYER assesses it. A line on a tax code of
// kind "reverse_charge" therefore carries NO VAT in its total (the supplier is owed the net) and has the VAT the buyer assesses beside
// it: taxable x the code's rate. The server prices and posts all of this (utils/pricing.js, utils/postingTemplates.js); these
// helpers only decide what to show, so a form can preview the line before it is saved.
//
// The wording of the statement on a SALES invoice rests on Executive Regulation Art. 59(1)(l) (as amended by Cabinet Decision
// 100 of 2024): a supply on which the recipient accounts for the tax must carry a statement to that effect and a reference to the
// provision of the Decree-Law (Art. 48 of Federal Decree-Law No. 8 of 2017: the recipient is treated as making the supply to itself).
//
// Pure: no React, no network.

export const REVERSE_CHARGE = "reverse_charge";

// `x` may be a tax code (kind), a saved line (taxKind) or a form row (reverseCharge, set when its tax code is chosen).
export const isReverseCharge = (x) => x?.reverseCharge === true || x?.taxKind === REVERSE_CHARGE || x?.kind === REVERSE_CHARGE;

// What the supplier's tax invoice must say on a line the customer accounts for the VAT on.
export const SUPPLIER_STATEMENT =
  "Reverse charge applies: VAT to be accounted for by the recipient (Federal Decree-Law No. 8 of 2017, Article 48). Lines marked RC carry no VAT.";

// What our own purchase document says about the VAT we assess. It is not on any invoice a supplier sees.
export const recipientStatement = (amountText) =>
  `VAT of ${amountText} on the reverse-charge lines is accounted for by us (Federal Decree-Law No. 8 of 2017, Article 48). It is not payable to the supplier and is not in the total.`;

// The words under the VAT cell of a reverse-charge line: the VAT column reads 0 and this says why.
export const lineHint = (percent, amountText) => `Reverse charge: ${Number(percent) || 0}% = ${amountText} self-assessed`;

// A tax code in a picker. A reverse-charge code says what it does, so nobody has to guess from its name.
export const taxCodeLabel = (code) =>
  code.kind === REVERSE_CHARGE ? `${code.name} (${code.ratePercent}% self-assessed)` : `${code.name} (${code.ratePercent}%)`;
