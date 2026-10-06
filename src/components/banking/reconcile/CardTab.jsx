import React from "react";
import StatCard from "../../ui/stat-card";
import { DataTable, EmptyState, ErrorNote, Panel, Spinner, useAsync } from "../../accounting/kit";
import { reconcile } from "../../../lib/bankReconcileApi";
import { formatDate, formatNumber } from "../../../utils/format";

// Card sales as the acquirer pays them. A card sale is booked on the day it is made; the acquirer pays
// days later, in one lump, less its commission and VAT. This tab shows what is still waiting to be
// paid out, the payments already settled, and what the commission really costs against what the card
// masters say it should.

const pct = (n) => `${formatNumber(n, 2)}%`;

export default function CardTab({ account, version }) {
  const ageing = useAsync(() => reconcile.cardAgeing({ accountId: account._id }), [account._id, version]);
  const variance = useAsync(() => reconcile.cardVariance({ accountId: account._id }), [account._id, version]);
  const a = ageing.data;
  const v = variance.data;
  const loading = (ageing.loading && !a) || (variance.loading && !v);

  return (
    <div className="space-y-5">
      {loading && <Spinner label="Loading card figures" />}
      <ErrorNote error={ageing.error || variance.error} onRetry={() => { ageing.reload(); variance.reload(); }} />
      {a && v && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Waiting to be paid out" count={formatNumber(a.total, 2)} subText={`${a.count} card sale${a.count === 1 ? "" : "s"}`} tone="teal" />
          <StatCard title="Settlements" count={String(v.summary.settlements)} subText={`${formatNumber(v.summary.gross, 2)} of sales`} tone="olive" />
          <StatCard title="Commission booked" count={pct(v.summary.bookedRate)} subText="At the rate on the card" tone="neutral" />
          <StatCard title="Commission taken" count={pct(v.summary.effectiveRate)} subText={v.summary.extraCommission > 0 ? `${formatNumber(v.summary.extraCommission, 2)} more than booked` : "As booked"} tone={v.summary.effectiveRate > v.summary.bookedRate ? "warning" : "plum"} />
        </div>
      )}

      {a && (
        <Panel title="Waiting to be paid out" description="Card sales whose money has not yet arrived in the bank, by working days since the sale." bodyClassName="p-0">
          {a.needsSetup && <EmptyState title="Set this account up first" text="Import a statement for this account, then card sales are tracked from the start day." />}
          {!a.needsSetup && a.count === 0 && <EmptyState title="Nothing waiting" text="Every card sale has been settled against a payment from the acquirer." />}
          {a.count > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                {a.buckets.map((b) => (
                  <div key={b.label} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{b.label}</p>
                    <p className="mt-1 font-semibold tabular-nums">{formatNumber(b.total, 2)}</p>
                    <p className="text-xs text-muted-foreground">{b.count} sale{b.count === 1 ? "" : "s"}</p>
                  </div>
                ))}
              </div>
              <DataTable
                caption="Card sales waiting to be paid out"
                rows={a.items}
                rowKey={(r) => r.entryId}
                columns={[
                  { key: "no", header: "Receipt", card: "primary", cell: (r) => <span className="font-mono text-xs font-semibold">{r.voucherNo}</span> },
                  { key: "day", header: "Sale date", card: "title", className: "whitespace-nowrap", cell: (r) => formatDate(r.day) },
                  { key: "card", header: "Card", card: "meta", className: "text-muted-foreground", cell: (r) => r.cardLabel },
                  { key: "age", header: "Working days", align: "end", card: "meta", className: "tabular-nums", cell: (r) => r.workingDays },
                  { key: "net", header: "To come", align: "end", card: "amount", className: "font-medium tabular-nums", cell: (r) => formatNumber(r.net, 2) },
                ]}
              />
            </>
          )}
        </Panel>
      )}

      {v && v.settlements.length > 0 && (
        <Panel title="Settlements" description="What the acquirer paid, and what it kept." bodyClassName="p-0">
          <DataTable
            caption="Card settlements"
            rows={v.settlements}
            rowKey={(s) => s._id}
            columns={[
              { key: "day", header: "Paid on", card: "primary", className: "whitespace-nowrap", cell: (s) => formatDate(s.settlementDate) },
              { key: "ref", header: "Reference", card: "title", className: "text-muted-foreground", cell: (s) => s.settlementRef || "-" },
              { key: "sales", header: "Sales", align: "end", card: "meta", className: "tabular-nums", cell: (s) => `${s.receiptCount} · ${formatNumber(s.gross, 2)}` },
              { key: "extra", header: "Extra commission", align: "end", card: "meta", className: "tabular-nums", cell: (s) => formatNumber(s.extraCommission, 2) },
              { key: "vat", header: "VAT", align: "end", card: "meta", className: "tabular-nums", cell: (s) => formatNumber(s.vat, 2) },
              { key: "rate", header: "Commission", align: "end", card: "meta", className: "tabular-nums", cell: (s) => pct(s.effectiveRate) },
              { key: "paid", header: "Received", align: "end", card: "amount", className: "font-medium tabular-nums", cell: (s) => formatNumber(s.received, 2) },
            ]}
          />
        </Panel>
      )}

      {v && v.cards.length > 0 && (
        <Panel title="By card" description="Sales settled, and the commission rate booked on each card." bodyClassName="p-0">
          <DataTable
            caption="Card sales by card"
            rows={v.cards}
            rowKey={(c) => String(c.cardId || c.cardLabel)}
            columns={[
              { key: "card", header: "Card", card: "primary", className: "font-medium", cell: (c) => c.cardLabel },
              { key: "sales", header: "Sales", align: "end", card: "meta", className: "tabular-nums", cell: (c) => c.sales },
              { key: "gross", header: "Amount", align: "end", card: "amount", className: "tabular-nums", cell: (c) => formatNumber(c.gross, 2) },
              { key: "fee", header: "Commission booked", align: "end", card: "meta", className: "tabular-nums", cell: (c) => `${formatNumber(c.feeBooked, 2)} (${pct(c.bookedRate)})` },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
