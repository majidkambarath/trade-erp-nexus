// Pure line and document maths for order entry. No React, no Mongoose, no DOM.
//
// These are the rules the backend enforces (services/orderPurchase/transactionService.js
// calculateItems): lineValue = qty x unitPrice, vatAmount = lineValue x vatPercent / 100,
// lineTotal = lineValue + vatAmount (VAT-INCLUSIVE). Keeping them here, and nowhere else,
// is what stops the forms drifting apart again.

import { decimalRound, lineTotals } from "../../utils/format";

// Shape of one stored line row as the forms keep it.
//
// A discount reduces the TAXABLE value, so VAT is charged on the discounted amount (the same rule
// as the server, utils/pricing.js):  gross = qty x price;  net = gross - discount;
// vat = net x vat% ;  total = net + vat.  `lineValue` is the net (after discount); `lineGross` is
// before it. With no discount this is exactly the previous calculation.
export const rowLine = ({ qty, price, vatPercent, discountPercent }) => {
  const pct = Math.min(100, Math.max(0, parseFloat(discountPercent) || 0));
  const base = lineTotals({ qty: parseFloat(qty) || 0, price: parseFloat(price) || 0, vatPercent });
  if (!pct) return { ...base, lineGross: base.lineValue, discount: 0 };
  const lineGross = base.lineValue;
  const discount = decimalRound((lineGross * pct) / 100);
  const lineValue = decimalRound(lineGross - discount);
  const vatAmount = decimalRound((lineValue * (parseFloat(vatPercent) || 0)) / 100);
  return { lineGross, discount, lineValue, vatAmount, lineTotal: decimalRound(lineValue + vatAmount) };
};

// Header charges (freight, handling, ...): each has its own VAT.
export const chargeLine = ({ amount, vatPercent }) => {
  const net = decimalRound(parseFloat(amount) || 0);
  const vat = decimalRound((net * (parseFloat(vatPercent) || 0)) / 100);
  return { net, vat, total: decimalRound(net + vat) };
};

export const chargesTotals = (charges = []) => {
  let net = 0;
  let vat = 0;
  for (const c of charges) {
    if (!(parseFloat(c.amount) > 0)) continue;
    const l = chargeLine(c);
    net += l.net;
    vat += l.vat;
  }
  return { net: decimalRound(net), vat: decimalRound(vat), total: decimalRound(net + vat) };
};

// A document's totals from its rows. Rows without an item or a quantity are not
// part of the document, so they contribute nothing.
export const documentTotals = (rows, priceOf, vatOf = (r) => r.vatPercent) => {
  let subtotal = 0;
  let tax = 0;
  let total = 0;
  let discount = 0;
  for (const row of rows) {
    if (!row.itemId || !row.qty) continue;
    const line = rowLine({ qty: row.qty, price: priceOf(row), vatPercent: vatOf(row), discountPercent: row.discountPercent });
    subtotal += line.lineValue;
    tax += line.vatAmount;
    total += line.lineTotal;
    discount += line.discount;
  }
  return {
    subtotal: decimalRound(subtotal).toFixed(2),
    tax: decimalRound(tax).toFixed(2),
    total: decimalRound(total).toFixed(2),
    discount: decimalRound(discount).toFixed(2),
  };
};

// Purchase-return rows are priced by currentPurchasePrice and carry vatPercent.
export const purchaseReturnTotals = (rows) =>
  documentTotals(rows, (r) => r.currentPurchasePrice);

// One sales-return line for the payload. The UI calls the VAT field "Tax %", but the
// backend reads vatPercent, so this is the only place that name is translated.
// The line total is computed once here and is VAT-inclusive; the previous formula
// multiplied by quantity twice, because item.rate was already quantity times price.
export const salesReturnPayloadItem = (item) => {
  const qty = Math.abs(parseFloat(item.qty) || 0);
  const price = parseFloat(item.salesPrice) || 0;
  const vatPercent = parseFloat(item.taxPercent) || 0;
  const line = lineTotals({ qty, price, vatPercent });
  return {
    itemId: item.itemId,
    description: item.description,
    qty,
    price,
    rate: line.lineValue,
    vatPercent,
    vatAmount: line.vatAmount,
    lineTotal: line.lineTotal,
    category: item.category || "",
  };
};
