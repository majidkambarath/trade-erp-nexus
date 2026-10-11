// Pure pieces of the trade reports screen: the months to choose from, how a month reads, and the rows of each export.
// Nothing here renders anything or calls the server.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

/** "2026-03" -> "Mar 2026" */
export const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-");
  return MONTHS[Number(m) - 1] ? `${MONTHS[Number(m) - 1]} ${y}` : String(ym);
};

/** The first and last day of "YYYY-MM". */
export function monthRange(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

/** The `count` months up to and including the one `today` ("YYYY-MM-DD") is in, newest first, for a month picker. */
export function recentMonths(today, count = 24) {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(`${y}-${pad(m)}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

/** The month a range is exactly, or "" when it is some other range. */
export function monthOfRange(from, to) {
  if (!from || !to || from.slice(0, 7) !== to.slice(0, 7)) return "";
  const r = monthRange(from.slice(0, 7));
  return r.from === from && r.to === to ? from.slice(0, 7) : "";
}

// ---- the views of a sales or purchase report ---------------------------------------------------------------------
export const VIEWS = (direction) => {
  const who = direction === "sales" ? "customer" : "vendor";
  return [
    { id: "party", label: `By ${who}` },
    { id: "item", label: "By item" },
    { id: "party_item", label: direction === "sales" ? "Customer × item" : "Vendor × item" },
    { id: "register", label: "Line register" },
  ];
};

// ---- exports ---------------------------------------------------------------------------------------------------
const n = (v) => (v === null || v === undefined ? "" : Number(v));

/** [headers, rows] for a summary, with a column per month when it has them. */
export function summaryExport(data, partyLabel) {
  const by = data.groupBy;
  const headers = [];
  if (by === "month") headers.push("Month");
  if (by === "party" || by === "party_item") headers.push(partyLabel, `${partyLabel} code`, "VAT status");
  if (by === "item" || by === "party_item") headers.push("Item", "Item code", "Category");
  headers.push("Documents", "Quantity", "Gross", "Returns", "Net", "VAT", "Total", "Average price", "Share %", "First date", "Last date");
  const months = data.monthly ? data.months : [];
  for (const m of months) headers.push(`${monthLabel(m)} qty`, `${monthLabel(m)} net`);

  const rows = data.rows.map((r) => {
    const out = [];
    if (by === "month") out.push(monthLabel(r.month));
    if (by === "party" || by === "party_item") out.push(r.partyName, r.partyCode, r.vatStatus);
    if (by === "item" || by === "party_item") out.push(r.itemName, r.itemCode, r.category);
    out.push(r.documents, n(r.quantity), n(r.gross), n(r.returns), n(r.net), n(r.vat), n(r.total), n(r.avgPrice), n(r.sharePct), String(r.firstDate || "").slice(0, 10), String(r.lastDate || "").slice(0, 10));
    for (const m of months) out.push(n(r.monthly?.[m]?.quantity ?? 0), n(r.monthly?.[m]?.net ?? 0));
    return out;
  });
  return [headers, rows];
}

export function registerExport(data) {
  const headers = ["Date", "Document", "Type", data.partyLabel, "Item", "Item code", "Category", "Reference", "Quantity", "Price", "Net", "VAT", "Total"];
  const rows = data.rows.map((r) => [String(r.date).slice(0, 10), r.documentNo, r.kind === "return" ? "Return" : "Invoice", r.partyName, r.itemName, r.itemCode, r.category, r.reference, n(r.quantity), n(r.price), n(r.net), n(r.vat), n(r.total)]);
  return [headers, rows];
}

export function movementExport(data, label) {
  const headers = [label, "Code", "VAT status", "TRN", "Terms", "Opening", "Invoiced", "Returns and credit notes", data.type === "customer" ? "Received" : "Paid", "Other", "Closing", "Overdue"];
  const rows = data.rows.map((r) => [r.partyName, r.partyCode, r.vatStatus, r.trn, r.paymentTerms, n(r.opening), n(r.invoiced), n(r.returns), n(r.settled), n(r.other), n(r.closing), n(r.overdue)]);
  return [headers, rows];
}
