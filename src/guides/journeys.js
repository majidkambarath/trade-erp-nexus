// The first-sign-in choices. A journey is a short, ordered set of guides for one thing a business wants to do; it starts
// at the first guide this person may run. A journey the person's plan or role cannot do at all is not offered (never a
// choice that leads nowhere), so the welcome never shows more than the handful that apply to them.
export const JOURNEYS = [
  { id: "setup", guides: ["set-up-company", "add-customer", "add-vendor", "add-item"] },
  { id: "sell", guides: ["create-quotation", "create-sales-order", "deliver-and-invoice", "send-invoice", "receive-payment"] },
  { id: "buy", guides: ["create-purchase-order", "receive-and-bill-goods", "pay-supplier"] },
  { id: "stock", guides: ["add-item", "record-movement", "write-off-stock", "read-stock-reports"] },
  { id: "books", guides: ["record-expense", "add-bank", "read-profit-and-loss", "read-ageing"] },
];

// The journeys this person can run: each with the guides they may run (in order), where it starts and how long it takes.
export function journeysFor(flows) {
  const byId = new Map(flows.map((f) => [f.id, f]));
  return JOURNEYS
    .map((j) => {
      const mine = j.guides.map((id) => byId.get(id)).filter(Boolean);
      return { id: j.id, guides: mine.map((f) => f.id), first: mine[0]?.id || null, minutes: mine.reduce((n, f) => n + (f.minutes || 0), 0) };
    })
    .filter((j) => j.first);
}
