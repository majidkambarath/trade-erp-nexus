// A trade document made in a foreign currency. The server stores it in the BASE currency (so the ledger, the VAT return, ageing and every report read
// it as before) and keeps the same document in its own currency beside it, on `fx` (document) and `line.fx` / `charge.fx`. The screens work in the
// document's own currency: this turns a stored document into that view, keeping the base figures where a screen needs them (the VAT in base is
// printed on the invoice, and what the ledger carries is what a statement shows).
//
// A document with no `fx` comes back as it is.

const num = (n) => Number(n) || 0;

export const isForeignDoc = (doc) => Boolean(doc?.fx?.currency);

export function inDocumentCurrency(doc) {
  if (!isForeignDoc(doc)) return doc;
  const fx = doc.fx;
  const lines = (doc.items || []).map((l) => {
    if (!l?.fx) return l;
    return {
      ...l,
      price: l.fx.price ?? l.price,
      grossAmount: l.fx.grossAmount ?? l.grossAmount,
      discountAmount: l.fx.discountAmount ?? l.discountAmount,
      taxableAmount: l.fx.taxableAmount ?? l.taxableAmount,
      vatAmount: l.fx.vatAmount ?? l.vatAmount,
      lineTotal: l.fx.lineTotal ?? l.lineTotal,
      grandTotal: l.fx.lineTotal ?? l.grandTotal,
      rate: l.fx.taxableAmount ?? l.rate,
      ...(l.fx.rcmVat !== undefined ? { rcmVat: l.fx.rcmVat } : {}),
      base: { price: l.price, taxableAmount: l.taxableAmount, vatAmount: l.vatAmount, lineTotal: l.lineTotal },
    };
  });
  const charges = (doc.charges || []).map((c) => (c?.fx ? { ...c, amount: c.fx.amount, vatAmount: c.fx.vatAmount, base: { amount: c.amount, vatAmount: c.vatAmount } } : c));
  return {
    ...doc,
    items: lines,
    charges,
    pricing: fx.pricing ? { ...doc.pricing, ...fx.pricing } : doc.pricing,
    totalAmount: fx.totalAmount ?? doc.totalAmount,
    paidAmount: fx.paidAmount ?? doc.paidAmount,
    creditedAmount: fx.creditedAmount ?? doc.creditedAmount,
    outstandingAmount: fx.outstandingAmount ?? doc.outstandingAmount,
    currency: fx.currency,
    exchangeRate: fx.rate,
    currencyDecimals: fx.decimals ?? 2,
    // what the ledger carries, in the base currency
    base: { totalAmount: doc.totalAmount, paidAmount: doc.paidAmount, outstandingAmount: doc.outstandingAmount, vatAmount: num(doc.pricing?.lineVat) + num(doc.pricing?.chargesVat), pricing: doc.pricing },
  };
}

// "USD 1,050.00" for a document amount; the base currency's own formatting for one with no currency of its own.
export function amountIn(currency, value, decimals = 2) {
  const n = num(value);
  const text = n.toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return currency ? `${currency} ${text}` : text;
}
