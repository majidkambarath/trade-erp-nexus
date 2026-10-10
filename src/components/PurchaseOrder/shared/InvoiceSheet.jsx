import React from "react";
import { formatNumber, formatQty } from "../../../utils/format";
import { tint, totalInWords } from "./invoiceModel";

// The printed page: an A4 sheet laid out with inline styles only, so the same markup prints
// from the browser, renders to PDF and previews on screen. The paper is always white and ink
// coloured, whatever the app theme, because that is what gets printed and filed. The brand
// accent (`accent`, hex) carries the identity: the title, the table header and the grand total.

const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#e5e7eb";

const cell = { padding: "7px 8px", borderBottom: `1px solid ${RULE}`, verticalAlign: "top", fontVariantNumeric: "tabular-nums" };
const head = { padding: "7px 8px", fontSize: 9.5, fontWeight: 600, textAlign: "right", color: INK };
const label = { fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED };

const TotalRow = ({ children, value, strong, accent, border }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      padding: strong ? "8px 0 0" : "4px 0",
      marginTop: strong ? 6 : 0,
      borderTop: border ? `${strong ? 2 : 1}px solid ${accent}` : undefined,
      fontWeight: strong ? 700 : 400,
      fontSize: strong ? 13 : 11,
      color: INK,
      fontVariantNumeric: "tabular-nums",
    }}
  >
    <span>{children}</span>
    <span>{value}</span>
  </div>
);

