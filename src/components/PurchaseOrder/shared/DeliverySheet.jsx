import React from "react";
import { formatNumber, formatQty } from "../../../utils/format";
import { tint } from "./invoiceModel";

// The printed delivery note and pick list: an A4 sheet laid out with inline styles only, exactly like
// InvoiceSheet, so the same markup prints, renders to PDF and previews. It is its own sheet because it
// is a different document: quantities first, prices only when asked for, and the signatures that make it
// proof of delivery. `sheet.mode` is "delivery" (goes with the goods) or "pick" (stays in the warehouse).

const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#e5e7eb";

const cell = { padding: "7px 8px", borderBottom: `1px solid ${RULE}`, verticalAlign: "top", fontVariantNumeric: "tabular-nums" };
const head = { padding: "7px 8px", fontSize: 9.5, fontWeight: 600, textAlign: "right", color: INK };
const label = { fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED };

const SignBox = ({ title, children, height = 64 }) => (
  <div style={{ flex: 1, fontSize: 10.5 }}>
    <div style={label}>{title}</div>
    <div style={{ border: `1px solid ${INK}`, height, marginTop: 6, padding: 6 }}>{children}</div>
  </div>
);

export default function DeliverySheet({
  mode = "delivery",
  title,
  number,
  copy,
  company,
  party,
  meta,
  lines,
  showPrices,
  totals,
  currency,
  accent,
  notes,
  notice,
  signatures,
}) {
  const soft = tint(accent, 0.1);
  const pick = mode === "pick";
  const delivered = !pick && lines.some((l) => l.deliveredQty !== undefined && l.deliveredQty !== null);
  const cols = pick ? 7 : 5 + (delivered ? 1 : 0) + (showPrices ? 3 : 0);

  return (
    <div
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "14mm",
        boxSizing: "border-box",
        background: "#ffffff",
        color: INK,
        fontFamily: "Inter, Arial, Helvetica, sans-serif",
        fontSize: 11.5,
        lineHeight: 1.45,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", minHeight: 52 }}>
        <div>{company.logo ? <img src={company.logo} alt="" style={{ maxHeight: 52, maxWidth: 160 }} /> : null}</div>
        <div style={{ ...label, color: accent }}>{copy}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{company.nameEn}</div>
        {company.nameAr && <div dir="rtl" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{company.nameAr}</div>}
        {company.address.length > 0 && <div style={{ color: MUTED, marginTop: 4, fontSize: 10.5 }}>{company.address.join(", ")}</div>}
        {company.contact.length > 0 && <div style={{ color: MUTED, fontSize: 10.5 }}>{company.contact.join("   ·   ")}</div>}
        {company.trn && (
          <div style={{ fontSize: 10.5, marginTop: 2 }}>
            <span style={{ fontWeight: 600 }}>TRN</span> {company.trn}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, paddingBottom: 8, borderBottom: `2px solid ${accent}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: accent }}>{title}</div>
        {number?.value && (
          <div style={{ textAlign: "right" }}>
            <div style={label}>{number.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{number.value}</div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 16 }}>
        <div>
          <div style={label}>{party.heading}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{party.name}</div>
          {party.code && <div style={{ color: MUTED, fontSize: 10.5 }}>{party.code}</div>}
          {party.address && <div style={{ marginTop: 4, whiteSpace: "pre-line" }}>{party.address}</div>}
          {party.contact.length > 0 && <div style={{ color: MUTED, fontSize: 10.5, marginTop: 2 }}>{party.contact.join("   ·   ")}</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 16, rowGap: 5, alignContent: "start" }}>
          {meta.map(([k, v]) => (
            <React.Fragment key={k}>
              <div style={{ ...label, paddingTop: 2 }}>{k}</div>
              <div style={{ textAlign: "right", fontWeight: 500 }}>{v}</div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, fontSize: 10.5 }}>
        <thead>
          <tr style={{ background: soft, borderBottom: `1px solid ${accent}` }}>
            <th style={{ ...head, textAlign: "center", width: "5%" }}>#</th>
            <th style={{ ...head, textAlign: "left", width: "12%" }}>Code</th>
            <th style={{ ...head, textAlign: "left" }}>Description</th>
            <th style={{ ...head, textAlign: "left", width: "7%" }}>Unit</th>
            <th style={{ ...head, width: "10%" }}>{pick ? "To pick" : delivered ? "Sent" : "Qty"}</th>
            {delivered && <th style={{ ...head, width: "11%" }}>Delivered</th>}
            {pick && <th style={{ ...head, textAlign: "left", width: "30%" }}>Batch · expiry</th>}
            {pick && <th style={{ ...head, textAlign: "center", width: "8%" }}>Picked</th>}
            {showPrices && !pick && <th style={{ ...head, width: "11%" }}>Unit price</th>}
            {showPrices && !pick && <th style={{ ...head, width: "7%" }}>VAT %</th>}
            {showPrices && !pick && <th style={{ ...head, width: "12%" }}>Total</th>}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={cols} style={{ ...cell, textAlign: "center", color: MUTED }}>No items</td>
            </tr>
          )}
          {lines.map((l) => (
            <tr key={l.no}>
              <td style={{ ...cell, textAlign: "center" }}>{l.no}</td>
              <td style={cell}>{l.code}</td>
              <td style={cell}>
                {l.description}
                {l.short > 0 && (
                  <div style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>Short {formatQty(l.short, 3)}{l.shortReason ? `: ${l.shortReason}` : ""}</div>
                )}
                {pick && l.unallocated > 0 && (
                  <div style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{formatQty(l.unallocated, 3)} has no batch on record</div>
                )}
              </td>
              <td style={cell}>{l.unit}</td>
              <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{formatQty(l.qty, 3)}</td>
              {delivered && <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{formatQty(l.deliveredQty ?? l.qty, 3)}</td>}
              {pick && (
                <td style={cell}>
                  {l.batches?.length ? l.batches.map((b, i) => (
                    <div key={i}>{b.batchNumber || "-"}{b.expiryText ? ` · ${b.expiryText}` : ""} <span style={{ color: MUTED }}>× {formatQty(b.qty, 3)}</span></div>
                  )) : <span style={{ color: MUTED }}>-</span>}
                </td>
              )}
              {pick && <td style={{ ...cell, textAlign: "center" }}><span style={{ display: "inline-block", width: 12, height: 12, border: `1px solid ${INK}` }} /></td>}
              {showPrices && !pick && <td style={{ ...cell, textAlign: "right" }}>{formatNumber(l.unitPrice)}</td>}
              {showPrices && !pick && <td style={{ ...cell, textAlign: "right" }}>{l.reverseCharge ? "RC" : formatNumber(l.vatPercent, 0)}</td>}
              {showPrices && !pick && <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{formatNumber(l.total)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {showPrices && !pick && totals && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <div style={{ width: "42%", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>Net amount</span><span>{formatNumber(totals.gross)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>VAT</span><span>{formatNumber(totals.vat)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 6, borderTop: `2px solid ${accent}`, fontWeight: 700, fontSize: 13 }}>
              <span>Total ({currency})</span><span>{formatNumber(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {notes && (
        <div style={{ marginTop: 16 }}>
          <div style={label}>Remarks</div>
          <div style={{ marginTop: 3, whiteSpace: "pre-line" }}>{notes}</div>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 28 }}>
        {signatures && (
          <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
            <SignBox title="Delivered by">
              {signatures.deliveredBy.map(([k, v]) => v ? <div key={k}><span style={{ color: MUTED }}>{k}</span> {v}</div> : null)}
            </SignBox>
            <SignBox title="Received by (name, signature and stamp)">
              {signatures.receivedBy.map(([k, v]) => v ? <div key={k}><span style={{ color: MUTED }}>{k}</span> {v}</div> : null)}
            </SignBox>
          </div>
        )}
        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 8, fontSize: 9.5, color: MUTED }}>{notice}</div>
      </div>
    </div>
  );
}
