// A discount on the whole invoice, shared out over its lines: the form's PREVIEW of what the server does (trade ERP node/utils/headerDiscount.js,
// whose rule this repeats - the server is the authority and prices the saved document).
//
// The amount typed comes off the total, VAT included. It is divided over the lines by what each costs the customer (net + tax), and each line's net and
// tax fall together, so the total is exactly what it was and the tax is charged only on what is really paid.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (n) => Number(n) || 0;

/**
 * lines: [{ net, vat }] (the form's rows as priced); discount: the typed amount.
 * -> { applied, net, tax } - what really comes off (never more than the lines cost), and the net and tax of the lines AFTER it.
 */
export function shareHeaderDiscount(lines, discount) {
  const costs = lines.map((l) => round2(num(l.net) + num(l.vat)));
  const positive = costs.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
  const base = round2(positive.reduce((t, i) => t + costs[i], 0));
  const applied = round2(Math.min(Math.max(0, num(discount)), base));
  const gross = { net: round2(lines.reduce((t, l) => t + num(l.net), 0)), tax: round2(lines.reduce((t, l) => t + num(l.vat), 0)) };
  if (!(applied > 0)) return { applied: 0, ...gross };

  const share = new Map();
  let given = 0;
  positive.forEach((i, k) => {
    const s = k === positive.length - 1 ? round2(applied - given) : round2((applied * costs[i]) / base);
    const capped = Math.min(Math.max(s, 0), costs[i]);
    share.set(i, capped);
    given = round2(given + capped);
  });

  let net = 0;
  let tax = 0;
  lines.forEach((l, i) => {
    if (!share.has(i)) {
      net += num(l.net);
      tax += num(l.vat);
      return;
    }
    const left = round2(costs[i] - share.get(i));
    const taxable = num(l.net);
    const t = num(l.vat);
    const taxable2 = t > 0 ? round2((left * taxable) / costs[i]) : left;
    net += taxable2;
    tax += t > 0 ? round2(left - taxable2) : 0;
  });
  return { applied, net: round2(net), tax: round2(tax) };
}