export default function InvoiceSheet({
  title,
  number,
  copy,
  company,
  party,
  meta,
  lines,
  totals,
  breakdown,
  bank,
  currency,
  accent,
  notice,
  receipt,
  terms,
  acceptance,
  reverseCharge,
}) {
  const soft = tint(accent, 0.1);

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
      {/* top: logo on the left, which copy this is on the right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", minHeight: 52 }}>
        <div>{company.logo ? <img src={company.logo} alt="" style={{ maxHeight: 52, maxWidth: 160 }} /> : null}</div>
        <div style={{ ...label, color: accent }}>{copy}</div>
      </div>

      {/* company */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{company.nameEn}</div>
        {company.nameAr && (
          <div dir="rtl" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{company.nameAr}</div>
        )}
        {company.address.length > 0 && <div style={{ color: MUTED, marginTop: 4, fontSize: 10.5 }}>{company.address.join(", ")}</div>}
        {company.contact.length > 0 && <div style={{ color: MUTED, fontSize: 10.5 }}>{company.contact.join("   ·   ")}</div>}
        {company.trn && (
          <div style={{ fontSize: 10.5, marginTop: 2 }}>
            <span style={{ fontWeight: 600 }}>TRN</span> {company.trn}
          </div>
        )}
      </div>

      {/* title band */}
      <div
        style={{
          marginTop: 16,
          paddingBottom: 8,
          borderBottom: `2px solid ${accent}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: accent }}>
          {title}
        </div>
        {number?.value && (
          <div style={{ textAlign: "right" }}>
            <div style={label}>{number.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{number.value}</div>
          </div>
        )}
      </div>

      {/* party and document details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 16 }}>
        <div>
          <div style={label}>{party.heading}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{party.name}</div>
          {party.code && <div style={{ color: MUTED, fontSize: 10.5 }}>{party.code}</div>}
          {party.address && <div style={{ marginTop: 4, whiteSpace: "pre-line" }}>{party.address}</div>}
          {party.contact.length > 0 && <div style={{ color: MUTED, fontSize: 10.5, marginTop: 2 }}>{party.contact.join("   ·   ")}</div>}
          {party.trn && (
            <div style={{ fontSize: 10.5, marginTop: 2 }}>
              <span style={{ fontWeight: 600 }}>TRN</span> {party.trn}
            </div>
          )}
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

      {/* lines */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, fontSize: 10.5 }}>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "11%" }} />
          <col />
          <col style={{ width: "8%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "13%" }} />
        </colgroup>
        <thead>
          <tr style={{ background: soft, borderBottom: `1px solid ${accent}` }}>
            <th style={{ ...head, textAlign: "center" }}>#</th>
            <th style={{ ...head, textAlign: "left" }}>Code</th>
            <th style={{ ...head, textAlign: "left" }}>Description</th>
            <th style={head}>Qty</th>
            <th style={head}>Unit price</th>
            <th style={head}>Value</th>
            <th style={head}>VAT %</th>
            <th style={head}>VAT</th>
            <th style={head}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={9} style={{ ...cell, textAlign: "center", color: MUTED }}>No items</td>
            </tr>
          )}
          {lines.map((l) => (
            <tr key={l.no}>
              <td style={{ ...cell, textAlign: "center" }}>{l.no}</td>
              <td style={cell}>{l.code}</td>
              <td style={cell}>{l.description}</td>
              <td style={{ ...cell, textAlign: "right" }}>{formatQty(l.qty, 3)}</td>
              <td style={{ ...cell, textAlign: "right" }}>{formatNumber(l.unitPrice)}</td>
              <td style={{ ...cell, textAlign: "right" }}>{formatNumber(l.value)}</td>
              {/* a reverse-charge line charges no VAT: "RC" stands where the rate would be (the statement below says what it means) */}
              <td style={{ ...cell, textAlign: "right" }}>{l.reverseCharge ? "RC" : formatNumber(l.vatPercent, 0)}</td>
              <td style={{ ...cell, textAlign: "right" }}>{formatNumber(l.vat)}</td>
              <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{formatNumber(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* words, VAT breakdown and bank on the left; totals on the right */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 28, marginTop: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 55%", minWidth: 0 }}>
          <div style={label}>Amount in words</div>
          <div style={{ fontWeight: 600, marginTop: 3 }}>{totalInWords(totals.grandTotal, currency)}</div>

          {breakdown.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 10.5 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${RULE}` }}>
                  <th style={{ ...head, textAlign: "left", paddingLeft: 0 }}>VAT rate</th>
                  <th style={head}>Taxable amount</th>
                  <th style={{ ...head, paddingRight: 0 }}>VAT</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((b, i) => (
                  <tr key={i}>
                    <td style={{ ...cell, paddingLeft: 0, borderBottom: "none" }}>{b.rate === null ? b.label : `${formatNumber(b.rate, 0)}%`}</td>
                    <td style={{ ...cell, textAlign: "right", borderBottom: "none" }}>{formatNumber(b.taxable)}</td>
                    <td style={{ ...cell, textAlign: "right", borderBottom: "none", paddingRight: 0 }}>{formatNumber(b.vat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {bank.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={label}>Bank details</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, rowGap: 2, marginTop: 4, fontSize: 10.5 }}>
                {bank.map(([k, v]) => (
                  <React.Fragment key={k}>
                    <div style={{ color: MUTED }}>{k}</div>
                    <div>{v}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 45%", minWidth: 0 }}>
          <TotalRow value={formatNumber(totals.gross)}>Net amount</TotalRow>
          {totals.lineDiscount > 0 && <TotalRow value={`−${formatNumber(totals.lineDiscount)}`}>Line discounts</TotalRow>}
          {totals.headerDiscount > 0 && <TotalRow value={`−${formatNumber(totals.headerDiscount)}`}>Discount</TotalRow>}
          {totals.charges.map((c, i) => (
            <TotalRow key={i} value={formatNumber(c.amount)}>{c.description || "Charge"}</TotalRow>
          ))}
          <TotalRow value={formatNumber(totals.vat)}>VAT</TotalRow>
          {totals.roundOff !== 0 && <TotalRow value={formatNumber(totals.roundOff)}>Round off</TotalRow>}
          <TotalRow strong border accent={accent} value={formatNumber(totals.grandTotal)}>
            Grand total ({currency})
          </TotalRow>
          {/* our own purchase: the VAT we assess on reverse-charge lines, beside the total and not in it */}
          {reverseCharge?.amountLabel && reverseCharge.amount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
              <span>{reverseCharge.amountLabel}</span>
              <span>{formatNumber(reverseCharge.amount)}</span>
            </div>
          )}
        </div>
      </div>

      {/* what a reverse-charge line obliges the document to say */}
      {reverseCharge?.statement && (
        <div style={{ marginTop: 14, padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>
          {reverseCharge.statement}
        </div>
      )}

      {/* what the offer is subject to (a quotation) */}
      {terms && (
        <div style={{ marginTop: 16 }}>
          <div style={label}>Terms</div>
          <div style={{ marginTop: 3, whiteSpace: "pre-line", fontSize: 10.5 }}>{terms}</div>
        </div>
      )}

      {/* footer */}
      <div style={{ marginTop: "auto", paddingTop: 28 }}>
        {acceptance && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <div style={{ width: "46%", textAlign: "center", fontSize: 10.5 }}>
              <div>Accepted on the terms above</div>
              <div style={{ border: `1px solid ${INK}`, height: 64, marginTop: 8 }} />
              <div style={{ ...label, marginTop: 4 }}>Name, signature, stamp and date</div>
            </div>
          </div>
        )}
        {receipt && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <div style={{ width: "40%", textAlign: "center", fontSize: 10.5 }}>
              <div>Received the above goods in good order and condition</div>
              <div style={{ border: `1px solid ${INK}`, height: 64, marginTop: 8 }} />
              <div style={{ ...label, marginTop: 4 }}>Received by</div>
            </div>
          </div>
        )}
        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 8, fontSize: 9.5, color: MUTED }}>
          {notice}
        </div>
      </div>
    </div>
  );
}
