// The slip a salesman prints on the road for a sale made from the van: 80mm wide, one column, plain text. Pure: it
// returns a markup string for printMarkup() to put in a hidden frame, so it is tested without a browser.
//
// The heading follows the SELLER's registration like every other invoice in the product (isTaxInvoice): "Tax invoice"
// when the company has a tax number and is registered on that day, else "Invoice". The customer's tax number is
// printed when they have one, which is what a registered buyer needs from a document over the simplified-invoice limit.

/**
 * Which kind of slip a sale needs. In the UAE a registered seller may give a SIMPLIFIED tax invoice unless the buyer is
 * registered and the supply is over AED 10,000 (Executive Regulation Art. 59(6)-(7)); a full one then also shows the
 * VAT on each line and the buyer's tax number. Outside the UAE every tax invoice is printed in full. Verify the
 * current rule before quoting it as advice.
 */
export function slipKind({ taxInvoice, uae = true, customerTrn = "", total = 0, threshold = 10000 }) {
  if (!taxInvoice) return "invoice";
  if (!uae) return "full";
  return customerTrn && Number(total) > threshold ? "full" : "simplified";
}

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const money = (n) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * @param {object} p
 * @param {object} p.company       the letterhead (useCompanyProfile)
 * @param {object} p.invoice       the approved invoice the server returned
 * @param {string} p.customerName
 * @param {string} [p.customerTrn]
 * @param {string} [p.tripNo]
 * @param {string} [p.salesmanName]
 * @param {number} [p.paid]        money taken at the sale (cash or cheque)
 * @param {boolean} p.taxInvoice   whether the heading says "Tax invoice" (isTaxInvoice, decided by the caller)
 * @param {string} [p.taxWord]     VAT / GST / Tax
 * @param {string} [p.currency]
 */
export function vanReceiptMarkup({ company = {}, invoice = {}, customerName = "", customerTrn = "", tripNo = "", salesmanName = "", paid = 0, taxInvoice = false, taxWord = "VAT", currency = "AED", uae = true, provisional = false }) {
  const kind = slipKind({ taxInvoice, uae, customerTrn, total: invoice.totalAmount });
  const items = invoice.items || [];
  const vat = items.reduce((t, l) => t + (Number(l.vatAmount) || 0), 0);
  const total = Number(invoice.totalAmount) || 0;
  const due = Math.max(0, Math.round((total - (Number(paid) || 0)) * 100) / 100);
  const day = invoice.date ? new Date(invoice.date).toISOString().slice(0, 10) : "";
  const row = (left, right, bold) => `<tr><td${bold ? ' class="b"' : ""}>${esc(left)}</td><td class="r${bold ? " b" : ""}">${esc(right)}</td></tr>`;
  const lines = items
    .map(
      (l) => `<tr><td colspan="2" class="item">${esc(l.description)}</td></tr><tr><td class="sub">${esc(l.qty)} x ${money(l.price)}${kind === "full" ? ` · ${esc(taxWord)} ${esc(l.vatPercent ?? 0)}% ${money(l.vatAmount)}` : ""}</td><td class="r">${money(l.lineTotal)}</td></tr>`
    )
    .join("");
  return `<style>
@page { size: 80mm auto; margin: 4mm; }
body { width: 72mm; margin: 0; font: 12px/1.35 "Courier New", monospace; color: #000; }
h1 { font-size: 14px; margin: 0 0 2px; text-align: center; }
p { margin: 0; text-align: center; }
table { width: 100%; border-collapse: collapse; }
td { padding: 1px 0; vertical-align: top; }
.r { text-align: right; white-space: nowrap; }
.b { font-weight: bold; }
.item { padding-top: 4px; }
.sub { padding-left: 8px; color: #333; }
hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
</style>
<h1>${esc(company.companyName || "")}</h1>
${company.addressLine1 ? `<p>${esc(company.addressLine1)}</p>` : ""}
${company.city ? `<p>${esc(company.city)}</p>` : ""}
${company.vatNumber ? `<p>${esc(taxWord)} no. ${esc(company.vatNumber)}</p>` : ""}
<hr>
<p class="b">${provisional ? "DELIVERY SLIP" : taxInvoice ? "TAX INVOICE" : "INVOICE"}</p>
${provisional ? `<p>Prices before ${esc(taxWord)}. The tax invoice follows.</p>` : ""}
<table>
${row("No.", invoice.transactionNo || "")}
${row("Date", day)}
${tripNo ? row("Trip", tripNo) : ""}
${salesmanName ? row("Salesman", salesmanName) : ""}
${row("Customer", customerName)}
${customerTrn ? row(`${taxWord} no.`, customerTrn) : ""}
</table>
<hr>
<table>${lines}</table>
<hr>
<table>
${vat ? row(`${taxWord}`, money(vat)) : ""}
${row(`Total ${currency}`, money(total), true)}
${paid ? row("Received", money(paid)) : ""}
${paid ? row("Balance due", money(due), true) : ""}
</table>
<hr>
<p>Thank you</p>`;
}

/**
 * The bank deposit slip for the cheques a van brought back (van sales, phase 6): each cheque with its number, the bank
 * it is drawn on, who gave it, its date and amount, grouped by that bank, with the count and total, and a line to sign.
 * A4, not 80mm: it goes to the bank with the cheques.
 */
export function depositSlipMarkup({ company = {}, trip = {}, cheques = [], currency = "AED", day = "" }) {
  const byBank = new Map();
  for (const c of cheques) {
    const k = c.bank || "Bank not given";
    if (!byBank.has(k)) byBank.set(k, []);
    byBank.get(k).push(c);
  }
  const total = cheques.reduce((t, c) => t + (Number(c.amount) || 0), 0);
  const row = (c) => `<tr><td>${esc(c.chequeNo)}</td><td>${esc(c.from || "")}</td><td>${esc(c.date ? String(c.date).slice(0, 10) : "")}</td><td style="text-align:right">${money(c.amount)}</td></tr>`;
  const groups = [...byBank].map(([bank, list]) => `
    <tr><th colspan="4" style="text-align:left;padding-top:10px">${esc(bank)} (${list.length})</th></tr>
    ${list.map(row).join("")}
    <tr><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">${money(list.reduce((t, c) => t + (Number(c.amount) || 0), 0))}</td></tr>`).join("");
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:760px">
  <p style="font-size:16px;font-weight:600;margin:0">${esc(company.companyName || "")}</p>
  <p style="margin:2px 0 14px">Cheque deposit slip${day ? ` - ${esc(day)}` : ""}</p>
  <p style="margin:0 0 10px">Van ${esc(trip.vanCode || "")} · trip ${esc(trip.tripNo || "")}${trip.salesmanName ? ` · ${esc(trip.salesmanName)}` : ""}</p>
  <table style="width:100%;border-collapse:collapse" cellpadding="4">
    <thead><tr style="border-bottom:1px solid #999"><th style="text-align:left">Cheque no.</th><th style="text-align:left">From</th><th style="text-align:left">Dated</th><th style="text-align:right">Amount (${esc(currency)})</th></tr></thead>
    <tbody>${groups}</tbody>
    <tfoot><tr style="border-top:1px solid #999"><th colspan="3" style="text-align:right">${cheques.length} cheque${cheques.length === 1 ? "" : "s"}, total</th><th style="text-align:right">${money(total)}</th></tr></tfoot>
  </table>
  <p style="margin-top:40px">Handed in by ______________________ &nbsp;&nbsp; Received by ______________________</p>
</div>`;
}
