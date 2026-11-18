import React from "react";
import { formatNumber } from "../../../utils/format";

// The printed statement of account a customer is sent: an A4 page laid out with inline styles only, like InvoiceSheet and DeliverySheet, so
// the same markup previews, prints and renders to PDF. It has ONE root element (the PDF capture takes the page's first child).

const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#e5e7eb";
const th = { padding: "7px 8px", fontSize: 9.5, fontWeight: 600, color: INK, borderBottom: `1px solid ${INK}`, textAlign: "left" };
const td = { padding: "6px 8px", borderBottom: `1px solid ${RULE}`, verticalAlign: "top", fontSize: 10.5 };
const num = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const side = (n) => `${formatNumber(Math.abs(Number(n) || 0), 2)} ${(Number(n) || 0) >= 0 ? "Dr" : "Cr"}`;

export default function StatementSheet({ title, company, trn, party, period, currency, opening, closing, totals, rows = [], truncated }) {
  return (
    <div style={{ width: 794, minHeight: 1123, boxSizing: "border-box", padding: "40px 44px", background: "#fff", color: INK, fontFamily: "Inter, system-ui, sans-serif", fontSize: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{company?.nameEn}</div>
          {(company?.address || []).length > 0 && <div style={{ color: MUTED, marginTop: 2 }}>{company.address.join(", ")}</div>}
          {trn && <div style={{ color: MUTED }}>{trn}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
          <div style={{ color: MUTED, marginTop: 2 }}>{period}</div>
          {currency && <div style={{ color: MUTED }}>Amounts in {currency}</div>}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>Statement for</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{party?.name}</div>
        {party?.code && <div style={{ color: MUTED }}>{party.code}</div>}
        {party?.address && <div style={{ color: MUTED }}>{party.address}</div>}
        {party?.trn && <div style={{ color: MUTED }}>{party.trn}</div>}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Reference</th>
            <th style={th}>Description</th>
            <th style={{ ...th, ...num }}>Debit</th>
            <th style={{ ...th, ...num }}>Credit</th>
            <th style={{ ...th, ...num }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={td} colSpan={5}>Opening balance</td>
            <td style={{ ...td, ...num }}>{side(opening)}</td>
          </tr>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{r.date}</td>
              <td style={td}>{r.ref}</td>
              <td style={td}>{r.text}</td>
              <td style={{ ...td, ...num }}>{r.debit ? formatNumber(r.debit, 2) : ""}</td>
              <td style={{ ...td, ...num }}>{r.credit ? formatNumber(r.credit, 2) : ""}</td>
              <td style={{ ...td, ...num }}>{side(r.balance)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, fontWeight: 600 }} colSpan={3}>Closing balance</td>
            <td style={{ ...td, ...num, fontWeight: 600 }}>{formatNumber(totals?.debit || 0, 2)}</td>
            <td style={{ ...td, ...num, fontWeight: 600 }}>{formatNumber(totals?.credit || 0, 2)}</td>
            <td style={{ ...td, ...num, fontWeight: 600 }}>{side(closing)}</td>
          </tr>
        </tbody>
      </table>
      {truncated && <p style={{ color: MUTED, marginTop: 8 }}>Only the first 1,000 entries are shown. Ask the sender for the full statement.</p>}
      <p style={{ color: MUTED, marginTop: 18, fontSize: 9.5 }}>Dr is an amount you owe us; Cr is an amount we owe you. Please tell us of any difference.</p>
    </div>
  );
}
