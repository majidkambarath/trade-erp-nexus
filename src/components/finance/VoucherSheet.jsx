import React from "react";
import { formatDateGB, formatNumber } from "../../utils/format";
import { taxIdWord } from "../../lib/taxTerms";
import { tint } from "../PurchaseOrder/shared/invoiceModel";
import { isPartyCopy, signaturesFor } from "./voucherModel";

// The printed finance voucher: an A4 sheet laid out with inline styles only, so the same markup
// prints from the browser and renders to PDF. It is deliberately the tax invoice's twin - the ink,
// the label type, the gold title band and the totals column all follow InvoiceSheet.jsx, so the
// two do not read as two different companies. (On why they are copied rather than imported, see
// the note above the constants below.)
//
// What differs is what a voucher is: a debit/credit ledger table instead of priced lines, the
// invoices it settled, and the three signatures a voucher carries and an invoice does not.
//
// Note on `audit-mobile.mjs`: its `raw-table` rule exempts a printed document, and recognises one
// by `borderCollapse` (the React style-object spelling), `document.write` or `printWindow`. This
// sheet is handed to a hidden iframe's srcdoc, so it has neither of the last two - the inline
// `borderCollapse` in `Table` below is what tells the audit this table is paper, not screen
// layout. `src/lib/statement.js` carries the same note for the same reason.

// The palette and the label type are copied from InvoiceSheet.jsx, which is the source of truth
// for how a printed document from this organisation looks. DeliverySheet.jsx does exactly the same
// and for the same reason: a sheet shares the ink but is free to differ in layout, and exporting
// these from the tax invoice's own file would make it export constants as well as a component.
// If they are changed there, change them here.
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

// A voucher is signed and an invoice is not, so this box is the delivery note's, not the invoice's.
const SignBox = ({ title }) => (
  <div style={{ flex: 1, fontSize: 10.5 }}>
    <div style={label}>{title}</div>
    <div style={{ border: `1px solid ${INK}`, height: 56, marginTop: 6 }} />
  </div>
);

// Fallback only. Which boxes a copy carries is `signaturesFor(copy)` in voucherModel.js - the
// office copy signs the internal control, the customer's copy signs for the money and leaves room
// for the stamp. A caller that passes nothing gets what this sheet always printed.
const SIGNATURES = ["Prepared by", "Checked by", "Approved by"];

const Table = ({ children, style }) => (
  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, ...style }}>{children}</table>
);

