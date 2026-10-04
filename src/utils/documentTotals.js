import { decimalAdd, decimalSub, decimalSum } from "./format";

// Totals for a printed document. The server prices every document (utils/pricing.js on the backend)
// and stores the result in `pricing`, so the printout must show those figures: summing the lines here
// would drop freight/handling charges, the header discount and the round-off.
// Documents saved before that existed have no `pricing` and keep the old line-sum behaviour.
export function documentTotals(doc) {
  const items = doc?.items || [];
  const p = doc?.pricing;
  if (p && Number.isFinite(Number(p.grandTotal))) {
    return {
      priced: true,
      gross: Number(p.net) || 0, // line values after line discounts, as the lines show them
      lineDiscount: Number(p.lineDiscount) || 0,
      charges: (doc.charges || []).filter((c) => Number(c.amount) > 0),
      chargesNet: Number(p.chargesNet) || 0,
      vat: decimalAdd(Number(p.lineVat) || 0, Number(p.chargesVat) || 0),
      headerDiscount: Number(p.headerDiscount) || 0,
      roundOff: Number(p.roundOff) || 0,
      grandTotal: Number(p.grandTotal) || 0,
    };
  }
  const gross = decimalSum(items.map((it) => it.rate));
  const vat = decimalSum(items.map((it) => it.vatAmount));
  const discount = parseFloat(doc?.discount || 0) || 0;
  return {
    priced: false, gross, lineDiscount: 0, charges: [], chargesNet: 0, vat,
    headerDiscount: discount, roundOff: 0,
    grandTotal: Math.max(0, decimalSub(decimalAdd(gross, vat), discount)),
  };
}
