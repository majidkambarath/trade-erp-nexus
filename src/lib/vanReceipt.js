// The slip a salesman prints on the road for a sale made from the van: 80mm wide, one column, plain text. Pure: it
// returns a markup string for printMarkup() to put in a hidden frame, so it is tested without a browser.
//
// The heading follows the SELLER's registration like every other invoice in the product (isTaxInvoice): "Tax invoice"
// when the company has a tax number and is registered on that day, else "Invoice". The customer's tax number is
// printed when they have one, which is what a registered buyer needs from a document over the simplified-invoice limit.

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
export function vanReceiptMarkup({ company = {}, invoice = {}, customerName = "", customerTrn = "", tripNo = "", salesmanName = "", paid = 0, taxInvoice = false, taxWord = "VAT", currency = "AED" }) {
  const items = invoice.items || [];
  const vat = items.reduce((t, l) => t + (Number(l.vatAmount) || 0), 0);
  const total = Number(invoice.totalAmount) || 0;
  const due = Math.max(0, Math.round((total - (Number(paid) || 0)) * 100) / 100);
  const day = invoice.date ? new Date(invoice.date).toISOString().slice(0, 10) : "";
  const row = (left, right, bold) => `<tr><td${bold ? ' class="b"' : ""}>${esc(left)}</td><td class="r${bold ? " b" : ""}">${esc(right)}</td></tr>`;
  const lines = items
    .map(
      (l) => `<tr><td colspan="2" class="item">${esc(l.description)}</td></tr><tr><td class="sub">${esc(l.qty)} x ${money(l.price)}</td><td class="r">${money(l.lineTotal)}</td></tr>`
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
<p class="b">${taxInvoice ? "TAX INVOICE" : "INVOICE"}</p>
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
