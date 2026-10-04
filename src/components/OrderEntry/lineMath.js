// Pure line and document maths for order entry. No React, no Mongoose, no DOM.
//
// These are the rules the backend enforces (services/orderPurchase/transactionService.js
// calculateItems): lineValue = qty x unitPrice, vatAmount = lineValue x vatPercent / 100,
// lineTotal = lineValue + vatAmount (VAT-INCLUSIVE). Keeping them here, and nowhere else,
// is what stops the forms drifting apart again.

import { decimalRound, lineTotals } from "../../utils/format";

// Shape of one stored line row as the forms keep it.
export const rowLine = ({ qty, price, vatPercent }) =>
  lineTotals({ qty: parseFloat(qty) || 0, price: parseFloat(price) || 0, vatPercent });

// A document's totals from its rows. Rows without an item or a quantity are not
// part of the document, so they contribute nothing.
export const documentTotals = (rows, priceOf, vatOf = (r) => r.vatPercent) => {
  let subtotal = 0;
  let tax = 0;
  let total = 0;
  for (const row of rows) {
    if (!row.itemId || !row.qty) continue;
    const line = rowLine({ qty: row.qty, price: priceOf(row), vatPercent: vatOf(row) });
    subtotal += line.lineValue;
    tax += line.vatAmount;
    total += line.lineTotal;
  }
  return {
    subtotal: decimalRound(subtotal).toFixed(2),
    tax: decimalRound(tax).toFixed(2),
    total: decimalRound(total).toFixed(2),
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