export default function VoucherSheet({
  title,
  copy,
  company,
  number,
  party,
  meta,
  fx,
  entries,
  description,
  totals,
  amount,
  words,
  remarks,
  invoices,
  onAccount,
  currency,
  stamp,
  notice,
  accent,
  signatures,
}) {
  const soft = tint(accent, 0.1);
  // Which copy this is decides what the body shows, and `copy` is only settled at markup time -
  // `sheetMarkup` (PurchaseOrder/shared/documentPdf.jsx) spreads the sheet and overrides it for
  // each copy it draws - so the builder cannot make this choice and the component must.
  const forParty = isPartyCopy(copy);
  const signBoxes = signatures || signaturesFor(copy);
  // The party copy's one table carries the balance left on each invoice, which is what the
  // separate "Against invoice" table exists for - so that table is drawn on the office copy only
  // and the customer is not handed the same invoice numbers and figures twice. The column is
  // dropped entirely when nothing was set against an invoice, rather than printed empty.
  const showsBalance = forParty && (description || []).some((d) => d.balance !== null && d.balance !== undefined);

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

      {/* the organisation's own letterhead, the same block the tax invoice prints */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{company.nameEn}</div>
        {company.nameAr && <div dir="rtl" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{company.nameAr}</div>}
        {company.address.length > 0 && <div style={{ color: MUTED, marginTop: 4, fontSize: 10.5 }}>{company.address.join(", ")}</div>}
        {company.contact.length > 0 && <div style={{ color: MUTED, fontSize: 10.5 }}>{company.contact.join("   ·   ")}</div>}
        {company.trn && (
          <div style={{ fontSize: 10.5, marginTop: 2 }}>
            <span style={{ fontWeight: 600 }}>{taxIdWord()}</span> {company.trn}
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

      {/* a voucher that never reached the ledger says so where nobody can miss it. Monochrome
          on purpose: it has to survive a black-and-white laser and must not read as brand chrome. */}
      {stamp && (
        <div
          style={{
            marginTop: 12,
            padding: "7px 10px",
            border: `1px solid ${INK}`,
            borderRadius: 4,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {stamp}
        </div>
      )}

      {/* who the money moved with, and the document's own details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 16 }}>
        <div>
          {party && (
            <>
              <div style={label}>{party.heading}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{party.name}</div>
              {/* Who they are, as the tax invoice prints a buyer (InvoiceSheet.jsx). The address is
                  one free-text field on the master, so it keeps its own line breaks. Each line is
                  drawn only when the master holds it - a voucher never prints an empty label. */}
              {party.address && (
                <div style={{ color: MUTED, marginTop: 3, fontSize: 10.5, whiteSpace: "pre-line" }}>
                  {party.address}
                </div>
              )}
              {party.taxId && (
                <div style={{ fontSize: 10.5, marginTop: 2 }}>
                  <span style={{ fontWeight: 600 }}>{taxIdWord()}</span> {party.taxId}
                </div>
              )}
              {party.email && (
                <div style={{ color: MUTED, fontSize: 10.5 }}>{party.email}</div>
              )}
            </>
          )}
          {fx && (
            <div style={{ marginTop: party ? 10 : 0 }}>
              <div style={label}>Foreign currency</div>
              <div style={{ marginTop: 3, fontWeight: 600 }}>{fx.line}</div>
              <div style={{ color: MUTED, fontSize: 10.5 }}>{fx.provenance}</div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 16, rowGap: 5, alignContent: "start" }}>
          {meta.map(([k, value]) => (
            <React.Fragment key={k}>
              <div style={{ ...label, paddingTop: 2 }}>{k}</div>
              <div style={{ textAlign: "right", fontWeight: 500 }}>{value}</div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* what it posted */}
      {/* The copy that goes to the customer says what the money was FOR; the copy we file says
          which accounts moved. Same sheet, same figures, two readers - see descriptionRows and
          isPartyCopy in voucherModel.js. */}
      {forParty ? (
        <Table style={{ marginTop: 20 }}>
          <colgroup>
            <col style={{ width: "5%" }} />
            <col />
            <col style={{ width: "20%" }} />
            {showsBalance && <col style={{ width: "20%" }} />}
          </colgroup>
          <thead>
            <tr style={{ background: soft, borderBottom: `1px solid ${accent}` }}>
              <th style={{ ...head, textAlign: "center" }}>#</th>
              <th style={{ ...head, textAlign: "left" }}>Description</th>
              <th style={head}>Amount ({currency})</th>
              {showsBalance && <th style={head}>Balance after</th>}
            </tr>
          </thead>
          <tbody>
            {(description || []).map((d) => (
              <tr key={d.no}>
                <td style={{ ...cell, textAlign: "center" }}>{d.no}</td>
                <td style={cell}>{d.text}</td>
                <td style={{ ...cell, textAlign: "right" }}>{formatNumber(d.amount)}</td>
                {/* blank, never 0.00: a line set against no invoice leaves no balance behind */}
                {showsBalance && (
                  <td style={{ ...cell, textAlign: "right" }}>
                    {d.balance === null || d.balance === undefined ? "" : formatNumber(d.balance)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: `2px solid ${accent}` }}>
              <td style={{ ...cell, borderBottom: "none" }} />
              <td style={{ ...cell, borderBottom: "none" }}>Total</td>
              <td style={{ ...cell, borderBottom: "none", textAlign: "right" }}>{formatNumber(amount)}</td>
              {showsBalance && <td style={{ ...cell, borderBottom: "none" }} />}
            </tr>
          </tfoot>
        </Table>
      ) : (
      <Table style={{ marginTop: 20 }}>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col />
          <col style={{ width: "19%" }} />
          <col style={{ width: "19%" }} />
        </colgroup>
        <thead>
          <tr style={{ background: soft, borderBottom: `1px solid ${accent}` }}>
            <th style={{ ...head, textAlign: "center" }}>#</th>
            <th style={{ ...head, textAlign: "left" }}>Account</th>
            <th style={head}>Debit ({currency})</th>
            <th style={head}>Credit ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...cell, textAlign: "center", color: MUTED }}>No postings</td>
            </tr>
          )}
          {entries.map((e) => (
            <tr key={e.no}>
              <td style={{ ...cell, textAlign: "center" }}>{e.no}</td>
              <td style={cell}>
                <div style={{ fontWeight: 600 }}>{e.account}</div>
                {e.description && <div style={{ color: MUTED, fontSize: 9.5 }}>{e.description}</div>}
              </td>
              <td style={{ ...cell, textAlign: "right" }}>{e.debit ? formatNumber(e.debit) : ""}</td>
              <td style={{ ...cell, textAlign: "right" }}>{e.credit ? formatNumber(e.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, borderTop: `2px solid ${accent}` }}>
            <td style={{ ...cell, borderBottom: "none" }} />
            <td style={{ ...cell, borderBottom: "none" }}>Total</td>
            <td style={{ ...cell, borderBottom: "none", textAlign: "right" }}>{formatNumber(totals.debit)}</td>
            <td style={{ ...cell, borderBottom: "none", textAlign: "right" }}>{formatNumber(totals.credit)}</td>
          </tr>
        </tfoot>
      </Table>
      )}

      {/* words and what it settled on the left; the figures on the right */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 28, marginTop: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 55%", minWidth: 0 }}>
          <div style={label}>Amount in words</div>
          <div style={{ fontWeight: 600, marginTop: 3 }}>{words}</div>

          {/* Office copy only: on the party's copy the body table above already names every
              invoice, what went against it and the balance left, so this would be the same
              figures a second time. */}
          {!forParty && invoices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={label}>Against invoice</div>
              <Table style={{ marginTop: 4 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${RULE}` }}>
                    <th style={{ ...head, textAlign: "left", paddingLeft: 0 }}>Invoice</th>
                    <th style={{ ...head, textAlign: "left" }}>Date</th>
                    <th style={head}>Amount</th>
                    <th style={{ ...head, paddingRight: 0 }}>Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...cell, paddingLeft: 0, borderBottom: "none" }}>{r.no}</td>
                      <td style={{ ...cell, borderBottom: "none" }}>{r.date ? formatDateGB(r.date) : ""}</td>
                      <td style={{ ...cell, textAlign: "right", borderBottom: "none" }}>{formatNumber(r.amount)}</td>
                      <td style={{ ...cell, textAlign: "right", borderBottom: "none", paddingRight: 0 }}>{formatNumber(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {/* Narration and notes together: see remarksOf. "Remarks" rather than "Narration"
              because the person reading a receipt is not an accountant. */}
          {remarks && (
            <div style={{ marginTop: 16 }}>
              <div style={label}>Remarks</div>
              <div style={{ marginTop: 3, whiteSpace: "pre-line", fontSize: 10.5 }}>{remarks}</div>
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 45%", minWidth: 0 }}>
          {/* The two sides of the posting are the same bookkeeping the party copy's body leaves
              out - printing them here would hand the customer back through the side door exactly
              what the description table exists to spare them. Their copy gets the one figure that
              concerns them: what was received. */}
          {!forParty && (
            <>
              <TotalRow value={formatNumber(totals.debit)}>Total debit</TotalRow>
              <TotalRow value={formatNumber(totals.credit)}>Total credit</TotalRow>
            </>
          )}
          {onAccount > 0 && <TotalRow value={formatNumber(onAccount)}>On account (not set against an invoice)</TotalRow>}
          <TotalRow strong border accent={accent} value={formatNumber(amount)}>
            Amount ({currency})
          </TotalRow>
        </div>
      </div>

      {/* footer: a voucher is signed, which an invoice is not */}
      <div style={{ marginTop: "auto", paddingTop: 28 }}>
        <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
          {(signBoxes || SIGNATURES).map((name) => <SignBox key={name} title={name} />)}
        </div>
        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 8, fontSize: 9.5, color: MUTED }}>{notice}</div>
      </div>
    </div>
  );
}
