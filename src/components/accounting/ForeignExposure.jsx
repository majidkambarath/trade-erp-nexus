import React from "react";
import { DataTable, DateInput, EmptyState, ErrorNote, Field, Panel, Pill, Spinner, useAsync } from "./kit";
import { currencies } from "../../lib/currencyApi";
import { formatForeign, formatRate } from "../../lib/currencyForms";
import { formatDate, formatNumber } from "../../utils/format";

// Open invoices in a foreign currency, valued at the rate on a day against what the books carry for them. The difference is unrealised: nothing is
// posted for it; the gain or loss is posted when the invoice is settled (a receipt or payment in the invoice's currency).
export default function ForeignExposure({ asOn, onAsOn }) {
  const q = useAsync(() => currencies.exposure({ asOn: asOn || undefined }), [asOn]);
  const d = q.data;
  const base = d?.baseCurrency || "";
  const sign = (n) => (n > 0 ? "+" : "") + formatNumber(n, 2);
  const tone = (n) => (n > 0 ? "text-status-success" : n < 0 ? "text-status-danger" : "");

  return (
    <Panel
      bodyClassName="p-0" title="Open foreign-currency invoices"
      description="Valued at the rate on the day below. Unrealised: nothing is posted for this; the realised gain or loss is posted when each invoice is settled."
      actions={<Field label="As on" className="w-40"><DateInput value={asOn} onChange={(e) => onAsOn(e.target.value)} /></Field>}
    >
      {q.loading && !d && <Spinner label="Valuing open invoices" />}
      {q.error && <ErrorNote error={q.error} onRetry={q.reload} />}
      {d && d.rows.length === 0 && <EmptyState title="No open foreign-currency invoices" text="Every invoice made in a foreign currency is settled." />}
      {d && d.rows.length > 0 && (
        <>
          <div className="erp-scroll table-pin-first relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Exposure by currency</caption>
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2 text-start">Currency</th>
                  <th scope="col" className="px-3 py-2 text-end">Owed to us</th>
                  <th scope="col" className="px-3 py-2 text-end">We owe</th>
                  <th scope="col" className="px-3 py-2 text-end">Net</th>
                  <th scope="col" className="px-3 py-2 text-end">Rate now</th>
                  <th scope="col" className="px-3 py-2 text-end">Booked at ({base})</th>
                  <th scope="col" className="px-3 py-2 text-end">Worth now ({base})</th>
                  <th scope="col" className="px-5 py-2 text-end">Difference</th>
                </tr>
              </thead>
              <tbody>
                {d.currencies.map((c) => (
                  <tr key={c.currency} className="border-t border-border">
                    <td className="px-5 py-2.5 font-mono text-xs font-semibold">{c.currency}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{formatForeign(c.receivable, c.currency)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{formatForeign(c.payable, c.currency)}</td>
                    <td className="px-3 py-2.5 text-end font-medium tabular-nums">{formatForeign(c.net, c.currency)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{c.rateNow == null ? "no rate" : formatRate(c.rateNow)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(c.carrying, 2)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(c.valued, 2)}</td>
                    <td className={`px-5 py-2.5 text-end font-medium tabular-nums ${tone(c.difference)}`}>{sign(c.difference)}{c.unvalued > 0 && <span className="block text-xs font-normal text-muted-foreground">{c.unvalued} without a rate</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataTable
            caption="Open foreign-currency invoices"
            rows={d.rows}
            rowKey={(r) => r.id}
            columns={[
              { key: "no", header: "Invoice", card: "primary", className: "font-mono text-xs font-semibold", cell: (r) => <>{r.number}<span className="block font-sans font-normal text-muted-foreground">{formatDate(r.date)}</span></> },
              { key: "party", header: "Party", card: "title", className: "font-medium", cell: (r) => r.party },
              { key: "side", header: "Side", card: "badge", cell: (r) => <Pill tone={r.side === "receivable" ? "info" : "warning"}>{r.side === "receivable" ? "Receivable" : "Payable"}</Pill> },
              { key: "open", header: "Open", align: "end", card: "amount", className: "whitespace-nowrap tabular-nums", cell: (r) => formatForeign(r.foreignOpen, r.currency) },
              { key: "rate", header: "Booked rate", align: "end", cell: (r) => <span className="tabular-nums">{formatRate(r.rateAtInvoice)}</span> },
              { key: "carry", header: `Booked (${base})`, align: "end", className: "tabular-nums", cell: (r) => formatNumber(r.carrying, 2) },
              { key: "diff", header: "Difference", align: "end", card: "meta", className: "tabular-nums", cell: (r) => (r.difference == null ? "" : <span className={tone(r.difference)}>{sign(r.difference)}</span>) },
            ]}
          />
          <p className={`border-t border-border px-5 py-3 text-sm font-medium tabular-nums ${tone(d.totalDifference)}`}>Net unrealised difference: {base} {sign(d.totalDifference)}</p>
        </>
      )}
    </Panel>
  );
}
